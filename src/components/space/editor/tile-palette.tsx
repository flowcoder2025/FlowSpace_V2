"use client";

import { useState } from "react";
import { TILE_PALETTE, type TileCategory } from "@/features/space/editor";

interface TilePaletteProps {
  selectedTileIndex: number;
  onSelect: (tileIndex: number) => void;
}

const CATEGORIES: { key: TileCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ground", label: "Ground" },
  { key: "walls", label: "Walls" },
  { key: "furniture", label: "Furn." },
  { key: "furniture_top", label: "Top" },
  { key: "decorations", label: "Deco" },
  { key: "interactive", label: "Inter." },
  { key: "collision", label: "Col." },
];

export default function TilePalette({
  selectedTileIndex,
  onSelect,
}: TilePaletteProps) {
  const [activeCategory, setActiveCategory] = useState<TileCategory | "all">(
    "all"
  );

  const filtered =
    activeCategory === "all"
      ? TILE_PALETTE
      : TILE_PALETTE.filter((t) => t.category === activeCategory);

  return (
    <div className="space-y-2">
      {/* Category filter */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              activeCategory === key
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tile grid */}
      <div className="grid max-h-[300px] grid-cols-4 gap-1 overflow-y-auto pr-1">
        {filtered.map((tile) => (
          <button
            key={tile.index}
            onClick={() => onSelect(tile.index)}
            title={tile.name}
            className={`flex h-10 w-full items-center justify-center rounded border text-[10px] transition-colors ${
              selectedTileIndex === tile.index
                ? "border-emerald-500 bg-emerald-600/30 text-emerald-300"
                : "border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500"
            }`}
          >
            <span className="truncate px-0.5">{tile.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
