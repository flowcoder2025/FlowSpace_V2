import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@/features/space/protocol";
import {
  RECONNECTION_ATTEMPTS,
  RECONNECTION_DELAY,
  RECONNECTION_DELAY_MAX,
  RECONNECTION_TIMEOUT,
} from "@/features/space/protocol";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/**
 * 토큰 fetch 재시도 백오프 지연(ms). 배열 길이 = 추가 재시도 횟수이므로
 * 총 시도 횟수 = `길이 + 1`. (예: `[300, 900]` → 최초 1회 + 재시도 2회 = 3회)
 */
export const SOCKET_TOKEN_RETRY_DELAYS_MS = [300, 900] as const;

/** 소켓 토큰 발급 실패 원인 분류 (use-socket이 사용자 메시지로 매핑) */
export type SocketTokenErrorCode =
  | "UNAUTHORIZED" // 401/403 — 세션/권한 문제, 재시도 무의미
  | "TEMPORARY_FAILURE" // 408/429/5xx 재시도 소진 또는 비-재시도 4xx
  | "NETWORK_FAILURE" // fetch 자체 예외(오프라인 등) 재시도 소진
  | "INVALID_RESPONSE"; // 2xx지만 token 누락/형식 오류

/**
 * 소켓 토큰 발급 실패를 원인별로 구분하는 에러.
 * 서버는 `verifySocketToken`으로 토큰을 필수 검증하므로 익명(무토큰) 폴백은
 * 계약 위반 — 폴백은 "명확한 실패 상태"이지 무인증 접속이 아니다.
 */
export class SocketTokenError extends Error {
  readonly code: SocketTokenErrorCode;
  constructor(code: SocketTokenErrorCode, message: string) {
    super(message);
    this.name = "SocketTokenError";
    this.code = code;
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 재시도 대상(일시적) HTTP 상태: 408 Request Timeout · 429 Too Many Requests · 5xx */
function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

interface FetchSocketTokenOptions {
  /** 테스트에서 백오프 지연을 즉시화하기 위한 주입 seam (프로덕션 미지정 = 실제 지연) */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * 소켓 접속 토큰을 발급받는다.
 *
 * 일시적 실패(네트워크 예외 · 408/429/5xx)는 {@link SOCKET_TOKEN_RETRY_DELAYS_MS}
 * 백오프로 재시도하고, 인증 실패(401/403)·응답 형식 오류는 즉시 실패한다.
 * 모든 실패는 원인 코드를 가진 {@link SocketTokenError}로 던져진다.
 */
export async function fetchSocketToken(
  opts: FetchSocketTokenOptions = {}
): Promise<string> {
  const sleep = opts.sleep ?? defaultSleep;
  const maxAttempts = SOCKET_TOKEN_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isLastAttempt = attempt === maxAttempts - 1;

    let res: Response;
    try {
      res = await fetch("/api/socket/token");
    } catch (networkErr) {
      // fetch 자체 예외(오프라인/DNS 등) → 일시적 → 재시도
      if (!isLastAttempt) {
        await sleep(SOCKET_TOKEN_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw new SocketTokenError(
        "NETWORK_FAILURE",
        `소켓 토큰 발급 네트워크 오류: ${
          networkErr instanceof Error ? networkErr.message : "unknown"
        }`
      );
    }

    if (res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        throw new SocketTokenError(
          "INVALID_RESPONSE",
          "소켓 토큰 응답을 파싱할 수 없습니다."
        );
      }
      const token = (body as { token?: unknown } | null)?.token;
      if (typeof token !== "string" || token.length === 0) {
        throw new SocketTokenError(
          "INVALID_RESPONSE",
          "소켓 토큰 응답에 유효한 token이 없습니다."
        );
      }
      return token;
    }

    // 401/403 = 세션/권한 문제 → 재시도 무의미, 즉시 실패
    if (res.status === 401 || res.status === 403) {
      throw new SocketTokenError(
        "UNAUTHORIZED",
        `소켓 토큰 발급 인증 실패 (status ${res.status})`
      );
    }

    // 408/429/5xx = 일시적 → 재시도
    if (isRetriableStatus(res.status) && !isLastAttempt) {
      await sleep(SOCKET_TOKEN_RETRY_DELAYS_MS[attempt]);
      continue;
    }

    // 비-재시도 4xx 또는 재시도 소진
    throw new SocketTokenError(
      "TEMPORARY_FAILURE",
      `소켓 토큰 발급 실패 (status ${res.status})`
    );
  }

  // 도달 불가: 루프는 항상 return/throw로 종료 (타입 안정용 가드)
  throw new SocketTokenError("TEMPORARY_FAILURE", "소켓 토큰 발급 실패");
}

/**
 * 소켓 토큰 캐시 (WI-049).
 *
 * `/api/socket/token` JWT는 TTL 1시간. socket.io 재연결은 handshake마다 토큰을
 * 다시 제출하므로, 1시간 이상 열린 세션이 재연결할 때 만료 토큰을 보내면 서버가
 * `Invalid token`으로 거부한다. 이를 막기 위해 `getSocketAuthToken()`이 토큰을
 * 캐시하고 만료 임박 시에만 새로 발급한다(재연결마다 `/api/socket/token` 과호출 방지).
 */
interface CachedSocketToken {
  token: string;
  /** JWT exp(ms) 기반 만료 시각. exp 디코드 실패 시 보수적 폴백. */
  expiresAt: number;
}

let cachedToken: CachedSocketToken | null = null;
let pendingToken: Promise<string> | null = null;
/**
 * 토큰 캐시 세대. `disconnectSocket()`(로그아웃/세션 종료)에서 증가시킨다. in-flight
 * 발급 promise는 시작 시 세대를 캡처해, 해소 시점에 세대가 바뀌었으면(=그 사이 disconnect)
 * `cachedToken`을 적재하지 않는다 — 폐기된 세션의 토큰이 다음 세션 캐시를 재오염하는 것을
 * 막는다(다른 사용자 재로그인 시 stale 토큰 재사용 차단, codex WI-049 r1 P1).
 */
let tokenGeneration = 0;

/** 만료 이 시간 전부터는 미리 새 토큰을 받는다(handshake 직전 만료 경합 방지). */
const TOKEN_REFRESH_SKEW_MS = 60_000;
/** exp 디코드 실패 시 보수적 캐시 수명(서버 1h TTL보다 짧게). */
const TOKEN_FALLBACK_TTL_MS = 50 * 60_000;

/**
 * JWT payload의 `exp`(초)를 ms로 디코드한다. **검증이 아니라 클라이언트 캐시 힌트
 * 전용** — 서명 검증은 소켓 서버가 한다. 파싱 실패 시 null.
 */
function decodeJwtExpiryMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // base64url → base64 + 패딩 복원(JWT payload는 패딩 없는 base64url).
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8")
    );
    return typeof json?.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * 유효(만료 임박 전) 캐시 토큰을 반환하거나 새로 발급한다.
 *
 * - 캐시가 만료 임박 전이면 즉시 반환(네트워크 호출 없음).
 * - 동시 호출은 `pendingToken`으로 dedupe(재연결 폭주 시 중복 fetch 방지).
 * - 새 발급 실패 시, 기존 캐시 토큰이 아직 만료 전이면 그것으로 버틴다(끊김 완화).
 */
export async function getSocketAuthToken(
  opts: FetchSocketTokenOptions = {}
): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.expiresAt - TOKEN_REFRESH_SKEW_MS) {
    return cachedToken.token;
  }
  if (pendingToken) return pendingToken;

  const previous = cachedToken;
  const generation = tokenGeneration;
  const pending = (async (): Promise<string> => {
    const token = await fetchSocketToken(opts);
    // 발급 await 동안 disconnectSocket()가 일어났으면(세대 불일치) 캐시를 적재하지
    // 않는다 — 폐기된 세션 토큰이 다음 세션을 재오염하지 못하게(codex r1 P1).
    if (generation === tokenGeneration) {
      cachedToken = {
        token,
        expiresAt: decodeJwtExpiryMs(token) ?? Date.now() + TOKEN_FALLBACK_TTL_MS,
      };
    }
    return token;
  })();
  pendingToken = pending;
  try {
    return await pending;
  } catch (err) {
    // 갱신 실패 + 기존 토큰이 아직 만료 전이면 그걸로 버틴다(불필요한 끊김 방지).
    if (previous && Date.now() < previous.expiresAt) return previous.token;
    throw err;
  } finally {
    if (pendingToken === pending) pendingToken = null;
  }
}

/**
 * 마지막 auth 콜백(handshake)에서 발생한 토큰 발급 실패. socket.io `auth` 콜백은
 * throw/reject로 타입 에러를 전달할 수 없어(빈 토큰 → 서버 거부 → `connect_error`),
 * use-socket이 `connect_error` 시 이 값을 읽어 코드별 안내 메시지로 매핑한다(WI-049).
 */
let lastAuthError: SocketTokenError | null = null;

/** 마지막 auth 실패를 1회성으로 소비한다(읽고 즉시 초기화). */
export function consumeLastSocketAuthError(): SocketTokenError | null {
  const err = lastAuthError;
  lastAuthError = null;
  return err;
}

function getSocketUrl(): string {
  if (typeof window === "undefined") return "";
  // 프로덕션: 별도 서브도메인 (e.g. https://v2-socket.flow-coder.com)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  // 개발: 같은 호스트의 다른 포트
  const port = process.env.NEXT_PUBLIC_SOCKET_PORT || "3001";
  return `${window.location.protocol}//${window.location.hostname}:${port}`;
}

/**
 * 진행 중(in-flight)인 소켓 생성 promise. 토큰 발급(재시도 포함) await 윈도우
 * 동안 들어오는 동시 getSocketClient() 호출이 중복 fetch/중복 io()를 만들지
 * 않도록 동일 promise를 공유한다(마지막 생성분만 남고 나머지가 누수되는 race 차단).
 */
let pendingClient: Promise<TypedSocket> | null = null;

/** 소켓 클라이언트 인스턴스 (싱글턴) */
export async function getSocketClient(): Promise<TypedSocket> {
  // 이미 연결됐거나 연결 중인 소켓 재사용
  if (socket && (socket.connected || socket.active)) {
    return socket;
  }

  // 생성이 진행 중이면 동일 promise 공유 (중복 fetch/io 방지)
  if (pendingClient) {
    return pendingClient;
  }

  // 이전 소켓이 있으면 정리
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  const pending = (async (): Promise<TypedSocket> => {
    // 초기 토큰 prefetch — 실패 시 원인별 SocketTokenError를 그대로 던져
    // use-socket의 catch가 코드별 안내 메시지로 매핑하는 기존 UX를 보존한다.
    // (성공 시 캐시에 적재 → 직후 auth 콜백 첫 호출이 재fetch 없이 재사용.)
    await getSocketAuthToken();

    const url = getSocketUrl();
    console.log("[Socket] Connecting to:", url);

    const next = io(url, {
      // WI-049: 정적 토큰 대신 함수 — socket.io가 매 (재)연결 handshake마다 호출.
      // 캐시된 fresh 토큰을 공급하므로 1시간+ 세션의 재연결도 만료 토큰을 보내지 않는다.
      // 발급 실패 시 빈 토큰을 넘겨 서버가 거부(connect_error)하게 하고, 원인은 stash해
      // use-socket이 코드별 메시지로 안내한다.
      auth: (cb: (data: { token: string }) => void) => {
        getSocketAuthToken()
          .then((token) => cb({ token }))
          .catch((err) => {
            lastAuthError = err instanceof SocketTokenError ? err : null;
            cb({ token: "" });
          });
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: RECONNECTION_ATTEMPTS,
      reconnectionDelay: RECONNECTION_DELAY,
      reconnectionDelayMax: RECONNECTION_DELAY_MAX,
      timeout: RECONNECTION_TIMEOUT,
    });
    socket = next;
    return next;
  })();

  pendingClient = pending;
  try {
    return await pending;
  } finally {
    // 더 새로운 생성이 시작됐다면 그 pending을 덮어쓰지 않는다
    if (pendingClient === pending) {
      pendingClient = null;
    }
  }
}

/** 소켓 연결 해제 */
export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  // 세션 완전 종료 → 다음 마운트는 새 토큰을 받도록 캐시 폐기(WI-049).
  // 세대 증가 → 진행 중인 발급이 해소돼도 이 캐시를 재오염하지 못한다(codex r1 P1).
  cachedToken = null;
  pendingToken = null;
  lastAuthError = null;
  tokenGeneration++;
}
