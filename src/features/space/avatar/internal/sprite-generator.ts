/**
 * Sprite Generator - Canvas API 프로시저럴 캐릭터 생성
 *
 * 4x4 그리드 (32x48 per frame = 128x192 총 크기)
 * 행: down, left, right, up
 * 열: 4프레임 걷기 애니메이션
 */

import { PLAYER_WIDTH, PLAYER_HEIGHT, SPRITE_COLS, SPRITE_ROWS } from "@/constants/game-constants";
import type { AvatarConfig, ClassicAvatarConfig } from "./avatar-types";
import { getTextureKey, DEFAULT_PARTS_AVATAR } from "./avatar-config";
import { generatePartsSprite } from "./parts/parts-compositor";
import { eventBridge, GameEvents } from "../../game/events";

const SHEET_WIDTH = PLAYER_WIDTH * SPRITE_COLS; // 128
const SHEET_HEIGHT = PLAYER_HEIGHT * SPRITE_ROWS; // 192

/** 현재 로딩 중인 custom 텍스처 키 (중복 로드 방지) */
const loadingCustomKeys = new Set<string>();

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

/** 단일 프레임 그리기 (32x48 해상도) */
function drawCharacterFrame(dc: DrawContext): void {
  const { ctx, x, y, config, direction, frame } = dc;
  const yOff = WALK_OFFSETS[frame];

  // 걷기 프레임별 다리 위치
  const isStep = frame === 1 || frame === 3;
  const legOffset = isStep ? (frame === 1 ? -1 : 1) : 0;

  // Body (바지 영역)
  ctx.fillStyle = config.pantsColor;
  ctx.fillRect(x + 8, y + 30 + yOff, 16, 14);

  // Legs
  ctx.fillStyle = config.pantsColor;
  ctx.fillRect(x + 8 + legOffset, y + 38 + yOff, 7, 10);
  ctx.fillRect(x + 17 - legOffset, y + 38 + yOff, 7, 10);

  // Shoes
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 8 + legOffset, y + 45 + yOff, 7, 3);
  ctx.fillRect(x + 17 - legOffset, y + 45 + yOff, 7, 3);

  // Torso (셔츠)
  ctx.fillStyle = config.shirtColor;
  ctx.fillRect(x + 7, y + 18 + yOff, 18, 14);

  // Arms
  if (direction === 1) {
    // left - 오른팔만 보임
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 11);
  } else if (direction === 2) {
    // right - 왼팔만 보임
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 11);
  } else {
    // front/back - 양팔
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 11);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 11);
  }

  // Head
  ctx.fillStyle = config.skinColor;
  ctx.fillRect(x + 8, y + 3 + yOff, 16, 16);

  // Hair
  ctx.fillStyle = config.hairColor;
  if (direction === 0) {
    // down (front) - 이마+측면
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 6);
    ctx.fillRect(x + 7, y + 5 + yOff, 3, 6);
    ctx.fillRect(x + 22, y + 5 + yOff, 3, 6);
  } else if (direction === 3) {
    // up (back) - 전체 머리카락
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 14);
  } else {
    // side
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 6);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 5 + yOff, 5, 8);
    } else {
      ctx.fillRect(x + 7, y + 5 + yOff, 5, 8);
    }
  }

  // Eyes (front/side only)
  if (direction === 0) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 11, y + 10 + yOff, 3, 3);
    ctx.fillRect(x + 18, y + 10 + yOff, 3, 3);
  } else if (direction === 1) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 11, y + 10 + yOff, 3, 3);
  } else if (direction === 2) {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(x + 18, y + 10 + yOff, 3, 3);
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

/**
 * 통합 아바타 스프라이트 생성 (classic/parts/custom 모두 처리)
 *
 * @returns textureKey
 */
export function generateAvatarSpriteFromConfig(
  scene: Phaser.Scene,
  config: AvatarConfig,
): string {
  if (config.type === "parts") {
    return generatePartsSprite(scene, config);
  }
  if (config.type === "classic") {
    return generateAvatarSprite(scene, config);
  }
  // custom — 텍스처가 이미 등록되어 있으면 바로 반환
  if (scene.textures.exists(config.textureKey)) {
    return config.textureKey;
  }
  // 텍스처 미등록 → 비동기 로드 시작, 기본 아바타를 fallback으로 반환
  loadCustomAvatarTexture(scene, config.textureKey);
  return generatePartsSprite(scene, DEFAULT_PARTS_AVATAR);
}

/**
 * Custom 아바타 텍스처를 비동기로 로드하여 Phaser에 등록
 *
 * 원본 에셋(128x128 프레임, 8열)을 게임 아바타(32x48 프레임, 4x4 grid)로 변환
 */
function loadCustomAvatarTexture(scene: Phaser.Scene, textureKey: string): void {
  if (loadingCustomKeys.has(textureKey)) return;
  loadingCustomKeys.add(textureKey);

  // textureKey 형태: "character_{assetId}"
  const assetId = textureKey.replace("character_", "");

  fetch(`/api/assets/${assetId}`)
    .then((res) => {
      if (!res.ok) throw new Error("Asset not found");
      return res.json();
    })
    .then((asset: { filePath?: string; metadata?: Record<string, unknown> }) => {
      if (!asset.filePath) throw new Error("No file path");
      return loadImageAsCanvas(asset.filePath).then((srcCanvas) => ({
        srcCanvas,
        metadata: asset.metadata,
      }));
    })
    .then(({ srcCanvas, metadata }) => {
      const srcFrameW = (metadata?.frameWidth as number) || 128;
      const srcFrameH = (metadata?.frameHeight as number) || 128;
      const srcCols = Math.floor(srcCanvas.width / srcFrameW);

      // 원본에서 4방향 x 4프레임 추출 → 32x48로 리사이즈
      const destCanvas = document.createElement("canvas");
      destCanvas.width = SHEET_WIDTH;   // 128
      destCanvas.height = SHEET_HEIGHT; // 192
      const ctx = destCanvas.getContext("2d");
      if (!ctx) return;

      // 방향 매핑: down(row0), left(row1), right(row2), up(row3)
      for (let dir = 0; dir < SPRITE_ROWS; dir++) {
        for (let frame = 0; frame < SPRITE_COLS; frame++) {
          const srcIdx = dir * srcCols + frame;
          const srcRow = Math.floor(srcIdx / srcCols);
          const srcCol = srcIdx % srcCols;

          ctx.drawImage(
            srcCanvas,
            srcCol * srcFrameW, srcRow * srcFrameH, srcFrameW, srcFrameH,
            frame * PLAYER_WIDTH, dir * PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT,
          );
        }
      }

      // Phaser 텍스처 등록
      if (!scene.textures.exists(textureKey)) {
        scene.textures.addSpriteSheet(
          textureKey,
          destCanvas as unknown as HTMLImageElement,
          { frameWidth: PLAYER_WIDTH, frameHeight: PLAYER_HEIGHT },
        );
      }

      // EventBridge로 아바타 업데이트 재트리거
      eventBridge.emit(GameEvents.PLAYER_AVATAR_UPDATED, {
        avatar: `custom:${textureKey}`,
      });
    })
    .catch(() => {})
    .finally(() => {
      loadingCustomKeys.delete(textureKey);
    });
}

/** 이미지 URL을 Canvas로 로드 */
function loadImageAsCanvas(url: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}
