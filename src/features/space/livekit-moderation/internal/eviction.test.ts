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

const ENV_KEYS = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  mockRemoveParticipant.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("resolveLiveKitConfig", () => {
  it("prod에서 키 없으면 null(미설정)", () => {
    process.env.NODE_ENV = "production";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    expect(resolveLiveKitConfig()).toBeNull();
  });

  it("키가 있으면 config 반환", () => {
    process.env.LIVEKIT_URL = "wss://lk.example.com";
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    expect(resolveLiveKitConfig()).toEqual({
      url: "wss://lk.example.com",
      apiKey: "k",
      apiSecret: "s",
    });
  });

  it("dev에서 키 없으면 devkey 폴백", () => {
    process.env.NODE_ENV = "development";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
    const cfg = resolveLiveKitConfig();
    expect(cfg?.apiKey).toBe("devkey");
    expect(cfg?.apiSecret).toBe("devsecret");
  });
});

describe("removeSpaceParticipant (best-effort)", () => {
  it("미설정(prod no key) → 스킵(not_configured), SDK 미호출", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: false, reason: "not_configured" });
    expect(mockRemoveParticipant).not.toHaveBeenCalled();
  });

  it("성공 → removed, room=space-{id}·identity=user-{userId}로 호출", async () => {
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    mockRemoveParticipant.mockResolvedValue(undefined);

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: true, reason: "removed" });
    expect(mockRemoveParticipant).toHaveBeenCalledWith("space-space-1", "user-u-1");
  });

  it("throw(미접속/이미 퇴장) → 무시(remove_failed), 호출측에 예외 전파 안 함", async () => {
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    mockRemoveParticipant.mockRejectedValue(new Error("participant not found"));

    const r = await removeSpaceParticipant("space-1", "u-1");
    expect(r).toEqual({ removed: false, reason: "remove_failed" });
  });
});
