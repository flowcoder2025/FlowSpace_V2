"use client";

import type { EditorTool, EditorLayerName, EditorMapObject } from "@/features/space/editor";
import ToolBar from "./tool-bar";
import LayerSelector from "./layer-selector";
import TilePalette from "./tile-palette";
import ObjectPalette from "./object-palette";
import AssetPalette from "./asset-palette";
import PropertyPanel from "./property-panel";

interface EditorSidebarProps {
  activeTool: EditorTool;
  activeLayer: EditorLayerName;
  selectedTileIndex: number;
  selectedObjectType: string | null;
  selectedAssetId: string | null;
  selectedObject: EditorMapObject | null;
  paletteTab: "tiles" | "objects" | "assets";
  layerVisibility: Record<EditorLayerName, boolean>;
  isDirty: boolean;
  isSaving: boolean;
  onToolChange: (tool: EditorTool) => void;
  onLayerChange: (layer: EditorLayerName) => void;
  onTileSelect: (tileIndex: number) => void;
  onObjectTypeSelect: (type: string | null) => void;
  onAssetSelect: (assetId: string | null, objectType: string) => void;
  onToggleLayerVisibility: (layer: EditorLayerName) => void;
  onPaletteTabChange: (tab: "tiles" | "objects" | "assets") => void;
  onSave: () => void;
  onDeleteObject: (id: string) => void;
  onLinkPortal?: (sourceId: string) => void;
}

export default function EditorSidebar({
  activeTool,
  activeLayer,
  selectedTileIndex,
  selectedObjectType,
  selectedAssetId,
  selectedObject,
  paletteTab,
  layerVisibility,
  isDirty,
  isSaving,
  onToolChange,
  onLayerChange,
  onTileSelect,
  onObjectTypeSelect,
  onAssetSelect,
  onToggleLayerVisibility,
  onPaletteTabChange,
  onSave,
  onDeleteObject,
  onLinkPortal,
}: EditorSidebarProps) {
  return (
    <div className="absolute right-0 top-0 z-50 flex h-full w-56 flex-col gap-3 overflow-y-auto bg-gray-900/95 p-3 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-emerald-400">맵 에디터</h3>
        <button
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            isDirty && !isSaving
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          {isSaving ? "저장 중..." : isDirty ? "저장" : "저장됨"}
        </button>
      </div>

      {/* Tools */}
      <ToolBar activeTool={activeTool} onToolChange={onToolChange} />

      {/* Layers */}
      <LayerSelector
        activeLayer={activeLayer}
        layerVisibility={layerVisibility}
        onLayerChange={onLayerChange}
        onToggleVisibility={onToggleLayerVisibility}
      />

      {/* 팔레트 탭 */}
      <div className="flex gap-1">
        {([
          { key: "tiles", label: "타일" },
          { key: "objects", label: "오브젝트" },
          { key: "assets", label: "에셋" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onPaletteTabChange(key)}
            className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
              paletteTab === key
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Palette content */}
      {paletteTab === "tiles" && (
        <TilePalette
          selectedTileIndex={selectedTileIndex}
          onSelect={onTileSelect}
        />
      )}
      {paletteTab === "objects" && (
        <ObjectPalette
          selectedObjectType={selectedObjectType}
          onSelect={onObjectTypeSelect}
        />
      )}
      {paletteTab === "assets" && (
        <AssetPalette
          selectedAssetId={selectedAssetId}
          onSelect={onAssetSelect}
        />
      )}

      {/* Property panel (selected object) */}
      <PropertyPanel
        object={selectedObject}
        onDelete={onDeleteObject}
        onLinkPortal={onLinkPortal}
      />
    </div>
  );
}
