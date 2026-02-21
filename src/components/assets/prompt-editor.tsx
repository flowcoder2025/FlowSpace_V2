"use client";

import { useState, useCallback, useEffect } from "react";

interface PromptEditorProps {
  onGenerate: (params: GenerateParams) => void;
  isGenerating: boolean;
}

export interface GenerateParams {
  type: "character" | "tileset" | "object" | "map";
  name: string;
  prompt: string;
  seed?: number;
  width?: number;
  height?: number;
  workflow?: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  samplerName?: string;
  scheduler?: string;
  qualityPreset?: string;
  removeBackground?: boolean;
  bgRemovalTolerance?: number;
  seamless?: boolean;
  useControlNet?: boolean;
  controlNetStrength?: number;
  controlNetModel?: string;
  poseImage?: string;
}

const ASSET_TYPES = [
  { value: "character", label: "Character Sprite", description: "4방향 스프라이트시트 (8x4, 64x64)" },
  { value: "tileset", label: "Tileset", description: "타일맵 타일셋 (16x14, 32x32)" },
  { value: "object", label: "Object", description: "오브젝트 (max 128x128)" },
  { value: "map", label: "Map Background", description: "맵 배경 (1024x768)" },
] as const;

const PRESET_PROMPTS: Record<string, string[]> = {
  character: [
    "medieval knight with silver armor",
    "wizard with blue robe and staff",
    "office worker in business suit",
  ],
  tileset: [
    "grass, dirt, water, stone tiles for forest",
    "wooden floor, carpet, wall tiles for office",
    "sand, water, coral tiles for beach",
  ],
  object: [
    "wooden desk with computer",
    "potted plant, green leaves",
    "treasure chest, golden",
  ],
  map: [
    "cozy office interior with desks",
    "forest clearing with pond",
    "medieval castle courtyard",
  ],
};

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

export function PromptEditor({ onGenerate, isGenerating }: PromptEditorProps) {
  const [type, setType] = useState<GenerateParams["type"]>("character");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
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

  // ControlNet capability check
  useEffect(() => {
    if (type !== "character") return;
    fetch("/api/comfyui/capabilities")
      .then((res) => res.ok ? res.json() : { controlNet: false })
      .then((data) => setControlNetAvailable(data.controlNet === true))
      .catch(() => setControlNetAvailable(false));
  }, [type]);

  const handleSubmit = useCallback(() => {
    if (!name || !prompt) return;
    onGenerate({
      type,
      name,
      prompt,
      seed: seed ? parseInt(seed, 10) : undefined,
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined,
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
    });
  }, [type, name, prompt, seed, width, height, qualityPreset, negativePrompt, steps, cfgScale, samplerName, scheduler, removeBg, bgTolerance, seamless, useControlNet, controlNetStrength, onGenerate]);

  const presets = PRESET_PROMPTS[type] || [];

  return (
    <div className="space-y-4">
      {/* Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Asset Type</label>
        <div className="grid grid-cols-2 gap-2">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`p-2 rounded border text-left text-sm transition-colors ${
                type === t.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{t.label}</div>
              <div className="text-xs text-gray-500">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="studio-name" className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          id="studio-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., office_worker"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Prompt */}
      <div>
        <label htmlFor="studio-prompt" className="block text-sm font-medium text-gray-700 mb-1">
          Prompt
        </label>
        <textarea
          id="studio-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the asset..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {/* Presets */}
        {presets.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrompt(p)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-2 py-0.5"
              >
                {p.slice(0, 30)}...
              </button>
            ))}
          </div>
        )}
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
                  <label htmlFor="studio-bg-tol" className="text-xs text-gray-500">Tolerance:</label>
                  <input
                    id="studio-bg-tol"
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
                  <label htmlFor="studio-cn-strength" className="text-xs text-gray-500">Strength:</label>
                  <input
                    id="studio-cn-strength"
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
            <label htmlFor="studio-neg-prompt" className="block text-xs text-gray-500 mb-1">
              Negative Prompt
            </label>
            <textarea
              id="studio-neg-prompt"
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
              <label htmlFor="studio-sampler" className="block text-xs text-gray-500">Sampler</label>
              <select
                id="studio-sampler"
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
              <label htmlFor="studio-scheduler" className="block text-xs text-gray-500">Scheduler</label>
              <select
                id="studio-scheduler"
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

          {/* Steps / CFG / Seed */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="studio-steps" className="block text-xs text-gray-500">Steps</label>
              <input
                id="studio-steps"
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
              <label htmlFor="studio-cfg" className="block text-xs text-gray-500">CFG Scale</label>
              <input
                id="studio-cfg"
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
            <div>
              <label htmlFor="studio-seed" className="block text-xs text-gray-500">Seed</label>
              <input
                id="studio-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Random"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          {/* Width / Height */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="studio-width" className="block text-xs text-gray-500">Width</label>
              <input
                id="studio-width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="Default"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="studio-height" className="block text-xs text-gray-500">Height</label>
              <input
                id="studio-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Default"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>
      </details>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isGenerating || !name || !prompt}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {isGenerating ? "Generating..." : "Generate Asset"}
      </button>
    </div>
  );
}
