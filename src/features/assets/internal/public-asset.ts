import type { AssetType, AssetStatus, Prisma } from "@prisma/client";

/**
 * GeneratedAsset 공개 응답 DTO (WI-019)
 *
 * `GET /api/assets/[id]`는 게임 런타임 로더(game-loader/sprite-generator)와
 * 폴링 스크립트가 호출하는 자산 상세 API다. raw Prisma row를 그대로 반환하면
 * 내부/민감 필드(prompt·workflow·comfyuiJobId)가 외부로 새 나간다.
 *
 * ⚠️ 핵심: 동일 민감 필드가 `metadata`(Json) 컬럼에도 중복 저장된다
 * (generate/batch 라우트가 `GeneratedAssetMetadata` 전체를 JSON으로 저장).
 * 따라서 top-level allowlist만으로는 부족하고 metadata도 정규화해야 한다.
 */

/**
 * 공개 metadata 키 allowlist — 렌더링/폴링에 필요한 비민감 키만.
 * 제외: prompt·workflow·comfyuiJobId(민감), id·type·name·status·filePath·
 * thumbnailPath·fileSize(top-level 중복), batchId(내부 그룹핑).
 */
export const PUBLIC_METADATA_KEYS = [
  "width",
  "height",
  "frameWidth",
  "frameHeight",
  "columns",
  "rows",
  "format",
  "seed",
  "generatedAt",
  "processingTime",
  "error",
] as const;

export interface PublicGeneratedAsset {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
  isShared: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
}

/** 헬퍼가 요구하는 최소 입력 형태(route의 select 결과를 구조적으로 수용). */
export interface GeneratedAssetForPublic {
  id: string;
  type: AssetType;
  name: string;
  status: AssetStatus;
  filePath: string | null;
  thumbnailPath: string | null;
  fileSize: number | null;
  isShared: boolean;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string | null };
}

/**
 * 저장된 metadata(Json)를 공개 키 allowlist로 축소.
 * null/비객체/배열 → null. 객체면 allowlist 키만 골라 새 객체로.
 */
function toPublicMetadata(
  metadata: Prisma.JsonValue
): Record<string, unknown> | null {
  if (
    metadata === null ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const src = metadata as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_METADATA_KEYS) {
    const value = src[key];
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * raw GeneratedAsset row → 공개 응답 DTO.
 * userId 등 권한 판정 전용 필드는 입력에 있어도 응답에 포함하지 않는다.
 */
export function toPublicGeneratedAsset(
  asset: GeneratedAssetForPublic
): PublicGeneratedAsset {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    status: asset.status,
    filePath: asset.filePath,
    thumbnailPath: asset.thumbnailPath,
    fileSize: asset.fileSize,
    isShared: asset.isShared,
    metadata: toPublicMetadata(asset.metadata),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    user: { id: asset.user.id, name: asset.user.name },
  };
}
