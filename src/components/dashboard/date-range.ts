/**
 * `<input type="date">`의 로컬 날짜(YYYY-MM-DD)를 admin API용 ISO datetime instant로
 * 변환한다 (WI-030 고급 필터).
 *
 * 서버는 instant를 받아 `createdAt: { gte, lt }`로 필터한다 — date-only를 서버에서
 * 파싱하면 UTC로 해석돼 클라 로컬 날짜와 어긋나므로(타임존 함정), 클라가 로컬 자정
 * 기준 instant로 변환해 보낸다(codex 설계).
 */

/** 로컬 날짜의 00:00(시작, inclusive)을 ISO instant로. 빈/잘못된 값 → null. */
export function localDateToStartInstant(dateStr: string): string | null {
  const d = parseLocalDate(dateStr);
  return d ? d.toISOString() : null;
}

/**
 * 로컬 날짜 **익일** 00:00(종료, exclusive upper bound)을 ISO instant로.
 * 선택한 날짜를 포함하기 위해 익일 자정 미만(`lt`)으로 보낸다. 빈/잘못된 값 → null.
 */
export function localDateToEndInstant(dateStr: string): string | null {
  const d = parseLocalDate(dateStr);
  if (!d) return null;
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseLocalDate(dateStr: string): Date | null {
  if (!DATE_ONLY_RE.test(dateStr)) return null;
  // `T00:00:00`(타임존 미표기) → 런타임 로컬 타임존 자정으로 해석
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  // 달력 롤오버 거부(예: 2026-02-31 → 3월): 파싱 결과가 입력과 일치해야 유효
  const [y, m, day] = dateStr.split("-").map(Number);
  if (d.getFullYear() !== y || d.getMonth() + 1 !== m || d.getDate() !== day) {
    return null;
  }
  return d;
}
