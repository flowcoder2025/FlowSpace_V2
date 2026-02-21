/**
 * Eyes Drawer - 4종 (round, narrow, wide, dot)
 *
 * 방향별: down=양쪽, left/right=한쪽, up=없음
 * color = 눈동자 색상
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";

/** Round eyes (기본) */
function drawEyesRound(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    // 흰자
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 10 + yOff, 4, 4);
    ctx.fillRect(x + 18, y + 10 + yOff, 4, 4);
    // 눈동자
    ctx.fillStyle = color;
    ctx.fillRect(x + 11, y + 11 + yOff, 3, 3);
    ctx.fillRect(x + 19, y + 11 + yOff, 3, 3);
  } else if (direction === 1) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 10 + yOff, 4, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y + 11 + yOff, 3, 3);
  } else if (direction === 2) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 18, y + 10 + yOff, 4, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 19, y + 11 + yOff, 3, 3);
  }
  // direction === 3 (up): 눈 안 보임
}

/** Narrow eyes */
function drawEyesNarrow(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;

  if (direction === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 11 + yOff, 4, 2);
    ctx.fillRect(x + 18, y + 11 + yOff, 4, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + 11, y + 11 + yOff, 3, 2);
    ctx.fillRect(x + 19, y + 11 + yOff, 3, 2);
  } else if (direction === 1) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 11 + yOff, 4, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y + 11 + yOff, 3, 2);
  } else if (direction === 2) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 18, y + 11 + yOff, 4, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + 19, y + 11 + yOff, 3, 2);
  }
}

/** Wide eyes */
function drawEyesWide(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;

  if (direction === 0) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 9, y + 9 + yOff, 5, 5);
    ctx.fillRect(x + 18, y + 9 + yOff, 5, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y + 10 + yOff, 3, 3);
    ctx.fillRect(x + 19, y + 10 + yOff, 3, 3);
    // 하이라이트
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 10 + yOff, 1, 1);
    ctx.fillRect(x + 19, y + 10 + yOff, 1, 1);
  } else if (direction === 1) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 9, y + 9 + yOff, 5, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y + 10 + yOff, 3, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 10, y + 10 + yOff, 1, 1);
  } else if (direction === 2) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 18, y + 9 + yOff, 5, 5);
    ctx.fillStyle = color;
    ctx.fillRect(x + 19, y + 10 + yOff, 3, 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 19, y + 10 + yOff, 1, 1);
  }
}

/** Dot eyes (심플) */
function drawEyesDot(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 11, y + 11 + yOff, 2, 2);
    ctx.fillRect(x + 19, y + 11 + yOff, 2, 2);
  } else if (direction === 1) {
    ctx.fillRect(x + 11, y + 11 + yOff, 2, 2);
  } else if (direction === 2) {
    ctx.fillRect(x + 19, y + 11 + yOff, 2, 2);
  }
}

export function registerEyesParts(): void {
  registerPart(
    { id: "eyes_01", category: "eyes", name: "Round", colorable: true, defaultColor: "#1a1a1a" },
    drawEyesRound,
  );
  registerPart(
    { id: "eyes_02", category: "eyes", name: "Narrow", colorable: true, defaultColor: "#1a1a1a" },
    drawEyesNarrow,
  );
  registerPart(
    { id: "eyes_03", category: "eyes", name: "Wide", colorable: true, defaultColor: "#1a1a1a" },
    drawEyesWide,
  );
  registerPart(
    { id: "eyes_04", category: "eyes", name: "Dot", colorable: true, defaultColor: "#1a1a1a" },
    drawEyesDot,
  );
}
