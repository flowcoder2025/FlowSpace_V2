/**
 * 백필 스크립트 (WI-024, CWE-209 심층 방어) — 기존 FAILED 자산의 raw metadata.error 정화.
 *
 * 배경: WI-024 이전에는 generate/batch 라우트가 비동기 생성 실패 시 raw `error.message`
 * (ComfyUI 내부 URL·로컬 파일 경로·스택 단편 포함 가능)를 `GeneratedAsset.metadata.error`에
 * 저장했다. 응답 누출은 `PUBLIC_METADATA_KEYS`에서 `error`를 제거해 즉시 차단됐지만,
 * **DB에는 과거 raw 값이 그대로 남아** 운영 UI·export·향후 코드 경로에서 재노출될 수 있다.
 * 이 스크립트는 그 잔존 raw 값을 신규 저장과 동일한 generic 메시지로 치환한다.
 *
 * 안전 설계:
 * - **dry-run 기본** — 인자 없이 실행하면 변경 없이 영향 행만 보고한다. 실제 적용은 `--apply`.
 * - **멱등** — 이미 generic이거나 error 키가 없는 행은 건드리지 않는다(재실행 안전).
 * - **error 키만 치환** — batchId 등 다른 metadata 키는 보존한다.
 * - prod 적용은 사용자 승인 게이트(DATABASE_URL이 prod를 가리킬 때 신중히).
 *
 * 사용법:
 *   node scripts/backfill-failed-asset-error.mjs           # dry-run (영향 행 보고만)
 *   node scripts/backfill-failed-asset-error.mjs --apply   # 실제 치환 적용
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

// src/features/assets/internal/constants.ts 의 GENERATION_FAILURE_MESSAGE와 동일해야 한다
// (.mjs 운영 스크립트는 TS 상수를 직접 import할 수 없어 리터럴로 미러링).
const GENERATION_FAILURE_MESSAGE = "Asset generation failed";

/** metadata가 raw(=generic이 아닌) error 값을 가진 평범한 객체인지 판정. */
function hasRawError(metadata) {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    Object.prototype.hasOwnProperty.call(metadata, "error") &&
    metadata.error !== GENERATION_FAILURE_MESSAGE
  );
}

async function main() {
  const apply = process.argv.includes("--apply");

  const failed = await prisma.generatedAsset.findMany({
    where: { status: "FAILED" },
    select: { id: true, metadata: true },
  });

  const targets = failed.filter((row) => hasRawError(row.metadata));

  console.log(`FAILED 자산 ${failed.length}건 중 raw metadata.error 보유 ${targets.length}건.`);

  if (targets.length === 0) {
    console.log("[변경없음] 정화 대상이 없습니다 (이미 generic이거나 error 키 없음).");
    return;
  }

  if (!apply) {
    console.log("\n[dry-run] 다음 행이 generic으로 치환됩니다 (--apply 시 실제 적용):");
    targets.slice(0, 20).forEach((row) => console.log(`  - ${row.id}`));
    if (targets.length > 20) console.log(`  ... 외 ${targets.length - 20}건`);
    console.log(`\n실제 적용하려면: node scripts/backfill-failed-asset-error.mjs --apply`);
    return;
  }

  let updated = 0;
  for (const row of targets) {
    // error 키만 generic으로 치환, 나머지 키(batchId 등)는 보존.
    const nextMetadata = { ...row.metadata, error: GENERATION_FAILURE_MESSAGE };
    await prisma.generatedAsset.update({
      where: { id: row.id },
      data: { metadata: nextMetadata },
    });
    updated += 1;
  }

  console.log(`[완료] ${updated}건의 raw metadata.error를 generic으로 치환했습니다.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
