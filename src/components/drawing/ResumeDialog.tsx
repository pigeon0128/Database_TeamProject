// 이어서 그리기 창: 저장된 그림이 있을 때 이어 그릴지 새로 그릴지 묻는다 (저장·불러오기는 lib/drawingDraft).
import type { Draft } from "../../lib/drawingDraft";

/** 저장된 그림이 있을 때 이어 그릴지 새로 그릴지 묻는 창 */
export function ResumeDialog({ draft, onResume, onStartNew }: { draft: Draft; onResume: () => void; onStartNew: () => void }) {
  const when = new Date(draft.savedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div role="dialog" aria-modal="true" aria-label="이어서 그리기" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/90 bg-white p-6 text-center shadow-card-hover">
        <p className="text-4xl" aria-hidden="true">
          ✏️
        </p>
        <h2 className="mt-2 text-xl font-black">그리던 그림이 있어요</h2>
        <p className="mt-1 text-sm font-medium text-ink-muted">{when}에 그리던 그림이에요. 이어서 그릴까요?</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onStartNew} className="rounded-full bg-sky-soft py-3 text-sm font-bold hover:bg-sky-haze">
            새로 그리기
          </button>
          <button type="button" onClick={onResume} autoFocus className="rounded-full bg-ink py-3 text-sm font-bold text-white hover:bg-sky-deep">
            이어서 그리기
          </button>
        </div>
      </div>
    </div>
  );
}
