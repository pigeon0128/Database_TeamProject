import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export type Point = [x: number, y: number];

export type Stroke = {
  type: "stroke";
  color: string;
  size: number;
  erase: boolean;
  points: Point[];
};

export type DrawAction = Stroke | { type: "clear" };

export type TracingCanvasHandle = {
  /** 흰 배경 위에 사용자가 그린 선만 합쳐서 PNG data URL로 반환 */
  exportImage: (withGuide: boolean) => string | null;
};

type Props = {
  /** 준비 중이면 null */
  guideSrc: string | null;
  width: number;
  height: number;
  guideOpacity: number;
  showGuide: boolean;
  color: string;
  size: number;
  erase: boolean;
  actions: DrawAction[];
  onStrokeEnd: (stroke: Stroke) => void;
  /** 그리는 중이거나 다시 그려질 때마다 호출 (채점용) */
  onChange?: (canvas: HTMLCanvasElement) => void;
};

// 채점할 때 픽셀을 자주 읽으므로 willReadFrequently로 연다.
const getCtx = (canvas: HTMLCanvasElement) => canvas.getContext("2d", { willReadFrequently: true })!;

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function applyStyle(ctx: CanvasRenderingContext2D, s: Pick<Stroke, "color" | "size" | "erase">) {
  ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawDot(ctx: CanvasRenderingContext2D, p: Point, size: number) {
  ctx.beginPath();
  ctx.arc(p[0], p[1], size / 2, 0, Math.PI * 2);
  ctx.fill();
}

// 점 i-1 → i 구간을 중간점 사이의 2차 곡선으로 그려 선을 부드럽게 만든다.
function drawSegment(ctx: CanvasRenderingContext2D, pts: Point[], i: number) {
  const from = i === 1 ? pts[0] : mid(pts[i - 2], pts[i - 1]);
  const to = mid(pts[i - 1], pts[i]);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.quadraticCurveTo(pts[i - 1][0], pts[i - 1][1], to[0], to[1]);
  ctx.stroke();
}

function drawTail(ctx: CanvasRenderingContext2D, pts: Point[]) {
  const n = pts.length;
  if (n < 2) return;
  const from = mid(pts[n - 2], pts[n - 1]);
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  ctx.stroke();
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  applyStyle(ctx, s);
  drawDot(ctx, s.points[0], s.size);
  for (let i = 1; i < s.points.length; i++) drawSegment(ctx, s.points, i);
  drawTail(ctx, s.points);
}

/** 마지막 "전체 지우기" 이후의 획만 다시 그린다. */
export function visibleStrokes(actions: DrawAction[]): Stroke[] {
  const lastClear = actions.map((a) => a.type).lastIndexOf("clear");
  return actions.slice(lastClear + 1) as Stroke[];
}

const TracingCanvas = forwardRef<TracingCanvasHandle, Props>(function TracingCanvas(
  { guideSrc, width, height, guideOpacity, showGuide, color, size, erase, actions, onStrokeEnd, onChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLImageElement>(null);
  const current = useRef<Stroke | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = getCtx(canvas);
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, width, height);
    for (const s of visibleStrokes(actions)) drawStroke(ctx, s);
    onChange?.(canvas);
  }, [actions, width, height, onChange]);

  useEffect(redraw, [redraw]);

  useImperativeHandle(ref, () => ({
    exportImage(withGuide) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      if (withGuide && guideRef.current) {
        ctx.globalAlpha = guideOpacity;
        ctx.drawImage(guideRef.current, 0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(canvas, 0, 0);
      return out.toDataURL("image/png");
    },
  }));

  const toCanvasPoint = (e: PointerEvent | React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) * width) / rect.width, ((e.clientY - rect.top) * height) / rect.height];
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = getCtx(e.currentTarget);
    const stroke: Stroke = { type: "stroke", color, size, erase, points: [toCanvasPoint(e)] };
    current.current = stroke;
    applyStyle(ctx, stroke);
    drawDot(ctx, stroke.points[0], size);
    onChange?.(e.currentTarget);
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = current.current;
    if (!stroke) return;
    const ctx = getCtx(e.currentTarget);
    applyStyle(ctx, stroke);
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      stroke.points.push(toCanvasPoint(ev));
      drawSegment(ctx, stroke.points, stroke.points.length - 1);
    }
    onChange?.(e.currentTarget);
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const stroke = current.current;
    if (!stroke) return;
    current.current = null;
    drawTail(getCtx(e.currentTarget), stroke.points);
    onStrokeEnd(stroke);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-card" style={{ aspectRatio: `${width} / ${height}` }}>
      {guideSrc && (
        <img
          ref={guideRef}
          src={guideSrc}
          alt="따라 그릴 밑그림"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full select-none transition-opacity"
          style={{ opacity: showGuide ? guideOpacity : 0 }}
        />
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: "crosshair" }}
      />
    </div>
  );
});

export default TracingCanvas;
