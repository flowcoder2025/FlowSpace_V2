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

const { getSocketClientMock, disconnectSocketMock } = vi.hoisted(() => ({
  getSocketClientMock: vi.fn(),
  disconnectSocketMock: vi.fn(),
}));

vi.mock("./socket-client", async (importActual) => {
  const actual = await importActual<typeof import("./socket-client")>();
  return {
    ...actual, // SocketTokenError / 타입 등 실제 export 유지
    getSocketClient: getSocketClientMock,
    disconnectSocket: disconnectSocketMock,
  };
});

import { useSocket } from "./use-socket";

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
