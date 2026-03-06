/**
 * Map Data - 40x30 그리드 레이어 데이터
 *
 * 6개 레이어: ground, walls, furniture, furniture_top, decorations, collision
 * -1 = 빈 타일
 */

import { MAP_COLS, MAP_ROWS } from "@/constants/game-constants";
import { TILE_INDEX } from "./tileset-generator";

type LayerData = number[][];

/** 빈 레이어 생성 (MAP_ROWS x MAP_COLS, -1 채움) */
export function createEmptyLayer(): LayerData {
  return Array.from({ length: MAP_ROWS }, () =>
    Array.from({ length: MAP_COLS }, () => -1)
  );
}

/** 범위 채우기 유틸 */
function fillArea(
  layer: LayerData,
  startCol: number,
  startRow: number,
  width: number,
  height: number,
  tileIndex: number
): void {
  for (let r = startRow; r < startRow + height && r < MAP_ROWS; r++) {
    for (let c = startCol; c < startCol + width && c < MAP_COLS; c++) {
      layer[r][c] = tileIndex;
    }
  }
}

/** Ground 레이어: 영역별 바닥 */
function createGroundLayer(): LayerData {
  const layer = createEmptyLayer();
  // 전체 나무 바닥
  fillArea(layer, 0, 0, MAP_COLS, MAP_ROWS, TILE_INDEX.WOOD_FLOOR);
  // 우측 라운지 영역: 카펫 (col 23~38, row 3~15)
  fillArea(layer, 23, 3, 16, 13, TILE_INDEX.CARPET);
  return layer;
}

/** Walls 레이어: 상단/좌우 벽 + 영역 파티션 */
function createWallsLayer(): LayerData {
  const layer = createEmptyLayer();
  // 상단 벽
  fillArea(layer, 1, 1, MAP_COLS - 2, 1, TILE_INDEX.WALL_TOP);
  // 좌측 벽
  fillArea(layer, 1, 2, 1, MAP_ROWS - 3, TILE_INDEX.WALL_LEFT);
  // 우측 벽
  fillArea(layer, MAP_COLS - 2, 2, 1, MAP_ROWS - 3, TILE_INDEX.WALL_RIGHT);
  // 영역 구분 파티션 (업무-라운지 사이, col 22, row 3~15)
  fillArea(layer, 22, 3, 1, 13, TILE_INDEX.WALL_INNER);
  return layer;
}

/** Furniture 레이어: 가구 배치 (현재 비어 있음 — 오브젝트 시스템으로 이전 예정) */
function createFurnitureLayer(): LayerData {
  return createEmptyLayer();
}

/** Furniture Top 레이어: 가구 위 소품 (현재 비어 있음) */
function createFurnitureTopLayer(): LayerData {
  return createEmptyLayer();
}

/** Decorations 레이어: 외부 장식 (현재 비어 있음) */
function createDecorationsLayer(): LayerData {
  return createEmptyLayer();
}

/** Collision 레이어: 맵 경계만 */
function createCollisionLayer(): LayerData {
  const layer = createEmptyLayer();
  const C = TILE_INDEX.COLLISION;

  // 맵 외곽 경계 (플레이어가 맵 밖으로 나가지 않도록)
  fillArea(layer, 0, 0, MAP_COLS, 1, C); // 상단
  fillArea(layer, 0, MAP_ROWS - 1, MAP_COLS, 1, C); // 하단
  fillArea(layer, 0, 0, 1, MAP_ROWS, C); // 좌측
  fillArea(layer, MAP_COLS - 1, 0, 1, MAP_ROWS, C); // 우측

  return layer;
}

/** 레이어 이름 */
export const LAYER_NAMES = {
  GROUND: "ground",
  WALLS: "walls",
  FURNITURE: "furniture",
  FURNITURE_TOP: "furniture_top",
  DECORATIONS: "decorations",
  COLLISION: "collision",
} as const;

/** 충돌 레이어 이름 목록 */
export const COLLISION_LAYER_NAMES = [
  LAYER_NAMES.WALLS,
  LAYER_NAMES.FURNITURE,
  LAYER_NAMES.COLLISION,
] as const;

export interface MapLayerDefinition {
  name: string;
  data: LayerData;
  depth: number;
  hasCollision: boolean;
}

/** 모든 레이어 데이터 생성 (기본 맵) */
export function createMapLayers(): MapLayerDefinition[] {
  return [
    { name: LAYER_NAMES.GROUND, data: createGroundLayer(), depth: 0, hasCollision: false },
    { name: LAYER_NAMES.WALLS, data: createWallsLayer(), depth: 10, hasCollision: true },
    { name: LAYER_NAMES.FURNITURE, data: createFurnitureLayer(), depth: 20, hasCollision: true },
    { name: LAYER_NAMES.FURNITURE_TOP, data: createFurnitureTopLayer(), depth: 25, hasCollision: false },
    { name: LAYER_NAMES.DECORATIONS, data: createDecorationsLayer(), depth: 30, hasCollision: false },
    { name: LAYER_NAMES.COLLISION, data: createCollisionLayer(), depth: -1, hasCollision: true },
  ];
}

/** 레이어 이름 → depth/collision 매핑 */
const LAYER_META: Record<string, { depth: number; hasCollision: boolean }> = {
  [LAYER_NAMES.GROUND]: { depth: 0, hasCollision: false },
  [LAYER_NAMES.WALLS]: { depth: 10, hasCollision: true },
  [LAYER_NAMES.FURNITURE]: { depth: 20, hasCollision: true },
  [LAYER_NAMES.FURNITURE_TOP]: { depth: 25, hasCollision: false },
  [LAYER_NAMES.DECORATIONS]: { depth: 30, hasCollision: false },
  [LAYER_NAMES.COLLISION]: { depth: -1, hasCollision: true },
};

/** 저장된 맵 데이터에서 레이어 생성 (DB 데이터 → MapLayerDefinition[]) */
export function createMapLayersFromStored(
  stored: Record<string, number[][]>
): MapLayerDefinition[] {
  const layerOrder = [
    LAYER_NAMES.GROUND,
    LAYER_NAMES.WALLS,
    LAYER_NAMES.FURNITURE,
    LAYER_NAMES.FURNITURE_TOP,
    LAYER_NAMES.DECORATIONS,
    LAYER_NAMES.COLLISION,
  ] as string[];

  return layerOrder.map((name) => {
    const meta = LAYER_META[name] ?? { depth: 0, hasCollision: false };
    const data = stored[name] ?? createEmptyLayer();
    return { name, data, depth: meta.depth, hasCollision: meta.hasCollision };
  });
}

/** 현재 기본 맵을 저장 가능한 형식으로 추출 */
export function extractDefaultMapData(): Record<string, number[][]> {
  const layers = createMapLayers();
  const result: Record<string, number[][]> = {};
  for (const layer of layers) {
    result[layer.name] = layer.data;
  }
  return result;
}
