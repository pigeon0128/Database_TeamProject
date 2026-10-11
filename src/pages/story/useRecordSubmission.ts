// 스토리 그리기의 타이머와 기록 저장.
// 첫 획을 그을 때 타이머를 시작하고, 완료하면 점수·걸린 시간·완성 그림을 기록(play_records, user_artworks)으로 저장한다.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../../lib/api";

export type Submission =
  | { status: "saving"; score: number; durationMs: number }
  | { status: "saved"; score: number; durationMs: number }
  | { status: "error"; score: number; durationMs: number; message: string; expired: boolean };

/** drawingId: DB drawings.drawing_id. 없으면(아직 DB에 없는 장면) 저장하지 않는다 */
export function useRecordSubmission(drawingId: number | undefined) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const timerRunning = startedAt !== null && submission === null;
  /** 완료할 때 꺼낸 완성 그림. "다시 저장하기" 때 같은 그림을 다시 보낸다 */
  const artworkRef = useRef<string | null>(null);

  /** 그림판의 획 시작에 연결한다 (처음 한 번만 시각을 잰다) */
  const startTimer = useCallback(() => setStartedAt((t) => t ?? Date.now()), []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [timerRunning, startedAt]);

  const send = useCallback(
    (score: number, durationMs: number) => {
      if (drawingId === undefined) return;
      setSubmission({ status: "saving", score, durationMs });
      api.savePlayRecord(drawingId, score, durationMs, artworkRef.current).then(
        () => setSubmission({ status: "saved", score, durationMs }),
        (e: unknown) =>
          setSubmission({
            status: "error",
            score,
            durationMs,
            message: e instanceof ApiError ? e.message : "기록을 저장하지 못했어요.",
            expired: e instanceof ApiError && e.status === 401,
          }),
      );
    },
    [drawingId],
  );

  /** 완료: 타이머를 멈추고 점수·걸린 시간·완성 그림(PNG data URL)을 저장한다 */
  const submit = (score: number, artwork: string | null) => {
    if (startedAt === null) return;
    const durationMs = Date.now() - startedAt;
    setElapsedMs(durationMs);
    artworkRef.current = artwork;
    send(score, durationMs);
  };

  /** 저장에 실패했을 때 같은 점수·시간·그림으로 다시 보낸다 */
  const resend = () => submission && send(submission.score, submission.durationMs);

  return { startedAt, elapsedMs, timerRunning, startTimer, submission, submit, resend };
}
