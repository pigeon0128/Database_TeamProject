import type { ReactNode } from "react";
import { navigate } from "../router";

export default function PageLayout({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="min-h-screen bg-sky-soft px-5 py-8 text-ink sm:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="rounded-full bg-white/70 px-4 py-2 text-sm font-bold text-sky-deep shadow-sm hover:bg-white"
          >
            ← 메인으로
          </button>
          <h1 className="text-2xl font-black tracking-[-0.03em] sm:text-3xl">{title}</h1>
        </header>
        {children}
      </div>
    </main>
  );
}
