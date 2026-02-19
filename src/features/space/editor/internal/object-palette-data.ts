/** 오브젝트 팔레트 데이터 - 배치 가능한 오브젝트 목록 */

import type { ObjectPaletteItem } from "./types";

export const OBJECT_PALETTE: ObjectPaletteItem[] = [
  // Interactive
  {
    objectType: "portal",
    label: "Portal",
    category: "interactive",
  },
  {
    objectType: "spawn_point",
    label: "Spawn Point",
    category: "interactive",
  },
  {
    objectType: "sign",
    label: "Sign",
    category: "interactive",
  },
  {
    objectType: "chest",
    label: "Chest",
    category: "interactive",
  },
  {
    objectType: "npc",
    label: "NPC",
    category: "interactive",
  },

  // Furniture
  {
    objectType: "desk",
    label: "Desk",
    category: "furniture",
    defaultWidth: 2,
  },
  {
    objectType: "sofa",
    label: "Sofa",
    category: "furniture",
    defaultWidth: 2,
  },
  {
    objectType: "table",
    label: "Table",
    category: "furniture",
    defaultWidth: 2,
  },
  {
    objectType: "bookshelf",
    label: "Bookshelf",
    category: "furniture",
    defaultHeight: 2,
  },
  {
    objectType: "bed",
    label: "Bed",
    category: "furniture",
    defaultHeight: 2,
  },
  {
    objectType: "cabinet",
    label: "Cabinet",
    category: "furniture",
  },

  // Decoration
  {
    objectType: "tree",
    label: "Tree",
    category: "decoration",
    defaultHeight: 2,
  },
  {
    objectType: "flower",
    label: "Flower",
    category: "decoration",
  },
  {
    objectType: "bush",
    label: "Bush",
    category: "decoration",
  },
  {
    objectType: "rock",
    label: "Rock",
    category: "decoration",
  },
  {
    objectType: "bench",
    label: "Bench",
    category: "decoration",
  },
  {
    objectType: "fountain",
    label: "Fountain",
    category: "decoration",
    defaultHeight: 2,
  },
];

/** 카테고리별 필터 */
export function getObjectsByCategory(category: string): ObjectPaletteItem[] {
  return OBJECT_PALETTE.filter((o) => o.category === category);
}
