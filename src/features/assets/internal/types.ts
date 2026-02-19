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
