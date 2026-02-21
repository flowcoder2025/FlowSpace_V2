import type { AssetType } from "./types";

/** 품질 프리셋 */
export type QualityPreset = "draft" | "standard" | "high";

export const QUALITY_PRESETS: Record<
  QualityPreset,
  { steps: number; cfgScale: number; samplerName: string; scheduler: string; label: string }
> = {
  draft: {
    steps: 15,
    cfgScale: 5,
    samplerName: "euler",
    scheduler: "normal",
    label: "Draft (빠른 미리보기)",
  },
  standard: {
    steps: 25,
    cfgScale: 7,
    samplerName: "euler_ancestral",
    scheduler: "normal",
    label: "Standard (기본 품질)",
  },
  high: {
    steps: 40,
    cfgScale: 8,
    samplerName: "dpmpp_2m",
    scheduler: "karras",
    label: "High (최고 품질)",
  },
};

/** KSampler 옵션 */
export const SAMPLER_OPTIONS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpmpp_2s_ancestral",
  "dpmpp_2m",
  "dpmpp_sde",
  "dpmpp_2m_sde",
  "uni_pc",
  "ddim",
] as const;

export const SCHEDULER_OPTIONS = [
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
] as const;

/** 에셋 유형별 프롬프트 프리픽스 */
export const PROMPT_PREFIXES: Record<AssetType, string> = {
  character:
    "pixel art character sprite sheet, 8 frames walk cycle, 4 directions (down, left, right, up), 64x64 pixel per frame, 8x4 grid layout, transparent background, game asset, top-down RPG style, ",
  tileset:
    "pixel art tileset, 32x32 pixel tiles, 16x14 grid layout, top-down RPG style, game asset, consistent style, ",
  object:
    "pixel art game object, transparent background, centered, game asset, top-down view, ",
  map: "top-down view map background, pixel art style, game environment, ",
};

/** Seamless 타일 프롬프트 프리픽스 */
export const SEAMLESS_PROMPT_PREFIX =
  "seamless tileable pattern, repeating texture, no visible seams, ";

/** 에셋 유형별 기본 네거티브 프롬프트 */
export const DEFAULT_NEGATIVE_PROMPTS: Record<AssetType, string> = {
  character:
    "blurry, low quality, watermark, text, realistic, photo, 3d render, deformed, ugly",
  tileset:
    "blurry, low quality, watermark, text, realistic, photo, 3d render, inconsistent style",
  object:
    "blurry, low quality, watermark, text, realistic, photo, 3d render, complex background",
  map: "blurry, low quality, watermark, text, realistic, photo, perspective view, isometric",
};
