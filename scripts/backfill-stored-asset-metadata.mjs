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
 * - **COMPLETED만 대상** — FAILED 행은 `{ error }`/`{ batchId, error }`만 가져(WI-024) 과다
 *   저장 클래스가 아니며, error 키는 별도 정책(WI-024)이라 건드리지 않는다.
 * - prod 적용은 사용자 승인 게이트(DATABASE_URL이 prod를 가리킬 때 신중히).
 *
 * 사용법:
 *   node scripts/backfill-stored-asset-metadata.mjs           # dry-run (영향 행 보고만)
 *   node scripts/backfill-stored-asset-metadata.mjs --apply   # 실제 정화 적용
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();

const prisma = new PrismaClient();

// src/features/assets/internal/public-asset.ts 의 PUBLIC_METADATA_KEYS와 동일해야 한다
// (.mjs 운영 스크립트는 TS 상수를 직접 import할 수 없어 리터럴로 미러링).
const PUBLIC_METADATA_KEYS = [
  "width",
  "height",
  "frameWidth",
  "frameHeight",
  "columns",
  "rows",
  "format",
  "seed",
  "generatedAt",
  "processingTime",
];

// 저장 시 허용되는 키 = 공개 런타임 키 + 저장 전용 운영 키(batchId).
const ALLOWED_STORED_KEYS = new Set([...PUBLIC_METADATA_KEYS, "batchId"]);

/** metadata가 허용 집합 밖의 키를 가진(=과다 저장된) 평범한 객체인지 판정. */
function hasExtraStoredKeys(metadata) {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return false;
  }
  return Object.keys(metadata).some((key) => !ALLOWED_STORED_KEYS.has(key));
}

/** 허용 키만 골라 새 metadata 객체로 정화(원본 키 순서 무관, 값 보존). */
function normalizeStored(metadata) {
  const out = {};
  for (const key of Object.keys(metadata)) {
    if (ALLOWED_STORED_KEYS.has(key)) {
      out[key] = metadata[key];
    }
  }
  return out;
}

async function main() {
  const apply = process.argv.includes("--apply");

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
