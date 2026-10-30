// 색칠 층 그리기. 그림판(TracingCanvas)이 밑그림과 펜 선 사이의 캔버스에 색칠 획을 그릴 때 쓴다.
// 붓 자국(둥근 브러쉬, special-brushes.html 방식) 안에 색이나 무늬가 드러나고, 그 자국을 붓을 댄 구역의 마스크로 잘라 칠한다.
// 구역의 사각형 크기 캔버스에서만 계산해서 큰 그림에서도 빠르다.
import { patternFor } from "./brushPatterns";
import type { Region, Regions } from "./regions";
import type { PaintStroke, Point, Stroke } from "./strokes";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** 구역 사각형 크기 캔버스(marks)에 붓 자국을 그린다. from 번째 점부터 (그리는 중에는 새 구간만) */
export function drawMarks(marks: HTMLCanvasElement, s: PaintStroke, r: Region, from: number) {
  const ctx = marks.getContext("2d")!;
  // 캔버스 좌표로 그린다. 무늬도 그림판 원점에 맞춰 깔리므로 구역·획이 달라도 무늬가 이어진다.
  ctx.setTransform(1, 0, 0, 1, -r.x, -r.y);
  const paint = s.pattern ? patternFor(ctx, s.pattern, s.color) : s.color;
  ctx.strokeStyle = paint;
  ctx.fillStyle = paint;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pts = s.points;
  if (from === 0) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], s.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  if (pts.length > 1 && from < pts.length) {
    const first = Math.max(0, from - 1);
    ctx.beginPath();
    ctx.moveTo(pts[first][0], pts[first][1]);
    for (let i = first + 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** 붓 자국(marks)을 구역 마스크로 잘라(clip 캔버스 사용) target 에 칠한다. erase 면 칠하는 대신 그 자리의 색을 지운다 */
export function applyClipped(target: CanvasRenderingContext2D, marks: HTMLCanvasElement, clip: HTMLCanvasElement, r: Region, erase = false) {
  const c = clip.getContext("2d")!;
  c.globalCompositeOperation = "copy";
  c.drawImage(marks, 0, 0);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(r.mask, 0, 0);
  c.globalCompositeOperation = "source-over";
  const op = target.globalCompositeOperation;
  if (erase) target.globalCompositeOperation = "destination-out";
  target.drawImage(clip, r.x, r.y);
  target.globalCompositeOperation = op;
}

/** 색칠 획이 칠할 구역 (첫 점 자리). 근처에 구역이 없으면 null */
export function regionOf(regions: Regions, points: Point[]) {
  const id = regions.at(points[0][0], points[0][1]);
  return id ? regions.region(id) : null;
}

/** 지우개 획이 색을 지울 때 쓰는 붓 자국 모양 (같은 points 배열을 써서 그리는 중에도 함께 늘어난다) */
export const eraseMarks = (s: Stroke): PaintStroke => ({ type: "paint", pattern: null, color: "#000", size: s.size, points: s.points });

/** 색칠 층 전체를 그린 순서대로 다시 그린다 (색칠 획은 칠하고, 펜 지우개 획은 처음 댄 구역 안의 색만 지운다) */
export function renderPaint(ctx: CanvasRenderingContext2D, actions: (Stroke | PaintStroke)[], regions: Regions) {
  ctx.clearRect(0, 0, regions.width, regions.height);
  for (const a of actions) {
    if (a.type === "stroke" && !a.erase) continue;
    const r = regionOf(regions, a.points);
    if (!r) continue;
    const marks = makeCanvas(r.w, r.h);
    drawMarks(marks, a.type === "stroke" ? eraseMarks(a) : a, r, 0);
    applyClipped(ctx, marks, makeCanvas(r.w, r.h), r, a.type === "stroke");
  }
}
