// 그리기 상태 훅 (스토리 장면, 캐릭터 그리기 공용): 굵기·지우개·획 목록·되돌리기 상태를 관리하고 키보드 단축키를 등록한다.
// 단축키는 사용자가 설정 화면에서 바꾼 키를 쓴다 (lib/drawing/shortcuts.ts, 저장은 lib/userSettings).
// 펜(따라 그리기 선)은 검정 하나만 쓴다. 굵기·손떨림 보정·선 끝 얇게는 저장해 두고 다음에도 이어 쓴다 (lib/userSettings).
// 밑그림을 구역으로 나눈 화면(paintable)에서는 채우기·브러쉬(색칠 붓)·특수 브러쉬·스포이드도 쓸 수 있다 (색칠은 채점하지 않는다).
// 방금 쓴 색은 이 브라우저(localStorage)에 저장해 두고 다음에도 보여 준다.
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { actionForEvent, resolveShortcuts } from "../../lib/drawing/shortcuts";
import { hasPattern } from "../../lib/drawing/brushPatterns";
import { queryParam } from "../../router";
import { visibleActions, type DrawAction, type PaintStroke, type Stroke } from "../../lib/drawing/strokes";
import { useSavedSetting } from "../../lib/userSettings";
import type { PaintBrush, TracingCanvasHandle } from "../TracingCanvas";

/** 일반 색칠 붓의 색. 누구나 쓰는 색 값이라 DB에 두지 않는다 */
export const BASIC_COLORS = [
  { name: "빨강", color: "#e9474e" },
  { name: "주황", color: "#f28c48" },
  { name: "귤색", color: "#f5a524" },
  { name: "연두", color: "#8fcf3c" },
  { name: "초록", color: "#3fbf6a" },
  { name: "청록", color: "#17b8cf" },
  { name: "파랑", color: "#3689e7" },
  { name: "남색", color: "#5b63e0" },
  { name: "보라", color: "#8a55c8" },
  { name: "분홍", color: "#f277aa" },
  { name: "갈색", color: "#9a6a43" },
  { name: "살구", color: "#fbbf8a" },
  { name: "회색", color: "#9ca3af" },
  { name: "검정", color: "#363636" },
  { name: "흰색", color: "#ffffff" },
  { name: "연보라", color: "#c4a8f5" },
  { name: "진분홍", color: "#e8436b" },
  { name: "에메랄드", color: "#14a37f" },
  { name: "하늘", color: "#38b6f0" },
  { name: "연분홍", color: "#f8b4cf" },
  { name: "노랑", color: "#f6ce4c" },
  { name: "풀색", color: "#b3e04a" },
  { name: "연한 빨강", color: "#f7a3a3" },
  { name: "연하늘", color: "#bcdcfb" },
];

/** 왼쪽 도구 막대의 도구 */
export type Tool = "pen" | "fill" | "brush" | "special" | "eraser" | "picker";

/** 방금 쓴 색: 이 브라우저에 최근 순서로 RECENT_MAX 개까지 저장한다 */
const RECENT_KEY = "dorobus.recentColors";
const RECENT_MAX = 5;
function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((c): c is string => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function saveRecent(colors: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(colors));
  } catch {
    // 저장할 수 없는 환경이면 이번 화면에서만 기억한다
  }
}
/** 색칠 붓 굵기 범위 (캔버스 픽셀). 작은 곳은 아주 가늘게, 넓은 곳은 굵게 칠한다 (0이면 아무것도 칠해지지 않아 1부터) */
export const PAINT_MIN_SIZE = 1;
export const PAINT_MAX_SIZE = 120;

/** 고른 브러쉬: 펜(따라 그리기 선), 색칠 붓(단색), 또는 특수 브러쉬 무늬 이름 (DB special_brushes.slug) */
export type BrushChoice = "pen" | "color" | (string & {});

/** 펜 색 (검정 고정) */
const INK_COLOR = "#363636";
/** 선 끝 얇게 조절 바 1칸 = 캔버스 3픽셀 (최대 300픽셀에 걸쳐 가늘어짐) */
const FADE_PX_PER_STEP = 3;
export const MIN_SIZE = 2;
/** 브러쉬 최대 굵기 */
export const BRUSH_MAX_SIZE = 6;
/** 지우개 최대 굵기 */
const ERASER_MAX_SIZE = 48;
const SIZE_STEP = 2;

/**
 * 그리기 상태와 동작을 한데 묶은 훅. 키보드 단축키도 여기서 등록한다.
 * maxBrushSize: 브러쉬 최대 굵기를 BRUSH_MAX_SIZE보다 더 낮출 때 (장면의 흰 선이 아주 가늘 때, scenes.ts). 지우개에는 적용하지 않는다.
 * brushScale: 실제로 그려지는 굵기 = 굵기 설정 × brushScale (밑그림의 흰 선 두께에 맞춘다, scenes.ts). 화면에 보이는 굵기 숫자는 그대로다.
 * fade: false면 선 끝 얇게를 쓰지 않는다 (따라 그리기: 선 끝이 뾰족하면 짧게 끊어 그린 털선이 서로 안 겹쳐 감점을 피해 간다).
 *       저장된 선 끝 얇게 값은 그대로 두므로 캐릭터 그리기에서는 계속 쓴다.
 * paintable: 색칠 붓·특수 브러쉬를 쓸 수 있는 화면인지 (밑그림을 구역으로 나눈 스토리·도감 그리기)
 */
export function useDrawingTools(
  canvasRef: RefObject<TracingCanvasHandle | null>,
  {
    maxBrushSize = BRUSH_MAX_SIZE,
    fade: fadeEnabled = true,
    brushScale = 1,
    paintable = false,
  }: { maxBrushSize?: number; fade?: boolean; brushScale?: number; paintable?: boolean } = {},
) {
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  // 굵기는 그림을 바꿔도 이어지도록 저장해 둔다 (lib/userSettings).
  const [rawSize, setRawSize] = useSavedSetting("brushSize");
  const [smoothing, setSmoothing] = useSavedSetting("smoothing");
  const [fade, setFade] = useSavedSetting("fade");
  const [savedShortcuts] = useSavedSetting("shortcuts");
  const keys = useMemo(() => resolveShortcuts(savedShortcuts), [savedShortcuts]);
  // 상점에서 산 붓을 쥐고 돌아왔으면(?brush=<slug>, ShopPage) 그 특수 브러쉬로 시작한다
  const [boughtBrush] = useState(() => {
    const slug = paintable && queryParam("resume") === "1" ? queryParam("brush") : null;
    return slug && hasPattern(slug) ? slug : null;
  });
  const [tool, setToolState] = useState<Tool>(boughtBrush ? "special" : "pen");
  /** 지우개·스포이드에서 브러쉬 단축키로 돌아갈 도구 */
  const [lastDrawTool, setLastDrawTool] = useState<Tool>(boughtBrush ? "special" : "pen");
  /** 특수 브러쉬에서 고른 무늬 (DB special_brushes.slug). 아직 안 골랐으면 null */
  const [special, setSpecial] = useState<string | null>(boughtBrush);
  const [paintColor, setPaintColor] = useState(BASIC_COLORS[4].color);
  const [recentColors, setRecentColors] = useState<string[]>(loadRecent);
  // 색칠 붓 굵기는 펜과 범위가 달라 따로 둔다 (DB 설정에는 저장하지 않는다)
  const [paintSize, setPaintSize] = useState(40);

  const erase = tool === "eraser";
  /** 지금 고른 브러쉬 (펜, 색칠 붓, 특수 브러쉬 무늬) */
  const brush: BrushChoice = !paintable || tool === "pen" ? "pen" : tool === "special" ? (special ?? "color") : "color";
  /** 지금 붓으로 색칠 중인지 (굵기가 색칠 붓 범위를 따른다). 스포이드는 고른 색을 브러쉬로 바로 쓰므로 브러쉬와 같이 본다 */
  const painting = paintable && (tool === "brush" || tool === "special" || tool === "picker");

  const setTool = useCallback(
    (next: Tool) => {
      if (!paintable && next !== "pen" && next !== "eraser") return;
      setToolState(next);
      if (next !== "eraser" && next !== "picker") setLastDrawTool(next);
    },
    [paintable],
  );
  /** 특수 브러쉬 무늬를 고르면 특수 브러쉬 도구로 바꾼다 */
  const pickSpecial = useCallback(
    (slug: string) => {
      setSpecial(slug);
      setTool("special");
    },
    [setTool],
  );
  /** 스포이드로 색을 고르면 그 색을 쥔 브러쉬로 바로 바꾼다 */
  const pickColorFromCanvas = useCallback((color: string) => {
    setPaintColor(color);
    setToolState("brush");
    setLastDrawTool("brush");
  }, []);

  // 브러쉬와 지우개가 굵기를 같이 쓰므로, 저장된 값은 두고 쓸 때만 상한으로 자른다. 색칠 붓은 따로 쓴다.
  const sizeMin = painting ? PAINT_MIN_SIZE : MIN_SIZE;
  const sizeMax = painting ? PAINT_MAX_SIZE : erase ? ERASER_MAX_SIZE : Math.min(BRUSH_MAX_SIZE, maxBrushSize);
  const size = painting ? paintSize : Math.min(rawSize, sizeMax);
  const setSize = useCallback(
    (v: number) => {
      const next = Math.max(sizeMin, Math.min(sizeMax, v));
      if (painting) setPaintSize(next);
      else setRawSize(next);
    },
    [sizeMin, sizeMax, painting],
  );

  /** 펜 선이나 색이 하나라도 보이는지 (전체 지우기·저장) */
  const hasDrawing = visibleActions(actions).length > 0;

  const paintBrush: PaintBrush | null =
    paintable && tool === "fill"
      ? { pattern: null, color: paintColor, size: 0, fill: true }
      : painting && brush !== "pen"
        ? { pattern: brush === "color" ? null : brush, color: paintColor, size: paintSize }
        : null;

  const addStroke = useCallback((stroke: Stroke | PaintStroke) => {
    setActions((prev) => [...prev, stroke]);
    setRedoStack([]);
    // 칠한 색을 방금 쓴 색 맨 앞에 둔다
    if (stroke.type === "paint") {
      setRecentColors((prev) => {
        if (prev[0] === stroke.color) return prev;
        const next = [stroke.color, ...prev.filter((c) => c !== stroke.color)].slice(0, RECENT_MAX);
        saveRecent(next);
        return next;
      });
    }
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

  // 단축키. 한글 입력 상태에서도 동작하도록 e.key 대신 물리 키(e.code)로 판단한다 (lib/drawing/shortcuts.ts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || (target instanceof HTMLInputElement && !["range", "checkbox"].includes(target.type))) return;

      const action = actionForEvent(e, keys);
      if (!action) return;
      e.preventDefault(); // 브라우저 확대(Ctrl + +) 대신 캔버스 확대 등
      if (action === "brush") setTool(lastDrawTool);
      else if (action === "eraser") setTool("eraser");
      else if (action === "sizeDown") setSize(size - SIZE_STEP);
      else if (action === "sizeUp") setSize(size + SIZE_STEP);
      else if (action === "undo") undo();
      else if (action === "redo") redo();
      else if (action === "zoomIn") canvasRef.current?.zoomIn();
      else if (action === "zoomOut") canvasRef.current?.zoomOut();
      else if (action === "zoomReset") canvasRef.current?.resetZoom();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, undo, redo, canvasRef, size, setSize, setTool, lastDrawTool]);

  return {
    size,
    sizeMin,
    sizeMax,
    erase,
    paintable,
    painting,
    tool,
    setTool,
    brush,
    special,
    pickSpecial,
    paintColor,
    setPaintColor,
    recentColors,
    smoothing,
    fade,
    fadeEnabled,
    hasDrawing,
    /** 지금 쓰는 단축키 (동작별 키 조합) */
    keys,
    setSize,
    setSmoothing,
    setFade,
    undo,
    redo,
    clearAll,
    replaceActions,
    /** TracingCanvas에 그대로 넘기는 값 */
    canvasProps: {
      color: INK_COLOR,
      size: size * brushScale,
      erase,
      smoothing: smoothing / 100,
      fade: fadeEnabled ? fade * FADE_PX_PER_STEP : 0,
      actions,
      onStrokeEnd: addStroke,
      paintBrush,
      picking: tool === "picker",
      onPick: pickColorFromCanvas,
      idle: tool === "special" && !special,
    },
  };
}

export type DrawingTools = ReturnType<typeof useDrawingTools>;
