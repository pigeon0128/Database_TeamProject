// 스토리 그리기 화면 아래의 점수 막대: 큰 점수, 타이머, 진행 막대, 세부 감점 항목, 완료 버튼.
import { formatClock } from "../../lib/format";
import type { TraceScore } from "../../lib/drawing/traceScore";

/** 점수 구간별 색과 응원 문구 (점수 막대, 저장 결과 창이 같이 쓴다) */
export function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500", label: "최고예요! 🎉" };
  if (score >= 50) return { text: "text-sky-deep", bar: "bg-sky-deep", label: "잘하고 있어요! 👍" };
  if (score >= 20) return { text: "text-amber-500", bar: "bg-amber-400", label: "조금만 더! ✏️" };
  return { text: "text-ink-muted", bar: "bg-ink-muted", label: "흰 선을 따라 그려 보세요" };
}

type ScoreBarProps = {
  result: TraceScore;
  ready: boolean;
  elapsedMs: number;
  timerRunning: boolean;
  onComplete: () => void;
  /** 완료할 수 없는 이유 (없으면 완료 가능) */
  blockedReason: string | null;
};

export function ScoreBar({ result, ready, elapsedMs, timerRunning, onComplete, blockedReason }: ScoreBarProps) {
  const tone = scoreTone(result.score);
  const item = "flex items-baseline gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-ink-muted";
  return (
    <>
      <div className="flex items-center gap-3" aria-live="polite">
        <span className="text-sm font-extrabold text-ink-muted">점수</span>
        <span className={`text-3xl font-black tabular-nums leading-none tracking-tight ${tone.text}`}>
          {result.score}
          <span className="ml-0.5 text-sm font-bold text-ink-muted">/100</span>
        </span>
        <span className="text-sm font-bold tabular-nums text-ink-muted" title="첫 획을 그을 때 시작해서 완료하면 멈춰요">
          ⏱ {formatClock(elapsedMs)}
          {!timerRunning && elapsedMs === 0 && <span className="ml-1 text-xs font-semibold">(첫 획부터)</span>}
        </span>
        <div className="w-28 sm:w-40">
          <div className="h-2.5 overflow-hidden rounded-full bg-sky-soft">
            <div className={`h-full rounded-full transition-[width] duration-300 ${tone.bar}`} style={{ width: `${result.score}%` }} />
          </div>
          <div className="mt-0.5 text-[11px] font-bold text-ink-muted">{ready ? tone.label : "채점 준비 중…"}</div>
        </div>
      </div>
      <dl className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <div className={`${item} bg-emerald-50`}>
          <dt>흰 선 채움</dt>
          <dd className="text-sm font-black tabular-nums text-emerald-600">+{result.whitePct.toFixed(1)}%</dd>
        </div>
        <div className={`${item} bg-red-50`}>
          <dt>회색 침범</dt>
          <dd className="text-sm font-black tabular-nums text-red-500">−{result.penalty.toFixed(1)}점</dd>
          <dd className="tabular-nums">({result.grayPct.toFixed(2)}%)</dd>
        </div>
        <div className={`${item} bg-amber-50`} title="같은 곳을 다시 칠하거나(덧칠) 짧게 끊어 겹쳐 그은(털선) 만큼 깎여요">
          <dt>겹쳐 그리기</dt>
          <dd className="text-sm font-black tabular-nums text-amber-600">−{result.overlapPenalty.toFixed(1)}점</dd>
          <dd className="tabular-nums">({result.overlapPct.toFixed(1)}%)</dd>
        </div>
        <div className={`${item} bg-sky-soft`}>
          <dt>칠한 흰 픽셀</dt>
          <dd className="font-black tabular-nums text-ink">{result.whiteHits.toLocaleString()}</dd>
          <dd className="tabular-nums">/ {result.whiteTotal.toLocaleString()}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onComplete}
        disabled={!!blockedReason}
        title={blockedReason ?? "지금 점수와 걸린 시간을 기록으로 저장해요"}
        className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm transition enabled:hover:brightness-110 disabled:bg-ink-muted/40"
      >
        ✅ 완료
      </button>
    </>
  );
}
