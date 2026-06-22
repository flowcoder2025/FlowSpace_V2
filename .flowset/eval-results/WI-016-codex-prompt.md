# 블라인드 적대 검증 — WI-016-chore: GeneratedAsset.isShared 마이그레이션 베이스라인 정합

독립 검증자(codex). read-only, **제공 JSON 스키마로만** 산출. 추측 금지·파일 근거. evaluator 산출물 미참조(상호 블라인드).

## WI-016 목표·사실
`prisma/migrations`를 스키마 SoT로 정합. `GeneratedAsset.isShared`(+`@@index([isShared,status,type])`)가 schema.prisma:402/410엔 있으나 `0_init`엔 없음 — 2026-03 `prisma db push`로 prod 직접 추가돼 마이그레이션 파일 부재(드리프트). **schema.prisma는 무변경**(이미 isShared 보유) — 이 WI는 **마이그레이션 파일 + lock만 추가**(소스 .ts/.prisma 무변경).

## 변경
1. 신규 `prisma/migrations/20260622130000_generated_asset_is_shared/migration.sql`:
   - `ALTER TABLE "GeneratedAsset" ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;`
   - `CREATE INDEX IF NOT EXISTS "GeneratedAsset_isShared_status_type_idx" ON "GeneratedAsset"("isShared","status","type");`
2. `prisma/migrations/migration_lock.toml` (`provider="postgresql"`) `git add -f` 추가(Prisma 공식 권장, 기존 미추적).
3. (`prisma/migrations/`는 전체 .gitignore이라 migration.sql/lock 모두 force-add — 0_init/WI-013 선례.)

## 설계 근거 (codex consult D1~D5 반영)
- **IF NOT EXISTS 채택**: prod는 컬럼 존재(db push)하나 복합 인덱스 존재 미검증. 일반 ADD COLUMN은 prod서 "already exists" 실패; `migrate resolve --applied`로 건너뛰면 인덱스 부재(성능 드리프트)를 영구 은닉(consult 놓친위험). IF NOT EXISTS는 양쪽 자가치유(prod 컬럼 skip·인덱스 없으면 생성, fresh 둘 다 생성).
- **timestamp WI-013 이후**(append-only history).
- **prod 적용은 승인 게이트**(WI-013 prod 적용과 함께, build에 migrate deploy 자동실행 없음). 적용 전 `\d "GeneratedAsset"` 확인 권장.
- 오프라인 검증: `migrate diff --from-schema-datamodel <isShared 제거본> --to-schema-datamodel schema.prisma --script` 델타가 정확히 이 2개 DDL임을 확인(완료). 전체 replay 정합은 shadow DB 필요(prod 게이트 후속).

## 검토 관점
- 마이그레이션 SQL의 end-state가 schema.prisma의 GeneratedAsset(isShared + 복합 인덱스)와 정합한가. 인덱스 이름/컬럼 순서가 Prisma 생성 규칙(`GeneratedAsset_isShared_status_type_idx`, [isShared,status,type])과 일치하는가.
- IF NOT EXISTS 선택이 Prisma `migrate deploy`(shadow/drift 미사용, pending SQL 실행만)와 충돌 없는가. fresh DB·기존 prod 양쪽에서 올바른 end-state로 수렴하는가.
- timestamp 순서(0_init → WI-013 20260622120000 → isShared 20260622130000)가 out-of-order 문제 없는가.
- migration_lock.toml provider가 datasource(postgresql)와 정합한가.
- schema.prisma·코드 무변경(런타임 무회귀) 확인. 기계게이트(tsc/lint/vitest/build/prisma validate) 회귀.
- 놓친 드리프트(0_init+WI-013+신규 외 schema와 불일치하는 다른 테이블/컬럼/인덱스)가 있는가.

이슈 P0~P3 + defer/deferRationale/fixNow. P0/P1·fixNow면 FAIL, 경미 defer만이면 WARNING, 무결하면 PASS.
