-- WI-036-fix: Space.deletedBy (archive 행위자 감사 컬럼) 추가.
--
-- soft delete(DELETE /api/spaces/[id] → status=ARCHIVED)가 누가 삭제했는지 기록하도록
-- archive 행위자 userId 를 보존한다. FK 관계 없는 순수 스칼라(ChatMessage.deletedBy 선례).
-- 최초 archive 시에만 기록되며(라우트가 updateMany status!=ARCHIVED 가드로 보장),
-- 재삭제 시 기존 값을 덮어쓰지 않는다(감사 무결성).
--
-- 멱등(IF NOT EXISTS) 사용 근거(WI-016 패턴):
--   prod 적용 시 컬럼이 이미 존재할 가능성(병행 db push 등)을 자가 치유한다.
--   fresh DB 는 컬럼을 생성하고, 이미 있으면 건너뛴다. nullable + default 없음이라
--   기존 행에 백필 불필요(기존 archived 행의 deletedBy 는 NULL = 행위자 미상).
--
-- ⚠️ prod 적용은 사용자 승인 게이트(WI-013/016 패턴). 적용 전 `\d "Space"` 로 확인 권장.

-- AlterTable
ALTER TABLE "Space" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
