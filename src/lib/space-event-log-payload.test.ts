import { describe, it, expect } from "vitest";
import {
  PUBLIC_SPACE_EVENT_PAYLOAD_KEYS,
  toPublicSpaceEventPayload,
  toPublicSpaceEventLog,
} from "./space-event-log-payload";

// ============================================================
// WI-032: 어드민 로그 SpaceEvent payload 공개 정규화 (allowlist) + lean DTO
// ============================================================

describe("toPublicSpaceEventPayload — 키 allowlist", () => {
  it("현존 8개 허용 키를 모두 보존한다", () => {
    const payload = {
      action: "kick",
      messageId: "m1",
      targetMemberId: "mem1",
      targetName: "Bob",
      senderName: "Alice",
      trackType: "video",
      trackSource: "camera",
      participantName: "Carol",
    };
    const out = toPublicSpaceEventPayload(payload);
    expect(out).toEqual(payload);
    // allowlist 상수와 보존 키가 정확히 일치(드리프트 가드).
    expect(Object.keys(out ?? {}).sort()).toEqual(
      [...PUBLIC_SPACE_EVENT_PAYLOAD_KEYS].sort()
    );
  });

  it("금지 키(email/inviteCode/accessSecret/prompt/secret/token/password)를 제거한다", () => {
    const out = toPublicSpaceEventPayload({
      action: "announce",
      email: "bob@example.com",
      inviteCode: "SECRET-CODE",
      accessSecret: "sk_live_xxx",
      prompt: "internal generation prompt",
      secret: "s",
      token: "t",
      password: "p",
    });
    expect(out).toEqual({ action: "announce" });
    expect(out).not.toHaveProperty("email");
    expect(out).not.toHaveProperty("inviteCode");
    expect(out).not.toHaveProperty("accessSecret");
    expect(out).not.toHaveProperty("prompt");
  });

  it("허용 키 0개(금지 키만) → null (화면 '-', CSV 빈 Details 계약)", () => {
    expect(
      toPublicSpaceEventPayload({ email: "x@y.z", inviteCode: "abc" })
    ).toBeNull();
  });

  it("빈 객체 → null", () => {
    expect(toPublicSpaceEventPayload({})).toBeNull();
  });

  it("null / undefined → null", () => {
    expect(toPublicSpaceEventPayload(null)).toBeNull();
    expect(toPublicSpaceEventPayload(undefined)).toBeNull();
  });

  it("배열 / 비객체(문자열·숫자·불리언) → null", () => {
    expect(toPublicSpaceEventPayload(["action", "kick"])).toBeNull();
    expect(toPublicSpaceEventPayload("action")).toBeNull();
    expect(toPublicSpaceEventPayload(42)).toBeNull();
    expect(toPublicSpaceEventPayload(true)).toBeNull();
  });

  it("허용 키의 값은 형태에 무관하게 그대로 보존한다(중첩 객체/숫자/null)", () => {
    const out = toPublicSpaceEventPayload({
      action: "ban",
      targetMemberId: "mem-42",
      messageId: null,
      // 허용 키이지만 값이 객체여도 그대로(필터는 top-level 키만).
      targetName: { nested: "ok" } as unknown as string,
      // 금지 키는 값과 무관하게 제거.
      prompt: "drop me",
    });
    expect(out).toEqual({
      action: "ban",
      targetMemberId: "mem-42",
      messageId: null,
      targetName: { nested: "ok" },
    });
  });

  it("새 객체를 반환한다(입력 변이 없음)", () => {
    const input = { action: "kick", prompt: "secret" };
    const out = toPublicSpaceEventPayload(input);
    expect(out).not.toBe(input);
    expect(input).toHaveProperty("prompt"); // 원본 불변
  });
});

describe("toPublicSpaceEventLog — lean DTO", () => {
  const raw = {
    id: "log-1",
    spaceId: "space-1",
    userId: "user-secret-1",
    guestSessionId: "guest-secret-1",
    participantId: "part-secret-1",
    eventType: "ADMIN_ACTION",
    payload: { action: "kick", targetName: "Bob", email: "bob@example.com" },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    user: { name: "Admin", email: "admin@example.com" },
  };

  it("응답 키는 정확히 {id,eventType,payload,createdAt,user} — 내부 스칼라 제외", () => {
    const dto = toPublicSpaceEventLog(raw);
    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "eventType",
      "id",
      "payload",
      "user",
    ]);
    // 내부 식별자 컬럼은 응답에 누출되지 않는다(deny-by-default).
    expect(dto).not.toHaveProperty("spaceId");
    expect(dto).not.toHaveProperty("userId");
    expect(dto).not.toHaveProperty("guestSessionId");
    expect(dto).not.toHaveProperty("participantId");
  });

  it("payload를 allowlist로 정규화한다(금지 키 제거)", () => {
    const dto = toPublicSpaceEventLog(raw);
    expect(dto.payload).toEqual({ action: "kick", targetName: "Bob" });
    expect(dto.payload).not.toHaveProperty("email");
  });

  it("허용 키만 남은 결과가 비면 payload는 null", () => {
    const dto = toPublicSpaceEventLog({
      ...raw,
      payload: { email: "x@y.z", inviteCode: "c" },
    });
    expect(dto.payload).toBeNull();
  });

  it("id/eventType/createdAt를 보존하고 user는 {name,email}만 노출", () => {
    const dto = toPublicSpaceEventLog(raw);
    expect(dto.id).toBe("log-1");
    expect(dto.eventType).toBe("ADMIN_ACTION");
    expect(dto.createdAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(dto.user).toEqual({ name: "Admin", email: "admin@example.com" });
  });

  it("user가 null이면 null 유지", () => {
    const dto = toPublicSpaceEventLog({ ...raw, user: null });
    expect(dto.user).toBeNull();
  });
});
