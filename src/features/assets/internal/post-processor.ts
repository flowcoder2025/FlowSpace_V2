import sharp from "sharp";

interface RemoveBackgroundOptions {
  /** 색상 허용 오차 (0-255, 기본값 30) */
  tolerance?: number;
}

/**
 * 배경 제거 - 가장자리 flood-fill 방식
 *
 * 픽셀아트는 배경이 단색이므로 4개 코너 픽셀의 최빈 색상을 배경으로 판단.
 * 이미지 가장자리에서 BFS flood-fill로 연결된 배경 픽셀만 투명화.
 * → 캐릭터 내부의 유사 색상 픽셀은 보존됨 (캐릭터 외곽이 장벽).
 * 경계 1px feathering으로 자연스러운 에지 처리.
 */
export async function removeBackground(
  buffer: Buffer,
  options: RemoveBackgroundOptions = {}
): Promise<Buffer> {
  const tolerance = options.tolerance ?? 30;

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const channels = info.channels; // 4 (RGBA)

  // 코너 4개 픽셀의 색상 추출
  const corners = [
    getPixel(pixels, 0, 0, width, channels),
    getPixel(pixels, width - 1, 0, width, channels),
    getPixel(pixels, 0, height - 1, width, channels),
    getPixel(pixels, width - 1, height - 1, width, channels),
  ];

  const bgColor = findDominantColor(corners, tolerance);

  const result = new Uint8Array(pixels.length);
  result.set(pixels);

  // Flood-fill: 가장자리에서 연결된 배경 픽셀만 제거
  const isBg = new Uint8Array(width * height); // 0=미방문, 1=배경
  const queue: number[] = []; // flat index (y * width + x)

  // 4변 가장자리 픽셀을 시드로 등록
  for (let x = 0; x < width; x++) {
    enqueueSeed(x, 0);
    enqueueSeed(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    enqueueSeed(0, y);
    enqueueSeed(width - 1, y);
  }

  function enqueueSeed(x: number, y: number) {
    const fi = y * width + x;
    if (isBg[fi]) return;
    const idx = fi * channels;
    if (colorDistance(result, idx, bgColor) <= tolerance) {
      isBg[fi] = 1;
      queue.push(fi);
    }
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const fi = queue[head++];
    const x = fi % width;
    const y = (fi - x) / width;

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nfi = ny * width + nx;
      if (isBg[nfi]) continue;
      const nIdx = nfi * channels;
      if (colorDistance(result, nIdx, bgColor) <= tolerance) {
        isBg[nfi] = 1;
        queue.push(nfi);
      }
    }
  }

  // 배경 픽셀 투명화
  for (let i = 0; i < width * height; i++) {
    if (isBg[i]) {
      result[i * channels + 3] = 0;
    }
  }

  // 경계 feathering (배경 인접 전경 픽셀의 alpha 감소)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBg[y * width + x]) continue;

      let bgNeighbors = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (isBg[ny * width + nx]) bgNeighbors++;
        }
      }

      if (bgNeighbors > 0) {
        const idx = (y * width + x) * channels;
        const factor = 1 - bgNeighbors * 0.15;
        result[idx + 3] = Math.round(result[idx + 3] * Math.max(factor, 0.4));
      }
    }
  }

  return sharp(Buffer.from(result.buffer), {
    raw: { width, height, channels },
  })
    .png()
    .toBuffer();
}

/** 픽셀 색상 추출 [R, G, B] */
function getPixel(
  data: Uint8Array,
  x: number,
  y: number,
  width: number,
  channels: number
): [number, number, number] {
  const idx = (y * width + x) * channels;
  return [data[idx], data[idx + 1], data[idx + 2]];
}

/** 두 색상 간 유클리드 거리 */
function colorDistance(
  data: Uint8Array,
  idx: number,
  color: [number, number, number]
): number {
  const dr = data[idx] - color[0];
  const dg = data[idx + 1] - color[1];
  const db = data[idx + 2] - color[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** 코너 색상 중 최빈 색상 결정 */
function findDominantColor(
  corners: [number, number, number][],
  tolerance: number
): [number, number, number] {
  let bestColor = corners[0];
  let bestCount = 0;

  for (const color of corners) {
    let count = 0;
    for (const other of corners) {
      const dist = Math.sqrt(
        (color[0] - other[0]) ** 2 +
        (color[1] - other[1]) ** 2 +
        (color[2] - other[2]) ** 2
      );
      if (dist <= tolerance) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      bestColor = color;
    }
  }

  return bestColor;
}

// ---------------------------------------------------------------------------
// 캐릭터 프레임 정렬
// ---------------------------------------------------------------------------

interface AlignFramesOptions {
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  /** 하단 여백 (px). 캐릭터 발 아래 최소 공간. 기본값 2 */
  bottomPadding?: number;
  /** alpha > 0 픽셀이 이 수 미만이면 빈 프레임 취급. 기본값 16 */
  noiseThreshold?: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 캐릭터 스프라이트시트 프레임 정렬
 *
 * 배경 제거 후 프레임 간 캐릭터 위치 불일치를 보정한다.
 * 행(방향)별 median 기반 통일 시프트:
 * - 각 프레임의 bbox centerX / bottom 중앙값을 구한 뒤
 * - 이상치(IQR 벗어나는 프레임)를 제외하고
 * - 수평: median centerX → 프레임 중심으로 통일 이동
 * - 수직: median bottom → 프레임 하단(- bottomPadding)으로 통일 앵커
 * → 같은 행의 모든 프레임이 동일한 시프트 → 걷기 애니메이션 안정
 */
export async function alignCharacterFrames(
  buffer: Buffer,
  options: AlignFramesOptions
): Promise<Buffer> {
  const { frameWidth, frameHeight, columns, rows } = options;
  const bottomPadding = options.bottomPadding ?? 2;
  const noiseThreshold = options.noiseThreshold ?? 16;

  const expectedW = columns * frameWidth;
  const expectedH = rows * frameHeight;

  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  if (width !== expectedW || height !== expectedH) {
    console.warn(
      `[alignCharacterFrames] 크기 불일치: ${width}×${height} ≠ ${expectedW}×${expectedH}, 원본 반환`
    );
    return buffer;
  }

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const ch = info.channels; // 4 (RGBA)

  // 1) 모든 프레임의 바운딩박스 검출
  const bboxes: (BoundingBox | null)[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowBoxes: (BoundingBox | null)[] = [];
    for (let c = 0; c < columns; c++) {
      rowBoxes.push(
        findFrameBoundingBox(
          pixels, width, ch,
          c * frameWidth, r * frameHeight,
          frameWidth, frameHeight,
          noiseThreshold
        )
      );
    }
    bboxes.push(rowBoxes);
  }

  // 2) 행별 median 기반 통일 시프트 적용
  const out = new Uint8Array(pixels.length); // 전부 0 = 투명

  for (let r = 0; r < rows; r++) {
    const validBoxes = bboxes[r].filter((b): b is BoundingBox => b !== null);

    if (validBoxes.length === 0) {
      for (let c = 0; c < columns; c++) {
        copyFrame(pixels, out, width, ch, c * frameWidth, r * frameHeight, frameWidth, frameHeight);
      }
      continue;
    }

    // centerX, bottom 값 수집
    const centerXs = validBoxes.map(b => (b.minX + b.maxX) / 2);
    const bottoms = validBoxes.map(b => b.maxY);

    // 이상치 제거 후 median 계산
    const filteredCXs = removeOutliers(centerXs);
    const filteredBots = removeOutliers(bottoms);

    const medCX = calcMedian(filteredCXs.length > 0 ? filteredCXs : centerXs);
    const medBot = calcMedian(filteredBots.length > 0 ? filteredBots : bottoms);

    // 행 내 모든 프레임에 동일한 시프트
    const shiftX = Math.round(frameWidth / 2 - medCX);
    const shiftY = Math.round((frameHeight - 1 - bottomPadding) - medBot);

    for (let c = 0; c < columns; c++) {
      const frameX = c * frameWidth;
      const frameY = r * frameHeight;

      if (!bboxes[r][c]) {
        copyFrame(pixels, out, width, ch, frameX, frameY, frameWidth, frameHeight);
        continue;
      }

      for (let ly = 0; ly < frameHeight; ly++) {
        for (let lx = 0; lx < frameWidth; lx++) {
          const srcGX = frameX + lx;
          const srcGY = frameY + ly;
          const srcIdx = (srcGY * width + srcGX) * ch;

          if (pixels[srcIdx + 3] === 0) continue;

          const dstLX = lx + shiftX;
          const dstLY = ly + shiftY;

          if (dstLX < 0 || dstLX >= frameWidth || dstLY < 0 || dstLY >= frameHeight) {
            continue;
          }

          const dstGX = frameX + dstLX;
          const dstGY = frameY + dstLY;
          const dstIdx = (dstGY * width + dstGX) * ch;

          out[dstIdx] = pixels[srcIdx];
          out[dstIdx + 1] = pixels[srcIdx + 1];
          out[dstIdx + 2] = pixels[srcIdx + 2];
          out[dstIdx + 3] = pixels[srcIdx + 3];
        }
      }
    }
  }

  return sharp(Buffer.from(out.buffer), {
    raw: { width, height, channels: ch },
  })
    .png()
    .toBuffer();
}

/** 프레임을 그대로 복사 */
function copyFrame(
  src: Uint8Array, dst: Uint8Array,
  imageWidth: number, channels: number,
  frameX: number, frameY: number,
  frameW: number, frameH: number
): void {
  for (let ly = 0; ly < frameH; ly++) {
    const srcStart = ((frameY + ly) * imageWidth + frameX) * channels;
    const len = frameW * channels;
    dst.set(src.subarray(srcStart, srcStart + len), srcStart);
  }
}

/** 정렬된 배열의 중앙값 */
function calcMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** IQR 기반 이상치 제거 */
function removeOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return values.filter(v => v >= lo && v <= hi);
}

/** 프레임 내 비투명 픽셀의 바운딩박스 검출 */
function findFrameBoundingBox(
  pixels: Uint8Array,
  imageWidth: number,
  channels: number,
  frameX: number,
  frameY: number,
  frameW: number,
  frameH: number,
  noiseThreshold: number
): BoundingBox | null {
  let minX = frameW;
  let minY = frameH;
  let maxX = -1;
  let maxY = -1;
  let count = 0;

  for (let ly = 0; ly < frameH; ly++) {
    for (let lx = 0; lx < frameW; lx++) {
      const gx = frameX + lx;
      const gy = frameY + ly;
      const idx = (gy * imageWidth + gx) * channels;

      if (pixels[idx + 3] > 0) {
        count++;
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
        if (ly < minY) minY = ly;
        if (ly > maxY) maxY = ly;
      }
    }
  }

  if (count < noiseThreshold) return null;
  return { minX, minY, maxX, maxY };
}

// ---------------------------------------------------------------------------
// 치비 프레임 리사이즈 + 스프라이트시트 합성
// ---------------------------------------------------------------------------

interface NormalizeFrameOptions {
  /** 캐릭터가 차지할 최대 높이 비율 (0-1, 기본 0.875 = 112/128) */
  maxHeightRatio?: number;
  /** 바닥선 Y 위치 (0-1, 기본 0.9375 = 120/128) */
  footlineRatio?: number;
  /** alpha > 0 픽셀이 이 수 미만이면 빈 프레임 취급. 기본값 16 */
  noiseThreshold?: number;
}

/**
 * 단일 프레임을 bbox 크롭 → 표준 높이 스케일 → 바닥선 앵커로 정규화
 *
 * 1. 배경 제거 후 알파 채널에서 non-transparent bounding box 계산
 * 2. bbox를 기준으로 크롭
 * 3. 크롭된 캐릭터를 목표 높이로 비율 유지 리사이즈
 * 4. targetW×targetH 투명 캔버스에 X=중앙, Y=바닥선 앵커로 합성
 *
 * → 모든 프레임에서 캐릭터 크기/위치가 통일됨
 */
export async function resizeFrame(
  buffer: Buffer,
  targetW: number,
  targetH: number,
  options: NormalizeFrameOptions = {}
): Promise<Buffer> {
  const maxHeightRatio = options.maxHeightRatio ?? 0.875;
  const footlineRatio = options.footlineRatio ?? 0.9375;
  const noiseThreshold = options.noiseThreshold ?? 16;

  const image = sharp(buffer);
  const meta = await image.metadata();
  const srcW = meta.width!;
  const srcH = meta.height!;

  // 알파 채널에서 bbox 검출 (alpha > 10 — 분석기 임계값과 일치)
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const ch = info.channels;

  let minX = srcW, minY = srcH, maxX = -1, maxY = -1;
  let count = 0;
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      if (pixels[(y * srcW + x) * ch + 3] > 10) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 빈 프레임이면 투명 캔버스 반환
  if (count < noiseThreshold || maxX < minX) {
    return sharp({
      create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
  }

  // bbox 크롭
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const cropped = await sharp(buffer)
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .toBuffer();

  // 목표 높이 계산 (캔버스의 maxHeightRatio)
  const targetCharH = Math.round(targetH * maxHeightRatio);
  const scale = Math.min(targetCharH / cropH, targetW / cropW);
  const scaledW = Math.max(1, Math.round(cropW * scale));
  const scaledH = Math.max(1, Math.round(cropH * scale));

  const resized = await sharp(cropped)
    .resize(scaledW, scaledH, { fit: "fill" })
    .toBuffer();

  // 투명 캔버스에 합성: X 중앙, Y 바닥선 앵커
  const footlineY = Math.round(targetH * footlineRatio);
  const top = Math.max(0, footlineY - scaledH);
  const left = Math.max(0, Math.round((targetW - scaledW) / 2));

  return sharp({
    create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

interface FrameBBox {
  minX: number; minY: number; maxX: number; maxY: number;
  cropW: number; cropH: number;
  centerX: number;
}

/** 단일 프레임의 알파 bbox 추출 */
async function extractBBox(
  buffer: Buffer,
  noiseThreshold = 16,
  /** alpha 임계값 — 이 값 이하의 픽셀은 투명 취급 (분석기와 일치: >10) */
  alphaThreshold = 10
): Promise<FrameBBox | null> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const w = meta.width!;
  const h = meta.height!;

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const ch = info.channels;

  let minX = w, minY = h, maxX = -1, maxY = -1;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pixels[(y * w + x) * ch + 3] > alphaThreshold) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count < noiseThreshold || maxX < minX) return null;

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  return { minX, minY, maxX, maxY, cropW, cropH, centerX: (minX + maxX) / 2 };
}

interface NormalizeDirectionOptions {
  targetW: number;
  targetH: number;
  /** 캐릭터가 차지할 최대 높이 비율 (0-1, 기본 0.875 = 112/128) */
  maxHeightRatio?: number;
  /** 바닥선 Y 위치 (0-1, 기본 0.9375 = 120/128) */
  footlineRatio?: number;
}

/**
 * 같은 방향 프레임들을 일괄 정규화
 *
 * 1. 모든 프레임의 bbox 추출
 * 2. 중앙값(median) 기반 기준 캐릭터 크기 결정
 * 3. 각 프레임을 자체 bbox로 타이트 크롭
 * 4. 모든 크롭을 동일한 scaledW×scaledH로 강제 리사이즈 (fit:fill)
 * 5. 투명 캔버스에 중앙 + 바닥선 앵커 배치
 *
 * → 같은 방향의 모든 프레임이 동일한 캐릭터 폭/높이를 가짐
 *   (좁은 캐릭터는 살짝 늘어나고, 넓은 캐릭터는 살짝 줄어듦)
 */
export async function normalizeDirectionFrames(
  frames: Buffer[],
  options: NormalizeDirectionOptions
): Promise<Buffer[]> {
  const { targetW, targetH } = options;
  const maxHeightRatio = options.maxHeightRatio ?? 0.875;
  const footlineRatio = options.footlineRatio ?? 0.9375;

  // 1. 모든 프레임 bbox 추출
  const bboxes = await Promise.all(frames.map((f) => extractBBox(f)));

  // 2. 유효 bbox에서 중앙값 기반 기준 크기 결정
  const validBBoxes = bboxes.filter((b): b is FrameBBox => b !== null);
  if (validBBoxes.length === 0) {
    const empty = await sharp({
      create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer();
    return frames.map(() => empty);
  }

  // 중앙값 계산 (이상치에 강건)
  const sortedWidths = validBBoxes.map((b) => b.cropW).sort((a, b) => a - b);
  const sortedHeights = validBBoxes.map((b) => b.cropH).sort((a, b) => a - b);
  const medianW = sortedWidths[Math.floor(sortedWidths.length / 2)];
  const medianH = sortedHeights[Math.floor(sortedHeights.length / 2)];

  // 3. 통일 스케일 계산 (median 기준 → 캔버스 맞춤)
  const targetCharH = Math.round(targetH * maxHeightRatio);
  const scale = Math.min(targetCharH / medianH, targetW / medianW);
  const scaledW = Math.max(1, Math.round(medianW * scale));
  const scaledH = Math.max(1, Math.round(medianH * scale));
  const footlineY = Math.round(targetH * footlineRatio);

  console.log(
    `[normalizeDir] median bbox: ${medianW}×${medianH}, scale: ${scale.toFixed(3)}, scaled: ${scaledW}×${scaledH}`
  );

  // 4. 각 프레임: 자체 bbox 타이트 크롭 → 동일 크기 강제 리사이즈 → 캔버스 배치
  const phase1: Buffer[] = [];

  for (let i = 0; i < frames.length; i++) {
    const bbox = bboxes[i];

    if (!bbox) {
      phase1.push(
        await sharp({
          create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
        }).png().toBuffer()
      );
      continue;
    }

    // 자체 bbox로 타이트 크롭 (투명 영역 완전 제거)
    const cropped = await sharp(frames[i])
      .extract({ left: bbox.minX, top: bbox.minY, width: bbox.cropW, height: bbox.cropH })
      .toBuffer();

    // 모든 프레임을 동일한 scaledW×scaledH로 강제 리사이즈
    const resized = await sharp(cropped)
      .resize(scaledW, scaledH, { fit: "fill" })
      .toBuffer();

    // 캔버스에 배치: X 중앙, Y 바닥선 앵커
    const top = Math.max(0, footlineY - scaledH);
    const left = Math.max(0, Math.round((targetW - scaledW) / 2));

    phase1.push(
      await sharp({
        create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: resized, left, top }])
        .png()
        .toBuffer()
    );
  }

  // 5. 2차 equalization: 캔버스 배치 후 실제 bbox 재측정 → 폭 강제 통일
  //    downscale + internal transparency 로 인한 폭 차이를 보정
  const finalBboxes = await Promise.all(phase1.map((f) => extractBBox(f)));
  const validFinal = finalBboxes.filter((b): b is FrameBBox => b !== null);

  if (validFinal.length === 0) return phase1;

  const finalWidths = validFinal.map((b) => b.cropW).sort((a, b) => a - b);
  const targetBboxW = finalWidths[Math.floor(finalWidths.length / 2)];
  const widthRange = finalWidths[finalWidths.length - 1] - finalWidths[0];

  // 폭 편차가 2px 이하면 equalization 불필요
  if (widthRange <= 2) {
    console.log(`[normalizeDir] equalization skip (range=${widthRange}px)`);
    return phase1;
  }

  console.log(
    `[normalizeDir] equalization: target bboxW=${targetBboxW}px (range ${finalWidths[0]}~${finalWidths[finalWidths.length - 1]})`
  );

  const results: Buffer[] = [];
  for (let i = 0; i < phase1.length; i++) {
    const fb = finalBboxes[i];

    if (!fb || fb.cropW === targetBboxW) {
      results.push(phase1[i]);
      continue;
    }

    // bbox 영역 추출 → target 폭으로 수평 스케일링 → 재배치
    const content = await sharp(phase1[i])
      .extract({ left: fb.minX, top: fb.minY, width: fb.cropW, height: fb.cropH })
      .toBuffer();

    const stretched = await sharp(content)
      .resize(targetBboxW, fb.cropH, { fit: "fill" })
      .toBuffer();

    // 원래 Y 위치 유지, X는 중앙 정렬
    const newLeft = Math.max(0, Math.round((targetW - targetBboxW) / 2));

    results.push(
      await sharp({
        create: { width: targetW, height: targetH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: stretched, left: newLeft, top: fb.minY }])
        .png()
        .toBuffer()
    );
  }

  return results;
}

interface ComposeSpriteSheetOptions {
  frameW: number;
  frameH: number;
  cols: number;
  rows: number;
}

/**
 * 개별 프레임 Buffer 배열을 하나의 스프라이트시트로 합성
 *
 * 프레임 순서: [down_0..7, left_0..7, right_0..7, up_0..7]
 * → rows=4, cols=8 → 8×4 grid
 */
export async function composeSpriteSheet(
  frames: Buffer[],
  options: ComposeSpriteSheetOptions
): Promise<Buffer> {
  const { frameW, frameH, cols, rows } = options;
  const totalW = cols * frameW;
  const totalH = rows * frameH;

  const composites: sharp.OverlayOptions[] = frames.map((frame, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      input: frame,
      left: col * frameW,
      top: row * frameH,
    };
  });

  return sharp({
    create: {
      width: totalW,
      height: totalH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

// ---------------------------------------------------------------------------
// 치비 걷기 프레임 코드 생성
// ---------------------------------------------------------------------------

/**
 * 단일 기저 프레임에서 8프레임 걷기 사이클 생성
 *
 * 1. baseFrame에서 alpha bbox 추출
 * 2. 캐릭터를 상체(~60%)/하체(~40%)로 분리
 * 3. 8프레임에 바디밥(Y축) + 하체 X시프트 적용
 * 4. 각 프레임을 원본과 동일 크기의 투명 캔버스에 합성
 */
export async function generateWalkFrames(
  baseFrame: Buffer,
  frameCount = 8
): Promise<Buffer[]> {
  const meta = await sharp(baseFrame).metadata();
  const canvasW = meta.width!;
  const canvasH = meta.height!;

  // 1. bbox 추출
  const bbox = await extractBBox(baseFrame);
  if (!bbox) {
    // 빈 프레임이면 동일한 빈 프레임 반환
    return Array(frameCount).fill(baseFrame);
  }

  const { minX, minY, cropW, cropH } = bbox;

  // 2. 상체/하체 분리 지점 (bbox 높이의 60%)
  const splitRatio = 0.6;
  const splitH = Math.round(cropH * splitRatio);
  const lowerH = cropH - splitH;

  // 상체 크롭
  const upperBody = await sharp(baseFrame)
    .extract({ left: minX, top: minY, width: cropW, height: splitH })
    .toBuffer();

  // 하체 크롭
  const lowerBody = await sharp(baseFrame)
    .extract({ left: minX, top: minY + splitH, width: cropW, height: lowerH })
    .toBuffer();

  // 3. 걷기 사이클 파라미터 (bbox 크기 비례 — 해상도 무관)
  const bobAmount = Math.max(2, Math.round(cropH * 0.04));
  const shiftAmount = Math.max(2, Math.round(cropW * 0.07));

  const bobFactors = [0, -0.6, -1, -0.6, 0, -0.6, -1, -0.6];
  const shiftFactors = [-1, -0.5, 0, 0.5, 1, 0.5, 0, -0.5];

  const bodyBob = bobFactors.map((f) => Math.round(f * bobAmount));
  const legShift = shiftFactors.map((f) => Math.round(f * shiftAmount));

  // 4. 8프레임 합성
  const frames: Buffer[] = [];

  for (let i = 0; i < frameCount; i++) {
    const bobY = bodyBob[i % bodyBob.length];
    const legX = legShift[i % legShift.length];

    const upperTop = Math.max(0, minY + bobY);
    const upperLeft = minX;

    const lowerTop = Math.max(0, minY + splitH + bobY);
    const lowerLeft = Math.max(0, Math.min(canvasW - cropW, minX + legX));

    const frame = await sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: upperBody, left: upperLeft, top: upperTop },
        { input: lowerBody, left: lowerLeft, top: lowerTop },
      ])
      .png()
      .toBuffer();

    frames.push(frame);
  }

  return frames;
}

/**
 * Seamless 타일 엣지 블렌딩
 *
 * 각 타일의 좌측 엣지 ↔ 우측 엣지, 상단 엣지 ↔ 하단 엣지를
 * 2px 범위에서 블렌딩하여 타일링 시 이음매를 줄임.
 */
export async function blendTileEdges(
  buffer: Buffer,
  tileW: number,
  tileH: number,
  cols: number,
  rows: number
): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const result = new Uint8Array(pixels.length);
  result.set(pixels);
  const ch = info.channels;

  const BLEND_PX = 2;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tileX = col * tileW;
      const tileY = row * tileH;

      // 수평 블렌딩 (좌 ↔ 우)
      for (let dy = 0; dy < tileH; dy++) {
        for (let b = 0; b < BLEND_PX; b++) {
          const alpha = (b + 0.5) / BLEND_PX; // 0→1 그래디언트

          const leftX = tileX + b;
          const rightX = tileX + tileW - 1 - b;

          if (leftX < width && rightX < width) {
            const y = tileY + dy;
            if (y >= height) continue;

            const li = (y * width + leftX) * ch;
            const ri = (y * width + rightX) * ch;

            // 좌-우 평균 블렌딩
            for (let c = 0; c < 3; c++) {
              const avg = Math.round(pixels[li + c] * (1 - alpha) + pixels[ri + c] * alpha);
              result[li + c] = Math.round(pixels[li + c] * alpha + avg * (1 - alpha));
              result[ri + c] = Math.round(pixels[ri + c] * alpha + avg * (1 - alpha));
            }
          }
        }
      }

      // 수직 블렌딩 (상 ↔ 하)
      for (let dx = 0; dx < tileW; dx++) {
        for (let b = 0; b < BLEND_PX; b++) {
          const alpha = (b + 0.5) / BLEND_PX;

          const topY = tileY + b;
          const botY = tileY + tileH - 1 - b;

          if (topY < height && botY < height) {
            const x = tileX + dx;
            if (x >= width) continue;

            const ti = (topY * width + x) * ch;
            const bi = (botY * width + x) * ch;

            for (let c = 0; c < 3; c++) {
              const avg = Math.round(result[ti + c] * (1 - alpha) + result[bi + c] * alpha);
              result[ti + c] = Math.round(result[ti + c] * alpha + avg * (1 - alpha));
              result[bi + c] = Math.round(result[bi + c] * alpha + avg * (1 - alpha));
            }
          }
        }
      }
    }
  }

  return sharp(Buffer.from(result.buffer), {
    raw: { width, height, channels: ch },
  })
    .png()
    .toBuffer();
}
