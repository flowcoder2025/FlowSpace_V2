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
import {
  removeBackground,
  alignCharacterFrames,
  blendTileEdges,
  resizeFrame,
  composeSpriteSheet,
  normalizeDirectionFrames,
} from "./post-processor";
import { checkComfyUICapabilities } from "./capability-checker";
import { ensurePosesUploaded, getPoseImageRef } from "./pose-manager";
import {
  PROMPT_PREFIXES,
  DEFAULT_NEGATIVE_PROMPTS,
  QUALITY_PRESETS,
  SEAMLESS_PROMPT_PREFIX,
  CHARACTER_GENERATION_DEFAULTS,
  CHIBI_PROMPT_PREFIX,
  CHIBI_DIRECTION_PROMPTS,
  CHIBI_NEGATIVE_PROMPT,
  CHIBI_GENERATION_DEFAULTS,
  IPADAPTER_DEFAULTS,
} from "./constants";
import type { QualityPreset } from "./constants";
import type { CreateAssetParams, GeneratedAssetMetadata } from "./types";

/** 에셋 생성 처리 파이프라인 */
export async function processAssetGeneration(
  params: CreateAssetParams
): Promise<GeneratedAssetMetadata> {
  // 치비 스타일 분기
  if (params.type === "character" && params.useChibiStyle) {
    return processChibiCharacterGeneration(params);
  }

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

  // 캐릭터 전용 결정론적 샘플러 기본값 적용
  if (params.type === "character" && !params.samplerName) {
    workflowParams.sampler_name = CHARACTER_GENERATION_DEFAULTS.samplerName;
    workflowParams.scheduler = CHARACTER_GENERATION_DEFAULTS.scheduler;
    if (!params.steps && !preset) {
      workflowParams.steps = CHARACTER_GENERATION_DEFAULTS.steps;
      workflowParams.cfg = CHARACTER_GENERATION_DEFAULTS.cfgScale;
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

  // 3b. 캐릭터 프레임 정렬 (character only)
  if (
    params.type === "character" &&
    imageData.length > 0 &&
    spec.frameWidth &&
    spec.frameHeight &&
    spec.columns &&
    spec.rows
  ) {
    try {
      imageData = await alignCharacterFrames(Buffer.from(imageData), {
        frameWidth: spec.frameWidth,
        frameHeight: spec.frameHeight,
        columns: spec.columns,
        rows: spec.rows,
      });
    } catch (err) {
      console.warn("[AssetProcessor] 프레임 정렬 실패, 원본 사용:", err);
    }
  }

  // 3c. Seamless 타일 엣지 블렌딩 (tileset + seamless)
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

// ──────────────────────────────────────────────────────
// 치비 캐릭터 프레임별 생성 파이프라인
// ──────────────────────────────────────────────────────

const CHIBI_DIRECTIONS = ["down", "left", "right", "up"] as const;
const FRAMES_PER_DIR = 8;
const SPRITE_FRAME_SIZE = 128; // 최종 스프라이트 프레임 크기
const SPRITE_COLS = 8;
const SPRITE_ROWS = 4;

async function processChibiCharacterGeneration(
  params: CreateAssetParams
): Promise<GeneratedAssetMetadata> {
  const startTime = Date.now();
  const spec = ASSET_SPECS[params.type];
  const client = new ComfyUIClient();

  // 1. ControlNet + IP-Adapter 가용성 확인
  const caps = await checkComfyUICapabilities();
  const useControlNet =
    (params.useControlNet !== false) && caps.controlNet;
  const useIPAdapter =
    caps.hasIPAdapter && caps.hasIPAdapterPlus && caps.hasCLIPVision;

  if (useIPAdapter) {
    console.log("[ChibiProcessor] IP-Adapter 사용 가능 → 2-Phase 생성 모드");
  } else {
    console.log("[ChibiProcessor] IP-Adapter 미설치 → 기존 방식 (ControlNet only)");
  }

  // 2. 포즈 이미지 업로드 (ControlNet 사용 시)
  if (useControlNet) {
    await ensurePosesUploaded(client);
  }

  // 3. Phase A: 레퍼런스 이미지 생성 (IP-Adapter 사용 시)
  let uploadedRefPath: string | null = null;

  if (useIPAdapter) {
    console.log("[ChibiProcessor] Phase A: 레퍼런스 프레임 생성 (down_0)...");

    const refWorkflowVariant = useControlNet ? "chibi-frame" : "chibi-fallback";
    const { meta: refMeta, workflow: refWorkflow } =
      await loadWorkflowTemplate("character", refWorkflowVariant);

    const baseSeedForRef = params.seed ?? Math.floor(Math.random() * 2147483647);
    const refPrompt = buildChibiPrompt("down", params.prompt);
    const refParams: Record<string, unknown> = {
      prompt: refPrompt,
      negative_prompt: params.negativePrompt || CHIBI_NEGATIVE_PROMPT,
      seed: baseSeedForRef,
      steps: params.steps ?? CHIBI_GENERATION_DEFAULTS.steps,
      cfg: params.cfgScale ?? CHIBI_GENERATION_DEFAULTS.cfgScale,
      sampler_name: params.samplerName ?? CHIBI_GENERATION_DEFAULTS.samplerName,
      scheduler: params.scheduler ?? CHIBI_GENERATION_DEFAULTS.scheduler,
      lora_strength: params.loraStrength ?? CHIBI_GENERATION_DEFAULTS.loraStrength,
    };

    if (useControlNet) {
      refParams.pose_image = getPoseImageRef("down", 0);
      refParams.controlnet_strength =
        params.controlNetStrength ?? CHIBI_GENERATION_DEFAULTS.controlNetStrength;
      refParams.controlnet_start =
        params.controlNetStart ?? CHIBI_GENERATION_DEFAULTS.controlNetStart;
      refParams.controlnet_end =
        params.controlNetEnd ?? CHIBI_GENERATION_DEFAULTS.controlNetEnd;
    }

    const refInjected = injectWorkflowParams(refWorkflow, refMeta, refParams);
    if (refInjected["9"]?.inputs) {
      refInjected["9"].inputs.filename_prefix = `chibi_ref_${Date.now()}`;
    }

    let refResult;
    try {
      refResult = await client.generateAsset(
        { type: "character", prompt: params.prompt, name: params.name, seed: baseSeedForRef },
        refInjected
      );
    } catch (error) {
      const comfyError = ComfyUIError.fromError(error);
      console.error(`[ChibiProcessor] 레퍼런스 프레임 에러 [${comfyError.type}]:`, comfyError.message);
      throw new Error(`치비 레퍼런스 프레임 생성 실패: ${comfyError.message}`);
    }

    if (refResult.status === "failed" || !refResult.images?.length) {
      throw new Error(`치비 레퍼런스 프레임 생성 실패: ${refResult.error || "no images"}`);
    }

    let refData = refResult.images[0].data || Buffer.alloc(0);

    // 레퍼런스 이미지 배경 제거
    if (params.removeBackground !== false && refData.length > 0) {
      try {
        refData = await removeBackground(Buffer.from(refData), {
          tolerance: params.bgRemovalTolerance,
        });
      } catch (err) {
        console.warn("[ChibiProcessor] 레퍼런스 배경 제거 실패:", err);
      }
    }

    // ComfyUI input에 레퍼런스 이미지 업로드
    const refFilename = `ref_${Date.now()}.png`;
    try {
      const uploaded = await client.uploadImage(
        Buffer.from(refData),
        refFilename,
        "chibi-reference"
      );
      uploadedRefPath = `${uploaded.subfolder}/${uploaded.name}`;
      console.log(`[ChibiProcessor] Phase A 완료: 레퍼런스 업로드 → ${uploadedRefPath}`);
    } catch (err) {
      console.warn("[ChibiProcessor] 레퍼런스 업로드 실패, IP-Adapter 비활성화:", err);
      uploadedRefPath = null;
    }
  }

  // 4. Phase B: 32프레임 생성
  const actualUseIPAdapter = useIPAdapter && uploadedRefPath !== null;
  const workflowVariant = actualUseIPAdapter
    ? "chibi-ipadapter"
    : useControlNet ? "chibi-frame" : "chibi-fallback";
  const { meta, workflow } = await loadWorkflowTemplate("character", workflowVariant);

  console.log(`[ChibiProcessor] Phase B: 32프레임 생성 (워크플로우: ${workflowVariant})`);

  // 방향별 seed 고정: 같은 방향 8프레임은 동일 seed → 걷기 사이클 내 외형 일관성 최대화
  const baseSeed = params.seed ?? Math.floor(Math.random() * 2147483647);
  const frames: Buffer[] = [];
  let globalFrameIndex = 0;

  for (let dirIdx = 0; dirIdx < CHIBI_DIRECTIONS.length; dirIdx++) {
    const direction = CHIBI_DIRECTIONS[dirIdx];
    const directionSeed = baseSeed + dirIdx;
    const dirRawFrames: Buffer[] = []; // 방향별 원본 프레임 (배경 제거 후, 리사이즈 전)

    for (let fi = 0; fi < FRAMES_PER_DIR; fi++) {
      const prompt = buildChibiPrompt(direction, params.prompt);
      const negativePrompt = params.negativePrompt || CHIBI_NEGATIVE_PROMPT;
      const seed = directionSeed;

      const workflowParams: Record<string, unknown> = {
        prompt,
        negative_prompt: negativePrompt,
        seed,
        steps: params.steps ?? CHIBI_GENERATION_DEFAULTS.steps,
        cfg: params.cfgScale ?? CHIBI_GENERATION_DEFAULTS.cfgScale,
        sampler_name: params.samplerName ?? CHIBI_GENERATION_DEFAULTS.samplerName,
        scheduler: params.scheduler ?? CHIBI_GENERATION_DEFAULTS.scheduler,
        lora_strength: params.loraStrength ?? CHIBI_GENERATION_DEFAULTS.loraStrength,
      };

      if (useControlNet) {
        workflowParams.pose_image = getPoseImageRef(direction, fi);
        workflowParams.controlnet_strength =
          params.controlNetStrength ?? CHIBI_GENERATION_DEFAULTS.controlNetStrength;
        workflowParams.controlnet_start =
          params.controlNetStart ?? CHIBI_GENERATION_DEFAULTS.controlNetStart;
        workflowParams.controlnet_end =
          params.controlNetEnd ?? CHIBI_GENERATION_DEFAULTS.controlNetEnd;
      }

      // IP-Adapter 파라미터 주입
      if (actualUseIPAdapter) {
        workflowParams.reference_image = uploadedRefPath;
        workflowParams.ipadapter_weight =
          params.ipAdapterWeight ?? IPADAPTER_DEFAULTS.weight;
      }

      const injected = injectWorkflowParams(workflow, meta, workflowParams);

      // SaveImage filename_prefix를 프레임별로 고유하게 설정 (ComfyUI 캐시 방지)
      if (injected["9"]?.inputs) {
        injected["9"].inputs.filename_prefix = `chibi_${direction}_${fi}_${Date.now()}`;
      }

      // ComfyUI 실행
      let result;
      try {
        result = await client.generateAsset(
          { type: "character", prompt: params.prompt, name: params.name, seed },
          injected
        );
      } catch (error) {
        const comfyError = ComfyUIError.fromError(error);
        console.error(
          `[ChibiProcessor] 프레임 ${globalFrameIndex} 에러 [${comfyError.type}]:`,
          comfyError.message
        );
        throw new Error(`치비 프레임 ${globalFrameIndex} 생성 실패: ${comfyError.message}`);
      }

      if (result.status === "failed" || !result.images?.length) {
        throw new Error(
          `치비 프레임 ${globalFrameIndex} 생성 실패: ${result.error || "no images"}`
        );
      }

      let frameData = result.images[0].data || Buffer.alloc(0);

      // 배경 제거
      if (params.removeBackground !== false && frameData.length > 0) {
        try {
          frameData = await removeBackground(Buffer.from(frameData), {
            tolerance: params.bgRemovalTolerance,
          });
        } catch (err) {
          console.warn(`[ChibiProcessor] 프레임 ${globalFrameIndex} 배경 제거 실패:`, err);
        }
      }

      dirRawFrames.push(Buffer.from(frameData));
      globalFrameIndex++;

      console.log(
        `[ChibiProcessor] 프레임 ${globalFrameIndex}/${CHIBI_DIRECTIONS.length * FRAMES_PER_DIR} 완료 (${direction}_${fi})`
      );
    }

    // 방향별 일괄 정규화: 같은 방향 8프레임의 최대 bbox 폭 기준으로 통일 스케일링
    console.log(`[ChibiProcessor] ${direction} 방향 8프레임 정규화...`);
    const normalizedFrames = await normalizeDirectionFrames(dirRawFrames, {
      targetW: SPRITE_FRAME_SIZE,
      targetH: SPRITE_FRAME_SIZE,
    });
    frames.push(...normalizedFrames);
  }

  // 5. 스프라이트시트 합성
  let imageData = await composeSpriteSheet(frames, {
    frameW: SPRITE_FRAME_SIZE,
    frameH: SPRITE_FRAME_SIZE,
    cols: SPRITE_COLS,
    rows: SPRITE_ROWS,
  });

  // 6. alignCharacterFrames 생략
  // normalizeDirectionFrames가 이미 중앙 배치 + 바닥선 앵커를 처리하므로
  // 추가 시프트는 오히려 프레임 경계 클리핑을 유발 (Down 방향 폭 축소 원인)

  // 7. 파일 저장
  const filename = generateAssetFilename(params.type, params.name, "chibi");
  const storagePath = ASSET_STORAGE_PATHS[params.type];
  const filePath = join(storagePath, filename);

  await mkdir(dirname(join(process.cwd(), "public", filePath)), { recursive: true });
  await writeFile(join(process.cwd(), "public", filePath), imageData);

  // 썸네일
  const thumbFilename = `thumb_${Date.now().toString(36)}.png`;
  const thumbPath = join(THUMBNAIL_PATH, thumbFilename);
  await mkdir(dirname(join(process.cwd(), "public", thumbPath)), { recursive: true });
  await writeFile(join(process.cwd(), "public", thumbPath), imageData);

  // 유효성 검증
  const actualWidth = SPRITE_COLS * SPRITE_FRAME_SIZE; // 1024
  const actualHeight = SPRITE_ROWS * SPRITE_FRAME_SIZE; // 512
  const validation = validateAssetMetadata(params.type, actualWidth, actualHeight);
  if (!validation.valid) {
    console.warn("[ChibiProcessor] 유효성 경고:", validation.errors);
  }

  // 메타데이터 생성
  const processingTime = Date.now() - startTime;

  return {
    id: `chibi-${Date.now()}`,
    type: params.type,
    name: params.name,
    prompt: params.prompt,
    workflow: `character-${workflowVariant}`,
    width: actualWidth,
    height: actualHeight,
    frameWidth: SPRITE_FRAME_SIZE,
    frameHeight: SPRITE_FRAME_SIZE,
    columns: SPRITE_COLS,
    rows: SPRITE_ROWS,
    filePath: `/${filePath.replace(/\\/g, "/")}`,
    thumbnailPath: `/${thumbPath.replace(/\\/g, "/")}`,
    fileSize: imageData.length,
    format: "png",
    seed: baseSeed,
    generatedAt: new Date().toISOString(),
    processingTime,
    status: "completed",
  };
}

/** 치비 방향별 프롬프트 빌드 */
function buildChibiPrompt(direction: string, userPrompt: string): string {
  const directionPrompt = CHIBI_DIRECTION_PROMPTS[direction] || "";
  return CHIBI_PROMPT_PREFIX + directionPrompt + userPrompt;
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
