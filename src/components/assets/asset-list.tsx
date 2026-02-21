"use client";

import { useEffect } from "react";
import { useAssetStore } from "@/stores/asset-store";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: "캐릭터",
  TILESET: "타일셋",
  OBJECT: "오브젝트",
  MAP: "맵",
};

export function AssetList() {
  const { assets, isLoading, typeFilter, statusFilter, setAssets, setLoading } =
    useAssetStore();

  useEffect(() => {
    async function fetchAssets() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (typeFilter !== "all") params.set("type", typeFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);

        const response = await fetch(`/api/assets?${params}`);
        if (response.ok) {
          const data = await response.json();
          setAssets(data.assets);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchAssets();
  }, [typeFilter, statusFilter, setAssets, setLoading]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">에셋이 없습니다</p>
        <p className="text-sm mt-1">첫 번째 에셋을 생성해보세요</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {assets.map((asset) => (
        <div
          key={asset.id}
          className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
        >
          {/* Thumbnail */}
          <div className="aspect-video bg-gray-100 flex items-center justify-center">
            {asset.thumbnailPath ? (
              <img
                src={asset.thumbnailPath}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-sm">미리보기 없음</span>
            )}
          </div>

          {/* Info */}
          <div className="p-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium text-sm truncate">{asset.name}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[asset.status] || ""}`}
              >
                {asset.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{TYPE_LABELS[asset.type] || asset.type}</span>
              <span>
                {new Date(asset.createdAt).toLocaleDateString("ko-KR")}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {asset.prompt}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
