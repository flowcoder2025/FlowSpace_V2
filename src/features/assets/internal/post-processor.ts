import sharp from "sharp";

interface RemoveBackgroundOptions {
  /** 색상 허용 오차 (0-255, 기본값 30) */
  tolerance?: number;
}

/**
 * 배경 제거 - 코너 픽셀 색상 감지 후 동일 색상 투명화
 *
 * 픽셀아트는 배경이 단색이므로 4개 코너 픽셀의 최빈 색상을 배경으로 판단.
 * tolerance 범위 내의 픽셀을 투명(alpha=0)으로 변환.
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

  // RGBA raw 데이터 추출
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const channels = info.channels; // 4 (RGBA)

  // 코너 4개 픽셀의 색상 추출
  const corners = [
    getPixel(pixels, 0, 0, width, channels),                      // top-left
    getPixel(pixels, width - 1, 0, width, channels),              // top-right
    getPixel(pixels, 0, height - 1, width, channels),             // bottom-left
    getPixel(pixels, width - 1, height - 1, width, channels),     // bottom-right
  ];

  // 최빈 배경색 결정 (4코너 중 가장 자주 등장하는 색상)
  const bgColor = findDominantColor(corners, tolerance);

  // 배경 픽셀을 투명으로 변환
  const result = new Uint8Array(pixels.length);
  result.set(pixels);

  // 1차: 배경 픽셀 마킹
  const isBg = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      if (colorDistance(result, idx, bgColor) <= tolerance) {
        isBg[y * width + x] = 1;
        result[idx + 3] = 0; // alpha = 0
      }
    }
  }

  // 2차: 경계 feathering (배경 인접 전경 픽셀의 alpha 감소)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBg[y * width + x]) continue;

      // 인접 배경 픽셀 수 카운트
      let bgNeighbors = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (isBg[ny * width + nx]) bgNeighbors++;
        }
      }

      // 4개 이웃 중 배경이 있으면 alpha를 부분적으로 줄임 (feathering)
      if (bgNeighbors > 0) {
        const idx = (y * width + x) * channels;
        const factor = 1 - bgNeighbors * 0.15;
        result[idx + 3] = Math.round(result[idx + 3] * Math.max(factor, 0.4));
      }
    }
  }

  // PNG로 재조립
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
