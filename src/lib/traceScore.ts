// 따라 그리기 채점.
// 밑그림을 CELL×CELL 픽셀 칸으로 나눠 "흰 선 칸"과 "회색 선 칸"을 미리 구해 두고,
// 사용자가 칠한 칸과 비교해 점수를 낸다. 칸 단위로 비교하므로 선을 약간 벗어나도 인정된다.

const CELL = 4;
/** 이 밝기 이상이면 흰 선(인물/주요 요소) */
const WHITE_MIN = 225;
/** 이 밝기 이하면 회색 선(배경) */
const GRAY_MAX = 160;
/** 흰 선에서 이 칸 수 이내의 회색 선은 침범으로 치지 않는다 */
const GRAY_TOLERANCE = 2;
/** 칠한 것으로 보는 최소 알파값 */
const PAINT_ALPHA_MIN = 40;
/** 흰 선을 이 비율만큼 채우면 채움 점수 만점 */
const FULL_COVERAGE = 0.9;
/** 침범한 회색 선 칸 수(흰 선 칸 수 대비 %)에 곱하는 감점 배율 */
const PENALTY_WEIGHT = 1.5;

export type Rect = { x: number; y: number; w: number; h: number };

export type GuideMasks = {
  cols: number;
  rows: number;
  white: Uint8Array;
  gray: Uint8Array;
  whiteTotal: number;
};

export type TraceScore = {
  score: number;
  /** 흰 선을 채운 비율 (0~1) */
  coverage: number;
  /** 침범한 회색 선 칸 수 */
  grayHits: number;
  /** 감점 */
  penalty: number;
};

export function buildGuideMasks(img: HTMLImageElement, width: number, height: number, exclude: Rect[] = []): GuideMasks {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;

  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const white = new Uint8Array(cols * rows);
  const rawGray = new Uint8Array(cols * rows);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (exclude.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
      const i = (y * width + x) * 4;
      const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const cell = Math.floor(y / CELL) * cols + Math.floor(x / CELL);
      if (v >= WHITE_MIN) white[cell] = 1;
      else if (v <= GRAY_MAX) rawGray[cell] = 1;
    }
  }

  // 흰 선 바로 옆의 회색 선은 제외해서, 흰 선을 굵게 따라 그려도 억울하게 감점되지 않게 한다.
  const gray = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!rawGray[r * cols + c]) continue;
      let nearWhite = false;
      for (let dr = -GRAY_TOLERANCE; dr <= GRAY_TOLERANCE && !nearWhite; dr++) {
        for (let dc = -GRAY_TOLERANCE; dc <= GRAY_TOLERANCE; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && white[rr * cols + cc]) {
            nearWhite = true;
            break;
          }
        }
      }
      if (!nearWhite) gray[r * cols + c] = 1;
    }
  }

  let whiteTotal = 0;
  for (const v of white) whiteTotal += v;
  return { cols, rows, white, gray, whiteTotal };
}

export function scoreCanvas(canvas: HTMLCanvasElement, masks: GuideMasks): TraceScore {
  const { width, height } = canvas;
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const painted = new Uint8Array(masks.cols * masks.rows);
  for (let y = 0; y < height; y++) {
    const rowBase = Math.floor(y / CELL) * masks.cols;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] >= PAINT_ALPHA_MIN) painted[rowBase + Math.floor(x / CELL)] = 1;
    }
  }

  let whiteHits = 0;
  let grayHits = 0;
  for (let i = 0; i < painted.length; i++) {
    if (!painted[i]) continue;
    if (masks.white[i]) whiteHits++;
    else if (masks.gray[i]) grayHits++;
  }

  const total = Math.max(1, masks.whiteTotal);
  const coverage = whiteHits / total;
  const fillScore = Math.min(100, (coverage / FULL_COVERAGE) * 100);
  const penalty = (grayHits / total) * 100 * PENALTY_WEIGHT;
  const score = Math.round(Math.max(0, Math.min(100, fillScore - penalty)));
  return { score, coverage, grayHits, penalty: Math.round(penalty) };
}
