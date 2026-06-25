import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

// ============================================================
// WI-017 P2-2: 토큰 발급(재시도 포함) 비동기 윈도우 중 언마운트/effect 교체 시
// stale effect가 후속 effect의 소켓을 끊지 않고(generation 가드), 순수 언마운트
// 시에는 orphan 소켓을 정리하는지 검증한다.
//
// ./socket-client를 모킹해 getSocketClient 해소 타이밍을 수동 제어하고,
// disconnectSocket 호출 횟수로 생명주기 동작을 단언한다.
// ============================================================

const { getSocketClientMock, disconnectSocketMock, consumeLastSocketAuthErrorMock } =
  vi.hoisted(() => ({
    getSocketClientMock: vi.fn(),
    disconnectSocketMock: vi.fn(),
    consumeLastSocketAuthErrorMock: vi.fn(),
  }));

vi.mock("./socket-client", async (importActual) => {
  const actual = await importActual<typeof import("./socket-client")>();
  return {
    ...actual, // SocketTokenError / 타입 등 실제 export 유지
    getSocketClient: getSocketClientMock,
    disconnectSocket: disconnectSocketMock,
    consumeLastSocketAuthError: consumeLastSocketAuthErrorMock,
  };
});

// WI-047: kick 가드를 모킹해 isSpaceKicked 반환값을 제어하고 markSpaceKicked 호출을 단언한다.
const { isSpaceKickedMock, markSpaceKickedMock } = vi.hoisted(() => ({
  isSpaceKickedMock: vi.fn(() => false),
  markSpaceKickedMock: vi.fn(),
}));

vi.mock("./kick-guard", () => ({
  isSpaceKicked: isSpaceKickedMock,
  markSpaceKicked: markSpaceKickedMock,
  clearSpaceKicked: vi.fn(),
}));

import { useSocket } from "./use-socket";
import { SocketTokenError } from "./socket-client";

/** useSocket effect가 반환 소켓에 호출하는 표면을 최소 충족하는 가짜 소켓 */
function makeFakeSocket() {
  return {
    on: vi.fn(),
    io: { on: vi.fn() },
    connected: false,
    connect: vi.fn(),
    emit: vi.fn(),
  };
}

/** 수동 해소 가능한 deferred */
function defer<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

const baseProps = {
  spaceId: "space-1",
  userId: "user-1",
  nickname: "tester",
  avatar: "avatar-1",
};

beforeEach(() => {
  getSocketClientMock.mockReset();
  disconnectSocketMock.mockReset();
  isSpaceKickedMock.mockReset();
  isSpaceKickedMock.mockReturnValue(false); // 기본: 강퇴 아님
  markSpaceKickedMock.mockReset();
  consumeLastSocketAuthErrorMock.mockReset();
  consumeLastSocketAuthErrorMock.mockReturnValue(null); // 기본: 인증 stash 없음
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useSocket — 토큰 발급 중 생명주기 race (WI-017 P2-2)", () => {
  it("순수 언마운트(토큰 발급 중) → 해소된 orphan 소켓을 정리한다", async () => {
    const d = defer<ReturnType<typeof makeFakeSocket>>();
    getSocketClientMock.mockReturnValue(d.promise);

    const { unmount } = renderHook(() => useSocket(baseProps));

    // 토큰 발급 진행 중 언마운트 → cleanup이 disconnectSocket 1회 호출(이 시점 소켓 미생성)
    act(() => {
      unmount();
    });
    const callsAfterUnmount = disconnectSocketMock.mock.calls.length;
    expect(callsAfterUnmount).toBe(1);

    // 이후 소켓 생성이 완료되면(orphan) — 후속 effect가 없으므로 정리되어야 한다
    await act(async () => {
      d.resolve(makeFakeSocket());
      await flush();
    });

    expect(disconnectSocketMock.mock.calls.length).toBe(callsAfterUnmount + 1);
  });

  it("토큰 발급 중 deps 변경 → stale effect가 공유 소켓을 끊지 않는다", async () => {
    // 두 effect가 동일 pending(공유 소켓)을 받도록 같은 promise 반환
    const d = defer<ReturnType<typeof makeFakeSocket>>();
    getSocketClientMock.mockReturnValue(d.promise);

    const { rerender } = renderHook((props) => useSocket(props), {
      initialProps: baseProps,
    });

    // deps 변경(nickname) → cleanup(disconnectSocket 1회) + 새 effect 시작
    act(() => {
      rerender({ ...baseProps, nickname: "tester-2" });
    });
    expect(disconnectSocketMock.mock.calls.length).toBe(1);

    const fake = makeFakeSocket();
    await act(async () => {
      d.resolve(fake);
      await flush();
    });

    // stale(이전) effect는 generation 불일치로 disconnect를 호출하지 않아야 한다
    // → 누적 호출은 cleanup 1회 그대로(2회가 되면 stale이 공유 소켓을 끊은 것)
    expect(disconnectSocketMock.mock.calls.length).toBe(1);
    // 후속 effect는 공유 소켓을 정상 사용(핸들러 등록)
    expect(fake.on).toHaveBeenCalled();
  });
});

/** 등록된 sock.on(event) 핸들러 추출 */
function onHandler(fake: ReturnType<typeof makeFakeSocket>, event: string) {
  return fake.on.mock.calls.find((c) => c[0] === event)?.[1] as
    | ((data?: unknown) => void)
    | undefined;
}
/** 등록된 sock.io.on(event) 핸들러 추출 */
function ioHandler(fake: ReturnType<typeof makeFakeSocket>, event: string) {
  return fake.io.on.mock.calls.find((c) => c[0] === event)?.[1] as
    | ((data?: unknown) => void)
    | undefined;
}
const joinEmits = (fake: ReturnType<typeof makeFakeSocket>) =>
  fake.emit.mock.calls.filter((c) => c[0] === "join:space");

describe("useSocket — kick 가드(WI-047)", () => {
  it("space:error KICKED 수신 → markSpaceKicked(spaceId) + onKicked 호출", async () => {
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    const onKicked = vi.fn();
    renderHook(() => useSocket({ ...baseProps, onKicked }));
    await act(async () => {
      await flush();
    });

    const handler = onHandler(fake, "space:error");
    expect(handler).toBeTypeOf("function");
    act(() => handler!({ code: "KICKED", message: "강퇴" }));

    expect(markSpaceKickedMock).toHaveBeenCalledWith("space-1");
    expect(onKicked).toHaveBeenCalledTimes(1);
  });

  it("space:error 비-KICKED(BANNED) → 가드/콜백 미발동", async () => {
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    const onKicked = vi.fn();
    renderHook(() => useSocket({ ...baseProps, onKicked }));
    await act(async () => {
      await flush();
    });

    const handler = onHandler(fake, "space:error");
    act(() => handler!({ code: "BANNED", message: "차단" }));

    expect(markSpaceKickedMock).not.toHaveBeenCalled();
    expect(onKicked).not.toHaveBeenCalled();
  });

  it("connect 시 강퇴 쿨다운 중(isSpaceKicked=true)이면 join:space 미발송", async () => {
    isSpaceKickedMock.mockReturnValue(true);
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    renderHook(() => useSocket(baseProps));
    await act(async () => {
      await flush();
    });

    const connect = onHandler(fake, "connect");
    expect(connect).toBeTypeOf("function");
    act(() => connect!());
    expect(joinEmits(fake).length).toBe(0);
  });

  it("connect 시 쿨다운 아니면 join:space 발송", async () => {
    isSpaceKickedMock.mockReturnValue(false);
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    renderHook(() => useSocket(baseProps));
    await act(async () => {
      await flush();
    });

    const connect = onHandler(fake, "connect");
    act(() => connect!());
    const emits = joinEmits(fake);
    expect(emits.length).toBe(1);
    expect(emits[0][1]).toMatchObject({ spaceId: "space-1", userId: "user-1" });
  });

  it("reconnect 시 강퇴 쿨다운 중이면 join:space 자동 재발송 차단", async () => {
    isSpaceKickedMock.mockReturnValue(true);
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    renderHook(() => useSocket(baseProps));
    await act(async () => {
      await flush();
    });

    const reconnect = ioHandler(fake, "reconnect");
    expect(reconnect).toBeTypeOf("function");
    act(() => reconnect!());
    expect(joinEmits(fake).length).toBe(0);
  });
});

describe("useSocket — connect_error 토큰 실패 매핑(WI-049)", () => {
  it("auth stash 있으면 코드별 안내 메시지(UNAUTHORIZED → 세션 만료)", async () => {
    consumeLastSocketAuthErrorMock.mockReturnValue(
      new SocketTokenError("UNAUTHORIZED", "raw")
    );
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    const { result } = renderHook(() => useSocket(baseProps));
    await act(async () => {
      await flush();
    });

    const connectError = onHandler(fake, "connect_error");
    expect(connectError).toBeTypeOf("function");
    act(() => connectError!({ message: "Invalid token" }));

    // generic "소켓 연결 실패: Invalid token"이 아니라 코드별 안내여야 한다
    expect(result.current.socketError).toBe(
      "세션이 만료되었습니다. 다시 로그인해 주세요."
    );
  });

  it("auth stash 없으면 generic 메시지(서버 err.message)", async () => {
    consumeLastSocketAuthErrorMock.mockReturnValue(null);
    const fake = makeFakeSocket();
    getSocketClientMock.mockResolvedValue(fake);
    const { result } = renderHook(() => useSocket(baseProps));
    await act(async () => {
      await flush();
    });

    const connectError = onHandler(fake, "connect_error");
    act(() => connectError!({ message: "boom" }));

    expect(result.current.socketError).toBe("소켓 연결 실패: boom");
  });
});
