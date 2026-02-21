import type { AssetSpec, AssetType } from "./types";

/** 에셋 유형별 규격 정의 */
export const ASSET_SPECS: Record<AssetType, AssetSpec> = {
  character: {
    type: "character",
    width: 1024,
    height: 512,
    frameWidth: 128,
    frameHeight: 128,
    columns: 8,
    rows: 4,
    requiresTransparency: true,
  },
  tileset: {
    type: "tileset",
    width: 512,
    height: 448,
    frameWidth: 32,
    frameHeight: 32,
    columns: 16,
    rows: 14,
    requiresTransparency: false,
  },
  object: {
    type: "object",
    width: 512,
    height: 512,
    requiresTransparency: true,
  },
  map: {
    type: "map",
    width: 768,
    height: 576,
    requiresTransparency: false,
  },
};

/** 에셋 저장 경로 (public/ 기준 상대 경로, DB에는 /assets/... 형태로 저장) */
export const ASSET_STORAGE_PATHS: Record<AssetType, string> = {
  character: "assets/generated/characters",
  tileset: "assets/generated/tilesets",
  object: "assets/generated/objects",
  map: "assets/generated/maps",
};

export const THUMBNAIL_PATH = "assets/generated/thumbnails";

/** 에셋 파일명 생성 */
export function generateAssetFilename(
  type: AssetType,
  name: string,
  variant?: string
): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const suffix = variant || Date.now().toString(36);
  return `${type}_${sanitized}_${suffix}.png`;
}
