/**
 * Tilemap System
 *
 * Phaser Tilemap 생성 + 레이어 구성 + 충돌 설정
 */

import { TILE_SIZE, MAP_COLS, MAP_ROWS, MAP_WIDTH, MAP_HEIGHT } from "@/constants/game-constants";
import { generateTileset, TILESET_KEY } from "./tileset-generator";
import { createMapLayers, COLLISION_LAYER_NAMES, type MapLayerDefinition } from "./map-data";

const TILEMAP_KEY = "main-map";
const TILESET_NAME = "main-tileset";

export interface TilemapResult {
  tilemap: Phaser.Tilemaps.Tilemap;
  layers: Map<string, Phaser.Tilemaps.TilemapLayer>;
  collisionLayers: Phaser.Tilemaps.TilemapLayer[];
}

/**
 * Tilemap 시스템 초기화
 *
 * 1. 프로시저럴 타일셋 생성
 * 2. Tilemap 생성 (make.tilemap)
 * 3. 레이어 생성 + 데이터 채우기
 * 4. 충돌 레이어 설정
 */
export function createTilemapSystem(scene: Phaser.Scene): TilemapResult {
  // 1. 타일셋 텍스처 생성
  generateTileset(scene);

  // 2. Tilemap 생성
  const tilemap = scene.make.tilemap({
    key: TILEMAP_KEY,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
    width: MAP_COLS,
    height: MAP_ROWS,
    insertNull: true,
  });

  // 3. 타일셋 이미지 연결
  const tileset = tilemap.addTilesetImage(TILESET_NAME, TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
  if (!tileset) {
    throw new Error("Failed to add tileset image");
  }

  // 4. 레이어 생성
  const layerDefs = createMapLayers();
  const layers = new Map<string, Phaser.Tilemaps.TilemapLayer>();
  const collisionLayers: Phaser.Tilemaps.TilemapLayer[] = [];

  for (const def of layerDefs) {
    const layer = createLayer(tilemap, tileset, def);
    if (layer) {
      layers.set(def.name, layer);

      if (def.hasCollision) {
        collisionLayers.push(layer);
      }
    }
  }

  return { tilemap, layers, collisionLayers };
}

/** 단일 레이어 생성 + 데이터 채우기 */
function createLayer(
  tilemap: Phaser.Tilemaps.Tilemap,
  tileset: Phaser.Tilemaps.Tileset,
  def: MapLayerDefinition
): Phaser.Tilemaps.TilemapLayer | null {
  const layer = tilemap.createBlankLayer(def.name, tileset, 0, 0, MAP_COLS, MAP_ROWS, TILE_SIZE, TILE_SIZE);
  if (!layer) return null;

  // 데이터 채우기
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      const tileIndex = def.data[row][col];
      if (tileIndex >= 0) {
        layer.putTileAt(tileIndex, col, row);
      }
    }
  }

  // 깊이 설정 (collision 레이어는 숨김)
  if (def.depth < 0) {
    layer.setVisible(false);
  } else {
    layer.setDepth(def.depth);
  }

  // 충돌 설정
  if (def.hasCollision) {
    layer.setCollisionByExclusion([-1]);
  }

  return layer;
}

/** 월드 바운드 반환 */
export function getWorldBounds(): { width: number; height: number } {
  return { width: MAP_WIDTH, height: MAP_HEIGHT };
}

/** 충돌 레이어 이름 목록 (외부 참조용) */
export { COLLISION_LAYER_NAMES };
