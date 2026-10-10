// 그림을 그리는 캔버스 컴포넌트 (스토리 장면, 캐릭터 그리기 공용).
// - 밑그림 이미지를 아래에 깔고, 그 위 투명 캔버스에 사용자의 획을 그린다.
// - 획은 점 배열(Stroke)로 저장해 두고, 되돌리기 등으로 목록이 바뀌면 처음부터 다시 그린다.
// - 손떨림 보정, 시작·끝 흐리기(Fade), 확대/이동(Ctrl+휠, 두 손가락), 이미지 내보내기를 담당한다.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export type Point = [x: number, y: number];

export type Stroke = {
  type: "stroke";
  color: string;
  size: number;
  erase: boolean;
  /** 시작·끝이 가늘어지는 길이(캔버스 픽셀). 0이면 끔 */
  fade: number;
  points: Point[];
};

export type DrawAction = Stroke | { type: "clear" };

export type TracingCanvasHandle = {
  /** 흰 배경 위에 사용자가 그린 선만 합쳐서 PNG data URL로 반환 */
  exportImage: (withGuide: boolean) => string | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
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
  /** 손떨림 보정 세기 (0~1) */
  smoothing: number;
  /** 시작·끝 흐리기 길이(캔버스 픽셀) */
  fade: number;
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

/** 페이드 끝부분의 최소 굵기 비율 */
const FADE_MIN = 0.12;

/**
 * 획의 시작에서 d만큼 떨어진 곳의 굵기 비율.
 * 시작과 끝에서 fade 길이 안쪽은 점점 가늘어진다. 그리는 중에는 끝을 모르므로 total = Infinity.
 */
function taper(d: number, total: number, fade: number) {
  if (fade <= 0) return 1;
  const t = Math.min(1, Math.max(0, Math.min(d, total - d) / fade));
  return FADE_MIN + (1 - FADE_MIN) * t;
}

/** 각 점까지의 누적 길이 */
function lengths(pts: Point[]) {
  const d = [0];
  for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return d;
}

// 점 i-1 → i 구간을 중간점 사이의 2차 곡선으로 그려 선을 부드럽게 만든다.
function drawSegment(ctx: CanvasRenderingContext2D, pts: Point[], i: number, width: number) {
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

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
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

/** 마지막 "전체 지우기" 이후의 획만 다시 그린다. */
export function visibleStrokes(actions: DrawAction[]): Stroke[] {
  const lastClear = actions.map((a) => a.type).lastIndexOf("clear");
  return actions.slice(lastClear + 1) as Stroke[];
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;

type View = { z: number; tx: number; ty: number };
type Mode = "none" | "draw" | "pan" | "pinch" | "blocked";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const TracingCanvas = forwardRef<TracingCanvasHandle, Props>(function TracingCanvas(
  { guideSrc, width, height, guideOpacity, showGuide, color, size, erase, smoothing, fade, actions, onStrokeEnd, onChange },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLImageElement>(null);
  const current = useRef<Stroke | null>(null);
  /** 그리는 중인 획의 누적 길이 */
  const dists = useRef<number[]>([0]);
  /** 손떨림 보정이 적용된 펜 위치와 실제 마지막 입력 위치 */
  const smoothed = useRef<Point>([0, 0]);
  const rawLast = useRef<Point>([0, 0]);

  // 확대/이동 상태: 캔버스를 z배로 키우고 (tx, ty)만큼 옮겨서 보여 준다. 페이지 레이아웃은 그대로다.
  const [view, setView] = useState<View>({ z: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [panKeyHeld, setPanKeyHeld] = useState(false);
  const [panning, setPanning] = useState(false);

  const mode = useRef<Mode>("none");
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ view, x: 0, y: 0, dist: 1 });

  const clampView = useCallback((v: View): View => {
    const el = viewportRef.current;
    const vw = el?.clientWidth ?? 0;
    const vh = el?.clientHeight ?? 0;
    const z = clamp(v.z, MIN_ZOOM, MAX_ZOOM);
    return { z, tx: clamp(v.tx, vw - vw * z, 0), ty: clamp(v.ty, vh - vh * z, 0) };
  }, []);

  /** 뷰포트 안의 점 (px, py)를 기준으로 확대/축소. 점을 생략하면 가운데 기준 */
  const zoomAt = useCallback(
    (factor: number, px?: number, py?: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const x = px ?? el.clientWidth / 2;
      const y = py ?? el.clientHeight / 2;
      setView((v) => {
        const z = clamp(v.z * factor, MIN_ZOOM, MAX_ZOOM);
        const k = z / v.z;
        return clampView({ z, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k });
      });
    },
    [clampView],
  );

  const resetZoom = useCallback(() => setView({ z: 1, tx: 0, ty: 0 }), []);

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
    zoomIn: () => zoomAt(ZOOM_STEP),
    zoomOut: () => zoomAt(1 / ZOOM_STEP),
    resetZoom,
  }));

  // Ctrl+휠(트랙패드 핀치 포함): 브라우저 확대 대신 캔버스를 커서 위치 기준으로 확대.
  // 확대된 상태의 일반 휠: 캔버스 안에서 이동. 캔버스 밖의 Ctrl+휠은 브라우저 확대만 막는다.
  useEffect(() => {
    const el = viewportRef.current!;
    const onViewportWheel = (e: WheelEvent) => {
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
      } else if (viewRef.current.z > 1) {
        e.preventDefault();
        setView((v) => clampView({ ...v, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY }));
      }
    };
    const onWindowWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && !el.contains(e.target as Node)) e.preventDefault();
    };
    el.addEventListener("wheel", onViewportWheel, { passive: false });
    window.addEventListener("wheel", onWindowWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onViewportWheel);
      window.removeEventListener("wheel", onWindowWheel);
    };
  }, [zoomAt, clampView]);

  // Ctrl(맥은 Cmd)을 누른 채 드래그하면 화면 이동. 누르고 있는 동안 커서를 손 모양으로 바꾼다.
  useEffect(() => {
    const isPanKey = (e: KeyboardEvent) => e.key === "Control" || e.key === "Meta";
    const down = (e: KeyboardEvent) => {
      if (isPanKey(e)) setPanKeyHeld(true);
    };
    const up = (e: KeyboardEvent) => {
      if (isPanKey(e)) setPanKeyHeld(false);
    };
    const blur = () => setPanKeyHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  // 창 크기가 바뀌면 이동 범위를 다시 맞춘다.
  useEffect(() => {
    const ro = new ResizeObserver(() => setView((v) => clampView(v)));
    ro.observe(viewportRef.current!);
    return () => ro.disconnect();
  }, [clampView]);

  const toCanvasPoint = (e: PointerEvent | React.PointerEvent): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) * width) / rect.width, ((e.clientY - rect.top) * height) / rect.height];
  };

  const pinchInfo = () => {
    const [a, b] = [...pointers.current.values()];
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top, dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 이미 끝난 포인터면 캡처 없이 진행
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // 두 손가락: 그리던 선은 취소하고 확대/이동
    if (pointers.current.size === 2) {
      if (current.current) {
        current.current = null;
        redraw();
      }
      mode.current = "pinch";
      gesture.current = { view: viewRef.current, ...pinchInfo() };
      return;
    }
    if (pointers.current.size > 2 || mode.current !== "none") return;

    if (e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      mode.current = "pan";
      setPanning(true);
      gesture.current = { view: viewRef.current, x: e.clientX, y: e.clientY, dist: 1 };
      return;
    }
    if (e.button !== 0) return;

    mode.current = "draw";
    const ctx = getCtx(e.currentTarget);
    const start = toCanvasPoint(e);
    const stroke: Stroke = { type: "stroke", color, size, erase, fade, points: [start] };
    current.current = stroke;
    dists.current = [0];
    smoothed.current = start;
    rawLast.current = start;
    applyStyle(ctx, stroke);
    drawDot(ctx, start, size * taper(0, Infinity, fade));
    onChange?.(e.currentTarget);
  };

  /** 보정된 점 p를 획에 붙이고 그 구간을 바로 그린다. 너무 가까운 점은 건너뛴다. */
  const addPoint = (ctx: CanvasRenderingContext2D, stroke: Stroke, p: Point) => {
    smoothed.current = p;
    const pts = stroke.points;
    const last = pts[pts.length - 1];
    const step = Math.hypot(p[0] - last[0], p[1] - last[1]);
    if (step < 0.5) return;
    pts.push(p);
    dists.current.push(dists.current[dists.current.length - 1] + step);
    const i = pts.length - 1;
    drawSegment(ctx, pts, i, stroke.size * taper(dists.current[i - 1], Infinity, stroke.fade));
  };

  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (mode.current === "pinch" && pointers.current.size === 2) {
      const g = gesture.current;
      const now = pinchInfo();
      const z = clamp((g.view.z * now.dist) / g.dist, MIN_ZOOM, MAX_ZOOM);
      // 처음 두 손가락 사이에 있던 그림 위치가 지금 두 손가락 사이에 오도록
      const cx = (g.x - g.view.tx) / g.view.z;
      const cy = (g.y - g.view.ty) / g.view.z;
      setView(clampView({ z, tx: now.x - cx * z, ty: now.y - cy * z }));
      return;
    }
    if (mode.current === "pan") {
      const g = gesture.current;
      setView(clampView({ ...g.view, tx: g.view.tx + e.clientX - g.x, ty: g.view.ty + e.clientY - g.y }));
      return;
    }

    const stroke = current.current;
    if (mode.current !== "draw" || !stroke) return;
    const ctx = getCtx(e.currentTarget);
    applyStyle(ctx, stroke);
    // 손떨림 보정: 펜이 실제 커서를 천천히 따라오게 해서(지수 이동 평균) 흔들림을 걸러낸다.
    const follow = 1 - smoothing * 0.9;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const raw = toCanvasPoint(ev);
      rawLast.current = raw;
      const s = smoothed.current;
      addPoint(ctx, stroke, [s[0] + (raw[0] - s[0]) * follow, s[1] + (raw[1] - s[1]) * follow]);
    }
    onChange?.(e.currentTarget);
  };

  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    const stroke = current.current;
    if (mode.current === "draw" && stroke) {
      current.current = null;
      // 보정 때문에 뒤처진 펜을 손을 뗀 위치까지 마저 끌어온다.
      const ctx = getCtx(e.currentTarget);
      const raw = rawLast.current;
      for (let n = 0; n < 30; n++) {
        const s = smoothed.current;
        if (Math.hypot(raw[0] - s[0], raw[1] - s[1]) < 1) break;
        addPoint(ctx, stroke, [s[0] + (raw[0] - s[0]) * 0.5, s[1] + (raw[1] - s[1]) * 0.5]);
      }
      // 끝부분 페이드까지 반영된 모양은 onStrokeEnd → 다시 그리기에서 그려진다.
      onStrokeEnd(stroke);
    }
    if (mode.current === "pan") setPanning(false);
    // 핀치 후 손가락 하나가 남아 있으면, 모두 뗄 때까지 그리지 않는다.
    mode.current = pointers.current.size ? "blocked" : "none";
  };

  const zoomButton = "flex h-8 w-8 items-center justify-center rounded-full text-lg font-black text-ink hover:bg-sky-haze disabled:opacity-30";

  return (
    <div ref={viewportRef} className="relative w-full overflow-hidden rounded-3xl bg-white shadow-card" style={{ aspectRatio: `${width} / ${height}` }}>
      <div className="absolute inset-0 origin-top-left" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.z})` }}>
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
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 h-full w-full touch-none"
          style={{ cursor: panning ? "grabbing" : panKeyHeld ? "grab" : "crosshair" }}
        />
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-full bg-white/90 p-1 shadow-card backdrop-blur">
        <button type="button" title="축소 (Ctrl -)" aria-label="축소" onClick={() => zoomAt(1 / ZOOM_STEP)} disabled={view.z <= MIN_ZOOM} className={zoomButton}>
          −
        </button>
        <button type="button" title="원래 크기 (Ctrl 0)" onClick={resetZoom} className="min-w-14 rounded-full px-2 py-1 text-xs font-black tabular-nums text-ink hover:bg-sky-haze">
          {Math.round(view.z * 100)}%
        </button>
        <button type="button" title="확대 (Ctrl +)" aria-label="확대" onClick={() => zoomAt(ZOOM_STEP)} disabled={view.z >= MAX_ZOOM} className={zoomButton}>
          +
        </button>
      </div>
    </div>
  );
});

export default TracingCanvas;
