import { ComfyUIClient } from "@/lib/comfyui";

export interface ComfyUICapabilities {
  controlNet: boolean;
  controlNetModels: string[];
  hasAnimagineXL: boolean;
  hasChibiLoRA: boolean;
  hasOpenPoseXL: boolean;
  checkpointModels: string[];
  loraModels: string[];
  hasIPAdapter: boolean;
  hasIPAdapterPlus: boolean;
  hasCLIPVision: boolean;
  ipAdapterModels: string[];
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
      hasAnimagineXL: false,
      hasChibiLoRA: false,
      hasOpenPoseXL: false,
      checkpointModels: [],
      loraModels: [],
      hasIPAdapter: false,
      hasIPAdapterPlus: false,
      hasCLIPVision: false,
      ipAdapterModels: [],
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

    // 체크포인트 모델 목록
    let checkpointModels: string[] = [];
    if (objectInfo["CheckpointLoaderSimple"]) {
      const ckptInfo = objectInfo["CheckpointLoaderSimple"] as {
        input?: { required?: { ckpt_name?: [string[]] } };
      };
      checkpointModels = ckptInfo.input?.required?.ckpt_name?.[0] || [];
    }

    // LoRA 모델 목록
    let loraModels: string[] = [];
    if (objectInfo["LoraLoader"]) {
      const loraInfo = objectInfo["LoraLoader"] as {
        input?: { required?: { lora_name?: [string[]] } };
      };
      loraModels = loraInfo.input?.required?.lora_name?.[0] || [];
    }

    const hasAnimagineXL = checkpointModels.some((m) =>
      m.toLowerCase().includes("animaginexl")
    );
    const hasChibiLoRA = loraModels.some((m) =>
      m.toLowerCase().includes("chibistyle") || m.toLowerCase().includes("yuugiri")
    );
    const hasOpenPoseXL = controlNetModels.some((m) =>
      m.toLowerCase().includes("openposexl")
    );

    // IP-Adapter 노드 존재 확인
    const hasIPAdapter =
      !!objectInfo["IPAdapterModelLoader"] || !!objectInfo["IPAdapterAdvanced"];

    // IP-Adapter 모델 목록 추출
    let ipAdapterModels: string[] = [];
    if (hasIPAdapter && objectInfo["IPAdapterModelLoader"]) {
      const ipaInfo = objectInfo["IPAdapterModelLoader"] as {
        input?: { required?: { ipadapter_file?: [string[]] } };
      };
      ipAdapterModels =
        ipaInfo.input?.required?.ipadapter_file?.[0] || [];
    }

    const hasIPAdapterPlus = ipAdapterModels.some((m) =>
      m.toLowerCase().includes("ip-adapter-plus") &&
      m.toLowerCase().includes("sdxl")
    );

    // CLIP Vision 모델 확인
    let clipVisionModels: string[] = [];
    if (objectInfo["CLIPVisionLoader"]) {
      const clipInfo = objectInfo["CLIPVisionLoader"] as {
        input?: { required?: { clip_name?: [string[]] } };
      };
      clipVisionModels =
        clipInfo.input?.required?.clip_name?.[0] || [];
    }

    const hasCLIPVision = clipVisionModels.some((m) =>
      m.toLowerCase().includes("clip-vit-h")
    );

    const result: ComfyUICapabilities = {
      controlNet: hasControlNet && controlNetModels.length > 0,
      controlNetModels,
      hasAnimagineXL,
      hasChibiLoRA,
      hasOpenPoseXL,
      checkpointModels,
      loraModels,
      hasIPAdapter,
      hasIPAdapterPlus,
      hasCLIPVision,
      ipAdapterModels,
      checkedAt: Date.now(),
    };
    capabilityCache = result;
    return result;
  } catch {
    const result: ComfyUICapabilities = {
      controlNet: false,
      controlNetModels: [],
      hasAnimagineXL: false,
      hasChibiLoRA: false,
      hasOpenPoseXL: false,
      checkpointModels: [],
      loraModels: [],
      hasIPAdapter: false,
      hasIPAdapterPlus: false,
      hasCLIPVision: false,
      ipAdapterModels: [],
      checkedAt: Date.now(),
    };
    capabilityCache = result;
    return result;
  }
}
