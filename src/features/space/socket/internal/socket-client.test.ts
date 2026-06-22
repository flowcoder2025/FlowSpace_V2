import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchSocketToken,
  getSocketClient,
  disconnectSocket,
  SocketTokenError,
  SOCKET_TOKEN_RETRY_DELAYS_MS,
  type SocketTokenErrorCode,
} from "./socket-client";

// ============================================================
// WI-017: 소켓 토큰 발급 재시도 + 원인별 실패 분류 테스트
// fetch를 순서 시퀀스로 모킹하고, 백오프 sleep을 주입해 즉시화한다.
// ============================================================

type FetchStep =
  | { kind: "response"; ok: boolean; status: number; body?: unknown; jsonThrows?: boolean }
  | { kind: "network-error"; error?: Error };

let steps: FetchStep[];
let fetchCalls: number;

function makeResponse(step: Extract<FetchStep, { kind: "response" }>): Response {
  return {
    ok: step.ok,
    status: step.status,
    json: async () => {
      if (step.jsonThrows) throw new SyntaxError("Unexpected end of JSON input");
      return step.body;
    },
  } as unknown as Response;
}

beforeEach(() => {
  steps = [];
  fetchCalls = 0;
  global.fetch = vi.fn(async () => {
    const step = steps[fetchCalls];
    fetchCalls += 1;
    if (!step) throw new Error(`예상보다 많은 fetch 호출 (#${fetchCalls})`);
    if (step.kind === "network-error") {
      throw step.error ?? new TypeError("Failed to fetch");
    }
    return makeResponse(step);
  }) as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
  disconnectSocket(); // 모듈 싱글턴 리셋
});

/** 백오프 지연을 즉시화하면서 호출된 지연값을 기록하는 주입 sleep */
function makeInstantSleep() {
  const delays: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    delays.push(ms);
  });
  return { sleep, delays };
}

const ok = (body: unknown): FetchStep => ({ kind: "response", ok: true, status: 200, body });
const fail = (status: number): FetchStep => ({ kind: "response", ok: false, status });
const netErr = (): FetchStep => ({ kind: "network-error" });

async function tokenErrorFrom(opts: { sleep: (ms: number) => Promise<void> }): Promise<SocketTokenError> {
  let caught: unknown;
  try {
    await fetchSocketToken(opts);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(SocketTokenError);
  return caught as SocketTokenError;
}

describe("fetchSocketToken — 성공 경로", () => {
  it("첫 시도 성공 시 token 반환, fetch 1회·재시도 없음", async () => {
    const { sleep, delays } = makeInstantSleep();
    steps = [ok({ token: "jwt-abc" })];

    const token = await fetchSocketToken({ sleep });

    expect(token).toBe("jwt-abc");
    expect(fetchCalls).toBe(1);
    expect(delays).toEqual([]);
  });

  it("네트워크 예외 2회 후 성공 → 재시도하여 token 반환 (총 3회)", async () => {
    const { sleep, delays } = makeInstantSleep();
    steps = [netErr(), netErr(), ok({ token: "jwt-net" })];

    const token = await fetchSocketToken({ sleep });

    expect(token).toBe("jwt-net");
    expect(fetchCalls).toBe(3);
    // 백오프 지연이 상수 순서대로 적용되었는지 (지연값 변이 검출)
    expect(delays).toEqual([
      SOCKET_TOKEN_RETRY_DELAYS_MS[0],
      SOCKET_TOKEN_RETRY_DELAYS_MS[1],
    ]);
  });

  it("500 2회 후 200 → 재시도하여 성공 (총 3회)", async () => {
    const { sleep } = makeInstantSleep();
    steps = [fail(500), fail(503), ok({ token: "jwt-5xx" })];

    const token = await fetchSocketToken({ sleep });

    expect(token).toBe("jwt-5xx");
    expect(fetchCalls).toBe(3);
  });

  it("429 후 성공 → 재시도 대상으로 처리", async () => {
    const { sleep } = makeInstantSleep();
    steps = [fail(429), ok({ token: "jwt-429" })];

    const token = await fetchSocketToken({ sleep });

    expect(token).toBe("jwt-429");
    expect(fetchCalls).toBe(2);
  });

  it("408 후 성공 → 재시도 대상으로 처리", async () => {
    const { sleep } = makeInstantSleep();
    steps = [fail(408), ok({ token: "jwt-408" })];

    const token = await fetchSocketToken({ sleep });

    expect(token).toBe("jwt-408");
    expect(fetchCalls).toBe(2);
  });
});

describe("fetchSocketToken — 인증 실패는 재시도 없이 즉시 실패", () => {
  it("401 → UNAUTHORIZED, 재시도 없음(fetch 1회·sleep 미호출)", async () => {
    const { sleep, delays } = makeInstantSleep();
    steps = [fail(401), ok({ token: "should-not-reach" })];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("UNAUTHORIZED");
    expect(fetchCalls).toBe(1);
    expect(delays).toEqual([]);
  });

  it("403 → UNAUTHORIZED, 재시도 없음", async () => {
    const { sleep } = makeInstantSleep();
    steps = [fail(403)];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("UNAUTHORIZED");
    expect(fetchCalls).toBe(1);
  });
});

describe("fetchSocketToken — 재시도 소진 / 비-재시도 실패", () => {
  it("5xx 3회 전부 실패 → TEMPORARY_FAILURE (최대 시도 소진)", async () => {
    const { sleep } = makeInstantSleep();
    steps = [fail(500), fail(500), fail(500)];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("TEMPORARY_FAILURE");
    expect(fetchCalls).toBe(SOCKET_TOKEN_RETRY_DELAYS_MS.length + 1);
  });

  it("네트워크 예외 3회 전부 → NETWORK_FAILURE", async () => {
    const { sleep } = makeInstantSleep();
    steps = [netErr(), netErr(), netErr()];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("NETWORK_FAILURE");
    expect(fetchCalls).toBe(SOCKET_TOKEN_RETRY_DELAYS_MS.length + 1);
  });

  it("400(비-재시도 4xx) → TEMPORARY_FAILURE, 재시도 없음", async () => {
    const { sleep, delays } = makeInstantSleep();
    steps = [fail(400), ok({ token: "should-not-reach" })];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("TEMPORARY_FAILURE");
    expect(fetchCalls).toBe(1);
    expect(delays).toEqual([]);
  });
});

describe("fetchSocketToken — 응답 형식 오류는 재시도 없이 INVALID_RESPONSE", () => {
  it("2xx지만 token 누락 → INVALID_RESPONSE, 재시도 없음", async () => {
    const { sleep } = makeInstantSleep();
    steps = [ok({ notToken: "x" }), ok({ token: "should-not-reach" })];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("INVALID_RESPONSE");
    expect(fetchCalls).toBe(1);
  });

  it("2xx지만 token이 빈 문자열 → INVALID_RESPONSE", async () => {
    const { sleep } = makeInstantSleep();
    steps = [ok({ token: "" })];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("INVALID_RESPONSE");
    expect(fetchCalls).toBe(1);
  });

  it("2xx지만 json() 파싱 예외 → INVALID_RESPONSE", async () => {
    const { sleep } = makeInstantSleep();
    steps = [{ kind: "response", ok: true, status: 200, jsonThrows: true }];

    const err = await tokenErrorFrom({ sleep });

    expect(err.code).toBe<SocketTokenErrorCode>("INVALID_RESPONSE");
    expect(fetchCalls).toBe(1);
  });
});

describe("getSocketClient — 토큰 실패를 SocketTokenError로 전파(io 미생성)", () => {
  it("401이면 io 소켓을 만들지 않고 SocketTokenError 전파", async () => {
    // getSocketClient는 인자 없이 fetchSocketToken()을 호출 — 401은 재시도/지연 없어 실제 sleep 미발생
    steps = [fail(401)];

    let caught: unknown;
    try {
      await getSocketClient();
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(SocketTokenError);
    expect((caught as SocketTokenError).code).toBe<SocketTokenErrorCode>("UNAUTHORIZED");
    expect(fetchCalls).toBe(1); // io()에 도달하지 않음
  });
});
