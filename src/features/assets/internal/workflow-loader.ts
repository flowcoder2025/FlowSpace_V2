import { readFile } from "fs/promises";
import { join } from "path";
import type { ComfyUIWorkflow } from "@/lib/comfyui";
import type { AssetType, WorkflowMeta } from "./types";

const WORKFLOW_DIR = join(process.cwd(), "comfyui-workflows");

/** 워크플로우 파일명 매핑 (기본 + variant) */
const WORKFLOW_FILES: Record<string, string> = {
  character: "character-sprite.json",
  tileset: "tileset-grid.json",
  object: "object-item.json",
  map: "map-background.json",
  "tileset-seamless": "tileset-seamless.json",
  "character-controlnet": "character-controlnet.json",
  "character-chibi-frame": "character-chibi-frame.json",
  "character-chibi-fallback": "character-chibi-fallback.json",
};

interface WorkflowFile {
  _meta: WorkflowMeta;
  [nodeId: string]: unknown;
}

/** 워크플로우 템플릿 로드 (variant 지원) */
export async function loadWorkflowTemplate(
  type: AssetType,
  variant?: string
): Promise<{ meta: WorkflowMeta; workflow: ComfyUIWorkflow }> {
  const key = variant ? `${type}-${variant}` : type;
  const filename = WORKFLOW_FILES[key] || WORKFLOW_FILES[type];
  const filePath = join(WORKFLOW_DIR, filename);
  const content = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(content) as WorkflowFile;

  const meta = parsed._meta;

  // _meta 제거하여 순수 워크플로우 추출
  const workflow: ComfyUIWorkflow = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== "_meta") {
      workflow[key] = value as ComfyUIWorkflow[string];
    }
  }

  return { meta, workflow };
}

/** 워크플로우에 파라미터 주입 */
export function injectWorkflowParams(
  workflow: ComfyUIWorkflow,
  meta: WorkflowMeta,
  params: Record<string, unknown>
): ComfyUIWorkflow {
  const injected = JSON.parse(JSON.stringify(workflow)) as ComfyUIWorkflow;

  for (const [paramName, paramDef] of Object.entries(meta.parameters)) {
    const value = params[paramName] ?? paramDef.default;
    if (value !== undefined && injected[paramDef.nodeId]) {
      injected[paramDef.nodeId].inputs[paramDef.field] = value;
    }
  }

  return injected;
}
