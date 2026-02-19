/**
 * Remote Player Sprite - 원격 플레이어 1명 렌더링
 *
 * Tween 기반 보간 이동 + 애니메이션 전환
 */

import { DEPTH } from "@/constants/game-constants";
import { parseAvatarString, generateAvatarSprite, DIRECTION_FRAMES, IDLE_FRAMES } from "@/features/space/avatar";
import type { Direction } from "@/features/space/avatar";

const LERP_DURATION = 150; // ms

export interface RemotePlayerInfo {
  userId: string;
  nickname: string;
  avatar: string;
  x: number;
  y: number;
  direction?: string;
}

export class RemotePlayerSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private currentDirection: Direction = "down";
  private targetX: number;
  private targetY: number;
  private isMoving = false;
  readonly userId: string;

  constructor(private scene: Phaser.Scene, info: RemotePlayerInfo) {
    this.userId = info.userId;
    this.targetX = info.x;
    this.targetY = info.y;

    // 아바타 텍스처 생성
    const avatarConfig = parseAvatarString(info.avatar);
    let textureKey: string;

    if (avatarConfig.type === "classic") {
      textureKey = generateAvatarSprite(scene, avatarConfig);
    } else {
      textureKey = avatarConfig.textureKey;
    }

    // 스프라이트 생성 (물리 없음 - 보간 이동)
    this.sprite = scene.add.sprite(info.x, info.y, textureKey, 0);
    this.sprite.setDepth(DEPTH.PLAYER);

    // 닉네임
    this.nameText = scene.add.text(info.x, info.y - 20, info.nickname, {
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

    if (info.direction) {
      this.currentDirection = info.direction as Direction;
    }
  }

  /** Tween 보간 이동 */
  moveTo(x: number, y: number, direction: string): void {
    this.targetX = x;
    this.targetY = y;
    this.isMoving = true;

    if (direction) {
      this.currentDirection = direction as Direction;
    }

    // 걷기 애니메이션
    const animKey = `remote-walk-${this.userId}-${this.currentDirection}`;
    if (this.scene.anims.exists(animKey) || this.tryCreateAnim(animKey)) {
      this.sprite.anims.play(animKey, true);
    }

    // Tween으로 부드러운 이동
    this.scene.tweens.add({
      targets: [this.sprite, this.nameText],
      x: x,
      duration: LERP_DURATION,
      ease: "Linear",
    });

    this.scene.tweens.add({
      targets: this.sprite,
      y: y,
      duration: LERP_DURATION,
      ease: "Linear",
    });

    this.scene.tweens.add({
      targets: this.nameText,
      y: y - 20,
      duration: LERP_DURATION,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.sprite.anims.stop();
        this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
      },
    });
  }

  /** 업데이트 (매 프레임) */
  update(): void {
    // 닉네임 위치 동기화 (tween이 아닐 때)
    if (!this.isMoving) {
      this.nameText.setPosition(this.sprite.x, this.sprite.y - 20);
    }
  }

  /** 리소스 정리 */
  destroy(): void {
    this.sprite.destroy();
    this.nameText.destroy();
  }

  private createAnimations(textureKey: string): void {
    const directions: Direction[] = ["down", "left", "right", "up"];
    for (const dir of directions) {
      const key = `remote-walk-${this.userId}-${dir}`;
      if (!this.scene.anims.exists(key)) {
        this.scene.anims.create({
          key,
          frames: this.scene.anims.generateFrameNumbers(textureKey, {
            start: DIRECTION_FRAMES[dir].start,
            end: DIRECTION_FRAMES[dir].end,
          }),
          frameRate: 8,
          repeat: -1,
        });
      }
    }
  }

  private tryCreateAnim(key: string): boolean {
    return this.scene.anims.exists(key);
  }
}
