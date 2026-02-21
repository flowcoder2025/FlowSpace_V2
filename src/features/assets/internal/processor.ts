import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { ComfyUIClient, ComfyUIError } from "@/lib/comfyui";
import { loadWorkflowTemplate, injectWorkflowParams } from "./workflow-loader";
import {
  ASSET_SPECS,
  ASSET_STORAGE_PATHS,
  THUMBNAIL_PATH,
  generateAssetFilename,
} from "./specs";
import { validateAssetMetadata } from "./validator";
import { removeBackground, blendTileEdges } from "./post-processor";
import { checkComfyUICapabilities } from "./capability-checker";
import {
  PROMPT_PREFIXES,
  DEFAULT_NEGATIVE_PROMPTS,
  QUALITY_PRESETS,
  SEAMLESS_PROMPT_PREFIX,
} from "./constants";
import type { QualityPreset } from "./constants";
import type { CreateAssetParams, GeneratedAssetMetadata } from "./types";

/** 에셋 생성 처리 파이프라인 */
export async function processAssetGeneration(
  params: CreateAssetParams
): Promise<GeneratedAssetMetadata> {
  const startTime = Date.now();
  const spec = ASSET_SPECS[params.type];

  // 1. 워크플로우 variant 결정 + 로드
  let variant: string | undefined;
  let useControlNetActual = false;

  if (params.type === "tileset" && params.seamless) {
    variant = "seamless";
  } else if (params.type === "character" && params.useControlNet) {
    // ControlNet 사용 요청 시 capability 확인
    const caps = await checkComfyUICapabilities();
    if (caps.controlNet) {
      variant = "controlnet";
      useControlNetActual = true;
    } else {
      console.warn("[AssetProcessor] ControlNet 미설치, 기본 워크플로우로 폴백");
    }
  }

  const { meta, workflow } = await loadWorkflowTemplate(params.type, variant);

  // 품질 프리셋 적용 (개별 파라미터보다 우선)
  const preset = params.qualityPreset
    ? QUALITY_PRESETS[params.qualityPreset as QualityPreset]
    : undefined;

  const workflowParams: Record<string, unknown> = {
    prompt: buildPrompt(params.type, params.prompt, params.seamless),
    negative_prompt:
      params.negativePrompt || DEFAULT_NEGATIVE_PROMPTS[params.type],
    seed: params.seed ?? Math.floor(Math.random() * 2147483647),
    steps: preset?.steps ?? params.steps,
    cfg: preset?.cfgScale ?? params.cfgScale,
    sampler_name: preset?.samplerName ?? params.samplerName,
    scheduler: preset?.scheduler ?? params.scheduler,
    width: params.width ?? spec.width,
    height: params.height ?? spec.height,
  };

  // ControlNet 파라미터 주입
  if (useControlNetActual) {
    if (params.controlNetModel) {
      workflowParams.controlnet_model = params.controlNetModel;
    }
    if (params.controlNetStrength !== undefined) {
      workflowParams.controlnet_strength = params.controlNetStrength;
    }
    if (params.poseImage) {
      workflowParams.pose_image = params.poseImage;
    }
  }

  const injectedWorkflow = injectWorkflowParams(workflow, meta, workflowParams);

  // 2. ComfyUI 실행
  const client = new ComfyUIClient();

  let result;
  try {
    result = await client.generateAsset(
      {
        type: params.type,
        prompt: params.prompt,
        name: params.name,
        seed: params.seed,
      },
      injectedWorkflow
    );
  } catch (error) {
    const comfyError = ComfyUIError.fromError(error);
    console.error(`[AssetProcessor] ComfyUI 에러 [${comfyError.type}]:`, comfyError.message);

    switch (comfyError.type) {
      case "CONNECTION_REFUSED":
        throw new Error("ComfyUI 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.");
      case "TIMEOUT":
        throw new Error("에셋 생성 시간이 초과되었습니다. 다시 시도하세요.");
      case "MISSING_MODEL":
        throw new Error("필요한 AI 모델이 ComfyUI에 설치되지 않았습니다.");
      case "INVALID_WORKFLOW":
        throw new Error("워크플로우 구성이 올바르지 않습니다.");
      default:
        throw new Error(`에셋 생성 실패: ${comfyError.message}`);
    }
  }

  if (result.status === "failed" || !result.images?.length) {
    console.error("[AssetProcessor] 생성 실패:", result.error);
    throw new Error(result.error || "Asset generation failed: no images");
  }

  // 3. 후처리
  let imageData = result.images[0].data || Buffer.alloc(0);

  // 3a. 배경 제거 (character/object)
  const shouldRemoveBg =
    params.removeBackground ??
    (params.type === "character" || params.type === "object");

  if (shouldRemoveBg && imageData.length > 0) {
    try {
      imageData = await removeBackground(Buffer.from(imageData), {
        tolerance: params.bgRemovalTolerance,
      });
    } catch (err) {
      console.warn("[AssetProcessor] 배경 제거 실패, 원본 사용:", err);
    }
  }

  // 3b. Seamless 타일 엣지 블렌딩 (tileset + seamless)
  if (params.seamless && params.type === "tileset" && imageData.length > 0 && spec.frameWidth && spec.frameHeight && spec.columns && spec.rows) {
    try {
      imageData = await blendTileEdges(
        Buffer.from(imageData),
        spec.frameWidth,
        spec.frameHeight,
        spec.columns,
        spec.rows
      );
    } catch (err) {
      console.warn("[AssetProcessor] 타일 엣지 블렌딩 실패, 원본 사용:", err);
    }
  }

  // 4. 파일 저장 (public/ 하위에 저장, DB에는 /assets/... 형태로 기록)
  const filename = generateAssetFilename(params.type, params.name);
  const storagePath = ASSET_STORAGE_PATHS[params.type];
  const filePath = join(storagePath, filename);

  await mkdir(dirname(join(process.cwd(), "public", filePath)), { recursive: true });
  await writeFile(join(process.cwd(), "public", filePath), imageData);

  // 5. 썸네일 생성 (간소화 - 원본 복사)
  const thumbFilename = `thumb_${Date.now().toString(36)}.png`;
  const thumbPath = join(THUMBNAIL_PATH, thumbFilename);

  await mkdir(dirname(join(process.cwd(), "public", thumbPath)), { recursive: true });
  await writeFile(join(process.cwd(), "public", thumbPath), imageData);

  // 6. 유효성 검증
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

  // 7. 메타데이터 생성
  const processingTime = Date.now() - startTime;

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
    fileSize: imageData.length,
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
function buildPrompt(
  type: CreateAssetParams["type"],
  userPrompt: string,
  seamless?: boolean
): string {
  const prefix = PROMPT_PREFIXES[type] || "";
  const seamlessPrefix = seamless ? SEAMLESS_PROMPT_PREFIX : "";
  return prefix + seamlessPrefix + userPrompt;
}
