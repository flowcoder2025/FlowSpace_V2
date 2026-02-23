/**
 * 캐릭터 후처리 파이프라인 디버깅 스크립트
 * 단계별 결과를 각각 저장하여 어느 단계에서 문제가 발생하는지 확인
 *
 * 사용: npx tsx scripts/debug-character-pipeline.ts
 */
import { config } from "dotenv";
config();

import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { removeBackground, alignCharacterFrames } from "../src/features/assets/internal/post-processor";

const CHARACTERS_DIR = join(process.cwd(), "public/assets/generated/characters");
const DEBUG_DIR = join(process.cwd(), "public/assets/debug");

async function main() {
  await mkdir(DEBUG_DIR, { recursive: true });

  // 현재 생성된 캐릭터 중 하나를 ComfyUI에서 다시 받아오진 않고,
  // 대신 기존 파일에 대해 removeBackground → align 을 단계별로 수행

  // ComfyUI 원본은 이미 후처리가 적용된 상태이므로,
  // 새로 캐릭터 1개를 생성하되 후처리 없이 원본만 저장
  const { ComfyUIClient } = await import("../src/lib/comfyui");
  const { loadWorkflowTemplate, injectWorkflowParams } = await import(
    "../src/features/assets/internal/workflow-loader"
  );
  const { PROMPT_PREFIXES, DEFAULT_NEGATIVE_PROMPTS } = await import(
    "../src/features/assets/internal/constants"
  );

  console.log("=== 캐릭터 파이프라인 디버깅 ===\n");

  // 1. ComfyUI로 캐릭터 1개 생성 (원본)
  console.log("1. ComfyUI 원본 생성 중...");
  const { meta, workflow } = await loadWorkflowTemplate("character");

  const prompt = "male office worker in suit and tie, brown hair, carrying briefcase, professional look, clean design";
  const prefix = PROMPT_PREFIXES["character"] || "";
  const fullPrompt = prefix + prompt;

  const injected = injectWorkflowParams(workflow, meta, {
    prompt: fullPrompt,
    negative_prompt: DEFAULT_NEGATIVE_PROMPTS["character"],
    seed: 42,
    steps: 25,
    cfg: 7,
    sampler_name: "euler_ancestral",
    scheduler: "normal",
    width: 1024,
    height: 512,
  });

  const client = new ComfyUIClient();
  const result = await client.generateAsset(
    { type: "character", prompt, name: "debug_test", seed: 42 },
    injected
  );

  if (result.status === "failed" || !result.images?.length) {
    console.error("ComfyUI 생성 실패:", result.error);
    process.exit(1);
  }

  const rawBuffer = Buffer.from(result.images[0].data!);
  const rawPath = join(DEBUG_DIR, "step0_raw.png");
  await writeFile(rawPath, rawBuffer);
  console.log(`  → ${rawPath} (${rawBuffer.length} bytes)`);

  // 2. 배경 제거만 적용
  console.log("\n2. 배경 제거 적용 중 (tolerance=30)...");
  const bgRemovedBuffer = await removeBackground(rawBuffer, { tolerance: 30 });
  const bgPath = join(DEBUG_DIR, "step1_bg_removed.png");
  await writeFile(bgPath, bgRemovedBuffer);
  console.log(`  → ${bgPath} (${bgRemovedBuffer.length} bytes)`);

  // 2b. 낮은 tolerance로도 시도
  console.log("\n2b. 배경 제거 (tolerance=15)...");
  const bgRemovedLow = await removeBackground(rawBuffer, { tolerance: 15 });
  const bgLowPath = join(DEBUG_DIR, "step1b_bg_removed_t15.png");
  await writeFile(bgLowPath, bgRemovedLow);
  console.log(`  → ${bgLowPath} (${bgRemovedLow.length} bytes)`);

  // 3. 프레임 정렬만 적용 (배경 제거 결과에)
  console.log("\n3. 프레임 정렬 적용 중...");
  const alignedBuffer = await alignCharacterFrames(bgRemovedBuffer, {
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 4,
  });
  const alignedPath = join(DEBUG_DIR, "step2_aligned.png");
  await writeFile(alignedPath, alignedBuffer);
  console.log(`  → ${alignedPath} (${alignedBuffer.length} bytes)`);

  // 3b. 낮은 tolerance 배경제거 + 프레임 정렬
  console.log("\n3b. 프레임 정렬 (tolerance=15 배경제거 기반)...");
  const alignedLow = await alignCharacterFrames(bgRemovedLow, {
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 4,
  });
  const alignedLowPath = join(DEBUG_DIR, "step2b_aligned_t15.png");
  await writeFile(alignedLowPath, alignedLow);
  console.log(`  → ${alignedLowPath} (${alignedLow.length} bytes)`);

  console.log("\n=== 디버깅 파일 생성 완료 ===");
  console.log(`확인 경로: ${DEBUG_DIR}`);
  console.log("step0_raw.png          - ComfyUI 원본");
  console.log("step1_bg_removed.png   - 배경 제거 (tolerance=30)");
  console.log("step1b_bg_removed_t15.png - 배경 제거 (tolerance=15)");
  console.log("step2_aligned.png      - 프레임 정렬 (t=30 기반)");
  console.log("step2b_aligned_t15.png - 프레임 정렬 (t=15 기반)");
}

main().catch(console.error);
