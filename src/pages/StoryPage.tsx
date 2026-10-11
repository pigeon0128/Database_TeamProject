// 스토리 장면 그리기 화면 (#/story/<id>). 밑그림의 흰 선을 따라 그리면 실시간으로 채점한다.
// 위: 툴바 (굵기·밑그림 메뉴, 되돌리기, 도움말, 전체 지우기, 저장) / 가운데: 그림판 / 아래: 점수 막대, 타이머, 완료 버튼.
// 첫 획을 그을 때 타이머가 시작되고, "완료"를 누르면 점수와 걸린 시간을 기록(play_records)으로 저장한다.
import { useCallback, useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import TracingCanvas, { visibleStrokes, type TracingCanvasHandle } from "../components/TracingCanvas";
import {
  downloadImage,
  DrawingShell,
  HistoryButtons,
  LineMenu,
  MenuItem,
  ResumeDialog,
  ShortcutList,
  SizeMenu,
  ToolbarButton,
  ToolbarDivider,
  ToolbarMenu,
  useDrawingDraft,
  useDrawingTools,
} from "../components/DrawingTools";
import { useAuth } from "../auth";
import { findScene, type Scene } from "../data/scenes";
import { api, ApiError } from "../lib/api";
import { formatClock, formatDuration, formatScore } from "../lib/format";
import { loadSceneAssets } from "../lib/sceneAssets";
import { useSavedSetting } from "../lib/userSettings";
import { emptyScore, scoreCanvas, type GuideMasks, type TraceScore } from "../lib/traceScore";
import { navigate } from "../router";

const BACK_TO_LIST = { path: "/story", label: "장면 고르기" };

function scoreTone(score: number) {
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

/** 아래 상태 막대에 한 줄로 놓이는 점수: 큰 점수, 타이머, 진행 막대, 세부 항목, 완료 버튼 */
function ScoreBar({ result, ready, elapsedMs, timerRunning, onComplete, blockedReason }: ScoreBarProps) {
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
  // 따라 그리기는 채점하므로 선 끝 얇게를 쓰지 않는다 (손떨림 보정만).
  const tools = useDrawingTools(canvasRef, { maxBrushSize: scene.maxBrushSize, fade: false });
  // 이어서 그리기: 장면마다 그리던 그림을 따로 저장한다.
  const draft = useDrawingDraft(`story:${scene.id}`, tools);
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

  // 밑그림 설정은 다른 장면을 그릴 때도 이어지도록 저장해 둔다 (lib/userSettings).
  const [showGuide, setShowGuide] = useSavedSetting("guideVisible");
  const [guideOpacityPct, setGuideOpacityPct] = useSavedSetting("guideOpacity");
  const guideOpacity = guideOpacityPct / 100;
  const [showExample, setShowExample] = useState(false);
  const [result, setResult] = useState<TraceScore>(emptyScore);
  const [scoreReady, setScoreReady] = useState(false);
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [exampleUrl, setExampleUrl] = useState<string | null>(null);

  const masksRef = useRef<GuideMasks | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // 덧칠 채점에 쓰는 지금 보이는 획 (캔버스가 다시 그려지기 전에 갱신된다)
  const strokesRef = useRef(visibleStrokes(tools.canvasProps.actions));
  strokesRef.current = visibleStrokes(tools.canvasProps.actions);

  // 손질한 밑그림, 채점용 위치, 완성 예시 (선택 화면에서 이미 만들었다면 그대로 재사용)
  useEffect(() => {
    let cancelled = false;
    loadSceneAssets(scene).then(
      (assets) => {
        if (cancelled) return;
        masksRef.current = assets.masks;
        setScoreReady(true);
        if (drawCanvasRef.current) setResult(scoreCanvas(drawCanvasRef.current, assets.masks, strokesRef.current));
        setGuideUrl(assets.guideUrl);
        setExampleUrl(assets.exampleUrl);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  // 획을 다 그었을 때(또는 되돌리기·지우기로 그림이 바뀌었을 때) 한 번 채점한다.
  // 그리는 중에는 채점하지 않아서 펜 움직임이 느려지지 않는다.
  const handleCanvasChange = useCallback((canvas: HTMLCanvasElement) => {
    drawCanvasRef.current = canvas;
    if (masksRef.current) setResult(scoreCanvas(canvas, masksRef.current, strokesRef.current));
  }, []);

  const save = (withGuide: boolean) => {
    const url = canvasRef.current?.exportImage(withGuide);
    if (url) downloadImage(url, `${scene.title}${withGuide ? "-밑그림포함" : ""}.png`);
  };

  /** 완료할 때 꺼낸 완성 그림. "다시 저장하기" 때 같은 그림을 다시 보낸다 */
  const artworkRef = useRef<string | null>(null);

  const send = (score: number, durationMs: number) => {
    if (scene.drawingId === undefined) return;
    setSubmission({ status: "saving", score, durationMs });
    api.savePlayRecord(scene.drawingId, score, durationMs, artworkRef.current).then(
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

  /** 완료: 지금 점수와 걸린 시간을 고정해서 저장한다. 다 그린 그림이므로 이어 그리기용 저장본은 지운다. */
  const complete = () => {
    if (startedAt === null) return;
    // 마지막 획까지 반영된 점수로 저장
    const latest = masksRef.current && drawCanvasRef.current ? scoreCanvas(drawCanvasRef.current, masksRef.current, strokesRef.current) : result;
    setResult(latest);
    const durationMs = Date.now() - startedAt;
    setElapsedMs(durationMs);
    draft.finish();
    // 밑그림 없이 그린 선만 저장한다 (리더보드에서 밑그림 위에 겹쳐 볼 수 있게)
    artworkRef.current = canvasRef.current?.exportDrawing() ?? null;
    send(latest.exactScore, durationMs);
  };

  const blockedReason =
    scene.drawingId === undefined
      ? "이 장면은 아직 데이터베이스에 등록되지 않아 기록을 저장할 수 없어요."
      : !scoreReady
        ? "채점 준비 중이에요."
        : !tools.hasDrawing
          ? "그림을 그린 뒤에 완료할 수 있어요."
          : startedAt === null
            ? "이어 그린 그림은 한 획 더 그어야 타이머가 시작돼요."
            : null;

  return (
    <>
      <DrawingShell
        tools={tools}
        back={BACK_TO_LIST}
        aspect={scene.width / scene.height}
        toolbarStart={
          <>
            <span className="mr-1 rounded-full bg-sun px-3 py-1 text-sm font-black text-ink">{scene.title}</span>
            <ToolbarDivider />
            <SizeMenu tools={tools} />
            <LineMenu tools={tools} />
            <ToolbarMenu title="밑그림 설정" label="🖼️ 밑그림">
              {(close) => (
                <>
                  <label className="flex items-center justify-between text-sm font-bold">
                    밑그림 보이기
                    <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="h-5 w-5 accent-sky-deep" />
                  </label>
                  <label className="mt-3 block text-sm font-bold">
                    진하기 {guideOpacityPct}%
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={guideOpacityPct}
                      disabled={!showGuide}
                      onChange={(e) => setGuideOpacityPct(Number(e.target.value))}
                      className="mt-2 w-full accent-sky-deep disabled:opacity-40"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setShowExample(true);
                    }}
                    disabled={!exampleUrl}
                    className="mt-3 w-full rounded-xl bg-mint/30 py-2 text-sm font-bold hover:bg-mint/50 disabled:opacity-40"
                  >
                    완성 예시 보기
                  </button>
                </>
              )}
            </ToolbarMenu>
            <ToolbarDivider />
            <HistoryButtons tools={tools} />
          </>
        }
        toolbarEnd={
          <>
            <ToolbarMenu title="채점 방법과 단축키" label="❓ 도움말" alignRight>
              {() => (
                <>
                  <h2 className="mb-2 text-sm font-extrabold text-ink-muted">✏️ 이렇게 그려요</h2>
                  <p className="mb-4 text-sm font-medium leading-relaxed">
                    <b>흰색 선</b>을 따라 칠할수록 점수가 올라가요. <b>회색 부분</b>(선과 바탕)을 칠하거나 <b>같은 곳을 여러 번 덧칠</b>하거나 <b>짧게 끊어서 사각사각</b>
                    그으면 점수가 깎여요. 선 하나는 한 번에 쭉 그어 보세요!
                  </p>
                  <h2 className="mb-2 text-sm font-extrabold text-ink-muted">⌨️ 단축키</h2>
                  <ShortcutList />
                </>
              )}
            </ToolbarMenu>
            <ToolbarButton title="전체 지우기" onClick={tools.clearAll} disabled={!tools.hasDrawing}>
              🗑️ <span className="hidden md:inline">전체 지우기</span>
            </ToolbarButton>
            <ToolbarMenu title="그림 저장" label="💾 저장" alignRight primary>
              {(close) => (
                <>
                  <MenuItem
                    disabled={!tools.hasDrawing}
                    onClick={() => {
                      close();
                      save(false);
                    }}
                  >
                    그림만 저장
                  </MenuItem>
                  <MenuItem
                    disabled={!tools.hasDrawing}
                    onClick={() => {
                      close();
                      save(true);
                    }}
                  >
                    밑그림과 함께 저장
                  </MenuItem>
                  {!tools.hasDrawing && <p className="px-3 pt-1 text-xs font-medium text-ink-muted">먼저 그림을 그려 주세요.</p>}
                </>
              )}
            </ToolbarMenu>
          </>
        }
        footer={
          <ScoreBar result={result} ready={scoreReady} elapsedMs={elapsedMs} timerRunning={timerRunning} onComplete={complete} blockedReason={blockedReason} />
        }
      >
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
      </DrawingShell>

      {draft.pending && <ResumeDialog draft={draft.pending} onResume={draft.resume} onStartNew={draft.startNew} />}

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
    </>
  );
}
