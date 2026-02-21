import { ComfyUIClient } from "@/lib/comfyui";

export interface ComfyUICapabilities {
  controlNet: boolean;
  controlNetModels: string[];
  checkedAt: number;
}

const CACHE_TTL = 60_000; // 1분 캐시
let capabilityCache: ComfyUICapabilities | null = null;

/**
 * ComfyUI 서버의 ControlNet 지원 여부를 확인
 *
 * /object_info 엔드포인트를 조회하여 ControlNetLoader 노드 존재 여부 확인.
 * 결과는 1분간 캐시.
 */
export async function checkComfyUICapabilities(): Promise<ComfyUICapabilities> {
  // 캐시 확인
  if (capabilityCache && Date.now() - capabilityCache.checkedAt < CACHE_TTL) {
    return capabilityCache;
  }

  const client = new ComfyUIClient();
  const status = await client.getStatus();

  // mock 모드이거나 연결 불가 시 기능 없음으로 반환
  if (status.resolvedMode === "mock" || !status.connected) {
    const result: ComfyUICapabilities = {
      controlNet: false,
      controlNetModels: [],
      checkedAt: Date.now(),
    };
    capabilityCache = result;
    return result;
  }

  try {
    const objectInfo = await client.getObjectInfo();

    // ControlNetLoader 노드 존재 확인
    const hasControlNet =
      !!objectInfo["ControlNetLoader"] || !!objectInfo["ControlNetApplyAdvanced"];

    // ControlNet 모델 목록 추출
    let controlNetModels: string[] = [];
    if (hasControlNet && objectInfo["ControlNetLoader"]) {
      const loaderInfo = objectInfo["ControlNetLoader"] as {
        input?: { required?: { control_net_name?: [string[]] } };
      };
      controlNetModels =
        loaderInfo.input?.required?.control_net_name?.[0] || [];
    }

    const result: ComfyUICapabilities = {
      controlNet: hasControlNet && controlNetModels.length > 0,
      controlNetModels,
      checkedAt: Date.now(),
    };
    capabilityCache = result;
    return result;
  } catch {
    const result: ComfyUICapabilities = {
      controlNet: false,
      controlNetModels: [],
      checkedAt: Date.now(),
    };
    capabilityCache = result;
    return result;
  }
}
