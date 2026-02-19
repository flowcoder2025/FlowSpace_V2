// ComfyUI API Types

/** ComfyUI 연결 설정 */
export interface ComfyUIConfig {
  baseUrl: string;
  wsUrl: string;
  mockMode: boolean;
  timeout: number;
}

/** ComfyUI 워크플로우 노드 */
export interface ComfyUINode {
  class_type: string;
  inputs: Record<string, unknown>;
}

/** ComfyUI 워크플로우 (prompt API 형식) */
export interface ComfyUIWorkflow {
  [nodeId: string]: ComfyUINode;
}

/** POST /prompt 요청 */
export interface QueuePromptRequest {
  prompt: ComfyUIWorkflow;
  client_id?: string;
}

/** POST /prompt 응답 */
export interface QueuePromptResponse {
  prompt_id: string;
  number: number;
}

/** GET /history/{id} 응답 내 출력 */
export interface HistoryOutput {
  images?: Array<{
    filename: string;
    subfolder: string;
    type: string;
  }>;
}

/** GET /history/{id} 응답 */
export interface HistoryEntry {
  prompt: [number, string, ComfyUIWorkflow, Record<string, unknown>];
  outputs: Record<string, HistoryOutput>;
  status: {
    status_str: string;
    completed: boolean;
  };
}

/** WebSocket 메시지 타입 */
export type WSMessageType =
  | "status"
  | "execution_start"
  | "execution_cached"
  | "executing"
  | "progress"
  | "executed"
  | "execution_error";

/** WebSocket 메시지 */
export interface WSMessage {
  type: WSMessageType;
  data: Record<string, unknown>;
}

/** 에셋 생성 파라미터 */
export interface GenerateAssetParams {
  type: "character" | "tileset" | "object" | "map";
  prompt: string;
  name: string;
  seed?: number;
  width?: number;
  height?: number;
  additionalParams?: Record<string, unknown>;
}

/** 에셋 생성 결과 */
export interface GenerateAssetResult {
  promptId: string;
  status: "queued" | "processing" | "completed" | "failed";
  images?: Array<{
    filename: string;
    data?: Buffer;
  }>;
  error?: string;
}
