import { useState, type ReactNode } from "react";
import { useAuth } from "../auth";
import DorobusMainCharacter, { type DorobusMainCharacterName } from "../components/DorobusMainCharacter";
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
};

const modes: Mode[] = [
  { id: "character", title: "캐릭터 그리기", description: "나만의 캐릭터를 자유롭게 만들어요.", detail: "이름을 짓고 자유롭게 그린 뒤 작품을 저장해 보세요. 정답이나 점수 없이 아이디어와 표현력을 키우는 모드입니다.", path: "/character", icon: "🐱", difficulty: "자유", time: "5~15분", color: "bg-blue-50", guide: "codex", illustration: "/assets/dorobus/studio/codex-drawing-hero.png", pose: "/assets/dorobus/drawing/codex-pose.png" },
  { id: "story", title: "스토리 장면 그리기", description: "이야기를 읽고 다음 장면을 상상해요.", detail: "제시된 이야기와 장면을 살펴본 뒤, 이어질 순간을 그림으로 완성합니다. 작품은 이야기 컬렉션에 기록됩니다.", path: "/story", icon: "📖", difficulty: "보통", time: "10~20분", color: "bg-amber-50", guide: "rico", illustration: "/assets/dorobus/studio/rico-drawing-hero.png", pose: "/assets/dorobus/drawing/rico-pose.png" },
  { id: "creature", title: "도감 생물 그리기", description: "생물의 특징을 관찰하며 도감을 채워요.", detail: "도감 속 생물을 골라 윤곽을 따라 그리고 정확도 점수를 얻습니다. 완성한 생물은 나만의 도감에 수집됩니다.", path: "/creatures", icon: "🌿", difficulty: "쉬움", time: "5~10분", color: "bg-emerald-50", guide: "naty", illustration: "/assets/dorobus/studio/naty-drawing-hero.png", pose: "/assets/dorobus/drawing/naty-pose.png" },
  { id: "paint3d", title: "3D 색칠하기", description: "3D 오브젝트를 돌려 보며 스프레이로 칠해요.", detail: "먼저 칠할 3D 오브젝트(캐릭터, 탈것, 집 등)를 하나 고른 뒤, 360도로 돌려 가며 스프레이로 칠해 보세요. 완성하면 수납해서 마이룸에 배치할 수 있습니다.", path: "/paint3d", icon: "🧊", difficulty: "자유", time: "5~15분", color: "bg-violet-50", guide: "codex", illustration: "/assets/dorobus/studio/codex-drawing-hero.png", pose: "/assets/dorobus/drawing/codex-pose.png" },
];

function StudioHeader() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[86px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <button type="button" onClick={() => navigate("/")} className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm hover:border-blue-200 hover:text-blue-600">
          <span aria-hidden="true">‹</span><span className="text-blue-500">DOROBUS</span><span className="hidden sm:inline">메인으로</span>
        </button>
        <nav className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 gap-10 md:flex" aria-label="AI 화실 메뉴">
          <button type="button" className="border-b-4 border-blue-500 px-1 pb-6 pt-7 font-black text-blue-500">연습</button>
          <button type="button" onClick={() => navigate("/character")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">자유 그리기</button>
          <button type="button" onClick={() => navigate("/leaderboard")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">랭킹</button>
          <button type="button" onClick={() => navigate("/settings")} className="border-b-4 border-transparent px-1 pb-6 pt-7 font-black text-slate-600 hover:text-blue-500">설정</button>
        </nav>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 lg:inline">💠 1,000</span>
          <span className="hidden rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-blue-500 sm:inline">Lv. 1</span>
          {user && <button type="button" onClick={logout} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">🐇 {user.loginId}⌄</button>}
        </div>
      </div>
    </header>
  );
}

export default function StudioPage() {
  const [selectedId, setSelectedId] = useState<Mode["id"]>("character");
  const selected = modes.find((mode) => mode.id === selectedId) ?? modes[0];
  const guideDecorationClass = selected.guide === "naty"
    ? "-bottom-4 -right-6 h-72 w-48"
    : "-bottom-16 -right-7 h-52 w-44";

  return (
    <main className="min-h-screen bg-[#f4f8fc] text-[#151b2c]">
      <StudioHeader />
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
              {[{ icon: "🖼️", label: "완성 작품", value: "0개", tone: "bg-amber-50" }, { icon: "🎯", label: "최고 점수", value: "-", tone: "bg-blue-50" }, { icon: "📋", label: "수집 도감", value: "0개", tone: "bg-rose-50" }].map((item) => (
                <div key={item.label} className={`rounded-2xl p-3 text-center sm:p-4 ${item.tone}`}><span className="text-2xl">{item.icon}</span><p className="mt-2 text-xs font-bold text-slate-400">{item.label}</p><strong className="mt-1 block text-xl font-black sm:text-2xl">{item.value}</strong></div>
              ))}
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex justify-between text-sm font-bold"><span className="text-slate-500">화실 레벨 <strong className="text-slate-900">Lv. 1</strong></span><span>다음 레벨까지 <strong>5 EXP</strong></span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-[8%] rounded-full bg-blue-500" /></div>
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
          </section>

          <section className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white p-6 pb-32 shadow-sm sm:p-8 sm:pb-36">
            <h2 className="text-2xl font-black tracking-[-0.04em]">선택한 연습</h2>
            <div className="mt-5 flex items-center gap-4"><img src={selected.illustration} alt={`${selected.title}을 하는 Dorobus 캐릭터`} className="h-20 w-28 shrink-0 rounded-2xl object-cover shadow-sm" /><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-black">{selected.title}</h3><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-black text-emerald-700">{selected.difficulty}</span></div><p className="mt-1 text-sm font-semibold text-slate-500">{selected.description}</p></div></div>
            <p className="mt-5 text-sm font-semibold leading-6 text-slate-600">{selected.detail}</p>
            <dl className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm font-bold">
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">☆ 난이도</dt><dd>{selected.difficulty}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">◷ 추천 활동 시간</dt><dd>{selected.time}</dd></div>
              <div className="flex justify-between px-4 py-3"><dt className="text-slate-400">♕ 완성 기록</dt><dd>기록 없음</dd></div>
            </dl>
            <button type="button" onClick={() => navigate(selected.path)} className="relative z-10 mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 font-black text-white transition hover:bg-blue-600">{selected.id === "paint3d" ? "오브젝트 고르러 가기" : `${selected.title} 시작하기`} →</button>
            <div className={`pointer-events-none absolute opacity-35 ${guideDecorationClass}`}><DorobusMainCharacter character={selected.guide} label={`Dorobus ${selected.title} 안내 캐릭터`} className="h-full w-full" /></div>
          </section>
        </div>
      </div>
    </main>
  );
}
