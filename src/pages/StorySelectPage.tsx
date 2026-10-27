// 스토리 장면 고르기 화면 (#/story). scenes.ts의 장면들을 완성 예시 미리보기 카드로 보여 주고,
// 누르면 그 장면의 그리기 화면(#/story/<id>)으로 이동한다. 그리던 그림이 저장된 장면은 "이어 그리기"로 표시한다.
import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { scenes, type Scene } from "../data/scenes";
import { draftKeys } from "../lib/drawingDraft";
import { loadScenePreview } from "../lib/drawing/sceneAssets";
import { navigate } from "../router";

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
    <div className="relative">
      <button
        type="button"
        onClick={() => navigate(`/story/${scene.id}`)}
        className="group w-full overflow-hidden rounded-4xl border border-white/90 bg-white/80 text-left shadow-card transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep"
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
      {/* 색칠하기: 카드 버튼 안에 버튼을 넣을 수 없어서 미리보기 오른쪽 위에 겹쳐 둔다 */}
      <button
        type="button"
        onClick={() => navigate(`/color/${scene.id}`)}
        className="absolute right-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-ink shadow-sm transition hover:bg-sun"
      >
        🎨 색칠하기
      </button>
    </div>
  );
}

export default function StorySelectPage() {
  // 그리던 그림이 DB에 있는 장면들 (한 번에 불러온다. 못 불러오면 표시만 안 할 뿐 그리기에는 지장 없다)
  const [drafts, setDrafts] = useState<Set<string>>(new Set());
  useEffect(() => {
    draftKeys().then(setDrafts, () => {});
  }, []);

  return (
    <PageLayout title="스토리 장면 그리기" wide>
      <p className="mb-5 text-sm font-medium text-ink-muted">따라 그릴 장면을 골라 보세요. 그림을 누르면 바로 그리기를 시작해요!</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, i) => (
          <SceneCard key={scene.id} scene={scene} index={i} inProgress={drafts.has(`story:${scene.id}`)} />
        ))}
        <div className="flex min-h-48 items-center justify-center rounded-4xl border-2 border-dashed border-sky-haze p-6 text-center text-sm font-bold text-ink-muted">
          새로운 장면이 곧 추가돼요 ✏️
        </div>
      </div>
    </PageLayout>
  );
}
