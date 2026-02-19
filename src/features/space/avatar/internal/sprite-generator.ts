/**
 * Sprite Generator - Canvas API 프로시저럴 캐릭터 생성
 *
 * 4x4 그리드 (24x32 per frame = 96x128 총 크기)
 * 행: down, left, right, up
 * 열: 4프레임 걷기 애니메이션
 */

import { PLAYER_WIDTH, PLAYER_HEIGHT, SPRITE_COLS, SPRITE_ROWS } from "@/constants/game-constants";
import type { ClassicAvatarConfig } from "./avatar-types";
import { getTextureKey } from "./avatar-config";

const SHEET_WIDTH = PLAYER_WIDTH * SPRITE_COLS; // 96
const SHEET_HEIGHT = PLAYER_HEIGHT * SPRITE_ROWS; // 128

/** 걷기 애니메이션 오프셋 (프레임별 세로 이동) */
const WALK_OFFSETS = [0, -1, 0, -1];

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  config: ClassicAvatarConfig;
  direction: number; // 0=down, 1=left, 2=right, 3=up
  frame: number; // 0-3
}

/** 단일 프레임 그리기 */
function drawCharacterFrame(dc: DrawContext): void {
  const { ctx, x, y, config, direction, frame } = dc;
  const yOff = WALK_OFFSETS[frame];

  // 걷기 프레임별 다리 위치
  const isStep = frame === 1 || frame === 3;
  const legOffset = isStep ? (frame === 1 ? -1 : 1) : 0;

  // Body (바지)
  ctx.fillStyle = config.pantsColor;
  ctx.fillRect(x + 6, y + 20 + yOff, 12, 10);

  // Legs
  ctx.fillStyle = config.pantsColor;
  ctx.fillRect(x + 6 + legOffset, y + 26 + yOff, 5, 6);
  ctx.fillRect(x + 13 - legOffset, y + 26 + yOff, 5, 6);

  // Shoes
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 6 + legOffset, y + 30 + yOff, 5, 2);
  ctx.fillRect(x + 13 - legOffset, y + 30 + yOff, 5, 2);

  // Torso (셔츠)
  ctx.fillStyle = config.shirtColor;
  ctx.fillRect(x + 5, y + 12 + yOff, 14, 10);

  // Arms
  if (direction === 1) {
    // left - 오른팔만 보임
    ctx.fillRect(x + 17, y + 13 + yOff, 4, 8);
  } else if (direction === 2) {
    // right - 왼팔만 보임
    ctx.fillRect(x + 3, y + 13 + yOff, 4, 8);
  } else {
    // front/back - 양팔
    ctx.fillRect(x + 2, y + 13 + yOff, 4, 8);
    ctx.fillRect(x + 18, y + 13 + yOff, 4, 8);
  }

  // Head
  ctx.fillStyle = config.skinColor;
  ctx.fillRect(x + 6, y + 2 + yOff, 12, 12);

  // Hair
  ctx.fillStyle = config.hairColor;
  if (direction === 0) {
    // down (front) - 이마+측면
    ctx.fillRect(x + 5, y + 1 + yOff, 14, 4);
    ctx.fillRect(x + 5, y + 3 + yOff, 2, 4);
    ctx.fillRect(x + 17, y + 3 + yOff, 2, 4);
  } else if (direction === 3) {
    // up (back) - 전체 머리카락
    ctx.fillRect(x + 5, y + 1 + yOff, 14, 10);
  } else {
    // side
    ctx.fillRect(x + 5, y + 1 + yOff, 14, 4);
    if (direction === 1) {
      ctx.fillRect(x + 15, y + 3 + yOff, 4, 6);
    } else {
      ctx.fillRect(x + 5, y + 3 + yOff, 4, 6);
    }
  }

  // Eyes (front only)
  if (direction === 0) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 8, y + 7 + yOff, 2, 2);
    ctx.fillRect(x + 14, y + 7 + yOff, 2, 2);
  } else if (direction === 1) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 8, y + 7 + yOff, 2, 2);
  } else if (direction === 2) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 14, y + 7 + yOff, 2, 2);
  }
}

/**
 * Classic 아바타 스프라이트시트를 Phaser에 등록
 *
 * @returns textureKey
 */
export function generateAvatarSprite(
  scene: Phaser.Scene,
  config: ClassicAvatarConfig
): string {
  const key = getTextureKey(config);

  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return key;

  // 4행(방향) x 4열(프레임)
  for (let dir = 0; dir < SPRITE_ROWS; dir++) {
    for (let frame = 0; frame < SPRITE_COLS; frame++) {
      drawCharacterFrame({
        ctx,
        x: frame * PLAYER_WIDTH,
        y: dir * PLAYER_HEIGHT,
        config,
        direction: dir,
        frame,
      });
    }
  }

  // Phaser's addSpriteSheet accepts canvas at runtime despite TS types
  scene.textures.addSpriteSheet(
    key,
    canvas as unknown as HTMLImageElement,
    { frameWidth: PLAYER_WIDTH, frameHeight: PLAYER_HEIGHT }
  );

  return key;
}
