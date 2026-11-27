// 캐릭터 그리기 화면 (#/character). 밑그림·채점 없이 흰 도화지에 자유롭게 그리고, 이름을 붙여 PNG로 저장한다.
// 채우기·브러쉬·특수 브러쉬로 도화지 어디든 칠할 수 있다 (펜 선 아래에 칠해진다).
// 툴바의 "AI 밑그림"으로 글로 밑그림을 만들면, 도감 그리기처럼 흰 선 안쪽 구역만 칠해진다 (components/drawing/AiSketchMenu.tsx).
import { useEffect, useMemo, useRef, useState } from "react";
import TracingCanvas, { type TracingCanvasHandle } from "../components/TracingCanvas";
import { AiAdviceButton } from "../components/drawing/AiAdvice";
import { AiSketchMenu, EMPTY_SKETCH, useAiSketch } from "../components/drawing/AiSketchMenu";
import { DrawingShell } from "../components/drawing/DrawingShell";
import { HistoryButtons, LineMenu, ShortcutList } from "../components/drawing/menus";
import { ResumeDialog } from "../components/drawing/ResumeDialog";
import { useDrawingTools } from "../components/drawing/useDrawingTools";
import { HoldToConfirmButton, ToolbarButton, ToolbarDivider, ToolbarMenu } from "../components/toolbar";
import { downloadImage } from "../lib/download";
import { useDrawingDraft } from "../lib/drawingDraft";
import { wholeCanvasRegions } from "../lib/drawing/regions";
import { currentPath, queryParam, replacePath } from "../router";

/** 정사각형 도화지 (캔버스 픽셀) */
const CANVAS_SIZE = 1200;
const DEFAULT_NAME = "내 캐릭터";
const BACK_TO_HOME = { path: "/", label: "메인으로" };

export default function CharacterPage() {
  const canvasRef = useRef<TracingCanvasHandle>(null);
  // 색칠 붓·특수 브러쉬도 쓴다. 밑그림이 없으면 도화지 전체가 한 구역이다.
  const tools = useDrawingTools(canvasRef, { paintable: true });
  const blankRegions = useMemo(() => wholeCanvasRegions(CANVAS_SIZE, CANVAS_SIZE), []);
  const [name, setName] = useState("");
  // 글로 만든 AI 밑그림 (그림판 아래에 깔린다. 저장하는 PNG에는 들어가지 않는다). 상점에 다녀와도 남아 있다.
  const [sketch, setSketch] = useAiSketch(CANVAS_SIZE, CANVAS_SIZE);
  // AI 밑그림이 있으면 도감 그리기처럼 흰 선 안쪽 구역만 칠하고, 없으면 도화지 전체가 한 구역이다.
  const regions = sketch.regions ?? blankRegions;
  // 이어서 그리기: 그리던 캐릭터와 이름을 저장해 둔다.
  const draft = useDrawingDraft("character", { actions: tools.canvasProps.actions, replaceActions: tools.replaceActions }, name, (saved) => setName(saved ?? ""));

  // 도감 고르기 화면의 "직접 만들어보세요"(#/character?ai=1)에서 왔으면 AI 밑그림 입력 칸을 바로 연다.
  // 그리던 그림이 있으면 "이어서 그릴까요?"를 먼저 고른 뒤에 연다 (창을 누르면 메뉴가 닫히므로)
  const [askAi] = useState(() => queryParam("ai") === "1");
  useEffect(() => {
    if (askAi) replacePath(currentPath().split("?")[0]);
  }, [askAi]);
  const openAi = askAi && draft.loaded && !draft.pending;

  const save = () => {
    const url = canvasRef.current?.exportImage(false);
    if (url) downloadImage(url, `${name.trim() || DEFAULT_NAME}.png`);
  };

  /** 새로 그리기: 그리던 그림과 함께 AI 밑그림도 지운다 */
  const startNew = () => {
    draft.startNew();
    setSketch(EMPTY_SKETCH);
  };

  return (
    <>
      <DrawingShell
        tools={tools}
        back={BACK_TO_HOME}
        coachMode="free"
        coachCharacter="codex"
        backgroundScene="free"
        aspect={1}
        // 코덱스 도움말 위: 지금 그림을 보고 코덱스가 조언 (components/drawing/AiAdvice.tsx)
        canvasExtra={<AiAdviceButton getImage={() => canvasRef.current?.exportImage(false) ?? null} title={name} strokes={tools.canvasProps.actions.length} />}
        toolbarStart={
          <>
            {/* 캐릭터 이름 = 저장할 파일 이름 */}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={DEFAULT_NAME}
              maxLength={20}
              aria-label="캐릭터 이름"
              className="h-10 w-36 rounded-full bg-sky-soft px-4 text-sm font-bold text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-sky-deep sm:w-44"
            />
            <ToolbarDivider />
            <AiSketchMenu sketch={sketch} onChange={setSketch} width={CANVAS_SIZE} height={CANVAS_SIZE} autoOpen={openAi} />
            <LineMenu tools={tools} />
            <HistoryButtons tools={tools} />
          </>
        }
        toolbarEnd={
          <>
            <ToolbarMenu title="그리기 팁과 단축키" label="❓ 도움말" alignRight>
              {() => (
                <>
                  <h2 className="mb-2 text-sm font-extrabold text-ink-muted">💡 그리기 팁</h2>
                  <ul className="mb-4 list-disc space-y-1 pl-4 text-sm font-medium">
                    <li>동그라미로 얼굴부터 그리고, 몸과 팔다리를 붙여 보세요.</li>
                    <li>
                      <b>Ctrl + 휠</b>로 확대하면 눈·입 같은 작은 부분을 그리기 쉬워요.
                    </li>
                  </ul>
                  <h2 className="mb-2 text-sm font-extrabold text-ink-muted">⌨️ 단축키</h2>
                  <ShortcutList keys={tools.keys} />
                </>
              )}
            </ToolbarMenu>
            <HoldToConfirmButton title="전체 지우기" hintText="꾹 누르고 있으면 다 지워져요" onConfirm={tools.clearAll} disabled={!tools.hasDrawing}>
              🗑️ <span className="hidden md:inline">전체 지우기</span>
            </HoldToConfirmButton>
            <ToolbarButton title="그림 저장 (PNG)" onClick={save} disabled={!tools.hasDrawing} primary>
              💾 저장
            </ToolbarButton>
          </>
        }
      >
        <TracingCanvas
          ref={canvasRef}
          guideSrc={sketch.image}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          guideOpacity={sketch.opacity}
          showGuide={sketch.visible}
          {...tools.canvasProps}
          regions={regions}
        />
      </DrawingShell>
      {draft.pending && (
        <ResumeDialog draft={draft.pending} onResume={() => setName(draft.resume() ?? "")} onStartNew={startNew} />
      )}
    </>
  );
}
