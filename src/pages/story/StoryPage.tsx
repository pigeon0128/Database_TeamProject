// 스토리 장면 그리기 화면 (#/story/<id>). 밑그림의 흰 선을 따라 그리면 채점하고, 완료하면 기록과 그림을 저장한다.
// 이 파일은 조각을 조립하고 툴바를 구성한다.
//   채점·장면 준비: useSceneScoring / 타이머·기록 저장: useRecordSubmission / 이어 그리기: lib/drawingDraft
//   점수 막대: ScoreBar / 저장 결과 창: SubmissionDialog / 완성 예시 창: ExampleDialog
import { useRef, useState } from "react";
import { useAuth } from "../../auth";
import { DrawingShell } from "../../components/drawing/DrawingShell";
import { HistoryButtons, LineMenu, ShortcutList, SizeMenu } from "../../components/drawing/menus";
import { ResumeDialog } from "../../components/drawing/ResumeDialog";
import { useDrawingTools } from "../../components/drawing/useDrawingTools";
import PageLayout from "../../components/PageLayout";
import { MenuItem, ToolbarButton, ToolbarDivider, ToolbarMenu } from "../../components/toolbar";
import TracingCanvas, { type TracingCanvasHandle } from "../../components/TracingCanvas";
import { findScene, type Scene } from "../../data/scenes";
import { downloadImage } from "../../lib/download";
import { useDrawingDraft } from "../../lib/drawingDraft";
import { useSavedSetting } from "../../lib/userSettings";
import { navigate } from "../../router";
import { ExampleDialog } from "./ExampleDialog";
import { ScoreBar } from "./ScoreBar";
import { SubmissionDialog } from "./SubmissionDialog";
import { useRecordSubmission } from "./useRecordSubmission";
import { useSceneScoring } from "./useSceneScoring";

const BACK_TO_LIST = { path: "/story", label: "장면 고르기" };

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

function SceneDrawing({ scene, onRetry }: { scene: Scene; onRetry: () => void }) {
  const canvasRef = useRef<TracingCanvasHandle>(null);
  // 따라 그리기는 채점하므로 선 끝 얇게를 쓰지 않는다 (손떨림 보정만).
  const tools = useDrawingTools(canvasRef, { maxBrushSize: scene.maxBrushSize, fade: false });
  const actions = tools.canvasProps.actions;
  // 이어서 그리기: 장면마다 그리던 그림을 따로 저장한다.
  const draft = useDrawingDraft(`story:${scene.id}`, { actions, replaceActions: tools.replaceActions });
  const scoring = useSceneScoring(scene, actions);
  const record = useRecordSubmission(scene.drawingId);
  const { expire } = useAuth();

  // 밑그림 설정은 다른 장면을 그릴 때도 이어지도록 저장해 둔다 (lib/userSettings).
  const [showGuide, setShowGuide] = useSavedSetting("guideVisible");
  const [guideOpacityPct, setGuideOpacityPct] = useSavedSetting("guideOpacity");
  const [showExample, setShowExample] = useState(false);

  const save = (withGuide: boolean) => {
    const url = canvasRef.current?.exportImage(withGuide);
    if (url) downloadImage(url, `${scene.title}${withGuide ? "-밑그림포함" : ""}.png`);
  };

  /** 완료: 마지막 획까지 반영된 점수로 기록과 그림을 저장한다. 다 그린 그림이므로 이어 그리기용 저장본은 지운다. */
  const complete = () => {
    if (record.startedAt === null) return;
    const latest = scoring.scoreNow();
    draft.finish();
    // 밑그림 없이 그린 선만 저장한다 (리더보드에서 밑그림 위에 겹쳐 볼 수 있게)
    record.submit(latest.exactScore, canvasRef.current?.exportDrawing() ?? null);
  };

  const blockedReason =
    scene.drawingId === undefined
      ? "이 장면은 아직 데이터베이스에 등록되지 않아 기록을 저장할 수 없어요."
      : !scoring.scoreReady
        ? "채점 준비 중이에요."
        : !tools.hasDrawing
          ? "그림을 그린 뒤에 완료할 수 있어요."
          : record.startedAt === null
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
                    disabled={!scoring.exampleUrl}
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
                  <ShortcutList keys={tools.keys} />
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
          <ScoreBar
            result={scoring.result}
            ready={scoring.scoreReady}
            elapsedMs={record.elapsedMs}
            timerRunning={record.timerRunning}
            onComplete={complete}
            blockedReason={blockedReason}
          />
        }
      >
        <TracingCanvas
          ref={canvasRef}
          guideSrc={scoring.guideUrl}
          width={scene.width}
          height={scene.height}
          guideOpacity={guideOpacityPct / 100}
          showGuide={showGuide}
          {...tools.canvasProps}
          onStrokeStart={record.startTimer}
          onChange={scoring.handleCanvasChange}
        />
      </DrawingShell>

      {draft.pending && <ResumeDialog draft={draft.pending} onResume={draft.resume} onStartNew={draft.startNew} />}

      {record.submission && (
        <SubmissionDialog
          submission={record.submission}
          sceneTitle={scene.title}
          drawingId={scene.drawingId}
          onResend={record.resend}
          onRetry={onRetry}
          onExpire={expire}
        />
      )}

      {showExample && scoring.exampleUrl && <ExampleDialog scene={scene} exampleUrl={scoring.exampleUrl} onClose={() => setShowExample(false)} />}
    </>
  );
}
