// 스토리 장면 고르기 화면 (#/story). scenes.ts의 장면들을 완성 예시 미리보기 카드로 보여 주고,
// 누르면 그 장면의 그리기 화면(#/story/<id>)으로 이동한다. 그리던 그림이 저장된 장면은 "이어 그리기"로 표시한다.
import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { scenes, storyChapters, type Scene } from "../data/scenes";
import { draftKeys } from "../lib/drawingDraft";
import { loadScenePreview } from "../lib/drawing/sceneAssets";
import { navigate } from "../router";

const chapterTabs = [
  { id: "special", label: "기존 장면" },
  { id: "ch1", label: "CH1" },
  { id: "ch2", label: "CH2" },
  { id: "ch3", label: "CH3" },
  { id: "ch4", label: "CH4" },
] as const;

type ChapterTabId = (typeof chapterTabs)[number]["id"];

function SceneCard({ scene, index, inProgress }: { scene: Scene; index: number; inProgress: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // 미리보기 이미지만 만든다 (채점용 계산은 그리기 화면에서)
    loadScenePreview(scene).then(
      (a) => !cancelled && setPreview(a.exampleUrl),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [scene]);

  return (
    <button
      type="button"
      onClick={() => navigate(`/story/${scene.id}`)}
      className="group overflow-hidden rounded-4xl border border-white/90 bg-white/80 text-left shadow-card transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep"
    >
      <span className="relative block overflow-hidden bg-sky-haze" style={{ aspectRatio: `${scene.width} / ${scene.height}` }}>
        {preview ? (
          <img src={preview} alt={`${scene.title} 완성 예시`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center text-sm font-bold text-ink-muted">미리보기 만드는 중…</span>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-black text-ink-muted shadow-sm">
          {String(index + 1).padStart(2, "0")}
        </span>
      </span>
      <span className="flex items-end justify-between gap-3 p-5">
        <span>
          <strong className="block text-xl font-extrabold tracking-[-0.025em]">{scene.title}</strong>
          <span className="mt-1 block text-sm font-medium text-ink-muted">“{scene.line}”</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-sky-deep px-4 py-2 text-sm font-bold text-white transition group-hover:translate-x-1">
          {inProgress ? "이어 그리기 →" : "그리기 →"}
        </span>
      </span>
    </button>
  );
}

export default function StorySelectPage() {
  const [selectedChapter, setSelectedChapter] = useState<ChapterTabId>("ch1");
  // 그리던 그림이 DB에 있는 장면들 (한 번에 불러온다. 못 불러오면 표시만 안 할 뿐 그리기에는 지장 없다)
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  useEffect(() => {
    draftKeys().then(setDrafts, () => {});
  }, []);

  const chapterGroups = storyChapters
    .map((chapter) => ({ ...chapter, scenes: scenes.filter((scene) => scene.chapter === chapter.id) }))
    .filter(
      (chapter) =>
        chapter.scenes.length > 0 &&
        (selectedChapter === "special" ? chapter.id === "special" : chapter.id.startsWith(`${selectedChapter}-`)),
    );

  const chapterAvailability = new Map<ChapterTabId, boolean>(
    chapterTabs.map((tab) => [
      tab.id,
      tab.id === "special"
        ? scenes.some((scene) => scene.chapter === "special")
        : scenes.some((scene) => scene.chapter?.startsWith(`${tab.id}-`)),
    ]),
  );

  return (
    <PageLayout title="스토리 장면 그리기" wide>
      <p className="mb-5 text-sm font-medium text-ink-muted">따라 그릴 장면을 골라 보세요. 그림을 누르면 바로 그리기를 시작해요!</p>
      <nav aria-label="스토리 챕터 선택" className="mb-8 rounded-3xl border border-white/90 bg-white/80 p-3 shadow-card backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {chapterTabs.map((tab) => {
            const available = chapterAvailability.get(tab.id) ?? false;
            const selected = tab.id === selectedChapter;

            return (
              <span key={tab.id} className="group relative block">
                <button
                  type="button"
                  aria-pressed={available ? selected : undefined}
                  aria-disabled={!available}
                  aria-describedby={!available ? `chapter-${tab.id}-status` : undefined}
                  onClick={() => available && setSelectedChapter(tab.id)}
                  className={`w-full rounded-2xl px-4 py-3 text-sm font-black transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-deep ${
                    selected
                      ? "bg-sky-deep text-white shadow-sm"
                      : available
                        ? "bg-sky-haze text-sky-deep hover:-translate-y-0.5 hover:bg-sky-100"
                        : "cursor-not-allowed bg-slate-100 text-slate-400"
                  }`}
                >
                  {tab.label}
                </button>
                {!available && (
                  <span
                    id={`chapter-${tab.id}-status`}
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-800 px-3 py-1.5 text-xs font-bold text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    준비중
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </nav>
      <div className="space-y-10">
        {chapterGroups.map((chapter) => (
          <section key={chapter.id} aria-labelledby={`chapter-${chapter.id}`}>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <span className="rounded-full bg-sky-haze px-3 py-1 text-xs font-black text-sky-deep">{chapter.label}</span>
              <h2 id={`chapter-${chapter.id}`} className="text-2xl font-black tracking-[-0.04em]">{chapter.title}</h2>
              <span className="text-sm font-bold text-ink-muted">{chapter.scenes.length}장면</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {chapter.scenes.map((scene, index) => (
                <SceneCard key={scene.id} scene={scene} index={index} inProgress={drafts.has(`story:${scene.id}`)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
