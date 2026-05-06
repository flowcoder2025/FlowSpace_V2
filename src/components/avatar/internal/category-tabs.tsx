"use client";

import type { PartCategory } from "@/features/space/avatar";
import { CATEGORY_LABELS } from "@/features/space/avatar";

const CATEGORIES: PartCategory[] = ["body", "hair", "eyes", "top", "bottom", "accessory"];

interface CategoryTabsProps {
  active: PartCategory;
  onChange: (category: PartCategory) => void;
}

export function CategoryTabs({ active, onChange }: CategoryTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => onChange(cat)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            active === cat
              ? "bg-brand text-white"
              : "bg-cream-deep text-ink-muted hover:bg-line"
          }`}
        >
          {CATEGORY_LABELS[cat]}
        </button>
      ))}
    </div>
  );
}
