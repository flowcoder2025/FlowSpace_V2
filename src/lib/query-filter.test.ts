import { describe, it, expect } from "vitest";
import { normalizeEnumFilter, parseDateRangeFilter } from "./query-filter";

// ============================================================
// WI-030: 쿼리 필터 공용 헬퍼 (normalizeEnumFilter 공용 추출 + parseDateRangeFilter)
// ============================================================

const ALLOWED = new Set(["MESSAGE", "WHISPER", "PARTY"]);

describe("normalizeEnumFilter", () => {
  it("빈 배열 → undefined(필터 미적용)", () => {
    expect(normalizeEnumFilter([], ALLOWED)).toBeUndefined();
  });

  it("공백-only → undefined", () => {
    expect(normalizeEnumFilter(["  "], ALLOWED)).toBeUndefined();
  });

  it("유효 값 → 대문자 정규화 후 첫 값", () => {
    expect(normalizeEnumFilter(["message"], ALLOWED)).toBe("MESSAGE");
    expect(normalizeEnumFilter(["  Whisper "], ALLOWED)).toBe("WHISPER");
  });

  it("allowlist 불일치 → null(400 신호)", () => {
    expect(normalizeEnumFilter(["BOGUS"], ALLOWED)).toBeNull();
  });

  it("중복 파라미터의 invalid 2번째 값도 검출(getAll 전수)", () => {
    expect(normalizeEnumFilter(["MESSAGE", "BOGUS"], ALLOWED)).toBeNull();
  });
});

describe("parseDateRangeFilter", () => {
  const START = "2026-06-23T00:00:00.000Z";
  const END = "2026-06-24T00:00:00.000Z";

  it("둘 다 null → undefined(필터 미적용)", () => {
    expect(parseDateRangeFilter(null, null)).toBeUndefined();
  });

  it("공백-only → undefined", () => {
    expect(parseDateRangeFilter("  ", "  ")).toBeUndefined();
  });

  it("start만 → { gte }", () => {
    const r = parseDateRangeFilter(START, null);
    expect(r).not.toBe("invalid");
    expect((r as { gte?: Date; lt?: Date }).gte?.toISOString()).toBe(START);
    expect((r as { gte?: Date; lt?: Date }).lt).toBeUndefined();
  });

  it("end만 → { lt }(exclusive upper bound)", () => {
    const r = parseDateRangeFilter(null, END);
    expect((r as { gte?: Date; lt?: Date }).lt?.toISOString()).toBe(END);
    expect((r as { gte?: Date; lt?: Date }).gte).toBeUndefined();
  });

  it("start < end → { gte, lt }", () => {
    const r = parseDateRangeFilter(START, END) as { gte?: Date; lt?: Date };
    expect(r.gte?.toISOString()).toBe(START);
    expect(r.lt?.toISOString()).toBe(END);
  });

  it("start >= end → invalid", () => {
    expect(parseDateRangeFilter(END, START)).toBe("invalid");
    expect(parseDateRangeFilter(START, START)).toBe("invalid");
  });

  it("파싱 불가 날짜 → invalid", () => {
    expect(parseDateRangeFilter("not-a-date", null)).toBe("invalid");
    expect(parseDateRangeFilter(null, "garbage")).toBe("invalid");
  });

  it("date-only / offsetless(비-instant) → invalid (ISO instant 계약 강제)", () => {
    expect(parseDateRangeFilter("2026-06-23", null)).toBe("invalid"); // date-only
    expect(parseDateRangeFilter("2026-06-23T00:00:00", null)).toBe("invalid"); // TZ 없음
  });

  it("offset(+09:00) instant 허용", () => {
    const r = parseDateRangeFilter("2026-06-23T00:00:00+09:00", null) as {
      gte?: Date;
    };
    expect(r.gte).toBeInstanceOf(Date);
  });
});
