"use client";

import type { AssetTypeFilter, AssetStatusFilter } from "@/stores/asset-store";

interface AssetFilterBarProps {
  typeFilter: AssetTypeFilter;
  statusFilter: AssetStatusFilter;
  onTypeChange: (filter: AssetTypeFilter) => void;
  onStatusChange: (filter: AssetStatusFilter) => void;
}

const TYPE_OPTIONS: { value: AssetTypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "character", label: "캐릭터" },
  { value: "tileset", label: "타일셋" },
  { value: "object", label: "오브젝트" },
  { value: "map", label: "맵" },
];

const STATUS_OPTIONS: { value: AssetStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "completed", label: "완료" },
  { value: "processing", label: "생성중" },
  { value: "failed", label: "실패" },
];

export function AssetFilterBar({
  typeFilter,
  statusFilter,
  onTypeChange,
  onStatusChange,
}: AssetFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* Type filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 font-medium">유형</span>
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeChange(opt.value)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                typeFilter === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 font-medium">상태</span>
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onStatusChange(opt.value)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                statusFilter === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
