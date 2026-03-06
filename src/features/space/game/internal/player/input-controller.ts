/**
 * Input Controller - WASD/Arrow 키 입력 처리
 *
 * 그리드 이동용 정수 델타 (-1/0/+1) 반환
 * CHAT_FOCUS 이벤트 수신 시 입력 비활성
 */

import { eventBridge, GameEvents } from "../../events";
import type { Direction } from "@/features/space/avatar";

export interface MovementInput {
  dx: number; // -1 | 0 | 1
  dy: number; // -1 | 0 | 1
  direction: Direction;
  isMoving: boolean;
}

const ZERO_INPUT: MovementInput = {
  dx: 0,
  dy: 0,
  direction: "down",
  isMoving: false,
};

export class InputController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private spaceKey: Phaser.Input.Keyboard.Key;
  private chatFocused = false;
  private editorMode = false;
  private lastDirection: Direction = "down";

  private onChatFocus = (payload: unknown) => {
    const { focused } = payload as { focused: boolean };
    this.chatFocused = focused;

    const kb = this.scene.input.keyboard;
    if (!kb) return;

    if (focused) {
      kb.enabled = false;
      kb.clearCaptures();
      kb.resetKeys();
    } else {
      kb.enabled = true;
      kb.addCapture([
        Phaser.Input.Keyboard.KeyCodes.W,
        Phaser.Input.Keyboard.KeyCodes.A,
        Phaser.Input.Keyboard.KeyCodes.S,
        Phaser.Input.Keyboard.KeyCodes.D,
        Phaser.Input.Keyboard.KeyCodes.UP,
        Phaser.Input.Keyboard.KeyCodes.DOWN,
        Phaser.Input.Keyboard.KeyCodes.LEFT,
        Phaser.Input.Keyboard.KeyCodes.RIGHT,
        Phaser.Input.Keyboard.KeyCodes.SPACE,
      ]);
    }
  };

  private onEditorEnter = () => { this.editorMode = true; };
  private onEditorExit = () => { this.editorMode = false; };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    eventBridge.on(GameEvents.CHAT_FOCUS, this.onChatFocus);
    eventBridge.on(GameEvents.EDITOR_ENTER, this.onEditorEnter);
    eventBridge.on(GameEvents.EDITOR_EXIT, this.onEditorExit);
  }

  /** 현재 프레임 이동 입력 (정수 델타) */
  getMovement(): MovementInput {
    if (this.chatFocused || this.editorMode) return { ...ZERO_INPUT, direction: this.lastDirection };

    let dx = 0;
    let dy = 0;

    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;

    if (left) dx -= 1;
    if (right) dx += 1;
    if (up) dy -= 1;
    if (down) dy += 1;

    const hasDirection = dx !== 0 || dy !== 0;

    // 방향 결정 (대각선 = 측면 우선, ZEP/게더타운 방식)
    if (hasDirection) {
      if (dx !== 0 && dy !== 0) {
        this.lastDirection = dx < 0 ? "left" : "right";
      } else if (Math.abs(dy) > Math.abs(dx)) {
        this.lastDirection = dy < 0 ? "up" : "down";
      } else {
        this.lastDirection = dx < 0 ? "left" : "right";
      }
    }

    // Shift + 방향 = 방향 전환만 (이동 없음)
    const shiftHeld = this.cursors.shift.isDown;
    const isMoving = hasDirection && !shiftHeld;

    return {
      dx: isMoving ? dx : 0,
      dy: isMoving ? dy : 0,
      direction: this.lastDirection,
      isMoving,
    };
  }

  /** 스페이스키 점프 입력 (JustDown = 1회만 감지) */
  isJumpPressed(): boolean {
    if (this.chatFocused || this.editorMode) return false;
    return Phaser.Input.Keyboard.JustDown(this.spaceKey);
  }

  destroy(): void {
    eventBridge.off(GameEvents.CHAT_FOCUS, this.onChatFocus);
    eventBridge.off(GameEvents.EDITOR_ENTER, this.onEditorEnter);
    eventBridge.off(GameEvents.EDITOR_EXIT, this.onEditorExit);
  }
}
