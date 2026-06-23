import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// WI-045: LiveKit 강제 제거(eviction) — kick/ban 화상 타일 정리(best-effort).
// ============================================================

const { mockRemoveParticipant } = vi.hoisted(() => ({
  mockRemoveParticipant: vi.fn(),
}));

vi.mock("livekit-server-sdk", () => ({
  // class 기반 — `new RoomServiceClient(...)` 생성자 호출 지원(arrow 불가).
  RoomServiceClient: class {
    removeParticipant(...args: unknown[]) {
      return mockRemoveParticipant(...args);
    }
  },
}));

import { resolveLiveKitConfig, removeSpaceParticipant } from "./eviction";

// 환경변수는 vi.stubEnv 로 조작한다(readonly NODE_ENV 직접 대입은 TS2540 — WI-018 패턴).
// 빈 문자열 "" 은 config 의 `!apiKey` falsy 검사상 "미설정"과 동치(키 부재 표현).
beforeEach(() => {
  mockRemoveParticipant.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveLiveKitConfig", () => {
  it("prod에서 키 없으면 null(미설정)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    expect(resolveLiveKitConfig()).toBeNull();
  });

  it("키가 있으면 config 반환", () => {
    vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
    vi.stubEnv("LIVEKIT_API_KEY", "k");
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    expect(resolveLiveKitConfig()).toEqual({
      url: "wss://lk.example.com",
      apiKey: "k",
      apiSecret: "s",
    });
  });

  it("dev에서 키 없으면 devkey 폴백", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");
    const cfg = resolveLiveKitConfig();
    expect(cfg?.apiKey).toBe("devkey");
    expect(cfg?.apiSecret).toBe("devsecret");
  });
});

describe("removeSpaceParticipant (best-effort)", () => {
  it("미설정(prod no key) → 스킵(not_configured), SDK 미호출", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LIVEKIT_API_KEY", "");
    vi.stubEnv("LIVEKIT_API_SECRET", "");

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: false, reason: "not_configured" });
    expect(mockRemoveParticipant).not.toHaveBeenCalled();
  });

  it("성공 → removed, room=space-{id}·identity=user-{userId}로 호출", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "k");
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    mockRemoveParticipant.mockResolvedValue(undefined);

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: true, reason: "removed" });
    expect(mockRemoveParticipant).toHaveBeenCalledWith("space-space-1", "user-u-1");
  });

  it("throw(미접속/이미 퇴장) → 무시(remove_failed), 호출측에 예외 전파 안 함", async () => {
    vi.stubEnv("LIVEKIT_API_KEY", "k");
    vi.stubEnv("LIVEKIT_API_SECRET", "s");
    mockRemoveParticipant.mockRejectedValue(new Error("participant not found"));

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: false, reason: "remove_failed" });
  });
});
