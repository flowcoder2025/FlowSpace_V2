/**
 * Phaser GameConfig 팩토리
 *
 * Arcade Physics, Scale.RESIZE (parent 크기에 맞춰 동적 캔버스 — 풀스크린 게임 룸)
 */

import { MAP_WIDTH, MAP_HEIGHT } from "@/constants/game-constants";

interface PhaserConfigOptions {
  parent: HTMLElement;
  scenes: Array<new (...args: unknown[]) => Phaser.Scene>;
  width?: number;
  height?: number;
}

export function createPhaserConfig(
  options: PhaserConfigOptions
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: options.parent,
    width: options.width ?? 960,
    height: options.height ?? 640,
    backgroundColor: "#0a0a0a",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      // 진단: Scale.RESIZE 도입 후 LiveKit 카메라 타임아웃 발생 — GPU 압박 가설 검증을 위해 FIT 임시 원복
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: options.scenes,
    render: {
      antialias: true,
      roundPixels: false,
    },
    audio: {
      noAudio: true,
    },
  };
}

export { MAP_WIDTH, MAP_HEIGHT };
