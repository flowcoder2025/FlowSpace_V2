/**
 * Grid Overlay - 에디터 모드 그리드 라인 표시
 */

import { TILE_SIZE, MAP_COLS, MAP_ROWS, DEPTH } from "@/constants/game-constants";

export class GridOverlay {
  private graphics: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH.EDITOR_GRID);
    this.graphics.setVisible(false);
    this.draw();
  }

  show(): void {
    this.graphics.setVisible(true);
  }

  hide(): void {
    this.graphics.setVisible(false);
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private draw(): void {
    this.graphics.lineStyle(1, 0xffffff, 0.15);

    // 세로선
    for (let col = 0; col <= MAP_COLS; col++) {
      const x = col * TILE_SIZE;
      this.graphics.lineBetween(x, 0, x, MAP_ROWS * TILE_SIZE);
    }

    // 가로선
    for (let row = 0; row <= MAP_ROWS; row++) {
      const y = row * TILE_SIZE;
      this.graphics.lineBetween(0, y, MAP_COLS * TILE_SIZE, y);
    }
  }
}
