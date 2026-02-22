/** 에셋 유형 */
export type AssetType = "character" | "tileset" | "object" | "map";

/** 에셋 상태 */
export type AssetStatus = "pending" | "processing" | "completed" | "failed";

/** 에셋 유효성 검증 결과 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** 에셋 생성 요청 파라미터 */
export interface CreateAssetParams {
  type: AssetType;
  name: string;
  prompt: string;
  workflow?: string;
  seed?: number;
  width?: number;
  height?: number;
  /** 네거티브 프롬프트 (미지정 시 유형별 기본값 사용) */
  negativePrompt?: string;
  /** KSampler steps (미지정 시 프리셋 또는 워크플로우 기본값) */
  steps?: number;
  /** CFG Scale (미지정 시 프리셋 또는 워크플로우 기본값) */
  cfgScale?: number;
  /** Sampler 이름 (euler, dpmpp_2m 등) */
  samplerName?: string;
  /** Scheduler (normal, karras 등) */
  scheduler?: string;
  /** 품질 프리셋 (draft/standard/high) - 개별 값보다 우선 */
  qualityPreset?: string;
  /** 배경 제거 여부 (character/object 기본 true) */
  removeBackground?: boolean;
  /** 배경 제거 색상 허용 오차 (0-255, 기본 30) */
  bgRemovalTolerance?: number;
  /** Seamless 타일링 (tileset 전용) */
  seamless?: boolean;
  /** ControlNet 사용 여부 (character 전용) */
  useControlNet?: boolean;
  /** ControlNet 모델 이름 */
  controlNetModel?: string;
  /** ControlNet 강도 (0-1) */
  controlNetStrength?: number;
  /** 포즈 참조 이미지 경로 */
  poseImage?: string;
  /** 치비 스타일 캐릭터 생성 (프레임별 생성 + 합성) */
  useChibiStyle?: boolean;
  /** LoRA 적용 강도 (0-1, 기본 0.9) */
  loraStrength?: number;
  /** ControlNet 시작 (0-1, 기본 0.0) */
  controlNetStart?: number;
  /** ControlNet 끝 (0-1, 기본 0.8) */
  controlNetEnd?: number;
  /** IP-Adapter 강도 (0-1, 기본 0.8) */
  ipAdapterWeight?: number;
}

/** 에셋 규격 정의 */
export interface AssetSpec {
  type: AssetType;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  requiresTransparency: boolean;
}

/** 생성된 에셋 메타데이터 */
export interface GeneratedAssetMetadata {
  id: string;
  type: AssetType;
  name: string;
  prompt: string;
  workflow: string;
  width: number;
  height: number;
  frameWidth?: number;
  frameHeight?: number;
  columns?: number;
  rows?: number;
  filePath: string;
  thumbnailPath?: string;
  fileSize: number;
  format: "png";
  comfyuiJobId?: string;
  seed?: number;
  generatedAt: string;
  processingTime: number;
  status: AssetStatus;
}

/** 워크플로우 메타데이터 (JSON 파일의 _meta 필드) */
export interface WorkflowMeta {
  name: string;
  description: string;
  version: string;
  assetType: AssetType;
  outputFormat: {
    width: number;
    height: number;
    grid?: string;
    frameSize?: string;
    tileSize?: string;
  };
  parameters: Record<
    string,
    {
      nodeId: string;
      field: string;
      type: string;
      default?: unknown;
    }
  >;
}
