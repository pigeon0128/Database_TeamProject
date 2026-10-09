import { useCallback, useEffect, useRef, useState } from "react";
import PageLayout from "../components/PageLayout";
import TracingCanvas, { type TracingCanvasHandle } from "../components/TracingCanvas";
import { downloadImage, Panel, ShortcutPanel, ToolPanels, useDrawingTools } from "../components/DrawingTools";
import forestGuide from "../assets/story/forest-guide.webp";
import { makeTracedExample, prepareGuide } from "../lib/guideImage";
import { buildGuideMasks, emptyScore, scoreCanvas, type GuideMasks, type Rect, type TraceScore } from "../lib/traceScore";

type Scene = {
  id: string;
  title: string;
  line: string;
  guide: string;
  width: number;
  height: number;
  /** 채점에서 뺄 영역 (밑그림 안의 안내 문구 상자 등) */
  scoreExclude: Rect[];
  /** 이 영역의 흰 선은 따라 그리기 대상에서 빼고 회색 선(배경)으로 바꾼다 */
  backgroundRegions: Rect[];
};

const scenes: Scene[] = [
  {
    id: "forest-music",
    title: "숲속의 노래",
    line: "소리에도 생명이 있구나!!",
    guide: forestGuide,
    width: 1500,
    height: 1049,
    scoreExclude: [{ x: 0, y: 0, w: 395, h: 115 }],
    // 위쪽 음표 (캐릭터 손은 y 400부터 시작)
    backgroundRegions: [{ x: 300, y: 0, w: 960, h: 370 }],
  },
];

function scoreTone(score: number) {
  if (score >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500", label: "최고예요! 🎉" };
  if (score >= 50) return { text: "text-sky-deep", bar: "bg-sky-deep", label: "잘하고 있어요! 👍" };
  if (score >= 20) return { text: "text-amber-500", bar: "bg-amber-400", label: "조금만 더! ✏️" };
  return { text: "text-ink-muted", bar: "bg-ink-muted", label: "흰 선을 따라 그려 보세요" };
}

function ScorePanel({ result, ready }: { result: TraceScore; ready: boolean }) {
  const tone = scoreTone(result.score);
  return (
    <section className="rounded-3xl border border-white/90 bg-white/80 p-4 shadow-card" aria-live="polite">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold text-ink-muted">점수</h2>
        <span className="text-xs font-bold text-ink-muted">{ready ? tone.label : "채점 준비 중…"}</span>
      </div>
      <p className={`mt-1 text-5xl font-black tabular-nums tracking-tight ${tone.text}`}>
        {result.score}
        <span className="ml-1 text-lg font-bold text-ink-muted">/ 100</span>
      </p>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-sky-soft">
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone.bar}`} style={{ width: `${result.score}%` }} />
      </div>
      <dl className="mt-3 space-y-1 text-sm font-semibold">
        <div className="flex justify-between">
          <dt>흰 선 채움</dt>
          <dd className="tabular-nums text-emerald-600">+{result.whitePct.toFixed(1)}%</dd>
        </div>
        <div className="flex justify-between">
          <dt>회색 구역 침범</dt>
          <dd className="tabular-nums text-red-500">
            −{result.penalty.toFixed(1)}점 <span className="text-xs text-ink-muted">({result.grayPct.toFixed(2)}%)</span>
          </dd>
        </div>
        <div className="flex justify-between border-t border-sky-haze pt-1 text-xs text-ink-muted">
          <dt>칠한 흰 픽셀</dt>
          <dd className="tabular-nums">
            {result.whiteHits.toLocaleString()} / {result.whiteTotal.toLocaleString()}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default function StoryPage() {
  const scene = scenes[0];
  const canvasRef = useRef<TracingCanvasHandle>(null);
  const tools = useDrawingTools(canvasRef);

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

  // 밑그림을 손질(음표 등을 회색 선으로)하고, 흰 선/회색 선 위치와 완성 예시를 한 번만 만들어 둔다.
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const toUrl = (canvas: HTMLCanvasElement, set: (url: string) => void) =>
      canvas.toBlob((blob) => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        set(url);
      });
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const guide = prepareGuide(img, scene.width, scene.height, scene.backgroundRegions, scene.scoreExclude);
      masksRef.current = buildGuideMasks(guide, scene.width, scene.height, scene.scoreExclude);
      setScoreReady(true);
      if (drawCanvasRef.current) setResult(scoreCanvas(drawCanvasRef.current, masksRef.current));
      toUrl(guide, setGuideUrl);
      toUrl(makeTracedExample(guide, scene.scoreExclude), setExampleUrl);
    };
    img.src = scene.guide;
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
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

  return (
    <PageLayout title="스토리 장면 그리기" wide>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-sun px-3 py-1 text-sm font-black">{scene.title}</span>
        <p className="text-sm font-medium text-ink-muted">
          <b className="text-ink">흰색 선</b>을 따라 칠할수록 점수가 올라가고, <b className="text-ink">회색 부분</b>(선과 바탕)을 칠하면 점수가 깎여요!
        </p>
        <span className="ml-auto rounded-full bg-white/80 px-3 py-1 text-sm font-black tabular-nums shadow-sm lg:hidden">{result.score}점</span>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_17rem]">
        <TracingCanvas
          ref={canvasRef}
          guideSrc={guideUrl}
          width={scene.width}
          height={scene.height}
          guideOpacity={guideOpacity}
          showGuide={showGuide}
          {...tools.canvasProps}
          onChange={handleCanvasChange}
        />

        <aside className="flex flex-col gap-3">
          <ScorePanel result={result} ready={scoreReady} />
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
