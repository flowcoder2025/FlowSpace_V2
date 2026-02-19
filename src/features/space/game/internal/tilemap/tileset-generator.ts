/**
 * Procedural Tileset Generator
 *
 * Canvas API로 512x448 타일셋 텍스처를 생성합니다.
 * flow_metaverse의 타일셋 생성 로직을 포팅.
 */

import {
  TILE_SIZE,
  TILESET_WIDTH,
  TILESET_HEIGHT,
  TILESET_COLS,
} from "@/constants/game-constants";

export const TILESET_KEY = "procedural-tileset";

/** 타일 인덱스별 역할 정의 */
export const TILE_INDEX = {
  // Ground (row 0-1)
  GRASS: 0,
  GRASS_DARK: 1,
  STONE_FLOOR: 2,
  WOOD_FLOOR: 3,
  CARPET: 4,
  SAND: 5,
  WATER: 6,
  PATH: 7,

  // Walls (row 2-3)
  WALL_TOP: 32,
  WALL_MID: 33,
  WALL_BOTTOM: 34,
  WALL_LEFT: 35,
  WALL_RIGHT: 36,
  WALL_CORNER_TL: 37,
  WALL_CORNER_TR: 38,
  WALL_CORNER_BL: 39,
  WALL_CORNER_BR: 40,
  WALL_INNER: 41,
  DOOR: 42,

  // Furniture (row 4-5)
  DESK: 64,
  DESK_RIGHT: 65,
  CHAIR: 66,
  BOOKSHELF: 67,
  BOOKSHELF_BOTTOM: 68,
  SOFA: 69,
  SOFA_RIGHT: 70,
  TABLE: 71,
  CABINET: 72,
  BED_TOP: 73,
  BED_BOTTOM: 74,

  // Furniture tops (row 6)
  MONITOR: 96,
  PLANT: 97,
  LAMP: 98,
  BOOK: 99,
  CUP: 100,

  // Decorations (row 7-8)
  TREE_TOP: 112,
  TREE_BOTTOM: 113,
  FLOWER: 114,
  BUSH: 115,
  ROCK: 116,
  SIGN: 117,
  BENCH: 118,
  FOUNTAIN_TOP: 119,
  FOUNTAIN_BOTTOM: 120,

  // Interactive (row 9)
  PORTAL: 144,
  SPAWN: 145,
  CHEST: 146,
  NPC: 147,

  // Collision marker (invisible but used for collision layer)
  COLLISION: 208,
} as const;

interface TileDrawer {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  s: number;
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  drawFn: (d: TileDrawer) => void
): void {
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  drawFn({ ctx, x, y, s: TILE_SIZE });
}

function fillRect(
  d: TileDrawer,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  color: string
): void {
  d.ctx.fillStyle = color;
  d.ctx.fillRect(d.x + rx, d.y + ry, rw, rh);
}

function fillTile(d: TileDrawer, color: string): void {
  fillRect(d, 0, 0, d.s, d.s, color);
}

/** Canvas에 프로시저럴 타일셋 그리기 */
function drawTileset(ctx: CanvasRenderingContext2D): void {
  // Background transparent
  ctx.clearRect(0, 0, TILESET_WIDTH, TILESET_HEIGHT);

  // === Row 0-1: Ground tiles ===
  // Grass
  drawTile(ctx, 0, 0, (d) => {
    fillTile(d, "#4a8c50");
    // Grass detail
    for (let i = 0; i < 8; i++) {
      const gx = (i * 7 + 3) % 28;
      const gy = (i * 11 + 5) % 28;
      fillRect(d, gx, gy, 2, 3, "#5a9c60");
    }
  });

  // Dark grass
  drawTile(ctx, 1, 0, (d) => {
    fillTile(d, "#3a7c40");
    for (let i = 0; i < 6; i++) {
      fillRect(d, (i * 9 + 2) % 28, (i * 7 + 4) % 28, 2, 3, "#4a8c50");
    }
  });

  // Stone floor
  drawTile(ctx, 2, 0, (d) => {
    fillTile(d, "#8c8c8c");
    fillRect(d, 0, 0, 16, 16, "#949494");
    fillRect(d, 16, 16, 16, 16, "#949494");
    // Grid lines
    d.ctx.fillStyle = "#7c7c7c";
    d.ctx.fillRect(d.x, d.y + 15, d.s, 2);
    d.ctx.fillRect(d.x + 15, d.y, 2, d.s);
  });

  // Wood floor
  drawTile(ctx, 3, 0, (d) => {
    fillTile(d, "#b08050");
    for (let i = 0; i < 4; i++) {
      fillRect(d, 0, i * 8, d.s, 1, "#9a7040");
    }
    fillRect(d, 14, 0, 1, d.s, "#9a7040");
  });

  // Carpet
  drawTile(ctx, 4, 0, (d) => {
    fillTile(d, "#8c3030");
    fillRect(d, 2, 2, 28, 28, "#9c4040");
    fillRect(d, 4, 4, 24, 24, "#8c3030");
  });

  // Sand
  drawTile(ctx, 5, 0, (d) => {
    fillTile(d, "#d4b06a");
    for (let i = 0; i < 5; i++) {
      fillRect(d, (i * 11 + 3) % 28, (i * 7 + 2) % 28, 3, 2, "#c4a05a");
    }
  });

  // Water
  drawTile(ctx, 6, 0, (d) => {
    fillTile(d, "#3060a0");
    fillRect(d, 4, 8, 8, 2, "#4070b0");
    fillRect(d, 18, 18, 10, 2, "#4070b0");
  });

  // Path
  drawTile(ctx, 7, 0, (d) => {
    fillTile(d, "#c0a070");
    fillRect(d, 2, 0, 28, d.s, "#b09060");
  });

  // === Row 2-3: Walls ===
  // Wall top
  drawTile(ctx, 0, 2, (d) => {
    fillTile(d, "#606080");
    fillRect(d, 0, 24, d.s, 8, "#505070");
  });

  // Wall mid
  drawTile(ctx, 1, 2, (d) => {
    fillTile(d, "#505070");
    fillRect(d, 0, 0, d.s, 2, "#606080");
  });

  // Wall bottom
  drawTile(ctx, 2, 2, (d) => {
    fillTile(d, "#505070");
    fillRect(d, 0, 0, d.s, 4, "#606080");
    fillRect(d, 0, 28, d.s, 4, "#404060");
  });

  // Wall left
  drawTile(ctx, 3, 2, (d) => {
    fillTile(d, "#505070");
    fillRect(d, 0, 0, 4, d.s, "#606080");
  });

  // Wall right
  drawTile(ctx, 4, 2, (d) => {
    fillTile(d, "#505070");
    fillRect(d, 28, 0, 4, d.s, "#606080");
  });

  // Corner TL
  drawTile(ctx, 5, 2, (d) => {
    fillTile(d, "#606080");
    fillRect(d, 0, 0, 4, d.s, "#707090");
    fillRect(d, 0, 0, d.s, 4, "#707090");
  });

  // Corner TR
  drawTile(ctx, 6, 2, (d) => {
    fillTile(d, "#606080");
    fillRect(d, 28, 0, 4, d.s, "#707090");
    fillRect(d, 0, 0, d.s, 4, "#707090");
  });

  // Corner BL
  drawTile(ctx, 7, 2, (d) => {
    fillTile(d, "#606080");
    fillRect(d, 0, 0, 4, d.s, "#707090");
    fillRect(d, 0, 28, d.s, 4, "#707090");
  });

  // Corner BR
  drawTile(ctx, 8, 2, (d) => {
    fillTile(d, "#606080");
    fillRect(d, 28, 0, 4, d.s, "#707090");
    fillRect(d, 0, 28, d.s, 4, "#707090");
  });

  // Wall inner
  drawTile(ctx, 9, 2, (d) => {
    fillTile(d, "#484868");
  });

  // Door
  drawTile(ctx, 10, 2, (d) => {
    fillTile(d, "#8a6030");
    fillRect(d, 2, 0, 28, 30, "#9a7040");
    fillRect(d, 22, 14, 4, 4, "#d4a030"); // doorknob
  });

  // === Row 4-5: Furniture ===
  // Desk left
  drawTile(ctx, 0, 4, (d) => {
    fillTile(d, "#1a1a2e"); // transparent bg
    fillRect(d, 0, 4, 32, 24, "#8a6030");
    fillRect(d, 2, 6, 28, 20, "#9a7040");
    fillRect(d, 2, 28, 4, 4, "#7a5020");
  });

  // Desk right
  drawTile(ctx, 1, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 0, 4, 32, 24, "#8a6030");
    fillRect(d, 2, 6, 28, 20, "#9a7040");
    fillRect(d, 26, 28, 4, 4, "#7a5020");
  });

  // Chair
  drawTile(ctx, 2, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 8, 2, 16, 4, "#8a6030"); // back
    fillRect(d, 6, 14, 20, 14, "#9a7040"); // seat
    fillRect(d, 6, 28, 4, 4, "#7a5020"); // legs
    fillRect(d, 22, 28, 4, 4, "#7a5020");
  });

  // Bookshelf top
  drawTile(ctx, 3, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 32, "#6a4020");
    fillRect(d, 4, 2, 8, 12, "#c04040"); // book
    fillRect(d, 14, 2, 6, 12, "#4040c0");
    fillRect(d, 22, 2, 6, 12, "#40a040");
    fillRect(d, 4, 18, 10, 12, "#c0a040");
    fillRect(d, 16, 18, 12, 12, "#a040a0");
  });

  // Bookshelf bottom
  drawTile(ctx, 4, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 32, "#6a4020");
    fillRect(d, 4, 2, 10, 12, "#4080c0");
    fillRect(d, 16, 2, 12, 12, "#c06040");
    fillRect(d, 4, 18, 24, 12, "#8a6030");
  });

  // Sofa left
  drawTile(ctx, 5, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 0, 6, 32, 22, "#6040a0");
    fillRect(d, 2, 0, 8, 28, "#7050b0"); // armrest
    fillRect(d, 10, 10, 22, 14, "#8060c0"); // cushion
  });

  // Sofa right
  drawTile(ctx, 6, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 0, 6, 32, 22, "#6040a0");
    fillRect(d, 22, 0, 8, 28, "#7050b0"); // armrest
    fillRect(d, 0, 10, 22, 14, "#8060c0"); // cushion
  });

  // Table
  drawTile(ctx, 7, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 8, 28, 20, "#b08050");
    fillRect(d, 4, 10, 24, 16, "#c09060");
  });

  // Cabinet
  drawTile(ctx, 8, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 32, "#7a5a30");
    fillRect(d, 4, 2, 12, 14, "#8a6a40");
    fillRect(d, 18, 2, 10, 14, "#8a6a40");
    fillRect(d, 4, 18, 24, 12, "#8a6a40");
    fillRect(d, 14, 8, 4, 4, "#d4a030"); // handle
  });

  // Bed top
  drawTile(ctx, 9, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 32, "#5a3a20");
    fillRect(d, 4, 4, 24, 26, "#e0e0f0"); // pillow
    fillRect(d, 6, 6, 8, 10, "#c0c0e0");
    fillRect(d, 18, 6, 8, 10, "#c0c0e0");
  });

  // Bed bottom
  drawTile(ctx, 10, 4, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 32, "#5a3a20");
    fillRect(d, 4, 0, 24, 28, "#6080c0"); // blanket
    fillRect(d, 4, 28, 4, 4, "#4a2a10");
    fillRect(d, 24, 28, 4, 4, "#4a2a10");
  });

  // === Row 6: Furniture tops ===
  // Monitor
  drawTile(ctx, 0, 6, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 2, 24, 18, "#303040");
    fillRect(d, 6, 4, 20, 14, "#4060a0"); // screen
    fillRect(d, 12, 20, 8, 4, "#303040");
    fillRect(d, 8, 24, 16, 3, "#303040");
  });

  // Plant
  drawTile(ctx, 1, 6, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 10, 20, 12, 12, "#8a5030"); // pot
    fillRect(d, 8, 4, 16, 18, "#40a040"); // leaves
    fillRect(d, 12, 8, 8, 8, "#50b050");
  });

  // Lamp
  drawTile(ctx, 2, 6, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 14, 12, 4, 18, "#808080"); // pole
    fillRect(d, 8, 2, 16, 12, "#f0d060"); // shade
    fillRect(d, 12, 30, 8, 2, "#808080"); // base
  });

  // Book
  drawTile(ctx, 3, 6, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 8, 10, 16, 14, "#c04040");
    fillRect(d, 10, 12, 12, 10, "#e0d0a0"); // pages
  });

  // Cup
  drawTile(ctx, 4, 6, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 10, 12, 12, 16, "#e0e0e0");
    fillRect(d, 12, 14, 8, 12, "#804020"); // coffee
    fillRect(d, 22, 18, 4, 8, "#e0e0e0"); // handle
  });

  // === Row 7-8: Decorations ===
  // Tree top
  drawTile(ctx, 0, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 4, 24, 24, "#2a7030");
    fillRect(d, 8, 0, 16, 20, "#3a8040");
    fillRect(d, 12, 2, 8, 8, "#4a9050");
  });

  // Tree bottom
  drawTile(ctx, 1, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 0, 24, 16, "#2a7030");
    fillRect(d, 12, 8, 8, 24, "#6a4020"); // trunk
    fillRect(d, 14, 10, 4, 22, "#7a5030");
  });

  // Flower
  drawTile(ctx, 2, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 14, 16, 4, 14, "#40a040"); // stem
    fillRect(d, 8, 6, 16, 12, "#e06060"); // petals
    fillRect(d, 12, 10, 8, 4, "#f0e040"); // center
  });

  // Bush
  drawTile(ctx, 3, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 8, 28, 22, "#3a8040");
    fillRect(d, 6, 4, 20, 16, "#4a9050");
  });

  // Rock
  drawTile(ctx, 4, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 10, 24, 20, "#707070");
    fillRect(d, 8, 6, 16, 14, "#808080");
    fillRect(d, 12, 8, 8, 6, "#909090");
  });

  // Sign
  drawTile(ctx, 5, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 14, 16, 4, 16, "#6a4020"); // post
    fillRect(d, 4, 2, 24, 16, "#8a6030"); // board
    fillRect(d, 6, 4, 20, 12, "#9a7040");
  });

  // Bench
  drawTile(ctx, 6, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 0, 12, 32, 10, "#8a6030");
    fillRect(d, 2, 14, 28, 6, "#9a7040");
    fillRect(d, 2, 22, 4, 8, "#6a4020");
    fillRect(d, 26, 22, 4, 8, "#6a4020");
  });

  // Fountain top
  drawTile(ctx, 7, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 8, 8, 16, 24, "#909090");
    fillRect(d, 12, 0, 8, 16, "#70a0d0"); // water spray
    fillRect(d, 14, 4, 4, 8, "#90c0e0");
  });

  // Fountain bottom
  drawTile(ctx, 8, 7, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 2, 0, 28, 28, "#909090");
    fillRect(d, 4, 2, 24, 24, "#5080b0"); // water
    fillRect(d, 6, 4, 20, 20, "#6090c0");
  });

  // === Row 9: Interactive ===
  // Portal
  drawTile(ctx, 0, 9, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 2, 24, 28, "#6030a0");
    fillRect(d, 8, 6, 16, 20, "#8050c0");
    fillRect(d, 12, 10, 8, 12, "#a070e0");
  });

  // Spawn
  drawTile(ctx, 1, 9, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 4, 24, 24, "#30a060");
    fillRect(d, 8, 8, 16, 16, "#40c070");
    fillRect(d, 12, 12, 8, 8, "#60e090");
  });

  // Chest
  drawTile(ctx, 2, 9, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 4, 8, 24, 20, "#8a6030");
    fillRect(d, 6, 10, 20, 16, "#9a7040");
    fillRect(d, 12, 14, 8, 4, "#d4a030"); // lock
  });

  // NPC
  drawTile(ctx, 3, 9, (d) => {
    fillTile(d, "#1a1a2e");
    fillRect(d, 10, 2, 12, 12, "#f0c090"); // head
    fillRect(d, 8, 14, 16, 16, "#4060c0"); // body
    fillRect(d, 8, 30, 6, 2, "#3a3a3a"); // feet
    fillRect(d, 18, 30, 6, 2, "#3a3a3a");
  });

  // === Row 13: Collision marker (invisible) ===
  drawTile(ctx, 0, 13, (d) => {
    fillTile(d, "rgba(255, 0, 0, 0.01)"); // nearly invisible
  });
}

/**
 * 프로시저럴 타일셋 텍스처를 Phaser에 등록
 *
 * @param scene - Phaser.Scene (textures.addCanvas 사용)
 */
export function generateTileset(scene: Phaser.Scene): void {
  if (scene.textures.exists(TILESET_KEY)) return;

  const canvas = document.createElement("canvas");
  canvas.width = TILESET_WIDTH;
  canvas.height = TILESET_HEIGHT;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  drawTileset(ctx);
  scene.textures.addCanvas(TILESET_KEY, canvas);
}

/** 타일 인덱스 → (col, row) 변환 */
export function tileIndexToPos(index: number): { col: number; row: number } {
  return {
    col: index % TILESET_COLS,
    row: Math.floor(index / TILESET_COLS),
  };
}
