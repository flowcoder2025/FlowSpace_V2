/**
 * Hair Drawer - 6종 (short, medium, long, curly, ponytail, buzz)
 *
 * color = 머리카락 색상
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";
import { adjustBrightness } from "./drawer-utils";

/** Short hair */
function drawHairShort(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    // Front - 이마+측면
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 6);
    ctx.fillRect(x + 7, y + 5 + yOff, 3, 4);
    ctx.fillRect(x + 22, y + 5 + yOff, 3, 4);
  } else if (direction === 3) {
    // Back
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 10);
  } else {
    // Side
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 6);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 5 + yOff, 5, 6);
    } else {
      ctx.fillRect(x + 7, y + 5 + yOff, 5, 6);
    }
  }
}

/** Medium hair */
function drawHairMedium(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 6);
    ctx.fillRect(x + 6, y + 4 + yOff, 3, 8);
    ctx.fillRect(x + 23, y + 4 + yOff, 3, 8);
    // 앞머리 디테일
    ctx.fillStyle = adjustBrightness(color, 15);
    ctx.fillRect(x + 10, y + 2 + yOff, 12, 2);
  } else if (direction === 3) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 14);
    ctx.fillStyle = adjustBrightness(color, -15);
    ctx.fillRect(x + 8, y + 12 + yOff, 16, 2);
  } else {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 6);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 4 + yOff, 6, 10);
    } else {
      ctx.fillRect(x + 6, y + 4 + yOff, 6, 10);
    }
  }
}

/** Long hair */
function drawHairLong(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 6);
    ctx.fillRect(x + 5, y + 4 + yOff, 4, 18);
    ctx.fillRect(x + 23, y + 4 + yOff, 4, 18);
    ctx.fillStyle = adjustBrightness(color, 15);
    ctx.fillRect(x + 10, y + 2 + yOff, 12, 2);
  } else if (direction === 3) {
    ctx.fillRect(x + 5, y + 0 + yOff, 22, 22);
    ctx.fillStyle = adjustBrightness(color, -15);
    ctx.fillRect(x + 7, y + 18 + yOff, 18, 3);
  } else {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 6);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 4 + yOff, 6, 18);
      ctx.fillRect(x + 5, y + 4 + yOff, 3, 12);
    } else {
      ctx.fillRect(x + 6, y + 4 + yOff, 6, 18);
      ctx.fillRect(x + 24, y + 4 + yOff, 3, 12);
    }
  }
}

/** Curly hair */
function drawHairCurly(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 5, y + 0 + yOff, 22, 7);
    ctx.fillRect(x + 5, y + 5 + yOff, 4, 10);
    ctx.fillRect(x + 23, y + 5 + yOff, 4, 10);
    // 곱슬 디테일
    ctx.fillStyle = adjustBrightness(color, 20);
    ctx.fillRect(x + 7, y + 1 + yOff, 2, 2);
    ctx.fillRect(x + 13, y + 1 + yOff, 2, 2);
    ctx.fillRect(x + 19, y + 1 + yOff, 2, 2);
  } else if (direction === 3) {
    ctx.fillRect(x + 5, y + 0 + yOff, 22, 16);
    ctx.fillStyle = adjustBrightness(color, 20);
    ctx.fillRect(x + 7, y + 2 + yOff, 2, 2);
    ctx.fillRect(x + 13, y + 4 + yOff, 2, 2);
    ctx.fillRect(x + 19, y + 2 + yOff, 2, 2);
  } else {
    ctx.fillRect(x + 5, y + 0 + yOff, 22, 7);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 5 + yOff, 7, 10);
    } else {
      ctx.fillRect(x + 5, y + 5 + yOff, 7, 10);
    }
  }
}

/** Ponytail */
function drawHairPonytail(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 7, y + 0 + yOff, 18, 6);
    ctx.fillRect(x + 7, y + 4 + yOff, 3, 5);
    ctx.fillRect(x + 22, y + 4 + yOff, 3, 5);
  } else if (direction === 3) {
    ctx.fillRect(x + 7, y + 0 + yOff, 18, 8);
    // 포니테일
    ctx.fillRect(x + 13, y + 8 + yOff, 6, 16);
    ctx.fillStyle = adjustBrightness(color, -15);
    ctx.fillRect(x + 14, y + 10 + yOff, 4, 2);
  } else {
    ctx.fillRect(x + 7, y + 0 + yOff, 18, 6);
    if (direction === 1) {
      ctx.fillRect(x + 20, y + 4 + yOff, 5, 6);
      // 측면 포니테일
      ctx.fillRect(x + 6, y + 8 + yOff, 5, 14);
    } else {
      ctx.fillRect(x + 7, y + 4 + yOff, 5, 6);
      ctx.fillRect(x + 21, y + 8 + yOff, 5, 14);
    }
  }
}

/** Buzz cut */
function drawHairBuzz(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 4);
  } else if (direction === 3) {
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 6);
  } else {
    ctx.fillRect(x + 7, y + 1 + yOff, 18, 5);
  }
}

export function registerHairParts(): void {
  registerPart(
    { id: "hair_01", category: "hair", name: "Short", colorable: true, defaultColor: "#2a1a0a" },
    drawHairShort,
  );
  registerPart(
    { id: "hair_02", category: "hair", name: "Medium", colorable: true, defaultColor: "#2a1a0a" },
    drawHairMedium,
  );
  registerPart(
    { id: "hair_03", category: "hair", name: "Long", colorable: true, defaultColor: "#2a1a0a" },
    drawHairLong,
  );
  registerPart(
    { id: "hair_04", category: "hair", name: "Curly", colorable: true, defaultColor: "#2a1a0a" },
    drawHairCurly,
  );
  registerPart(
    { id: "hair_05", category: "hair", name: "Ponytail", colorable: true, defaultColor: "#2a1a0a" },
    drawHairPonytail,
  );
  registerPart(
    { id: "hair_06", category: "hair", name: "Buzz", colorable: true, defaultColor: "#2a1a0a" },
    drawHairBuzz,
  );
}
