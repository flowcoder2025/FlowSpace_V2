/**
 * Avatar Config - Classic/Custom 아바타 설정 및 파싱
 *
 * 8색 팔레트 기반 프로시저럴 아바타 시스템
 */

import type { AvatarConfig, ClassicAvatarConfig } from "./avatar-types";

/** 기본 8색 팔레트 */
export const SKIN_COLORS = [
  "#f5d0a9", "#e8b88a", "#d4a574", "#c08c5a",
  "#a0724a", "#805a3a", "#604430", "#f0c0b0",
] as const;

export const HAIR_COLORS = [
  "#2a1a0a", "#4a2a10", "#8a5a30", "#c08040",
  "#e0b060", "#d04040", "#404040", "#f0e0c0",
] as const;

export const SHIRT_COLORS = [
  "#4060c0", "#c04040", "#40a040", "#c0a040",
  "#8040a0", "#40a0a0", "#e0e0e0", "#303030",
] as const;

export const PANTS_COLORS = [
  "#304080", "#404040", "#605030", "#803030",
  "#306030", "#505050", "#202020", "#606080",
] as const;

/** 기본 아바타 설정 */
export const DEFAULT_AVATAR: ClassicAvatarConfig = {
  type: "classic",
  skinColor: SKIN_COLORS[0],
  hairColor: HAIR_COLORS[0],
  shirtColor: SHIRT_COLORS[0],
  pantsColor: PANTS_COLORS[0],
};

/**
 * 아바타 문자열 파싱
 *
 * 형식: "classic:skin,hair,shirt,pants" (인덱스)
 * 또는 "custom:textureKey"
 * 또는 "default"
 */
export function parseAvatarString(avatarStr: string): AvatarConfig {
  if (!avatarStr || avatarStr === "default") {
    return DEFAULT_AVATAR;
  }

  const [type, data] = avatarStr.split(":");

  if (type === "custom" && data) {
    return { type: "custom", textureKey: data };
  }

  if (type === "classic" && data) {
    const [skin, hair, shirt, pants] = data.split(",").map(Number);
    return {
      type: "classic",
      skinColor: SKIN_COLORS[skin % SKIN_COLORS.length],
      hairColor: HAIR_COLORS[hair % HAIR_COLORS.length],
      shirtColor: SHIRT_COLORS[shirt % SHIRT_COLORS.length],
      pantsColor: PANTS_COLORS[pants % PANTS_COLORS.length],
    };
  }

  // userId 해시 기반 자동 생성
  return generateFromHash(avatarStr);
}

/** 문자열 해시로 아바타 자동 생성 */
function generateFromHash(str: string): ClassicAvatarConfig {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const h = Math.abs(hash);

  return {
    type: "classic",
    skinColor: SKIN_COLORS[h % SKIN_COLORS.length],
    hairColor: HAIR_COLORS[(h >> 3) % HAIR_COLORS.length],
    shirtColor: SHIRT_COLORS[(h >> 6) % SHIRT_COLORS.length],
    pantsColor: PANTS_COLORS[(h >> 9) % PANTS_COLORS.length],
  };
}

/** 텍스처 키 생성 (캐싱 식별자) */
export function getTextureKey(config: AvatarConfig): string {
  if (config.type === "custom") {
    return config.textureKey;
  }
  return `avatar_${config.skinColor}_${config.hairColor}_${config.shirtColor}_${config.pantsColor}`;
}
