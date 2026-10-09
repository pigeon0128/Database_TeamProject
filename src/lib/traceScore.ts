// 따라 그리기 채점 (픽셀 단위).
// 밑그림에서 "흰 선 픽셀"과 "회색 선 픽셀"을 미리 구해 두고, 사용자가 칠한 픽셀과 비교한다.
//   흰 선 채움(%)   = 칠한 흰 선 픽셀 / 전체 흰 선 픽셀 × 100
//   회색 선 침범(%) = 칠한 회색 선 픽셀 / 전체 회색 선 픽셀 × 100
//   점수            = 흰 선 채움 − 회색 선 침범  (0~100)

/** 이 밝기 이상이면 흰 선(인물/주요 요소) */
const WHITE_MIN = 225;
/** 이 밝기 이하면 회색 선(배경) */
const GRAY_MAX = 160;
/** 흰 선에서 이 픽셀 거리 이내의 회색 선은 침범으로 치지 않는다 (선이 맞닿는 곳) */
const GRAY_TOLERANCE = 3;
/** 칠한 것으로 보는 최소 알파값 */
const PAINT_ALPHA_MIN = 40;

export type Rect = { x: number; y: number; w: number; h: number };

export type GuideMasks = {
  width: number;
  height: number;
  white: Uint8Array;
  gray: Uint8Array;
  whiteTotal: number;
  grayTotal: number;
};

export type TraceScore = {
  score: number;
  /** 흰 선 픽셀 중 칠한 비율 (%) */
  whitePct: number;
  /** 회색 선 픽셀 중 칠한 비율 (%) */
  grayPct: number;
  whiteHits: number;
  grayHits: number;
};

export const emptyScore: TraceScore = { score: 0, whitePct: 0, grayPct: 0, whiteHits: 0, grayHits: 0 };

const inRects = (x: number, y: number, rects: Rect[]) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

/** 1차원 최대값 필터를 가로·세로로 적용해 mask를 radius만큼 두껍게 만든다. */
function dilate(mask: Uint8Array, width: number, height: number, radius: number) {
  const tmp = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      for (let dx = Math.max(0, x - radius); dx <= Math.min(width - 1, x + radius); dx++) tmp[row + dx] = 1;
    }
  }
  const out = new Uint8Array(mask.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!tmp[y * width + x]) continue;
      for (let dy = Math.max(0, y - radius); dy <= Math.min(height - 1, y + radius); dy++) out[dy * width + x] = 1;
    }
  }
  return out;
}

export function buildGuideMasks(img: CanvasImageSource, width: number, height: number, exclude: Rect[] = []): GuideMasks {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const white = new Uint8Array(width * height);
  const rawGray = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (inRects(x, y, exclude)) continue;
      const i = y * width + x;
      const v = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
      if (v >= WHITE_MIN) white[i] = 1;
      else if (v <= GRAY_MAX) rawGray[i] = 1;
    }
  }

  const nearWhite = dilate(white, width, height, GRAY_TOLERANCE);
  const gray = new Uint8Array(width * height);
  let whiteTotal = 0;
  let grayTotal = 0;
  for (let i = 0; i < gray.length; i++) {
    whiteTotal += white[i];
    if (rawGray[i] && !nearWhite[i]) {
      gray[i] = 1;
      grayTotal++;
    }
  }
  return { width, height, white, gray, whiteTotal, grayTotal };
}

export function scoreCanvas(canvas: HTMLCanvasElement, masks: GuideMasks): TraceScore {
  const { width, height, white, gray } = masks;
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;

  let whiteHits = 0;
  let grayHits = 0;
  for (let i = 0; i < white.length; i++) {
    if (data[i * 4 + 3] < PAINT_ALPHA_MIN) continue;
    if (white[i]) whiteHits++;
    else if (gray[i]) grayHits++;
  }

  const whitePct = (whiteHits / Math.max(1, masks.whiteTotal)) * 100;
  const grayPct = (grayHits / Math.max(1, masks.grayTotal)) * 100;
  const score = Math.round(Math.max(0, Math.min(100, whitePct - grayPct)));
  return { score, whitePct, grayPct, whiteHits, grayHits };
}
