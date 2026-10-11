// 캐릭터 그리기 화면 (#/character). 밑그림·채점 없이 흰 도화지에 자유롭게 그리고, 이름을 붙여 PNG로 저장한다.
import { useRef, useState } from "react";
import TracingCanvas, { type TracingCanvasHandle } from "../components/TracingCanvas";
import {
  downloadImage,
  DrawingShell,
  HistoryButtons,
  ShortcutList,
  SizeMenu,
  ToolbarButton,
  ToolbarDivider,
  ToolbarMenu,
  useDrawingTools,
} from "../components/DrawingTools";

/** 정사각형 도화지 (캔버스 픽셀) */
const CANVAS_SIZE = 1200;
const DEFAULT_NAME = "내 캐릭터";
const BACK_TO_HOME = { path: "/", label: "메인으로" };

export default function CharacterPage() {
  const canvasRef = useRef<TracingCanvasHandle>(null);
  const tools = useDrawingTools(canvasRef);
  const [name, setName] = useState("");

  const save = () => {
    const url = canvasRef.current?.exportImage(false);
    if (url) downloadImage(url, `${name.trim() || DEFAULT_NAME}.png`);
  };

  return (
    <DrawingShell
      tools={tools}
      back={BACK_TO_HOME}
      aspect={1}
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
          <SizeMenu tools={tools} />
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
                <ShortcutList />
              </>
            )}
          </ToolbarMenu>
          <ToolbarButton title="전체 지우기" onClick={tools.clearAll} disabled={!tools.hasDrawing}>
            🗑️ <span className="hidden md:inline">전체 지우기</span>
          </ToolbarButton>
          <ToolbarButton title="그림 저장 (PNG)" onClick={save} disabled={!tools.hasDrawing} primary>
            💾 저장
          </ToolbarButton>
        </>
      }
    >
      <TracingCanvas
        ref={canvasRef}
        guideSrc={null}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        guideOpacity={1}
        showGuide={false}
        {...tools.canvasProps}
      />
    </DrawingShell>
  );
}
