/**
 * Parts Compositor - Canvas 레이어 합성 엔진
 *
 * PartsAvatarConfig → 4x4 스프라이트시트 생성
 * 레이어 순서: body → bottom → top → eyes → hair → accessory
 */

import { PLAYER_WIDTH, PLAYER_HEIGHT, SPRITE_COLS, SPRITE_ROWS } from "@/constants/game-constants";
import type { PartsAvatarConfig, PartCategory } from "./parts-types";
import { LAYER_ORDER } from "./parts-types";
import { getPartDrawer, getPartDefinition } from "./parts-registry";
import { getPartsTextureKey } from "./parts-string";
import { WALK_OFFSETS } from "./drawers/drawer-utils";

// 드로어 등록 (한번만)
import { registerBodyParts } from "./drawers/body-drawer";
import { registerEyesParts } from "./drawers/eyes-drawer";
import { registerHairParts } from "./drawers/hair-drawer";
import { registerTopParts } from "./drawers/top-drawer";
import { registerBottomParts } from "./drawers/bottom-drawer";
import { registerAccessoryParts } from "./drawers/accessory-drawer";

let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  registered = true;
  registerBodyParts();
  registerEyesParts();
  registerHairParts();
  registerTopParts();
  registerBottomParts();
  registerAccessoryParts();
}

const SHEET_WIDTH = PLAYER_WIDTH * SPRITE_COLS;
const SHEET_HEIGHT = PLAYER_HEIGHT * SPRITE_ROWS;

/** 드로어의 내부 해상도 (32x48 좌표 유지) */
const DRAW_WIDTH = 32;
const DRAW_HEIGHT = 48;

/** 카테고리 → config 키 매핑 */
const CATEGORY_KEY: Record<PartCategory, keyof PartsAvatarConfig> = {
  body: "body",
  bottom: "bottom",
  top: "top",
  eyes: "eyes",
  hair: "hair",
  accessory: "accessory",
};

/**
 * Parts 아바타 스프라이트시트 생성 → Phaser 텍스처 등록
 */
export function generatePartsSprite(
  scene: Phaser.Scene,
  config: PartsAvatarConfig,
): string {
  ensureRegistered();

  const key = getPartsTextureKey(config);
  if (scene.textures.exists(key)) return key;

  const canvas = document.createElement("canvas");
  canvas.width = SHEET_WIDTH;
  canvas.height = SHEET_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return key;
  ctx.imageSmoothingEnabled = false;

  // 32x48 임시 캔버스에 그린 뒤 96x128로 스케일업
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = DRAW_WIDTH;
  tempCanvas.height = DRAW_HEIGHT;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return key;

  // 4행(방향) x 4열(프레임)
  for (let dir = 0; dir < SPRITE_ROWS; dir++) {
    for (let frame = 0; frame < SPRITE_COLS; frame++) {
      tempCtx.clearRect(0, 0, DRAW_WIDTH, DRAW_HEIGHT);
      const yOff = WALK_OFFSETS[frame];

      // 레이어 순서대로 그리기
      for (const category of LAYER_ORDER) {
        const catKey = CATEGORY_KEY[category];
        const selected = config[catKey];
        if (typeof selected === "string") continue; // type 필드 스킵

        const { partId, color } = selected;
        const drawer = getPartDrawer(partId);
        if (!drawer) continue;

        const def = getPartDefinition(partId);
        const resolvedColor = color ?? def?.defaultColor ?? "#888888";

        drawer({ ctx: tempCtx, x: 0, y: 0, direction: dir, frame, yOff, color: resolvedColor });
      }

      ctx.drawImage(
        tempCanvas,
        0, 0, DRAW_WIDTH, DRAW_HEIGHT,
        frame * PLAYER_WIDTH, dir * PLAYER_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT,
      );
    }
  }

  scene.textures.addSpriteSheet(
    key,
    canvas as unknown as HTMLImageElement,
    { frameWidth: PLAYER_WIDTH, frameHeight: PLAYER_HEIGHT },
  );

  return key;
}

/**
 * Parts 아바타 미리보기 Canvas 생성 (Phaser 불필요)
 *
 * 단일 프레임 or 지정 프레임 렌더링
 */
export function renderPartsPreview(
  config: PartsAvatarConfig,
  direction: number = 0,
  frame: number = 0,
  scale: number = 4,
): HTMLCanvasElement {
  ensureRegistered();

  const canvas = document.createElement("canvas");
  canvas.width = PLAYER_WIDTH * scale;
  canvas.height = PLAYER_HEIGHT * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // 스케일 적용
  ctx.imageSmoothingEnabled = false;

  // 32x48 임시 캔버스에 그린 뒤 스케일업
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = DRAW_WIDTH;
  tempCanvas.height = DRAW_HEIGHT;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return canvas;

  const yOff = WALK_OFFSETS[frame];

  for (const category of LAYER_ORDER) {
    const catKey = CATEGORY_KEY[category];
    const selected = config[catKey];
    if (typeof selected === "string") continue;

    const { partId, color } = selected;
    const drawer = getPartDrawer(partId);
    if (!drawer) continue;

    const def = getPartDefinition(partId);
    const resolvedColor = color ?? def?.defaultColor ?? "#888888";

    drawer({ ctx: tempCtx, x: 0, y: 0, direction, frame, yOff, color: resolvedColor });
  }

  // 스케일업
  ctx.drawImage(tempCanvas, 0, 0, DRAW_WIDTH, DRAW_HEIGHT, 0, 0, canvas.width, canvas.height);

  return canvas;
}
