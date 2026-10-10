// 따라 그리기 채점 (픽셀 단위).
// - buildGuideMasks: 밑그림에서 흰 선·회색 구역·흰 선 중심선을 미리 구한다 (장면마다 한 번).
// - scoreCanvas: 사용자가 그린 캔버스와 획을 마스크와 비교해 점수를 낸다 (그리는 동안 계속).
// - maxBrushSize: 흰 선 두께에 맞춘 브러쉬 최대 굵기.
//
// 밑그림에서 "흰 선 픽셀"과 "회색 구역 픽셀"(회색 선 + 회색 바탕, 즉 흰 선이 아닌 모든 곳)을
// 미리 구해 두고, 사용자가 칠한 픽셀과 비교한다.
//   흰 선 채움(%)     = 칠한 흰 선 픽셀 / 전체 흰 선 픽셀 × 100
//   회색 구역 침범(%) = 칠한 회색 구역 픽셀 / 전체 회색 구역 픽셀 × 100
//   침범 감점         = 회색 구역 침범 × GRAY_PENALTY_WEIGHT
//   잉크 효율(배)     = 흰 선 위를 지나간 획 길이 / 칠한 흰 선 중심선 길이
//   덧칠 감점         = (잉크 효율 − INK_FREE_RATIO) × INK_PENALTY_WEIGHT  (0 이상)
//   점수              = 흰 선 채움 − 침범 감점 − 덧칠 감점  (0~100)
// 한 번에 깔끔하게 그으면 잉크 효율이 1배 근처, 같은 곳을 덧칠하거나 지그재그로 문지르거나
// 짧은 털선을 여러 번 그으면 그만큼 커진다.

import type { Stroke } from "../components/TracingCanvas";

/** 이 밝기 이상이면 흰 선(인물/주요 요소) */
const WHITE_MIN = 225;
/** 흰 선에서 이 픽셀 거리 이내는 침범으로 치지 않는다 (흰 선의 흐린 가장자리) */
const GRAY_TOLERANCE = 3;
/**
 * 회색 구역 침범 민감도. 회색 구역(약 140만 픽셀)이 흰 선(약 5.5만 픽셀)보다 훨씬 넓어서
 * 그냥 %로 빼면 감점이 너무 약하므로 배율을 곱한다. 10이면 회색 구역 1% 침범 = −10점.
 */
const GRAY_PENALTY_WEIGHT = 10;
/** 칠한 것으로 보는 최소 알파값 */
const PAINT_ALPHA_MIN = 40;
/** 잉크 효율이 이 배율까지는 감점하지 않는다 (손떨림, 이어 그린 부분 등) */
const INK_FREE_RATIO = 1.3;
/** 잉크 효율이 허용치보다 1배 넘을 때마다 깎는 점수 */
const INK_PENALTY_WEIGHT = 50;
/** 잉크 효율의 분모 최솟값(픽셀). 막 그리기 시작했을 때 배율이 튀지 않게 한다 */
const INK_MIN_LENGTH = 40;
/** 브러쉬 최대 굵기 = 흰 선 평균 두께 × 이 값 */
const BRUSH_WIDTH_RATIO = 1.2;

export type Rect = { x: number; y: number; w: number; h: number };

export type GuideMasks = {
  width: number;
  height: number;
  white: Uint8Array;
  gray: Uint8Array;
  /** 흰 선에서 GRAY_TOLERANCE 이내 (흰 선 위를 지나간 획인지 볼 때 쓴다) */
  nearWhite: Uint8Array;
  whiteTotal: number;
  grayTotal: number;
  /** 흰 선 중심선(1픽셀 두께) 픽셀 위치와 각 픽셀이 차지하는 길이 */
  skeleton: Uint32Array;
  skeletonWeight: Float32Array;
  /** 흰 선 중심선 전체 길이(픽셀) */
  skeletonLength: number;
  /** 흰 선 평균 두께(픽셀) = 흰 선 넓이 / 중심선 길이 */
  lineWidth: number;
};

export type TraceScore = {
  score: number;
  /** 흰 선 픽셀 중 칠한 비율 (%) */
  whitePct: number;
  /** 회색 구역 픽셀 중 칠한 비율 (%) */
  grayPct: number;
  /** 감점 (회색 구역 침범 % × 민감도) */
  penalty: number;
  /** 잉크 효율 (흰 선 위 획 길이 / 칠한 중심선 길이). 1에 가까울수록 깔끔하다 */
  inkRatio: number;
  /** 덧칠 감점 */
  inkPenalty: number;
  whiteHits: number;
  grayHits: number;
  /** 밑그림의 전체 흰 선 픽셀 수 */
  whiteTotal: number;
};

export const emptyScore: TraceScore = {
  score: 0,
  whitePct: 0,
  grayPct: 0,
  penalty: 0,
  inkRatio: 0,
  inkPenalty: 0,
  whiteHits: 0,
  grayHits: 0,
  whiteTotal: 0,
};

/** 흰 선 두께에 맞춘 브러쉬 최대 굵기 (짝수, 2 이상) */
export const maxBrushSize = (masks: GuideMasks) => Math.max(2, Math.ceil((masks.lineWidth * BRUSH_WIDTH_RATIO) / 2) * 2);

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

/**
 * Zhang-Suen 세선화: mask를 가운데 1픽셀 두께의 중심선만 남을 때까지 깎는다.
 * 가장자리 1픽셀은 이웃을 볼 수 없으므로 중심선에서 뺀다.
 */
function thin(mask: Uint8Array, width: number, height: number) {
  const img = new Uint8Array(mask.length);
  let cand: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (mask[i]) {
        img[i] = 1;
        cand.push(i);
      }
    }
  }

  const w = width;
  let changed = true;
  while (changed) {
    changed = false;
    for (let step = 0; step < 2; step++) {
      const remove: number[] = [];
      for (const i of cand) {
        // 위부터 시계 방향: p2(N) p3(NE) p4(E) p5(SE) p6(S) p7(SW) p8(W) p9(NW)
        const p2 = img[i - w], p3 = img[i - w + 1], p4 = img[i + 1], p5 = img[i + w + 1];
        const p6 = img[i + w], p7 = img[i + w - 1], p8 = img[i - 1], p9 = img[i - w - 1];
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (b < 2 || b > 6) continue;
        // 한 바퀴 돌면서 0 → 1로 바뀌는 횟수가 1이어야 지워도 선이 끊기지 않는다.
        const ring = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
        let a = 0;
        for (let k = 0; k < 8; k++) if (!ring[k] && ring[k + 1]) a++;
        if (a !== 1) continue;
        if (step === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
        remove.push(i);
      }
      for (const i of remove) img[i] = 0;
      if (remove.length) {
        changed = true;
        cand = cand.filter((i) => img[i]);
      }
    }
  }
  return { img, pixels: cand };
}

/**
 * 중심선 픽셀마다 차지하는 길이. 이웃한 중심선 픽셀과의 연결 길이(가로·세로 1, 대각선 √2)를
 * 양쪽 픽셀이 반씩 나눠 가진다. 대각선은 가로·세로로 이미 이어져 있으면 세지 않는다.
 * 그냥 픽셀 수를 세면 대각선 선이 실제보다 √2배 짧게 잡히기 때문이다.
 */
function skeletonWeights(img: Uint8Array, pixels: number[], width: number) {
  const weights = new Float32Array(pixels.length);
  const half = Math.SQRT2 / 2;
  pixels.forEach((i, k) => {
    const n = img[i - width], s = img[i + width], e = img[i + 1], wst = img[i - 1];
    let len = (n + s + e + wst) * 0.5;
    if (img[i - width + 1] && !n && !e) len += half;
    if (img[i + width + 1] && !s && !e) len += half;
    if (img[i + width - 1] && !s && !wst) len += half;
    if (img[i - width - 1] && !n && !wst) len += half;
    // 혼자 떨어진 점도 길이 1로 친다.
    weights[k] = len || 1;
  });
  return weights;
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
      else rawGray[i] = 1;
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
  const { img: skeletonMask, pixels } = thin(white, width, height);
  const skeletonWeight = skeletonWeights(skeletonMask, pixels, width);
  let skeletonLength = 0;
  for (const v of skeletonWeight) skeletonLength += v;

  return {
    width,
    height,
    white,
    gray,
    nearWhite,
    whiteTotal,
    grayTotal,
    skeleton: Uint32Array.from(pixels),
    skeletonWeight,
    skeletonLength,
    lineWidth: whiteTotal / Math.max(1, skeletonLength),
  };
}

/**
 * strokes: 지금 캔버스에 보이는 획 (지우개 획 포함, 지우개 획은 길이에 넣지 않는다).
 * 획 길이는 흰 선 근처를 지나가고, 지금도 지워지지 않고 남아 있는 구간만 센다.
 * 회색 구역에 그은 부분은 침범 감점으로 따로 깎이므로 여기서는 빼고,
 * 지우개로 지운 실수는 덧칠로 치지 않는다.
 */
export function scoreCanvas(canvas: HTMLCanvasElement, masks: GuideMasks, strokes: Stroke[] = []): TraceScore {
  const { width, height, white, gray, nearWhite, skeleton, skeletonWeight } = masks;
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;
  const painted = (i: number) => data[i * 4 + 3] >= PAINT_ALPHA_MIN;

  let whiteHits = 0;
  let grayHits = 0;
  for (let i = 0; i < white.length; i++) {
    if (!painted(i)) continue;
    if (white[i]) whiteHits++;
    else if (gray[i]) grayHits++;
  }

  let coveredLength = 0;
  for (let k = 0; k < skeleton.length; k++) if (painted(skeleton[k])) coveredLength += skeletonWeight[k];

  let inkLength = 0;
  for (const s of strokes) {
    if (s.erase) continue;
    const pts = s.points;
    for (let j = 1; j < pts.length; j++) {
      const x = Math.floor((pts[j - 1][0] + pts[j][0]) / 2);
      const y = Math.floor((pts[j - 1][1] + pts[j][1]) / 2);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const i = y * width + x;
      if (nearWhite[i] && painted(i)) inkLength += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);
    }
  }

  const whitePct = (whiteHits / Math.max(1, masks.whiteTotal)) * 100;
  const grayPct = (grayHits / Math.max(1, masks.grayTotal)) * 100;
  const penalty = grayPct * GRAY_PENALTY_WEIGHT;
  const inkRatio = inkLength / Math.max(INK_MIN_LENGTH, coveredLength);
  const inkPenalty = Math.max(0, inkRatio - INK_FREE_RATIO) * INK_PENALTY_WEIGHT;
  const score = Math.round(Math.max(0, Math.min(100, whitePct - penalty - inkPenalty)));
  return { score, whitePct, grayPct, penalty, inkRatio, inkPenalty, whiteHits, grayHits, whiteTotal: masks.whiteTotal };
}
