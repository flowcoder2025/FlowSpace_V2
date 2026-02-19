/**
 * Interactive Object - 인터랙티브 오브젝트
 *
 * 타입별 색상, 글로우 애니메이션, [E] 인디케이터
 */

import { TILE_SIZE, DEPTH } from "@/constants/game-constants";

export interface InteractiveObjectConfig {
  id: string;
  type: string;
  x: number;
  y: number;
  label?: string;
}

/** 타입별 색상 */
const TYPE_COLORS: Record<string, number> = {
  portal: 0x8050c0,
  spawn: 0x40c070,
  chest: 0xd4a030,
  npc: 0x4060c0,
  default: 0x808080,
};

export class InteractiveObject {
  private graphics: Phaser.GameObjects.Graphics;
  private indicator: Phaser.GameObjects.Text;
  private glowTween: Phaser.Tweens.Tween | null = null;
  private isNearby = false;
  readonly id: string;
  readonly type: string;
  readonly worldX: number;
  readonly worldY: number;

  constructor(private scene: Phaser.Scene, config: InteractiveObjectConfig) {
    this.id = config.id;
    this.type = config.type;
    this.worldX = config.x;
    this.worldY = config.y;

    const color = TYPE_COLORS[config.type] ?? TYPE_COLORS.default;

    // 글로우 그래픽
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH.OBJECTS - 1);
    this.graphics.setPosition(config.x, config.y);
    this.graphics.setAlpha(0);

    this.drawGlow(color);

    // [E] 인디케이터
    const label = config.label ?? "[E]";
    this.indicator = scene.add.text(config.x, config.y - TILE_SIZE, label, {
      fontSize: "12px",
      color: "#ffffff",
      fontFamily: "monospace",
      backgroundColor: "#000000aa",
      padding: { x: 4, y: 2 },
    });
    this.indicator.setOrigin(0.5);
    this.indicator.setDepth(DEPTH.UI);
    this.indicator.setVisible(false);
  }

  /** 근접 상태 설정 */
  setNearby(nearby: boolean): void {
    if (this.isNearby === nearby) return;
    this.isNearby = nearby;

    if (nearby) {
      this.showIndicator();
      this.startGlow();
    } else {
      this.hideIndicator();
      this.stopGlow();
    }
  }

  /** 리소스 정리 */
  destroy(): void {
    this.glowTween?.destroy();
    this.graphics.destroy();
    this.indicator.destroy();
  }

  private drawGlow(color: number): void {
    this.graphics.fillStyle(color, 0.3);
    this.graphics.fillCircle(0, 0, TILE_SIZE * 0.8);
  }

  private showIndicator(): void {
    this.indicator.setVisible(true);

    // 떠다니는 애니메이션
    this.scene.tweens.add({
      targets: this.indicator,
      y: this.worldY - TILE_SIZE - 4,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private hideIndicator(): void {
    this.indicator.setVisible(false);
    this.scene.tweens.killTweensOf(this.indicator);
    this.indicator.setPosition(this.worldX, this.worldY - TILE_SIZE);
  }

  private startGlow(): void {
    this.graphics.setAlpha(0.4);
    this.glowTween = this.scene.tweens.add({
      targets: this.graphics,
      alpha: 0.8,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopGlow(): void {
    if (this.glowTween) {
      this.glowTween.destroy();
      this.glowTween = null;
    }
    this.graphics.setAlpha(0);
  }
}
