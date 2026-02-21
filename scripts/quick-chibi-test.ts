/**
 * 치비 파이프라인 빠른 테스트
 * processAssetGeneration()을 직접 호출
 */
import { config } from "dotenv";
config();

process.env.COMFYUI_MODE = "real";

async function main() {
  const { processAssetGeneration } = await import(
    "../src/features/assets/internal/processor"
  );

  console.log("=== 치비 캐릭터 전체 파이프라인 테스트 ===");
  console.log("32프레임 생성 시작 (예상 소요: 5~10분)...\n");

  const startTime = Date.now();

  try {
    const result = await processAssetGeneration({
      type: "character",
      name: "chibi_knight_test",
      prompt: "cute knight with silver armor and blue cape",
      useChibiStyle: true,
      useControlNet: true,
      seed: 42,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n=== 완료 (${elapsed}초) ===`);
    console.log(`filePath: ${result.filePath}`);
    console.log(`size: ${(result.fileSize / 1024).toFixed(1)}KB`);
    console.log(`dimensions: ${result.width}×${result.height}`);
    console.log(`frames: ${result.columns}×${result.rows}`);
    console.log(`seed: ${result.seed}`);

    const publicPath = `public${result.filePath}`;
    console.log(`\n분석기 실행:`);
    console.log(`  npx tsx scripts/analyze-spritesheet.ts ${publicPath} 8 4`);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`\n=== 실패 (${elapsed}초) ===`);
    console.error(err instanceof Error ? err.message : err);
    console.error(err instanceof Error ? err.stack : "");
    process.exit(1);
  }
}

main();
