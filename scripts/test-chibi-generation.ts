/**
 * 치비 캐릭터 생성 E2E 테스트
 *
 * ComfyUI 서버가 실행 중이어야 함.
 * 모델 3개 설치 필요: Animagine XL 3.1, ChibiStyleXL LoRA, OpenPoseXL2 ControlNet
 *
 * Usage:
 *   npx tsx scripts/test-chibi-generation.ts
 */
import { config } from "dotenv";
config();

async function main() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 1. 로그인
  console.log("1. 로그인...");
  const loginRes = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      password: "test1234",
    }),
    redirect: "manual",
  });

  const cookies = loginRes.headers.getSetCookie?.() || [];
  const cookieHeader = cookies.join("; ");

  if (!cookieHeader) {
    console.error("로그인 실패: 쿠키를 받지 못함");
    process.exit(1);
  }
  console.log("  ✓ 로그인 성공");

  // 2. 치비 캐릭터 생성 요청
  console.log("2. 치비 캐릭터 생성 요청...");
  const genRes = await fetch(`${baseUrl}/api/assets/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader,
    },
    body: JSON.stringify({
      type: "character",
      name: "chibi_test",
      prompt: "cute knight with silver armor and blue cape",
      useChibiStyle: true,
      useControlNet: true,
      seed: 42,
    }),
  });

  const genData = await genRes.json();
  console.log(`  Status: ${genRes.status}`);
  console.log(`  Response:`, JSON.stringify(genData, null, 2));

  if (genRes.status !== 202) {
    console.error("생성 요청 실패");
    process.exit(1);
  }

  const assetId = genData.id;
  console.log(`  ✓ 생성 시작 (id: ${assetId})`);

  // 3. 폴링으로 완료 대기
  console.log("3. 생성 완료 대기 (최대 10분)...");
  const startTime = Date.now();
  const maxWait = 10 * 60 * 1000;

  while (Date.now() - startTime < maxWait) {
    const statusRes = await fetch(`${baseUrl}/api/assets/${assetId}`, {
      headers: { Cookie: cookieHeader },
    });

    if (statusRes.ok) {
      const asset = await statusRes.json();
      console.log(`  Status: ${asset.status}`);

      if (asset.status === "COMPLETED") {
        console.log(`  ✓ 생성 완료!`);
        console.log(`  filePath: ${asset.filePath}`);
        console.log(`  처리 시간: ${((Date.now() - startTime) / 1000).toFixed(1)}초`);

        if (asset.filePath) {
          console.log("\n4. 스프라이트시트 분석 실행:");
          console.log(
            `   npx tsx scripts/analyze-spritesheet.ts public${asset.filePath} 8 4`
          );
        }
        return;
      }

      if (asset.status === "FAILED") {
        console.error(`  ✗ 생성 실패:`, asset.metadata?.error);
        process.exit(1);
      }
    }

    await new Promise((r) => setTimeout(r, 5000));
  }

  console.error("타임아웃: 10분 초과");
  process.exit(1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
