"use client";

import { useState, useEffect } from "react";

interface CompletedAsset {
  id: string;
  type: string;
  name: string;
  thumbnailPath: string | null;
  filePath: string | null;
}

type AssetFilter = "ALL" | "CHARACTER" | "TILESET" | "OBJECT";

const FILTERS: { key: AssetFilter; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "CHARACTER", label: "캐릭터" },
  { key: "TILESET", label: "타일셋" },
  { key: "OBJECT", label: "오브젝트" },
];

interface AssetPaletteProps {
  selectedAssetId: string | null;
  onSelect: (assetId: string | null, objectType: string) => void;
}

export default function AssetPalette({
  selectedAssetId,
  onSelect,
}: AssetPaletteProps) {
  const [assets, setAssets] = useState<CompletedAsset[]>([]);
  const [filter, setFilter] = useState<AssetFilter>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/assets?status=COMPLETED&limit=100")
      .then((res) => (res.ok ? res.json() : { assets: [] }))
      .then((data: { assets: CompletedAsset[] }) => {
        if (!cancelled) {
          setAssets(data.assets);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered =
    filter === "ALL" ? assets : assets.filter((a) => a.type === filter);

  return (
    <div className="space-y-2">
      {/* Type filter */}
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              filter === key
                ? "bg-emerald-600 text-white"
                : "bg-gray-700 text-gray-400 hover:bg-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Asset grid */}
      {loading ? (
        <div className="py-4 text-center text-xs text-gray-500">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-500">에셋 없음</div>
      ) : (
        <div className="grid max-h-[300px] grid-cols-2 gap-1 overflow-y-auto pr-1">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              onClick={() => {
                if (selectedAssetId === asset.id) {
                  onSelect(null, "");
                } else {
                  onSelect(asset.id, `asset_${asset.id}`);
                }
              }}
              className={`flex flex-col items-center justify-center rounded border p-1 transition-colors ${
                selectedAssetId === asset.id
                  ? "border-emerald-500 bg-emerald-600/30 text-emerald-300"
                  : "border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500"
              }`}
            >
              {asset.thumbnailPath ? (
                <img
                  src={asset.thumbnailPath}
                  alt={asset.name}
                  className="h-8 w-8 object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center text-[10px] text-gray-600">
                  ?
                </div>
              )}
              <span className="mt-0.5 w-full truncate text-center text-[9px]">
                {asset.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
