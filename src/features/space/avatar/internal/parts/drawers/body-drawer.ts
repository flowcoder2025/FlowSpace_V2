/**
 * Body Drawer - 3종 (standard, slim, broad)
 *
 * 머리 + 몸통 + 다리 + 발 기본 실루엣
 * color = skinColor
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";
import { getLegOffset, adjustBrightness } from "./drawer-utils";

/** Standard body */
function drawBodyStandard(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);

  // Head
  ctx.fillStyle = color;
  ctx.fillRect(x + 8, y + 3 + yOff, 16, 16);

  // Neck
  ctx.fillRect(x + 13, y + 17 + yOff, 6, 3);

  // Torso base (skin visible beneath clothes at neckline)
  ctx.fillRect(x + 12, y + 18 + yOff, 8, 2);

  // Arms (skin)
  const armColor = adjustBrightness(color, -10);
  ctx.fillStyle = armColor;
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 11);
    // Hand
    ctx.fillStyle = color;
    ctx.fillRect(x + 23, y + 28 + yOff, 5, 3);
  } else if (direction === 2) {
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 28 + yOff, 5, 3);
  } else {
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 11);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 28 + yOff, 5, 3);
    ctx.fillRect(x + 24, y + 28 + yOff, 5, 3);
  }

  // Legs (skin below shorts/skirt area)
  ctx.fillStyle = color;
  ctx.fillRect(x + 8 + legOff, y + 42 + yOff, 7, 3);
  ctx.fillRect(x + 17 - legOff, y + 42 + yOff, 7, 3);

  // Shoes
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 8 + legOff, y + 45 + yOff, 7, 3);
  ctx.fillRect(x + 17 - legOff, y + 45 + yOff, 7, 3);
}

/** Slim body */
function drawBodySlim(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);

  // Head (slightly narrower)
  ctx.fillStyle = color;
  ctx.fillRect(x + 9, y + 3 + yOff, 14, 16);

  // Neck
  ctx.fillRect(x + 13, y + 17 + yOff, 6, 3);
  ctx.fillRect(x + 12, y + 18 + yOff, 8, 2);

  // Arms (thinner)
  const armColor = adjustBrightness(color, -10);
  ctx.fillStyle = armColor;
  if (direction === 1) {
    ctx.fillRect(x + 22, y + 19 + yOff, 4, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 22, y + 28 + yOff, 4, 3);
  } else if (direction === 2) {
    ctx.fillRect(x + 6, y + 19 + yOff, 4, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 6, y + 28 + yOff, 4, 3);
  } else {
    ctx.fillRect(x + 4, y + 19 + yOff, 4, 11);
    ctx.fillRect(x + 24, y + 19 + yOff, 4, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 4, y + 28 + yOff, 4, 3);
    ctx.fillRect(x + 24, y + 28 + yOff, 4, 3);
  }

  // Legs
  ctx.fillStyle = color;
  ctx.fillRect(x + 9 + legOff, y + 42 + yOff, 6, 3);
  ctx.fillRect(x + 17 - legOff, y + 42 + yOff, 6, 3);

  // Shoes
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 9 + legOff, y + 45 + yOff, 6, 3);
  ctx.fillRect(x + 17 - legOff, y + 45 + yOff, 6, 3);
}

/** Broad body */
function drawBodyBroad(dc: PartDrawContext): void {
  const { ctx, x, y, direction, frame, yOff, color } = dc;
  const legOff = getLegOffset(frame);

  // Head (wider)
  ctx.fillStyle = color;
  ctx.fillRect(x + 7, y + 3 + yOff, 18, 16);

  // Neck
  ctx.fillRect(x + 12, y + 17 + yOff, 8, 3);
  ctx.fillRect(x + 11, y + 18 + yOff, 10, 2);

  // Arms (thicker)
  const armColor = adjustBrightness(color, -10);
  ctx.fillStyle = armColor;
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 6, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 23, y + 28 + yOff, 6, 3);
  } else if (direction === 2) {
    ctx.fillRect(x + 3, y + 19 + yOff, 6, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 28 + yOff, 6, 3);
  } else {
    ctx.fillRect(x + 2, y + 19 + yOff, 6, 11);
    ctx.fillRect(x + 24, y + 19 + yOff, 6, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x + 2, y + 28 + yOff, 6, 3);
    ctx.fillRect(x + 24, y + 28 + yOff, 6, 3);
  }

  // Legs
  ctx.fillStyle = color;
  ctx.fillRect(x + 7 + legOff, y + 42 + yOff, 8, 3);
  ctx.fillRect(x + 17 - legOff, y + 42 + yOff, 8, 3);

  // Shoes
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(x + 7 + legOff, y + 45 + yOff, 8, 3);
  ctx.fillRect(x + 17 - legOff, y + 45 + yOff, 8, 3);
}

/** 파츠 등록 */
export function registerBodyParts(): void {
  registerPart(
    { id: "body_01", category: "body", name: "Standard", colorable: true, defaultColor: "#f5d0a9" },
    drawBodyStandard,
  );
  registerPart(
    { id: "body_02", category: "body", name: "Slim", colorable: true, defaultColor: "#f5d0a9" },
    drawBodySlim,
  );
  registerPart(
    { id: "body_03", category: "body", name: "Broad", colorable: true, defaultColor: "#f5d0a9" },
    drawBodyBroad,
  );
}
