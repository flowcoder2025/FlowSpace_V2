"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PartCategory, PartDefinition, PartsAvatarConfig } from "@/features/space/avatar";
import { getPartsByCategory, renderPartsPreview } from "@/features/space/avatar";

interface PartGridProps {
  category: PartCategory;
  config: PartsAvatarConfig;
  onSelect: (partId: string) => void;
}

/** 파츠 썸네일 미리보기 */
function PartThumbnail({
  part,
  config,
  selected,
  onClick,
}: {
  part: PartDefinition;
  config: PartsAvatarConfig;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderThumbnail = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;

    // 이 파츠를 적용한 미리보기 생성
    const previewConfig: PartsAvatarConfig = {
      ...config,
      [part.category]: { ...config[part.category], partId: part.id },
    };

    const preview = renderPartsPreview(previewConfig, 0, 0, 2);
    const ctx = el.getContext("2d");
    if (!ctx) return;

    el.width = preview.width;
    el.height = preview.height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.drawImage(preview, 0, 0);
  }, [part, config]);

  useEffect(() => {
    renderThumbnail();
  }, [renderThumbnail]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all ${
        selected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <canvas
        ref={canvasRef}
        className="h-16 w-12"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="text-[10px] text-gray-500">{part.name}</span>
    </button>
  );
}

export function PartGrid({ category, config, onSelect }: PartGridProps) {
  const parts = getPartsByCategory(category);

  const currentPartId = config[category]?.partId;

  return (
    <div className="grid grid-cols-4 gap-2">
      {parts.map((part) => (
        <PartThumbnail
          key={part.id}
          part={part}
          config={config}
          selected={currentPartId === part.id}
          onClick={() => onSelect(part.id)}
        />
      ))}
    </div>
  );
}
