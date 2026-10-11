// 그리기 화면(스토리 장면, 캐릭터) 공통: 브러쉬 상태·되돌리기·단축키와 화면 틀.
// - useDrawingTools: 굵기·지우개·획 목록·되돌리기 상태를 관리하고 단축키를 등록하는 훅
// - DrawingShell: 위 툴바 / 왼쪽 도구 막대 + 가운데 그림판 / 아래 상태 막대로 된 화면 틀
// - ToolbarButton, ToolbarMenu, MenuItem: 툴바 버튼과 눌렀을 때 펼쳐지는 메뉴
// - SizeMenu, LineMenu, HistoryButtons, ShortcutList: 굵기 조절 바, 선 다듬기(손떨림 보정·선 끝 얇게), 되돌리기/다시, 단축키 목록
// - useDrawingDraft, ResumeDialog: 이어서 그리기 (그리던 그림을 저장해 두고 다시 열면 이어 그릴지 묻는다)
// - downloadImage: 그린 그림을 PNG 파일로 내려받기
// 선화 연습이 목적이라 색은 검정 하나만 쓴다. 굵기·손떨림 보정·선 끝 얇게는 저장해 두고 다음에도 이어 쓴다.
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { loadDraft, removeDraft, saveDraft, type Draft } from "../lib/drawingDraft";
import { useSavedSetting } from "../lib/userSettings";
import { navigate } from "../router";
import { visibleStrokes, type DrawAction, type Stroke, type TracingCanvasHandle } from "./TracingCanvas";

/** 펜 색 (검정 고정) */
const INK_COLOR = "#363636";
/** 선 끝 얇게 조절 바 1칸 = 캔버스 3픽셀 (최대 300픽셀에 걸쳐 가늘어짐) */
const FADE_PX_PER_STEP = 3;
const MIN_SIZE = 2;
/** 브러쉬 최대 굵기 */
const BRUSH_MAX_SIZE = 6;
/** 지우개 최대 굵기 */
const ERASER_MAX_SIZE = 48;
const SIZE_STEP = 2;

const shortcuts: [keys: string[], desc: string][] = [
  [["B"], "브러쉬"],
  [["E"], "지우개"],
  [["["], "굵기 줄이기"],
  [["]"], "굵기 늘리기"],
  [["Ctrl", "Z"], "되돌리기"],
  [["Ctrl", "Y"], "다시 하기"],
  [["Ctrl", "+"], "확대"],
  [["Ctrl", "−"], "축소"],
  [["Ctrl", "0"], "원래 크기"],
  [["Ctrl"], "+드래그: 이동"],
];

/**
 * 그리기 상태와 동작을 한데 묶은 훅. 키보드 단축키도 여기서 등록한다.
 * maxBrushSize: 브러쉬 최대 굵기를 BRUSH_MAX_SIZE보다 더 낮출 때 (따라 그리기에서 흰 선 두께에 맞출 때). 지우개에는 적용하지 않는다.
 * fade: false면 선 끝 얇게를 쓰지 않는다 (따라 그리기: 선 끝이 뾰족하면 짧게 끊어 그린 털선이 서로 안 겹쳐 감점을 피해 간다).
 *       저장된 선 끝 얇게 값은 그대로 두므로 캐릭터 그리기에서는 계속 쓴다.
 */
export function useDrawingTools(
  canvasRef: RefObject<TracingCanvasHandle | null>,
  { maxBrushSize = BRUSH_MAX_SIZE, fade: fadeEnabled = true }: { maxBrushSize?: number; fade?: boolean } = {},
) {
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  // 굵기는 그림을 바꿔도 이어지도록 저장해 둔다 (lib/userSettings).
  const [rawSize, setRawSize] = useSavedSetting("brushSize");
  const [smoothing, setSmoothing] = useSavedSetting("smoothing");
  const [fade, setFade] = useSavedSetting("fade");
  const [erase, setErase] = useState(false);

  // 브러쉬와 지우개가 굵기를 같이 쓰므로, 저장된 값은 두고 쓸 때만 상한으로 자른다.
  const sizeMax = erase ? ERASER_MAX_SIZE : Math.min(BRUSH_MAX_SIZE, maxBrushSize);
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

  /** 저장해 둔 그림을 불러올 때: 획 목록을 통째로 바꾸고 다시 하기 목록은 비운다. */
  const replaceActions = useCallback((next: DrawAction[]) => {
    setActions(next);
    setRedoStack([]);
  }, []);

  const clearAll = () => {
    if (!hasDrawing) return;
    setActions((prev) => [...prev, { type: "clear" }]);
    setRedoStack([]);
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
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, canvasRef, size, setSize]);

  return {
    size,
    sizeMax,
    erase,
    smoothing,
    fade,
    fadeEnabled,
    hasDrawing,
    setSize,
    setErase,
    setSmoothing,
    setFade,
    undo,
    redo,
    clearAll,
    replaceActions,
    /** TracingCanvas에 그대로 넘기는 값 */
    canvasProps: {
      color: INK_COLOR,
      size,
      erase,
      smoothing: smoothing / 100,
      fade: fadeEnabled ? fade * FADE_PX_PER_STEP : 0,
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

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-sky-haze bg-white px-1 font-sans text-[11px] font-bold leading-5 text-ink-muted">
      {children}
    </kbd>
  );
}

/** 툴바 사이 구분선 */
export function ToolbarDivider() {
  return <span className="mx-1 hidden h-6 w-px bg-sky-haze sm:block" aria-hidden="true" />;
}

type ToolbarButtonProps = {
  onClick?: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** 진한 바탕으로 눈에 띄게 (저장처럼 주요 동작) */
  primary?: boolean;
};

export function ToolbarButton({ onClick, title, children, active, disabled, primary }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold transition disabled:opacity-40 ${
        primary ? "bg-ink text-white shadow-sm enabled:hover:bg-sky-deep" : active ? "bg-sky-haze text-sky-deep" : "text-ink enabled:hover:bg-sky-soft"
      }`}
    >
      {children}
    </button>
  );
}

type ToolbarMenuProps = {
  /** 툴바에 보이는 버튼 내용 */
  label: ReactNode;
  title: string;
  /** 메뉴를 버튼 오른쪽 끝에 맞춘다 (툴바 오른쪽에 있는 메뉴) */
  alignRight?: boolean;
  primary?: boolean;
  /** 펼쳐진 메뉴 내용. close를 부르면 메뉴가 닫힌다 */
  children: (close: () => void) => ReactNode;
};

/** 누르면 아래로 펼쳐지는 툴바 메뉴. 바깥을 누르거나 Esc를 누르면 닫힌다. */
export function ToolbarMenu({ label, title, alignRight, primary, children }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <ToolbarButton title={title} active={open} primary={primary} onClick={() => setOpen((v) => !v)}>
        {label}
        <span className={`text-[10px] transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
          ▼
        </span>
      </ToolbarButton>
      {open && (
        <div
          role="menu"
          className={`absolute top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-3xl border border-white/90 bg-white p-4 text-ink shadow-card-hover ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** 툴바 메뉴 안의 한 줄짜리 버튼 */
export function MenuItem({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-sky-soft disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

/** 툴바의 굵기 메뉴: 누르면 굵기 조절 바가 나온다 */
export function SizeMenu({ tools }: { tools: DrawingTools }) {
  const { size, sizeMax, erase } = tools;
  const name = erase ? "지우개" : "브러쉬";
  return (
    <ToolbarMenu
      title={`${name} 굵기`}
      label={
        <>
          <span className="inline-block rounded-full bg-ink" style={{ width: 4 + size / 2, height: 4 + size / 2 }} aria-hidden="true" />
          굵기 {size}
        </>
      }
    >
      {() => (
        <label className="block text-sm font-bold">
          <span className="flex items-center justify-between">
            {name} 굵기 {size}
            <span className="flex gap-1">
              <Kbd>[</Kbd>
              <Kbd>]</Kbd>
            </span>
          </span>
          <input
            type="range"
            min={MIN_SIZE}
            max={sizeMax}
            value={size}
            onChange={(e) => tools.setSize(Number(e.target.value))}
            className="mt-2 w-full accent-sky-deep"
          />
          {!erase && sizeMax < BRUSH_MAX_SIZE && (
            <span className="mt-1 block text-xs font-medium text-ink-muted">흰 선 두께에 맞춰 브러쉬는 {sizeMax}까지만 굵게 할 수 있어요.</span>
          )}
        </label>
      )}
    </ToolbarMenu>
  );
}

/** 툴바의 선 다듬기 메뉴: 손떨림 보정과 선 끝 얇게 조절 바 (선 끝 얇게를 끈 화면에서는 손떨림 보정만) */
export function LineMenu({ tools }: { tools: DrawingTools }) {
  const { smoothing, fade, fadeEnabled } = tools;
  return (
    <ToolbarMenu title={fadeEnabled ? "손떨림 보정, 선 끝 얇게" : "손떨림 보정"} label={fadeEnabled ? "〰️ 선 다듬기" : "〰️ 손떨림 보정"}>
      {() => (
        <>
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
              className="mt-2 w-full accent-sky-deep"
            />
          </label>
          {fadeEnabled && (
            <label className="mt-3 block text-sm font-bold">
              <span className="flex justify-between">
                선 끝 얇게 <span className="tabular-nums text-ink-muted">{fade === 0 ? "끔" : fade}</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                value={fade}
                onChange={(e) => tools.setFade(Number(e.target.value))}
                className="mt-2 w-full accent-sky-deep"
              />
            </label>
          )}
          <p className="mt-2 text-xs font-medium text-ink-muted">
            {fadeEnabled ? "보정을 올리면 선이 부드러워지고, 선 끝 얇게를 올리면 선의 시작과 끝이 가늘어져요." : "보정을 올리면 손이 떨려도 선이 부드럽게 그려져요."}
          </p>
        </>
      )}
    </ToolbarMenu>
  );
}

/**
 * 이어서 그리기. key마다(그림마다) 그리던 획을 저장해 둔다.
 *  - 처음 열 때 저장된 그림이 있으면 pending에 담아 두고, ResumeDialog로 이어 그릴지 묻는다.
 *  - 고르기 전에는 저장하지 않는다 (빈 그림으로 덮어쓰지 않게).
 *  - 그림이 바뀌면 잠깐 뒤에 저장하고, 화면을 나가거나 창을 닫을 때도 바로 저장한다. 다 지우면 저장된 그림도 지운다.
 *  - finish(): 다 그린 그림(기록으로 저장함)은 저장된 그림을 지우고 더는 저장하지 않는다.
 * name: 캐릭터 이름처럼 그림과 같이 저장할 값
 */
export function useDrawingDraft(key: string, tools: DrawingTools, name?: string) {
  const [pending, setPending] = useState<Draft | null>(() => loadDraft(key));
  const actions = tools.canvasProps.actions;
  const latest = useRef({ actions, name, pending });
  latest.current = { actions, name, pending };
  const finished = useRef(false);

  const flush = useCallback(() => {
    const { actions, name, pending } = latest.current;
    if (pending || finished.current) return;
    const strokes = visibleStrokes(actions);
    if (strokes.length) saveDraft(key, strokes, name);
    else removeDraft(key);
  }, [key]);

  useEffect(() => {
    if (pending) return;
    const t = setTimeout(flush, 400);
    return () => clearTimeout(t);
  }, [pending, actions, name, flush]);

  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [flush]);

  const { replaceActions } = tools;
  /** 저장된 그림을 불러온다. 같이 저장한 값(이름 등)을 돌려준다. */
  const resume = useCallback(() => {
    if (!pending) return undefined;
    replaceActions(pending.strokes);
    setPending(null);
    return pending.name;
  }, [pending, replaceActions]);

  const startNew = useCallback(() => {
    removeDraft(key);
    setPending(null);
  }, [key]);

  const finish = useCallback(() => {
    finished.current = true;
    removeDraft(key);
  }, [key]);

  return { pending, resume, startNew, finish };
}

/** 저장된 그림이 있을 때 이어 그릴지 새로 그릴지 묻는 창 */
export function ResumeDialog({ draft, onResume, onStartNew }: { draft: Draft; onResume: () => void; onStartNew: () => void }) {
  const when = new Date(draft.savedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div role="dialog" aria-modal="true" aria-label="이어서 그리기" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/90 bg-white p-6 text-center shadow-card-hover">
        <p className="text-4xl" aria-hidden="true">
          ✏️
        </p>
        <h2 className="mt-2 text-xl font-black">그리던 그림이 있어요</h2>
        <p className="mt-1 text-sm font-medium text-ink-muted">{when}에 그리던 그림이에요. 이어서 그릴까요?</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onStartNew} className="rounded-full bg-sky-soft py-3 text-sm font-bold hover:bg-sky-haze">
            새로 그리기
          </button>
          <button type="button" onClick={onResume} autoFocus className="rounded-full bg-ink py-3 text-sm font-bold text-white hover:bg-sky-deep">
            이어서 그리기
          </button>
        </div>
      </div>
    </div>
  );
}

/** 되돌리기 / 다시 하기 */
export function HistoryButtons({ tools }: { tools: DrawingTools }) {
  return (
    <>
      <ToolbarButton title="되돌리기 (Ctrl+Z)" onClick={tools.undo}>
        <span className="text-lg leading-none">↶</span>
      </ToolbarButton>
      <ToolbarButton title="다시 하기 (Ctrl+Y)" onClick={tools.redo}>
        <span className="text-lg leading-none">↷</span>
      </ToolbarButton>
    </>
  );
}

export function ShortcutList() {
  return (
    <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
      {shortcuts.map(([keys, desc]) => (
        <div key={desc} className="flex items-center gap-1.5">
          <dt className="flex shrink-0 items-center gap-0.5">
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </dt>
          <dd className="font-semibold">{desc}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 왼쪽에 떠 있는 도구 막대의 버튼 */
function RailButton({ active, onClick, label, shortcut, children }: { active: boolean; onClick: () => void; label: string; shortcut: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label} (${shortcut})`}
      className={`flex w-14 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
        active ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      <span className="text-xl leading-none">{children}</span>
      {label}
    </button>
  );
}

type DrawingShellProps = {
  tools: DrawingTools;
  /** 왼쪽 끝 버튼이 돌아갈 곳 */
  back: { path: string; label: string };
  /** 툴바 왼쪽 묶음 (제목, 굵기, 되돌리기 등) */
  toolbarStart: ReactNode;
  /** 툴바 오른쪽 묶음 (도움말, 전체 지우기, 저장 등) */
  toolbarEnd: ReactNode;
  /** 그림판 가로/세로 비율 */
  aspect: number;
  /** 아래 상태 막대 내용 */
  footer?: ReactNode;
  /** 그림판 (TracingCanvas) */
  children: ReactNode;
};

/**
 * 그리기 화면 틀. 화면 전체를 쓰고 스크롤 없이 한 화면에 들어온다.
 *   위: 툴바 (메뉴를 누르면 굵기 조절 바, 밑그림 설정, 단축키 등이 펼쳐진다)
 *   가운데: 왼쪽 도구 막대(브러쉬/지우개) + 남은 공간을 꽉 채우는 그림판
 *   아래: 상태 막대 (점수, 도움말 등)
 */
export function DrawingShell({ tools, back, toolbarStart, toolbarEnd, aspect, footer, children }: DrawingShellProps) {
  return (
    // 흰 바탕에 옅은 회색 점무늬(화이트보드 느낌), 그 위에 반투명 흰 카드와 진한 글자
    <div
      className="flex h-dvh flex-col gap-3 bg-white p-3 text-ink"
      style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1.2px)", backgroundSize: "12px 12px" }}
    >
      <header className="relative z-30 flex flex-wrap items-center gap-1 rounded-3xl border border-white/90 bg-white/76 px-2 py-1.5 shadow-card backdrop-blur-sm">
        <ToolbarButton title={back.label} onClick={() => navigate(back.path)}>
          ← <span className="hidden sm:inline">{back.label}</span>
        </ToolbarButton>
        <ToolbarDivider />
        {toolbarStart}
        <div className="ml-auto flex flex-wrap items-center gap-1">{toolbarEnd}</div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        <nav aria-label="그리기 도구" className="flex flex-col gap-1 self-start rounded-3xl border border-white/90 bg-white/76 p-1.5 shadow-card backdrop-blur-sm">
          <RailButton label="브러쉬" shortcut="B" active={!tools.erase} onClick={() => tools.setErase(false)}>
            🖌️
          </RailButton>
          <RailButton label="지우개" shortcut="E" active={tools.erase} onClick={() => tools.setErase(true)}>
            🧽
          </RailButton>
        </nav>
        {/* 남은 공간 안에서 비율을 지키며 그림판을 최대한 크게 */}
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
          <div style={{ width: `min(100cqw, calc(100cqh * ${aspect}))` }}>{children}</div>
        </div>
        {/* 그림판이 가운데 오도록 도구 막대만큼 오른쪽도 비워 둔다 */}
        <div className="hidden w-[4.25rem] shrink-0 lg:block" aria-hidden="true" />
      </div>

      {footer && (
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl border border-white/90 bg-white/76 px-4 py-2 shadow-card backdrop-blur-sm">{footer}</footer>
      )}
    </div>
  );
}
