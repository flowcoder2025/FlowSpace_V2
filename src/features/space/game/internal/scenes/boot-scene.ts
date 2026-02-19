/**
 * Boot Scene - 에셋 프리로드 + 로딩바
 *
 * 프로시저럴 타일셋/스프라이트 생성 + API 에셋 로드
 */

import { SCENE_KEYS } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import { fetchGeneratedAssets, loadAssetsInScene } from "../asset-loader";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  preload(): void {
    this.createLoadingBar();
    this.loadAPIAssets();
  }

  create(): void {
    this.scene.start(SCENE_KEYS.MAIN);
  }

  private createLoadingBar(): void {
    const { width, height } = this.scale;
    const barWidth = width * 0.6;
    const barHeight = 20;
    const x = (width - barWidth) / 2;
    const y = height / 2;

    // Background bar
    const bgBar = this.add.graphics();
    bgBar.fillStyle(0x222244, 0.8);
    bgBar.fillRect(x, y, barWidth, barHeight);

    // Progress bar
    const progressBar = this.add.graphics();

    // Loading text
    const loadingText = this.add.text(width / 2, y - 30, "Loading...", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: "monospace",
    });
    loadingText.setOrigin(0.5);

    // Progress events
    this.load.on("progress", (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x4488ff, 1);
      progressBar.fillRect(x + 2, y + 2, (barWidth - 4) * value, barHeight - 4);

      eventBridge.emit(GameEvents.ASSET_PROCESSING_PROGRESS, {
        assetId: "boot",
        progress: Math.round(value * 100),
      });
    });

    this.load.on("complete", () => {
      bgBar.destroy();
      progressBar.destroy();
      loadingText.destroy();
    });
  }

  private loadAPIAssets(): void {
    // API 에셋 로드는 비동기이므로, 이미 캐시된 에셋만 로드
    // 실제 API 에셋은 씬 전환 후 백그라운드 로드
    fetchGeneratedAssets().then((assets) => {
      if (assets.length > 0 && this.scene.isActive(SCENE_KEYS.BOOT)) {
        loadAssetsInScene(this, assets);
        this.load.start();
      }
    });
  }
}
