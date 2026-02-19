import { eventBridge, GameEvents } from "@/features/space/game";

interface AssetMetadata {
  id: string;
  type: string;
  filePath: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * DB에서 에셋 메타데이터 조회 후 Phaser texture 로드를 위한 이벤트 발행
 */
export async function loadAssetToPhaser(assetId: string): Promise<void> {
  try {
    const res = await fetch(`/api/assets/${assetId}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch asset: ${res.statusText}`);
    }

    const asset: AssetMetadata = await res.json();

    if (!asset.filePath) {
      throw new Error("Asset has no file path");
    }

    // EventBridge로 ASSET_GENERATED 이벤트 발행 → Phaser에서 수신
    eventBridge.emit(GameEvents.ASSET_GENERATED, {
      assetId: asset.id,
      type: asset.type,
      metadata: {
        filePath: asset.filePath,
        name: asset.name,
        ...(asset.metadata || {}),
      },
    });
  } catch (error) {
    eventBridge.emit(GameEvents.ASSET_GENERATION_FAILED, {
      error: error instanceof Error ? error.message : "Unknown error",
      params: { assetId },
    });
  }
}

/**
 * 여러 에셋을 Phaser에 로드
 */
export async function loadAssetsToPhaser(assetIds: string[]): Promise<void> {
  await Promise.allSettled(assetIds.map(loadAssetToPhaser));
}
