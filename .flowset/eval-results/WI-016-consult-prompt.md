# 설계 협의 — WI-016-chore: GeneratedAsset.isShared 마이그레이션 베이스라인 정합

read-only 산문 자문. 추측 금지 — 파일/사실 근거로만. 마지막에 "권장안 1줄" + "내가 놓친 위험 1가지".

## 사실 (검증됨)
- `prisma/migrations/` 디렉토리는 **전체 `.gitignore`**(line 43). 개별 migration.sql만 `git add -f`로 추적(0_init, WI-013 `20260622120000_space_hot_query_index`). `migration_lock.toml`은 **디스크에도 git에도 없음**(방금 임시 생성).
- prod DB(Supabase, PgBouncer) = `0_init`만 `_prisma_migrations`에 기록. **`isShared` 컬럼은 2026-03(commit 06ee1eb)에 `prisma db push`로만 추가** — 마이그레이션 파일 없음(드리프트). WI-013 인덱스도 prod 미적용(별도 승인 게이트).
- `0_init`의 GeneratedAsset: isShared 없음. 인덱스 userId/type/status/createdAt. **드리프트 = `isShared BOOLEAN NOT NULL DEFAULT false` + `@@index([isShared, status, type])` 단 둘**(나머지 컬럼·인덱스 전부 0_init과 일치, Space는 WI-013이 처리).
- API가 `where.isShared=true` 사용(assets/route.ts:24) — 런타임 의존.
- 빌드 파이프라인은 `prisma generate && next build`만 — `migrate deploy` 자동 실행 없음(수동).
- shadow DB 없음(로컬). prod DATABASE_URL은 절대 shadow로 못 씀.

## 목표
`prisma/migrations`를 스키마 SoT로 정합 — fresh DB가 `migrate deploy`로 isShared 컬럼+인덱스를 얻도록 마이그레이션 추가. **단, prod는 이미 컬럼 존재**(db push)라 일반 `ADD COLUMN`을 그대로 deploy하면 "column already exists" 실패.

## 협의 질문
1. **마이그레이션 SQL 방식**: (A) `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`(prod·fresh 양쪽 안전, 멱등) vs (B) 일반 `ADD COLUMN`/`CREATE INDEX` + prod는 `prisma migrate resolve --applied <migration>`로 수동 기록(실행 없이). Prisma 베이스라인 드리프트 정합의 정석은? IF NOT EXISTS가 `prisma migrate`/`validate`/CI와 충돌 없는가?
2. **timestamp/순서**: 실제 추가는 2026-03인데 WI-013 마이그레이션은 `20260622120000`. 신규 isShared 마이그레이션을 (a) 2026-03 timestamp(WI-013보다 앞·과거 삽입) vs (b) WI-013 이후 timestamp 중 무엇으로? 둘 다 0_init 이후·독립 변경인데 out-of-order 삽입이 `migrate deploy`에 문제를 일으키는가?
3. **오프라인 검증**: shadow DB 없이 이 마이그레이션이 schema end-state와 정합함을 어떻게 검증? `--from-schema-datamodel <isShared 제거본> --to-schema-datamodel <현재>` 방식(WI-013 선례)이 적절한가?
4. **migration_lock.toml**: gitignore라 미추적인데, 이번에 `git add -f`로 추가해 connector 명시(`postgresql`)하는 게 맞는가, 아니면 관례대로 두는가? 추가 시 부작용?
5. **prod 적용 절차**: 이 WI는 develop 머지까지만(파일 추가)이고, prod 정합(`migrate resolve --applied` 또는 멱등 deploy)은 WI-013 prod 적용과 함께 사용자 승인 게이트로 분리하는 게 맞는가?

한국어 산문.
