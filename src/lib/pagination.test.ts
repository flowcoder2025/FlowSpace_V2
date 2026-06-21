import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parsePageLimit,
  buildCursorPage,
} from "./pagination";

describe("parsePageLimit", () => {
  it("null/빈값 → 기본값", () => {
    expect(parsePageLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("정상 정수 → 그대로", () => {
    expect(parsePageLimit("10")).toBe(10);
    expect(parsePageLimit("50")).toBe(50);
    expect(parsePageLimit("100")).toBe(MAX_PAGE_LIMIT);
  });

  it("MAX 초과 → MAX로 절상", () => {
    expect(parsePageLimit("101")).toBe(MAX_PAGE_LIMIT);
    expect(parsePageLimit("100000")).toBe(MAX_PAGE_LIMIT);
  });

  it("0/음수 → 기본값", () => {
    expect(parsePageLimit("0")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("-5")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("비정수/NaN 유발 입력 → 기본값", () => {
    expect(parsePageLimit("abc")).toBe(DEFAULT_PAGE_LIMIT);
    expect(parsePageLimit("NaN")).toBe(DEFAULT_PAGE_LIMIT);
    // parseInt("12.9") === 12 (소수점 절삭은 JS parseInt 동작 — 허용)
    expect(parsePageLimit("12.9")).toBe(12);
  });
});

describe("buildCursorPage", () => {
  const make = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));

  it("행 수 <= limit → 마지막 페이지(hasMore=false, nextCursor=null)", () => {
    const rows = make(3);
    const page = buildCursorPage(rows, 5);
    expect(page.items).toHaveLength(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("행 수 == limit → 마지막 페이지(여분 없음)", () => {
    const rows = make(5);
    const page = buildCursorPage(rows, 5);
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("행 수 == limit + 1 → hasMore=true, 여분 1건 절단, nextCursor=마지막 노출행 id", () => {
    const rows = make(6); // limit 5 + 1
    const page = buildCursorPage(rows, 5);
    expect(page.items).toHaveLength(5);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("s4"); // items[4].id
    expect(page.items.map((r) => r.id)).not.toContain("s5"); // 여분 미노출
  });

  it("빈 배열 → hasMore=false, nextCursor=null, items=[]", () => {
    const page = buildCursorPage<{ id: string }>([], 5);
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});
