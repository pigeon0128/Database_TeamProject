// 스토리 장면 고르기 화면 (#/story). scenes.ts의 장면들을 완성 예시 미리보기 카드로 보여 주고,
// 누르면 그 장면의 그리기 화면(#/story/<id>)으로 이동한다. 그리던 그림이 저장된 장면은 "이어 그리기"로 표시하고,
// 미리보기에 선화 대신 그리던 그림을 그리기 화면처럼(밑그림 위에) 보여 준다.
import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { scenes, storyChapters, type Scene } from "../data/scenes";
import { draftKeys, loadDraft } from "../lib/drawingDraft";
import { loadScenePreview, renderDraftPreview } from "../lib/drawing/sceneAssets";
import { useSavedSetting } from "../lib/userSettings";
import { navigate } from "../router";

const chapterTabs = [
  { id: "special", label: "기존 장면" },
  { id: "ch1", label: "CH1" },
  { id: "ch2", label: "CH2" },
  { id: "ch3", label: "CH3" },
  { id: "ch4", label: "CH4" },
] as const;

type ChapterTabId = (typeof chapterTabs)[number]["id"];

/**
 * 그리던 그림 미리보기 캐시 (장면 id → 미리보기). 챕터를 바꾸거나 화면을 떠났다 와도 다시 만들지 않고 바로 보여 준다.
 * sig(저장 시각과 밑그림 진하기)가 바뀌었을 때만 새로 만들고, 그동안은 이전 미리보기를 그대로 보여 준다.
 */
const draftPreviewCache = new Map<string, { sig: string; url: string | null; pending: Promise<string | null> | null }>();
/** 마지막으로 불러온 그리던 그림 목록 (다시 들어왔을 때 "이어 그리기" 표시를 바로 보여 주려고) */
let lastDrafts = new Map<string, number>();

function loadDraftPreview(scene: Scene, savedAt: number, guideOpacity: number): Promise<string | null> {
  const sig = `${savedAt}|${guideOpacity}`;
  const previous = draftPreviewCache.get(scene.id);
  if (previous?.sig === sig) return previous.pending ?? Promise.resolve(previous.url);
  const entry = { sig, url: previous?.url ?? null, pending: null as Promise<string | null> | null };
  entry.pending = loadDraft(`story:${scene.id}`)
    .then((draft) => (draft ? renderDraftPreview(scene, draft.strokes, guideOpacity) : null))
    .then(
      (url) => {
        // 그사이 더 새 요청이 들어왔으면 이 결과는 버린다
        if (draftPreviewCache.get(scene.id) !== entry) {
          if (url) URL.revokeObjectURL(url);
          return entry.url;
        }
        if (entry.url && entry.url !== url) URL.revokeObjectURL(entry.url);
        entry.url = url;
        entry.pending = null;
        return url;
      },
      (error) => {
        // 실패하면 다음에 다시 시도한다 (이전 미리보기는 남겨 둔다)
        if (draftPreviewCache.get(scene.id) === entry) {
          if (previous) draftPreviewCache.set(scene.id, { ...previous, pending: null });
          else draftPreviewCache.delete(scene.id);
        }
        throw error;
      },
    );
  draftPreviewCache.set(scene.id, entry);
  return entry.pending;
}

/** 다 그렸거나 지운 그림의 미리보기는 놓아준다 */
function forgetDraftPreviews(keep: Map<string, number>) {
  for (const [id, entry] of draftPreviewCache) {
    if (keep.has(`story:${id}`)) continue;
    if (entry.url) URL.revokeObjectURL(entry.url);
    draftPreviewCache.delete(id);
  }
}

/** 선화 미리보기 캐시 (새 챕터 장면은 이미지 주소가 바로 있으므로 처음부터 보여 준다) */
const examplePreviewCache = new Map<string, string>();

function SceneCard({ scene, index, inProgress, draftPreview }: { scene: Scene; index: number; inProgress: boolean; draftPreview: string | null }) {
  const [preview, setPreview] = useState<string | null>(() => examplePreviewCache.get(scene.id) ?? scene.example ?? null);

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    // 미리보기 이미지만 만든다 (채점용 계산은 그리기 화면에서)
    loadScenePreview(scene).then(
      (a) => {
        examplePreviewCache.set(scene.id, a.exampleUrl);
        if (!cancelled) setPreview(a.exampleUrl);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, [scene, preview]);

  const shown = draftPreview ?? preview;

  return (
    <button
      type="button"
      onClick={() => navigate(`/story/${scene.id}`)}
      className="group overflow-hidden rounded-4xl border border-white/90 bg-white/80 text-left shadow-card transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep"
    >
      <span className="relative block overflow-hidden bg-sky-haze" style={{ aspectRatio: `${scene.width} / ${scene.height}` }}>
        {shown ? (
          <img src={shown} alt={draftPreview ? `${scene.title} 그리던 그림` : `${scene.title} 완성 예시`} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
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
  const [drafts, setDrafts] = useState<Map<string, number>>(lastDrafts);
  useEffect(() => {
    draftKeys().then((next) => {
      lastDrafts = next;
      forgetDraftPreviews(next);
      setDrafts(next);
    }, () => {});
  }, []);

  // 그리던 그림 미리보기는 챕터와 상관없이 모든 장면을 미리 만들어 둔다 (챕터를 바꿔도 기다리지 않게)
  const [showGuide] = useSavedSetting("guideVisible");
  const [guideOpacityPct] = useSavedSetting("guideOpacity");
  const guideOpacity = showGuide ? guideOpacityPct / 100 : 0;
  const [draftPreviews, setDraftPreviews] = useState<Map<string, string | null>>(
    () => new Map([...draftPreviewCache].map(([id, entry]) => [id, entry.url])),
  );
  useEffect(() => {
    let cancelled = false;
    for (const scene of scenes) {
      const savedAt = drafts.get(`story:${scene.id}`);
      if (savedAt === undefined) continue;
      loadDraftPreview(scene, savedAt, guideOpacity).then(
        (url) => !cancelled && setDraftPreviews((prev) => (prev.get(scene.id) === url ? prev : new Map(prev).set(scene.id, url))),
        () => {},
      );
    }
    return () => {
      cancelled = true;
    };
  }, [drafts, guideOpacity]);

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
                <SceneCard
                  key={scene.id}
                  scene={scene}
                  index={index}
                  inProgress={drafts.has(`story:${scene.id}`)}
                  draftPreview={drafts.has(`story:${scene.id}`) ? (draftPreviews.get(scene.id) ?? null) : null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
