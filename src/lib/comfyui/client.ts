import { getComfyUIConfig } from "./config";
import type {
  ComfyUIMode,
  ComfyUIWorkflow,
  ComfyUIStatus,
  QueuePromptResponse,
  HistoryEntry,
  GenerateAssetParams,
  GenerateAssetResult,
} from "./types";
import { ComfyUIError } from "./types";

const MODE_CACHE_TTL = 30_000;

/**
 * ComfyUI REST API Client
 *
 * POST /prompt - 워크플로우 실행 큐 등록
 * GET /history/{id} - 실행 결과 조회
 * GET /view - 생성된 이미지 조회
 */
export class ComfyUIClient {
  private baseUrl: string;
  private mode: ComfyUIMode;
  private timeout: number;
  private resolvedModeCache: { value: "mock" | "real"; expiresAt: number } | null = null;

  constructor() {
    const config = getComfyUIConfig();
    this.baseUrl = config.baseUrl;
    this.mode = config.mode;
    this.timeout = config.timeout;
  }

  /** 실제 동작 모드 결정 (auto일 때 연결 체크 후 캐시) */
  private async resolveEffectiveMode(): Promise<"mock" | "real"> {
    if (this.mode === "mock") return "mock";
    if (this.mode === "real") return "real";

    // auto: check cache first
    if (this.resolvedModeCache && Date.now() < this.resolvedModeCache.expiresAt) {
      return this.resolvedModeCache.value;
    }

    const connected = await this.pingServer();
    const resolved = connected ? "real" : "mock";

    this.resolvedModeCache = {
      value: resolved,
      expiresAt: Date.now() + MODE_CACHE_TTL,
    };

    if (!connected) {
      console.warn(
        `[ComfyUI] auto mode: 서버 연결 실패 (${this.baseUrl}), mock 모드로 폴백`
      );
    }

    return resolved;
  }

  /** ComfyUI 서버 ping */
  private async pingServer(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/system_stats`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /** ComfyUI 서버 연결 확인 */
  async checkConnection(): Promise<boolean> {
    const effectiveMode = await this.resolveEffectiveMode();
    if (effectiveMode === "mock") return true;
    return this.pingServer();
  }

  /** 현재 상태 조회 */
  async getStatus(): Promise<ComfyUIStatus> {
    const resolvedMode = await this.resolveEffectiveMode();
    const connected = resolvedMode === "real" ? await this.pingServer() : false;

    return {
      connected,
      url: this.baseUrl,
      mode: this.mode,
      resolvedMode,
    };
  }

  /** 워크플로우 실행 큐에 등록 */
  async queuePrompt(workflow: ComfyUIWorkflow): Promise<QueuePromptResponse> {
    const effectiveMode = await this.resolveEffectiveMode();
    if (effectiveMode === "mock") {
      return this.mockQueuePrompt();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new ComfyUIError(
          `ComfyUI queue failed: ${response.status} - ${error}`,
          response.status === 400 ? "INVALID_WORKFLOW" : "UNKNOWN"
        );
      }

      return (await response.json()) as QueuePromptResponse;
    } catch (error) {
      clearTimeout(timeoutId);
      throw ComfyUIError.fromError(error);
    }
  }

  /** 실행 결과 조회 */
  async getHistory(promptId: string): Promise<HistoryEntry | null> {
    const effectiveMode = await this.resolveEffectiveMode();
    if (effectiveMode === "mock") {
      return this.mockGetHistory(promptId);
    }

    try {
      const response = await fetch(`${this.baseUrl}/history/${promptId}`);

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as Record<string, HistoryEntry>;
      return data[promptId] || null;
    } catch (error) {
      throw ComfyUIError.fromError(error);
    }
  }

  /** 생성된 이미지 다운로드 */
  async getImage(
    filename: string,
    subfolder: string,
    type: string
  ): Promise<ArrayBuffer> {
    const effectiveMode = await this.resolveEffectiveMode();
    if (effectiveMode === "mock") {
      return this.mockGetImage();
    }

    try {
      const params = new URLSearchParams({ filename, subfolder, type });
      const response = await fetch(`${this.baseUrl}/view?${params}`);

      if (!response.ok) {
        throw new ComfyUIError(
          `Failed to get image: ${response.status}`,
          "UNKNOWN"
        );
      }

      return response.arrayBuffer();
    } catch (error) {
      throw ComfyUIError.fromError(error);
    }
  }

  /** 실행 완료까지 폴링 */
  async waitForCompletion(
    promptId: string,
    pollInterval = 1000,
    maxWait = 300000
  ): Promise<HistoryEntry> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const history = await this.getHistory(promptId);

      if (history) {
        // 에러 감지: status_str === 'error' 시 즉시 실패
        if (history.status.status_str === "error") {
          const errorDetails = history.status.messages
            ?.map(([type, data]) => `${type}: ${JSON.stringify(data)}`)
            .join("; ") || "unknown error";
          throw new ComfyUIError(
            `ComfyUI execution failed for prompt ${promptId}: ${errorDetails}`,
            "UNKNOWN"
          );
        }

        if (history.status.completed) {
          return history;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new ComfyUIError(
      `Timeout waiting for prompt ${promptId}`,
      "TIMEOUT"
    );
  }

  /** ComfyUI 오브젝트 정보 조회 (노드/모델 목록) */
  async getObjectInfo(): Promise<Record<string, unknown>> {
    const effectiveMode = await this.resolveEffectiveMode();
    if (effectiveMode === "mock") {
      return {};
    }

    try {
      const response = await fetch(`${this.baseUrl}/object_info`);
      if (!response.ok) {
        return {};
      }
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** 에셋 생성 (high-level API) */
  async generateAsset(
    params: GenerateAssetParams,
    workflow: ComfyUIWorkflow
  ): Promise<GenerateAssetResult> {
    try {
      const queueResult = await this.queuePrompt(workflow);

      const history = await this.waitForCompletion(queueResult.prompt_id);

      const images: GenerateAssetResult["images"] = [];
      for (const output of Object.values(history.outputs)) {
        if (output.images) {
          for (const img of output.images) {
            const data = await this.getImage(
              img.filename,
              img.subfolder,
              img.type
            );
            images.push({
              filename: img.filename,
              data: Buffer.from(data),
            });
          }
        }
      }

      return {
        promptId: queueResult.prompt_id,
        status: "completed",
        images,
      };
    } catch (error) {
      const comfyError = ComfyUIError.fromError(error);
      return {
        promptId: "",
        status: "failed",
        error: comfyError.message,
      };
    }
  }

  // ============================================
  // Mock implementations
  // ============================================

  private mockQueuePrompt(): QueuePromptResponse {
    return {
      prompt_id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number: 1,
    };
  }

  private mockGetHistory(promptId: string): HistoryEntry {
    return {
      prompt: [1, promptId, {}, {}],
      outputs: {
        "9": {
          images: [
            {
              filename: `mock_output_${Date.now()}.png`,
              subfolder: "",
              type: "output",
            },
          ],
        },
      },
      status: {
        status_str: "success",
        completed: true,
      },
    };
  }

  private mockGetImage(): ArrayBuffer {
    // 1x1 transparent PNG
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return png.buffer;
  }
}
