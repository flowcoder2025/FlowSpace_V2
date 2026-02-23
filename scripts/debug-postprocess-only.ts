/**
 * 기존 raw 이미지로 후처리만 단계별 테스트
 * 사용: npx tsx scripts/debug-postprocess-only.ts
 */
import { config } from "dotenv";
config();

import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { removeBackground, alignCharacterFrames } from "../src/features/assets/internal/post-processor";

const DEBUG_DIR = join(process.cwd(), "public/assets/debug");

async function main() {
  await mkdir(DEBUG_DIR, { recursive: true });

  const rawPath = join(DEBUG_DIR, "step0_raw.png");
  const rawBuffer = await readFile(rawPath);
  console.log(`원본 로드: ${rawPath} (${rawBuffer.length} bytes)\n`);

  // 1. 배경 제거 (flood-fill, tolerance=30)
  console.log("1. 배경 제거 (flood-fill, tolerance=30)...");
  const bgRemoved = await removeBackground(rawBuffer, { tolerance: 30 });
  await writeFile(join(DEBUG_DIR, "v2_step1_bg_t30.png"), bgRemoved);
  console.log(`  → v2_step1_bg_t30.png (${bgRemoved.length} bytes)`);

  // 2. 배경 제거 (flood-fill, tolerance=20)
  console.log("2. 배경 제거 (flood-fill, tolerance=20)...");
  const bgRemoved20 = await removeBackground(rawBuffer, { tolerance: 20 });
  await writeFile(join(DEBUG_DIR, "v2_step1_bg_t20.png"), bgRemoved20);
  console.log(`  → v2_step1_bg_t20.png (${bgRemoved20.length} bytes)`);

  // 3. 프레임 정렬 (per-frame, t=30 기반)
  console.log("3. 프레임 정렬 (per-frame, t=30 배경제거 기반)...");
  const aligned = await alignCharacterFrames(bgRemoved, {
    frameWidth: 128, frameHeight: 128, columns: 8, rows: 4,
  });
  await writeFile(join(DEBUG_DIR, "v2_step2_aligned_t30.png"), aligned);
  console.log(`  → v2_step2_aligned_t30.png (${aligned.length} bytes)`);

  // 4. 프레임 정렬 (per-frame, t=20 기반)
  console.log("4. 프레임 정렬 (per-frame, t=20 배경제거 기반)...");
  const aligned20 = await alignCharacterFrames(bgRemoved20, {
    frameWidth: 128, frameHeight: 128, columns: 8, rows: 4,
  });
  await writeFile(join(DEBUG_DIR, "v2_step2_aligned_t20.png"), aligned20);
  console.log(`  → v2_step2_aligned_t20.png (${aligned20.length} bytes)`);

  console.log("\n=== 완료 ===");
  console.log("비교: step1_bg_removed.png (구 전역매칭) vs v2_step1_bg_t30.png (신 flood-fill)");
  console.log("비교: step2_aligned.png (구 행유니온) vs v2_step2_aligned_t30.png (신 프레임별)");
}

main().catch(console.error);
