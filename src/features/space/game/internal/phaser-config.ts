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
    // Scale.RESIZE 모드에서는 width/height가 초기값. parent 크기에 맞춰 동적으로 조정됨.
    width: options.width ?? options.parent.clientWidth ?? 960,
    height: options.height ?? options.parent.clientHeight ?? 640,
    backgroundColor: "#0a0a0a",
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scale: {
      // RESIZE: 캔버스가 parent 요소 크기에 맞춰 자동 조정.
      // 게임 월드 좌표는 그대로, 카메라가 더 넓은 영역을 표시.
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
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
