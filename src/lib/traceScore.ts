// 따라 그리기 채점 (픽셀 단위).
// - buildGuideMasks: 밑그림에서 흰 선·회색 구역을 미리 구한다 (장면마다 한 번).
// - scoreCanvas: 사용자가 그린 캔버스와 획을 마스크와 비교해 점수를 낸다 (그리는 동안 계속).
//
// 밑그림에서 "흰 선 픽셀"과 "회색 구역 픽셀"(회색 선 + 회색 바탕, 즉 흰 선이 아닌 모든 곳)을
// 미리 구해 두고, 사용자가 칠한 픽셀과 비교한다.
//   흰 선 채움(%)     = 칠한 흰 선 픽셀 / 전체 흰 선 픽셀 × 100
//   회색 구역 침범(%) = 칠한 회색 구역 픽셀 / 전체 회색 구역 픽셀 × 100
//   침범 감점         = 회색 구역 침범 × GRAY_PENALTY_WEIGHT
//   겹침(%)           = 흰 선 근처에서 이미 칠한 곳을 다시 칠한 횟수 / 칠한 횟수 × 100
//   겹침 감점         = (겹침 − OVERLAP_FREE_PCT) × OVERLAP_PENALTY_WEIGHT  (0 이상)
//   점수              = 흰 선 채움 − 침범 감점 − 겹침 감점  (0~100)
//
// 겹침은 덧칠과 털선을 한 번에 잡는다. 선 하나를 한 번에 쭉 그으면 거의 겹치지 않고,
//  - 같은 선을 다시 긋거나(덧칠) 짧은 획을 이어 붙이거나 겹쳐 긋는 털선은 다른 획과 겹치고,
//  - 펜을 떼지 않고 왔다 갔다 문지르면 같은 획의 앞부분과 겹친다.
// 흰 선을 가로지르기만 한 획은 겹치지 않는다. 회색 구역(선 밖)은 침범 감점이 맡으므로 겹침에서 뺀다.

import { taper, type Stroke } from "../components/TracingCanvas";

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
/** 칠한 픽셀로 보이는 브러쉬 가장자리 (안티앨리어싱으로 반지름보다 조금 더 칠해진다) */
const BRUSH_EDGE = 0.5;
/** 겹침이 이 %까지는 감점하지 않는다 (획을 이어 그린 곳, 선이 만나는 곳 등) */
const OVERLAP_FREE_PCT = 12;
/** 겹침이 허용치보다 1%p 많을 때마다 깎는 점수 */
const OVERLAP_PENALTY_WEIGHT = 0.6;
/**
 * 같은 획 안에서 "되돌아왔다"고 보는 거리 = 브러쉬 굵기 × 이 값.
 * 붓이 지나가는 동안 한 픽셀은 1픽셀 간격으로 계속 칠해지므로, 그 픽셀을 떠난 뒤 이만큼 더 가서 다시 칠할 때만 겹침으로 센다.
 * 너무 크면 짧게 왔다 갔다 문지르는 것을 놓친다 (굵기 × 2로 하면 6픽셀 폭 지그재그가 19%로만 잡혔다).
 */
const SELF_RETURN_BRUSH = 0.5;
/** 겹침의 분모 최솟값(칠한 횟수). 막 그리기 시작했을 때 값이 튀지 않게 한다 (굵기 6으로 약 300픽셀) */
const OVERLAP_MIN_PASSES = 2000;

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
  /** 화면에 보이는 점수 (정수) */
  score: number;
  /** 반올림 전 점수, 소수 둘째 자리까지 (기록 저장용). score는 이것을 반올림한 값이다 */
  exactScore: number;
  /** 흰 선 픽셀 중 칠한 비율 (%) */
  whitePct: number;
  /** 회색 구역 픽셀 중 칠한 비율 (%) */
  grayPct: number;
  /** 감점 (회색 구역 침범 % × 민감도) */
  penalty: number;
  /** 흰 선 근처에서 다시 칠한 비율 (%). 0에 가까울수록 한 번에 깔끔하게 그었다 */
  overlapPct: number;
  /** 겹침 감점 (덧칠 + 털선) */
  overlapPenalty: number;
  whiteHits: number;
  grayHits: number;
  /** 밑그림의 전체 흰 선 픽셀 수 */
  whiteTotal: number;
};

export const emptyScore: TraceScore = {
  score: 0,
  exactScore: 0,
  whitePct: 0,
  grayPct: 0,
  penalty: 0,
  overlapPct: 0,
  overlapPenalty: 0,
  whiteHits: 0,
  grayHits: 0,
  whiteTotal: 0,
};

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
  return { width, height, white, gray, whiteTotal, grayTotal };
}

/** 겹침 계산에 쓰는 픽셀별 기록. 밑그림마다 한 벌 만들어 두고 채점할 때마다 다시 쓴다. */
type OverlapBuffers = {
  /** 이 픽셀을 마지막으로 칠한 획 번호 (−1: 아직 안 칠함) */
  lastStroke: Int32Array;
  /** 그 획이 이 픽셀을 마지막으로 칠한 위치 (획 시작부터의 길이) */
  lastArc: Float32Array;
  /** 이 픽셀을 칠한 횟수 / 그중 이미 칠한 곳을 다시 칠한 횟수 */
  passes: Uint8Array;
  overlaps: Uint8Array;
  /** 이번 채점에서 건드린 픽셀 (끝나고 되돌릴 목록에 한 번만 넣으려고) */
  seen: Uint8Array;
};
const overlapBuffers = new WeakMap<GuideMasks, OverlapBuffers>();

function getOverlapBuffers(masks: GuideMasks) {
  let b = overlapBuffers.get(masks);
  if (!b) {
    const n = masks.width * masks.height;
    b = {
      lastStroke: new Int32Array(n).fill(-1),
      lastArc: new Float32Array(n),
      passes: new Uint8Array(n),
      overlaps: new Uint8Array(n),
      seen: new Uint8Array(n),
    };
    overlapBuffers.set(masks, b);
  }
  return b;
}

/**
 * 획들을 순서대로 붓 모양으로 1픽셀 간격으로 찍으면서 겹침을 센다.
 * 붓 지름은 화면에 그려지는 것과 같다 (손떨림 보정된 점, 선 끝 얇게로 가늘어진 굵기). 보이는 대로 판정한다.
 * 선 끝 얇게를 쓰면 획 끝이 뾰족해져 짧게 끊어 그린 털선이 거의 안 겹치므로
 * (12픽셀 털선 이어 붙이기: 끔 29.7%, 2단계 2.0%) 채점하는 따라 그리기에서는 선 끝 얇게를 끈다 (StoryPage).
 * 한 픽셀에 대해
 *  - 다른 획이 이미 칠해 둔 곳을 새 획이 칠하면 겹침 1번
 *  - 같은 획이 그 픽셀을 떠났다가 SELF_RETURN_BRUSH × 굵기 이상 더 가서 다시 칠하면 겹침 1번 (왔다 갔다 문지르기)
 * 지우개 획은 그 픽셀의 기록을 지운다. 지운 뒤 다시 그린 것은 겹침이 아니다.
 * 회색 구역은 침범 감점이 맡으므로 세지 않는다.
 */
function countOverlap(masks: GuideMasks, strokes: Stroke[]) {
  const { width, height, gray } = masks;
  const { lastStroke, lastArc, passes, overlaps, seen } = getOverlapBuffers(masks);
  const touched: number[] = [];

  strokes.forEach((s, k) => {
    const pts = s.points;
    const returnGap = s.size * SELF_RETURN_BRUSH;
    let total = 0;
    for (let j = 1; j < pts.length; j++) total += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]);

    const stamp = (cx: number, cy: number, arc: number) => {
      const r = (s.size * taper(arc, total, s.fade)) / 2 + BRUSH_EDGE;
      const r2 = r * r;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(height - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(width - 1, Math.ceil(cx + r)); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          if (dx * dx + dy * dy > r2) continue;
          const i = y * width + x;
          if (gray[i]) continue;
          if (!seen[i]) {
            seen[i] = 1;
            touched.push(i);
          }
          if (s.erase) {
            passes[i] = 0;
            overlaps[i] = 0;
            lastStroke[i] = -1;
            continue;
          }
          if (lastStroke[i] !== k) {
            // 이 획이 처음 닿은 픽셀
            if (passes[i] && overlaps[i] < 255) overlaps[i]++;
            if (passes[i] < 255) passes[i]++;
            lastStroke[i] = k;
          } else if (arc - lastArc[i] > returnGap) {
            // 같은 획이 떠났다가 되돌아옴
            if (overlaps[i] < 255) overlaps[i]++;
            if (passes[i] < 255) passes[i]++;
          }
          lastArc[i] = arc;
        }
      }
    };

    stamp(pts[0][0], pts[0][1], 0);
    let arc = 0;
    for (let j = 1; j < pts.length; j++) {
      const [x0, y0] = pts[j - 1];
      const dx = pts[j][0] - x0;
      const dy = pts[j][1] - y0;
      const len = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(len));
      for (let q = 1; q <= steps; q++) stamp(x0 + (dx * q) / steps, y0 + (dy * q) / steps, arc + (len * q) / steps);
      arc += len;
    }
  });

  let passTotal = 0;
  let overlapTotal = 0;
  for (const i of touched) {
    passTotal += passes[i];
    overlapTotal += overlaps[i];
    // 다음 채점을 위해 되돌려 둔다.
    passes[i] = 0;
    overlaps[i] = 0;
    lastStroke[i] = -1;
    seen[i] = 0;
  }
  return (overlapTotal / Math.max(OVERLAP_MIN_PASSES, passTotal)) * 100;
}

/** strokes: 지금 캔버스에 보이는 획 (그린 순서대로, 지우개 획 포함) */
export function scoreCanvas(canvas: HTMLCanvasElement, masks: GuideMasks, strokes: Stroke[] = []): TraceScore {
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
  const penalty = grayPct * GRAY_PENALTY_WEIGHT;
  const overlapPct = countOverlap(masks, strokes);
  const overlapPenalty = Math.max(0, overlapPct - OVERLAP_FREE_PCT) * OVERLAP_PENALTY_WEIGHT;
  const exactScore = Math.round(Math.max(0, Math.min(100, whitePct - penalty - overlapPenalty)) * 100) / 100;
  return { score: Math.round(exactScore), exactScore, whitePct, grayPct, penalty, overlapPct, overlapPenalty, whiteHits, grayHits, whiteTotal: masks.whiteTotal };
}
