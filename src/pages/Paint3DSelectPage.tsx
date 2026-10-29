// 3D 오브젝트 고르기 화면 (#/paint3d). 색칠할 오브젝트를 하나 고르면 그 오브젝트의 색칠 화면(#/paint3d/<id>)으로 이동한다.
import PageLayout from "../components/PageLayout";
import { MODELS } from "../features/paint3d/models";
import { navigate } from "../router";

export default function Paint3DSelectPage() {
  return (
    <PageLayout title="3D 오브젝트 고르기" wide back={{ path: "/studio", label: "AI 화실" }}>
      <p className="mb-5 text-sm font-medium text-ink-muted">색칠할 오브젝트를 하나 골라 보세요. 칠한 뒤에는 수납해서 마이룸에 놓을 수 있어요!</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MODELS.map((model) => (
          <button
            key={model.id}
            type="button"
            onClick={() => navigate(`/paint3d/${model.id}`)}
            className="group flex flex-col items-center gap-3 rounded-4xl border border-white/90 bg-white/80 p-6 text-center shadow-card transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep"
          >
            <span className="grid size-24 place-items-center rounded-3xl bg-sky-soft text-6xl transition group-hover:scale-110" aria-hidden="true">{model.emoji}</span>
            <strong className="text-lg font-extrabold tracking-[-0.025em]">{model.name}</strong>
            <span className="rounded-full bg-sky-deep px-4 py-1.5 text-sm font-bold text-white transition group-hover:translate-x-1">칠하기 →</span>
          </button>
        ))}
      </div>
    </PageLayout>
  );
}
