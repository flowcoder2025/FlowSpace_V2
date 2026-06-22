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
    // 토큰 발급 (일시적 실패는 재시도, 원인별 SocketTokenError로 실패)
    const token = await fetchSocketToken();

    const url = getSocketUrl();
    console.log("[Socket] Connecting to:", url);

    const next = io(url, {
      auth: { token },
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
}
