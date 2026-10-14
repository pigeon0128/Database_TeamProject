// 도감 카드: 생물 이름·분류·정보·그릴 때 살펴볼 점과 내 수집 현황. 그리기 화면 오른쪽 패널(좁은 화면은 📖 메뉴)에 보여 준다.
import { CATEGORY_LABELS } from "../../data/creatures";
import type { CreatureEntry } from "../../lib/api";
import { formatDuration, formatScore } from "../../lib/format";

export function CreatureInfo({ creature }: { creature: CreatureEntry }) {
  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-black tracking-[-0.02em]">{creature.name}</h2>
        <span className="shrink-0 rounded-full bg-lavender/60 px-2.5 py-0.5 text-xs font-bold">{CATEGORY_LABELS[creature.category]}</span>
      </div>
      <p className="mt-1 font-medium text-ink-muted">{creature.summary}</p>

      <dl className="mt-4 space-y-2">
        {creature.facts.map((f) => (
          <div key={f.label}>
            <dt className="text-xs font-extrabold text-sky-deep">{f.label}</dt>
            <dd className="font-medium leading-snug">{f.content}</dd>
          </div>
        ))}
      </dl>

      {creature.tips.length > 0 && (
        <div className="mt-4 rounded-2xl bg-sun/25 p-3">
          <h3 className="mb-1 text-xs font-extrabold">✏️ 그릴 때 살펴볼 점</h3>
          <ul className="list-disc space-y-1 pl-4 font-medium leading-snug">
            {creature.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs font-bold text-ink-muted">
        {creature.collected && creature.bestScore !== null
          ? `📗 수집 완료 · 최고 ${formatScore(creature.bestScore)}점${creature.bestDurationMs !== null ? ` · ${formatDuration(creature.bestDurationMs)}` : ""}`
          : "아직 수집하지 않았어요. 다 그리고 완료하면 도감에 등록돼요!"}
      </p>
    </div>
  );
}
