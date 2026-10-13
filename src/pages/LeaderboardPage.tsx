// 리더보드 화면 (#/leaderboard?drawing=<id>). 그림(장면)별로 사람마다 최고 기록 1개를 순위로 보여 준다.
// 일치율이 높은 순, 같으면 빨리 그린 순. 내 기록이 10위 밖이면 표 아래에 따로 보여 준다. 데이터는 API 서버(server/)에서 받는다.
// 기록마다 그린 그림(user_artworks)이 있으면 썸네일로 보여 주고, 누르면 밑그림과 겹쳐 크게 본다.
import { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../auth";
import { findSceneByDrawing, type Scene } from "../data/scenes";
import { api, ApiError, artworkUrl, type Drawing, type LeaderboardEntry } from "../lib/api";
import { formatDate, formatDuration, formatScore } from "../lib/format";
import { loadScenePreview } from "../lib/drawing/sceneAssets";
import { navigate, usePath } from "../router";

const LIMIT = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

/** 앱의 장면 제목이 있으면 그것을, 없으면 DB 제목을 쓴다. */
const drawingTitle = (d: Drawing) => findSceneByDrawing(d.id)?.title ?? d.title;

type Board = { top: LeaderboardEntry[]; me: LeaderboardEntry | null };

/** 기록의 그림: 흐린 밑그림 위에 그린 선을 겹친 작은 그림. 누르면 크게 본다 */
function Thumbnail({ entry, guideUrl, aspect, onOpen }: { entry: LeaderboardEntry; guideUrl: string | null; aspect: number; onOpen: () => void }) {
  if (!entry.hasArtwork) return <span className="text-xs font-semibold text-ink-muted">없음</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${entry.nickname}의 그림 크게 보기`}
      className="relative block w-14 overflow-hidden rounded-xl border border-sky-haze bg-white transition hover:ring-2 hover:ring-sky-deep sm:w-24"
      style={{ aspectRatio: aspect }}
    >
      {guideUrl && <img src={guideUrl} alt="" className="absolute inset-0 h-full w-full opacity-30" />}
      <img src={artworkUrl(entry.recordId)} alt={`${entry.nickname}의 그림`} loading="lazy" className="absolute inset-0 h-full w-full" />
    </button>
  );
}

/** 그림 크게 보기: 밑그림을 켜고 끌 수 있다 */
function ArtworkViewer({ entry, scene, guideUrl, onClose }: { entry: LeaderboardEntry; scene: Scene | undefined; guideUrl: string | null; onClose: () => void }) {
  const [showGuide, setShowGuide] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${entry.nickname}의 그림`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
    >
      <figure className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-card-hover" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full bg-white" style={{ aspectRatio: scene ? scene.width / scene.height : undefined }}>
          {showGuide && guideUrl && <img src={guideUrl} alt="" className="absolute inset-0 h-full w-full opacity-50" />}
          <img src={artworkUrl(entry.recordId)} alt={`${entry.nickname}의 그림`} className={scene ? "absolute inset-0 h-full w-full" : "w-full"} />
        </div>
        <figcaption className="flex flex-wrap items-center justify-between gap-3 p-4">
          <span className="text-sm font-bold">
            {MEDALS[entry.ranking - 1] ?? `${entry.ranking}위`} {entry.nickname} · {formatScore(entry.score)}점 · {formatDuration(entry.durationMs)}
          </span>
          <span className="flex items-center gap-3">
            {guideUrl && (
              <label className="flex items-center gap-2 text-sm font-bold">
                밑그림 같이 보기
                <input type="checkbox" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} className="h-5 w-5 accent-sky-deep" />
              </label>
            )}
            <button type="button" onClick={onClose} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
              닫기
            </button>
          </span>
        </figcaption>
      </figure>
    </div>
  );
}

type RowProps = { entry: LeaderboardEntry; isMe: boolean; guideUrl: string | null; aspect: number; onOpen: () => void };

function Row({ entry, isMe, guideUrl, aspect, onOpen }: RowProps) {
  return (
    <tr className={isMe ? "bg-sun/30" : "odd:bg-white/50"}>
      <td className="py-3 pl-4 pr-2 text-center text-lg font-black tabular-nums">{MEDALS[entry.ranking - 1] ?? entry.ranking}</td>
      <td className="px-2 py-3 font-extrabold">
        {entry.nickname}
        {isMe && <span className="ml-2 rounded-full bg-sky-deep px-2 py-0.5 text-[11px] font-black text-white">나</span>}
      </td>
      <td className="px-2 py-3 text-right font-black tabular-nums text-sky-deep">{formatScore(entry.score)}</td>
      <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatDuration(entry.durationMs)}</td>
      <td className="hidden py-3 pl-2 pr-2 text-right text-sm font-medium text-ink-muted sm:table-cell">{formatDate(entry.playedAt)}</td>
      <td className="py-2 pl-1 pr-3 sm:pl-2 sm:pr-4">
        <Thumbnail entry={entry} guideUrl={guideUrl} aspect={aspect} onOpen={onOpen} />
      </td>
    </tr>
  );
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const query = new URLSearchParams(usePath().split("?")[1] ?? "");
  const requested = Number(query.get("drawing")) || null;

  const [drawings, setDrawings] = useState<Drawing[] | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.drawings().then(
      (r) => setDrawings(r.drawings),
      (e: unknown) => setError(e instanceof ApiError ? e.message : "그림 목록을 불러오지 못했어요."),
    );
  }, []);

  const selected = drawings?.find((d) => d.id === requested) ?? drawings?.[0] ?? null;

  const load = useCallback((drawingId: number) => {
    setLoading(true);
    setError(null);
    api
      .leaderboard(drawingId, LIMIT)
      .then(setBoard, (e: unknown) => setError(e instanceof ApiError ? e.message : "리더보드를 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selected) load(selected.id);
  }, [selected?.id, load]);

  const scene = selected ? findSceneByDrawing(selected.id) : undefined;
  const aspect = scene ? scene.width / scene.height : 4 / 3;

  // 그림 썸네일과 크게 보기에 깔 밑그림 (장면 고르기 화면과 같은 이미지)
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  useEffect(() => {
    setGuideUrl(null);
    if (!scene) return;
    let alive = true;
    loadScenePreview(scene).then((p) => alive && setGuideUrl(p.guideUrl), () => {});
    return () => {
      alive = false;
    };
  }, [scene]);

  const [viewing, setViewing] = useState<LeaderboardEntry | null>(null);
  const closeViewer = useCallback(() => setViewing(null), []);
  const meOutsideTop = board?.me && board.me.ranking > LIMIT ? board.me : null;

  return (
    <PageLayout title="리더보드 확인하기">
      {drawings && drawings.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="그림 고르기">
          {drawings.map((d) => (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={d.id === selected?.id}
              onClick={() => navigate(`/leaderboard?drawing=${d.id}`)}
              className={`rounded-full px-4 py-2 text-sm font-bold shadow-sm transition ${
                d.id === selected?.id ? "bg-sky-deep text-white" : "bg-white/80 text-ink hover:bg-white"
              }`}
            >
              <span className="opacity-70">{d.chapter.title} · </span>
              {drawingTitle(d)}
            </button>
          ))}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-white/90 bg-white/80 shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-haze px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{selected ? drawingTitle(selected) : "리더보드"}</h2>
            <p className="text-xs font-semibold text-ink-muted">사람마다 최고 기록 1개 · 일치율이 높은 순, 같으면 빨리 그린 순</p>
          </div>
          <div className="flex gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => load(selected.id)}
                disabled={loading}
                className="rounded-full bg-sky-soft px-4 py-2 text-sm font-bold hover:bg-sky-haze disabled:opacity-50"
              >
                ↻ 새로고침
              </button>
            )}
            {scene && (
              <button type="button" onClick={() => navigate(`/story/${scene.id}`)} className="rounded-full bg-sky-deep px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                ✏️ 이 장면 그리기
              </button>
            )}
          </div>
        </header>

        {error ? (
          <p role="alert" className="m-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {error}
          </p>
        ) : drawings && drawings.length === 0 ? (
          <p className="p-10 text-center font-bold text-ink-muted">데이터베이스에 등록된 그림이 없어요.</p>
        ) : !board ? (
          <p className="p-10 text-center font-bold text-ink-muted">불러오는 중…</p>
        ) : board.top.length === 0 ? (
          <p className="p-10 text-center font-bold text-ink-muted">아직 기록이 없어요. 첫 번째 주인공이 되어 보세요! ✏️</p>
        ) : (
          <table className={`w-full transition-opacity ${loading ? "opacity-50" : ""}`}>
            <thead>
              <tr className="text-xs font-extrabold text-ink-muted">
                <th className="w-16 py-2 pl-4 pr-2">순위</th>
                <th className="px-2 py-2 text-left">아이디</th>
                <th className="px-2 py-2 text-right">일치율</th>
                <th className="px-2 py-2 text-right">걸린 시간</th>
                <th className="hidden py-2 pl-2 pr-2 text-right sm:table-cell">날짜</th>
                <th className="py-2 pl-2 pr-4 text-left">그림</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((e) => (
                <Row key={e.userId} entry={e} isMe={e.userId === user?.id} guideUrl={guideUrl} aspect={aspect} onOpen={() => setViewing(e)} />
              ))}
              {meOutsideTop && (
                <>
                  <tr>
                    <td colSpan={6} className="py-1 text-center text-ink-muted">
                      ⋮
                    </td>
                  </tr>
                  <Row entry={meOutsideTop} isMe guideUrl={guideUrl} aspect={aspect} onOpen={() => setViewing(meOutsideTop)} />
                </>
              )}
            </tbody>
          </table>
        )}
      </section>

      {viewing && <ArtworkViewer entry={viewing} scene={scene} guideUrl={guideUrl} onClose={closeViewer} />}

      {board && !board.me && !error && (
        <p className="mt-3 text-center text-sm font-semibold text-ink-muted">아직 이 장면의 내 기록이 없어요.</p>
      )}
    </PageLayout>
  );
}
