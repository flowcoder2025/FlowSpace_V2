/**
 * Object Manager - 인터랙티브 오브젝트 레지스트리 + 근접 체크
 *
 * OBJECT_INTERACT 이벤트를 EventBridge로 발행
 */

import { TILE_SIZE, INTERACT_DISTANCE } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import { InteractiveObject, type InteractiveObjectConfig } from "./interactive-object";

export class ObjectManager {
  private objects = new Map<string, InteractiveObject>();
  private nearestObject: InteractiveObject | null = null;
  private interactKey: Phaser.Input.Keyboard.Key;

  constructor(private scene: Phaser.Scene) {
    this.interactKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );
    this.interactKey.on("down", this.onInteract);

    this.registerMapObjects();
  }

  /** 근접 체크 (매 프레임) */
  checkProximity(playerX: number, playerY: number): void {
    let nearest: InteractiveObject | null = null;
    let nearestDist = Infinity;

    for (const obj of this.objects.values()) {
      const dx = playerX - obj.worldX;
      const dy = playerY - obj.worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < INTERACT_DISTANCE && dist < nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }

      obj.setNearby(false);
    }

    if (nearest) {
      nearest.setNearby(true);
    }
    this.nearestObject = nearest;
  }

  /** 리소스 정리 */
  destroy(): void {
    this.interactKey.off("down", this.onInteract);
    for (const obj of this.objects.values()) {
      obj.destroy();
    }
    this.objects.clear();
  }

  /** [E] 키 입력 시 가장 가까운 오브젝트와 상호작용 */
  private onInteract = (): void => {
    if (!this.nearestObject) return;

    eventBridge.emit(GameEvents.OBJECT_INTERACT, {
      objectId: this.nearestObject.id,
      type: this.nearestObject.type,
    });
  };

  /** 맵 데이터에서 인터랙티브 오브젝트 자동 등록 */
  private registerMapObjects(): void {
    // 포털 (고정 위치 - map-data.ts 참조)
    this.addObject({
      id: "portal-1",
      type: "portal",
      x: 3 * TILE_SIZE + TILE_SIZE / 2,
      y: 14 * TILE_SIZE + TILE_SIZE / 2,
      label: "[E] Portal",
    });

    // 스폰 포인트
    this.addObject({
      id: "spawn-1",
      type: "spawn",
      x: 20 * TILE_SIZE + TILE_SIZE / 2,
      y: 28 * TILE_SIZE + TILE_SIZE / 2,
    });

    // 표지판
    this.addObject({
      id: "sign-1",
      type: "npc",
      x: 16 * TILE_SIZE + TILE_SIZE / 2,
      y: 26 * TILE_SIZE + TILE_SIZE / 2,
      label: "[E] Read",
    });
  }

  private addObject(config: InteractiveObjectConfig): void {
    const obj = new InteractiveObject(this.scene, config);
    this.objects.set(config.id, obj);
  }
}
