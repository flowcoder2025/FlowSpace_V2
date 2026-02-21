/** 아바타 타입 정의 */

import type { PartsAvatarConfig } from "./parts/parts-types";

/** Classic 아바타 (프로시저럴 생성) */
export interface ClassicAvatarConfig {
  type: "classic";
  skinColor: string;
  hairColor: string;
  shirtColor: string;
  pantsColor: string;
}

/** Custom 아바타 (AI 생성 스프라이트) */
export interface CustomAvatarConfig {
  type: "custom";
  textureKey: string;
}

export type { PartsAvatarConfig };

export type AvatarConfig = ClassicAvatarConfig | CustomAvatarConfig | PartsAvatarConfig;

/** 방향별 애니메이션 프레임 매핑 (4x4 스프라이트시트) */
export const DIRECTION_FRAMES = {
  down: { start: 0, end: 3 },
  left: { start: 4, end: 7 },
  right: { start: 8, end: 11 },
  up: { start: 12, end: 15 },
} as const;

export type Direction = keyof typeof DIRECTION_FRAMES;

/** 방향별 정지 프레임 */
export const IDLE_FRAMES: Record<Direction, number> = {
  down: 0,
  left: 4,
  right: 8,
  up: 12,
};
