// ComfyUI API Types

/** ComfyUI 동작 모드 */
export type ComfyUIMode = "auto" | "mock" | "real";

/** ComfyUI 연결 설정 */
export interface ComfyUIConfig {
  baseUrl: string;
  wsUrl: string;
  mode: ComfyUIMode;
  timeout: number;
}

/** ComfyUI 상태 정보 */
export interface ComfyUIStatus {
  connected: boolean;
  url: string;
  mode: ComfyUIMode;
  resolvedMode: "mock" | "real";
}

/** ComfyUI 에러 타입 분류 */
export type ComfyUIErrorType =
  | "CONNECTION_REFUSED"
  | "TIMEOUT"
  | "MISSING_MODEL"
  | "INVALID_WORKFLOW"
  | "QUEUE_FULL"
  | "UNKNOWN";

/** ComfyUI 전용 에러 클래스 */
export class ComfyUIError extends Error {
  constructor(
    message: string,
    public readonly type: ComfyUIErrorType,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ComfyUIError";
  }

  static fromError(error: unknown): ComfyUIError {
    if (error instanceof ComfyUIError) return error;

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    if (
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed")
    ) {
      return new ComfyUIError(
        `ComfyUI 서버에 연결할 수 없습니다: ${message}`,
        "CONNECTION_REFUSED",
        error
      );
    }

    if (message.includes("abort") || message.includes("timeout")) {
      return new ComfyUIError(
        `ComfyUI 요청 시간 초과: ${message}`,
        "TIMEOUT",
        error
      );
    }

    if (message.includes("model") || message.includes("checkpoint")) {
      return new ComfyUIError(
        `ComfyUI 모델을 찾을 수 없습니다: ${message}`,
        "MISSING_MODEL",
        error
      );
    }

    if (message.includes("workflow") || message.includes("prompt")) {
      return new ComfyUIError(
        `유효하지 않은 워크플로우입니다: ${message}`,
        "INVALID_WORKFLOW",
        error
      );
    }

    return new ComfyUIError(message, "UNKNOWN", error);
  }
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
    messages?: Array<[string, Record<string, unknown>]>;
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
