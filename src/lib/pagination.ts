/**
 * Cursor 기반 페이지네이션 공용 헬퍼 (순수 함수 — Prisma/React 무의존).
 *
 * 코드베이스 관례(`src/app/api/spaces/[id]/messages/route.ts`)와 동일한
 * `take: limit + 1` 패턴을 캡슐화한다. 쿼리에서 limit보다 1건 더 가져온 뒤
 * `buildCursorPage`로 잘라 `hasMore`/`nextCursor`를 도출한다.
 */

/** limit 미지정/이상치 시 기본 페이지 크기 */
export const DEFAULT_PAGE_LIMIT = 50;
/** 클라이언트가 요청 가능한 최대 페이지 크기 (전역 목록 폭주 방지) */
export const MAX_PAGE_LIMIT = 100;

/**
 * 쿼리스트링 `limit` 값을 안전한 정수 페이지 크기로 정규화한다.
 * - null/빈값/비정수/0 이하 → DEFAULT_PAGE_LIMIT
 * - MAX_PAGE_LIMIT 초과 → MAX_PAGE_LIMIT로 절상(cap)
 */
export function parsePageLimit(raw: string | null): number {
  const n = parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(n, MAX_PAGE_LIMIT);
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
