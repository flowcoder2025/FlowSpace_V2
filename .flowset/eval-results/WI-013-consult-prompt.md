# 설계 협의 — WI-013-perf (Space 복합 인덱스)

당신은 FlowSpace(Next.js 15 + Prisma + **PostgreSQL**, Windows) 리포의 **설계 협의 파트너**다. 메인 구현자는 Claude. DB schema 변경(경계)이라 구현 전 협의한다. **코드를 바꾸지 말고** 산문으로 답하라. 아래 사실은 실제 코드 read-only 확인 완료.

## 컨텍스트
- 마이그레이션 기반(`prisma/migrations/0_init/` 존재), Postgres(Supabase, DATABASE_URL에 pgbouncer). 빌드는 `prisma generate && next build`.
- **이 WI의 prod 적용 + 프로덕션 EXPLAIN은 사용자 승인 게이트** — 이번 작업은 설계 합의 + schema `@@index` 추가 + 마이그레이션 SQL 작성 + 로컬 검증(validate/generate/migrate diff)까지. prod 적용은 별도 승인.

## 핫 쿼리 (WI-010, `GET /api/spaces`)
3개 scope, **전부** `status: "ACTIVE"` AND + `orderBy: [{ updatedAt: "desc" }, { id: "desc" }]` + cursor 페이지네이션(`take: limit+1`, `cursor: { id }`, `skip: 1`):
1. **all/superAdmin**: `where: { status: ACTIVE }` (슈퍼어드민 전역 — 전체 ACTIVE 로드, WI-010이 페이지네이션으로 응답 크기는 경계했으나 쿼리플랜 미해결 = 이 WI의 동기).
2. **owned**: `where: { ownerId: userId, status: ACTIVE }`.
3. **joined**: `where: { members: { some: { userId } }, status: ACTIVE }` (SpaceMember 세미조인/EXISTS).

include: template(select), `_count.members`, members(where userId, take 1). orderBy는 Space.updatedAt desc, id desc.

## 현재 Space 인덱스
`@@index([ownerId])`, `@@index([inviteCode])`(+ `@unique`), `@@index([status])`. (updatedAt = `@updatedAt`, id = cuid PK.)
SpaceMember: `@@unique([spaceId, userId])`, `@@unique([spaceId, guestSessionId])`, `@@index([spaceId, role])`, `@@index([userId])`, `@@index([guestSessionId])`.
- 코드베이스에 DESC 정렬 인덱스 선례: `SpaceEventLog @@index([createdAt(sort: Desc)])`. Prisma `@@index([col(sort: Desc)])` 문법 사용 가능.

## 결정점 (권고 + 근거 1줄씩)

**D1 — 인덱스 집합**: 다음 중?
- (A) 단일 `(status, updatedAt DESC, id DESC)` — all/superAdmin 케이스 + cursor seek를 직접 지원. owned는 기존 `@@index([ownerId])` + 정렬에 의존.
- (B) (A) + `(ownerId, status, updatedAt DESC, id DESC)` — owned 케이스까지 정렬 포함 커버.
- (C) 그 외(예: status 빼고 `(updatedAt DESC, id DESC)` + status는 필터).
owned는 "한 사용자가 소유한 ACTIVE 스페이스" — 보통 소수(저카디널리티)라 정렬 인덱스 이득이 작을 수 있음. all/superAdmin이 진짜 부하 지점. 이 점 감안해 A vs B 권고.

**D2 — joined scope**: `members: { some: { userId } }` 세미조인은 Space 단독 인덱스로 직접 정렬 최적화가 어렵다(조인 후 Space.updatedAt 정렬). SpaceMember `@@index([userId])`(멤버 측) + Space `(status, updatedAt DESC, id DESC)`(Space 측)로 플래너가 충분히 처리한다고 봐도 되나? joined를 위해 추가로 할 일이 있나(예: SpaceMember에 다른 인덱스)?

**D3 — partial vs full**: 쿼리가 **항상** `status = 'ACTIVE'`이므로 부분 인덱스 `... WHERE status = 'ACTIVE'`가 더 작고 빠르다(비활성 행 제외). 단 Prisma `@@index`는 부분 인덱스를 표현 못 함 → 마이그레이션에 **raw SQL**(`CREATE INDEX ... WHERE status='ACTIVE'`) 필요 + schema와 introspection drift 우려. 풀 복합 `@@index([status, updatedAt(Desc), id(Desc)])`(Prisma 네이티브, drift 없음) vs 부분(raw, 더 효율) 트레이드오프 권고.

**D4 — redundant `@@index([status])` 제거 여부**: 복합 `(status, ...)`의 선두 컬럼이 status라 status 단독 조회를 커버 → 기존 단일 status 인덱스는 중복(쓰기 오버헤드만). 제거가 맞나, 아니면 다른 status-only 쿼리 가능성 때문에 유지?

**D5 — CREATE INDEX 락**: prod 테이블에 일반 `CREATE INDEX`는 쓰기 락. `CREATE INDEX CONCURRENTLY`가 안전하나 **트랜잭션 내 실행 불가** → Prisma 마이그레이션(기본 트랜잭션 래핑)과 충돌. 이 환경에서 권장 마이그레이션 작성법은(예: 마이그레이션 파일에 CONCURRENTLY + Prisma가 트랜잭션 비활성화하도록, 또는 prod 적용 시 수동 실행)? prod 적용이 승인 게이트인 점 감안.

## 요청
- D1~D5 각각 권고 + 근거 1줄.
- **내가 놓치고 있는 위험 1가지**(인덱스 미사용/플래너 함정/cursor seek/마이그레이션 안전/pgbouncer 등).
- 로컬 검증으로 어디까지 입증 가능한가(prod DB 없이): `prisma validate`, `prisma migrate diff`(오프라인 SQL 생성), `prisma generate`. EXPLAIN은 prod 게이트.
