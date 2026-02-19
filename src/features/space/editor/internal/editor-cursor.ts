/**
 * Editor Cursor - 마우스 위치의 타일 하이라이트
 */

import { TILE_SIZE, MAP_COLS, MAP_ROWS, DEPTH } from "@/constants/game-constants";

export class EditorCursor {
  private graphics: Phaser.GameObjects.Graphics;
  private coordText: Phaser.GameObjects.Text;
  currentCol = -1;
  currentRow = -1;

  constructor(private scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH.EDITOR_CURSOR);
    this.graphics.setVisible(false);

    this.coordText = scene.add.text(0, 0, "", {
      fontSize: "10px",
      color: "#00ff88",
      fontFamily: "monospace",
      backgroundColor: "#00000088",
      padding: { x: 2, y: 1 },
    });
    this.coordText.setDepth(DEPTH.EDITOR_CURSOR + 1);
    this.coordText.setVisible(false);
  }

  show(): void {
    this.graphics.setVisible(true);
    this.coordText.setVisible(true);
  }

  hide(): void {
    this.graphics.setVisible(false);
    this.coordText.setVisible(false);
  }

  /** 마우스 월드 좌표에 맞춰 커서 업데이트 */
  update(worldX: number, worldY: number): void {
    const col = Math.floor(worldX / TILE_SIZE);
    const row = Math.floor(worldY / TILE_SIZE);

    if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
      this.graphics.setVisible(false);
      this.coordText.setVisible(false);
      this.currentCol = -1;
      this.currentRow = -1;
      return;
    }

    if (col === this.currentCol && row === this.currentRow) return;

    this.currentCol = col;
    this.currentRow = row;

    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    this.graphics.clear();
    this.graphics.lineStyle(2, 0x00ff88, 0.8);
    this.graphics.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
    this.graphics.fillStyle(0x00ff88, 0.15);
    this.graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    this.graphics.setVisible(true);

    this.coordText.setText(`${col},${row}`);
    this.coordText.setPosition(x, y - 14);
    this.coordText.setVisible(true);
  }

  destroy(): void {
    this.graphics.destroy();
    this.coordText.destroy();
  }
}
