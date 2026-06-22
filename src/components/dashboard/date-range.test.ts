import { describe, it, expect } from "vitest";
import { localDateToStartInstant, localDateToEndInstant } from "./date-range";

// ============================================================
// WI-030: <input type="date"> 로컬 날짜 → ISO instant 변환
// 타임존 독립 단언 위주(로컬 자정 절대값은 TZ 의존이라 관계로 검증).
// ============================================================

describe("localDateToStartInstant / localDateToEndInstant", () => {
  it("빈 문자열 → null", () => {
    expect(localDateToStartInstant("")).toBeNull();
    expect(localDateToEndInstant("")).toBeNull();
  });

  it("잘못된 날짜 → null", () => {
    expect(localDateToStartInstant("not-a-date")).toBeNull();
    expect(localDateToEndInstant("2026-13-99")).toBeNull();
  });

  it("유효 날짜 → ISO instant 문자열", () => {
    expect(localDateToStartInstant("2026-06-23")).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });

  it("종료(end)는 익일 자정 = 그 다음 날의 시작(start)과 동일 (TZ 독립)", () => {
    // end of 06-23(exclusive upper bound) === start of 06-24
    expect(localDateToEndInstant("2026-06-23")).toBe(
      localDateToStartInstant("2026-06-24")
    );
  });

  it("같은 날짜의 end > start (범위가 양수)", () => {
    const start = localDateToStartInstant("2026-06-23")!;
    const end = localDateToEndInstant("2026-06-23")!;
    expect(new Date(end).getTime()).toBeGreaterThan(new Date(start).getTime());
  });
});
