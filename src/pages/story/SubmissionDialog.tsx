// 완료한 뒤 뜨는 저장 결과 창: 점수·걸린 시간, 저장 중/완료/실패, 리더보드 보기·다시 저장·다시 도전.
import { formatDuration, formatScore } from "../../lib/format";
import { navigate } from "../../router";
import { scoreTone } from "./ScoreBar";
import type { Submission } from "./useRecordSubmission";

type Props = {
  submission: Submission;
  sceneTitle: string;
  drawingId: number | undefined;
  onResend: () => void;
  onRetry: () => void;
  /** 로그인이 끝났을 때(401) 로그인 화면으로 */
  onExpire: () => void;
};

export function SubmissionDialog({ submission, sceneTitle, drawingId, onResend, onRetry, onExpire }: Props) {
  return (
    <div role="dialog" aria-modal="true" aria-label="기록 저장" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-4xl bg-white p-7 text-center shadow-card-hover">
        <p className="text-sm font-extrabold text-ink-muted">{sceneTitle}</p>
        <p className={`mt-2 text-6xl font-black tabular-nums tracking-tight ${scoreTone(submission.score).text}`}>
          {formatScore(submission.score)}
          <span className="ml-1 text-xl font-bold text-ink-muted">점</span>
        </p>
        <p className="mt-1 text-sm font-bold text-ink-muted">⏱ {formatDuration(submission.durationMs)}</p>

        {submission.status === "saving" && <p className="mt-5 text-sm font-bold text-ink-muted">기록을 저장하는 중…</p>}
        {submission.status === "saved" && <p className="mt-5 text-base font-extrabold text-emerald-600">기록이 저장됐어요! 🎉</p>}
        {submission.status === "error" && (
          <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {submission.message}
          </p>
        )}

        <div className="mt-6 grid gap-2">
          {submission.status === "saved" && (
            <button
              type="button"
              onClick={() => navigate(`/leaderboard?drawing=${drawingId}`)}
              className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110"
            >
              🏆 리더보드 보기
            </button>
          )}
          {submission.status === "error" &&
            (submission.expired ? (
              <button type="button" onClick={onExpire} className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110">
                다시 로그인하기
              </button>
            ) : (
              <button type="button" onClick={onResend} className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110">
                다시 저장하기
              </button>
            ))}
          {submission.status !== "saving" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onRetry} className="rounded-2xl bg-sky-soft py-3 text-sm font-extrabold hover:bg-sky-haze">
                🔁 다시 도전
              </button>
              <button type="button" onClick={() => navigate("/story")} className="rounded-2xl bg-sky-soft py-3 text-sm font-extrabold hover:bg-sky-haze">
                장면 고르기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
