// 그리기 상태 훅 (스토리 장면, 캐릭터 그리기 공용): 굵기·지우개·획 목록·되돌리기 상태를 관리하고 키보드 단축키를 등록한다.
// 단축키는 사용자가 설정 화면에서 바꾼 키를 쓴다 (lib/drawing/shortcuts.ts, 저장은 lib/userSettings).
// 펜(따라 그리기 선)은 검정 하나만 쓴다. 굵기·손떨림 보정·선 끝 얇게는 저장해 두고 다음에도 이어 쓴다 (lib/userSettings).
// 밑그림을 구역으로 나눈 화면(paintable)에서는 색칠 붓과 특수 브러쉬도 고를 수 있다 (색칠은 채점하지 않는다).
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import { actionForEvent, resolveShortcuts } from "../../lib/drawing/shortcuts";
import { visibleActions, type DrawAction, type PaintStroke, type Stroke } from "../../lib/drawing/strokes";
import { useSavedSetting } from "../../lib/userSettings";
import type { PaintBrush, TracingCanvasHandle } from "../TracingCanvas";

/** 일반 색칠 붓의 색. 누구나 쓰는 색 값이라 DB에 두지 않는다 */
export const BASIC_COLORS = [
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
  const [erase, setErase] = useState(false);
  const [brush, setBrushState] = useState<BrushChoice>("pen");
  const [paintColor, setPaintColor] = useState(BASIC_COLORS[0].color);
  // 색칠 붓 굵기는 펜과 범위가 달라 따로 둔다 (DB 설정에는 저장하지 않는다)
  const [paintSize, setPaintSize] = useState(40);
  /** 지금 색칠 중인지 (펜·지우개가 아님) */
  const painting = paintable && brush !== "pen" && !erase;

  /** 브러쉬를 고르면 지우개를 끈다 */
  const setBrush = useCallback((next: BrushChoice) => {
    setBrushState(next);
    setErase(false);
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

  const paintBrush: PaintBrush | null = painting ? { pattern: brush === "color" ? null : brush, color: paintColor, size: paintSize } : null;

  const addStroke = useCallback((stroke: Stroke | PaintStroke) => {
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

  // 단축키. 한글 입력 상태에서도 동작하도록 e.key 대신 물리 키(e.code)로 판단한다 (lib/drawing/shortcuts.ts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.isContentEditable || (target instanceof HTMLInputElement && !["range", "checkbox"].includes(target.type))) return;

      const action = actionForEvent(e, keys);
      if (!action) return;
      e.preventDefault(); // 브라우저 확대(Ctrl + +) 대신 캔버스 확대 등
      if (action === "brush") setErase(false);
      else if (action === "eraser") setErase(true);
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
  }, [keys, undo, redo, canvasRef, size, setSize]);

  return {
    size,
    sizeMin,
    sizeMax,
    erase,
    paintable,
    painting,
    brush,
    setBrush,
    paintColor,
    setPaintColor,
    smoothing,
    fade,
    fadeEnabled,
    hasDrawing,
    /** 지금 쓰는 단축키 (동작별 키 조합) */
    keys,
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
      size: size * brushScale,
      erase,
      smoothing: smoothing / 100,
      fade: fadeEnabled ? fade * FADE_PX_PER_STEP : 0,
      actions,
      onStrokeEnd: addStroke,
      paintBrush,
    },
  };
}

export type DrawingTools = ReturnType<typeof useDrawingTools>;
