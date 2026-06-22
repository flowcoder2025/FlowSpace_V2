/**
 * 쿼리스트링 필터 정규화·검증 공용 헬퍼 (순수 함수 — Prisma/React 무의존).
 *
 * - `normalizeEnumFilter`: enum 필터(trim+대문자) 전수 검증 (WI-022에서 assets
 *   라우트에 도입, WI-030에서 공용 추출 — messages/logs 라우트도 재사용).
 * - `parseDateRangeFilter`: startDate/endDate(ISO datetime instant)를 Prisma
 *   createdAt 범위로 파싱.
 */

/**
 * 쿼리 enum 필터를 정규화(trim+대문자)·검증한다.
 * 중복 파라미터(`?type=a&type=b`)의 검증 우회를 막기 위해 `getAll()`로 받은
 * **모든 값**을 검사한다 (`get()`은 첫 값만 봐 invalid 2번째 값이 숨는다).
 * - 빈 배열/공백-only만 → undefined (필터 미적용; trim 후 비면 "미지정"과 동일)
 * - 하나라도 allowlist 불일치 → null (호출부가 400 INVALID_FILTER로 처리)
 * - 전부 유효 → 첫 값(Prisma scalar equality)으로 필터
 */
export function normalizeEnumFilter(
  values: string[],
  allowed: Set<string>
): string | undefined | null {
  const normalized = values
    .map((v) => v.trim().toUpperCase())
    .filter((v) => v.length > 0);
  if (normalized.length === 0) return undefined;
  if (normalized.some((v) => !allowed.has(v))) return null;
  return normalized[0];
}

/** Prisma DateTime 범위 필터 (createdAt: { gte, lt }) */
export interface DateRangeFilter {
  gte?: Date;
  lt?: Date;
}

/**
 * `startDate`/`endDate` 쿼리(ISO datetime instant)를 Prisma createdAt 범위로 파싱한다.
 *
 * - start는 inclusive(`gte`), end는 **exclusive upper bound**(`lt`) — 클라이언트가
 *   "종료일 포함"을 익일 00:00 instant로 보내는 계약(date-only를 서버에서 파싱하면
 *   UTC로 해석돼 클라 로컬 날짜와 어긋나는 타임존 함정 회피, codex 설계).
 * - 미지정/공백 → 해당 경계 미적용. 둘 다 미지정 → undefined(필터 미적용).
 * - 파싱 불가(Invalid Date) 또는 start >= end → "invalid"(호출부가 400 처리).
 */
export function parseDateRangeFilter(
  startRaw: string | null,
  endRaw: string | null
): DateRangeFilter | undefined | "invalid" {
  const start = parseInstant(startRaw);
  const end = parseInstant(endRaw);
  if (start === "invalid" || end === "invalid") return "invalid";
  if (start === undefined && end === undefined) return undefined;
  if (
    start !== undefined &&
    end !== undefined &&
    start.getTime() >= end.getTime()
  ) {
    return "invalid";
  }
  const range: DateRangeFilter = {};
  if (start !== undefined) range.gte = start;
  if (end !== undefined) range.lt = end;
  return range;
}

/**
 * ISO 8601 datetime **instant**(날짜+시간+TZ 지정자 Z 또는 ±HH:MM)만 허용한다.
 * date-only(`2026-06-23`)나 offsetless(`...T00:00:00`)는 서버에서 UTC/로컬로 모호하게
 * 해석되므로 계약에서 거부(클라이언트는 `.toISOString()`으로 항상 instant 전송).
 */
const ISO_INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function parseInstant(raw: string | null): Date | undefined | "invalid" {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  if (!ISO_INSTANT_RE.test(trimmed)) return "invalid";
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return "invalid";
  return d;
}
