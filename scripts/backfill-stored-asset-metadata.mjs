/**
 * 백필 스크립트 (WI-026, 저장면 축소 심층 방어) — 기존 COMPLETED 자산의 과다 저장 metadata 정화.
 *
 * 배경: WI-026 이전에는 generate/batch 라우트가 생성 성공 시 `GeneratedAssetMetadata`
 * **전체**(`prompt`·`workflow`·`comfyuiJobId` 등 민감/내부 필드 포함)를 통째로
 * `GeneratedAsset.metadata`(Json) 컬럼에 저장했다. 이 값들은 top-level 컬럼
 * (`prompt`/`workflow`/`comfyuiJobId`)에도 중복 존재하며, 응답은 `PUBLIC_METADATA_KEYS`
 * allowlist가 막지만 **DB 저장면 자체가 넓다** — allowlist 드리프트 시 재노출 위험.
 * 이 스크립트는 그 과다 저장 행을 신규 저장과 동일한 공개 키 집합으로 좁힌다.
 *
 * 안전 설계:
 * - **dry-run 기본** — 인자 없이 실행하면 변경 없이 영향 행만 보고한다. 실제 적용은 `--apply`.
 * - **멱등** — 이미 공개 키(+batchId)만 가진 행은 건드리지 않는다(재실행 안전).
 * - **batchId 보존** — GET /api/assets/batch가 `metadata.path:["batchId"]`로 의존하므로
 *   저장 전용 운영 키 batchId는 정화 후에도 유지한다.
 * - **COMPLETED만 대상** — 쿼리가 `status:"COMPLETED"`로 제한한다. 과다 저장 클래스는
 *   성공 경로(전체 metadata 저장)뿐이다. FAILED 행(`{ error }`/`{ batchId, error }`,
 *   WI-024)은 애초에 조회 대상이 아니다.
 * - **prod 코드 게이트** — `--apply`만으로는 부족하다: DATABASE_URL이 비-로컬(원격/prod)을
 *   가리키면 `CONFIRM_PROD_BACKFILL=WI-026` 환경변수 없이는 abort한다(오설정 mutate 방지).
 *   로컬(localhost/127.0.0.1)은 `--apply`만으로 적용된다.
 *
 * 사용법:
 *   node scripts/backfill-stored-asset-metadata.mjs                              # dry-run (보고만)
 *   node scripts/backfill-stored-asset-metadata.mjs --apply                      # 로컬 적용
 *   CONFIRM_PROD_BACKFILL=WI-026 node scripts/backfill-stored-asset-metadata.mjs --apply  # 원격/prod 적용
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import {
  hasExtraStoredKeys,
  normalizeStored,
  isRemoteDatabase,
} from "./backfill-stored-asset-metadata.core.mjs";
config();

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes("--apply");

  // prod 코드 게이트: 원격 DB에 --apply 하려면 명시 확인 환경변수가 필요하다.
  if (
    apply &&
    isRemoteDatabase(process.env.DATABASE_URL) &&
    process.env.CONFIRM_PROD_BACKFILL !== "WI-026"
  ) {
    console.error(
      "[중단] DATABASE_URL이 비-로컬(원격/prod)을 가리킵니다. 의도된 prod 적용이면\n" +
        "       CONFIRM_PROD_BACKFILL=WI-026 환경변수와 함께 다시 실행하십시오."
    );
    process.exitCode = 1;
    return;
  }

  const completed = await prisma.generatedAsset.findMany({
    where: { status: "COMPLETED" },
    select: { id: true, metadata: true },
  });

  const targets = completed.filter((row) => hasExtraStoredKeys(row.metadata));

  console.log(
    `COMPLETED 자산 ${completed.length}건 중 과다 저장 metadata 보유 ${targets.length}건.`
  );

  if (targets.length === 0) {
    console.log("[변경없음] 정화 대상이 없습니다 (이미 공개 키+batchId만 보유).");
    return;
  }

  if (!apply) {
    console.log("\n[dry-run] 다음 행의 metadata가 공개 키(+batchId)로 좁혀집니다 (--apply 시 실제 적용):");
    targets.slice(0, 20).forEach((row) => console.log(`  - ${row.id}`));
    if (targets.length > 20) console.log(`  ... 외 ${targets.length - 20}건`);
    console.log(`\n실제 적용하려면: node scripts/backfill-stored-asset-metadata.mjs --apply`);
    return;
  }

  let updated = 0;
  for (const row of targets) {
    const nextMetadata = normalizeStored(row.metadata);
    await prisma.generatedAsset.update({
      where: { id: row.id },
      data: { metadata: nextMetadata },
    });
    updated += 1;
  }

  console.log(`[완료] ${updated}건의 과다 저장 metadata를 공개 키(+batchId)로 정화했습니다.`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
