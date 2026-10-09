import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import PageLayout from "../components/PageLayout";
import TracingCanvas, { visibleStrokes, type DrawAction, type Stroke, type TracingCanvasHandle } from "../components/TracingCanvas";
import forestGuide from "../assets/story/forest-guide.webp";
import forestExample from "../assets/story/forest-example.webp";

type Scene = {
  id: string;
  title: string;
  line: string;
  guide: string;
  example: string;
  width: number;
  height: number;
};

const scenes: Scene[] = [
  {
    id: "forest-music",
    title: "숲속의 노래",
    line: "소리에도 생명이 있구나!!",
    guide: forestGuide,
    example: forestExample,
    width: 1500,
    height: 1049,
  },
];

const palette = [
  { name: "검정", value: "#363636" },
  { name: "갈색", value: "#8b5a2b" },
  { name: "빨강", value: "#ef4444" },
  { name: "주황", value: "#f97316" },
  { name: "노랑", value: "#fee500" },
  { name: "초록", value: "#22a35a" },
  { name: "하늘", value: "#38bdf8" },
  { name: "파랑", value: "#1e82dc" },
  { name: "보라", value: "#8b5cf6" },
  { name: "분홍", value: "#f472b6" },
];

const sizes = [
  { name: "가늘게", value: 4 },
  { name: "보통", value: 8 },
  { name: "굵게", value: 16 },
  { name: "아주 굵게", value: 32 },
];

function ToolButton({ active, onClick, children, label }: { active?: boolean; onClick: () => void; children: ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-bold transition ${
        active ? "bg-sky-deep text-white shadow-sm" : "bg-sky-soft text-ink hover:bg-sky-haze"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/90 bg-white/80 p-4 shadow-card">
      <h2 className="mb-3 text-sm font-extrabold text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

export default function StoryPage() {
  const scene = scenes[0];
  const canvasRef = useRef<TracingCanvasHandle>(null);

  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [color, setColor] = useState(palette[0].value);
  const [size, setSize] = useState(8);
  const [erase, setErase] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [guideOpacity, setGuideOpacity] = useState(0.8);
  const [showExample, setShowExample] = useState(false);

  const hasDrawing = visibleStrokes(actions).length > 0;

  const addStroke = useCallback((stroke: Stroke) => {
    setActions((prev) => [...prev, stroke]);
    setRedoStack([]);
  }, []);

  const undo = useCallback(() => {
    if (!actions.length) return;
    setRedoStack((r) => [...r, actions[actions.length - 1]]);
    setActions(actions.slice(0, -1));
  }, [actions]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    setActions((prev) => [...prev, redoStack[redoStack.length - 1]]);
    setRedoStack(redoStack.slice(0, -1));
  }, [redoStack]);

  const clearAll = () => {
    if (!hasDrawing) return;
    setActions((prev) => [...prev, { type: "clear" }]);
    setRedoStack([]);
  };

  const save = (withGuide: boolean) => {
    const url = canvasRef.current?.exportImage(withGuide);
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scene.title}${withGuide ? "-밑그림포함" : ""}.png`;
    a.click();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <PageLayout title="스토리 장면 그리기" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-sun px-3 py-1 text-sm font-black">{scene.title}</span>
        <p className="text-sm font-medium text-ink-muted">흰색 선은 인물, 회색 선은 배경이에요. 브러쉬로 윤곽선을 따라 그려 보세요!</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
        <TracingCanvas
          ref={canvasRef}
          guideSrc={scene.guide}
          width={scene.width}
          height={scene.height}
          guideOpacity={guideOpacity}
          showGuide={showGuide}
          color={color}
          size={size}
          erase={erase}
          actions={actions}
          onStrokeEnd={addStroke}
        />

        <aside className="flex flex-col gap-3">
          <Panel title="도구">
            <div className="flex gap-2">
              <ToolButton label="브러쉬" active={!erase} onClick={() => setErase(false)}>
                🖌️ 브러쉬
              </ToolButton>
              <ToolButton label="지우개" active={erase} onClick={() => setErase(true)}>
                🧽 지우개
              </ToolButton>
            </div>
            <div className="mt-2 flex gap-2">
              <ToolButton label="되돌리기 (Ctrl+Z)" onClick={undo}>
                ↶ 되돌리기
              </ToolButton>
              <ToolButton label="다시 하기 (Ctrl+Y)" onClick={redo}>
                ↷ 다시
              </ToolButton>
            </div>
          </Panel>

          <Panel title="색깔">
            <div className="grid grid-cols-5 gap-2">
              {palette.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={!erase && color === c.value}
                  onClick={() => {
                    setColor(c.value);
                    setErase(false);
                  }}
                  className={`aspect-square rounded-full border-2 transition hover:scale-110 ${
                    !erase && color === c.value ? "border-white ring-2 ring-sky-deep" : "border-white shadow"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <label className="mt-3 flex items-center justify-between text-sm font-bold">
              다른 색 고르기
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setErase(false);
                }}
                className="h-8 w-12 cursor-pointer rounded-lg border-0 bg-transparent"
              />
            </label>
          </Panel>

          <Panel title={`굵기 ${size}`}>
            <div className="grid grid-cols-4 gap-2">
              {sizes.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  title={s.name}
                  aria-label={s.name}
                  aria-pressed={size === s.value}
                  onClick={() => setSize(s.value)}
                  className={`flex h-12 items-center justify-center rounded-2xl transition ${
                    size === s.value ? "bg-sky-haze ring-2 ring-sky-deep" : "bg-sky-soft hover:bg-sky-haze"
                  }`}
                >
                  <span className="rounded-full bg-ink" style={{ width: 4 + s.value / 1.5, height: 4 + s.value / 1.5 }} />
                </button>
              ))}
            </div>
            <input
              type="range"
              min={2}
              max={48}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="브러쉬 굵기"
              className="mt-3 w-full accent-sky-deep"
            />
          </Panel>

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
            <button type="button" onClick={() => setShowExample(true)} className="mt-3 w-full rounded-2xl bg-mint/30 py-2.5 text-sm font-bold hover:bg-mint/50">
              🖼️ 완성 예시 보기
            </button>
          </Panel>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasDrawing}
              className="rounded-2xl bg-white/80 py-3 text-sm font-bold text-red-500 shadow-card hover:bg-white disabled:opacity-40"
            >
              전체 지우기
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={!hasDrawing}
              className="rounded-2xl bg-sky-deep py-3 text-sm font-bold text-white shadow-card hover:brightness-110 disabled:opacity-40"
            >
              그림 저장
            </button>
          </div>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={!hasDrawing}
            className="text-xs font-semibold text-ink-muted underline-offset-2 hover:underline disabled:opacity-40"
          >
            밑그림과 함께 저장하기
          </button>
        </aside>
      </div>

      {showExample && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="완성 예시"
          onClick={() => setShowExample(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
        >
          <figure className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
            <img src={scene.example} alt={`${scene.title} 완성 예시`} className="w-full" />
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
