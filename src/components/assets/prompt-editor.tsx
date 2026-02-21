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
  {
    value: "character",
    label: "캐릭터 스프라이트",
    description: "4방향 걷기 애니메이션 (8x4 그리드, 64x64px 프레임)",
    tooltip: "4방향(상/하/좌/우) 걷기 모션이 포함된 캐릭터 스프라이트시트를 생성합니다. 프롬프트에 캐릭터 외형을 설명하세요.",
  },
  {
    value: "tileset",
    label: "타일셋",
    description: "맵 타일셋 (16x14 그리드, 32x32px 타일)",
    tooltip: "맵 에디터에서 사용할 타일셋 이미지를 생성합니다. 바닥, 벽, 장식 등 원하는 환경을 설명하세요.",
  },
  {
    value: "object",
    label: "오브젝트",
    description: "게임 오브젝트 (최대 128x128px)",
    tooltip: "맵에 배치할 수 있는 단일 오브젝트를 생성합니다. 가구, 장식물, 아이템 등을 설명하세요.",
  },
  {
    value: "map",
    label: "맵 배경",
    description: "배경 이미지 (1024x768px)",
    tooltip: "스페이스의 배경으로 사용할 전체 맵 이미지를 생성합니다. 원하는 장소와 분위기를 설명하세요.",
  },
] as const;

const PRESET_PROMPTS: Record<string, { text: string; label: string }[]> = {
  character: [
    { text: "medieval knight with silver armor", label: "은갑옷 기사" },
    { text: "wizard with blue robe and staff", label: "파란 로브 마법사" },
    { text: "office worker in business suit", label: "정장 직장인" },
  ],
  tileset: [
    { text: "grass, dirt, water, stone tiles for forest", label: "숲 타일" },
    { text: "wooden floor, carpet, wall tiles for office", label: "사무실 타일" },
    { text: "sand, water, coral tiles for beach", label: "해변 타일" },
  ],
  object: [
    { text: "wooden desk with computer", label: "컴퓨터 책상" },
    { text: "potted plant, green leaves", label: "화분" },
    { text: "treasure chest, golden", label: "보물 상자" },
  ],
  map: [
    { text: "cozy office interior with desks", label: "사무실 내부" },
    { text: "forest clearing with pond", label: "숲속 연못" },
    { text: "medieval castle courtyard", label: "중세 성 안뜰" },
  ],
};

const QUALITY_PRESETS = [
  { value: "", label: "기본값", description: "워크플로우 기본 설정 사용" },
  { value: "draft", label: "초안", description: "빠른 미리보기 (15 스텝, 저품질)" },
  { value: "standard", label: "표준", description: "기본 품질 (25 스텝)" },
  { value: "high", label: "고품질", description: "최고 품질 (40 스텝, 느림)" },
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
      {/* 에셋 타입 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          에셋 유형
          <span className="ml-1 text-gray-400 font-normal" title="생성할 에셋의 종류를 선택합니다. 각 유형마다 최적화된 워크플로우가 적용됩니다.">(?)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              title={t.tooltip}
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

      {/* 이름 */}
      <div>
        <label htmlFor="studio-name" className="block text-sm font-medium text-gray-700 mb-1">
          이름
          <span className="ml-1 text-gray-400 font-normal" title="에셋 파일의 식별 이름입니다. 영문 소문자와 밑줄(_)을 사용하세요.">(?)</span>
        </label>
        <input
          id="studio-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: office_worker, forest_tiles"
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 프롬프트 */}
      <div>
        <label htmlFor="studio-prompt" className="block text-sm font-medium text-gray-700 mb-1">
          프롬프트
          <span className="ml-1 text-gray-400 font-normal" title="생성할 에셋의 외형을 영어로 설명합니다. 상세할수록 결과물이 정확합니다. 예: pixel art knight, silver armor, blue cape">(?)</span>
        </label>
        <textarea
          id="studio-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="생성할 에셋의 외형을 영어로 설명하세요..."
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        {/* 프리셋 */}
        {presets.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {presets.map((p) => (
              <button
                key={p.text}
                type="button"
                onClick={() => setPrompt(p.text)}
                title={p.text}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded px-2 py-0.5"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 품질 프리셋 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          품질
          <span className="ml-1 text-gray-400 font-normal" title="생성 품질을 선택합니다. 높을수록 정교하지만 시간이 더 걸립니다.">(?)</span>
        </label>
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

      {/* 고급 설정 */}
      <details className="text-sm">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
          고급 설정
        </summary>
        <div className="mt-2 space-y-3">
          {/* 배경 제거 (캐릭터/오브젝트) */}
          {(type === "character" || type === "object") && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" title="생성된 이미지에서 배경을 자동으로 투명 처리합니다. 캐릭터와 오브젝트에 권장됩니다.">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="rounded border-gray-300"
                />
                배경 제거
              </label>
              {removeBg && (
                <div className="flex items-center gap-1">
                  <label htmlFor="studio-bg-tol" className="text-xs text-gray-500" title="배경 제거 민감도입니다. 높을수록 더 많은 영역을 배경으로 처리합니다.">허용치:</label>
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

          {/* Seamless 타일링 (타일셋) */}
          {type === "tileset" && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" title="타일 경계가 자연스럽게 이어지도록 생성합니다. 반복 배치 시 이음매가 보이지 않습니다.">
              <input
                type="checkbox"
                checked={seamless}
                onChange={(e) => setSeamless(e.target.checked)}
                className="rounded border-gray-300"
              />
              심리스 타일링 (타일 경계 이음매 없음)
            </label>
          )}

          {/* ControlNet (캐릭터) */}
          {type === "character" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" title="포즈 참조 이미지를 사용하여 캐릭터의 자세를 제어합니다. ComfyUI에 ControlNet 모델이 설치되어 있어야 합니다.">
                <input
                  type="checkbox"
                  checked={useControlNet}
                  onChange={(e) => setUseControlNet(e.target.checked)}
                  disabled={!controlNetAvailable}
                  className="rounded border-gray-300"
                />
                ControlNet 포즈 가이드
                {!controlNetAvailable && (
                  <span className="text-amber-500" title="ComfyUI에 ControlNet 모델이 감지되지 않았습니다. ComfyUI Manager에서 ControlNet Auxiliary Preprocessors를 설치하고 모델을 다운로드하세요.">(설정 필요)</span>
                )}
              </label>
              {useControlNet && controlNetAvailable && (
                <div className="flex items-center gap-2 ml-5">
                  <label htmlFor="studio-cn-strength" className="text-xs text-gray-500" title="포즈 가이드의 영향력입니다. 1에 가까울수록 참조 포즈를 충실히 따릅니다.">강도:</label>
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

          {/* 네거티브 프롬프트 */}
          <div>
            <label htmlFor="studio-neg-prompt" className="block text-xs text-gray-500 mb-1" title="생성 결과에서 제외하고 싶은 요소를 설명합니다. 비워두면 유형별 기본값이 자동 적용됩니다.">
              네거티브 프롬프트
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

          {/* 샘플러 / 스케줄러 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="studio-sampler" className="block text-xs text-gray-500" title="이미지 생성에 사용할 샘플링 알고리즘입니다. euler_ancestral이 픽셀아트에 적합합니다.">샘플러</label>
              <select
                id="studio-sampler"
                value={samplerName}
                onChange={(e) => setSamplerName(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">기본값</option>
                {SAMPLER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="studio-scheduler" className="block text-xs text-gray-500" title="노이즈 제거 스케줄 방식입니다. karras는 고품질, normal은 표준입니다.">스케줄러</label>
              <select
                id="studio-scheduler"
                value={scheduler}
                onChange={(e) => setScheduler(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              >
                <option value="">기본값</option>
                {SCHEDULER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 스텝 / CFG / 시드 */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label htmlFor="studio-steps" className="block text-xs text-gray-500" title="생성 반복 횟수입니다. 높을수록 정교하지만 느립니다. 비워두면 품질 프리셋에 따라 자동 설정됩니다.">스텝</label>
              <input
                id="studio-steps"
                type="number"
                min={1}
                max={100}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                placeholder="자동"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="studio-cfg" className="block text-xs text-gray-500" title="프롬프트 충실도입니다. 높을수록 프롬프트를 엄격히 따르지만 너무 높으면 부자연스럽습니다. 보통 5~10이 적합합니다.">CFG 스케일</label>
              <input
                id="studio-cfg"
                type="number"
                min={1}
                max={30}
                step={0.5}
                value={cfgScale}
                onChange={(e) => setCfgScale(e.target.value)}
                placeholder="자동"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="studio-seed" className="block text-xs text-gray-500" title="같은 시드값으로 같은 프롬프트를 실행하면 동일한 결과를 얻습니다. 비워두면 매번 다른 결과가 생성됩니다.">시드</label>
              <input
                id="studio-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="랜덤"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>

          {/* 너비 / 높이 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="studio-width" className="block text-xs text-gray-500" title="출력 이미지의 너비(px)입니다. 비워두면 에셋 유형에 맞는 기본값이 적용됩니다.">너비</label>
              <input
                id="studio-width"
                type="number"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="기본값"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label htmlFor="studio-height" className="block text-xs text-gray-500" title="출력 이미지의 높이(px)입니다. 비워두면 에셋 유형에 맞는 기본값이 적용됩니다.">높이</label>
              <input
                id="studio-height"
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="기본값"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>
      </details>

      {/* 생성 버튼 */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isGenerating || !name || !prompt}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
      >
        {isGenerating ? "생성 중..." : "에셋 생성"}
      </button>
    </div>
  );
}
