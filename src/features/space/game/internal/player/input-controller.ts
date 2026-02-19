/**
 * Input Controller - WASD/Arrow 키 입력 처리
 *
 * 대각선 이동 시 0.707 정규화
 * CHAT_FOCUS 이벤트 수신 시 입력 비활성
 */

import { DIAGONAL_FACTOR } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import type { Direction } from "@/features/space/avatar";

export interface MovementInput {
  velocityX: number;
  velocityY: number;
  direction: Direction;
  isMoving: boolean;
}

const ZERO_INPUT: MovementInput = {
  velocityX: 0,
  velocityY: 0,
  direction: "down",
  isMoving: false,
};

export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private chatFocused = false;
  private lastDirection: Direction = "down";

  private onChatFocus = (payload: unknown) => {
    const { focused } = payload as { focused: boolean };
    this.chatFocused = focused;
  };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    eventBridge.on(GameEvents.CHAT_FOCUS, this.onChatFocus);
  }

  /** 현재 프레임 이동 입력 */
  getMovement(): MovementInput {
    if (this.chatFocused) return { ...ZERO_INPUT, direction: this.lastDirection };

    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    // 대각선 정규화
    if (vx !== 0 && vy !== 0) {
      vx *= DIAGONAL_FACTOR;
      vy *= DIAGONAL_FACTOR;
    }

    const isMoving = vx !== 0 || vy !== 0;

    // 방향 결정 (마지막 입력 우선)
    if (isMoving) {
      if (Math.abs(vy) >= Math.abs(vx)) {
        this.lastDirection = vy < 0 ? "up" : "down";
      } else {
        this.lastDirection = vx < 0 ? "left" : "right";
      }
    }

    return {
      velocityX: vx,
      velocityY: vy,
      direction: this.lastDirection,
      isMoving,
    };
  }

  destroy(): void {
    eventBridge.off(GameEvents.CHAT_FOCUS, this.onChatFocus);
  }
}
