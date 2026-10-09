import { useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { scenes, type Scene } from "../data/scenes";
import { loadSceneAssets } from "../lib/sceneAssets";
import { navigate } from "../router";

function SceneCard({ scene, index }: { scene: Scene; index: number }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSceneAssets(scene).then(
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
          그리기 →
        </span>
      </span>
    </button>
  );
}

export default function StorySelectPage() {
  return (
    <PageLayout title="스토리 장면 그리기" wide>
      <p className="mb-5 text-sm font-medium text-ink-muted">따라 그릴 장면을 골라 보세요. 그림을 누르면 바로 그리기를 시작해요!</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {scenes.map((scene, i) => (
          <SceneCard key={scene.id} scene={scene} index={i} />
        ))}
        <div className="flex min-h-48 items-center justify-center rounded-4xl border-2 border-dashed border-sky-haze p-6 text-center text-sm font-bold text-ink-muted">
          새로운 장면이 곧 추가돼요 ✏️
        </div>
      </div>
    </PageLayout>
  );
}
