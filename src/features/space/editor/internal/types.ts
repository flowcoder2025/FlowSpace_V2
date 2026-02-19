/** 에디터 타입 정의 */

export type EditorTool = "paint" | "erase" | "select" | "object-place";

export type EditorLayerName =
  | "ground"
  | "walls"
  | "furniture"
  | "furniture_top"
  | "decorations"
  | "collision";

export const EDITOR_LAYERS: EditorLayerName[] = [
  "ground",
  "walls",
  "furniture",
  "furniture_top",
  "decorations",
  "collision",
];

/** DB 저장 포맷 */
export interface StoredMapData {
  version: 1;
  layers: Record<string, number[][]>;
}

/** 에디터에서 사용하는 맵 오브젝트 */
export interface EditorMapObject {
  id: string;
  tempId?: string;
  objectType: string;
  positionX: number;
  positionY: number;
  assetId?: string | null;
  label?: string | null;
  rotation: number;
  width: number;
  height: number;
  linkedObjectId?: string | null;
  customData?: Record<string, unknown> | null;
}

/** 타일 팔레트 항목 */
export interface TilePaletteItem {
  index: number;
  name: string;
  category: TileCategory;
}

export type TileCategory = "ground" | "walls" | "furniture" | "furniture_top" | "decorations" | "interactive" | "collision";

/** 오브젝트 팔레트 항목 */
export interface ObjectPaletteItem {
  objectType: string;
  label: string;
  category: ObjectCategory;
  assetId?: string;
  defaultWidth?: number;
  defaultHeight?: number;
}

export type ObjectCategory = "interactive" | "furniture" | "decoration";
