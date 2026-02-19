/**
 * Game Manager - Phaser.Game 라이프사이클 관리
 *
 * dynamic import로 SSR 회피.
 * registry.set()으로 씬에 옵션 전달.
 */

import { createPhaserConfig } from "./phaser-config";

let gameInstance: Phaser.Game | null = null;

export interface GameOptions {
  spaceId: string;
  userId: string;
  nickname: string;
  avatar: string;
}

/**
 * Phaser 게임 인스턴스 생성
 *
 * @param parent - 캔버스를 마운트할 HTML 요소
 * @param options - 공간/유저 정보
 */
export async function createGame(
  parent: HTMLElement,
  options: GameOptions
): Promise<Phaser.Game> {
  // 이미 인스턴스가 있으면 제거 후 재생성
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }

  // SSR 회피: dynamic import
  const Phaser = await import("phaser");

  // 씬은 lazy import
  const { BootScene } = await import("./scenes/boot-scene");
  const { MainScene } = await import("./scenes/main-scene");

  const config = createPhaserConfig({
    parent,
    scenes: [BootScene as unknown as new (...args: unknown[]) => Phaser.Scene, MainScene as unknown as new (...args: unknown[]) => Phaser.Scene],
  });

  gameInstance = new Phaser.Game(config);

  // registry를 통해 씬에 옵션 전달
  gameInstance.registry.set("spaceId", options.spaceId);
  gameInstance.registry.set("userId", options.userId);
  gameInstance.registry.set("nickname", options.nickname);
  gameInstance.registry.set("avatar", options.avatar);

  return gameInstance;
}

/** Phaser 게임 인스턴스 정리 */
export function destroyGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}

/** 현재 게임 인스턴스 반환 (디버그용) */
export function getGameInstance(): Phaser.Game | null {
  return gameInstance;
}
