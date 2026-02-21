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
    "16-bit pixel art tileset sprite sheet, top-down view, 32x32 pixel tiles arranged in a grid, retro RPG game asset, flat 2D, no perspective, no shadows, clean pixel edges, consistent color palette, ",
  object:
    "16-bit pixel art game object sprite, top-down view, transparent background, centered, flat 2D, retro RPG style, clean pixel edges, ",
  map: "16-bit pixel art top-down game map, flat 2D overhead view, retro RPG style, clean pixel art, no perspective, no 3D, ",
};

/** Seamless 타일 프롬프트 프리픽스 */
export const SEAMLESS_PROMPT_PREFIX =
  "seamless tileable pattern, repeating texture, no visible seams, ";

/** 에셋 유형별 기본 네거티브 프롬프트 */
export const DEFAULT_NEGATIVE_PROMPTS: Record<AssetType, string> = {
  character:
    "blurry, low quality, watermark, text, realistic, photorealistic, 3d render, deformed, ugly",
  tileset:
    "blurry, low quality, watermark, text, realistic, photorealistic, 3d render, perspective, vanishing point, photograph, high resolution, shadows, lighting effects",
  object:
    "blurry, low quality, watermark, text, realistic, photorealistic, 3d render, perspective, photograph, complex background, shadows",
  map: "blurry, low quality, watermark, text, realistic, photorealistic, 3d render, perspective view, isometric, photograph, vanishing point, shadows, lighting effects",
};
