// 완성 예시 창: 흰 선을 검게 칠한 완성 그림과 장면 대사를 보여 준다. 바깥을 누르면 닫힌다.
import type { Scene } from "../../data/scenes";

export function ExampleDialog({ scene, exampleUrl, onClose }: { scene: Scene; exampleUrl: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="완성 예시"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
    >
      <figure className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <img src={exampleUrl} alt={`${scene.title} 완성 예시`} className="w-full" />
        <figcaption className="flex items-center justify-between gap-3 p-4">
          <span className="text-sm font-bold">{scene.line ? `“${scene.line}”` : scene.title}</span>
          <button type="button" onClick={onClose} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
            닫기
          </button>
        </figcaption>
      </figure>
    </div>
  );
}
