// 색칠하기 그림판. 아래부터 밑그림 → 색 → 선 그림 순서로 겹쳐 보여 준다.
// 붓을 대는 순간 그 자리의 구역(lib/drawing/regions.ts)을 정하고, 붓을 뗄 때까지는 그 구역 안에만 칠한다.
// 브러쉬는 special-brushes.html 처럼 둥근 붓 자국 안에 색(일반 브러쉬) 또는 무늬(특수 브러쉬)가 드러나는 방식이다.
// - committed: 다 그은 획을 모은 캔버스. 되돌리기 등으로 획 목록이 바뀌면 처음부터 다시 그린다
// - 그리는 중에는 그 구역의 사각형만 다시 그려서 큰 그림에서도 빠르다
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { patternFor } from "../lib/drawing/brushPatterns";
import type { Regions } from "../lib/drawing/regions";
import type { Point } from "../lib/drawing/strokes";

/** 브러쉬 설정 */
export type PaintBrush = {
  /** 특수 브러쉬 무늬 이름 (DB special_brushes.slug). null 이면 color 단색 */
  pattern: string | null;
  /** 단색, 또는 무늬에 섞을 색 */
  color: string;
  size: number;
  erase: boolean;
};

/** 색칠 획 하나 */
export type PaintStroke = PaintBrush & {
  type: "paint";
  /** 칠하는 구역 번호 (붓을 댄 자리) */
  region: number;
  points: Point[];
};

/** 그림판에 쌓이는 동작: 획 하나, 또는 "전체 지우기" */
export type PaintAction = PaintStroke | { type: "clear" };

/** 마지막 "전체 지우기" 이후의 획 */
export function visiblePaint(actions: PaintAction[]): PaintStroke[] {
  const lastClear = actions.map((a) => a.type).lastIndexOf("clear");
  return actions.slice(lastClear + 1) as PaintStroke[];
}

export type ColoringCanvasHandle = {
  /** 밑그림·색·선을 합친 PNG data URL */
  exportImage: () => string | null;
};

type Props = {
  guide: HTMLCanvasElement;
  regions: Regions;
  /** 새로 긋는 획에 쓸 브러쉬 */
  brush: PaintBrush;
  actions: PaintAction[];
  onStrokeEnd: (stroke: PaintStroke) => void;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** 구역 사각형 크기 캔버스(marks)에 붓 자국을 그린다. from 번째 점부터 (그리는 중에는 새 구간만) */
function drawMarks(marks: HTMLCanvasElement, s: PaintStroke, ox: number, oy: number, from: number) {
  const ctx = marks.getContext("2d")!;
  // 캔버스 좌표로 그린다. 무늬도 그림판 원점에 맞춰 깔리므로 구역·획이 달라도 무늬가 이어진다.
  ctx.setTransform(1, 0, 0, 1, -ox, -oy);
  const paint = s.erase ? "#000" : s.pattern ? patternFor(ctx, s.pattern, s.color) : s.color;
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

/** 붓 자국(marks)을 구역 마스크로 잘라(clip 캔버스 사용) target 에 칠한다. 지우개면 지운다 */
function applyClipped(target: CanvasRenderingContext2D, marks: HTMLCanvasElement, clip: HTMLCanvasElement, s: PaintStroke, regions: Regions) {
  const r = regions.region(s.region);
  const c = clip.getContext("2d")!;
  c.globalCompositeOperation = "copy";
  c.drawImage(marks, 0, 0);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(r.mask, 0, 0);
  c.globalCompositeOperation = "source-over";
  target.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  target.drawImage(clip, r.x, r.y);
  target.globalCompositeOperation = "source-over";
}

type Live = { stroke: PaintStroke; marks: HTMLCanvasElement; clip: HTMLCanvasElement; drawn: number };

const ColoringCanvas = forwardRef<ColoringCanvasHandle, Props>(function ColoringCanvas({ guide, regions, brush, actions, onStrokeEnd }, ref) {
  const { width, height } = regions;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const linesRef = useRef<HTMLCanvasElement>(null);
  const committed = useRef<HTMLCanvasElement | null>(null);
  committed.current ??= makeCanvas(width, height);
  const current = useRef<Live | null>(null);
  const frame = useRef(0);

  const display = () => canvasRef.current!.getContext("2d")!;

  // 밑그림과 선 그림은 한 번만 그린다
  useEffect(() => {
    guideRef.current!.getContext("2d")!.drawImage(guide, 0, 0);
    linesRef.current!.getContext("2d")!.drawImage(regions.lines, 0, 0);
  }, [guide, regions]);

  // 획 목록이 바뀌면 다 그은 획을 처음부터 다시 그린다
  useEffect(() => {
    const done = committed.current!;
    const ctx = done.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    for (const s of visiblePaint(actions)) {
      const r = regions.region(s.region);
      const marks = makeCanvas(r.w, r.h);
      drawMarks(marks, s, r.x, r.y, 0);
      applyClipped(ctx, marks, makeCanvas(r.w, r.h), s, regions);
    }
    const d = display();
    d.clearRect(0, 0, width, height);
    d.drawImage(done, 0, 0);
  }, [actions, regions, width, height]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  useImperativeHandle(ref, () => ({
    exportImage() {
      const out = makeCanvas(width, height);
      const ctx = out.getContext("2d")!;
      ctx.drawImage(guide, 0, 0);
      ctx.drawImage(committed.current!, 0, 0);
      ctx.drawImage(regions.lines, 0, 0);
      return out.toDataURL("image/png");
    },
  }));

  /** 그리는 중인 획: 그 구역 사각형만 (다 그은 획 + 이번 획)으로 다시 그린다 */
  const paintLive = () => {
    frame.current = 0;
    const live = current.current;
    if (!live) return;
    const { stroke, marks, clip } = live;
    const r = regions.region(stroke.region);
    drawMarks(marks, stroke, r.x, r.y, live.drawn);
    live.drawn = stroke.points.length;
    const d = display();
    d.clearRect(r.x, r.y, r.w, r.h);
    d.drawImage(committed.current!, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    applyClipped(d, marks, clip, stroke, regions);
  };
  const schedule = () => {
    if (!frame.current) frame.current = requestAnimationFrame(paintLive);
  };

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) * width) / rect.width, ((e.clientY - rect.top) * height) / rect.height];
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || current.current) return;
    const p = toPoint(e);
    const region = regions.at(p[0], p[1]);
    if (!region) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 끝난 포인터면 캡처 없이 진행
    }
    const r = regions.region(region);
    current.current = { stroke: { type: "paint", ...brush, region, points: [p] }, marks: makeCanvas(r.w, r.h), clip: makeCanvas(r.w, r.h), drawn: 0 };
    schedule();
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const live = current.current;
    if (!live) return;
    const pts = live.stroke.points;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = toPoint(ev);
      const last = pts[pts.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1) pts.push(p);
    }
    schedule();
  };

  const handleUp = () => {
    const live = current.current;
    if (!live) return;
    cancelAnimationFrame(frame.current);
    paintLive();
    current.current = null;
    // 목록에 넣으면 위의 효과가 다 그은 획을 다시 그린다
    onStrokeEnd(live.stroke);
  };

  const layer = "absolute inset-0 h-full w-full";
  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-card" style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas ref={guideRef} width={width} height={height} className={`${layer} pointer-events-none`} />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onContextMenu={(e) => e.preventDefault()}
        className={`${layer} touch-none`}
        style={{ cursor: "crosshair" }}
      />
      <canvas ref={linesRef} width={width} height={height} className={`${layer} pointer-events-none`} />
    </div>
  );
});

export default ColoringCanvas;
