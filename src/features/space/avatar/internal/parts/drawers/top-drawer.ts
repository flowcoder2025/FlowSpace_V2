/**
 * Top (상의) Drawer - 6종
 * tshirt, hoodie, collared, jacket, tank, sweater
 *
 * color = 상의 색상
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";
import { adjustBrightness } from "./drawer-utils";

/** T-shirt */
function drawTopTshirt(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 몸통
  ctx.fillRect(x + 7, y + 19 + yOff, 18, 13);

  // 소매
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 6);
  } else if (direction === 2) {
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 6);
  } else {
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 6);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 6);
  }
}

/** Hoodie */
function drawTopHoodie(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 몸통 (좀 더 넓게)
  ctx.fillRect(x + 6, y + 18 + yOff, 20, 14);

  // 긴 소매
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 10);
  } else if (direction === 2) {
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 10);
  } else {
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 10);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 10);
  }

  // 후드 (뒷면)
  if (direction === 3) {
    ctx.fillStyle = adjustBrightness(color, -20);
    ctx.fillRect(x + 9, y + 14 + yOff, 14, 6);
  }

  // 주머니 (앞면)
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -15);
    ctx.fillRect(x + 10, y + 26 + yOff, 12, 4);
  }
}

/** Collared shirt */
function drawTopCollared(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 몸통
  ctx.fillRect(x + 7, y + 19 + yOff, 18, 13);

  // 소매
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 7);
  } else if (direction === 2) {
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 7);
  } else {
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 7);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 7);
  }

  // 칼라
  if (direction === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 17 + yOff, 4, 4);
    ctx.fillRect(x + 18, y + 17 + yOff, 4, 4);
  }

  // 단추 (앞면)
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -30);
    ctx.fillRect(x + 15, y + 22 + yOff, 2, 2);
    ctx.fillRect(x + 15, y + 26 + yOff, 2, 2);
  }
}

/** Jacket */
function drawTopJacket(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 몸통 (두껍게)
  ctx.fillRect(x + 5, y + 18 + yOff, 22, 14);

  // 긴 소매
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 6, 10);
  } else if (direction === 2) {
    ctx.fillRect(x + 3, y + 19 + yOff, 6, 10);
  } else {
    ctx.fillRect(x + 2, y + 19 + yOff, 6, 10);
    ctx.fillRect(x + 24, y + 19 + yOff, 6, 10);
  }

  // 지퍼 라인 (앞면)
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, -25);
    ctx.fillRect(x + 15, y + 18 + yOff, 2, 14);
  }
}

/** Tank top */
function drawTopTank(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 좁은 어깨 끈
  ctx.fillRect(x + 9, y + 18 + yOff, 14, 14);

  // 어깨 끈 (앞/뒤)
  if (direction === 0 || direction === 3) {
    ctx.fillRect(x + 9, y + 17 + yOff, 4, 2);
    ctx.fillRect(x + 19, y + 17 + yOff, 4, 2);
  }
}

/** Sweater */
function drawTopSweater(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  // 몸통 (폭넓게)
  ctx.fillRect(x + 6, y + 18 + yOff, 20, 14);

  // 긴 소매
  if (direction === 1) {
    ctx.fillRect(x + 23, y + 19 + yOff, 5, 10);
  } else if (direction === 2) {
    ctx.fillRect(x + 4, y + 19 + yOff, 5, 10);
  } else {
    ctx.fillRect(x + 3, y + 19 + yOff, 5, 10);
    ctx.fillRect(x + 24, y + 19 + yOff, 5, 10);
  }

  // 목 라인 (V-neck 패턴)
  if (direction === 0) {
    ctx.fillStyle = adjustBrightness(color, 20);
    ctx.fillRect(x + 12, y + 18 + yOff, 8, 2);
  }

  // 줄무늬 디테일
  ctx.fillStyle = adjustBrightness(color, -20);
  ctx.fillRect(x + 6, y + 28 + yOff, 20, 2);
}

export function registerTopParts(): void {
  registerPart(
    { id: "top_01", category: "top", name: "T-Shirt", colorable: true, defaultColor: "#4060c0" },
    drawTopTshirt,
  );
  registerPart(
    { id: "top_02", category: "top", name: "Hoodie", colorable: true, defaultColor: "#505050" },
    drawTopHoodie,
  );
  registerPart(
    { id: "top_03", category: "top", name: "Collared", colorable: true, defaultColor: "#ffffff" },
    drawTopCollared,
  );
  registerPart(
    { id: "top_04", category: "top", name: "Jacket", colorable: true, defaultColor: "#2a2a2a" },
    drawTopJacket,
  );
  registerPart(
    { id: "top_05", category: "top", name: "Tank Top", colorable: true, defaultColor: "#e0e0e0" },
    drawTopTank,
  );
  registerPart(
    { id: "top_06", category: "top", name: "Sweater", colorable: true, defaultColor: "#8040a0" },
    drawTopSweater,
  );
}
