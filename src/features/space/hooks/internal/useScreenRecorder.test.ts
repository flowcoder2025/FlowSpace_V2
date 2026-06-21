import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useScreenRecorder } from "./useScreenRecorder";

// ============================================
// MediaRecorder / MediaStream 모킹
// jsdom은 MediaRecorder/MediaStream을 구현하지 않으므로 최소 스텁으로 대체.
// stop()은 onstop을 자동 발화하지 않는다 — 테스트가 onstop/onerror를 수동 트리거해
// 'error 시 onstop 미발화'(WI-006)를 결정적으로 재현하기 위함.
// ============================================

type Handler = (() => void) | null;

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = (): boolean => true;

  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: Handler = null;
  onstop: Handler = null;
  onerror: Handler = null;

  constructor(
    public stream: unknown,
    public options: unknown
  ) {
    MockMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = "recording";
  }
  stop(): void {
    this.state = "inactive";
  }
  pause(): void {
    this.state = "paused";
  }
  resume(): void {
    this.state = "recording";
  }
}

class MockMediaStream {
  constructor(public tracks?: unknown[]) {}
  getAudioTracks(): unknown[] {
    return [];
  }
}

const fakeTrack = {} as unknown as MediaStreamTrack;

function latestRecorder(): MockMediaRecorder {
  const rec = MockMediaRecorder.instances.at(-1);
  if (!rec) throw new Error("no MediaRecorder instance created");
  return rec;
}

beforeEach(() => {
  MockMediaRecorder.instances = [];
  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  vi.stubGlobal("MediaStream", MockMediaStream);
  // saveFile()의 다운로드 폴백 경로용 (정상 onstop 회귀 테스트)
  (URL as unknown as { createObjectURL: () => string }).createObjectURL =
    vi.fn(() => "blob:mock");
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL =
    vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useScreenRecorder — onerror 경로 (WI-006)", () => {
  it("stopRecording 대기 중 onerror가 발생하면 Promise를 settle한다 (영구 pending 차단)", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useScreenRecorder({ spaceName: "테스트", onError })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });
    expect(result.current.recordingState).toBe("recording");

    const recorder = latestRecorder();

    // stopRecording() 호출 — onstop은 발화시키지 않는다 (error 경로 모사)
    let settled = false;
    let stopPromise: Promise<void> | undefined;
    act(() => {
      stopPromise = result.current.stopRecording().then(() => {
        settled = true;
      });
    });

    // onstop/onerror 모두 미발화 → 아직 pending
    expect(settled).toBe(false);
    expect(result.current.recordingState).toBe("stopping");

    // 'error' 이벤트 발화
    act(() => {
      recorder.onerror?.();
    });

    await act(async () => {
      await stopPromise;
    });

    expect(settled).toBe(true);
    expect(result.current.recordingState).toBe("idle");
    expect(onError).toHaveBeenCalledWith("녹화 중 오류가 발생했습니다");
    expect(result.current.error).toBe("녹화 중 오류가 발생했습니다");
  });

  it("녹화 중 onerror는 idle로 정리하고, 이후 stopRecording은 즉시 resolve한다", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useScreenRecorder({ spaceName: "s", onError })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });
    const recorder = latestRecorder();

    act(() => {
      recorder.onerror?.();
    });

    expect(result.current.recordingState).toBe("idle");
    expect(onError).toHaveBeenCalledTimes(1);

    // recorder ref가 비워져 stopRecording이 작업 없이 즉시 resolve (dangling 없음)
    let settled = false;
    await act(async () => {
      await result.current.stopRecording().then(() => {
        settled = true;
      });
    });
    expect(settled).toBe(true);
    expect(result.current.recordingState).toBe("idle");
  });

  it("onerror 후 늦게 도착한 onstop은 중복 처리되지 않는다 (onstop=null)", async () => {
    const { result } = renderHook(() =>
      useScreenRecorder({ spaceName: "s" })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });
    const recorder = latestRecorder();

    let stopPromise: Promise<void> | undefined;
    act(() => {
      stopPromise = result.current.stopRecording();
    });
    act(() => {
      recorder.onerror?.();
    });
    await act(async () => {
      await stopPromise;
    });

    // onstop 핸들러가 제거되어 사후 저장/성공 알림이 발생하지 않음
    expect(recorder.onstop).toBeNull();
    expect(result.current.notification).toBeNull();
  });

  it("정상 onstop 경로는 저장 후 resolve하고 success 알림을 띄운다 (회귀)", async () => {
    const { result } = renderHook(() =>
      useScreenRecorder({ spaceName: "s" })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });
    const recorder = latestRecorder();

    let settled = false;
    let stopPromise: Promise<void> | undefined;
    act(() => {
      stopPromise = result.current.stopRecording().then(() => {
        settled = true;
      });
    });
    expect(result.current.recordingState).toBe("stopping");

    // 브라우저가 stop() 후 발화하는 onstop을 모사
    await act(async () => {
      recorder.onstop?.();
      await stopPromise;
    });

    expect(settled).toBe(true);
    expect(result.current.recordingState).toBe("idle");
    expect(result.current.notification?.type).toBe("success");
  });
});
