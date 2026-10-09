import type { ReactNode } from "react";
import { navigate } from "../router";

type Props = {
  title: string;
  wide?: boolean;
  /** 뒤로 가기 버튼이 갈 곳 (기본: 메인) */
  back?: { path: string; label: string };
  children?: ReactNode;
};

export default function PageLayout({ title, wide, back = { path: "/", label: "메인으로" }, children }: Props) {
  return (
    <main className="min-h-screen bg-sky-soft px-5 py-8 text-ink sm:px-8">
      <div className={`mx-auto w-full ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        <header className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(back.path)}
            className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-sky-deep shadow-sm hover:bg-white"
          >
            ← {back.label}
          </button>
          <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{title}</h1>
        </header>
        {children}
      </div>
    </main>
  );
}
