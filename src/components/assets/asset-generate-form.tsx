"use client";

import { useState } from "react";
import { useAssetStore } from "@/stores/asset-store";

const ASSET_TYPES = [
  { value: "character", label: "Character Sprite", description: "4방향 캐릭터 스프라이트시트 (8x4 grid, 64x64)" },
  { value: "tileset", label: "Tileset", description: "타일맵 타일셋 (16x14 grid, 32x32)" },
  { value: "object", label: "Object", description: "오브젝트 스프라이트 (max 128x128)" },
  { value: "map", label: "Map Background", description: "맵 배경 이미지 (기본 1024x768)" },
] as const;

export function AssetGenerateForm() {
  const [type, setType] = useState<string>("character");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addAsset = useAssetStore((s) => s.addAsset);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name, prompt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();

      addAsset({
        id: data.id,
        type: type.toUpperCase(),
        name,
        prompt,
        status: "PROCESSING",
        createdAt: new Date().toISOString(),
      });

      setName("");
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Asset Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Asset Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                type === t.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-gray-500 mt-1">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label
          htmlFor="asset-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Name
        </label>
        <input
          id="asset-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., office_worker, forest_tiles"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Prompt */}
      <div>
        <label
          htmlFor="asset-prompt"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Prompt
        </label>
        <textarea
          id="asset-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the asset you want to generate..."
          required
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || !name || !prompt}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? "Generating..." : "Generate Asset"}
      </button>
    </form>
  );
}
