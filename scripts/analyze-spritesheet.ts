/**
 * 스프라이트시트 품질 분석기
 *
 * 생성된 캐릭터 스프라이트시트를 객관적 수치로 분석한다.
 * 생성 테스트 후 반드시 이 스크립트를 실행하고 출력을 그대로 보고할 것.
 *
 * Usage: npx tsx scripts/analyze-spritesheet.ts <image-path> [cols] [rows]
 *   cols default=8, rows default=4
 */
import sharp from "sharp";
import { readFile } from "fs/promises";
import { resolve } from "path";

interface FrameAnalysis {
  col: number;
  row: number;
  empty: boolean;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  occupancy: number; // non-transparent pixel ratio (0~1)
  centerOffsetX: number; // bbox center offset from frame center
  centerOffsetY: number;
}

interface SheetReport {
  file: string;
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  cols: number;
  rows: number;
  totalFrames: number;
  emptyFrames: number;
  filledFrames: number;
  frames: FrameAnalysis[];
  // aggregate metrics
  avgBboxW: number;
  avgBboxH: number;
  minBboxW: number;
  maxBboxW: number;
  minBboxH: number;
  maxBboxH: number;
  sizeVarianceW: number; // std dev of bbox widths
  sizeVarianceH: number;
  avgOccupancy: number;
  avgCenterOffsetX: number;
  avgCenterOffsetY: number;
  grade: "PASS" | "WARN" | "FAIL";
  problems: string[];
}

function findBoundingBox(
  pixels: Uint8Array,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  sheetWidth: number,
  channels: number
): { x: number; y: number; w: number; h: number; filledPixels: number } {
  let minX = frameW;
  let minY = frameH;
  let maxX = -1;
  let maxY = -1;
  let filledPixels = 0;

  for (let y = 0; y < frameH; y++) {
    for (let x = 0; x < frameW; x++) {
      const px = frameX + x;
      const py = frameY + y;
      const idx = (py * sheetWidth + px) * channels;
      const alpha = channels >= 4 ? pixels[idx + 3] : 255;
      if (alpha > 10) {
        filledPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return { x: 0, y: 0, w: 0, h: 0, filledPixels: 0 };
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, filledPixels };
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

async function analyze(
  imagePath: string,
  cols: number,
  rows: number
): Promise<SheetReport> {
  const absPath = resolve(imagePath);
  const buf = await readFile(absPath);
  const img = sharp(buf).ensureAlpha();
  const meta = await img.metadata();
  const { width: sheetWidth = 0, height: sheetHeight = 0 } = meta;
  const raw = await img.raw().toBuffer();
  const pixels = new Uint8Array(raw);
  const channels = 4;

  const frameW = Math.floor(sheetWidth / cols);
  const frameH = Math.floor(sheetHeight / rows);
  const frames: FrameAnalysis[] = [];
  const problems: string[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fx = c * frameW;
      const fy = r * frameH;
      const bb = findBoundingBox(pixels, fx, fy, frameW, frameH, sheetWidth, channels);
      const totalPixels = frameW * frameH;
      const occupancy = bb.filledPixels / totalPixels;
      const empty = bb.filledPixels === 0;

      const bboxCenterX = empty ? 0 : bb.x + bb.w / 2;
      const bboxCenterY = empty ? 0 : bb.y + bb.h / 2;
      const frameCenterX = frameW / 2;
      const frameCenterY = frameH / 2;

      frames.push({
        col: c,
        row: r,
        empty,
        bboxX: bb.x,
        bboxY: bb.y,
        bboxW: bb.w,
        bboxH: bb.h,
        occupancy: Math.round(occupancy * 1000) / 1000,
        centerOffsetX: empty ? 0 : Math.round(bboxCenterX - frameCenterX),
        centerOffsetY: empty ? 0 : Math.round(bboxCenterY - frameCenterY),
      });
    }
  }

  const filled = frames.filter((f) => !f.empty);
  const emptyCount = frames.length - filled.length;

  const bboxWidths = filled.map((f) => f.bboxW);
  const bboxHeights = filled.map((f) => f.bboxH);
  const occupancies = filled.map((f) => f.occupancy);
  const centerOffsetsX = filled.map((f) => Math.abs(f.centerOffsetX));
  const centerOffsetsY = filled.map((f) => Math.abs(f.centerOffsetY));

  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const avgBboxW = avg(bboxWidths);
  const avgBboxH = avg(bboxHeights);
  const minBboxW = bboxWidths.length ? Math.min(...bboxWidths) : 0;
  const maxBboxW = bboxWidths.length ? Math.max(...bboxWidths) : 0;
  const minBboxH = bboxHeights.length ? Math.min(...bboxHeights) : 0;
  const maxBboxH = bboxHeights.length ? Math.max(...bboxHeights) : 0;
  const sizeVarianceW = Math.round(stddev(bboxWidths) * 10) / 10;
  const sizeVarianceH = Math.round(stddev(bboxHeights) * 10) / 10;
  const avgOccupancy = Math.round((occupancies.reduce((a, b) => a + b, 0) / (occupancies.length || 1)) * 1000) / 1000;
  const avgCenterOffsetX = avg(centerOffsetsX);
  const avgCenterOffsetY = avg(centerOffsetsY);

  // grading
  if (emptyCount > 0) problems.push(`빈 프레임 ${emptyCount}개`);
  if (maxBboxW - minBboxW > frameW * 0.4)
    problems.push(`가로 크기 편차 심각: ${minBboxW}~${maxBboxW}px (차이 ${maxBboxW - minBboxW}px)`);
  if (maxBboxH - minBboxH > frameH * 0.4)
    problems.push(`세로 크기 편차 심각: ${minBboxH}~${maxBboxH}px (차이 ${maxBboxH - minBboxH}px)`);
  if (sizeVarianceW > frameW * 0.15)
    problems.push(`가로 크기 표준편차 높음: ${sizeVarianceW}px`);
  if (sizeVarianceH > frameH * 0.15)
    problems.push(`세로 크기 표준편차 높음: ${sizeVarianceH}px`);
  if (avgCenterOffsetX > frameW * 0.15)
    problems.push(`평균 가로 중심 이탈: ${avgCenterOffsetX}px`);
  if (avgCenterOffsetY > frameH * 0.15)
    problems.push(`평균 세로 중심 이탈: ${avgCenterOffsetY}px`);
  if (avgOccupancy < 0.05)
    problems.push(`평균 점유율 너무 낮음: ${(avgOccupancy * 100).toFixed(1)}%`);

  let grade: "PASS" | "WARN" | "FAIL" = "PASS";
  if (problems.length >= 3) grade = "FAIL";
  else if (problems.length >= 1) grade = "WARN";

  return {
    file: absPath,
    sheetWidth,
    sheetHeight,
    frameWidth: frameW,
    frameHeight: frameH,
    cols,
    rows,
    totalFrames: frames.length,
    emptyFrames: emptyCount,
    filledFrames: filled.length,
    frames,
    avgBboxW,
    avgBboxH,
    minBboxW,
    maxBboxW,
    minBboxH,
    maxBboxH,
    sizeVarianceW,
    sizeVarianceH,
    avgOccupancy,
    avgCenterOffsetX,
    avgCenterOffsetY,
    grade,
    problems,
  };
}

function printReport(r: SheetReport): void {
  console.log("=== SPRITESHEET QUALITY REPORT ===");
  console.log(`File: ${r.file}`);
  console.log(`Sheet: ${r.sheetWidth}x${r.sheetHeight}, Frame: ${r.frameWidth}x${r.frameHeight}, Grid: ${r.cols}x${r.rows}`);
  console.log(`Frames: ${r.filledFrames}/${r.totalFrames} filled, ${r.emptyFrames} empty`);
  console.log("");
  console.log("--- Size Consistency ---");
  console.log(`  BBox Width:  avg=${r.avgBboxW}px, min=${r.minBboxW}px, max=${r.maxBboxW}px, stddev=${r.sizeVarianceW}px`);
  console.log(`  BBox Height: avg=${r.avgBboxH}px, min=${r.minBboxH}px, max=${r.maxBboxH}px, stddev=${r.sizeVarianceH}px`);
  console.log(`  Size Range:  W=${r.maxBboxW - r.minBboxW}px, H=${r.maxBboxH - r.minBboxH}px`);
  console.log("");
  console.log("--- Alignment ---");
  console.log(`  Avg Center Offset: X=${r.avgCenterOffsetX}px, Y=${r.avgCenterOffsetY}px`);
  console.log(`  Avg Occupancy: ${(r.avgOccupancy * 100).toFixed(1)}%`);
  console.log("");

  // per-row summary
  console.log("--- Per-Row Summary ---");
  const directions = ["Down", "Left", "Right", "Up"];
  for (let row = 0; row < r.rows; row++) {
    const rowFrames = r.frames.filter((f) => f.row === row && !f.empty);
    if (rowFrames.length === 0) {
      console.log(`  Row ${row} (${directions[row] || "?"}): ALL EMPTY`);
      continue;
    }
    const ws = rowFrames.map((f) => f.bboxW);
    const hs = rowFrames.map((f) => f.bboxH);
    console.log(
      `  Row ${row} (${directions[row] || "?"}): ${rowFrames.length}/${r.cols} frames, W=${Math.min(...ws)}~${Math.max(...ws)}px, H=${Math.min(...hs)}~${Math.max(...hs)}px`
    );
  }
  console.log("");

  // grade
  console.log(`=== GRADE: ${r.grade} ===`);
  if (r.problems.length > 0) {
    console.log("Problems:");
    r.problems.forEach((p) => console.log(`  - ${p}`));
  }
}

// CLI entry
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npx tsx scripts/analyze-spritesheet.ts <image-path> [cols=8] [rows=4]");
  process.exit(1);
}

const filePath = args[0];
const cols = parseInt(args[1] || "8", 10);
const rows = parseInt(args[2] || "4", 10);

analyze(filePath, cols, rows)
  .then(printReport)
  .catch((err) => {
    console.error("Analysis failed:", err);
    process.exit(1);
  });
