/**
 * Accessory Drawer - 4종 + none
 * glasses, cap, backpack, headband
 *
 * color = 액세서리 색상
 */

import type { PartDrawContext } from "../parts-types";
import { registerPart } from "../parts-registry";

/** No accessory */
function drawAccNone(): void {
  // 아무것도 그리지 않음
}

/** Glasses */
function drawAccGlasses(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;

  if (direction === 3) return; // 뒷면에서는 안 보임

  ctx.fillStyle = color;

  if (direction === 0) {
    // 프레임
    ctx.fillRect(x + 9, y + 9 + yOff, 5, 5);
    ctx.fillRect(x + 18, y + 9 + yOff, 5, 5);
    ctx.fillRect(x + 14, y + 10 + yOff, 4, 2);
    // 렌즈 (투명 효과)
    ctx.fillStyle = "#88ccff80";
    ctx.fillRect(x + 10, y + 10 + yOff, 3, 3);
    ctx.fillRect(x + 19, y + 10 + yOff, 3, 3);
  } else if (direction === 1) {
    ctx.fillRect(x + 9, y + 9 + yOff, 5, 5);
    ctx.fillRect(x + 7, y + 10 + yOff, 3, 2);
    ctx.fillStyle = "#88ccff80";
    ctx.fillRect(x + 10, y + 10 + yOff, 3, 3);
  } else {
    ctx.fillRect(x + 18, y + 9 + yOff, 5, 5);
    ctx.fillRect(x + 22, y + 10 + yOff, 3, 2);
    ctx.fillStyle = "#88ccff80";
    ctx.fillRect(x + 19, y + 10 + yOff, 3, 3);
  }
}

/** Cap */
function drawAccCap(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 4);
    // 챙
    ctx.fillRect(x + 6, y + 4 + yOff, 22, 3);
  } else if (direction === 3) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 5);
    // 뒤쪽 조절대
    ctx.fillRect(x + 13, y + 5 + yOff, 6, 2);
  } else if (direction === 1) {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 4);
    ctx.fillRect(x + 4, y + 4 + yOff, 10, 3);
  } else {
    ctx.fillRect(x + 6, y + 0 + yOff, 20, 4);
    ctx.fillRect(x + 18, y + 4 + yOff, 10, 3);
  }
}

/** Backpack */
function drawAccBackpack(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 3) {
    // 뒷면에서만 보이는 배낭
    ctx.fillRect(x + 8, y + 18 + yOff, 16, 14);
    // 끈
    ctx.fillStyle = "#00000040";
    ctx.fillRect(x + 10, y + 18 + yOff, 2, 10);
    ctx.fillRect(x + 20, y + 18 + yOff, 2, 10);
  } else if (direction === 1) {
    // 측면에서 약간 보임
    ctx.fillRect(x + 5, y + 20 + yOff, 4, 10);
  } else if (direction === 2) {
    ctx.fillRect(x + 23, y + 20 + yOff, 4, 10);
  }
  // 앞면에서는 안 보임
}

/** Headband */
function drawAccHeadband(dc: PartDrawContext): void {
  const { ctx, x, y, direction, yOff, color } = dc;
  ctx.fillStyle = color;

  if (direction === 0) {
    ctx.fillRect(x + 7, y + 5 + yOff, 18, 2);
  } else if (direction === 3) {
    ctx.fillRect(x + 7, y + 5 + yOff, 18, 2);
    // 리본
    ctx.fillRect(x + 13, y + 4 + yOff, 6, 4);
  } else {
    ctx.fillRect(x + 7, y + 5 + yOff, 18, 2);
  }
}

export function registerAccessoryParts(): void {
  registerPart(
    { id: "acc_none", category: "accessory", name: "None", colorable: false },
    drawAccNone,
  );
  registerPart(
    { id: "acc_01", category: "accessory", name: "Glasses", colorable: true, defaultColor: "#1a1a1a" },
    drawAccGlasses,
  );
  registerPart(
    { id: "acc_02", category: "accessory", name: "Cap", colorable: true, defaultColor: "#c04040" },
    drawAccCap,
  );
  registerPart(
    { id: "acc_03", category: "accessory", name: "Backpack", colorable: true, defaultColor: "#8B4513" },
    drawAccBackpack,
  );
  registerPart(
    { id: "acc_04", category: "accessory", name: "Headband", colorable: true, defaultColor: "#ff6b9d" },
    drawAccHeadband,
  );
}
