// 툴바의 "AI 밑그림" 메뉴: 그리고 싶은 것을 글로 적으면 서버(/api/ai/sketch)가 OpenAI로 밑그림을 만들어 온다.
// 받은 그림은 도감 밑그림과 같은 형식(회색 바탕 + 흰 선)으로 맞추고, 흰 선으로 색칠 구역을 나눈다 (lib/drawing/aiGuide.ts).
// 보이기/숨기기·진하기·지우기를 여기서 고른다. 저장하는 PNG에는 밑그림이 들어가지 않는다.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { makeAiGuide } from "../../lib/drawing/aiGuide";
import type { Regions } from "../../lib/drawing/regions";
import CellIcon from "../CellIcon";
import { ToolbarMenu } from "../toolbar";

export type AiSketchState = {
  /** 도감 형식으로 맞춘 밑그림 */
  image: string | null;
  /** 밑그림의 흰 선으로 나눈 색칠 구역 */
  regions: Regions | null;
  visible: boolean;
  opacity: number;
};

/** 진하기 기본값은 도감 그리기의 기본 밑그림 진하기(80%)와 같다 */
export const EMPTY_SKETCH: AiSketchState = { image: null, regions: null, visible: true, opacity: 0.8 };

/** 브라우저 탭에 밑그림을 보관하는 이름 (상점에 다녀오거나 새로 고침해도 남게) */
const STORAGE_KEY = "aiSketch:character";

/**
 * AI 밑그림 상태. 브라우저 탭(sessionStorage)에 보관해서, 특수 브러쉬를 사러 상점에 다녀오거나 새로 고침해도 그대로 돌아온다.
 * 색칠 구역은 보관한 밑그림으로 다시 나눈다. 탭을 닫으면 사라진다 (그리던 획은 DB에 따로 저장된다, lib/drawingDraft.ts).
 */
export function useAiSketch(width: number, height: number) {
  const [sketch, setSketchState] = useState<AiSketchState>(EMPTY_SKETCH);

  // 처음 열 때 보관한 밑그림을 되살린다
  useEffect(() => {
    let alive = true;
    let saved: { image: string; visible: boolean; opacity: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    } catch {
      saved = null;
    }
    if (!saved?.image) return;
    const { image, visible, opacity } = saved;
    makeAiGuide(image, width, height).then(
      (guide) => alive && setSketchState({ image: guide.url, regions: guide.regions, visible, opacity }),
      () => sessionStorage.removeItem(STORAGE_KEY),
    );
    return () => {
      alive = false;
    };
  }, [width, height]);

  const setSketch = useCallback((next: AiSketchState) => {
    setSketchState(next);
    try {
      if (next.image) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ image: next.image, visible: next.visible, opacity: next.opacity }));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 보관할 자리가 없으면 이 화면에서만 쓴다
    }
  }, []);

  return [sketch, setSketch] as const;
}

const EXAMPLES = ["모자 쓴 고양이", "우주복 입은 강아지", "꽃을 든 공룡"];

export function AiSketchMenu({
  sketch,
  onChange,
  width,
  height,
  autoOpen = false,
}: {
  sketch: AiSketchState;
  onChange: (next: AiSketchState) => void;
  /** 그림판 크기 (밑그림을 이 크기로 맞춘다) */
  width: number;
  height: number;
  /** true 가 되면 메뉴를 펼친다 (도감 고르기 화면의 "직접 만들어보세요"에서 왔을 때) */
  autoOpen?: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** 밑그림 한 장의 가격과 내 셀 (서버 GET /api/ai/sketch). 못 불러오면 null */
  const [wallet, setWallet] = useState<{ cost: number; cells: number } | null>(null);
  const loadWallet = useCallback(() => {
    api.aiSketchInfo().then(setWallet, () => {});
  }, []);
  useEffect(loadWallet, [loadWallet]);
  const short = wallet !== null && wallet.cells < wallet.cost;

  const generate = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    try {
      const { image, cells, cost } = await api.aiSketch(text);
      setWallet({ cost, cells });
      const guide = await makeAiGuide(image, width, height);
      onChange({ ...sketch, image: guide.url, regions: guide.regions, visible: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "밑그림을 만들지 못했어요.");
      // 못 만들면 서버가 셀을 돌려주므로 남은 셀을 다시 받는다
      loadWallet();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolbarMenu title="글로 AI 밑그림 만들기" label={
        loading ? (
          "⏳ 만드는 중"
        ) : (
          // 셀 아이콘: 누르면(만들면) 셀이 든다는 표시
          <span className="inline-flex items-center gap-1">
            🪄 AI 밑그림 <CellIcon title="셀 사용" />
          </span>
        )
      } autoOpen={autoOpen} menuWidth="w-[23rem]">
      {() => (
        <div className="space-y-3">
          <h2 className="text-sm font-extrabold text-ink-muted">🪄 무엇을 그려 볼까요?</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void generate();
            }}
            className="space-y-2"
          >
            {/* 적은 설명이 잘리지 않고 다 보이게 여러 줄 칸 (Enter = 만들기, Shift+Enter = 줄 바꿈) */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void generate();
                }
              }}
              rows={3}
              placeholder="예: 모자 쓴 고양이"
              maxLength={200}
              aria-label="AI 밑그림 설명"
              disabled={loading}
              // 메뉴를 펼치면 바로 적을 수 있게
              autoFocus
              className="block w-full resize-none rounded-2xl bg-sky-soft px-4 py-2.5 text-sm font-bold leading-relaxed text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-sky-deep"
            />
            <button
              type="submit"
              disabled={loading || !prompt.trim() || short}
              className="h-10 w-full rounded-full bg-sky-deep px-4 text-sm font-extrabold text-white disabled:opacity-40"
            >
              {loading ? (
                "…"
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  만들기 <CellIcon /> {wallet ? `${wallet.cost}셀` : ""}
                </span>
              )}
            </button>
          </form>
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setPrompt(ex)} disabled={loading} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-ink-muted hover:bg-sky-soft">
                {ex}
              </button>
            ))}
          </div>
          {/* 셀 안내 한 줄: 가격과 내 셀 (모자라면 빨갛게) */}
          {wallet && (
            <p className={`whitespace-nowrap text-xs font-bold ${short ? "text-rose-600" : "text-ink-muted"}`}>
              <CellIcon /> {short ? `셀이 부족해요 · 내 셀 ${wallet.cells.toLocaleString()} / 필요 ${wallet.cost}` : `한 장에 ${wallet.cost}셀이 들어요 · 내 셀 ${wallet.cells.toLocaleString()}`}
            </p>
          )}
          {loading && <p className="text-xs font-semibold text-ink-muted">AI가 그리고 있어요. 20초~1분쯤 걸려요.</p>}
          {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">{error}</p>}

          {sketch.image && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <img src={sketch.image} alt="만든 AI 밑그림" className="mx-auto h-28 w-28 rounded-xl border border-slate-100 bg-white object-contain" />
              <label className="flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" checked={sketch.visible} onChange={(e) => onChange({ ...sketch, visible: e.target.checked })} />
                밑그림 보이기
              </label>
              <label className="block text-xs font-bold text-ink-muted">
                진하기 {Math.round(sketch.opacity * 100)}%
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={sketch.opacity}
                  onChange={(e) => onChange({ ...sketch, opacity: Number(e.target.value) })}
                  className="mt-1 w-full"
                />
              </label>
              <button type="button" onClick={() => onChange(EMPTY_SKETCH)} className="w-full rounded-xl px-3 py-2 text-sm font-bold text-rose-600 hover:bg-rose-50">
                🗑️ 밑그림 지우기
              </button>
            </div>
          )}
        </div>
      )}
    </ToolbarMenu>
  );
}
