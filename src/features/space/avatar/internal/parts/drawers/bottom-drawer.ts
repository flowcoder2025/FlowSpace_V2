/**
 * Bottom (하의) Drawer - 4종
 * pants, shorts, skirt, wide
 *
 * color = 하의 색상
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";
import { getLegOffset, adjustBrightness } from "./drawer-utils";

/** Pants (기본 바지) */
function drawBottomPants(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);
  ctx.fillStyle = color;

  // 허리
  ctx.fillRect(x + 8, y + 30 + yOff, 16, 4);

  // 다리
  ctx.fillRect(x + 8 + legOff, y + 34 + yOff, 7, 11);
  ctx.fillRect(x + 17 - legOff, y + 34 + yOff, 7, 11);

  // 벨트 라인
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -25);
    ctx.fillRect(x + 8, y + 30 + yOff, 16, 2);
  }
}

/** Shorts (반바지) */
function drawBottomShorts(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);
  ctx.fillStyle = color;

  // 허리
  ctx.fillRect(x + 8, y + 30 + yOff, 16, 4);

  // 짧은 다리
  ctx.fillRect(x + 8 + legOff, y + 34 + yOff, 7, 6);
  ctx.fillRect(x + 17 - legOff, y + 34 + yOff, 7, 6);

  // 벨트 라인
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -25);
    ctx.fillRect(x + 8, y + 30 + yOff, 16, 2);
  }
}

/** Skirt (치마) */
function drawBottomSkirt(dc: PartDrawContext): void {
  const { ctx, x, y, yOff, color } = dc;
  ctx.fillStyle = color;

  // 허리
  ctx.fillRect(x + 8, y + 30 + yOff, 16, 3);

  // A라인 실루엣
  ctx.fillRect(x + 6, y + 33 + yOff, 20, 8);

  // 밑단 디테일
  ctx.fillStyle = adjustBrightness(color, -15);
  ctx.fillRect(x + 6, y + 39 + yOff, 20, 2);
}

/** Wide pants (와이드팬츠) */
function drawBottomWide(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);
  ctx.fillStyle = color;

  // 허리
  ctx.fillRect(x + 7, y + 30 + yOff, 18, 4);

  // 넓은 다리
  ctx.fillRect(x + 6 + legOff, y + 34 + yOff, 9, 11);
  ctx.fillRect(x + 17 - legOff, y + 34 + yOff, 9, 11);

  // 벨트 라인
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -25);
    ctx.fillRect(x + 7, y + 30 + yOff, 18, 2);
  }
}

export function registerBottomParts(): void {
  registerPart(
    { id: "bottom_01", category: "bottom", name: "Pants", colorable: true, defaultColor: "#304080" },
    drawBottomPants,
  );
  registerPart(
    { id: "bottom_02", category: "bottom", name: "Shorts", colorable: true, defaultColor: "#605030" },
    drawBottomShorts,
  );
  registerPart(
    { id: "bottom_03", category: "bottom", name: "Skirt", colorable: true, defaultColor: "#803030" },
    drawBottomSkirt,
  );
  registerPart(
    { id: "bottom_04", category: "bottom", name: "Wide", colorable: true, defaultColor: "#404040" },
    drawBottomWide,
  );
}
