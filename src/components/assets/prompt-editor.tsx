"use client";

import { useState, useCallback } from "react";

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

export function PromptEditor({ onGenerate, isGenerating }: PromptEditorProps) {
  const [type, setType] = useState<GenerateParams["type"]>("character");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");

  const handleSubmit = useCallback(() => {
    if (!name || !prompt) return;
    onGenerate({
      type,
      name,
      prompt,
      seed: seed ? parseInt(seed, 10) : undefined,
      width: width ? parseInt(width, 10) : undefined,
      height: height ? parseInt(height, 10) : undefined,
    });
  }, [type, name, prompt, seed, width, height, onGenerate]);

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

      {/* Advanced Parameters */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          Advanced Parameters
        </summary>
        <div className="mt-2 grid grid-cols-3 gap-2">
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
