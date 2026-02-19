"use client";

import { useState, useCallback } from "react";
import { PromptEditor, type GenerateParams } from "./prompt-editor";
import { AssetPreview } from "./asset-preview";
import { GenerationProgress } from "./generation-progress";

interface AssetHistoryItem {
  id: string;
  type: string;
  name: string;
  status: string;
  thumbnailPath: string | null;
  createdAt: string;
}

export function AssetStudio() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [history, setHistory] = useState<AssetHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async (params: GenerateParams) => {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();
      setActiveAssetId(data.id);

      // 히스토리에 추가
      setHistory((prev) => [
        {
          id: data.id,
          type: params.type.toUpperCase(),
          name: params.name,
          status: "PROCESSING",
          thumbnailPath: null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const handleComplete = useCallback((asset: { id: string; filePath?: string; thumbnailPath?: string }) => {
    setPreviewSrc(asset.filePath || asset.thumbnailPath || null);
    setActiveAssetId(null);

    // 히스토리 업데이트
    setHistory((prev) =>
      prev.map((h) =>
        h.id === asset.id
          ? { ...h, status: "COMPLETED", thumbnailPath: asset.thumbnailPath || null }
          : h
      )
    );
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 좌측: 에디터 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generate</h2>
        <PromptEditor onGenerate={handleGenerate} isGenerating={isGenerating} />

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 진행률 */}
        {activeAssetId && (
          <GenerationProgress assetId={activeAssetId} onComplete={handleComplete} />
        )}
      </div>

      {/* 우측: 미리보기 */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Preview</h2>
        <AssetPreview src={previewSrc} />
      </div>

      {/* 하단: 히스토리 그리드 */}
      {history.length > 0 && (
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold mb-3">History</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.thumbnailPath) {
                    setPreviewSrc(item.thumbnailPath);
                  }
                }}
                className="aspect-square rounded border border-gray-200 overflow-hidden bg-gray-100 hover:border-blue-400 transition-colors"
              >
                {item.thumbnailPath ? (
                  <img
                    src={item.thumbnailPath}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-gray-400">
                    {item.status === "PROCESSING" ? "..." : item.status === "FAILED" ? "!" : "?"}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
