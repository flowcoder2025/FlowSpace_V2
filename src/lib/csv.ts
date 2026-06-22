/**
 * CSV 직렬화 공용 헬퍼 (순수 함수 — DOM/React/도메인 무의존, WI-031 CSV 내보내기).
 *
 * - RFC 4180 이스케이프: 구분자(`,`)/따옴표(`"`)/개행(CR·LF) 포함 셀은 큰따옴표로
 *   감싸고 내부 `"`는 이중화. 레코드 구분자는 CRLF.
 * - CSV/수식 인젝션 중화: 셀이 위험 문자(`= + - @` 또는 탭/CR)로 시작하면 작은따옴표
 *   prefix로 텍스트 강제(OWASP CSV Injection — Excel/Sheets가 셀을 수식으로 실행하는
 *   것 차단). 모든 셀에 일률 적용(신뢰 가능한 숫자/날짜/enum 컬럼은 선두 위험 문자가
 *   없어 무영향, 사용자 제어 텍스트만 실제로 중화됨).
 * - BOM은 직렬화 결과에 포함하지 않는다(순수 텍스트 유지) — 다운로드 계층이 `CSV_BOM`을
 *   앞에 붙여 Excel 한글 인코딩 깨짐을 막는다.
 */

/** Excel이 UTF-8 CSV를 올바른 인코딩으로 열도록 하는 BOM (다운로드 시 앞에 붙임). */
export const CSV_BOM = "﻿";

/** RFC 4180 레코드 구분자 (CRLF). */
const CSV_LINE_BREAK = "\r\n";

/** 셀 선두에 오면 수식으로 해석될 수 있는 문자 (OWASP CSV Injection). */
const FORMULA_INJECTION_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** 따옴표 감싸기가 필요한 문자 (구분자·따옴표·개행). */
const NEEDS_QUOTING_RE = /[",\r\n]/;

function escapeCell(value: string): string {
  let cell = value;
  // 1) 수식 인젝션 중화 — 선두 위험 문자면 작은따옴표 prefix(텍스트 강제).
  if (cell.length > 0 && FORMULA_INJECTION_PREFIXES.has(cell[0])) {
    cell = `'${cell}`;
  }
  // 2) RFC 4180 — 구분자/따옴표/개행 포함 시 큰따옴표로 감싸고 내부 따옴표 이중화.
  if (NEEDS_QUOTING_RE.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * 헤더 + 행들을 RFC 4180 CSV 문자열로 직렬화한다(BOM 미포함, CRLF 구분).
 * 모든 셀은 이스케이프·인젝션 중화된다. 행이 없으면 헤더 줄만 반환.
 */
export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join(CSV_LINE_BREAK);
}
