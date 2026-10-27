// 이어서 그리기: 그리던 그림(획 목록)을 DB(drawing_drafts 표, API의 /api/drafts)에 저장해 두고,
// 같은 그림을 다시 열면(다른 기기에서도) 이어서 그릴지 새로 그릴지 고를 수 있게 한다.
// 그림마다 따로 저장한다 (스토리 장면은 "story:<장면 id>", 캐릭터는 "character". 서버 server/routes/drafts.js 의 키 규칙과 맞춘다).
// - loadDraft, draftKeys: 불러오기 / 그리던 그림 목록
// - useDrawingDraft: 그리기 화면에서 자동 저장·이어 그리기를 맡는 훅
import { useCallback, useEffect, useRef, useState } from "react";
import { visibleActions, type DrawAction, type PaintStroke, type Stroke } from "./drawing/strokes";
import { api } from "./api";

export type Draft = {
  /** 펜 획과 색칠 획 (그린 순서대로) */
  strokes: (Stroke | PaintStroke)[];
  /** 마지막으로 저장한 시각 (ms) */
  savedAt: number;
  /** 캐릭터 이름 등 그림에 딸린 값 */
  name?: string;
};

/** 저장 용량을 줄이려고 좌표를 소수 첫째 자리까지만 남긴다 (화면에서는 차이가 없다). */
const round = (v: number) => Math.round(v * 10) / 10;

const compactStrokes = (strokes: (Stroke | PaintStroke)[]): (Stroke | PaintStroke)[] =>
  strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [round(x), round(y)]) }));

/** 펜 획(stroke)이나 색칠 획(paint) */
const isStroke = (s: unknown): s is Stroke | PaintStroke =>
  !!s &&
  typeof s === "object" &&
  ["stroke", "paint"].includes((s as Stroke).type) &&
  Array.isArray((s as Stroke).points) &&
  (s as Stroke).points.length > 0;

/** 저장된 그림. 없거나 깨졌으면 null. 서버에 연결하지 못하면 예외를 던진다. */
async function loadDraft(key: string): Promise<Draft | null> {
  const { draft } = await api.getDraft(key);
  if (!draft || !draft.strokes.length || !draft.strokes.every(isStroke)) return null;
  return { strokes: draft.strokes, savedAt: new Date(draft.savedAt).getTime(), name: draft.name ?? undefined };
}

/** 그리던 그림이 있는 그림 이름들 (장면 고르기 화면의 "이어 그리기" 표시) */
export async function draftKeys(): Promise<Set<string>> {
  const { drafts } = await api.drafts();
  return new Set(drafts.filter((d) => d.strokeCount > 0).map((d) => d.key));
}

/** 그림이 바뀐 뒤 이만큼 기다렸다가 DB에 저장한다 (획을 연달아 그을 때 요청이 몰리지 않게) */
const DRAFT_SAVE_DELAY_MS = 1000;
/** 불러오기에 실패하면 이만큼 기다렸다가 다시 시도한다 (ms). 마지막 값으로 계속 시도한다 */
const DRAFT_LOAD_RETRY_DELAYS = [1000, 3000, 7000, 15000, 30000];
/** 창을 닫는 중에 보내는 요청(keepalive)은 본문이 64KB를 넘으면 브라우저가 거절하므로, 이보다 작을 때만 keepalive로 보낸다 */
const KEEPALIVE_MAX_CHARS = 60000;

/**
 * 이어서 그리기. key마다(그림마다) 그리던 획을 DB에 저장해 둔다.
 *  - 처음 열 때 DB에서 그리던 그림을 불러오고, 있으면 pending에 담아 ResumeDialog로 이어 그릴지 묻는다.
 *  - 불러오기 전이나 고르기 전에는 저장하지 않는다 (빈 그림으로 DB의 그림을 덮어쓰지 않게).
 *    불러오기에 실패하면 간격을 늘려 가며 다시 시도한다.
 *  - 그림이 바뀌면 1초 뒤에 저장하고, 화면을 나가거나 창을 닫을 때도 바로 저장한다. 다 지우면 저장된 그림도 지운다.
 *    바뀐 것이 없으면 다시 보내지 않는다.
 *  - finish(): 다 그린 그림(기록으로 저장함)은 저장된 그림을 지우고 더는 저장하지 않는다.
 * drawing: 지금 그림의 획 목록과, 저장된 그림으로 바꿀 때 쓰는 함수 (useDrawingTools 에서 받는다)
 * name: 캐릭터 이름처럼 그림과 같이 저장할 값
 */
export function useDrawingDraft(
  key: string,
  drawing: { actions: DrawAction[]; replaceActions: (next: DrawAction[]) => void },
  name?: string,
) {
  const [pending, setPending] = useState<Draft | null>(null);
  /** DB에서 불러오기를 마쳤는지 (마치기 전에는 저장하지 않는다) */
  const [loaded, setLoaded] = useState(false);
  const { actions, replaceActions } = drawing;
  const latest = useRef({ actions, name, pending, loaded });
  latest.current = { actions, name, pending, loaded };
  const finished = useRef(false);
  /** 마지막으로 DB에 보낸 내용 ("": DB에 없음). 같으면 다시 보내지 않는다 */
  const lastSent = useRef("");

  useEffect(() => {
    let alive = true;
    (async () => {
      for (let attempt = 0; alive; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, DRAFT_LOAD_RETRY_DELAYS[Math.min(attempt, DRAFT_LOAD_RETRY_DELAYS.length) - 1]));
        if (!alive) return;
        try {
          const draft = await loadDraft(key);
          if (!alive) return;
          if (draft) {
            lastSent.current = JSON.stringify({ strokes: draft.strokes, name: draft.name ?? null });
            setPending(draft);
          }
          setLoaded(true);
          return;
        } catch {
          // 서버에 연결하지 못하면 잠시 뒤 다시 시도한다. 그동안 그린 것은 불러온 뒤에 저장된다.
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  const flush = useCallback(
    ({ keepalive = false } = {}) => {
      const { actions, name, pending, loaded } = latest.current;
      if (!loaded || pending || finished.current) return;
      const strokes = compactStrokes(visibleActions(actions));
      const body = strokes.length ? JSON.stringify({ strokes, name: name ?? null }) : "";
      if (body === lastSent.current) return;
      const previous = lastSent.current;
      lastSent.current = body;
      const request = strokes.length
        ? api.saveDraft(key, strokes, name, { keepalive: keepalive && body.length < KEEPALIVE_MAX_CHARS })
        : api.deleteDraft(key);
      // 실패하면 다음에 다시 보내도록 되돌린다.
      request.catch(() => {
        if (lastSent.current === body) lastSent.current = previous;
      });
    },
    [key],
  );

  useEffect(() => {
    if (!loaded || pending) return;
    const t = setTimeout(flush, DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [loaded, pending, actions, name, flush]);

  useEffect(() => {
    const onHide = () => flush({ keepalive: true });
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush();
    };
  }, [flush]);

  /** 저장된 그림을 불러온다. 같이 저장한 값(이름 등)을 돌려준다. */
  const resume = useCallback(() => {
    if (!pending) return undefined;
    replaceActions(pending.strokes);
    setPending(null);
    return pending.name;
  }, [pending, replaceActions]);

  const startNew = useCallback(() => {
    lastSent.current = "";
    api.deleteDraft(key).catch(() => {});
    setPending(null);
  }, [key]);

  const finish = useCallback(() => {
    finished.current = true;
    lastSent.current = "";
    api.deleteDraft(key).catch(() => {});
  }, [key]);

  return { pending, resume, startNew, finish };
}
