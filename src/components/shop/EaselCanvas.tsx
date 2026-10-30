// 기프트샵에서 특수 브러쉬를 사기 전에 직접 그어 보는 이젤 캔버스.
// 나무 이젤에 하얀 캔버스가 얹혀 있고, 고른 브러쉬의 무늬(lib/drawing/brushPatterns.ts)로 그려진다.
// 캔버스 오른쪽의 "뒤로" 버튼으로 닫는다. 놓을 자리와 들어오고 나가는 움직임은 부모(pages/ShopPage.tsx)가 정한다.
import { useEffect, useRef, type PointerEvent } from "react";
import { patternFor } from "../../lib/drawing/brushPatterns";

/** 무늬에 섞이는 붓 색 */
const TRIAL_COLOR = "#e9474e";
/** 획 굵기 (CSS 픽셀) */
const TRIAL_SIZE = 22;
/** 캔버스가 작아서 무늬도 작게 깐다 */
const TRIAL_SCALE = 0.7;

const LINE = "#7A5A32";
const WOOD = "#E2C08D";
const WOOD_SHADE = "#C9A36A";

/** 나무 이젤: 뒷다리 두 개가 캔버스 위로 솟고, 받침대 아래로 앞다리가 벌어진다 */
function Easel() {
  const plank = { fill: WOOD, stroke: LINE, strokeWidth: 3, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 300 400" aria-hidden="true" className="absolute inset-0 h-full w-full">
      <path d="M96 6h24l-14 392H82Z" {...plank} />
      <path d="M180 6h24l14 392h-24Z" {...plank} />
      <path d="M99 10h6l-13 380h-4Z" fill={WOOD_SHADE} />
      <path d="M196 10h6l14 380h-5Z" fill={WOOD_SHADE} />
      {/* 캔버스 자리 (그림판은 HTML canvas 가 위에 얹힌다) */}
      <rect x="27" y="37" width="246" height="246" rx="3" fill="#000" opacity="0.18" transform="translate(4 5)" />
      <rect x="27" y="37" width="246" height="246" rx="3" fill="#FAFAF7" stroke="#D6D2C8" strokeWidth="3" />
      {/* 받침대와 앞다리 */}
      <path d="M78 296h20l-18 100H58Z" {...plank} />
      <path d="M202 296h20l20 100h-22Z" {...plank} />
      <rect x="14" y="280" width="272" height="20" rx="4" {...plank} />
      <path d="M20 286H280" stroke="#F3DDB4" strokeWidth="3" />
    </svg>
  );
}

export default function EaselCanvas({ slug, name, onBack, className }: { slug: string; name: string; onBack: () => void; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  // 화면 크기에 맞춰 캔버스 해상도를 맞춘다 (크기가 바뀌면 그림도 비운다)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const fit = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      canvas.getContext("2d")!.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => ({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });

  const strokeTo = (to: { x: number; y: number }) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    const from = last.current ?? to;
    ctx.strokeStyle = patternFor(ctx, slug, TRIAL_COLOR, TRIAL_SCALE);
    ctx.lineWidth = TRIAL_SIZE;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    last.current = to;
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    last.current = null;
    strokeTo(point(e));
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (last.current) strokeTo(point(e));
  };
  const onUp = () => {
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className={`aspect-[3/4] ${className ?? ""}`}>
      <div className="relative h-full w-full">
        <Easel />
        {/* 하얀 캔버스 위 그림판 (Easel 의 캔버스 자리와 같은 비율 위치) */}
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label={`${name} 브러쉬로 그려 보는 캔버스`}
          className="absolute left-[10%] top-[10%] h-[60%] w-[80%] cursor-crosshair touch-none rounded-sm"
        />
        <div className="absolute left-full top-[26%] ml-3 flex flex-col gap-2 whitespace-nowrap">
          <button type="button" onClick={onBack} className="rounded-full border-2 border-[#2B1A1A] bg-white px-4 py-1.5 text-sm font-black text-[#2B1A1A] shadow-md transition hover:bg-[#FFF6C2]">
            뒤로
          </button>
          <button type="button" onClick={clear} className="rounded-full border-2 border-[#2B1A1A] bg-white/90 px-4 py-1.5 text-sm font-bold text-ink-muted shadow-md transition hover:bg-white">
            지우기
          </button>
        </div>
      </div>
    </div>
  );
}
