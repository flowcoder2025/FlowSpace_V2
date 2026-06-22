import { describe, it, expect } from "vitest";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  parsePageLimit,
  parsePageNumber,
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

  // WI-022: 라우트별 기본 페이지 크기 보존을 위한 optional defaultLimit
  describe("defaultLimit 인자 (WI-022)", () => {
    it("null/빈값/이상치 → 전달한 defaultLimit", () => {
      expect(parsePageLimit(null, 20)).toBe(20);
      expect(parsePageLimit("", 20)).toBe(20);
      expect(parsePageLimit("0", 20)).toBe(20);
      expect(parsePageLimit("-5", 20)).toBe(20);
      expect(parsePageLimit("abc", 20)).toBe(20);
    });

    it("유효 정수는 defaultLimit과 무관하게 그대로", () => {
      expect(parsePageLimit("10", 20)).toBe(10);
      expect(parsePageLimit("75", 20)).toBe(75);
    });

    it("MAX cap은 defaultLimit과 무관하게 적용", () => {
      expect(parsePageLimit("100000", 20)).toBe(MAX_PAGE_LIMIT);
    });

    it("인자 미지정 시 DEFAULT_PAGE_LIMIT (기존 호출부 무영향)", () => {
      expect(parsePageLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
    });
  });
});

describe("parsePageNumber (WI-022)", () => {
  it("null/빈값 → 1", () => {
    expect(parsePageNumber(null)).toBe(1);
    expect(parsePageNumber("")).toBe(1);
  });

  it("정상 양의 정수 → 그대로", () => {
    expect(parsePageNumber("1")).toBe(1);
    expect(parsePageNumber("2")).toBe(2);
    expect(parsePageNumber("999")).toBe(999);
  });

  it("0/음수 → 1 (음수 skip 방지)", () => {
    expect(parsePageNumber("0")).toBe(1);
    expect(parsePageNumber("-5")).toBe(1);
  });

  it("비정수/NaN 유발 입력 → 1", () => {
    expect(parsePageNumber("abc")).toBe(1);
    expect(parsePageNumber("NaN")).toBe(1);
  });

  it("상한 없음 (offset 범위는 데이터 크기에 의존)", () => {
    expect(parsePageNumber("100000")).toBe(100000);
  });

  it("소수점 절삭은 parsePageLimit과 동일 시맨틱 (parseInt 일관성)", () => {
    expect(parsePageNumber("2.9")).toBe(2);
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
