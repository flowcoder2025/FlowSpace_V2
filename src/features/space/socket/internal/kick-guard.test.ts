import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { markSpaceKicked, isSpaceKicked, clearSpaceKicked } from "./kick-guard";
import { KICK_COOLDOWN_MS } from "@/lib/kick-cooldown";

// ============================================================
// WI-047: 클라 kick 가드(모듈 싱글턴). Date.now() 기반이라 fake timer로 검증한다.
// 싱글턴 상태가 테스트 간 누수되지 않도록 afterEach에서 clear한다.
// ============================================================

const SPACE = "space-guard-1";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  clearSpaceKicked(SPACE);
});

afterEach(() => {
  clearSpaceKicked(SPACE);
  vi.useRealTimers();
});

describe("kick-guard (WI-047)", () => {
  it("markSpaceKicked 후 쿨다운 이내는 isSpaceKicked=true", () => {
    expect(isSpaceKicked(SPACE)).toBe(false);
    markSpaceKicked(SPACE);
    expect(isSpaceKicked(SPACE)).toBe(true);
    vi.advanceTimersByTime(KICK_COOLDOWN_MS - 1);
    expect(isSpaceKicked(SPACE)).toBe(true);
  });

  it("쿨다운 경과 후 isSpaceKicked=false", () => {
    markSpaceKicked(SPACE);
    vi.advanceTimersByTime(KICK_COOLDOWN_MS);
    expect(isSpaceKicked(SPACE)).toBe(false);
  });

  it("clearSpaceKicked는 즉시 해제", () => {
    markSpaceKicked(SPACE);
    expect(isSpaceKicked(SPACE)).toBe(true);
    clearSpaceKicked(SPACE);
    expect(isSpaceKicked(SPACE)).toBe(false);
  });

  it("space별 독립 — 한 space kick이 다른 space에 영향 없음", () => {
    markSpaceKicked(SPACE);
    expect(isSpaceKicked("other-space")).toBe(false);
    clearSpaceKicked("other-space");
  });
});
