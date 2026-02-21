"use client";

import { useState, useEffect } from "react";
import { useAssetStore } from "@/stores/asset-store";
import { GenerationProgress } from "./generation-progress";

const ASSET_TYPES = [
  {
    value: "character",
    label: "캐릭터 스프라이트",
    description: "4방향 걷기 애니메이션 (8x4 그리드, 64x64px)",
    tooltip: "4방향(상/하/좌/우) 걷기 모션이 포함된 캐릭터 스프라이트시트를 생성합니다.",
  },
  {
    value: "tileset",
    label: "타일셋",
    description: "맵 타일셋 (16x14 그리드, 32x32px)",
    tooltip: "맵 에디터에서 사용할 타일셋 이미지를 생성합니다.",
  },
  {
    value: "object",
    label: "오브젝트",
    description: "게임 오브젝트 (최대 128x128px)",
    tooltip: "맵에 배치할 수 있는 단일 오브젝트를 생성합니다.",
  },
  {
    value: "map",
    label: "맵 배경",
    description: "배경 이미지 (기본 1024x768px)",
    tooltip: "스페이스의 배경으로 사용할 전체 맵 이미지를 생성합니다.",
  },
] as const;

const QUALITY_PRESETS = [
  { value: "", label: "기본값", description: "워크플로우 기본 설정 사용" },
  { value: "draft", label: "초안", description: "빠른 미리보기 (15 스텝)" },
  { value: "standard", label: "표준", description: "기본 품질 (25 스텝)" },
  { value: "high", label: "고품질", description: "최고 품질 (40 스텝)" },
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
          throw new Error(data.error || "배치 생성 실패");
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
        throw new Error(data.error || "생성 실패");
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
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
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
      {/* 에셋 유형 선택 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          에셋 유형
        </label>
        <div className="grid grid-cols-2 gap-3">
          {ASSET_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              title={t.tooltip}
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

      {/* 워크플로우 선택 */}
      {filteredWorkflows.length > 0 && (
        <div>
          <label
            htmlFor="workflow-select"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            워크플로우
          </label>
          <select
            id="workflow-select"
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="">기본값</option>
            {filteredWorkflows.map((w) => (
              <option key={w.id} value={w.name}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* 이름 */}
      <div>
        <label
          htmlFor="asset-name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          이름
          <span className="ml-1 text-gray-400 font-normal" title="에셋의 식별 이름입니다. 영문 소문자와 밑줄(_)을 사용하세요.">(?)</span>
        </label>
        <input
          id="asset-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: office_worker, forest_tiles"
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 프롬프트 */}
      <div>
        <label
          htmlFor="asset-prompt"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          프롬프트
          <span className="ml-1 text-gray-400 font-normal" title="생성할 에셋의 외형을 영어로 설명합니다. 상세할수록 결과물이 정확합니다.">(?)</span>
        </label>
        <textarea
          id="asset-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="생성할 에셋의 외형을 영어로 설명하세요..."
          required
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
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
          {/* 배경 제거 */}
          {(type === "character" || type === "object") && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" title="생성된 이미지에서 배경을 자동으로 투명 처리합니다.">
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
                  <label htmlFor="form-bg-tol" className="text-xs text-gray-500">허용치:</label>
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

          {/* 심리스 타일링 */}
          {type === "tileset" && (
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer" title="타일 경계가 자연스럽게 이어지도록 생성합니다.">
              <input
                type="checkbox"
                checked={seamless}
                onChange={(e) => setSeamless(e.target.checked)}
                className="rounded border-gray-300"
              />
              심리스 타일링 (타일 경계 이음매 없음)
            </label>
          )}

          {/* ControlNet */}
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
                  <span className="text-amber-500" title="ComfyUI에 ControlNet 모델이 감지되지 않았습니다. ComfyUI Manager에서 설치하세요.">(설정 필요)</span>
                )}
              </label>
              {useControlNet && controlNetAvailable && (
                <div className="flex items-center gap-2 ml-5">
                  <label htmlFor="form-cn-strength" className="text-xs text-gray-500">강도:</label>
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

          {/* 네거티브 프롬프트 */}
          <div>
            <label htmlFor="form-neg-prompt" className="block text-xs text-gray-500 mb-1" title="생성 결과에서 제외하고 싶은 요소를 설명합니다.">
              네거티브 프롬프트
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

          {/* 샘플러 / 스케줄러 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="form-sampler" className="block text-xs text-gray-500" title="이미지 생성에 사용할 샘플링 알고리즘입니다.">샘플러</label>
              <select
                id="form-sampler"
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
              <label htmlFor="form-scheduler" className="block text-xs text-gray-500" title="노이즈 제거 스케줄 방식입니다.">스케줄러</label>
              <select
                id="form-scheduler"
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

          {/* 스텝 / CFG */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="form-steps" className="block text-xs text-gray-500" title="생성 반복 횟수입니다. 높을수록 정교하지만 느립니다.">스텝</label>
              <input
                id="form-steps"
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
              <label htmlFor="form-cfg" className="block text-xs text-gray-500" title="프롬프트 충실도입니다. 보통 5~10이 적합합니다.">CFG 스케일</label>
              <input
                id="form-cfg"
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
          </div>
        </div>
      </details>

      {/* 배치 목록 */}
      {batchItems.length > 0 && (
        <div className="border border-gray-200 rounded-md p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">
            배치 대기열 ({batchItems.length}개)
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
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 진행률 */}
      {activeAssetId && (
        <GenerationProgress
          assetId={activeAssetId}
          onComplete={() => setActiveAssetId(null)}
        />
      )}

      {/* 액션 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={addToBatch}
          disabled={!name || !prompt}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          + 배치에 추가
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name || !prompt}
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting
            ? "생성 중..."
            : batchItems.length > 0
              ? `배치 생성 (${batchItems.length + 1}개)`
              : "에셋 생성"}
        </button>
      </div>
    </form>
  );
}
