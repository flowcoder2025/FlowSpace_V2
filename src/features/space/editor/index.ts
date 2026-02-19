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
