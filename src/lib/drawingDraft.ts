// 이어서 그리기: 그리던 그림(획 목록)을 DB(drawing_drafts 표, API의 /api/drafts)에 저장해 두고,
// 같은 그림을 다시 열면(다른 기기에서도) 이어서 그릴지 새로 그릴지 고를 수 있게 한다.
// 그림마다 따로 저장한다 (스토리 장면은 "story:<장면 id>", 캐릭터는 "character").
import type { Stroke } from "../components/TracingCanvas";
import { api } from "./api";

export type Draft = {
  strokes: Stroke[];
  /** 마지막으로 저장한 시각 (ms) */
  savedAt: number;
  /** 캐릭터 이름 등 그림에 딸린 값 */
  name?: string;
};

/** 저장 용량을 줄이려고 좌표를 소수 첫째 자리까지만 남긴다 (화면에서는 차이가 없다). */
const round = (v: number) => Math.round(v * 10) / 10;

export const compactStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [round(x), round(y)]) }));

const isStroke = (s: unknown): s is Stroke =>
  !!s && typeof s === "object" && (s as Stroke).type === "stroke" && Array.isArray((s as Stroke).points) && (s as Stroke).points.length > 0;

/** 저장된 그림. 없거나 깨졌으면 null. 서버에 연결하지 못하면 예외를 던진다. */
export async function loadDraft(key: string): Promise<Draft | null> {
  const { draft } = await api.getDraft(key);
  if (!draft || !draft.strokes.length || !draft.strokes.every(isStroke)) return null;
  return { strokes: draft.strokes, savedAt: new Date(draft.savedAt).getTime(), name: draft.name ?? undefined };
}

/** 그리던 그림이 있는 그림 이름들 (장면 고르기 화면의 "이어 그리기" 표시) */
export async function draftKeys(): Promise<Set<string>> {
  const { drafts } = await api.drafts();
  return new Set(drafts.filter((d) => d.strokeCount > 0).map((d) => d.key));
}
