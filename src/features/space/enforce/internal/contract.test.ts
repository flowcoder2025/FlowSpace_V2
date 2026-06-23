import { describe, it, expect } from "vitest";
import {
  computeEnforceSignature,
  verifyEnforceSignature,
  isFreshTimestamp,
  parseEnforceRequest,
  ENFORCE_REPLAY_WINDOW_MS,
} from "./contract";

const SECRET = "test-internal-secret-aaaaaaaaaaaaaaaaaaaaaaaa";
const BODY = JSON.stringify({ spaceId: "s1", userId: "u1", action: "ban" });
const TS = "1700000000000";

describe("enforce contract: 서명 생성/검증", () => {
  it("round-trip: 생성한 서명을 검증 통과", () => {
    const sig = computeEnforceSignature(SECRET, TS, BODY);
    expect(verifyEnforceSignature(SECRET, TS, BODY, sig)).toBe(true);
  });

  it("서명은 hex 문자열(64자, sha256)", () => {
    const sig = computeEnforceSignature(SECRET, TS, BODY);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("시크릿이 다르면 거부", () => {
    const sig = computeEnforceSignature(SECRET, TS, BODY);
    expect(verifyEnforceSignature("other-secret", TS, BODY, sig)).toBe(false);
  });

  it("body가 변조되면 거부", () => {
    const sig = computeEnforceSignature(SECRET, TS, BODY);
    const tampered = JSON.stringify({ spaceId: "s1", userId: "u1", action: "kick" });
    expect(verifyEnforceSignature(SECRET, TS, tampered, sig)).toBe(false);
  });

  it("timestamp가 변조되면 거부(replay 바인딩)", () => {
    const sig = computeEnforceSignature(SECRET, TS, BODY);
    expect(verifyEnforceSignature(SECRET, "1700000000001", BODY, sig)).toBe(false);
  });

  it("비-hex 서명은 예외 없이 거부", () => {
    expect(verifyEnforceSignature(SECRET, TS, BODY, "zzzz")).toBe(false);
    expect(verifyEnforceSignature(SECRET, TS, BODY, "not a hex!!")).toBe(false);
  });

  it("홀수 길이 서명은 거부", () => {
    expect(verifyEnforceSignature(SECRET, TS, BODY, "abc")).toBe(false);
  });

  it("길이 불일치(짧은 hex) 서명은 timingSafeEqual 예외 없이 거부", () => {
    expect(verifyEnforceSignature(SECRET, TS, BODY, "ab")).toBe(false);
  });

  it("빈 서명은 거부", () => {
    expect(verifyEnforceSignature(SECRET, TS, BODY, "")).toBe(false);
  });
});

describe("enforce contract: replay window", () => {
  const now = 1700000000000;

  it("now 기준 신선한 timestamp 허용", () => {
    expect(isFreshTimestamp(String(now), now)).toBe(true);
    expect(isFreshTimestamp(String(now - 1000), now)).toBe(true);
    expect(isFreshTimestamp(String(now + 1000), now)).toBe(true);
  });

  it("window 경계 허용/초과 거부", () => {
    expect(isFreshTimestamp(String(now - ENFORCE_REPLAY_WINDOW_MS), now)).toBe(true);
    expect(isFreshTimestamp(String(now - ENFORCE_REPLAY_WINDOW_MS - 1), now)).toBe(false);
    expect(isFreshTimestamp(String(now + ENFORCE_REPLAY_WINDOW_MS + 1), now)).toBe(false);
  });

  it("숫자가 아닌 timestamp 거부", () => {
    expect(isFreshTimestamp("not-a-number", now)).toBe(false);
    expect(isFreshTimestamp("", now)).toBe(false);
  });
});

describe("enforce contract: parseEnforceRequest 스키마 검증", () => {
  it("정상 ban/kick/mute/unmute", () => {
    for (const action of ["ban", "kick", "mute", "unmute"] as const) {
      const parsed = parseEnforceRequest({ spaceId: "s1", userId: "u1", action });
      expect(parsed).toMatchObject({ spaceId: "s1", userId: "u1", action });
    }
  });

  it("role 액션은 화이트리스트 역할 필수", () => {
    expect(parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "role", role: "STAFF" })).toMatchObject({
      action: "role",
      role: "STAFF",
    });
    // role 누락
    expect(parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "role" })).toBeNull();
    // 임의 역할 주입
    expect(parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "role", role: "GOD" })).toBeNull();
  });

  it("알 수 없는 action 거부", () => {
    expect(parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "delete" })).toBeNull();
    expect(parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "" })).toBeNull();
  });

  it("필수 필드 누락/타입 오류 거부", () => {
    expect(parseEnforceRequest(null)).toBeNull();
    expect(parseEnforceRequest("string")).toBeNull();
    expect(parseEnforceRequest({ userId: "u1", action: "ban" })).toBeNull(); // spaceId 없음
    expect(parseEnforceRequest({ spaceId: "s1", action: "ban" })).toBeNull(); // userId 없음
    expect(parseEnforceRequest({ spaceId: "", userId: "u1", action: "ban" })).toBeNull(); // 빈 spaceId
    expect(parseEnforceRequest({ spaceId: 1, userId: "u1", action: "ban" })).toBeNull(); // 타입 오류
  });

  it("actorName은 선택적이며 100자로 절단", () => {
    const long = "x".repeat(200);
    const parsed = parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "ban", actorName: long });
    expect(parsed?.actorName).toHaveLength(100);
    const noActor = parseEnforceRequest({ spaceId: "s1", userId: "u1", action: "ban" });
    expect(noActor?.actorName).toBeUndefined();
  });
});

describe("enforce contract: archive(공간 전체) 파싱 (WI-036)", () => {
  it("archive는 userId 없이 유효", () => {
    const parsed = parseEnforceRequest({ spaceId: "s1", action: "archive" });
    expect(parsed).toEqual({ spaceId: "s1", action: "archive", actorName: undefined });
  });

  it("archive는 actorName을 받아 100자로 절단", () => {
    const parsed = parseEnforceRequest({ spaceId: "s1", action: "archive", actorName: "관리자" });
    expect(parsed).toMatchObject({ action: "archive", actorName: "관리자" });
    const long = parseEnforceRequest({ spaceId: "s1", action: "archive", actorName: "x".repeat(200) });
    expect(long?.actorName).toHaveLength(100);
  });

  it("archive는 입력의 userId/role을 채택하지 않는다(식별자 혼입 차단)", () => {
    const parsed = parseEnforceRequest({
      spaceId: "s1",
      action: "archive",
      userId: "intruder",
      role: "OWNER",
    });
    // archive 변형에는 userId/role 필드가 없어야 한다 — 혼입 무시.
    expect(parsed).toEqual({ spaceId: "s1", action: "archive", actorName: undefined });
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("role");
  });

  it("archive도 spaceId는 필수(빈/타입오류 거부)", () => {
    expect(parseEnforceRequest({ action: "archive" })).toBeNull();
    expect(parseEnforceRequest({ spaceId: "", action: "archive" })).toBeNull();
    expect(parseEnforceRequest({ spaceId: 1, action: "archive" })).toBeNull();
  });

  it("멤버 제재는 여전히 userId 필수(archive 추가가 회귀시키지 않음)", () => {
    for (const action of ["ban", "kick", "mute", "unmute"] as const) {
      expect(parseEnforceRequest({ spaceId: "s1", action })).toBeNull();
      expect(parseEnforceRequest({ spaceId: "s1", userId: "", action })).toBeNull();
    }
    expect(parseEnforceRequest({ spaceId: "s1", action: "role", role: "STAFF" })).toBeNull();
  });
});
