/**
 * Parts Avatar String Parser / Builder
 *
 * 포맷: "parts:body_01:FFC0A0|hair_03:FF0000|eyes_02|top_05:2196F3|bottom_02:333366|acc_none"
 * 순서: body|hair|eyes|top|bottom|accessory
 */

import type { PartsAvatarConfig, SelectedPart } from "./parts-types";

const CATEGORY_ORDER = ["body", "hair", "eyes", "top", "bottom", "accessory"] as const;

/** 파츠 문자열 파싱 → PartsAvatarConfig */
export function parsePartsString(data: string): PartsAvatarConfig {
  const segments = data.split("|");

  const parsePart = (segment: string | undefined, fallbackId: string): SelectedPart => {
    if (!segment) return { partId: fallbackId };
    const [partId, color] = segment.split(":");
    return color ? { partId, color: `#${color}` } : { partId };
  };

  return {
    type: "parts",
    body: parsePart(segments[0], "body_01"),
    hair: parsePart(segments[1], "hair_01"),
    eyes: parsePart(segments[2], "eyes_01"),
    top: parsePart(segments[3], "top_01"),
    bottom: parsePart(segments[4], "bottom_01"),
    accessory: parsePart(segments[5], "acc_none"),
  };
}

/** PartsAvatarConfig → 아바타 문자열 */
export function buildPartsAvatarString(config: PartsAvatarConfig): string {
  const parts: string[] = [];

  for (const cat of CATEGORY_ORDER) {
    const selected = config[cat];
    const colorSuffix = selected.color ? `:${selected.color.replace("#", "")}` : "";
    parts.push(`${selected.partId}${colorSuffix}`);
  }

  return `parts:${parts.join("|")}`;
}

/** 파츠 아바타 텍스처 키 생성 */
export function getPartsTextureKey(config: PartsAvatarConfig): string {
  const segments = CATEGORY_ORDER.map((cat) => {
    const p = config[cat];
    return p.color ? `${p.partId}_${p.color}` : p.partId;
  });
  return `parts_${segments.join("_")}`;
}
