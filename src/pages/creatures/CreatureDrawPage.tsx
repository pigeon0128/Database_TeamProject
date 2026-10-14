// 도감 생물 그리기 화면 (#/creatures/<slug>). 스토리 장면과 같은 그리기·채점·기록 저장(SceneAttempts)을 쓰고,
// 오른쪽에 DB에서 받은 도감 카드(CreatureInfo)를 보여 준다. 완료하면 play_records·user_artworks 에 저장되어 도감에 수집된다.
import { useEffect, useState } from "react";
import { useAuth } from "../../auth";
import PageLayout from "../../components/PageLayout";
import { findCreatureScene } from "../../data/creatures";
import { api, ApiError, type CreatureEntry } from "../../lib/api";
import { navigate } from "../../router";
import { SceneAttempts } from "../story/StoryPage";
import { CreatureInfo } from "./CreatureInfo";

const BACK_TO_LIST = { path: "/creatures", label: "도감" };

export default function CreatureDrawPage({ slug }: { slug: string }) {
  const scene = findCreatureScene(slug);
  const { expire } = useAuth();
  const [creature, setCreature] = useState<CreatureEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.collection().then(
      (r) => {
        const found = r.creatures.find((c) => c.slug === slug);
        if (found) setCreature(found);
        else setError("도감 정보가 아직 데이터베이스에 없어요. 터미널에서 pnpm db:migrate 를 실행해 주세요.");
      },
      (e: unknown) => {
        if (e instanceof ApiError && e.status === 401) return expire();
        setError(e instanceof ApiError ? e.message : "도감 정보를 불러오지 못했어요.");
      },
    );
  }, [slug, expire]);

  if (!scene) {
    return (
      <PageLayout title="도감 생물 그리기" back={BACK_TO_LIST}>
        <div className="rounded-3xl bg-white/80 p-8 text-center shadow-card">
          <p className="font-bold">찾을 수 없는 생물이에요.</p>
          <button type="button" onClick={() => navigate("/creatures")} className="mt-4 rounded-full bg-sky-deep px-5 py-2 text-sm font-bold text-white">
            도감으로 가기
          </button>
        </div>
      </PageLayout>
    );
  }

  // 도감 정보를 못 받아도 그리기는 할 수 있다 (패널에 안내만)
  const aside = creature ? (
    <CreatureInfo creature={creature} />
  ) : (
    <p className="text-sm font-bold text-ink-muted">{error ?? "도감 정보를 불러오는 중…"}</p>
  );

  return <SceneAttempts scene={{ ...scene, title: creature?.name ?? scene.title }} back={BACK_TO_LIST} aside={aside} />;
}
