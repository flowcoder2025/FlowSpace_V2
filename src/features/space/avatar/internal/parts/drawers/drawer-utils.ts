/**
 * Drawer Utilities - 공유 지오메트리 & 워크 오프셋
 *
 * 32x48 프레임 기준 각 파츠의 기준 좌표
 */

/** 걷기 애니메이션 오프셋 */
export const WALK_OFFSETS = [0, -1, 0, -1];

/** 걷기 프레임별 다리 좌우 오프셋 */
export function getLegOffset(frame: number): number {
  const isStep = frame === 1 || frame === 3;
  return isStep ? (frame === 1 ? -1 : 1) : 0;
}

/** 색상을 밝게/어둡게 변환 */
export function adjustBrightness(hex: string, amount: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
