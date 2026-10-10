// 그리기 화면(스토리 장면, 캐릭터) 공통: 브러쉬 상태·되돌리기·단축키와 도구 패널.
// - useDrawingTools: 색·굵기·지우개·획 목록·되돌리기 상태를 관리하고 단축키를 등록하는 훅
// - ToolPanels / ShortcutPanel: 오른쪽 사이드바에 들어가는 도구·색깔·굵기·선 다듬기·단축키 패널
// - downloadImage: 그린 그림을 PNG 파일로 내려받기
import { useCallback, useEffect, useState, type ReactNode, type RefObject } from "react";
import { visibleStrokes, type DrawAction, type Stroke, type TracingCanvasHandle } from "./TracingCanvas";

export const palette = [
  { name: "검정", value: "#363636" },
  { name: "갈색", value: "#8b5a2b" },
  { name: "빨강", value: "#ef4444" },
  { name: "주황", value: "#f97316" },
  { name: "노랑", value: "#fee500" },
  { name: "초록", value: "#22a35a" },
  { name: "하늘", value: "#38bdf8" },
  { name: "파랑", value: "#1e82dc" },
  { name: "보라", value: "#8b5cf6" },
  { name: "분홍", value: "#f472b6" },
];

const sizes = [
  { name: "가늘게", value: 4 },
  { name: "보통", value: 8 },
  { name: "굵게", value: 16 },
  { name: "아주 굵게", value: 32 },
];

/** Fade 슬라이더 1칸 = 캔버스 3픽셀 (최대 300픽셀에 걸쳐 가늘어짐) */
const FADE_PX_PER_STEP = 3;
const MIN_SIZE = 2;
const MAX_SIZE = 48;
const SIZE_STEP = 2;

/** 숫자키 1~9, 0 → 팔레트 1~10번째 색 */
const paletteKey = (index: number) => String((index + 1) % 10);

const shortcuts: [keys: string[], desc: string][] = [
  [["B"], "브러쉬"],
  [["E"], "지우개"],
  [["["], "굵기 줄이기"],
  [["]"], "굵기 늘리기"],
  [["1", "~", "0"], "색깔 고르기"],
  [["Ctrl", "Z"], "되돌리기"],
  [["Ctrl", "Y"], "다시 하기"],
  [["Ctrl", "+"], "확대 (Ctrl+휠)"],
  [["Ctrl", "−"], "축소"],
  [["Ctrl", "0"], "원래 크기"],
  [["Ctrl"], "누른 채 드래그: 화면 이동"],
];

/**
 * 그리기 상태와 동작을 한데 묶은 훅. 키보드 단축키도 여기서 등록한다.
 * maxBrushSize: 브러쉬 최대 굵기 (따라 그리기에서 굵은 브러쉬로 선을 덮어 버리지 못하게). 지우개에는 적용하지 않는다.
 */
export function useDrawingTools(canvasRef: RefObject<TracingCanvasHandle | null>, { maxBrushSize = MAX_SIZE }: { maxBrushSize?: number } = {}) {
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [color, setColor] = useState(palette[0].value);
  const [rawSize, setRawSize] = useState(8);
  const [erase, setErase] = useState(false);
  const [smoothing, setSmoothing] = useState(50);
  const [fade, setFade] = useState(30);

  // 브러쉬와 지우개가 굵기를 같이 쓰므로, 저장된 값은 두고 쓸 때만 상한으로 자른다.
  const sizeMax = erase ? MAX_SIZE : Math.min(MAX_SIZE, maxBrushSize);
  const size = Math.min(rawSize, sizeMax);
  const setSize = useCallback((v: number) => setRawSize(Math.max(MIN_SIZE, Math.min(sizeMax, v))), [sizeMax]);

  const hasDrawing = visibleStrokes(actions).length > 0;

  const addStroke = useCallback((stroke: Stroke) => {
    setActions((prev) => [...prev, stroke]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (!actions.length) return;
    setRedoStack((r) => [...r, actions[actions.length - 1]]);
    setActions(actions.slice(0, -1));
  }, [actions]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    setActions((prev) => [...prev, redoStack[redoStack.length - 1]]);
    setRedoStack(redoStack.slice(0, -1));
  }, [redoStack]);

  const clearAll = () => {
    if (!hasDrawing) return;
    setActions((prev) => [...prev, { type: "clear" }]);
    setRedoStack([]);
  };

  const pickColor = (value: string) => {
    setColor(value);
    setErase(false);
  };

  // 단축키. 한글 입력 상태에서도 동작하도록 e.key 대신 물리 키(e.code)로 판단한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || (target instanceof HTMLInputElement && !["range", "checkbox"].includes(target.type))) return;

      if (e.ctrlKey || e.metaKey) {
        // 브라우저 확대 대신 캔버스 확대
        if (["Equal", "NumpadAdd"].includes(e.code)) {
          e.preventDefault();
          canvasRef.current?.zoomIn();
        } else if (["Minus", "NumpadSubtract"].includes(e.code)) {
          e.preventDefault();
          canvasRef.current?.zoomOut();
        } else if (["Digit0", "Numpad0"].includes(e.code)) {
          e.preventDefault();
          canvasRef.current?.resetZoom();
        } else if (e.code === "KeyZ" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (e.altKey) return;

      if (e.code === "KeyB") setErase(false);
      else if (e.code === "KeyE") setErase(true);
      else if (e.code === "BracketLeft") setSize(size - SIZE_STEP);
      else if (e.code === "BracketRight") setSize(size + SIZE_STEP);
      else if (/^(Digit|Numpad)\d$/.test(e.code)) {
        const c = palette[(Number(e.code.slice(-1)) + 9) % 10];
        if (!c) return;
        pickColor(c.value);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canvasRef, size, setSize]);

  return {
    color,
    size,
    sizeMax,
    erase,
    smoothing,
    fade,
    hasDrawing,
    setSize,
    setErase,
    setSmoothing,
    setFade,
    pickColor,
    undo,
    redo,
    clearAll,
    /** TracingCanvas에 그대로 넘기는 값 */
    canvasProps: {
      color,
      size,
      erase,
      smoothing: smoothing / 100,
      fade: fade * FADE_PX_PER_STEP,
      actions,
      onStrokeEnd: addStroke,
    },
  };
}

export type DrawingTools = ReturnType<typeof useDrawingTools>;

/** data URL을 파일로 내려받는다. */
export function downloadImage(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export function Kbd({ children, inverted }: { children: ReactNode; inverted?: boolean }) {
  return (
    <kbd
      className={`inline-flex min-w-5 items-center justify-center rounded-md px-1 font-sans text-[11px] font-bold leading-5 ${
        inverted ? "bg-white/25 text-white" : "border border-sky-haze bg-white text-ink-muted"
      }`}
    >
      {children}
    </kbd>
  );
}

export function Panel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/90 bg-white/80 p-4 shadow-card">
      <h2 className="mb-3 text-sm font-extrabold text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

function ToolButton({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex h-11 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-2 text-sm font-bold transition ${
        active ? "bg-sky-deep text-white shadow-sm" : "bg-sky-soft text-ink hover:bg-sky-haze"
      }`}
    >
      {children}
    </button>
  );
}

/** 도구 · 색깔 · 굵기 · 선 다듬기 패널 */
export function ToolPanels({ tools }: { tools: DrawingTools }) {
  const { color, size, sizeMax, erase, smoothing, fade } = tools;
  return (
    <>
      <Panel title="도구">
        <div className="flex gap-2">
          <ToolButton label="브러쉬 (B)" active={!erase} onClick={() => tools.setErase(false)}>
            🖌️ 브러쉬 <Kbd inverted={!erase}>B</Kbd>
          </ToolButton>
          <ToolButton label="지우개 (E)" active={erase} onClick={() => tools.setErase(true)}>
            🧽 지우개 <Kbd inverted={erase}>E</Kbd>
          </ToolButton>
        </div>
        <div className="mt-2 flex gap-2">
          <ToolButton label="되돌리기 (Ctrl+Z)" onClick={tools.undo}>
            ↶ 되돌리기
          </ToolButton>
          <ToolButton label="다시 하기 (Ctrl+Y)" onClick={tools.redo}>
            ↷ 다시
          </ToolButton>
        </div>
      </Panel>

      <Panel title="색깔">
        <div className="grid grid-cols-5 gap-2">
          {palette.map((c, i) => (
            <button
              key={c.value}
              type="button"
              title={`${c.name} (${paletteKey(i)})`}
              aria-label={c.name}
              aria-pressed={!erase && color === c.value}
              onClick={() => tools.pickColor(c.value)}
              className={`relative aspect-square rounded-full border-2 transition hover:scale-110 ${
                !erase && color === c.value ? "border-white ring-2 ring-sky-deep" : "border-white shadow"
              }`}
              style={{ backgroundColor: c.value }}
            >
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-black text-ink-muted shadow-sm">
                {paletteKey(i)}
              </span>
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center justify-between text-sm font-bold">
          다른 색 고르기
          <input
            type="color"
            value={color}
            onChange={(e) => tools.pickColor(e.target.value)}
            className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
          />
        </label>
      </Panel>

      <Panel
        title={
          <span className="flex items-center justify-between">
            {`${erase ? "지우개" : "브러쉬"} 굵기 ${size}`}
            <span className="flex gap-1">
              <Kbd>[</Kbd>
              <Kbd>]</Kbd>
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-4 gap-2">
          {sizes.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.name}
              aria-label={s.name}
              aria-pressed={size === s.value}
              onClick={() => tools.setSize(s.value)}
              disabled={s.value > sizeMax}
              className={`flex h-12 items-center justify-center rounded-2xl transition disabled:opacity-30 ${
                size === s.value ? "bg-sky-haze ring-2 ring-sky-deep" : "bg-sky-soft enabled:hover:bg-sky-haze"
              }`}
            >
              <span className="rounded-full bg-ink" style={{ width: 4 + s.value / 1.5, height: 4 + s.value / 1.5 }} />
            </button>
          ))}
        </div>
        <input
          type="range"
          min={MIN_SIZE}
          max={sizeMax}
          value={size}
          onChange={(e) => tools.setSize(Number(e.target.value))}
          aria-label="브러쉬 굵기"
          className="mt-3 w-full accent-sky-deep"
        />
        {sizeMax < MAX_SIZE && <p className="mt-2 text-xs font-medium text-ink-muted">흰 선 두께에 맞춰 브러쉬는 {sizeMax}까지만 굵게 할 수 있어요.</p>}
      </Panel>

      <Panel title="선 다듬기">
        <label className="block text-sm font-bold">
          <span className="flex justify-between">
            손떨림 보정 <span className="tabular-nums text-ink-muted">{smoothing}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={smoothing}
            onChange={(e) => tools.setSmoothing(Number(e.target.value))}
            className="mt-1 w-full accent-sky-deep"
          />
        </label>
        <label className="mt-3 block text-sm font-bold">
          <span className="flex justify-between">
            시작·끝 흐리기 (Fade) <span className="tabular-nums text-ink-muted">{fade === 0 ? "끔" : fade}</span>
          </span>
          <input type="range" min={0} max={100} value={fade} onChange={(e) => tools.setFade(Number(e.target.value))} className="mt-1 w-full accent-sky-deep" />
        </label>
        <p className="mt-2 text-xs font-medium text-ink-muted">보정을 올리면 선이 부드러워지고, 흐리기를 올리면 선의 시작과 끝이 가늘어져요.</p>
      </Panel>
    </>
  );
}

export function ShortcutPanel() {
  return (
    <Panel title="⌨️ 단축키">
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
        {shortcuts.map(([keys, desc]) => (
          <div key={desc} className="contents">
            <dt className="flex items-center gap-0.5">
              {keys.map((k) => (k === "~" ? <span key={k} className="text-xs text-ink-muted">~</span> : <Kbd key={k}>{k}</Kbd>))}
            </dt>
            <dd className="font-semibold">{desc}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
