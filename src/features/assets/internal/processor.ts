import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { ComfyUIClient } from "@/lib/comfyui";
import { loadWorkflowTemplate, injectWorkflowParams } from "./workflow-loader";
import {
  ASSET_SPECS,
  ASSET_STORAGE_PATHS,
  THUMBNAIL_PATH,
  generateAssetFilename,
} from "./specs";
import { validateAssetMetadata } from "./validator";
import type { CreateAssetParams, GeneratedAssetMetadata } from "./types";

/** 에셋 생성 처리 파이프라인 */
export async function processAssetGeneration(
  params: CreateAssetParams
): Promise<GeneratedAssetMetadata> {
  const startTime = Date.now();
  const spec = ASSET_SPECS[params.type];

  // 1. 워크플로우 로드 + 파라미터 주입
  const { meta, workflow } = await loadWorkflowTemplate(params.type);

  const injectedWorkflow = injectWorkflowParams(workflow, meta, {
    prompt: buildPrompt(params.type, params.prompt),
    seed: params.seed ?? Math.floor(Math.random() * 2147483647),
    width: params.width ?? spec.width,
    height: params.height ?? spec.height,
  });

  // 2. ComfyUI 실행
  const client = new ComfyUIClient();
  const result = await client.generateAsset(
    {
      type: params.type,
      prompt: params.prompt,
      name: params.name,
      seed: params.seed,
    },
    injectedWorkflow
  );

  if (result.status === "failed" || !result.images?.length) {
    throw new Error(result.error || "Asset generation failed: no images");
  }

  // 3. 파일 저장
  const filename = generateAssetFilename(params.type, params.name);
  const storagePath = ASSET_STORAGE_PATHS[params.type];
  const filePath = join(storagePath, filename);

  await mkdir(dirname(join(process.cwd(), filePath)), { recursive: true });
  await writeFile(
    join(process.cwd(), filePath),
    result.images[0].data || Buffer.alloc(0)
  );

  // 4. 썸네일 생성 (간소화 - 원본 복사)
  const thumbFilename = `thumb_${Date.now().toString(36)}.png`;
  const thumbPath = join(THUMBNAIL_PATH, thumbFilename);

  await mkdir(dirname(join(process.cwd(), thumbPath)), { recursive: true });
  await writeFile(
    join(process.cwd(), thumbPath),
    result.images[0].data || Buffer.alloc(0)
  );

  // 5. 유효성 검증
  const actualWidth = params.width ?? spec.width;
  const actualHeight = params.height ?? spec.height;
  const validation = validateAssetMetadata(
    params.type,
    actualWidth,
    actualHeight
  );

  if (!validation.valid) {
    console.warn("Asset validation warnings:", validation.errors);
  }

  // 6. 메타데이터 생성
  const processingTime = Date.now() - startTime;
  const fileData = result.images[0].data;

  const metadata: GeneratedAssetMetadata = {
    id: result.promptId,
    type: params.type,
    name: params.name,
    prompt: params.prompt,
    workflow: params.workflow || meta.name,
    width: actualWidth,
    height: actualHeight,
    frameWidth: spec.frameWidth,
    frameHeight: spec.frameHeight,
    columns: spec.columns,
    rows: spec.rows,
    filePath: `/${filePath.replace(/\\/g, "/")}`,
    thumbnailPath: `/${thumbPath.replace(/\\/g, "/")}`,
    fileSize: fileData ? fileData.length : 0,
    format: "png",
    comfyuiJobId: result.promptId,
    seed: params.seed,
    generatedAt: new Date().toISOString(),
    processingTime,
    status: "completed",
  };

  return metadata;
}

/** 에셋 유형별 프롬프트 빌드 */
function buildPrompt(type: CreateAssetParams["type"], userPrompt: string): string {
  const prefixes: Record<string, string> = {
    character:
      "pixel art character sprite sheet, 8 frames walk cycle, 4 directions (down, left, right, up), 64x64 pixel per frame, 8x4 grid layout, transparent background, game asset, top-down RPG style, ",
    tileset:
      "pixel art tileset, 32x32 pixel tiles, 16x14 grid layout, top-down RPG style, game asset, consistent style, ",
    object:
      "pixel art game object, transparent background, centered, game asset, top-down view, ",
    map: "top-down view map background, pixel art style, game environment, ",
  };

  return (prefixes[type] || "") + userPrompt;
}
