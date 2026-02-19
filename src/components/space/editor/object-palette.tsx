"use client";

import { useState } from "react";
import { OBJECT_PALETTE, type ObjectCategory } from "@/features/space/editor";

interface ObjectPaletteProps {
  selectedObjectType: string | null;
  onSelect: (objectType: string | null) => void;
}

const CATEGORIES: { key: ObjectCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "interactive", label: "Interactive" },
  { key: "furniture", label: "Furniture" },
  { key: "decoration", label: "Decoration" },
];

export default function ObjectPalette({
  selectedObjectType,
  onSelect,
}: ObjectPaletteProps) {
  const [activeCategory, setActiveCategory] = useState<
    ObjectCategory | "all"
  >("all");

  const filtered =
    activeCategory === "all"
      ? OBJECT_PALETTE
      : OBJECT_PALETTE.filter((o) => o.category === activeCategory);

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

      {/* Object grid */}
      <div className="grid max-h-[300px] grid-cols-2 gap-1 overflow-y-auto pr-1">
        {filtered.map((obj) => (
          <button
            key={obj.objectType}
            onClick={() =>
              onSelect(
                selectedObjectType === obj.objectType ? null : obj.objectType
              )
            }
            className={`flex h-10 items-center justify-center rounded border text-[10px] transition-colors ${
              selectedObjectType === obj.objectType
                ? "border-emerald-500 bg-emerald-600/30 text-emerald-300"
                : "border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500"
            }`}
          >
            <span className="truncate px-1">{obj.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
