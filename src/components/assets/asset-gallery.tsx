"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useAssetStore } from "@/stores/asset-store";
import { AssetFilterBar } from "./asset-filter-bar";
import { AssetCard } from "./asset-card";
import { AssetDetailModal } from "./asset-detail-modal";

const AUTO_REFRESH_INTERVAL = 30_000;

export function AssetGallery() {
  const {
    assets,
    isLoading,
    typeFilter,
    statusFilter,
    selectedAssetId,
    setAssets,
    setLoading,
    setTypeFilter,
    setStatusFilter,
    setSelectedAssetId,
  } = useAssetStore();

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/assets?${params}`);
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets);
      } else if (res.status === 401) {
        setError("로그인이 필요합니다.");
      } else {
        setError("에셋을 불러오지 못했습니다.");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, setAssets, setLoading]);

  // Fetch on filter change
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Auto-refresh when processing assets exist
  useEffect(() => {
    const hasProcessing = assets.some(
      (a) => a.status === "PENDING" || a.status === "PROCESSING",
    );

    if (hasProcessing) {
      refreshTimerRef.current = setInterval(fetchAssets, AUTO_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [assets, fetchAssets]);

  return (
    <div className="space-y-6">
      <AssetFilterBar
        typeFilter={typeFilter}
        statusFilter={statusFilter}
        onTypeChange={setTypeFilter}
        onStatusChange={setStatusFilter}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <p className="text-red-600">{error}</p>
          {error.includes("로그인") && (
            <a href="/login" className="text-sm text-blue-600 hover:underline mt-2 inline-block">
              로그인하러 가기
            </a>
          )}
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">에셋이 없습니다</p>
          <p className="text-sm mt-1">CLI를 통해 에셋을 생성해보세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              id={asset.id}
              name={asset.name}
              type={asset.type}
              status={asset.status}
              thumbnailPath={asset.thumbnailPath}
              createdAt={asset.createdAt}
              onClick={setSelectedAssetId}
            />
          ))}
        </div>
      )}

      {selectedAssetId && (
        <AssetDetailModal
          assetId={selectedAssetId}
          onClose={() => setSelectedAssetId(null)}
        />
      )}
    </div>
  );
}
