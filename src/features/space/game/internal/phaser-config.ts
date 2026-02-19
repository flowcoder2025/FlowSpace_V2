/**
 * Phaser GameConfig 팩토리
 *
 * Arcade Physics, pixelArt, Scale.FIT 기본 설정
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
    pixelArt: true,
    backgroundColor: "#1a1a2e",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: options.scenes,
    render: {
      antialias: false,
      roundPixels: true,
    },
    audio: {
      noAudio: true,
    },
  };
}

export { MAP_WIDTH, MAP_HEIGHT };
