/**
 * Remote Player Manager
 *
 * 원격 플레이어 Map 관리 + pending 이벤트 큐
 * EventBridge에서 REMOTE_* 이벤트를 수신하여 처리
 */

import { eventBridge, GameEvents, type RemotePlayerData } from "../../events";
import { RemotePlayerSprite, type RemotePlayerInfo } from "./remote-player-sprite";

interface PendingEvent {
  type: "joined" | "moved" | "left";
  data: unknown;
}

export class RemotePlayerManager {
  private players = new Map<string, RemotePlayerSprite>();
  private pendingEvents: PendingEvent[] = [];
  private ready = false;

  private onRemoteJoined = (payload: unknown) => {
    if (!this.ready) {
      this.pendingEvents.push({ type: "joined", data: payload });
      return;
    }
    this.handleJoined(payload as RemotePlayerData);
  };

  private onRemoteMoved = (payload: unknown) => {
    if (!this.ready) {
      this.pendingEvents.push({ type: "moved", data: payload });
      return;
    }
    this.handleMoved(payload as RemotePlayerData);
  };

  private onRemoteLeft = (payload: unknown) => {
    if (!this.ready) {
      this.pendingEvents.push({ type: "left", data: payload });
      return;
    }
    const { userId } = payload as { userId: string };
    this.handleLeft(userId);
  };

  constructor(private scene: Phaser.Scene) {
    eventBridge.on(GameEvents.REMOTE_PLAYER_JOINED, this.onRemoteJoined);
    eventBridge.on(GameEvents.REMOTE_PLAYER_MOVED, this.onRemoteMoved);
    eventBridge.on(GameEvents.REMOTE_PLAYER_LEFT, this.onRemoteLeft);

    // 씬 준비 후 pending 이벤트 처리
    this.setReady();
  }

  /** 준비 완료 → pending 이벤트 처리 */
  setReady(): void {
    this.ready = true;
    for (const event of this.pendingEvents) {
      switch (event.type) {
        case "joined":
          this.handleJoined(event.data as RemotePlayerData);
          break;
        case "moved":
          this.handleMoved(event.data as RemotePlayerData);
          break;
        case "left":
          this.handleLeft((event.data as { userId: string }).userId);
          break;
      }
    }
    this.pendingEvents = [];
  }

  /** 매 프레임 보간 업데이트 */
  update(): void {
    for (const player of this.players.values()) {
      player.update();
    }
  }

  /** 리소스 정리 */
  destroy(): void {
    eventBridge.off(GameEvents.REMOTE_PLAYER_JOINED, this.onRemoteJoined);
    eventBridge.off(GameEvents.REMOTE_PLAYER_MOVED, this.onRemoteMoved);
    eventBridge.off(GameEvents.REMOTE_PLAYER_LEFT, this.onRemoteLeft);

    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();
  }

  private handleJoined(data: RemotePlayerData): void {
    // 이미 존재하면 스킵
    if (this.players.has(data.userId)) return;

    const info: RemotePlayerInfo = {
      userId: data.userId,
      nickname: data.nickname ?? "Unknown",
      avatar: data.avatar ?? "default",
      x: data.x,
      y: data.y,
      direction: data.direction,
    };

    const sprite = new RemotePlayerSprite(this.scene, info);
    this.players.set(data.userId, sprite);
  }

  private handleMoved(data: RemotePlayerData): void {
    const player = this.players.get(data.userId);
    if (player) {
      player.moveTo(data.x, data.y, data.direction);
    } else {
      // 아직 joined 안 됐으면 자동 추가
      this.handleJoined(data);
    }
  }

  private handleLeft(userId: string): void {
    const player = this.players.get(userId);
    if (player) {
      player.destroy();
      this.players.delete(userId);
    }
  }
}
