/**
 * ComfyUI character-sprite 워크플로우 테스트
 */
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";

const COMFYUI_URL = "http://localhost:8001";
const WORKFLOW_PATH = join(process.cwd(), "comfyui-workflows/character-sprite.json");
const OUTPUT_DIR = join(process.cwd(), "public/assets/generated/characters");

async function generate(name: string, prompt: string, seed: number) {
  console.log(`\n--- Generating: ${name} (seed: ${seed}) ---`);

  const raw = await readFile(WORKFLOW_PATH, "utf-8");
  const { _meta, ...workflow } = JSON.parse(raw);

  // 프롬프트 + 시드 주입
  (workflow["6"] as any).inputs.text = prompt;
  (workflow["3"] as any).inputs.seed = seed;

  // 큐 등록
  const queueRes = await fetch(`${COMFYUI_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    const err = await queueRes.text();
    throw new Error(`큐 등록 실패: ${queueRes.status} - ${err}`);
  }

  const { prompt_id } = (await queueRes.json()) as { prompt_id: string };
  console.log(`  prompt_id: ${prompt_id}`);

  // 완료 대기
  const start = Date.now();
  while (Date.now() - start < 120_000) {
    const res = await fetch(`${COMFYUI_URL}/history/${prompt_id}`);
    if (res.ok) {
      const data = (await res.json()) as Record<string, any>;
      const entry = data[prompt_id];
      if (entry?.status.status_str === "error") {
        throw new Error(`실행 에러: ${JSON.stringify(entry.status.messages)}`);
      }
      if (entry?.status.completed) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        console.log(`  완료: ${elapsed}s`);

        // 이미지 저장
        for (const output of Object.values(entry.outputs) as any[]) {
          if (output.images) {
            for (const img of output.images) {
              const params = new URLSearchParams({
                filename: img.filename, subfolder: img.subfolder, type: img.type,
              });
              const imgRes = await fetch(`${COMFYUI_URL}/view?${params}`);
              const buffer = Buffer.from(await imgRes.arrayBuffer());
              await mkdir(OUTPUT_DIR, { recursive: true });
              const savePath = join(OUTPUT_DIR, `${name}_${Date.now().toString(36)}.png`);
              await writeFile(savePath, buffer);
              console.log(`  저장: ${savePath} (${(buffer.length / 1024).toFixed(0)}KB)`);
              return savePath;
            }
          }
        }
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("타임아웃");
}

async function main() {
  console.log("=== Character Sprite Generation Test ===");
  console.log("목표: ZEP 상위호환 캐릭터 스프라이트시트\n");

  const statsRes = await fetch(`${COMFYUI_URL}/system_stats`);
  const stats = (await statsRes.json()) as any;
  console.log(`ComfyUI v${stats.system.comfyui_version} | GPU: ${stats.devices[0].name}`);
  console.log(`VRAM: ${(stats.devices[0].vram_total / 1e9).toFixed(1)}GB total`);

  // 테스트 캐릭터 생성
  await generate(
    "char_office_worker",
    "pixel art character sprite sheet, 8 frames walk cycle animation, 4 directions (front, left, right, back), 128x128 pixel per frame, 8 columns 4 rows grid layout, transparent background, cute chibi style office worker, modern casual outfit, clean lines, consistent proportions across all frames, metaverse avatar, high quality game asset, top-down RPG style",
    42
  );

  await generate(
    "char_developer",
    "pixel art character sprite sheet, 8 frames walk cycle animation, 4 directions (front, left, right, back), 128x128 pixel per frame, 8 columns 4 rows grid layout, transparent background, cute chibi style developer with hoodie and laptop bag, glasses, clean lines, consistent proportions across all frames, metaverse avatar, high quality game asset, top-down RPG style",
    123
  );

  console.log("\n=== 테스트 완료 ===");
}

main().catch(err => { console.error("\n실패:", err); process.exit(1); });
