import type { ReactNode } from "react";
import { navigate } from "../router";

type MenuItem = {
  title: string;
  path: string;
  description: string;
  accent: string;
  icon: ReactNode;
};

const menuItems: MenuItem[] = [
  {
    title: "캐릭터 그리기",
    path: "/character",
    description: "나만의 캐릭터를 만들어봐요",
    accent: "bg-coral",
    icon: (
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
        <path d="M31 49 22 28l26 12M89 49l9-21-26 12" fill="#1E82DC" stroke="#363636" strokeWidth="5" strokeLinejoin="round" />
        <path d="M27 66c0-23 14-36 33-36s33 13 33 36-14 36-33 36-33-13-33-36Z" fill="#FFF9F0" stroke="#363636" strokeWidth="5" />
        <circle cx="47" cy="65" r="4" fill="#363636" />
        <circle cx="73" cy="65" r="4" fill="#363636" />
        <path d="M52 77c5 5 11 5 16 0" fill="none" stroke="#363636" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 72v5" stroke="#363636" strokeWidth="4" strokeLinecap="round" />
        <circle cx="39" cy="76" r="6" fill="#CFE6FA" />
        <circle cx="81" cy="76" r="6" fill="#CFE6FA" />
      </svg>
    ),
  },
  {
    title: "스토리 장면 그리기",
    path: "/story",
    description: "상상 속 이야기를 펼쳐봐요",
    accent: "bg-sun",
    icon: (
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
        <path d="M16 31c17-5 31-1 44 9v63c-13-10-27-14-44-9V31Z" fill="#FFF9F0" stroke="#363636" strokeWidth="5" strokeLinejoin="round" />
        <path d="M104 31c-17-5-31-1-44 9v63c13-10 27-14 44-9V31Z" fill="#FFF9F0" stroke="#363636" strokeWidth="5" strokeLinejoin="round" />
        <path d="M27 76 40 61l9 10 11-15v34c-12-7-22-10-33-8v-6Z" fill="#00E8AA" />
        <circle cx="38" cy="49" r="7" fill="#FEE500" />
        <path d="m69 75 10-11 8 8 8-12v23c-9 0-17 3-26 8V75Z" fill="#8FCEFA" />
        <path d="M29 43h19M72 46h19" stroke="#A9B3C5" strokeWidth="4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "리더보드 확인하기",
    path: "/leaderboard",
    description: "다양한 기록들을 비교하세요",
    accent: "bg-mint",
    icon: (
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
        <path d="M43 29h34v24c0 11-7 20-17 20S43 64 43 53V29Z" fill="#FEE500" stroke="#363636" strokeWidth="5" />
        <path d="M43 38H27v8c0 11 6 17 17 17M77 38h16v8c0 11-6 17-17 17M60 73v13M45 96h30M51 86h18v10H51z" fill="none" stroke="#363636" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m60 38 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1 4-8Z" fill="#FFF9F0" />
      </svg>
    ),
  },
  {
    title: "설정 및 방법",
    path: "/settings",
    description: "도움말과 설정을 확인해요",
    accent: "bg-lavender",
    icon: (
      <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
        <path d="M52 24h16l3 11c3 1 6 3 8 5l11-3 8 14-8 8v10l8 8-8 14-11-3c-2 2-5 4-8 5l-3 11H52l-3-11c-3-1-6-3-8-5l-11 3-8-14 8-8V59l-8-8 8-14 11 3c2-2 5-4 8-5l3-11Z" fill="#FFF9F0" stroke="#363636" strokeWidth="5" strokeLinejoin="round" />
        <circle cx="60" cy="64" r="14" fill="#1E82DC" stroke="#363636" strokeWidth="5" />
      </svg>
    ),
  },
];

function Cloud({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 180 90" aria-hidden="true" className={className}>
      <path d="M18 78c-10 0-16-7-16-15s7-15 16-15c3-15 16-25 32-25 5 0 10 1 14 4C72 11 86 2 103 2c24 0 43 18 45 41 17 0 30 10 30 23 0 7-5 12-13 12H18Z" fill="currentColor" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-sky-soft px-5 py-8 text-ink sm:px-8 sm:py-10">
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,var(--color-sky-haze),transparent)]" />
      <Cloud className="cloud-float absolute -left-12 top-12 w-44 text-white sm:left-8 sm:w-52" />
      <Cloud className="cloud-float-delayed absolute -right-16 top-40 w-56 text-white/80 sm:right-5 sm:top-24 sm:w-64" />
      <div className="absolute left-[8%] top-[42%] h-3 w-3 rounded-full bg-white/70" />
      <div className="absolute right-[9%] top-[55%] h-2 w-2 rounded-full bg-white/70" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center">
        <header className="mb-7 text-center sm:mb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/55 px-4 py-2 text-sm font-bold text-sky-deep shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-sun" />
            오늘은 무엇을 그려볼까요?
          </div>
          <h1 className="text-4xl font-black tracking-[-0.04em] text-ink sm:text-5xl">
            도로 AI <span className="text-sky-deep">그림</span> 그리기 프로그램
          </h1>
          <p className="mt-3 text-base font-medium text-ink-muted sm:text-lg">원하는 메뉴를 골라 즐겁게 시작해 보세요.</p>
        </header>

        <section aria-label="메인 메뉴" className="grid grid-cols-2 gap-3 sm:gap-5">
          {menuItems.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => navigate(item.path)}
              className="menu-card group relative min-h-52 overflow-hidden rounded-4xl border border-white/90 bg-white/76 p-5 text-left shadow-card backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/90 hover:shadow-card-hover focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-deep sm:min-h-64 sm:p-7"
            >
              <span className={`absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 sm:h-36 sm:w-36 ${item.accent}`} />
              <span className="relative flex h-full flex-col">
                <span className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl p-2.5 shadow-sm transition duration-300 group-hover:rotate-3 group-hover:scale-105 sm:h-28 sm:w-28 sm:p-4 ${item.accent}`}>
                  {item.icon}
                </span>
                <span className="mt-auto flex items-end justify-between gap-2">
                  <span>
                    <strong className="block text-lg font-extrabold tracking-[-0.025em] sm:text-2xl">{item.title}</strong>
                    <span className="mt-1 hidden text-sm font-medium text-ink-muted sm:block">{item.description}</span>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xl text-white transition group-hover:translate-x-1" aria-hidden="true">
                    →
                  </span>
                </span>
              </span>
              <span className="absolute left-4 top-4 text-xs font-black text-ink/25">0{index + 1}</span>
            </button>
          ))}
        </section>

        <footer className="mt-6 flex min-h-8 items-center justify-center text-center">
          <p className="text-xs font-semibold tracking-wide text-ink-muted/70">
            윤태원, 구준영, 김상봉, 이찬영, 이준수
          </p>
        </footer>
      </div>
    </main>
  );
}
