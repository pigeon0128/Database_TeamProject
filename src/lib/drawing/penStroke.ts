// 펜 획을 캔버스에 그리는 함수들. 그림판(TracingCanvas)과 장면 고르기 미리보기(sceneAssets)가 같이 쓴다.
import { taper, type Point, type Stroke } from "./strokes";

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

export function applyStyle(ctx: CanvasRenderingContext2D, s: Pick<Stroke, "color" | "size" | "erase">) {
  ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

export function drawDot(ctx: CanvasRenderingContext2D, p: Point, size: number) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], size / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** 각 점까지의 누적 길이 */
function lengths(pts: Point[]) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return d;
}

// 점 i-1 → i 구간을 중간점 사이의 2차 곡선으로 그려 선을 부드럽게 만든다.
export function drawSegment(ctx: CanvasRenderingContext2D, pts: Point[], i: number, width: number) {
  const from = i === 1 ? pts[0] : mid(pts[i - 2], pts[i - 1]);
  const to = mid(pts[i - 1], pts[i]);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], to[0], to[1]);
  ctx.stroke();
}

function drawTail(ctx: CanvasRenderingContext2D, pts: Point[], width: number) {
  const n = pts.length;
  if (n < 2) return;
  const from = mid(pts[n - 2], pts[n - 1]);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  ctx.stroke();
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  applyStyle(ctx, s);
  const pts = s.points;
  // 한 번 콕 찍은 점은 페이드 없이 원래 굵기로
  if (pts.length === 1) return drawDot(ctx, pts[0], s.size);
  const d = lengths(pts);
  const total = d[d.length - 1];
  const w = (at: number) => s.size * taper(at, total, s.fade);
  drawDot(ctx, pts[0], w(0));
  for (let i = 1; i < pts.length; i++) drawSegment(ctx, pts, i, w(d[i - 1]));
  drawTail(ctx, pts, w((d[pts.length - 2] + total) / 2));
}
