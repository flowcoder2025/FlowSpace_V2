-- WI-013-perf: GET /api/spaces 핫 쿼리용 Space 복합 인덱스.
-- where status=ACTIVE + orderBy [updatedAt DESC, id DESC] + cursor 페이지네이션을 겨냥.
-- 기존 단일 Space_status_idx는 복합 인덱스 선두 컬럼(status)이 커버하므로 제거(중복).
--
-- ⚠️ 프로덕션 적용 주의(WI-013 설계 codex consult D5): 대용량 Space 테이블에서 아래
--   일반 CREATE/DROP INDEX는 쓰기 락을 건다. prod는 **direct(비-PgBouncer) connection**에서
--   `CREATE INDEX CONCURRENTLY` / `DROP INDEX CONCURRENTLY`로 수동 적용 후
--   `prisma migrate resolve --applied 20260622120000_space_hot_query_index`로 이력만 기록하는
--   운영 절차를 권장(CONCURRENTLY는 트랜잭션 내 실행 불가라 Prisma migrate deploy 경로에 못 넣음).
--   소규모 테이블이면 일반 `migrate deploy`로도 무방. 적용 전 프로덕션 EXPLAIN 검증 필요.

-- CreateIndex (먼저 생성 — 트랜잭션/수동 CONCURRENTLY 양쪽에서 인덱스 없는 구간 회피)
CREATE INDEX "Space_status_updatedAt_id_idx" ON "Space"("status", "updatedAt" DESC, "id" DESC);

-- DropIndex (복합 인덱스 생성 후 구 단일 인덱스 제거)
DROP INDEX "Space_status_idx";
