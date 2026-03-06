/**
 * Tile Collision Checker - 타일 보행 가능 여부 판정
 *
 * Phaser 의존 없는 순수 로직 클래스
 * 경계 체크 + 충돌 레이어 + 가구 blocked 타일 통합 판정
 */

export class TileCollisionChecker {
  constructor(
    private mapCols: number,
    private mapRows: number,
    private collisionLayers: number[][][],
    private blockedTiles: Set<string> = new Set(),
  ) {}

  /** 해당 타일이 이동 가능한지 판정 */
  isWalkable(col: number, row: number): boolean {
    // 경계 체크
    if (col < 0 || col >= this.mapCols || row < 0 || row >= this.mapRows) {
      return false;
    }

    // 충돌 레이어 체크 (타일 인덱스 >= 0이면 충돌 타일)
    for (const layer of this.collisionLayers) {
      if (layer[row]?.[col] !== undefined && layer[row][col] >= 0) {
        return false;
      }
    }

    // 가구 blocked 체크
    if (this.blockedTiles.has(`${col},${row}`)) {
      return false;
    }

    return true;
  }

  /** 가구 blocked 타일 추가 */
  addBlocked(col: number, row: number): void {
    this.blockedTiles.add(`${col},${row}`);
  }

  /** 가구 blocked 타일 제거 */
  removeBlocked(col: number, row: number): void {
    this.blockedTiles.delete(`${col},${row}`);
  }
}
