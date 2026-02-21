"use client";

import { useState, useCallback } from "react";
import type { PartCategory, PartsAvatarConfig } from "@/features/space/avatar";
import { DEFAULT_PARTS_AVATAR, getPartsByCategory } from "@/features/space/avatar";
import { CategoryTabs } from "./internal/category-tabs";
import { PartGrid } from "./internal/part-grid";
import { ColorPicker } from "./internal/color-picker";
import { SkinTonePicker } from "./internal/skin-tone-picker";
import { PreviewCanvas } from "./internal/preview-canvas";

interface CharacterEditorProps {
  initialConfig?: PartsAvatarConfig;
  onChange?: (config: PartsAvatarConfig) => void;
}

export function CharacterEditor({ initialConfig, onChange }: CharacterEditorProps) {
  const [config, setConfig] = useState<PartsAvatarConfig>(
    initialConfig ?? DEFAULT_PARTS_AVATAR,
  );
  const [activeCategory, setActiveCategory] = useState<PartCategory>("body");

  const updateConfig = useCallback(
    (next: PartsAvatarConfig) => {
      setConfig(next);
      onChange?.(next);
    },
    [onChange],
  );

  const handlePartSelect = useCallback(
    (partId: string) => {
      const next: PartsAvatarConfig = {
        ...config,
        [activeCategory]: { ...config[activeCategory], partId },
      };
      updateConfig(next);
    },
    [config, activeCategory, updateConfig],
  );

  const handleColorChange = useCallback(
    (color: string) => {
      const next: PartsAvatarConfig = {
        ...config,
        [activeCategory]: { ...config[activeCategory], color },
      };
      updateConfig(next);
    },
    [config, activeCategory, updateConfig],
  );

  const handleSkinToneChange = useCallback(
    (color: string) => {
      const next: PartsAvatarConfig = {
        ...config,
        body: { ...config.body, color },
      };
      updateConfig(next);
    },
    [config, updateConfig],
  );

  // 현재 카테고리에 색상 변경 가능한 파츠가 있는지 확인
  const currentParts = getPartsByCategory(activeCategory);
  const currentPart = currentParts.find(
    (p) => p.id === config[activeCategory]?.partId,
  );
  const showColorPicker = currentPart?.colorable ?? false;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      {/* Preview */}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <PreviewCanvas config={config} />
        </div>
        <SkinTonePicker
          value={config.body.color ?? "#f5d0a9"}
          onChange={handleSkinToneChange}
        />
      </div>

      {/* Editor Panel */}
      <div className="flex flex-1 flex-col gap-3">
        <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <PartGrid
            category={activeCategory}
            config={config}
            onSelect={handlePartSelect}
          />
        </div>

        {showColorPicker && activeCategory !== "body" && (
          <ColorPicker
            label={`${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Color`}
            value={config[activeCategory]?.color ?? "#888888"}
            onChange={handleColorChange}
          />
        )}
      </div>
    </div>
  );
}
