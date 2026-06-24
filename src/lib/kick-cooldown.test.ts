import { describe, it, expect } from "vitest";
import { createKickCooldown, KICK_COOLDOWN_MS } from "./kick-cooldown";

// ============================================================
// WI-047: kick 쿨다운 순수 스토어. now(ms)를 주입해 결정적으로 검증한다.
// ============================================================

describe("createKickCooldown (WI-047)", () => {
  it("mark 직후 ttl 이내는 isActive=true, 미등록 키는 false", () => {
    const c = createKickCooldown(30_000);
    expect(c.isActive("k", 1000)).toBe(false); // 미등록
    c.mark("k", 1000);
    expect(c.isActive("k", 1000)).toBe(true); // now == mark
    expect(c.isActive("k", 1000 + 29_999)).toBe(true); // 만료 직전
  });

  it("만료 시점(now >= until)은 false — 경계 포함", () => {
    const c = createKickCooldown(30_000);
    c.mark("k", 1000);
    // until = 31000. now가 정확히 31000이면 만료로 본다(>=).
    expect(c.isActive("k", 31_000)).toBe(false);
    expect(c.isActive("k", 31_001)).toBe(false);
  });

  it("만료 조회 시 lazy 삭제로 size가 줄어든다(누수 방지)", () => {
    const c = createKickCooldown(30_000);
    c.mark("k", 1000);
    expect(c.size()).toBe(1);
    // 만료 전 조회는 보관 유지
    expect(c.isActive("k", 1500)).toBe(true);
    expect(c.size()).toBe(1);
    // 만료 후 조회 → 삭제
    expect(c.isActive("k", 40_000)).toBe(false);
    expect(c.size()).toBe(0);
  });

  it("clear는 쿨다운을 즉시 해제한다", () => {
    const c = createKickCooldown(30_000);
    c.mark("k", 1000);
    expect(c.isActive("k", 1500)).toBe(true);
    c.clear("k");
    expect(c.isActive("k", 1500)).toBe(false);
    expect(c.size()).toBe(0);
  });

  it("키별 독립 — 한 키의 만료가 다른 키에 영향 없음", () => {
    const c = createKickCooldown(30_000);
    c.mark("a", 1000);
    c.mark("b", 20_000);
    expect(c.isActive("a", 35_000)).toBe(false); // a 만료
    expect(c.isActive("b", 35_000)).toBe(true); // b 유효(until 50000)
  });

  it("재-mark는 만료를 연장한다(기존 값 덮어씀)", () => {
    const c = createKickCooldown(30_000);
    c.mark("k", 1000); // until 31000
    c.mark("k", 25_000); // until 55000 으로 갱신
    expect(c.isActive("k", 40_000)).toBe(true); // 원래라면 만료, 재-mark로 유효
    expect(c.isActive("k", 55_000)).toBe(false);
  });

  it("mark 시 만료된 다른 키를 opportunistic sweep — 재입장 없는 entry 누수 방지", () => {
    const c = createKickCooldown(30_000);
    c.mark("a", 1000); // until 31000
    c.mark("b", 2000); // until 32000
    expect(c.size()).toBe(2);
    // 새 mark(now=40000) → a·b 둘 다 만료 → sweep으로 제거, c만 남음
    c.mark("c", 40_000);
    expect(c.size()).toBe(1);
    expect(c.isActive("a", 40_000)).toBe(false);
    expect(c.isActive("c", 40_000)).toBe(true);
  });

  it("sweep은 아직 유효한 다른 키를 지우지 않는다", () => {
    const c = createKickCooldown(30_000);
    c.mark("a", 1000); // until 31000
    c.mark("b", 20_000); // until 50000 — 아직 유효
    expect(c.isActive("b", 20_001)).toBe(true);
    expect(c.size()).toBe(2);
  });

  it("KICK_COOLDOWN_MS는 30초", () => {
    expect(KICK_COOLDOWN_MS).toBe(30_000);
  });
});
