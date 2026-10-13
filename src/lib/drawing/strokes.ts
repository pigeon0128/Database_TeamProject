// 획과 도형 데이터: 그림판(TracingCanvas), 채점(traceScore), 저장(api, drawingDraft)이 함께 쓰는 공통 타입과 계산.
// 화면 부품에 기대지 않는 순수한 데이터라서, 로직 모듈(lib/)이 화면 파일(components/)을 가져오지 않아도 된다.

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

/** 그림판에 쌓이는 동작: 획 하나, 또는 "전체 지우기" */
export type DrawAction = Stroke | { type: "clear" };

/** 마지막 "전체 지우기" 이후의 획 (지금 그림판에 보이는 획) */
export function visibleStrokes(actions: DrawAction[]): Stroke[] {
  const lastClear = actions.map((a) => a.type).lastIndexOf("clear");
  return actions.slice(lastClear + 1) as Stroke[];
}

/** 페이드 끝부분의 최소 굵기 비율 */
const FADE_MIN = 0.12;

/**
 * 획의 시작에서 d만큼 떨어진 곳의 굵기 비율.
 * 시작과 끝에서 fade 길이 안쪽은 점점 가늘어진다. 그리는 중에는 끝을 모르므로 total = Infinity.
 */
export function taper(d: number, total: number, fade: number) {
  if (fade <= 0) return 1;
  const t = Math.min(1, Math.max(0, Math.min(d, total - d) / fade));
  return FADE_MIN + (1 - FADE_MIN) * t;
}

/** 밑그림 위의 사각형 영역 (채점에서 뺄 곳, 배경으로 바꿀 곳 등) */
export type Rect = { x: number; y: number; w: number; h: number };

export const inRects = (x: number, y: number, rects: Rect[]) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
