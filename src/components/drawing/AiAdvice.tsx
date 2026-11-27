// "? AI 조언": 아이가 그린 그림을 서버(/api/ai/advice)로 보내 코덱스가 짧게 조언한다 (잘한 점 · 해 볼 것 · 색 팁).
// 그림판 오른쪽 위 바깥, 접힌 코덱스 도움말 버튼 위에 놓인다 (DrawingShell 의 canvasExtra).
// 음란하거나 잔인한 그림은 서버가 거르고 "좀 더 건전한 내용으로 그려보아요."만 돌려준다 (셀은 빠지지 않는다).
// 보내는 그림은 512px JPEG 로 줄인다 (조언에는 충분하고 빠르다). 서버는 그림을 저장하지 않는다.
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, ApiError, type AiAdvice } from "../../lib/api";
import CellIcon from "../CellIcon";
import { CanvasControlsSlot } from "./canvasSlots";

const SEND_SIZE = 512;
/** 흰색이 아닌 칸이 이 비율보다 적으면 빈 도화지로 본다 (지우개로 다 지운 경우도 포함) */
const MIN_INK = 0.003;
/** 빈 도화지일 때 코덱스가 하는 말 (서버에 묻지 않고, 셀도 쓰지 않는다) */
const EMPTY_LINES = ["🖍️ 아직 빈 도화지예요!", "✏️ 무엇이든 하나 그려 보고, 다시 'AI 조언'을 눌러 보세요.", "🪄 그림을 보고 잘한 점과 더 해 볼 것을 알려 줄게요."];

/**
 * 그림(data URL)을 SEND_SIZE 안으로 줄인 JPEG data URL 로 만들고, 얼마나 칠해졌는지(흰색이 아닌 칸의 비율)도 잰다.
 */
function shrink(url: string): Promise<{ image: string; ink: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, SEND_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let inked = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) inked++;
      resolve({ image: canvas.toDataURL("image/jpeg", 0.85), ink: inked / (canvas.width * canvas.height) });
    };
    img.onerror = () => reject(new Error("그림을 읽지 못했어요."));
    img.src = url;
  });
}

type View = { kind: "loading" } | { kind: "empty" } | { kind: "advice"; advice: AiAdvice } | { kind: "blocked"; text: string } | { kind: "error"; text: string };

export function AiAdviceButton({
  getImage,
  title,
  strokes,
}: {
  /** 지금 그림 (밑그림 없이, 흰 바탕 PNG data URL) */
  getImage: () => string | null;
  /** 캐릭터 이름 (무엇을 그렸는지 힌트) */
  title: string;
  /** 지금까지 그린 획 수 (0 이면 그림을 읽지 않고 바로 빈 도화지 안내) */
  strokes: number;
}) {
  const slot = useContext(CanvasControlsSlot);
  const wide = (slot?.layout ?? "wide") === "wide";
  const [view, setView] = useState<View | null>(null);
  const [wallet, setWallet] = useState<{ cost: number; cells: number } | null>(null);
  const loadWallet = useCallback(() => {
    api.aiAdviceInfo().then(setWallet, () => {});
  }, []);
  useEffect(loadWallet, [loadWallet]);
  // 조언 말풍선이 떠 있는 동안 코덱스 도움말을 잠근다 (두 말풍선이 같은 자리에 겹친다)
  const lockCoach = slot?.lockCoach;
  const open = view !== null;
  useEffect(() => {
    lockCoach?.(open);
    return () => lockCoach?.(false);
  }, [lockCoach, open]);

  const loading = view?.kind === "loading";
  const short = wallet !== null && wallet.cells < wallet.cost;
  // 빈 도화지여도 누를 수 있다: 서버에 묻지 않고 "먼저 그려 보세요" 안내만 (셀을 쓰지 않는다)
  const disabled = loading || short;
  const hint = short ? `셀이 부족해요 (필요 ${wallet?.cost}셀)` : `AI 조언${wallet ? ` · ${wallet.cost}셀` : ""}`;

  const ask = async () => {
    if (disabled) return;
    const full = strokes > 0 ? getImage() : null;
    if (!full) {
      setView({ kind: "empty" });
      return;
    }
    setView({ kind: "loading" });
    try {
      const { image, ink } = await shrink(full);
      // 다 지웠거나 점 몇 개뿐이면 빈 도화지로 본다
      if (ink < MIN_INK) {
        setView({ kind: "empty" });
        return;
      }
      const { advice, cells, cost } = await api.aiAdvice(image, title.trim());
      setWallet({ cells, cost });
      setView({ kind: "advice", advice });
    } catch (err) {
      const text = err instanceof Error ? err.message : "조언을 받지 못했어요.";
      setView(err instanceof ApiError && err.code === "blocked" ? { kind: "blocked", text } : { kind: "error", text });
      // 실패하면 서버가 셀을 돌려주므로 남은 셀을 다시 받는다
      loadWallet();
    }
  };

  /** 동그란 "?" 표시 (물어보는 버튼이라는 걸 바로 알 수 있게) */
  const mark = (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-base font-black leading-none text-white shadow-inner"
      aria-hidden="true"
    >
      {loading ? "…" : "?"}
    </span>
  );
  const button = wide ? (
    <button
      type="button"
      onClick={() => void ask()}
      disabled={disabled}
      title={hint}
      className="flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-100 bg-white pl-1.5 pr-3 text-xs font-black text-blue-700 shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:border-blue-300 disabled:opacity-50"
    >
      {mark}
      {loading ? "보는 중…" : "AI 조언"}
      <CellIcon title="셀 사용" />
      {wallet && <span className="text-ink-muted">{wallet.cost}</span>}
    </button>
  ) : (
    // 빈자리가 좁을 때: "?" 아래에 짧은 이름과 셀을 붙인 세로 버튼
    <button
      type="button"
      onClick={() => void ask()}
      disabled={disabled}
      title={hint}
      aria-label={hint}
      className="flex w-12 flex-col items-center gap-0.5 rounded-2xl border border-blue-100 bg-white py-1.5 shadow-lg transition enabled:hover:-translate-y-0.5 enabled:hover:border-blue-300 disabled:opacity-50"
    >
      {mark}
      <span className="text-[10px] font-black leading-tight text-blue-700">{loading ? "보는 중" : "AI 조언"}</span>
      <span className="flex items-center gap-0.5 text-[9px] font-bold leading-none text-ink-muted">
        <CellIcon />
        {wallet?.cost ?? ""}
      </span>
    </button>
  );

  return (
    <>
      <div className="relative z-20">{button}</div>
      {view && createPortal(<AdviceBubble view={view} onClose={() => setView(null)} onRetry={() => void ask()} />, document.body)}
    </>
  );
}

/** 한 글자씩 나오는 간격 (ms)과 줄이 바뀔 때 쉬는 시간 */
const TYPE_MS = 45;
const LINE_PAUSE_MS = 280;

/** 글자 단위로 자른다 (이모지·한글을 반으로 자르지 않게) */
type GraphemeSegmenter = new (locale: string, options: { granularity: "grapheme" }) => { segment: (text: string) => Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenter }).Segmenter;
const splitChars = (text: string) =>
  Segmenter ? Array.from(new Segmenter("ko", { granularity: "grapheme" }).segment(text), (part) => part.segment) : Array.from(text);

/**
 * 타자기 효과: 줄들을 앞에서부터 한 글자씩 보여 준다. 줄이 끝나면 잠깐 쉬고 다음 줄로.
 * 움직임 줄이기 설정(prefers-reduced-motion)이면 바로 다 보여 준다. skip() 을 부르면 즉시 끝까지.
 * 돌려주는 값: 줄마다 지금 보이는 글자 수, 다 나왔는지
 */
function useTypewriter(lines: string[]) {
  const chars = useMemo(() => lines.map(splitChars), [lines]);
  const total = chars.reduce((sum, line) => sum + line.length, 0);
  const [count, setCount] = useState(0);
  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  // 새 글이 오면 처음부터
  useEffect(() => setCount(reduce ? total : 0), [chars, total, reduce]);

  useEffect(() => {
    if (count >= total) return;
    // 지금 글자가 한 줄의 끝이면 조금 더 쉰다
    let end = 0;
    const atLineEnd = chars.some((line) => ((end += line.length), count === end && line.length > 0));
    const id = window.setTimeout(() => setCount((c) => Math.min(total, c + 1)), atLineEnd ? LINE_PAUSE_MS : TYPE_MS);
    return () => window.clearTimeout(id);
  }, [count, total, chars]);

  let left = count;
  const shown = chars.map((line) => {
    const n = Math.max(0, Math.min(line.length, left));
    left -= line.length;
    return line.slice(0, n).join("");
  });
  return { shown, done: count >= total, skip: () => setCount(total) };
}

/** 깜빡이는 글자 끝 표시 (타자 치는 중) */
const Caret = () => <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-sky-200" aria-hidden="true" />;

/** 코덱스 말풍선 (도움말 안내와 같은 모양, 화면 아래 가운데). 글은 대화하듯 한 글자씩 나온다 (누르면 바로 다 나온다) */
function AdviceBubble({ view, onClose, onRetry }: { view: View; onClose: () => void; onRetry: () => void }) {
  const lines = useMemo(() => {
    if (view.kind === "advice") return [`🌟 ${view.advice.praise}`, `✏️ ${view.advice.tip}`, ...(view.advice.color ? [`🎨 ${view.advice.color}`] : [])];
    if (view.kind === "empty") return EMPTY_LINES;
    if (view.kind === "blocked" || view.kind === "error") return [view.text];
    return [];
  }, [view]);
  const { shown, done, skip } = useTypewriter(lines);
  // 지금 치고 있는 줄 (글자 끝 표시를 붙일 줄)
  const typingLine = done ? -1 : shown.findIndex((text, i) => text.length < splitChars(lines[i]).length);

  /** 타자로 나오는 줄: 화면 읽기 프로그램에는 한 번에 다 읽히게 (글자마다 읽지 않게) */
  const typed = (i: number) => (
    <>
      <span aria-hidden="true">
        {shown[i]}
        {i === typingLine && <Caret />}
      </span>
      <span className="sr-only">{lines[i]}</span>
    </>
  );

  return (
    <section
      aria-label="코덱스의 조언"
      aria-live="polite"
      onClick={done ? undefined : skip}
      className="fixed bottom-4 left-1/2 z-40 h-48 w-[min(820px,calc(100%-1.5rem))] -translate-x-1/2 drop-shadow-2xl sm:h-56"
    >
      <div className="absolute inset-x-0 bottom-0 ml-24 flex min-h-36 flex-col justify-center overflow-hidden rounded-[1.75rem] border-2 border-white/20 bg-[linear-gradient(125deg,rgba(20,38,64,.96),rgba(32,78,125,.94))] py-4 pl-20 pr-5 text-white backdrop-blur-md sm:ml-36 sm:min-h-44 sm:pl-28 sm:pr-7">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#66b5ff,#8ce2d0,#fee36e)]" />
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">Art advice · CODEX</p>
          {view.kind !== "loading" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-full px-1.5 text-xl font-bold text-white/55 hover:text-white"
              aria-label="조언 닫기"
            >
              ×
            </button>
          )}
        </div>
        {view.kind === "loading" && <p className="mt-2 animate-pulse text-base font-black">그림을 꼼꼼히 보고 있어요…</p>}
        {(view.kind === "advice" || view.kind === "empty") && (
          // 아직 차례가 안 온 줄도 자리를 잡아 두어 말풍선 높이가 출렁이지 않게 한다
          <ul className="mt-1.5 space-y-1.5 text-sm font-semibold leading-snug sm:text-[15px]">
            {lines.map((_, i) => (
              <li key={i} className="min-h-[1.375em]">
                {typed(i)}
              </li>
            ))}
          </ul>
        )}
        {view.kind === "blocked" && <p className="mt-2 min-h-[1.5em] text-base font-black">{typed(0)}</p>}
        {view.kind === "error" && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm font-semibold text-white/85">{typed(0)}</p>
            {done && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-blue-700"
              >
                다시 물어보기
              </button>
            )}
          </div>
        )}
        {!done && view.kind !== "loading" && <p className="mt-2 text-right text-[10px] font-bold text-white/40">눌러서 바로 보기</p>}
      </div>
      <img
        src="/assets/dorobus/drawing/codex-pose.png"
        alt="조언해 주는 코덱스"
        className="pointer-events-none absolute bottom-0 left-0 z-10 h-full w-40 object-contain drop-shadow-xl sm:w-60"
      />
    </section>
  );
}
