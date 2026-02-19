"use client";

import { useState, useEffect } from "react";
import { useAssetStore } from "@/stores/asset-store";
import { GenerationProgress } from "./generation-progress";

const ASSET_TYPES = [
  { value: "character", label: "Character Sprite", description: "4방향 캐릭터 스프라이트시트 (8x4 grid, 64x64)" },
  { value: "tileset", label: "Tileset", description: "타일맵 타일셋 (16x14 grid, 32x32)" },
  { value: "object", label: "Object", description: "오브젝트 스프라이트 (max 128x128)" },
  { value: "map", label: "Map Background", description: "맵 배경 이미지 (기본 1024x768)" },
] as const;

interface BatchItem {
  type: string;
  name: string;
  prompt: string;
}

interface WorkflowOption {
  id: string;
  name: string;
  assetType: string;
}

export function AssetGenerateForm() {
  const [type, setType] = useState<string>("character");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [workflow, setWorkflow] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const addAsset = useAssetStore((s) => s.addAsset);

  // 워크플로우 목록 로드
  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => res.ok ? res.json() : { workflows: [] })
      .then((data) => setWorkflows(data.workflows || []))
      .catch(() => setWorkflows([]));
  }, []);

  const filteredWorkflows = workflows.filter(
    (w) => w.assetType === type.toUpperCase()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // 배치 모드
      if (batchItems.length > 0) {
        const items = [...batchItems, { type, name, prompt }].filter(
          (i) => i.name && i.prompt
        );
        const response = await fetch("/api/assets/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Batch generation failed");
        }

        const data = await response.json();
        for (const item of data.items) {
          addAsset({
            id: item.id,
            type: type.toUpperCase(),
            name: item.name,
            prompt: "",
            status: "PROCESSING",
            createdAt: new Date().toISOString(),
          });
        }

        setBatchItems([]);
        setName("");
        setPrompt("");
        return;
      }

      // 단일 생성
      const response = await fetch("/api/assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name,
          prompt,
          workflow: workflow || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }

      const data = await response.json();
      setActiveAssetId(data.id);

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

  function addToBatch() {
    if (!name || !prompt) return;
    setBatchItems((prev) => [...prev, { type, name, prompt }]);
    setName("");
    setPrompt("");
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

      {/* Workflow Selection */}
      {filteredWorkflows.length > 0 && (
        <div>
          <label
            htmlFor="workflow-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Workflow
          </label>
          <select
            id="workflow-select"
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">Default</option>
            {filteredWorkflows.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Batch Items */}
      {batchItems.length > 0 && (
        <div className="border border-gray-200 rounded-md p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">
            Batch Queue ({batchItems.length} items)
          </p>
          {batchItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm py-1">
              <span className="text-gray-600">
                {item.name} ({item.type})
              </span>
              <button
                type="button"
                onClick={() => setBatchItems((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Progress */}
      {activeAssetId && (
        <GenerationProgress
          assetId={activeAssetId}
          onComplete={() => setActiveAssetId(null)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addToBatch}
          disabled={!name || !prompt}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          + Add to Batch
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name || !prompt}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting
            ? "Generating..."
            : batchItems.length > 0
              ? `Generate Batch (${batchItems.length + 1})`
              : "Generate Asset"}
        </button>
      </div>
    </form>
  );
}
