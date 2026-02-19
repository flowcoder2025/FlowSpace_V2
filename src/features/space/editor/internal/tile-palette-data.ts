/** 타일 팔레트 데이터 - TILE_INDEX 기반 카테고리별 타일 목록 */

import { TILE_INDEX } from "@/features/space/game/internal/tilemap/tileset-generator";
import type { TilePaletteItem } from "./types";

export const TILE_PALETTE: TilePaletteItem[] = [
  // Ground
  { index: TILE_INDEX.GRASS, name: "Grass", category: "ground" },
  { index: TILE_INDEX.GRASS_DARK, name: "Dark Grass", category: "ground" },
  { index: TILE_INDEX.STONE_FLOOR, name: "Stone Floor", category: "ground" },
  { index: TILE_INDEX.WOOD_FLOOR, name: "Wood Floor", category: "ground" },
  { index: TILE_INDEX.CARPET, name: "Carpet", category: "ground" },
  { index: TILE_INDEX.SAND, name: "Sand", category: "ground" },
  { index: TILE_INDEX.WATER, name: "Water", category: "ground" },
  { index: TILE_INDEX.PATH, name: "Path", category: "ground" },

  // Walls
  { index: TILE_INDEX.WALL_TOP, name: "Wall Top", category: "walls" },
  { index: TILE_INDEX.WALL_MID, name: "Wall Mid", category: "walls" },
  { index: TILE_INDEX.WALL_BOTTOM, name: "Wall Bottom", category: "walls" },
  { index: TILE_INDEX.WALL_LEFT, name: "Wall Left", category: "walls" },
  { index: TILE_INDEX.WALL_RIGHT, name: "Wall Right", category: "walls" },
  { index: TILE_INDEX.WALL_CORNER_TL, name: "Corner TL", category: "walls" },
  { index: TILE_INDEX.WALL_CORNER_TR, name: "Corner TR", category: "walls" },
  { index: TILE_INDEX.WALL_CORNER_BL, name: "Corner BL", category: "walls" },
  { index: TILE_INDEX.WALL_CORNER_BR, name: "Corner BR", category: "walls" },
  { index: TILE_INDEX.WALL_INNER, name: "Inner Wall", category: "walls" },
  { index: TILE_INDEX.DOOR, name: "Door", category: "walls" },

  // Furniture
  { index: TILE_INDEX.DESK, name: "Desk", category: "furniture" },
  { index: TILE_INDEX.DESK_RIGHT, name: "Desk Right", category: "furniture" },
  { index: TILE_INDEX.CHAIR, name: "Chair", category: "furniture" },
  { index: TILE_INDEX.BOOKSHELF, name: "Bookshelf", category: "furniture" },
  { index: TILE_INDEX.BOOKSHELF_BOTTOM, name: "Bookshelf Bottom", category: "furniture" },
  { index: TILE_INDEX.SOFA, name: "Sofa", category: "furniture" },
  { index: TILE_INDEX.SOFA_RIGHT, name: "Sofa Right", category: "furniture" },
  { index: TILE_INDEX.TABLE, name: "Table", category: "furniture" },
  { index: TILE_INDEX.CABINET, name: "Cabinet", category: "furniture" },
  { index: TILE_INDEX.BED_TOP, name: "Bed Top", category: "furniture" },
  { index: TILE_INDEX.BED_BOTTOM, name: "Bed Bottom", category: "furniture" },

  // Furniture Tops
  { index: TILE_INDEX.MONITOR, name: "Monitor", category: "furniture_top" },
  { index: TILE_INDEX.PLANT, name: "Plant", category: "furniture_top" },
  { index: TILE_INDEX.LAMP, name: "Lamp", category: "furniture_top" },
  { index: TILE_INDEX.BOOK, name: "Book", category: "furniture_top" },
  { index: TILE_INDEX.CUP, name: "Cup", category: "furniture_top" },

  // Decorations
  { index: TILE_INDEX.TREE_TOP, name: "Tree Top", category: "decorations" },
  { index: TILE_INDEX.TREE_BOTTOM, name: "Tree Bottom", category: "decorations" },
  { index: TILE_INDEX.FLOWER, name: "Flower", category: "decorations" },
  { index: TILE_INDEX.BUSH, name: "Bush", category: "decorations" },
  { index: TILE_INDEX.ROCK, name: "Rock", category: "decorations" },
  { index: TILE_INDEX.SIGN, name: "Sign", category: "decorations" },
  { index: TILE_INDEX.BENCH, name: "Bench", category: "decorations" },
  { index: TILE_INDEX.FOUNTAIN_TOP, name: "Fountain Top", category: "decorations" },
  { index: TILE_INDEX.FOUNTAIN_BOTTOM, name: "Fountain Bottom", category: "decorations" },

  // Interactive
  { index: TILE_INDEX.PORTAL, name: "Portal", category: "interactive" },
  { index: TILE_INDEX.SPAWN, name: "Spawn Point", category: "interactive" },
  { index: TILE_INDEX.CHEST, name: "Chest", category: "interactive" },
  { index: TILE_INDEX.NPC, name: "NPC", category: "interactive" },

  // Collision
  { index: TILE_INDEX.COLLISION, name: "Collision", category: "collision" },
];

/** 카테고리별 필터 */
export function getTilesByCategory(category: string): TilePaletteItem[] {
  return TILE_PALETTE.filter((t) => t.category === category);
}
