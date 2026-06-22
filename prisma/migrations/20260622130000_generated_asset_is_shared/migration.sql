-- WI-016-chore: GeneratedAsset.isShared 마이그레이션 베이스라인 정합.
-- 이 컬럼/인덱스는 2026-03 `prisma db push`로 prod에 직접 추가돼 마이그레이션 파일이 없던
-- 드리프트를 정합한다. prisma/migrations 를 스키마 SoT로 만들어 fresh DB가 migrate deploy로
-- 동일 상태를 얻게 한다. (schema.prisma 는 이미 isShared 보유 — 이 WI는 마이그레이션 파일만 추가.)
--
-- 멱등(IF NOT EXISTS) 사용 근거 (설계 codex consult D1/놓친위험):
--   prod 는 이미 isShared 컬럼이 존재(db push)하나 복합 인덱스 존재 여부는 미검증이다.
--   일반 ADD COLUMN 은 prod 에서 "column already exists"로 실패하고, migrate resolve --applied
--   로 건너뛰면 인덱스 부재(성능 드리프트)를 영구히 숨긴다. IF NOT EXISTS 는 양쪽을 자가 치유한다 —
--   prod 에 컬럼이 있으면 건너뛰고, 인덱스가 없으면 생성하며, fresh DB 에는 둘 다 생성한다.
--
-- ⚠️ prod 적용은 사용자 승인 게이트(WI-013 prod 적용과 함께). 적용 전 prod 에서 실제
--   컬럼/인덱스 정의를 `\d "GeneratedAsset"` 로 확인 권장.

-- AlterTable
ALTER TABLE "GeneratedAsset" ADD COLUMN IF NOT EXISTS "isShared" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GeneratedAsset_isShared_status_type_idx" ON "GeneratedAsset"("isShared", "status", "type");
