/**
 * 치비 캐릭터 하이브리드 파이프라인 테스트
 * 방향당 1장 SD 생성 + Sharp 코드 기반 걷기 프레임 변환
 */
import { config } from "dotenv";
config();

process.env.COMFYUI_MODE = "real";

async function main() {
  const { processAssetGeneration } = await import(
    "../src/features/assets/internal/processor"
  );

  console.log("=== 치비 하이브리드 파이프라인 테스트 ===");
  console.log("3방향 SD 생성 + 코드 걷기 프레임 + right=left mirror\n");

  const startTime = Date.now();

  try {
    const result = await processAssetGeneration({
      type: "character",
      name: "chibi_rembg_test",
      prompt: "cute knight with silver armor and blue cape",
      useChibiStyle: true,
      seed: 42,
      // IP-Adapter 0.3 (constants default), ControlNet 방향 가이드 복원
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
