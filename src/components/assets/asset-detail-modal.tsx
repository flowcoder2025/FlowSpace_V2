"use client";

import { useEffect, useCallback, useState } from "react";
import { AssetPreview } from "./asset-preview";
import { GenerationProgress } from "./generation-progress";
import { useAssetStore } from "@/stores/asset-store";
import { loadAssetToPhaser } from "@/features/assets";

const TYPE_LABELS: Record<string, string> = {
  CHARACTER: "캐릭터",
  TILESET: "타일셋",
  OBJECT: "오브젝트",
  MAP: "맵",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 중",
  PROCESSING: "생성 중",
  COMPLETED: "완료",
  FAILED: "실패",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "text-yellow-600",
  PROCESSING: "text-blue-600",
  COMPLETED: "text-green-600",
  FAILED: "text-red-600",
};

interface AssetDetailModalProps {
  assetId: string;
  onClose: () => void;
}

export function AssetDetailModal({ assetId, onClose }: AssetDetailModalProps) {
  const { assets, updateAsset, removeAsset } = useAssetStore();
  const asset = assets.find((a) => a.id === assetId);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!asset) return null;

  const isProcessing = asset.status === "PENDING" || asset.status === "PROCESSING";
  const isFailed = asset.status === "FAILED";
  const isCompleted = asset.status === "COMPLETED";

  const handleApplyToGame = async () => {
    setIsApplying(true);
    try {
      await loadAssetToPhaser(assetId);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDownload = () => {
    if (!asset.filePath) return;
    const link = document.createElement("a");
    link.href = asset.filePath;
    link.download = asset.name || "asset";
    link.click();
  };

  const handleDelete = async () => {
    if (!confirm("이 에셋을 삭제하시겠습니까?")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/assets/${assetId}`, { method: "DELETE" });
      if (res.ok) {
        removeAsset(assetId);
        onClose();
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerationComplete = (result: {
    id: string;
    status: string;
    filePath?: string;
    thumbnailPath?: string;
  }) => {
    updateAsset(result.id, {
      status: result.status,
      filePath: result.filePath,
      thumbnailPath: result.thumbnailPath,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold truncate">{asset.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col md:flex-row gap-6">
          {/* Left: Preview */}
          <div className="flex-1 min-w-0">
            {isProcessing ? (
              <GenerationProgress
                assetId={assetId}
                onComplete={handleGenerationComplete}
              />
            ) : (
              <AssetPreview src={asset.filePath || null} alt={asset.name} />
            )}
          </div>

          {/* Right: Info & Actions */}
          <div className="w-full md:w-56 flex flex-col gap-4">
            {/* Metadata */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">유형</span>
                <span className="font-medium">{TYPE_LABELS[asset.type] || asset.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">상태</span>
                <span className={`font-medium ${STATUS_COLORS[asset.status] || ""}`}>
                  {STATUS_LABELS[asset.status] || asset.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">생성일</span>
                <span>{new Date(asset.createdAt).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>

            {/* Prompt */}
            {asset.prompt && (
              <div>
                <p className="text-xs text-gray-500 mb-1">프롬프트</p>
                <p className="text-xs text-gray-700 bg-gray-50 rounded p-2 max-h-24 overflow-auto">
                  {asset.prompt}
                </p>
              </div>
            )}

            {/* Error message for failed */}
            {isFailed && (
              <div className="text-sm text-red-600 bg-red-50 rounded p-2">
                생성에 실패했습니다.
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-auto">
              {isCompleted && (
                <>
                  <button
                    onClick={handleApplyToGame}
                    disabled={isApplying}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isApplying ? "적용 중..." : "게임에 적용"}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                  >
                    다운로드
                  </button>
                </>
              )}
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
