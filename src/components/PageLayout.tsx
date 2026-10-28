// 모든 하위 페이지가 같이 쓰는 틀: 배경, 가운데 정렬된 본문 폭, 상단의 "← 뒤로" 버튼과 제목.
import type { ReactNode } from "react";
import { navigate } from "../router";
import DorobusBackdrop from "./DorobusBackdrop";

type Props = {
  title: string;
  wide?: boolean;
  /** 뒤로 가기 버튼이 갈 곳 (기본: 메인) */
  back?: { path: string; label: string };
  children?: ReactNode;
};

export default function PageLayout({ title, wide, back = { path: "/", label: "메인으로" }, children }: Props) {
  const backgroundCharacter: { image: string; label: string; tone: string } | null = title.includes("스토리")
    ? { image: "/assets/dorobus/drawing/rico-pose.png", label: "스토리보드를 그리는 리코", tone: "bg-violet-200/35" }
    : title.includes("도감")
      ? { image: "/assets/dorobus/drawing/naty-pose.png", label: "자연 관찰 그림을 그리는 네이티", tone: "bg-sky-200/40" }
      : title.includes("리더보드")
        ? { image: "/assets/dorobus/drawing/xylo-pose.png", label: "그림을 검토하는 자일로", tone: "bg-amber-200/35" }
        : title.includes("설정")
          ? { image: "/assets/dorobus/drawing/jero-pose.png", label: "스케치하는 제로", tone: "bg-blue-200/35" }
          : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#eef7ff] px-5 py-5 text-ink sm:px-8">
      <DorobusBackdrop dense />
      {backgroundCharacter && (
        <div className="pointer-events-none absolute right-[-2rem] top-20 z-0 h-64 w-48 opacity-20 lg:bottom-0 lg:top-auto lg:h-[min(52vh,540px)] lg:w-[min(34vw,420px)] lg:opacity-100" aria-hidden="true">
          <span className={`absolute bottom-8 right-3 h-[72%] w-[85%] rounded-full blur-3xl ${backgroundCharacter.tone}`} />
          <img src={backgroundCharacter.image} alt={backgroundCharacter.label} className="relative h-full w-full object-contain drop-shadow-2xl" />
        </div>
      )}
      <div className={`relative mx-auto w-full ${wide ? "max-w-7xl" : "max-w-5xl"}`}>
        <header className="mb-7 flex flex-wrap items-center gap-3 rounded-[1.75rem] border border-white bg-white/90 px-3 py-2 shadow-card backdrop-blur sm:px-5">
          <button type="button" onClick={() => navigate("/studio")} className="flex items-center gap-1.5 px-2 text-lg font-black tracking-[-0.04em] text-[#64a5ff]">
            <span className="text-xl">💨</span><span className="hidden sm:inline">DOROBUS</span>
          </button>
          <span className="h-7 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => navigate(back.path)}
            className="rounded-full px-4 py-2 text-sm font-bold text-sky-deep transition hover:bg-blue-50"
          >
            ← {back.label}
          </button>
          <h1 className="rounded-full bg-slate-50 px-5 py-2 text-lg font-black tracking-[-0.03em] sm:text-xl">{title}</h1>
          <span className="ml-auto hidden rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-500 sm:block">도로버스 미니게임 · AI 화실</span>
        </header>
        <div className="relative">{children}</div>
      </div>
    </main>
  );
}
