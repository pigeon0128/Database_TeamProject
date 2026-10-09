import { useCallback, useEffect, useState } from "react";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../auth";
import { findSceneByDrawing } from "../data/scenes";
import { api, ApiError, type Drawing, type LeaderboardEntry } from "../lib/api";
import { formatDate, formatDuration, formatScore } from "../lib/format";
import { navigate, usePath } from "../router";

const LIMIT = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

/** 앱의 장면 제목이 있으면 그것을, 없으면 DB 제목을 쓴다. */
const drawingTitle = (d: Drawing) => findSceneByDrawing(d.id)?.title ?? d.title;

type Board = { top: LeaderboardEntry[]; me: LeaderboardEntry | null };

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <tr className={isMe ? "bg-sun/30" : "odd:bg-white/50"}>
      <td className="py-3 pl-4 pr-2 text-center text-lg font-black tabular-nums">{MEDALS[entry.ranking - 1] ?? entry.ranking}</td>
      <td className="px-2 py-3 font-extrabold">
        {entry.nickname}
        {isMe && <span className="ml-2 rounded-full bg-sky-deep px-2 py-0.5 text-[11px] font-black text-white">나</span>}
      </td>
      <td className="px-2 py-3 text-right font-black tabular-nums text-sky-deep">{formatScore(entry.score)}</td>
      <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatDuration(entry.durationMs)}</td>
      <td className="hidden py-3 pl-2 pr-4 text-right text-sm font-medium text-ink-muted sm:table-cell">{formatDate(entry.playedAt)}</td>
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
                <th className="hidden py-2 pl-2 pr-4 text-right sm:table-cell">날짜</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((e) => (
                <Row key={e.userId} entry={e} isMe={e.userId === user?.id} />
              ))}
              {meOutsideTop && (
                <>
                  <tr>
                    <td colSpan={5} className="py-1 text-center text-ink-muted">
                      ⋮
                    </td>
                  </tr>
                  <Row entry={meOutsideTop} isMe />
                </>
              )}
            </tbody>
          </table>
        )}
      </section>

      {board && !board.me && !error && (
        <p className="mt-3 text-center text-sm font-semibold text-ink-muted">아직 이 장면의 내 기록이 없어요.</p>
      )}
    </PageLayout>
  );
}
