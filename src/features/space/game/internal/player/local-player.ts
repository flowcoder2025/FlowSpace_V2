/**
 * Local Player - 로컬 플레이어 스프라이트 + 물리 + 애니메이션
 *
 * PLAYER_MOVED 이벤트를 EventBridge로 발행
 */

import { PLAYER_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, DEPTH } from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import { parseAvatarString, generateAvatarSpriteFromConfig, DIRECTION_FRAMES, IDLE_FRAMES } from "@/features/space/avatar";
import type { Direction } from "@/features/space/avatar";
import type { MovementInput } from "./input-controller";

interface LocalPlayerOptions {
  userId: string;
  nickname: string;
  avatar: string;
  x: number;
  y: number;
}

const MOVE_EMIT_INTERVAL = 100; // ms

export class LocalPlayer {
  private sprite: Phaser.Physics.Arcade.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private currentDirection: Direction = "down";
  private lastEmitTime = 0;
  private userId: string;

  constructor(private scene: Phaser.Scene, options: LocalPlayerOptions) {
    this.userId = options.userId;

    // 아바타 텍스처 생성
    const avatarConfig = parseAvatarString(options.avatar);
    const textureKey = generateAvatarSpriteFromConfig(scene, avatarConfig);

    // 스프라이트 생성
    this.sprite = scene.physics.add.sprite(options.x, options.y, textureKey, 0);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setSize(PLAYER_WIDTH - 4, PLAYER_HEIGHT - 4);
    this.sprite.setOffset(2, 4);

    // 닉네임 텍스트
    this.nameText = scene.add.text(options.x, options.y - 28, options.nickname, {
      fontSize: "11px",
      color: "#ffffff",
      fontFamily: "monospace",
      backgroundColor: "#00000080",
      padding: { x: 3, y: 1 },
    });
    this.nameText.setOrigin(0.5);
    this.nameText.setDepth(DEPTH.PLAYER_NAME);

    // 애니메이션 생성
    this.createAnimations(textureKey);
  }

  /** 프레임 업데이트 */
  update(input: MovementInput): void {
    const { velocityX, velocityY, direction, isMoving } = input;

    // 물리 속도 설정
    this.sprite.setVelocity(
      velocityX * PLAYER_SPEED,
      velocityY * PLAYER_SPEED
    );

    // 애니메이션
    if (isMoving) {
      this.currentDirection = direction;
      const animKey = `player-walk-${direction}`;
      if (this.sprite.anims.currentAnim?.key !== animKey) {
        this.sprite.anims.play(animKey, true);
      }
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
    }

    // 닉네임 위치 업데이트
    this.nameText.setPosition(this.sprite.x, this.sprite.y - 28);

    // PLAYER_MOVED 이벤트 발행 (쓰로틀)
    if (isMoving) {
      this.emitMovement();
    }
  }

  /** 현재 위치 반환 */
  getPosition(): { x: number; y: number } {
    return { x: this.sprite.x, y: this.sprite.y };
  }

  /** 물리 스프라이트 반환 (collider용) */
  getSprite(): Phaser.Physics.Arcade.Sprite {
    return this.sprite;
  }

  /** 걷기 애니메이션 생성 */
  private createAnimations(textureKey: string): void {
    const directions: Direction[] = ["down", "left", "right", "up"];

    for (const dir of directions) {
      const frames = DIRECTION_FRAMES[dir];
      const key = `player-walk-${dir}`;

      if (!this.scene.anims.exists(key)) {
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(textureKey, {
            start: frames.start,
            end: frames.end,
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  /** 런타임 아바타 변경 */
  updateAvatar(avatarString: string): void {
    const config = parseAvatarString(avatarString);
    const newKey = generateAvatarSpriteFromConfig(this.scene, config);
    const pos = { x: this.sprite.x, y: this.sprite.y };

    // 기존 애니메이션 제거
    const directions: Direction[] = ["down", "left", "right", "up"];
    for (const dir of directions) {
      const key = `player-walk-${dir}`;
      if (this.scene.anims.exists(key)) {
        this.scene.anims.remove(key);
      }
    }

    // 텍스처 교체
    this.sprite.setTexture(newKey);
    this.sprite.setPosition(pos.x, pos.y);

    // 새 애니메이션 생성
    this.createAnimations(newKey);
    this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
  }

  /** 이동 이벤트 발행 (쓰로틀) */
  private emitMovement(): void {
    const now = Date.now();
    if (now - this.lastEmitTime < MOVE_EMIT_INTERVAL) return;
    this.lastEmitTime = now;

    eventBridge.emit(GameEvents.PLAYER_MOVED, {
      id: this.userId,
      x: Math.round(this.sprite.x),
      y: Math.round(this.sprite.y),
      direction: this.currentDirection,
      isMoving: true,
    });
  }
}
