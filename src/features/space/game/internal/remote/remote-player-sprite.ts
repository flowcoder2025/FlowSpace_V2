/**
 * Remote Player Sprite - 원격 플레이어 1명 렌더링
 *
 * Tween 기반 보간 이동 + 애니메이션 전환
 */

import { DEPTH, PLAYER_SCALE, NAME_OFFSET_Y } from "@/constants/game-constants";
import { parseAvatarString, generateAvatarSpriteFromConfig, DIRECTION_FRAMES, IDLE_FRAMES } from "@/features/space/avatar";
import type { Direction } from "@/features/space/avatar";

const LERP_DURATION = 130; // ms (로컬 TILE_STEP_DURATION과 동기화)

export interface RemotePlayerInfo {
  userId: string;
  nickname: string;
  avatar: string;
  x: number;
  y: number;
  direction?: string;
}

const JUMP_HEIGHT = 20;
const JUMP_DURATION = 300;

export class RemotePlayerSprite {
  private sprite: Phaser.GameObjects.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private currentDirection: Direction = "down";
  private targetX: number;
  private targetY: number;
  private isMoving = false;
  private jumpOffsetY = 0;
  private isJumping = false;
  private appliedVisualOffsetY = 0;
  readonly userId: string;

  constructor(private scene: Phaser.Scene, info: RemotePlayerInfo) {
    this.userId = info.userId;
    this.targetX = info.x;
    this.targetY = info.y;

    // 아바타 텍스처 생성
    const avatarConfig = parseAvatarString(info.avatar);
    const textureKey = generateAvatarSpriteFromConfig(scene, avatarConfig);

    // 스프라이트 생성 (물리 없음 - 보간 이동)
    this.sprite = scene.add.sprite(info.x, info.y, textureKey, 0);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setScale(PLAYER_SCALE);

    // 닉네임
    this.nameText = scene.add.text(info.x, info.y + NAME_OFFSET_Y, info.nickname, {
      fontSize: "12px",
      fontStyle: "bold",
      color: "#ffffff",
      fontFamily: "Arial, 'Malgun Gothic', sans-serif",
      backgroundColor: "#00000088",
      padding: { x: 4, y: 2 },
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
      y: y + NAME_OFFSET_Y,
      duration: LERP_DURATION,
      ease: "Linear",
      onComplete: () => {
        this.isMoving = false;
        this.sprite.anims.stop();
        this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
      },
    });
  }

  /** 점프 시각 효과 (이벤트 발행 없음) */
  jump(): void {
    if (this.isJumping) return;
    this.isJumping = true;

    this.scene.tweens.add({
      targets: this,
      jumpOffsetY: -JUMP_HEIGHT,
      duration: JUMP_DURATION / 2,
      ease: "Sine.Out",
      yoyo: true,
      onComplete: () => {
        this.jumpOffsetY = 0;
        this.isJumping = false;
      },
    });
  }

  /** 업데이트 (매 프레임) */
  update(): void {
    // 이전 프레임 시각 오프셋 복원
    if (this.appliedVisualOffsetY !== 0) {
      this.sprite.y -= this.appliedVisualOffsetY;
      this.nameText.y -= this.appliedVisualOffsetY;
      this.appliedVisualOffsetY = 0;
    }

    // 닉네임 위치 동기화 (tween이 아닐 때)
    if (!this.isMoving) {
      this.nameText.setPosition(this.sprite.x, this.sprite.y + NAME_OFFSET_Y);
    }

    // 점프 시각 오프셋 (렌더 직전, 다음 update에서 복원)
    if (this.jumpOffsetY !== 0) {
      this.sprite.y += this.jumpOffsetY;
      this.nameText.y += this.jumpOffsetY;
      this.appliedVisualOffsetY = this.jumpOffsetY;
    }
  }

  /** 런타임 아바타 변경 */
  updateAvatar(avatarString: string): void {
    const config = parseAvatarString(avatarString);
    const newKey = generateAvatarSpriteFromConfig(this.scene, config);

    // 기존 애니메이션 제거
    const directions: Direction[] = ["down", "left", "right", "up"];
    for (const dir of directions) {
      const key = `remote-walk-${this.userId}-${dir}`;
      if (this.scene.anims.exists(key)) {
        this.scene.anims.remove(key);
      }
    }

    // 텍스처 교체
    this.sprite.setTexture(newKey);

    // 새 애니메이션 생성
    this.createAnimations(newKey);
    this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
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
