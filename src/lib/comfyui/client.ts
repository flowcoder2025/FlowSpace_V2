import { getComfyUIConfig } from "./config";
import type {
  ComfyUIWorkflow,
  QueuePromptResponse,
  HistoryEntry,
  GenerateAssetParams,
  GenerateAssetResult,
} from "./types";

/**
 * ComfyUI REST API Client
 *
 * POST /prompt - 워크플로우 실행 큐 등록
 * GET /history/{id} - 실행 결과 조회
 * GET /view - 생성된 이미지 조회
 * WS /ws - 실시간 진행률 (추후 구현)
 */
export class ComfyUIClient {
  private baseUrl: string;
  private mockMode: boolean;
  private timeout: number;

  constructor() {
    const config = getComfyUIConfig();
    this.baseUrl = config.baseUrl;
    this.mockMode = config.mockMode;
    this.timeout = config.timeout;
  }

  /** ComfyUI 서버 연결 확인 */
  async checkConnection(): Promise<boolean> {
    if (this.mockMode) return true;

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

  /** 워크플로우 실행 큐에 등록 */
  async queuePrompt(workflow: ComfyUIWorkflow): Promise<QueuePromptResponse> {
    if (this.mockMode) {
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
        throw new Error(`ComfyUI queue failed: ${response.status} - ${error}`);
      }

      return (await response.json()) as QueuePromptResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** 실행 결과 조회 */
  async getHistory(promptId: string): Promise<HistoryEntry | null> {
    if (this.mockMode) {
      return this.mockGetHistory(promptId);
    }

    const response = await fetch(`${this.baseUrl}/history/${promptId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, HistoryEntry>;
    return data[promptId] || null;
  }

  /** 생성된 이미지 다운로드 */
  async getImage(
    filename: string,
    subfolder: string,
    type: string
  ): Promise<ArrayBuffer> {
    if (this.mockMode) {
      return this.mockGetImage();
    }

    const params = new URLSearchParams({ filename, subfolder, type });
    const response = await fetch(`${this.baseUrl}/view?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to get image: ${response.status}`);
    }

    return response.arrayBuffer();
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

      if (history && history.status.completed) {
        return history;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(`Timeout waiting for prompt ${promptId}`);
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
      return {
        promptId: "",
        status: "failed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
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
