// 도감 생물 그리기 화면 (#/creatures). 동물·식물·무생물별로 생물 밑그림을 보여 준다.
// 아직 그리기 화면과 도감 정보는 없다 (카드는 "준비 중").
import PageLayout from "../components/PageLayout";
import { CATEGORY_LABELS, creatures, CREATURE_GUIDE_SIZE, type CreatureCategory } from "../data/creatures";

export default function CreaturePage() {
  const { width, height } = CREATURE_GUIDE_SIZE;
  return (
    <PageLayout title="도감 생물 그리기" wide>
      <p className="mb-4 text-sm font-medium text-ink-muted">따라 그릴 생물을 둘러보세요. 그리기와 도감 정보는 곧 열려요!</p>
      <div className="space-y-6">
        {(Object.keys(CATEGORY_LABELS) as CreatureCategory[]).map((category) => (
          <section key={category}>
            <h2 className="mb-2 text-lg font-black tracking-[-0.02em]">{CATEGORY_LABELS[category]}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {creatures
                .filter((c) => c.category === category)
                .map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-3xl border border-white/90 bg-white/80 shadow-card">
                    <img src={c.guide} alt={`${c.name} 밑그림`} className="block w-full" style={{ aspectRatio: `${width} / ${height}` }} />
                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                      <strong className="text-sm font-extrabold">{c.name}</strong>
                      <span className="rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-bold text-ink-muted">준비 중</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
