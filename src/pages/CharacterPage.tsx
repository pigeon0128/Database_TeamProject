import { useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import TracingCanvas, { type TracingCanvasHandle } from "../components/TracingCanvas";
import { downloadImage, Panel, ShortcutPanel, ToolPanels, useDrawingTools } from "../components/DrawingTools";

/** 정사각형 도화지 (캔버스 픽셀) */
const CANVAS_SIZE = 1200;
const DEFAULT_NAME = "내 캐릭터";

export default function CharacterPage() {
  const canvasRef = useRef<TracingCanvasHandle>(null);
  const tools = useDrawingTools(canvasRef);
  const [name, setName] = useState("");

  const save = () => {
    const url = canvasRef.current?.exportImage(false);
    if (url) downloadImage(url, `${name.trim() || DEFAULT_NAME}.png`);
  };

  return (
    <PageLayout title="캐릭터 그리기" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 rounded-full bg-white/80 py-1 pl-4 pr-1 shadow-sm">
          <span className="text-sm font-black">이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={DEFAULT_NAME}
            maxLength={20}
            className="w-40 rounded-full bg-sky-soft px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-sky-deep"
          />
        </label>
        <p className="text-sm font-medium text-ink-muted">흰 도화지에 나만의 캐릭터를 자유롭게 그려 보세요!</p>
      </div>

      {/* 스토리 장면 그리기와 같은 배치: 오른쪽 도구 영역은 왼쪽(도화지) 높이에 맞추고 넘치면 스크롤 */}
      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        {/* 정사각형 도화지가 화면 높이를 넘지 않도록 폭을 제한한다 */}
        <div className="mx-auto w-full" style={{ maxWidth: "min(100%, calc(100vh - 10rem))" }}>
          <TracingCanvas
            ref={canvasRef}
            guideSrc={null}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            guideOpacity={1}
            showGuide={false}
            {...tools.canvasProps}
          />
        </div>

        <div className="relative">
          <aside className="flex flex-col gap-3 rounded-3xl lg:absolute lg:inset-0 lg:overflow-y-auto lg:pr-1">
            <ToolPanels tools={tools} />

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
                onClick={save}
                disabled={!tools.hasDrawing}
                className="rounded-2xl bg-sky-deep py-3 text-sm font-bold text-white shadow-card hover:brightness-110 disabled:opacity-40"
              >
                그림 저장
              </button>
            </div>

            <Panel title="💡 그리기 팁">
              <ul className="list-disc space-y-1 pl-4 text-sm font-medium">
                <li>동그라미로 얼굴부터 그리고, 몸과 팔다리를 붙여 보세요.</li>
                <li>
                  <b>Ctrl + 휠</b>로 확대하면 눈·입 같은 작은 부분을 그리기 쉬워요.
                </li>
                <li>
                  선이 흔들리면 <b>손떨림 보정</b>을 올려 보세요.
                </li>
              </ul>
            </Panel>

            <ShortcutPanel />
          </aside>
        </div>
      </div>
    </PageLayout>
  );
}
