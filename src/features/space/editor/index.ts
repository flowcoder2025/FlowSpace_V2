// Editor - Public API
export type {
  EditorTool,
  EditorLayerName,
  StoredMapData,
  EditorMapObject,
  TilePaletteItem,
  TileCategory,
  ObjectPaletteItem,
  ObjectCategory,
} from "./internal/types";

export { EDITOR_LAYERS } from "./internal/types";
export { TILE_PALETTE, getTilesByCategory } from "./internal/tile-palette-data";
export { OBJECT_PALETTE, getObjectsByCategory } from "./internal/object-palette-data";
export { useEditor } from "./internal/use-editor";

// ── Cross-module integration surface (game → editor) ──
// game 씬(MainScene)이 에디터 시스템을 인스턴스화하기 위한 공개 표면.
// 안정 공개 API가 아니며, 후속 WI에서 editor-game 경계 재검토 예정.
export { EditorSystem } from "./internal/editor-system";
