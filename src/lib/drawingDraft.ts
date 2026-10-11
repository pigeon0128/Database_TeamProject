// 이어서 그리기: 그리던 그림(획 목록)을 브라우저(localStorage)에 저장해 두고,
// 같은 그림을 다시 열면 이어서 그릴지 새로 그릴지 고를 수 있게 한다.
// 그림마다 따로 저장한다 (스토리 장면은 "story:<장면 id>", 캐릭터는 "character").
import type { Stroke } from "../components/TracingCanvas";

export type Draft = {
  strokes: Stroke[];
  /** 마지막으로 저장한 시각 (ms) */
  savedAt: number;
  /** 캐릭터 이름 등 그림에 딸린 값 */
  name?: string;
};

const PREFIX = "doroland.draft.";

/** 저장 용량을 줄이려고 좌표를 소수 첫째 자리까지만 남긴다 (화면에서는 차이가 없다). */
const round = (v: number) => Math.round(v * 10) / 10;

const isStroke = (s: unknown): s is Stroke =>
  !!s && typeof s === "object" && (s as Stroke).type === "stroke" && Array.isArray((s as Stroke).points) && (s as Stroke).points.length > 0;

export function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (!Array.isArray(draft.strokes) || !draft.strokes.length || !draft.strokes.every(isStroke)) return null;
    return draft;
  } catch {
    return null;
  }
}

export const hasDraft = (key: string) => loadDraft(key) !== null;

/** 저장에 실패하면(저장 공간 부족 등) false */
export function saveDraft(key: string, strokes: Stroke[], name?: string) {
  const draft: Draft = {
    strokes: strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [round(x), round(y)]) })),
    savedAt: Date.now(),
    name,
  };
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // 지우지 못해도 다음에 이어 그리기를 고르는 창이 한 번 더 뜰 뿐이다.
  }
}
