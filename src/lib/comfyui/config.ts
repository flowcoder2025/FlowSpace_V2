import type { ComfyUIConfig, ComfyUIMode } from "./types";

const DEFAULT_COMFYUI_URL = "http://localhost:8001";

export function getComfyUIConfig(): ComfyUIConfig {
  const baseUrl = process.env.COMFYUI_URL || DEFAULT_COMFYUI_URL;
  const mode = resolveConfigMode();
  const wsUrl = baseUrl.replace("http", "ws");

  return {
    baseUrl,
    wsUrl: `${wsUrl}/ws`,
    mode,
    timeout: 30000,
  };
}

function resolveConfigMode(): ComfyUIMode {
  // New env var takes priority
  const comfyuiMode = process.env.COMFYUI_MODE;
  if (comfyuiMode === "auto" || comfyuiMode === "mock" || comfyuiMode === "real") {
    return comfyuiMode;
  }

  // Backward compat: COMFYUI_MOCK_MODE=true → mock
  if (process.env.COMFYUI_MOCK_MODE === "true") {
    return "mock";
  }

  return "auto";
}
