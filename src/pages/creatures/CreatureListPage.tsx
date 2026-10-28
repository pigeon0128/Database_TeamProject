// 도감 생물 그리기 화면 (#/creatures). 도감 정보와 내 수집 현황을 DB(GET /api/collection)에서 받아
// 동물·식물·무생물별 카드로 보여 준다. 수집한 생물은 내 대표 작품을 밑그림 위에 겹쳐 보여 준다.
import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import PageLayout from "../../components/PageLayout";
import { CATEGORY_LABELS, creatureGuide, localCreatureCatalog, type CreatureCategory } from "../../data/creatures";
import { api, ApiError, artworkUrl, type CreatureEntry } from "../../lib/api";
import { formatScore } from "../../lib/format";
import { navigate } from "../../router";

const LOCAL_CREATURES: CreatureEntry[] = localCreatureCatalog.map((creature) => ({
  ...creature,
  summary: "",
  facts: [],
  tips: [],
  sources: [],
  collected: false,
  recordId: null,
  imageKey: null,
  bestScore: null,
  bestDurationMs: null,
}));

function CreatureCard({ creature }: { creature: CreatureEntry }) {
  const guide = creatureGuide(creature.slug);
  return (
    <button
      type="button"
      onClick={() => navigate(`/creatures/${creature.slug}`)}
      className="group overflow-hidden rounded-3xl border border-white/90 bg-white/80 text-left shadow-card transition hover:-translate-y-0.5 hover:bg-white hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep"
    >
      {/* 밑그림 비율이 저마다 달라서 남는 칸은 밑그림 바탕과 같은 회색으로 (수집한 그림은 흐린 밑그림 위에 그림이 잘 보이게 흰색) */}
      <span className={`relative block ${creature.collected ? "bg-white" : "bg-[#b6b6b6]"}`} style={{ aspectRatio: "4 / 3" }}>
        {guide && <img src={guide} alt="" className={`absolute inset-0 h-full w-full object-contain ${creature.collected ? "opacity-30" : ""}`} />}
        {creature.collected && creature.imageKey && (
          <img src={artworkUrl(creature.imageKey)} alt={`내가 그린 ${creature.name}`} className="absolute inset-0 h-full w-full object-contain" />
        )}
        {creature.collected && (
          <span className="absolute right-2 top-2 rotate-6 rounded-full border-2 border-emerald-600 bg-white/90 px-2 py-0.5 text-[11px] font-black text-emerald-700">
            수집 완료
          </span>
        )}
      </span>
      <span className="flex items-center justify-between gap-2 px-3 py-2">
        <strong className="truncate text-sm font-extrabold">{creature.name}</strong>
        <span className="shrink-0 text-xs font-bold text-ink-muted">
          {creature.collected && creature.bestScore !== null ? `${formatScore(creature.bestScore)}점` : "그리기 →"}
        </span>
      </span>
    </button>
  );
}

export default function CreatureListPage() {
  const { expire } = useAuth();
  const [creatures, setCreatures] = useState<CreatureEntry[] | null>(null);
  const [usingLocalCatalog, setUsingLocalCatalog] = useState(false);

  useEffect(() => {
    api.collection().then(
      (r) => setCreatures(r.creatures),
      (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return expire();
        setCreatures(LOCAL_CREATURES);
        setUsingLocalCatalog(true);
      },
    );
  }, [expire]);

  const collected = creatures?.filter((c) => c.collected).length ?? 0;

  return (
    <PageLayout title="도감 생물 그리기" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">생물을 골라 따라 그리고 완료하면 내 도감에 등록돼요!</p>
        {creatures && (
          <span className="rounded-full bg-white/80 px-4 py-1.5 text-sm font-black shadow-sm">
            📗 수집 {collected} / {creatures.length}
          </span>
        )}
      </div>

      {usingLocalCatalog && (
        <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          로컬 미리보기 모드예요. 생물을 골라 그리기는 할 수 있지만, 수집 기록·작품 저장·랭킹은 DB 서버가 연결되면 활성화돼요.
        </p>
      )}
      {!creatures && <p className="py-10 text-center text-sm font-bold text-ink-muted">도감을 불러오는 중…</p>}
      {creatures && creatures.length === 0 && (
        <p className="rounded-2xl bg-white/80 px-4 py-6 text-center text-sm font-bold text-ink-muted">
          도감에 생물이 없어요. 터미널에서 pnpm db:migrate 를 실행해 주세요.
        </p>
      )}

      {creatures && creatures.length > 0 && (
        <div className="space-y-6">
          {(Object.keys(CATEGORY_LABELS) as CreatureCategory[]).map((category) => {
            const list = creatures.filter((c) => c.category === category);
            if (!list.length) return null;
            return (
              <section key={category}>
                <h2 className="mb-2 text-lg font-black tracking-[-0.02em]">
                  {CATEGORY_LABELS[category]}{" "}
                  <span className="text-sm font-bold text-ink-muted">
                    {list.filter((c) => c.collected).length} / {list.length}
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {list.map((c) => (
                    <CreatureCard key={c.slug} creature={c} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
