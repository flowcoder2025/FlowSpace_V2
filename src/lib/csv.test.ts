import { describe, it, expect } from "vitest";
import { toCsv, CSV_BOM } from "./csv";

// ============================================================
// WI-031: 순수 CSV 직렬화 (RFC 4180 이스케이프 + 수식 인젝션 중화)
// ============================================================

describe("toCsv", () => {
  it("헤더 + 행을 CRLF로 직렬화한다(후행 개행 없음)", () => {
    expect(toCsv(["a", "b"], [["1", "2"]])).toBe("a,b\r\n1,2");
  });

  it("여러 행을 CRLF로 구분한다", () => {
    expect(toCsv(["a"], [["1"], ["2"], ["3"]])).toBe("a\r\n1\r\n2\r\n3");
  });

  it("행이 없으면 헤더 줄만 반환한다", () => {
    expect(toCsv(["Name", "Email"], [])).toBe("Name,Email");
  });

  it("일반 숫자/날짜/enum 문자열은 변형되지 않는다", () => {
    expect(toCsv(["d", "n", "e"], [["2026-06-23", "5", "OWNER"]])).toBe(
      "d,n,e\r\n2026-06-23,5,OWNER"
    );
  });

  describe("RFC 4180 이스케이프", () => {
    it("구분자(쉼표) 포함 셀은 따옴표로 감싼다", () => {
      expect(toCsv(["x"], [["a,b"]])).toBe('x\r\n"a,b"');
    });

    it("내부 따옴표는 이중화하고 감싼다", () => {
      expect(toCsv(["x"], [['he said "hi"']])).toBe('x\r\n"he said ""hi"""');
    });

    it("개행(LF) 포함 셀은 따옴표로 감싼다", () => {
      expect(toCsv(["x"], [["line1\nline2"]])).toBe('x\r\n"line1\nline2"');
    });

    it("CR 포함 셀은 따옴표로 감싼다", () => {
      expect(toCsv(["x"], [["a\rb"]])).toBe('x\r\n"a\rb"');
    });
  });

  describe("수식 인젝션 중화", () => {
    it("'='로 시작하면 작은따옴표 prefix(쉼표 없으면 미감쌈)", () => {
      expect(toCsv(["x"], [["=SUM(A1)"]])).toBe("x\r\n'=SUM(A1)");
    });

    it("'+', '@'로 시작도 중화한다", () => {
      expect(toCsv(["x"], [["+1"], ["@cmd"]])).toBe("x\r\n'+1\r\n'@cmd");
    });

    it("탭으로 시작도 중화한다", () => {
      expect(toCsv(["x"], [["\tfoo"]])).toBe("x\r\n'\tfoo");
    });

    it("'-'로 시작하는 정상 텍스트도 중화한다(문서화된 트레이드오프)", () => {
      expect(toCsv(["x"], [["-홍길동"]])).toBe("x\r\n'-홍길동");
      expect(toCsv(["x"], [["-5"]])).toBe("x\r\n'-5");
    });

    it("중화 후 구분자가 있으면 prefix까지 함께 감싼다", () => {
      expect(toCsv(["x"], [["=a,b"]])).toBe('x\r\n"\'=a,b"');
    });

    it("선두가 아닌 위치의 위험 문자는 중화하지 않는다", () => {
      expect(toCsv(["x"], [["a=b+c"]])).toBe("x\r\na=b+c");
    });

    it("빈 셀은 변형하지 않는다", () => {
      expect(toCsv(["x", "y"], [["", "v"]])).toBe("x,y\r\n,v");
    });
  });

  it("CSV_BOM은 UTF-8 BOM 문자다", () => {
    expect(CSV_BOM).toBe("﻿");
  });
});
