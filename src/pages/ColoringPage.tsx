// 장면 색칠하기 화면 (#/color/<장면 id>). 밑그림의 선으로 나뉜 구역 안에 일반 브러쉬(색)나 특수 브러쉬(무늬)로 칠한다.
// 붓을 대는 순간의 구역 안에만 칠해지고 다른 구역으로 넘어가지 않는다 (components/ColoringCanvas.tsx, lib/drawing/regions.ts).
// 특수 브러쉬는 셀로 사서 쓴다: 목록·가격·산 브러쉬·가진 셀은 DB에서 받고(GET /api/brushes), 사기는 POST /api/brushes/<slug>/purchase.
// 일반 브러쉬 색은 누구나 쓰는 값이라 아래 BASIC_COLORS 상수로 둔다.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ColoringCanvas, { visiblePaint, type ColoringCanvasHandle, type PaintAction, type PaintStroke } from "../components/ColoringCanvas";
import { ToolbarButton, ToolbarDivider, ToolbarMenu } from "../components/toolbar";
import { findScene } from "../data/scenes";
import { api, type BrushState, type SpecialBrush } from "../lib/api";
import { hasPattern, patternFor } from "../lib/drawing/brushPatterns";
import { buildRegions, type Regions } from "../lib/drawing/regions";
import { loadGuide } from "../lib/drawing/sceneAssets";
import { downloadImage } from "../lib/download";
import { navigate } from "../router";

/** 일반 브러쉬 색. 색 값뿐이고 다른 데이터와 이어지지 않아 DB에 두지 않는다 */
const BASIC_COLORS = [
  { name: "빨강", color: "#e9474e" },
  { name: "주황", color: "#f28c48" },
  { name: "노랑", color: "#f6ce4c" },
  { name: "초록", color: "#65bd79" },
  { name: "파랑", color: "#3689e7" },
  { name: "남색", color: "#3b4aa8" },
  { name: "보라", color: "#8a55c8" },
  { name: "분홍", color: "#f277aa" },
  { name: "갈색", color: "#9a6a43" },
  { name: "검정", color: "#363636" },
  { name: "흰색", color: "#ffffff" },
];
/** 붓 크기 범위 (캔버스 픽셀) */
const MIN_SIZE = 10;
const MAX_SIZE = 120;

const BACK = { path: "/story", label: "장면 고르기" };

/** 특수 브러쉬 버튼의 무늬 미리보기 */
function PatternPreview({ slug, color }: { slug: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.fillStyle = patternFor(ctx, slug, color, 0.8);
    ctx.fillRect(0, 0, 120, 60);
  }, [slug, color]);
  return <canvas ref={ref} width={120} height={60} className="h-9 w-16 rounded-xl" aria-hidden="true" />;
}

/** 아래 브러쉬 칸의 버튼 */
function TrayButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex shrink-0 flex-col items-center gap-1 rounded-2xl p-1.5 text-[11px] font-bold transition ${
        active ? "bg-sky-haze text-sky-deep ring-2 ring-sky-deep" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      {children}
    </button>
  );
}

/** 왼쪽 도구 막대의 버튼 */
function RailButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-14 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
        active ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      <span className="text-xl leading-none">{children}</span>
      {label}
    </button>
  );
}

export default function ColoringPage({ sceneId }: { sceneId: string }) {
  const scene = findScene(sceneId);
  const canvasRef = useRef<ColoringCanvasHandle>(null);
  const [assets, setAssets] = useState<{ guide: HTMLCanvasElement; regions: Regions } | null>(null);
  const [failed, setFailed] = useState(false);
  const [specials, setSpecials] = useState<SpecialBrush[] | null>(null);
  const [specialsError, setSpecialsError] = useState<string | null>(null);
  /** 가진 셀 (DB users.cells) */
  const [cells, setCells] = useState<number | null>(null);
  /** 사려고 누른 (아직 안 산) 특수 브러쉬 */
  const [buying, setBuying] = useState<SpecialBrush | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);

  const [color, setColor] = useState(BASIC_COLORS[0].color);
  /** 고른 특수 브러쉬 (null 이면 일반 브러쉬) */
  const [pattern, setPattern] = useState<string | null>(null);
  const [erase, setErase] = useState(false);
  const [size, setSize] = useState(40);
  const [actions, setActions] = useState<PaintAction[]>([]);
  const [redoStack, setRedoStack] = useState<PaintAction[]>([]);

  // 밑그림을 불러와 구역을 나눈다 (장면을 열 때 한 번)
  useEffect(() => {
    if (!scene) return;
    let cancelled = false;
    loadGuide(scene).then(
      (guide) => !cancelled && setAssets({ guide, regions: buildRegions(guide) }),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  const applyBrushState = (r: BrushState) => {
    setCells(r.cells);
    setSpecials(r.brushes.filter((b) => hasPattern(b.slug)));
  };
  useEffect(() => {
    api.specialBrushes().then(applyBrushState, (err: Error) => setSpecialsError(err.message));
  }, []);

  /** 셀로 특수 브러쉬를 사고, 사면 바로 그 브러쉬를 고른다 (서버가 셀·산 브러쉬를 한 트랜잭션으로 저장) */
  const buy = (brush: SpecialBrush) => {
    setBuyBusy(true);
    setBuyError(null);
    api.buyBrush(brush.slug).then(
      (r) => {
        applyBrushState(r);
        setBuying(null);
        setPattern(brush.slug);
        setErase(false);
      },
      (err: Error) => setBuyError(err.message),
    ).finally(() => setBuyBusy(false));
  };

  const hasPaint = visiblePaint(actions).length > 0;
  const addStroke = useCallback((s: PaintStroke) => {
    setActions((prev) => [...prev, s]);
    setRedoStack([]);
  }, []);
  const undo = () => {
    if (!actions.length) return;
    setRedoStack((r) => [...r, actions[actions.length - 1]]);
    setActions(actions.slice(0, -1));
  };
  const redo = () => {
    if (!redoStack.length) return;
    setActions((prev) => [...prev, redoStack[redoStack.length - 1]]);
    setRedoStack(redoStack.slice(0, -1));
  };
  const clearAll = () => {
    if (!hasPaint) return;
    setActions((prev) => [...prev, { type: "clear" }]);
    setRedoStack([]);
  };

  if (!scene) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sky-soft text-sm font-bold text-ink-muted">
        찾을 수 없는 장면이에요.
        <button type="button" onClick={() => navigate(BACK.path)} className="rounded-full bg-sky-deep px-5 py-2 text-white">
          장면 고르러 가기
        </button>
      </main>
    );
  }

  const pickColor = (c: string) => {
    setColor(c);
    setPattern(null);
    setErase(false);
  };
  /** 산 브러쉬는 고르고, 안 산 브러쉬는 사기 창을 연다 */
  const pickPattern = (brush: SpecialBrush) => {
    if (!brush.owned) {
      setBuying(brush);
      setBuyError(null);
      return;
    }
    setPattern(brush.slug);
    setErase(false);
  };
  const isBasic = BASIC_COLORS.some((c) => c.color === color);
  const activeName = erase
    ? "지우개"
    : pattern
      ? (specials?.find((b) => b.slug === pattern)?.name ?? pattern)
      : (BASIC_COLORS.find((c) => c.color === color)?.name ?? "고른 색");

  return (
    <div
      className="flex h-dvh flex-col gap-3 bg-white p-3 text-ink"
      style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1.2px)", backgroundSize: "12px 12px" }}
    >
      <header className="relative z-30 flex flex-wrap items-center gap-1 rounded-3xl border border-white/90 bg-white/76 px-2 py-1.5 shadow-card backdrop-blur-sm">
        <ToolbarButton title={BACK.label} onClick={() => navigate(BACK.path)}>
          ← <span className="hidden sm:inline">{BACK.label}</span>
        </ToolbarButton>
        <ToolbarDivider />
        <span className="mr-1 rounded-full bg-sun px-3 py-1 text-sm font-black text-ink">🎨 {scene.title} 색칠하기</span>
        <ToolbarDivider />
        <ToolbarMenu
          title="붓 크기"
          label={
            <>
              <span className="inline-block rounded-full bg-ink" style={{ width: 4 + size / 8, height: 4 + size / 8 }} aria-hidden="true" />
              크기 {size}
            </>
          }
        >
          {() => (
            <label className="block text-sm font-bold">
              붓 크기 {size}
              <input type="range" min={MIN_SIZE} max={MAX_SIZE} value={size} onChange={(e) => setSize(Number(e.target.value))} className="mt-2 w-full accent-sky-deep" />
            </label>
          )}
        </ToolbarMenu>
        <ToolbarDivider />
        <ToolbarButton title="되돌리기" onClick={undo} disabled={!actions.length}>
          ↶ <span className="hidden md:inline">되돌리기</span>
        </ToolbarButton>
        <ToolbarButton title="다시 하기" onClick={redo} disabled={!redoStack.length}>
          ↷ <span className="hidden md:inline">다시 하기</span>
        </ToolbarButton>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolbarButton title="전체 지우기" onClick={clearAll} disabled={!hasPaint}>
            🗑️ <span className="hidden md:inline">전체 지우기</span>
          </ToolbarButton>
          <ToolbarButton
            title="그림 저장"
            primary
            disabled={!hasPaint}
            onClick={() => {
              const url = canvasRef.current?.exportImage();
              if (url) downloadImage(url, `${scene.title}-색칠.png`);
            }}
          >
            💾 저장
          </ToolbarButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        <nav aria-label="색칠 도구" className="flex flex-col gap-1 self-start rounded-3xl border border-white/90 bg-white/76 p-1.5 shadow-card backdrop-blur-sm">
          <RailButton label="브러쉬" active={!erase} onClick={() => setErase(false)}>
            🖌️
          </RailButton>
          <RailButton label="지우개" active={erase} onClick={() => setErase(true)}>
            🧽
          </RailButton>
        </nav>
        {/* 남은 공간 안에서 비율을 지키며 그림판을 최대한 크게 */}
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
          <div style={{ width: `min(100cqw, calc(100cqh * ${scene.width / scene.height}))` }}>
            {assets ? (
              <ColoringCanvas
                ref={canvasRef}
                guide={assets.guide}
                regions={assets.regions}
                brush={{ pattern: erase ? null : pattern, color, size, erase }}
                actions={actions}
                onStrokeEnd={addStroke}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-3xl bg-white/80 text-sm font-bold text-ink-muted shadow-card"
                style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
              >
                {failed ? "밑그림을 불러오지 못했어요." : "색칠할 구역을 나누는 중…"}
              </div>
            )}
          </div>
        </div>
        {/* 그림판이 가운데 오도록 도구 막대만큼 오른쪽도 비워 둔다 */}
        <div className="hidden w-[4.25rem] shrink-0 lg:block" aria-hidden="true" />
      </div>

      <footer className="rounded-3xl border border-white/90 bg-white/76 px-3 py-2 shadow-card backdrop-blur-sm">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 px-1 text-xs font-extrabold text-ink-muted">
          <span>붓을 댄 구역 안에만 칠해져요. 다른 구역은 붓을 떼고 다시 눌러 칠하세요.</span>
          <span className="text-sky-deep">지금: {activeName}</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <span className="w-8 shrink-0 text-xs font-black text-ink-muted">일반</span>
          {BASIC_COLORS.map((c) => (
            <TrayButton key={c.color} title={c.name} active={!erase && !pattern && color === c.color} onClick={() => pickColor(c.color)}>
              <span className="h-9 w-9 rounded-full border border-black/10" style={{ background: c.color }} />
              {c.name}
            </TrayButton>
          ))}
          <label
            title="다른 색 고르기"
            className={`flex shrink-0 cursor-pointer flex-col items-center gap-1 rounded-2xl p-1.5 text-[11px] font-bold ${
              !erase && !pattern && !isBasic ? "bg-sky-haze text-sky-deep ring-2 ring-sky-deep" : "text-ink-muted hover:bg-sky-soft"
            }`}
          >
            <input type="color" value={color} onChange={(e) => pickColor(e.target.value)} className="h-9 w-9 cursor-pointer rounded-full" />
            다른 색
          </label>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <span className="w-8 shrink-0 text-xs font-black text-ink-muted">특수</span>
          {cells !== null && <span className="shrink-0 rounded-full bg-sun px-2.5 py-1 text-xs font-black text-ink">💠 {cells}셀</span>}
          {specialsError && <span className="text-xs font-bold text-red-600">{specialsError}</span>}
          {!specials && !specialsError && <span className="text-xs font-bold text-ink-muted">불러오는 중…</span>}
          {specials?.map((b) => (
            <TrayButton
              key={b.slug}
              title={b.owned ? `${b.name} (고른 색이 무늬에 섞여요)` : `${b.name} — ${b.price}셀로 사기`}
              active={!erase && pattern === b.slug}
              onClick={() => pickPattern(b)}
            >
              <span className="relative">
                <PatternPreview slug={b.slug} color={color} />
                {!b.owned && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 text-[11px] font-black text-ink">🔒 {b.price}</span>
                )}
              </span>
              {b.name}
            </TrayButton>
          ))}
        </div>
      </footer>

      {buying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" role="dialog" aria-modal="true" aria-label={`${buying.name} 브러쉬 사기`}>
          <div className="w-80 max-w-full rounded-3xl bg-white p-5 text-center shadow-card-hover">
            <div className="mx-auto mb-3 w-32">
              <PatternPreview slug={buying.slug} color={color} />
            </div>
            <p className="text-lg font-extrabold">{buying.name} 브러쉬</p>
            <p className="mt-1 text-sm font-bold text-ink-muted">
              {buying.price}셀로 살까요? (가진 셀 {cells ?? 0})
            </p>
            {buyError && <p className="mt-2 text-sm font-bold text-red-600">{buyError}</p>}
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setBuying(null)} className="flex-1 rounded-full bg-sky-soft py-2 text-sm font-bold hover:bg-sky-haze">
                취소
              </button>
              <button
                type="button"
                onClick={() => buy(buying)}
                disabled={buyBusy || (cells ?? 0) < buying.price}
                className="flex-1 rounded-full bg-sky-deep py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {(cells ?? 0) < buying.price ? "셀이 부족해요" : "사기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
