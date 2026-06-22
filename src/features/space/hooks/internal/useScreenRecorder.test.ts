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

// AudioContext 스텁 — close()가 reject(이미 closed 등)하도록 모사해 .catch 정책을 검증.
// mixAudioTracks(audioContextRef 세팅 경로)가 요구하는 최소 표면만 제공.
class MockAudioContext {
  static closeCalls = 0;
  createMediaStreamDestination(): { stream: MockMediaStream } {
    return { stream: new MockMediaStream() };
  }
  createMediaStreamSource(): { connect: () => void } {
    return { connect: () => {} };
  }
  close(): Promise<void> {
    MockAudioContext.closeCalls += 1;
    // reject — 호출부가 .catch로 흡수하지 않으면 unhandled rejection이 된다.
    return Promise.reject(new Error("InvalidStateError: context already closed"));
  }
}

const fakeTrack = {} as unknown as MediaStreamTrack;
const fakeAudioTrack = {} as unknown as MediaStreamTrack;

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

describe("useScreenRecorder — unmount 경로 (WI-006/WI-011)", () => {
  it("stopping 대기 중 언마운트되면 cleanup이 stopRecording Promise를 settle한다 (영구 pending 차단)", async () => {
    const { result, unmount } = renderHook(() =>
      useScreenRecorder({ spaceName: "s" })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });

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

    // 언마운트 → cleanup이 onstop을 떼어내고 pendingStopResolveRef를 settle
    await act(async () => {
      unmount();
      await stopPromise;
    });

    expect(settled).toBe(true);
  });

  it("언마운트 후 stopRecording을 호출해도 즉시 resolve한다 (dangling 없음)", async () => {
    const { result, unmount } = renderHook(() =>
      useScreenRecorder({ spaceName: "s" })
    );

    await act(async () => {
      await result.current.startRecording(fakeTrack);
    });

    act(() => {
      unmount();
    });

    // cleanup이 recorder ref를 비웠으므로 stale 콜백이라도 작업 없이 즉시 resolve
    let settled = false;
    await act(async () => {
      await result.current.stopRecording().then(() => {
        settled = true;
      });
    });
    expect(settled).toBe(true);
  });

  it("saveFile await 중 언마운트되면 mountedRef 가드가 unmount 후 상태/알림 갱신을 차단한다", async () => {
    // 가드 관측 전략: React 19에서 'unmount 후 setState'는 관측 불가하므로,
    // 가드가 막는 showNotification의 setTimeout(_, notificationDuration)을
    // 고유 delay로 식별한다. 가드가 살아있으면 onstop이 showNotification에
    // 도달하기 전에 return → 해당 setTimeout이 예약되지 않는다.
    const NOTIF_DELAY = 123456; // React/RTL 내부가 쓰지 않는 고유 값
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    // showSaveFilePicker를 수동 제어 deferred로 둬서 saveFile을 의도적으로 멈춘다.
    // (정상 onstop 회귀 테스트는 다운로드 폴백을 쓰므로 이 키를 두지 않는다)
    let releasePicker: (() => void) | undefined;
    const pickerPromise = new Promise<never>((_, reject) => {
      // resolve 대신 AbortError로 종료 → saveFile은 cancelled로 분기
      releasePicker = () =>
        reject(
          Object.assign(new Error("aborted"), { name: "AbortError" })
        );
    });
    const pickerSpy = vi.fn(() => pickerPromise);
    (
      window as unknown as { showSaveFilePicker: () => Promise<never> }
    ).showSaveFilePicker = pickerSpy;

    try {
      const { result, unmount } = renderHook(() =>
        useScreenRecorder({
          spaceName: "s",
          notificationDuration: NOTIF_DELAY,
        })
      );

      await act(async () => {
        await result.current.startRecording(fakeTrack);
      });
      const recorder = latestRecorder();

      let stopPromise: Promise<void> | undefined;
      act(() => {
        stopPromise = result.current.stopRecording();
      });

      // onstop 발화 → saveFile이 picker에서 멈춤(suspended)
      let onstopDone: Promise<void> | undefined;
      act(() => {
        onstopDone = (
          recorder.onstop as unknown as (() => Promise<void>) | null
        )?.();
      });
      expect(pickerSpy).toHaveBeenCalledTimes(1); // saveFile이 await 지점에 진입

      // saveFile 대기 중 언마운트 (mountedRef=false)
      act(() => {
        unmount();
      });

      // picker 종료 → onstop이 mountedRef 가드를 지나 setState/알림 없이 정상 종료
      await act(async () => {
        releasePicker?.();
        await Promise.all([stopPromise, onstopDone]);
      });

      // onstop이 hang/throw 없이 완료됨
      expect(onstopDone).toBeDefined();
      // 가드가 showNotification 도달을 차단 → 고유 delay의 알림 타이머 미예약
      const scheduledNotif = setTimeoutSpy.mock.calls.some(
        (c) => c[1] === NOTIF_DELAY
      );
      expect(scheduledNotif).toBe(false);
    } finally {
      delete (window as unknown as { showSaveFilePicker?: unknown })
        .showSaveFilePicker;
    }
  });
});

describe("useScreenRecorder — audioContext.close() .catch 정책 (WI-012-2 S4)", () => {
  // 변이검증: stopRecording(L357)·startRecording 재진입(L263)의 close()는 reject 가능.
  // .catch(() => {})가 없으면 floating Promise rejection → unhandled rejection이 발생한다.
  // 4경로(unmount/onerror/start/stop) 모두 .catch로 통일됨을 process 리스너로 검출.
  async function withUnhandledTracking(
    fn: () => Promise<void>
  ): Promise<unknown[]> {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      await fn();
      // unhandledRejection은 마이크로태스크 드레인 후 다음 틱에 발화 → 매크로태스크 1회 양보
      await new Promise((r) => setTimeout(r, 0));
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
    return unhandled;
  }

  beforeEach(() => {
    MockAudioContext.closeCalls = 0;
    vi.stubGlobal("AudioContext", MockAudioContext);
  });

  it("stopRecording의 audioContext.close() reject가 unhandled rejection으로 새지 않는다 (L357)", async () => {
    const unhandled = await withUnhandledTracking(async () => {
      const { result } = renderHook(() =>
        useScreenRecorder({ spaceName: "s" })
      );

      // audioTracks 전달 → mixAudioTracks가 audioContextRef를 세팅
      await act(async () => {
        await result.current.startRecording(fakeTrack, [fakeAudioTrack]);
      });

      // stopRecording → L357에서 audioContext.close() 호출(reject)
      let stopPromise: Promise<void> | undefined;
      act(() => {
        stopPromise = result.current.stopRecording();
      });
      act(() => {
        latestRecorder().onstop?.();
      });
      await act(async () => {
        await stopPromise;
      });
    });

    expect(MockAudioContext.closeCalls).toBeGreaterThan(0); // close()가 실제 호출됨
    expect(unhandled).toHaveLength(0); // .catch로 흡수 → 누수 0
  });

  it("startRecording 재진입 시 이전 audioContext.close() reject가 unhandled rejection으로 새지 않는다 (L263)", async () => {
    const unhandled = await withUnhandledTracking(async () => {
      const { result } = renderHook(() =>
        useScreenRecorder({ spaceName: "s" })
      );

      // 1회차 — audioContextRef 세팅
      await act(async () => {
        await result.current.startRecording(fakeTrack, [fakeAudioTrack]);
      });
      // 2회차 — L263에서 기존 audioContext.close() 호출(reject)
      await act(async () => {
        await result.current.startRecording(fakeTrack, [fakeAudioTrack]);
      });
    });

    expect(MockAudioContext.closeCalls).toBeGreaterThan(0);
    expect(unhandled).toHaveLength(0);
  });
});
