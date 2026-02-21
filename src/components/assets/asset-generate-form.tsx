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

const QUALITY_PRESETS = [
  { value: "", label: "Default", description: "워크플로우 기본값" },
  { value: "draft", label: "Draft", description: "빠른 미리보기 (15 steps)" },
  { value: "standard", label: "Standard", description: "기본 품질 (25 steps)" },
  { value: "high", label: "High", description: "최고 품질 (40 steps)" },
] as const;

const SAMPLER_OPTIONS = [
  "euler",
  "euler_ancestral",
  "heun",
  "dpm_2",
  "dpm_2_ancestral",
  "lms",
  "dpmpp_2s_ancestral",
  "dpmpp_2m",
  "dpmpp_sde",
  "dpmpp_2m_sde",
  "uni_pc",
  "ddim",
] as const;

const SCHEDULER_OPTIONS = [
  "normal",
  "karras",
  "exponential",
  "sgm_uniform",
  "simple",
  "ddim_uniform",
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

  // Advanced params
  const [qualityPreset, setQualityPreset] = useState<string>("");
  const [negativePrompt, setNegativePrompt] = useState<string>("");
  const [steps, setSteps] = useState<string>("");
  const [cfgScale, setCfgScale] = useState<string>("");
  const [samplerName, setSamplerName] = useState<string>("");
  const [scheduler, setScheduler] = useState<string>("");
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [bgTolerance, setBgTolerance] = useState<string>("30");
  const [seamless, setSeamless] = useState<boolean>(false);
  const [useControlNet, setUseControlNet] = useState<boolean>(false);
  const [controlNetStrength, setControlNetStrength] = useState<string>("0.8");
  const [controlNetAvailable, setControlNetAvailable] = useState<boolean>(false);

  const addAsset = useAssetStore((s) => s.addAsset);

  // 워크플로우 목록 로드
  useEffect(() => {
    fetch("/api/workflows")
      .then((res) => res.ok ? res.json() : { workflows: [] })
      .then((data) => setWorkflows(data.workflows || []))
      .catch(() => setWorkflows([]));
  }, []);

  // ControlNet capability check
  useEffect(() => {
    if (type !== "character") return;
    fetch("/api/comfyui/capabilities")
      .then((res) => res.ok ? res.json() : { controlNet: false })
      .then((data) => setControlNetAvailable(data.controlNet === true))
      .catch(() => setControlNetAvailable(false));
  }, [type]);

  const filteredWorkflows = workflows.filter(
    (w) => w.assetType === type.toUpperCase()
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const advancedParams = {
      qualityPreset: qualityPreset || undefined,
      negativePrompt: negativePrompt || undefined,
      steps: steps ? parseInt(steps, 10) : undefined,
      cfgScale: cfgScale ? parseFloat(cfgScale) : undefined,
      samplerName: samplerName || undefined,
      scheduler: scheduler || undefined,
      removeBackground: (type === "character" || type === "object") ? removeBg : undefined,
      bgRemovalTolerance: (type === "character" || type === "object") && removeBg
        ? parseInt(bgTolerance, 10)
        : undefined,
      seamless: type === "tileset" ? seamless : undefined,
      useControlNet: type === "character" && useControlNet ? true : undefined,
      controlNetStrength: type === "character" && useControlNet
        ? parseFloat(controlNetStrength)
        : undefined,
    };

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
          ...advancedParams,
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

      {/* Quality Preset */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Quality</label>
        <div className="flex gap-2">
          {QUALITY_PRESETS.map((q) => (
            <button
              key={q.value}
              type="button"
              onClick={() => setQualityPreset(q.value)}
              className={`flex-1 px-2 py-1.5 rounded border text-xs transition-colors ${
                qualityPreset === q.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
              title={q.description}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Parameters */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          Advanced Parameters
        </summary>
        <div className="mt-2 space-y-3">
          {/* Background Removal (character/object) */}
          {(type === "character" || type === "object") && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Remove Background
              </label>
              {removeBg && (
                <div className="flex items-center gap-1">
                  <label htmlFor="form-bg-tol" className="text-xs text-gray-500">Tolerance:</label>
                  <input
                    id="form-bg-tol"
                    type="range"
                    min={0}
                    max={100}
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(e.target.value)}
                    className="w-20 h-1"
                  />
                  <span className="text-xs text-gray-500 w-6">{bgTolerance}</span>
                </div>
              )}
            </div>
          )}

          {/* Seamless Tiling (tileset) */}
          {type === "tileset" && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={seamless}
                onChange={(e) => setSeamless(e.target.checked)}
                className="rounded border-gray-300"
              />
              Seamless Tiling (타일 경계 이음매 없음)
            </label>
          )}

          {/* ControlNet (character) */}
          {type === "character" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useControlNet}
                  onChange={(e) => setUseControlNet(e.target.checked)}
                  disabled={!controlNetAvailable}
                  className="rounded border-gray-300"
                />
                ControlNet Pose Guide
                {!controlNetAvailable && (
                  <span className="text-gray-400">(미설치)</span>
                )}
              </label>
              {useControlNet && controlNetAvailable && (
                <div className="flex items-center gap-2 ml-5">
                  <label htmlFor="form-cn-strength" className="text-xs text-gray-500">Strength:</label>
                  <input
                    id="form-cn-strength"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={controlNetStrength}
                    onChange={(e) => setControlNetStrength(e.target.value)}
                    className="w-24 h-1"
                  />
                  <span className="text-xs text-gray-500 w-8">{controlNetStrength}</span>
                </div>
              )}
            </div>
          )}

          {/* Negative Prompt */}
          <div>
            <label htmlFor="form-neg-prompt" className="block text-xs text-gray-500 mb-1">
              Negative Prompt
            </label>
            <textarea
              id="form-neg-prompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="비워두면 유형별 기본값 사용"
              rows={2}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
            />
          </div>

          {/* Sampler / Scheduler */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="form-sampler" className="block text-xs text-gray-500">Sampler</label>
              <select
                id="form-sampler"
                value={samplerName}
                onChange={(e) => setSamplerName(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Default</option>
                {SAMPLER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="form-scheduler" className="block text-xs text-gray-500">Scheduler</label>
              <select
                id="form-scheduler"
                value={scheduler}
                onChange={(e) => setScheduler(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">Default</option>
                {SCHEDULER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Steps / CFG */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="form-steps" className="block text-xs text-gray-500">Steps</label>
              <input
                id="form-steps"
                type="number"
                min={1}
                max={100}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="Auto"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="form-cfg" className="block text-xs text-gray-500">CFG Scale</label>
              <input
                id="form-cfg"
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={cfgScale}
                onChange={(e) => setCfgScale(e.target.value)}
                placeholder="Auto"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>
      </details>

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
