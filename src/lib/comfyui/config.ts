import type { ComfyUIConfig } from "./types";

const DEFAULT_COMFYUI_URL = "http://localhost:8188";

export function getComfyUIConfig(): ComfyUIConfig {
  const baseUrl = process.env.COMFYUI_URL || DEFAULT_COMFYUI_URL;
  const mockMode = process.env.COMFYUI_MOCK_MODE === "true";
  const wsUrl = baseUrl.replace("http", "ws");

  return {
    baseUrl,
    wsUrl: `${wsUrl}/ws`,
    mockMode,
    timeout: 30000,
  };
}
