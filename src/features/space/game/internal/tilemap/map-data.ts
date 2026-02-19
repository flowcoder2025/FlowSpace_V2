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

/** Ground 레이어: 전체 바닥 */
function createGroundLayer(): LayerData {
  const layer = createEmptyLayer();

  // 외곽: 잔디
  fillArea(layer, 0, 0, MAP_COLS, MAP_ROWS, TILE_INDEX.GRASS);

  // 건물 내부: 나무 바닥 (8,5 ~ 32,25)
  fillArea(layer, 8, 5, 24, 20, TILE_INDEX.WOOD_FLOOR);

  // 입구 앞 경로
  fillArea(layer, 18, 25, 4, 5, TILE_INDEX.PATH);

  // 건물 내 카펫 구역
  fillArea(layer, 14, 10, 12, 8, TILE_INDEX.CARPET);

  // 외부 돌바닥 (좌측 정원)
  fillArea(layer, 2, 10, 4, 8, TILE_INDEX.STONE_FLOOR);

  return layer;
}

/** Walls 레이어: 벽과 경계 */
function createWallsLayer(): LayerData {
  const layer = createEmptyLayer();

  // 건물 상단 벽 (row 4)
  fillArea(layer, 8, 4, 24, 1, TILE_INDEX.WALL_TOP);

  // 건물 좌측 벽 (col 7)
  fillArea(layer, 7, 5, 1, 20, TILE_INDEX.WALL_LEFT);

  // 건물 우측 벽 (col 32)
  fillArea(layer, 32, 5, 1, 20, TILE_INDEX.WALL_RIGHT);

  // 건물 하단 벽 (row 25) - 문 제외
  fillArea(layer, 8, 25, 10, 1, TILE_INDEX.WALL_BOTTOM);
  fillArea(layer, 22, 25, 10, 1, TILE_INDEX.WALL_BOTTOM);

  // 문
  layer[25][18] = TILE_INDEX.DOOR;
  layer[25][19] = TILE_INDEX.DOOR;
  layer[25][20] = TILE_INDEX.DOOR;
  layer[25][21] = TILE_INDEX.DOOR;

  // 코너
  layer[4][7] = TILE_INDEX.WALL_CORNER_TL;
  layer[4][32] = TILE_INDEX.WALL_CORNER_TR;
  layer[25][7] = TILE_INDEX.WALL_CORNER_BL;
  layer[25][32] = TILE_INDEX.WALL_CORNER_BR;

  // 내부 파티션 (가로 벽)
  fillArea(layer, 14, 9, 12, 1, TILE_INDEX.WALL_INNER);

  return layer;
}

/** Furniture 레이어: 가구 배치 */
function createFurnitureLayer(): LayerData {
  const layer = createEmptyLayer();

  // 좌상단 책상 구역
  layer[6][9] = TILE_INDEX.DESK;
  layer[6][10] = TILE_INDEX.DESK_RIGHT;
  layer[7][9] = TILE_INDEX.CHAIR;

  layer[6][12] = TILE_INDEX.DESK;
  layer[6][13] = TILE_INDEX.DESK_RIGHT;
  layer[7][12] = TILE_INDEX.CHAIR;

  // 우상단 책상 구역
  layer[6][27] = TILE_INDEX.DESK;
  layer[6][28] = TILE_INDEX.DESK_RIGHT;
  layer[7][27] = TILE_INDEX.CHAIR;

  layer[6][30] = TILE_INDEX.DESK;
  layer[6][31] = TILE_INDEX.DESK_RIGHT;
  layer[7][30] = TILE_INDEX.CHAIR;

  // 중앙 테이블
  layer[14][18] = TILE_INDEX.TABLE;
  layer[14][19] = TILE_INDEX.TABLE;

  // 소파 (좌측)
  layer[14][15] = TILE_INDEX.SOFA;
  layer[14][16] = TILE_INDEX.SOFA_RIGHT;

  // 우측 책장
  layer[5][31] = TILE_INDEX.BOOKSHELF;
  layer[6][31] = TILE_INDEX.BOOKSHELF_BOTTOM;

  // 하단 영역 가구
  layer[20][10] = TILE_INDEX.CABINET;
  layer[22][10] = TILE_INDEX.BED_TOP;
  layer[23][10] = TILE_INDEX.BED_BOTTOM;

  layer[20][28] = TILE_INDEX.CABINET;
  layer[22][28] = TILE_INDEX.BED_TOP;
  layer[23][28] = TILE_INDEX.BED_BOTTOM;

  return layer;
}

/** Furniture Top 레이어: 가구 위 소품 */
function createFurnitureTopLayer(): LayerData {
  const layer = createEmptyLayer();

  // 모니터 on 책상
  layer[5][9] = TILE_INDEX.MONITOR;
  layer[5][12] = TILE_INDEX.MONITOR;
  layer[5][27] = TILE_INDEX.MONITOR;
  layer[5][30] = TILE_INDEX.MONITOR;

  // 테이블 위 책+컵
  layer[13][18] = TILE_INDEX.BOOK;
  layer[13][19] = TILE_INDEX.CUP;

  // 화분
  layer[5][14] = TILE_INDEX.PLANT;
  layer[5][25] = TILE_INDEX.PLANT;

  // 램프
  layer[19][10] = TILE_INDEX.LAMP;

  return layer;
}

/** Decorations 레이어: 외부 장식 */
function createDecorationsLayer(): LayerData {
  const layer = createEmptyLayer();

  // 나무 (외부 좌측)
  layer[2][2] = TILE_INDEX.TREE_TOP;
  layer[3][2] = TILE_INDEX.TREE_BOTTOM;

  layer[2][5] = TILE_INDEX.TREE_TOP;
  layer[3][5] = TILE_INDEX.TREE_BOTTOM;

  // 나무 (외부 우측)
  layer[2][35] = TILE_INDEX.TREE_TOP;
  layer[3][35] = TILE_INDEX.TREE_BOTTOM;

  layer[2][38] = TILE_INDEX.TREE_TOP;
  layer[3][38] = TILE_INDEX.TREE_BOTTOM;

  // 꽃
  layer[8][3] = TILE_INDEX.FLOWER;
  layer[8][4] = TILE_INDEX.FLOWER;

  // 덤불
  layer[27][5] = TILE_INDEX.BUSH;
  layer[27][34] = TILE_INDEX.BUSH;

  // 바위
  layer[15][2] = TILE_INDEX.ROCK;
  layer[20][36] = TILE_INDEX.ROCK;

  // 벤치
  layer[28][14] = TILE_INDEX.BENCH;
  layer[28][24] = TILE_INDEX.BENCH;

  // 표지판
  layer[26][16] = TILE_INDEX.SIGN;

  // 분수대 (외부 중앙 하단)
  layer[27][19] = TILE_INDEX.FOUNTAIN_TOP;
  layer[28][19] = TILE_INDEX.FOUNTAIN_BOTTOM;

  // 스폰 포인트
  layer[28][20] = TILE_INDEX.SPAWN;

  // 포털
  layer[14][3] = TILE_INDEX.PORTAL;

  return layer;
}

/** Collision 레이어: 충돌 영역 표시 */
function createCollisionLayer(): LayerData {
  const layer = createEmptyLayer();
  const C = TILE_INDEX.COLLISION;

  // 건물 벽 충돌
  fillArea(layer, 7, 4, 26, 1, C); // 상단
  fillArea(layer, 7, 5, 1, 21, C); // 좌측
  fillArea(layer, 32, 5, 1, 21, C); // 우측
  // 하단 (문 제외)
  fillArea(layer, 8, 25, 10, 1, C);
  fillArea(layer, 22, 25, 10, 1, C);

  // 내부 파티션
  fillArea(layer, 14, 9, 12, 1, C);

  // 가구 충돌
  // 책상
  layer[6][9] = C;
  layer[6][10] = C;
  layer[6][12] = C;
  layer[6][13] = C;
  layer[6][27] = C;
  layer[6][28] = C;
  layer[6][30] = C;
  layer[6][31] = C;

  // 테이블
  layer[14][18] = C;
  layer[14][19] = C;

  // 소파
  layer[14][15] = C;
  layer[14][16] = C;

  // 책장
  layer[5][31] = C;
  layer[6][31] = C;

  // 캐비넷, 침대
  layer[20][10] = C;
  layer[22][10] = C;
  layer[23][10] = C;
  layer[20][28] = C;
  layer[22][28] = C;
  layer[23][28] = C;

  // 외부 나무
  layer[3][2] = C;
  layer[3][5] = C;
  layer[3][35] = C;
  layer[3][38] = C;

  // 바위
  layer[15][2] = C;
  layer[20][36] = C;

  // 분수대
  layer[27][19] = C;
  layer[28][19] = C;

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
