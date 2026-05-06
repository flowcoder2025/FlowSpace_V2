"use client";

import { EDITOR_LAYERS, type EditorLayerName } from "@/features/space/editor";

interface LayerSelectorProps {
  activeLayer: EditorLayerName;
  layerVisibility: Record<EditorLayerName, boolean>;
  onLayerChange: (layer: EditorLayerName) => void;
  onToggleVisibility: (layer: EditorLayerName) => void;
}

const LAYER_LABELS: Record<EditorLayerName, string> = {
  ground: "Ground",
  walls: "Walls",
  furniture: "Furniture",
  furniture_top: "Furn. Top",
  decorations: "Deco",
  collision: "Collision",
};

export default function LayerSelector({
  activeLayer,
  layerVisibility,
  onLayerChange,
  onToggleVisibility,
}: LayerSelectorProps) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
        Layers
      </div>
      {EDITOR_LAYERS.map((layer) => (
        <div
          key={layer}
          className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
            activeLayer === layer
              ? "bg-emerald-600/30 text-emerald-300"
              : "text-ink-light hover:bg-cream/10"
          }`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(layer);
            }}
            className={`h-4 w-4 rounded border text-[8px] leading-none ${
              layerVisibility[layer]
                ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                : "border-cream/15 text-ink-muted"
            }`}
          >
            {layerVisibility[layer] ? "\u2713" : ""}
          </button>
          <button
            onClick={() => onLayerChange(layer)}
            className="flex-1 text-left"
          >
            {LAYER_LABELS[layer]}
          </button>
        </div>
      ))}
    </div>
  );
}
