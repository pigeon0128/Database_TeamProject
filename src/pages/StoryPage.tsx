import { useCallback, useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import TracingCanvas, { type TracingCanvasHandle } from "../components/TracingCanvas";
import { downloadImage, Panel, ShortcutPanel, ToolPanels, useDrawingTools } from "../components/DrawingTools";
import { useAuth } from "../auth";
import { findScene, type Scene } from "../data/scenes";
import { api, ApiError } from "../lib/api";
import { formatClock, formatDuration, formatScore } from "../lib/format";
import { loadSceneAssets } from "../lib/sceneAssets";
import { emptyScore, scoreCanvas, type GuideMasks, type TraceScore } from "../lib/traceScore";
import { navigate } from "../router";

const BACK_TO_LIST = { path: "/story", label: "장면 고르기" };

function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500", label: "최고예요! 🎉" };
  if (score >= 50) return { text: "text-sky-deep", bar: "bg-sky-deep", label: "잘하고 있어요! 👍" };
  if (score >= 20) return { text: "text-amber-500", bar: "bg-amber-400", label: "조금만 더! ✏️" };
  return { text: "text-ink-muted", bar: "bg-ink-muted", label: "흰 선을 따라 그려 보세요" };
}

/** 소수 둘째 자리까지의 정확한 점수 (기록 저장용). 화면의 큰 숫자는 반올림한 정수다. */
const exactScore = (r: TraceScore) => Math.round(Math.max(0, Math.min(100, r.whitePct - r.penalty)) * 100) / 100;

type ScorePanelProps = {
  result: TraceScore;
  ready: boolean;
  elapsedMs: number;
  timerRunning: boolean;
  onComplete: () => void;
  /** 완료할 수 없는 이유 (없으면 완료 가능) */
  blockedReason: string | null;
};

function ScorePanel({ result, ready, elapsedMs, timerRunning, onComplete, blockedReason }: ScorePanelProps) {
  const tone = scoreTone(result.score);
  return (
    // 그림 아래에 가로로 길게 놓이는 점수판: 왼쪽 큰 점수, 오른쪽 진행 막대와 세부 항목
    <section
      className="flex flex-col gap-4 rounded-3xl border border-white/90 bg-white/80 p-5 shadow-card sm:flex-row sm:items-center sm:gap-6"
      aria-live="polite"
    >
      <div className="shrink-0 sm:w-40">
        <h2 className="text-sm font-extrabold text-ink-muted">점수</h2>
        <p className={`text-6xl font-black tabular-nums tracking-tight ${tone.text}`}>
          {result.score}
          <span className="ml-1 text-lg font-bold text-ink-muted">/ 100</span>
        </p>
        <p className="mt-1 text-sm font-bold tabular-nums text-ink-muted" title="첫 획을 그을 때 시작해서 완료하면 멈춰요">
          ⏱ {formatClock(elapsedMs)} {!timerRunning && elapsedMs === 0 && <span className="text-xs font-semibold">(첫 획부터)</span>}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex justify-end text-sm font-bold text-ink-muted">{ready ? tone.label : "채점 준비 중…"}</div>
        <div className="h-4 overflow-hidden rounded-full bg-sky-soft">
          <div className={`h-full rounded-full transition-[width] duration-300 ${tone.bar}`} style={{ width: `${result.score}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-emerald-50 px-2 py-2.5">
            <dt className="text-xs font-bold text-ink-muted">흰 선 채움</dt>
            <dd className="text-lg font-black tabular-nums text-emerald-600">+{result.whitePct.toFixed(1)}%</dd>
          </div>
          <div className="rounded-2xl bg-red-50 px-2 py-2.5">
            <dt className="text-xs font-bold text-ink-muted">회색 구역 침범</dt>
            <dd className="text-lg font-black tabular-nums text-red-500">−{result.penalty.toFixed(1)}점</dd>
            <dd className="text-[11px] font-semibold tabular-nums text-ink-muted">({result.grayPct.toFixed(2)}%)</dd>
          </div>
          <div className="rounded-2xl bg-sky-soft px-2 py-2.5">
            <dt className="text-xs font-bold text-ink-muted">칠한 흰 픽셀</dt>
            <dd className="text-sm font-black tabular-nums">{result.whiteHits.toLocaleString()}</dd>
            <dd className="text-[11px] font-semibold tabular-nums text-ink-muted">/ {result.whiteTotal.toLocaleString()}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onComplete}
          disabled={!!blockedReason}
          title={blockedReason ?? "지금 점수와 걸린 시간을 기록으로 저장해요"}
          className="mt-3 w-full rounded-2xl bg-emerald-500 py-3 text-base font-extrabold text-white shadow-card transition hover:brightness-110 disabled:bg-ink-muted/40"
        >
          ✅ 완료하고 기록 저장
        </button>
        {blockedReason && <p className="mt-1.5 text-center text-xs font-semibold text-ink-muted">{blockedReason}</p>}
      </div>
    </section>
  );
}

export default function StoryPage({ sceneId }: { sceneId: string }) {
  const scene = findScene(sceneId);
  if (!scene) {
    return (
      <PageLayout title="스토리 장면 그리기" back={BACK_TO_LIST}>
        <div className="rounded-3xl bg-white/80 p-8 text-center shadow-card">
          <p className="font-bold">찾을 수 없는 장면이에요.</p>
          <button type="button" onClick={() => navigate("/story")} className="mt-4 rounded-full bg-sky-deep px-5 py-2 text-sm font-bold text-white">
            장면 고르러 가기
          </button>
        </div>
      </PageLayout>
    );
  }
  return <SceneAttempts scene={scene} />;
}

/** "다시 도전"하면 그리기 화면을 통째로 새로 시작한다. */
function SceneAttempts({ scene }: { scene: Scene }) {
  const [attempt, setAttempt] = useState(0);
  return <SceneDrawing key={attempt} scene={scene} onRetry={() => setAttempt((a) => a + 1)} />;
}

type Submission =
  | { status: "saving"; score: number; durationMs: number }
  | { status: "saved"; score: number; durationMs: number }
  | { status: "error"; score: number; durationMs: number; message: string; expired: boolean };

function SceneDrawing({ scene, onRetry }: { scene: Scene; onRetry: () => void }) {
  const canvasRef = useRef<TracingCanvasHandle>(null);
  const tools = useDrawingTools(canvasRef);
  const { expire } = useAuth();

  // 타이머: 첫 획을 그을 때 시작, 완료하면 멈춘다.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const timerRunning = startedAt !== null && submission === null;

  const startTimer = useCallback(() => setStartedAt((t) => t ?? Date.now()), []);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [timerRunning, startedAt]);

  const [showGuide, setShowGuide] = useState(true);
  const [guideOpacity, setGuideOpacity] = useState(0.8);
  const [showExample, setShowExample] = useState(false);
  const [result, setResult] = useState<TraceScore>(emptyScore);
  const [scoreReady, setScoreReady] = useState(false);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [exampleUrl, setExampleUrl] = useState<string | null>(null);

  const masksRef = useRef<GuideMasks | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scorePending = useRef(false);

  // 손질한 밑그림, 채점용 위치, 완성 예시 (선택 화면에서 이미 만들었다면 그대로 재사용)
  useEffect(() => {
    let cancelled = false;
    loadSceneAssets(scene).then(
      (assets) => {
        if (cancelled) return;
        masksRef.current = assets.masks;
        setScoreReady(true);
        if (drawCanvasRef.current) setResult(scoreCanvas(drawCanvasRef.current, assets.masks));
        setGuideUrl(assets.guideUrl);
        setExampleUrl(assets.exampleUrl);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  // 그리는 동안 너무 자주 계산하지 않도록 0.12초에 한 번만 채점한다.
  const handleCanvasChange = useCallback((canvas: HTMLCanvasElement) => {
    drawCanvasRef.current = canvas;
    if (scorePending.current || !masksRef.current) return;
    scorePending.current = true;
    setTimeout(() => {
      scorePending.current = false;
      if (masksRef.current && drawCanvasRef.current) setResult(scoreCanvas(drawCanvasRef.current, masksRef.current));
    }, 120);
  }, []);

  const save = (withGuide: boolean) => {
    const url = canvasRef.current?.exportImage(withGuide);
    if (url) downloadImage(url, `${scene.title}${withGuide ? "-밑그림포함" : ""}.png`);
  };

  const send = (score: number, durationMs: number) => {
    if (scene.drawingId === undefined) return;
    setSubmission({ status: "saving", score, durationMs });
    api.savePlayRecord(scene.drawingId, score, durationMs).then(
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
  };

  /** 완료: 지금 점수와 걸린 시간을 고정해서 저장한다. */
  const complete = () => {
    if (startedAt === null) return;
    // 마지막 획까지 반영된 점수로 저장
    const latest = masksRef.current && drawCanvasRef.current ? scoreCanvas(drawCanvasRef.current, masksRef.current) : result;
    setResult(latest);
    const durationMs = Date.now() - startedAt;
    setElapsedMs(durationMs);
    send(exactScore(latest), durationMs);
  };

  const blockedReason =
    scene.drawingId === undefined
      ? "이 장면은 아직 데이터베이스에 등록되지 않아 기록을 저장할 수 없어요."
      : !scoreReady
        ? "채점 준비 중이에요."
        : !tools.hasDrawing
          ? "그림을 그린 뒤에 완료할 수 있어요."
          : null;

  return (
    <PageLayout title="스토리 장면 그리기" wide back={BACK_TO_LIST}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-sun px-3 py-1 text-sm font-black">{scene.title}</span>
        <p className="text-sm font-medium text-ink-muted">
          <b className="text-ink">흰색 선</b>을 따라 칠할수록 점수가 올라가고, <b className="text-ink">회색 부분</b>(선과 바탕)을 칠하면 점수가 깎여요!
        </p>
      </div>

      {/* 왼쪽: 그림 위, 점수 아래 / 오른쪽: 도구 등 기타 (왼쪽 높이에 맞추고 넘치면 스크롤) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <TracingCanvas
            ref={canvasRef}
            guideSrc={guideUrl}
            width={scene.width}
            height={scene.height}
            guideOpacity={guideOpacity}
            showGuide={showGuide}
            {...tools.canvasProps}
            onStrokeStart={startTimer}
            onChange={handleCanvasChange}
          />
          <ScorePanel
            result={result}
            ready={scoreReady}
            elapsedMs={elapsedMs}
            timerRunning={timerRunning}
            onComplete={complete}
            blockedReason={blockedReason}
          />
        </div>

        <div className="relative">
          <aside className="flex flex-col gap-3 rounded-3xl lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-1">
            <ToolPanels tools={tools} />

            <Panel title="밑그림">
              <label className="flex items-center justify-between text-sm font-bold">
                밑그림 보이기
                <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="h-5 w-5 accent-sky-deep" />
              </label>
              <label className="mt-3 block text-sm font-bold">
                진하기 {Math.round(guideOpacity * 100)}%
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(guideOpacity * 100)}
                  disabled={!showGuide}
                  onChange={(e) => setGuideOpacity(Number(e.target.value) / 100)}
                  className="mt-1 w-full accent-sky-deep disabled:opacity-40"
                />
              </label>
              <button type="button" onClick={() => setShowExample(true)} disabled={!exampleUrl} className="mt-3 w-full rounded-2xl bg-mint/30 py-2.5 text-sm font-bold hover:bg-mint/50">
                🖼️ 완성 예시 보기
              </button>
            </Panel>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={tools.clearAll}
                disabled={!tools.hasDrawing}
                className="rounded-2xl bg-white/80 py-3 text-sm font-bold text-red-500 shadow-card hover:bg-white disabled:opacity-40"
              >
                전체 지우기
              </button>
              <button
                type="button"
                onClick={() => save(false)}
                disabled={!tools.hasDrawing}
                className="rounded-2xl bg-sky-deep py-3 text-sm font-bold text-white shadow-card hover:brightness-110 disabled:opacity-40"
              >
                그림 저장
              </button>
            </div>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={!tools.hasDrawing}
              className="text-xs font-semibold text-ink-muted underline-offset-2 hover:underline disabled:opacity-40"
            >
              밑그림과 함께 저장하기
            </button>

            <ShortcutPanel />
          </aside>
        </div>
      </div>

      {submission && (
        <div role="dialog" aria-modal="true" aria-label="기록 저장" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-4xl bg-white p-7 text-center shadow-card-hover">
            <p className="text-sm font-extrabold text-ink-muted">{scene.title}</p>
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
                  onClick={() => navigate(`/leaderboard?drawing=${scene.drawingId}`)}
                  className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110"
                >
                  🏆 리더보드 보기
                </button>
              )}
              {submission.status === "error" &&
                (submission.expired ? (
                  <button type="button" onClick={expire} className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110">
                    다시 로그인하기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => send(submission.score, submission.durationMs)}
                    className="rounded-2xl bg-sky-deep py-3 text-sm font-extrabold text-white hover:brightness-110"
                  >
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
      )}

      {showExample && exampleUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="완성 예시"
          onClick={() => setShowExample(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
        >
          <figure className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
            <img src={exampleUrl} alt={`${scene.title} 완성 예시`} className="w-full" />
            <figcaption className="flex items-center justify-between gap-3 p-4">
              <span className="text-sm font-bold">“{scene.line}”</span>
              <button type="button" onClick={() => setShowExample(false)} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
                닫기
              </button>
            </figcaption>
          </figure>
        </div>
      )}
    </PageLayout>
  );
}
