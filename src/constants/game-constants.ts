/** 게임 엔진 상수 (32px 타일 기반) */

// Tile
export const TILE_SIZE = 32;

// Map (40x30 그리드 = 1280x960 월드)
export const MAP_COLS = 40;
export const MAP_ROWS = 30;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

// Player
export const PLAYER_WIDTH = 96;
export const PLAYER_HEIGHT = 128;
export const PLAYER_SCALE = 0.35; // 표시 크기: 34x45 (ZEP/게더타운 수준)
export const NAME_OFFSET_Y = -(PLAYER_HEIGHT * PLAYER_SCALE) / 2 - 8; // 캐릭터 상단 위 여백

// Grid movement
export const TILE_STEP_DURATION = 130; // ms, 타일 1칸 이동 시간
export const TILE_HALF = TILE_SIZE / 2; // 16px, 타일 중심 오프셋

// Sprite
export const SPRITE_COLS = 4;
export const SPRITE_ROWS = 4;

// Depth layers (z-index)
export const DEPTH = {
  GROUND: 0,
  WALLS: 10,
  FURNITURE: 20,
  FURNITURE_TOP: 25,
  OBJECTS: 30,
  PLAYER: 40,
  PLAYER_NAME: 45,
  UI: 50,
  EDITOR_GRID: 55,
  EDITOR_CURSOR: 56,
} as const;

// Tileset
export const TILESET_COLS = 16;
export const TILESET_ROWS = 14;
export const TILESET_WIDTH = TILESET_COLS * TILE_SIZE; // 512
export const TILESET_HEIGHT = TILESET_ROWS * TILE_SIZE; // 448

// Interaction
export const INTERACT_DISTANCE = 48;

// Camera
export const CAMERA_LERP = 0.1;
export const CAMERA_DEADZONE_X = 100;
export const CAMERA_DEADZONE_Y = 80;

// Scene keys
export const SCENE_KEYS = {
  BOOT: "BootScene",
  MAIN: "MainScene",
} as const;
