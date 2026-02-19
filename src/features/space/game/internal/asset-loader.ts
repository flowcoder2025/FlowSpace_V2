/**
 * Phaser Asset Loader
 *
 * AssetRegistry 메타데이터 기반으로 Phaser에 에셋을 로딩합니다.
 * Game Engine contract: 에셋 로딩은 반드시 AssetRegistry 메타데이터 필수
 */

import { eventBridge, GameEvents } from "../events";

/** 에셋 메타데이터 (AssetRegistry 호환) */
export interface LoadableAsset {
  key: string;
  type: "spritesheet" | "image" | "tileset";
  url: string;
  frameWidth?: number;
  frameHeight?: number;
}

/** 에셋 레지스트리에서 로드 가능한 에셋 목록 생성 */
export function createLoadableAssets(
  assets: Array<{
    id: string;
    type: string;
    filePath: string;
    metadata?: Record<string, unknown>;
  }>
): LoadableAsset[] {
  return assets.map((asset) => {
    const meta = asset.metadata || {};

    switch (asset.type) {
      case "CHARACTER":
        return {
          key: `character_${asset.id}`,
          type: "spritesheet" as const,
          url: asset.filePath,
          frameWidth: (meta.frameWidth as number) || 64,
          frameHeight: (meta.frameHeight as number) || 64,
        };

      case "TILESET":
        return {
          key: `tileset_${asset.id}`,
          type: "image" as const,
          url: asset.filePath,
        };

      case "OBJECT":
        return {
          key: `object_${asset.id}`,
          type: "image" as const,
          url: asset.filePath,
        };

      case "MAP":
        return {
          key: `map_${asset.id}`,
          type: "image" as const,
          url: asset.filePath,
        };

      default:
        return {
          key: `asset_${asset.id}`,
          type: "image" as const,
          url: asset.filePath,
        };
    }
  });
}

/**
 * Phaser 씬에서 에셋 로딩 실행
 *
 * @param scene - Phaser.Scene (preload에서 호출)
 * @param assets - 로드할 에셋 목록
 */
export function loadAssetsInScene(
  scene: {
    load: {
      spritesheet: (
        key: string,
        url: string,
        config: { frameWidth: number; frameHeight: number }
      ) => void;
      image: (key: string, url: string) => void;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  },
  assets: LoadableAsset[]
): void {
  for (const asset of assets) {
    try {
      if (asset.type === "spritesheet" && asset.frameWidth && asset.frameHeight) {
        scene.load.spritesheet(asset.key, asset.url, {
          frameWidth: asset.frameWidth,
          frameHeight: asset.frameHeight,
        });
      } else {
        scene.load.image(asset.key, asset.url);
      }
    } catch (error) {
      eventBridge.emit(GameEvents.ASSET_LOAD_ERROR, {
        assetKey: asset.key,
        error: error instanceof Error ? error.message : "Failed to load asset",
      });
    }
  }

  // 로드 에러 이벤트 연결
  scene.load.on("loaderror", (...args: unknown[]) => {
    const file = args[0] as { key: string } | undefined;
    const key = file?.key ?? "unknown";
    eventBridge.emit(GameEvents.ASSET_LOAD_ERROR, {
      assetKey: key,
      error: `Failed to load: ${key}`,
    });
  });
}

/** API에서 에셋 목록 조회 */
export async function fetchGeneratedAssets(): Promise<LoadableAsset[]> {
  try {
    const response = await fetch("/api/assets?status=completed&limit=100");
    if (!response.ok) return [];

    const data = await response.json();
    return createLoadableAssets(data.assets);
  } catch {
    return [];
  }
}
