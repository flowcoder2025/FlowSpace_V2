/**
 * Local Player - 그리드 기반 타일 이동 (ZEP/Gather.town 방식)
 *
 * 이동: logicalX/Y Tween (타일 그리드)
 * 점프: jumpState.offsetY Tween (시각 전용, 별도 객체로 이동 Tween과 타겟 분리)
 * 렌더: sprite.y = logicalY + jumpState.offsetY (매 프레임 합산)
 */

import {
  TILE_SIZE,
  TILE_HALF,
  TILE_STEP_DURATION,
  PLAYER_SCALE,
  DEPTH,
  NAME_OFFSET_Y,
} from "@/constants/game-constants";
import { eventBridge, GameEvents } from "../../events";
import {
  parseAvatarString,
  generateAvatarSpriteFromConfig,
  DIRECTION_FRAMES,
  IDLE_FRAMES,
} from "@/features/space/avatar";
import type { Direction } from "@/features/space/avatar";
import type { MovementInput } from "./input-controller";
import type { TileCollisionChecker } from "./tile-collision-checker";

interface LocalPlayerOptions {
  userId: string;
  nickname: string;
  avatar: string;
  col: number;
  row: number;
}

const JUMP_HEIGHT = 20;
const JUMP_DURATION = 400;

export class LocalPlayer {
  private sprite: Phaser.GameObjects.Sprite;
  private nameText: Phaser.GameObjects.Text;
  private shadow!: Phaser.GameObjects.Ellipse;
  private currentDirection: Direction = "down";
  private userId: string;

  // 논리 좌표 (Tween 대상, sprite.x/y와 분리)
  private logicalX: number;
  private logicalY: number;

  // 점프 (시각 전용, logicalY와 독립 — 별도 객체로 이동 Tween과 타겟 분리)
  private jumpState = { offsetY: 0 };
  private isJumping = false;

  // Grid state
  private tileCol: number;
  private tileRow: number;
  private isStepping = false;
  private isIdle = true;
  private lastStepEndTime = 0;
  private collisionChecker: TileCollisionChecker | null = null;

  constructor(private scene: Phaser.Scene, options: LocalPlayerOptions) {
    this.userId = options.userId;
    this.tileCol = options.col;
    this.tileRow = options.row;

    this.logicalX = options.col * TILE_SIZE + TILE_HALF;
    this.logicalY = options.row * TILE_SIZE + TILE_HALF;

    // 아바타 텍스처 생성
    const avatarConfig = parseAvatarString(options.avatar);
    const textureKey = generateAvatarSpriteFromConfig(scene, avatarConfig);

    // 스프라이트 생성 (물리 없음 — Tween 이동)
    this.sprite = scene.add.sprite(this.logicalX, this.logicalY, textureKey, 0);
    this.sprite.setDepth(DEPTH.PLAYER);
    this.sprite.setScale(PLAYER_SCALE);

    // 바닥 그림자
    this.shadow = scene.add.ellipse(this.logicalX, this.logicalY + 28, 30, 10, 0x000000, 0.25);
    this.shadow.setDepth(DEPTH.PLAYER - 1);

    // 닉네임 텍스트
    this.nameText = scene.add.text(this.logicalX, this.logicalY + NAME_OFFSET_Y, options.nickname, {
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

    // 초기 위치 브로드캐스트
    this.emitMovement(false);
  }

  /** 충돌 체커 주입 */
  setCollisionChecker(checker: TileCollisionChecker): void {
    this.collisionChecker = checker;
  }

  /** 프레임 업데이트 — idle일 때만 입력 처리 */
  update(input: MovementInput): void {
    const { dx, dy, direction, isMoving } = input;

    if (!this.isStepping && isMoving) {
      const targetCol = this.tileCol + dx;
      const targetRow = this.tileRow + dy;

      if (dx !== 0 && dy !== 0) {
        if (this.canMoveTo(targetCol, targetRow)) {
          this.startStep(targetCol, targetRow, direction);
        } else if (this.canMoveTo(this.tileCol + dx, this.tileRow)) {
          const hDir: Direction = dx < 0 ? "left" : "right";
          this.startStep(this.tileCol + dx, this.tileRow, hDir);
        } else if (this.canMoveTo(this.tileCol, this.tileRow + dy)) {
          const vDir: Direction = dy < 0 ? "up" : "down";
          this.startStep(this.tileCol, this.tileRow + dy, vDir);
        } else {
          this.setIdle(direction);
        }
      } else {
        if (this.canMoveTo(targetCol, targetRow)) {
          this.startStep(targetCol, targetRow, direction);
        } else {
          this.setIdle(direction);
        }
      }
    } else if (!this.isStepping && !isMoving) {
      const elapsed = this.scene.time.now - this.lastStepEndTime;
      if (!this.isIdle && elapsed > 80) {
        this.setIdle(this.currentDirection);
      }
    }

    // 렌더 동기화: logicalX/Y + jumpState.offsetY → sprite/nameText/shadow 위치
    this.syncVisuals();
  }

  /** 점프 시각 효과 */
  jump(): void {
    if (this.isJumping) return;
    this.isJumping = true;

    const baseScale = PLAYER_SCALE;

    // 1) 도약 스트레치
    this.scene.tweens.add({
      targets: this.sprite,
      scaleY: baseScale * 1.15,
      scaleX: baseScale * 0.9,
      duration: 60,
      ease: "Sine.Out",
      onComplete: () => {
        this.sprite.setScale(baseScale);

        // 2) 점프 궤적 (jumpState 별도 객체 → 이동 Tween과 타겟 분리)
        this.scene.tweens.add({
          targets: this.jumpState,
          offsetY: -JUMP_HEIGHT,
          duration: JUMP_DURATION / 2,
          ease: "Sine.Out",
          yoyo: true,
          onComplete: () => {
            this.jumpState.offsetY = 0;

            // 3) 착지 스쿼시
            this.scene.tweens.add({
              targets: this.sprite,
              scaleY: baseScale * 0.85,
              scaleX: baseScale * 1.12,
              duration: 80,
              ease: "Sine.Out",
              yoyo: true,
              onComplete: () => {
                this.sprite.setScale(baseScale);
                this.isJumping = false;
              },
            });
          },
        });
      },
    });

    eventBridge.emit(GameEvents.PLAYER_JUMPED, { id: this.userId });
  }

  /** 현재 논리 위치 반환 (네트워크/근접 체크용, 점프 오프셋 미포함) */
  getPosition(): { x: number; y: number } {
    return { x: this.logicalX, y: this.logicalY };
  }

  /** 스프라이트 반환 (카메라 추적용) */
  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  /** 런타임 아바타 변경 */
  updateAvatar(avatarString: string): void {
    const config = parseAvatarString(avatarString);
    const newKey = generateAvatarSpriteFromConfig(this.scene, config);

    const directions: Direction[] = ["down", "left", "right", "up"];
    for (const dir of directions) {
      const key = `player-walk-${dir}`;
      if (this.scene.anims.exists(key)) {
        this.scene.anims.remove(key);
      }
    }

    this.sprite.setTexture(newKey);
    this.createAnimations(newKey);
    this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
  }

  /** 리소스 정리 */
  destroy(): void {
    this.sprite.destroy();
    this.nameText.destroy();
    this.shadow.destroy();
  }

  // === Private ===

  /** 충돌 체크 */
  private canMoveTo(col: number, row: number): boolean {
    if (!this.collisionChecker) return true;
    return this.collisionChecker.isWalkable(col, row);
  }

  /** 타일 한 칸 이동 시작 */
  private startStep(col: number, row: number, dir: Direction): void {
    this.isStepping = true;
    this.isIdle = false;
    this.currentDirection = dir;

    const targetX = col * TILE_SIZE + TILE_HALF;
    const targetY = row * TILE_SIZE + TILE_HALF;

    // 대각선은 √2배 거리 → duration 보정으로 이동 속도 일정
    const isDiagonal = col !== this.tileCol && row !== this.tileRow;
    const duration = isDiagonal
      ? Math.round(TILE_STEP_DURATION * Math.SQRT2)
      : TILE_STEP_DURATION;

    // 걷기 애니메이션 재생
    this.sprite.anims.play(`player-walk-${dir}`, true);

    // Tween으로 논리 좌표 이동 (sprite.y 직접 변경 안 함 → 점프와 간섭 없음)
    this.scene.tweens.add({
      targets: this,
      logicalX: targetX,
      logicalY: targetY,
      duration,
      ease: "Linear",
      onComplete: () => {
        this.tileCol = col;
        this.tileRow = row;
        this.isStepping = false;
        this.lastStepEndTime = this.scene.time.now;
        this.emitMovement(true);
      },
    });
  }

  /** idle 상태 설정 (이미 idle이면 스킵) */
  private setIdle(dir: Direction): void {
    this.currentDirection = dir;
    if (this.isIdle) return;
    this.isIdle = true;
    this.sprite.anims.stop();
    this.sprite.setFrame(IDLE_FRAMES[this.currentDirection]);
  }

  /** 논리 좌표 + 점프 오프셋 → 시각 위치 동기화 (매 프레임) */
  private syncVisuals(): void {
    const jy = this.jumpState.offsetY;
    const visualY = this.logicalY + jy;

    this.sprite.setPosition(this.logicalX, visualY);
    this.nameText.setPosition(this.logicalX, visualY + NAME_OFFSET_Y);
    // 그림자는 항상 지면 (점프 오프셋 미적용)
    this.shadow.setPosition(this.logicalX, this.logicalY + 28);

    // 점프 높이에 비례한 그림자 축소
    if (jy !== 0) {
      const jumpRatio = Math.abs(jy) / JUMP_HEIGHT;
      this.shadow.setScale(1 - jumpRatio * 0.5, 1 - jumpRatio * 0.5);
      this.shadow.setAlpha(0.25 * (1 - jumpRatio * 0.6));
    } else {
      this.shadow.setScale(1, 1);
      this.shadow.setAlpha(0.25);
    }
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
          frameRate: 12,
          repeat: -1,
        });
      }
    }
  }

  /** 이동 이벤트 발행 */
  private emitMovement(isMoving: boolean): void {
    eventBridge.emit(GameEvents.PLAYER_MOVED, {
      id: this.userId,
      x: Math.round(this.logicalX),
      y: Math.round(this.logicalY),
      direction: this.currentDirection,
      isMoving,
    });
  }
}
