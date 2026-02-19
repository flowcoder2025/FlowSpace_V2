import { ASSET_SPECS } from "./specs";
import type { AssetType, ValidationResult } from "./types";

/** 에셋 메타데이터 유효성 검증 */
export function validateAssetMetadata(
  type: AssetType,
  width: number,
  height: number
): ValidationResult {
  const spec = ASSET_SPECS[type];
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (type) {
    case "character":
      if (width !== spec.width) {
        errors.push(
          `Character sprite width must be ${spec.width}px, got ${width}px`
        );
      }
      if (height !== spec.height) {
        errors.push(
          `Character sprite height must be ${spec.height}px, got ${height}px`
        );
      }
      break;

    case "tileset":
      if (width !== spec.width) {
        errors.push(
          `Tileset width must be ${spec.width}px, got ${width}px`
        );
      }
      if (height !== spec.height) {
        errors.push(
          `Tileset height must be ${spec.height}px, got ${height}px`
        );
      }
      break;

    case "object":
      if (width > spec.width) {
        errors.push(
          `Object width must be <= ${spec.width}px, got ${width}px`
        );
      }
      if (height > spec.height) {
        errors.push(
          `Object height must be <= ${spec.height}px, got ${height}px`
        );
      }
      break;

    case "map":
      if (width < 512) {
        errors.push(`Map width must be >= 512px, got ${width}px`);
      }
      if (height < 384) {
        errors.push(`Map height must be >= 384px, got ${height}px`);
      }
      break;
  }

  if (spec.requiresTransparency) {
    warnings.push(`${type} asset requires transparent background (PNG alpha)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** 파일명 규칙 검증 */
export function validateAssetFilename(filename: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const pattern = /^(character|tileset|object|map)_[a-z0-9_]+_[a-z0-9]+\.png$/;
  if (!pattern.test(filename)) {
    errors.push(
      `Filename must match pattern: {type}_{name}_{variant}.png, got: ${filename}`
    );
  }

  if (!filename.endsWith(".png")) {
    errors.push("Asset must be PNG format");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
