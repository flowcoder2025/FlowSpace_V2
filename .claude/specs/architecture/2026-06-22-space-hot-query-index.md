# Space 핫 쿼리 복합 인덱스 — WI-013-perf

- **WI**: WI-013-perf
- **날짜**: 2026-06-22
- **선행**: WI-010-perf 듀얼검증(codex r3 + evaluator)이 공통 defer한 항목. cursor 페이지네이션이 응답 크기는 경계했으나 쿼리플랜은 미해결.
- **상태**: 설계 + schema/마이그레이션 작성 + 로컬 검증 완료. **prod 적용 + 프로덕션 EXPLAIN은 사용자 승인 게이트(미실행).**

## 문제

`GET /api/spaces`(WI-010)는 3개 scope 모두 `WHERE status = 'ACTIVE'` + `ORDER BY updatedAt DESC, id DESC` + cursor 페이지네이션으로 조회한다.

1. **all/superAdmin**: `{ status: ACTIVE }` — 슈퍼어드민 전역(전체 ACTIVE). 실제 부하 지점.
2. **owned**: `{ ownerId, status: ACTIVE }`.
3. **joined**: `{ members: { some: { userId } }, status: ACTIVE }` — SpaceMember 세미조인.

기존 Space 인덱스는 `@@index([ownerId])`·`@@index([inviteCode])`·`@@index([status])`(단일)뿐 — 정렬(`updatedAt DESC, id DESC`)을 지원하는 복합 인덱스가 없어, all/superAdmin 케이스가 전체 ACTIVE를 정렬(Sort 노드)해야 한다.

## 설계 (codex 협의 1R 반영)

| 결정 | 내용 | 근거 |
|---|---|---|
| D1 인덱스 집합 | **단일 복합 `(status, updatedAt DESC, id DESC)`** | all/superAdmin 부하 + cursor seek를 직접 겨냥. owned는 owner당 행 수가 작아(저카디널리티) 별도 복합의 쓰기비용 비정당 → 기존 `@@index([ownerId])` + 정렬 의존 |
| D2 joined | **추가 인덱스 보류** | 세미조인은 Space 단독 정렬 인덱스로 완전 최적화 불가(조인 후 정렬). SpaceMember `@@index([userId])`가 접근경로 제공 → prod EXPLAIN 병목 확인 시 별도 검토 |
| D3 partial vs full | **Prisma 네이티브 full 복합** `@@index([status, updatedAt(sort: Desc), id(sort: Desc)])` | 부분 인덱스(`WHERE status='ACTIVE'`)가 이론상 더 작으나 Prisma 표현 불가(raw SQL→drift). 본 WI 범위는 schema 네이티브 + drift 없음 |
| D4 기존 status 인덱스 | **제거** | 복합 선두 컬럼이 status라 status-only 필터를 prefix 스캔으로 커버. grep 결과 `prisma.space.findMany` status 필터는 핫 쿼리 1곳뿐(나머지는 id/inviteCode PK 조회) → 중복, 쓰기 오버헤드만 |
| D5 락 | **prod는 `CREATE/DROP INDEX CONCURRENTLY` via direct(비-PgBouncer) connection** | 일반 CREATE INDEX는 쓰기 락. CONCURRENTLY는 트랜잭션 내 실행 불가라 Prisma migrate deploy 경로에 못 넣음 → 운영 절차 분리 |

## 변경 표면

- `prisma/schema.prisma` Space 모델: `@@index([status])` 제거 → `@@index([status, updatedAt(sort: Desc), id(sort: Desc)])` 추가.
- `prisma/migrations/20260622120000_space_hot_query_index/migration.sql` 신규(CREATE→DROP 순 — 트랜잭션/수동 CONCURRENTLY 양쪽에서 인덱스 없는 구간 회피):
  ```sql
  CREATE INDEX "Space_status_updatedAt_id_idx" ON "Space"("status", "updatedAt" DESC, "id" DESC);
  DROP INDEX "Space_status_idx";
  ```
- **gitignore 주의**: `.gitignore`에 `prisma/migrations/`가 있으나 `0_init`은 추적(force-add 선례) + `migration_lock.toml`은 미추적·부재. 신규 마이그레이션도 0_init과 동일하게 `git add -f`로 추적. 팀이 `db push` 기반이면 schema 변경만으로 충분(마이그레이션은 참조용).

## 로컬 검증 (prod DB 무접속, 입증 범위)

- `prisma validate` → schema 문법 valid.
- `prisma migrate diff --from-schema-datamodel <develop> --to-schema-datamodel <new> --script` → 의도한 DROP/CREATE SQL 정확 산출(= migration.sql 본문과 일치, 일관성 by construction).
- `prisma generate` → client 생성 0(인덱스는 client 타입 무영향).
- 기계 게이트 5/5: prisma generate 0 · tsc 0 · lint 0 · vitest 147/147 · next build 0.

## prod 게이트 (미실행 — 승인 필요)

1. **프로덕션 EXPLAIN (ANALYZE)** 검증 — prod 또는 prod 유사 데이터에서:
   - all/superAdmin: `WHERE status='ACTIVE' ORDER BY updatedAt DESC, id DESC LIMIT n` → 새 인덱스 `Space_status_updatedAt_id_idx` Index Scan(Sort 노드 제거) 기대.
   - **cursor seek 확인(codex 지목 위험)**: Prisma cursor `{ id }` + orderBy `(updatedAt desc, id desc)`가 tuple-seek로 안 나오면, 인덱스가 정렬엔 쓰여도 페이지 경계 조건이 기대보다 덜 효율적일 수 있음 → EXPLAIN으로 실측 필요.
   - joined: 세미조인 플랜(SpaceMember(userId) → Space) 확인.
2. **적용**: 대용량이면 direct connection에서 `CREATE INDEX CONCURRENTLY "Space_status_updatedAt_id_idx" ... ; DROP INDEX CONCURRENTLY "Space_status_idx";` 후 `prisma migrate resolve --applied 20260622120000_space_hot_query_index`. 소규모면 `prisma migrate deploy`.
3. EXPLAIN 결과에 따라 partial 인덱스(D3)·owned/joined 전용 인덱스(D1/D2) 후속 검토.
