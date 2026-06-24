/**
 * 페이지네이션 쿼리 파싱 + 변환 공용 헬퍼 (순수 함수 — Prisma/React 무의존).
 *
 * - `parsePageLimit`/`parsePageNumber`: 쿼리스트링 limit/page를 안전한 정수로 정규화.
 * - `buildCursorPage`: cursor 페이지네이션의 `take: limit + 1` 패턴
 *   (`src/app/api/spaces/[id]/messages/route.ts` 관례)을 캡슐화 — limit보다 1건 더
 *   가져온 행을 잘라 `hasMore`/`nextCursor`를 도출한다.
 *
 * offset 페이지네이션(`skip`/`take`) 라우트는 `parsePageNumber`+`parsePageLimit`만,
 * cursor 페이지네이션 라우트는 `parsePageLimit`+`buildCursorPage`를 사용한다.
 */

/** limit 미지정/이상치 시 기본 페이지 크기 */
export const DEFAULT_PAGE_LIMIT = 50;
/** 클라이언트가 요청 가능한 최대 페이지 크기 (전역 목록 폭주 방지) */
export const MAX_PAGE_LIMIT = 100;
/**
 * offset 페이지 번호의 상한 (전역 skip 폭주 방지, WI-025).
 * `skip: (page - 1) * limit`이므로 page=10_000·limit=100이면 ~999,900행 skip이
 * 상한이다 — 정상 자산/목록 규모 대비 충분히 큰 방어선이며, 이를 넘는 page는
 * 조작/스크립트성 요청으로 보고 절상(cap)한다(정상 페이지 접근 회귀 없음).
 */
export const MAX_PAGE_NUMBER = 10_000;

/**
 * 쿼리스트링 `limit` 값을 안전한 정수 페이지 크기로 정규화한다.
 * - null/빈값/비정수/0 이하 → `defaultLimit`
 * - MAX_PAGE_LIMIT 초과 → MAX_PAGE_LIMIT로 절상(cap)
 *
 * @param defaultLimit limit 미지정/이상치 시 기본값(라우트별 기본 페이지 크기를
 *   보존하기 위한 선택 인자, 미지정 시 DEFAULT_PAGE_LIMIT).
 */
export function parsePageLimit(
  raw: string | null,
  defaultLimit: number = DEFAULT_PAGE_LIMIT
): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return defaultLimit;
  return Math.min(n, MAX_PAGE_LIMIT);
}

/**
 * 쿼리스트링 `page`(1-base offset 페이지 번호)를 안전한 양의 정수로 정규화한다.
 * - null/빈값/비정수/1 미만 → 1
 * - MAX_PAGE_NUMBER 초과 → MAX_PAGE_NUMBER로 절상(cap) (WI-025, 전역 skip 폭주 방지)
 *
 * offset 라우트에서 `skip: (page - 1) * limit` 계산 시 page가 NaN/0/음수면
 * 음수 skip이 되어 Prisma가 throw(→500)하던 것을 방지하고, 과대 page로 거대
 * offset skip(DB 부하)이 발생하는 것을 상한으로 막는다.
 */
export function parsePageNumber(raw: string | null): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAGE_NUMBER);
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * `take: limit + 1`로 조회한 행 배열을 페이지로 변환한다.
 * 행이 limit보다 많으면 마지막(여분) 1건을 잘라내고 그 직전 행의 id를
 * 다음 cursor로 사용한다.
 *
 * @param rows  limit + 1 만큼 조회한 행(정렬 완료 상태, 각 행은 고유 `id` 보유)
 * @param limit 페이지 크기
 */
export function buildCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
  return { items, nextCursor, hasMore };
}
