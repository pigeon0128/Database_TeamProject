// 메인 화면 (#/, 예전 주소 #/studio). AI 화실: 그리기 모드(캐릭터·스토리·도감·3D 색칠)를 고르고,
// "내 그림 요약"·레벨·셀·모드별 완성 기록은 /api/summary 의 실제 기록으로 채운다.
// 위쪽 메뉴와 아래 "더 둘러보기" 카드로 리더보드·마이룸·기프트샵·설정에 간다. 다른 화면의 DOROBUS 로고와 "메인으로"는 모두 여기로 돌아온다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import CellIcon from "../components/CellIcon";
import DorobusMainCharacter, { type DorobusMainCharacterName } from "../components/DorobusMainCharacter";
import GiftShopIcon from "../components/GiftShopIcon";
import { api, type UserSummary } from "../lib/api";
import { navigate } from "../router";

type Mode = {
  id: "character" | "story" | "creature" | "paint3d";
  title: string;
  description: string;
  detail: string;
  path: string;
  icon: ReactNode;
  difficulty: string;
  time: string;
  color: string;
  guide: DorobusMainCharacterName;
  illustration: string;
  pose: string;
  decoration?: string;
  cta?: string;
};

const modes: Mode[] = [
  { id: "character", title: "캐릭터 그리기", description: "나만의 캐릭터를 자유롭게 만들어요.", detail: "이름을 짓고 자유롭게 그린 뒤 작품을 저장해 보세요. 정답이나 점수 없이 아이디어와 표현력을 키우는 모드입니다.", path: "/character", icon: "🐱", difficulty: "자유", time: "5~15분", color: "bg-blue-50", guide: "codex", illustration: "/assets/dorobus/studio/codex-drawing-hero.png", pose: "/assets/dorobus/drawing/codex-pose.png" },
  { id: "story", title: "스토리 장면 그리기", description: "이야기를 읽고 다음 장면을 상상해요.", detail: "제시된 이야기와 장면을 살펴본 뒤, 이어질 순간을 그림으로 완성합니다. 작품은 이야기 컬렉션에 기록됩니다.", path: "/story", icon: "📖", difficulty: "보통", time: "10~20분", color: "bg-amber-50", guide: "rico", illustration: "/assets/dorobus/studio/rico-drawing-hero.png", pose: "/assets/dorobus/drawing/rico-pose.png" },
  { id: "creature", title: "도감 생물 그리기", description: "그림이 서툰 고찰스를 도와 생태도감을 완성해요.", detail: "도로랜드 수석 생태 연구원 고찰스는 생물 지식은 풍부하지만 관찰한 모습을 그림으로 남기는 데 어려움을 겪고 있어요. 동물·식물·공룡을 자세히 관찰하고 그려서 고찰스의 생태도감에 한 장씩 채워 주세요.", path: "/creatures", icon: "🌿", difficulty: "쉬움", time: "5~10분", color: "bg-emerald-50", guide: "naty", illustration: "/assets/dorobus/drawing/gochalseu-drawing-pose.png", pose: "/assets/dorobus/drawing/gochalseu-drawing-pose.png", decoration: "/assets/dorobus/drawing/gochalseu-drawing-pose.png", cta: "고찰스의 도감 채우기 시작하기" },
  { id: "paint3d", title: "3D 색칠하기", description: "3D 오브젝트를 돌려 보며 스프레이로 칠해요.", detail: "먼저 칠할 3D 오브젝트(캐릭터, 탈것, 집 등)를 하나 고른 뒤, 360도로 돌려 가며 스프레이로 칠해 보세요. 완성하면 수납해서 마이룸에 배치할 수 있습니다.", path: "/paint3d", icon: "🧊", difficulty: "자유", time: "5~15분", color: "bg-violet-50", guide: "codex", illustration: "/assets/dorobus/studio/codex-drawing-hero.png", pose: "/assets/dorobus/drawing/codex-pose.png" },
];

const extras: { title: string; description: string; path: string; icon: ReactNode; tone: string }[] = [
  { title: "리더보드", description: "점수와 다른 친구들의 작품을 확인해요.", path: "/leaderboard", icon: "🏆", tone: "bg-amber-50" },
  { title: "마이룸", description: "완성한 작품과 3D 오브젝트로 방을 꾸며요.", path: "/myroom", icon: "🏠", tone: "bg-violet-50" },
  { title: "기프트샵", description: "특수 브러쉬를 구경하고 구매해요.", path: "/shop", icon: <GiftShopIcon className="h-full w-full p-1" />, tone: "bg-rose-50" },
  { title: "설정 및 방법", description: "단축키와 그리기 방법을 확인해요.", path: "/settings", icon: "⚙️", tone: "bg-slate-100" },
];

/** 화실 레벨 규칙: 완성 작품(일치율 80% 이상) 1개 = 1 EXP, 레벨마다 EXP_PER_LEVEL 이 필요하다 (Lv. 1에서 시작) */
const EXP_PER_LEVEL = 5;
function levelOf(summary: UserSummary | null) {
  const exp = summary?.completedArtworks ?? 0;
  return { level: Math.floor(exp / EXP_PER_LEVEL) + 1, progress: exp % EXP_PER_LEVEL, toNext: EXP_PER_LEVEL - (exp % EXP_PER_LEVEL) };
}

/** 내 그림 요약 (GET /api/summary). 불러오는 동안·실패하면 null */
function useSummary() {
  const [summary, setSummary] = useState<UserSummary | null>(null);
  useEffect(() => {
    let alive = true;
    api.summary().then((s) => { if (alive) setSummary(s); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return summary;
}

const formatScore = (score: number) => `${Number.isInteger(score) ? score : score.toFixed(1)}%`;

/** 모드별 "완성 기록" 칸 글자 */
function modeRecord(id: Mode["id"], summary: UserSummary | null) {
  if (!summary) return "…";
  switch (id) {
    case "character": return "점수 없는 자유 모드";
    case "story": return summary.storyCompleted ? `장면 ${summary.storyCompleted}개 완성` : "기록 없음";
    case "creature": return `${summary.creatureCollected} / ${summary.creatureTotal} 수집`;
    case "paint3d": return summary.storedObjects ? `오브젝트 ${summary.storedObjects}개 수납` : "기록 없음";
  }
}

/** 아이디 버튼을 누르면 보유 젬·레벨·로그아웃이 담긴 메뉴를 펼친다. 바깥을 누르거나 Esc를 누르면 닫힌다. */
function UserMenu({ loginId, onLogout, summary }: { loginId: string; onLogout: () => void; summary: UserSummary | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0 text-sm font-bold">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-full border px-3 py-2 transition ${open ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200"}`}
      >
        <span aria-hidden="true">🐇</span>
        <span className="max-w-32 truncate">{loginId}</span>
        <span aria-hidden="true" className={`text-xs transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="grid size-10 place-items-center rounded-full bg-blue-50 text-xl" aria-hidden="true">🐇</span>
            <div className="min-w-0">
              <p className="truncate font-black text-slate-900">{loginId}</p>
              <p className="text-xs font-semibold text-slate-400">AI 화실 회원</p>
            </div>
          </div>
          <dl className="space-y-2 px-4 py-3">
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2"><dt className="text-emerald-700">💠 보유 셀</dt><dd className="font-black text-emerald-700">{summary ? summary.cells.toLocaleString("ko-KR") : "…"}</dd></div>
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-3 py-2"><dt className="text-blue-500">⭐ 레벨</dt><dd className="font-black text-blue-500">Lv. {levelOf(summary).level}</dd></div>
          </dl>
          <button type="button" role="menuitem" onClick={onLogout} className="w-full border-t border-slate-100 px-4 py-3 text-left text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">로그아웃</button>
        </div>
      )}
    </div>
  );
}

/** 메인 화면 기본 크기 (1 = 100%) */
const MAIN_ZOOM = 0.8;

function StudioHeader({ summary }: { summary: UserSummary | null }) {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[86px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="DOROBUS AI 화실" className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-3 text-xl font-black tracking-[-0.04em] text-[#64a5ff]">
          <span className="text-2xl" aria-hidden="true">💨</span><span>DOROBUS</span><span className="hidden text-sm font-black text-slate-500 sm:inline">AI 화실</span>
        </button>
        <nav className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 gap-8 lg:flex" aria-label="AI 화실 메뉴">
          <button type="button" className="border-b-4 border-blue-500 px-1 pb-6 pt-7 font-black text-blue-500">연습</button>
          <button type="button" onClick={() => navigate("/character")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">자유 그리기</button>
          <button type="button" onClick={() => navigate("/leaderboard")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">랭킹</button>
          <button type="button" onClick={() => navigate("/myroom")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">마이룸</button>
          <button type="button" onClick={() => navigate("/shop")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">기프트샵</button>
          <button type="button" onClick={() => navigate("/settings")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">설정</button>
        </nav>
        {user && <UserMenu loginId={user.loginId} onLogout={logout} summary={summary} />}
      </div>
    </header>
  );
}

export default function StudioPage() {
  const [selectedId, setSelectedId] = useState<Mode["id"]>("character");
  const selected = modes.find((mode) => mode.id === selectedId) ?? modes[0];
  const summary = useSummary();
  const { level, progress, toNext } = levelOf(summary);
  const stats = [
    { icon: "🖼️", label: "완성 작품", value: summary ? `${summary.completedArtworks}개` : "…", tone: "bg-amber-50" },
    { icon: "🎯", label: "최고 점수", value: !summary ? "…" : summary.bestScore === null ? "-" : formatScore(summary.bestScore), tone: "bg-blue-50" },
    { icon: "📋", label: "수집 도감", value: summary ? `${summary.creatureCollected}개` : "…", tone: "bg-rose-50" },
  ];
  const guideDecorationClass = selected.decoration
    ? "bottom-0 right-2 h-36 w-36"
    : selected.guide === "naty"
      ? "-bottom-4 -right-6 h-72 w-48"
      : "-bottom-16 -right-7 h-52 w-44";

  return (
    // 메인 화면은 기본으로 80% 크기로 보여 준다 (CSS zoom). 줄어든 만큼 최소 높이를 늘려 바탕이 화면을 꽉 채우게 한다.
    <main className="bg-[#f4f8fc] text-[#151b2c]" style={{ zoom: MAIN_ZOOM, minHeight: `calc(100vh / ${MAIN_ZOOM})` }}>
      <StudioHeader summary={summary} />
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
          <section className="relative min-h-[370px] overflow-hidden rounded-[1.7rem] border border-blue-200 bg-[linear-gradient(120deg,#f5faff,#e4f2ff)] p-7 sm:p-10">
            <img src="/assets/dorobus/studio/codex-drawing-hero.png" alt="책상에서 그림을 그리는 코덱스" className="absolute inset-0 h-full w-full object-cover object-center" />
            <span className="absolute inset-0 bg-[linear-gradient(90deg,rgba(242,249,255,.98)_0%,rgba(242,249,255,.94)_42%,rgba(242,249,255,.28)_68%,rgba(242,249,255,.03)_100%)]" />
            <div className="relative z-10 max-w-[62%] sm:max-w-[52%]">
              <span className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-blue-500 shadow-sm">추천 그리기</span>
              <h1 className="mt-5 text-3xl font-black tracking-[-0.05em] sm:text-5xl">오늘의 추천 연습</h1>
              <p className="mt-4 text-sm font-semibold leading-7 text-slate-600 sm:text-base">처음이라면 <strong className="text-blue-600">캐릭터 그리기</strong>로 시작해 보세요.<br className="hidden sm:block" /> 정답 없이 나만의 생각을 표현하는 기초 창작 단계입니다.</p>
              <button type="button" onClick={() => navigate("/character")} className="mt-5 rounded-2xl bg-blue-500 px-6 py-4 font-black text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-blue-600">추천 연습 시작하기　→</button>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-black tracking-[-0.04em]">내 그림 요약</h2><button type="button" onClick={() => navigate("/leaderboard")} className="text-sm font-black text-blue-500">상세 보기 →</button></div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {stats.map((item) => (
                <div key={item.label} className={`rounded-2xl p-3 text-center sm:p-4 ${item.tone}`}><span className="text-2xl">{item.icon}</span><p className="mt-2 text-xs font-bold text-slate-400">{item.label}</p><strong className="mt-1 block text-xl font-black sm:text-2xl">{item.value}</strong></div>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">화실 레벨 <strong className="text-slate-900">Lv. {level}</strong></span><span>다음 레벨까지 <strong>{toNext} EXP</strong></span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500 transition-[width]" style={{ width: `${(progress / EXP_PER_LEVEL) * 100}%` }} /></div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(330px,1fr)]">
          <section className="rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-2xl font-black tracking-[-0.04em]">그리기 모드</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">오늘 만들고 싶은 작품을 선택해 보세요.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {modes.map((mode) => {
                const active = mode.id === selected.id;
                return (
                  <button key={mode.id} type="button" onClick={() => setSelectedId(mode.id)} className={`relative min-h-52 rounded-2xl border-2 p-5 text-left transition ${active ? "border-blue-500 bg-blue-50/35 shadow-sm" : "border-slate-100 hover:border-blue-200"}`}>
                    {active && <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-blue-500 text-sm font-black text-white">✓</span>}
                    <span className={`grid size-20 place-items-center overflow-hidden rounded-2xl ${mode.color}`}><img src={mode.pose} alt="" className="h-full w-full object-contain p-1" /></span>
                    <strong className="mt-5 block text-lg font-black">{mode.title}</strong>
                    <span className="mt-2 block text-sm font-semibold leading-relaxed text-slate-500">{mode.description}</span>
                    <span className="mt-4 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">{mode.difficulty}</span>
                  </button>
                );
              })}
            </div>
            {/* 그리기 모드 아래 가로 카드: AI 그림 연습실 (#/ai-studio) */}
            <button
              type="button"
              onClick={() => navigate("/ai-studio")}
              className="group mt-4 flex w-full items-center gap-4 rounded-2xl border-2 border-slate-100 bg-gradient-to-r from-violet-50 via-sky-50 to-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">🪄</span>
              <span className="min-w-0 flex-1">
                <strong className="flex items-center gap-1.5 text-lg font-black">
                  AI로 그림 생성하기 <CellIcon title="셀 사용" />
                </strong>
                <span className="mt-1 block text-sm font-semibold text-slate-500">원하는 그림을 글로 설명해 AI가 그리게 해 봐요. 프롬프트를 바꿔 가며 연습해요!</span>
              </span>
              <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-700">프롬프트 연습</span>
              <span className="shrink-0 text-xl font-black text-blue-500 transition group-hover:translate-x-1" aria-hidden="true">→</span>
            </button>
          </section>

          <section className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-6 pb-32 shadow-sm sm:p-8 sm:pb-36">
            <h2 className="text-2xl font-black tracking-[-0.04em]">선택한 연습</h2>
            <div className="mt-5 flex items-center gap-4"><img src={selected.illustration} alt={`${selected.title}을 하는 Dorobus 캐릭터`} className={`h-20 w-28 shrink-0 rounded-2xl shadow-sm ${selected.id === "creature" ? "bg-emerald-50 object-contain p-1" : "object-cover"}`} /><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black">{selected.title}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">{selected.difficulty}</span></div><p className="mt-1 text-sm font-semibold text-slate-500">{selected.description}</p></div></div>
            <p className="mt-5 text-sm font-semibold leading-6 text-slate-600">{selected.detail}</p>
            <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm font-bold">
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">☆ 난이도</dt><dd>{selected.difficulty}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">◷ 추천 활동 시간</dt><dd>{selected.time}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">♕ 완성 기록</dt><dd>{modeRecord(selected.id, summary)}</dd></div>
            </dl>
            <button type="button" onClick={() => navigate(selected.path)} className="relative z-10 mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 font-black text-white transition hover:bg-blue-600">{selected.cta ?? (selected.id === "paint3d" ? "오브젝트 고르러 가기" : `${selected.title} 시작하기`)} →</button>
            <div className={`pointer-events-none absolute opacity-35 ${guideDecorationClass}`}>
              {selected.decoration
                ? <img src={selected.decoration} alt="" className="h-full w-full object-contain object-bottom" />
                : <DorobusMainCharacter character={selected.guide} label={`Dorobus ${selected.title} 안내 캐릭터`} className="h-full w-full" />}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-label="더 둘러보기">
          <h2 className="text-2xl font-black tracking-[-0.04em]">더 둘러보기</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">완성한 작품을 자랑하고, 꾸미고, 새 브러쉬도 구경해 보세요.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {extras.map((item) => (
              <button key={item.path} type="button" onClick={() => navigate(item.path)} className="group flex items-center gap-4 rounded-2xl border-2 border-slate-100 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm">
                <span className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl text-3xl ${item.tone}`}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-lg font-black">{item.title}</strong>
                  <span className="mt-1 block text-sm font-semibold leading-snug text-slate-500">{item.description}</span>
                </span>
                <span className="text-lg font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-500" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="pb-2 pt-8 text-center text-xs font-semibold tracking-wide text-slate-400">윤태원, 구준영, 김상봉, 이찬영, 이준수</footer>
      </div>
    </main>
  );
}
