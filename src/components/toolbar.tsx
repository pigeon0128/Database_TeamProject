// 툴바 부품: 버튼, 펼쳐지는 메뉴, 메뉴 안 버튼, 구분선, 키 모양 표시. 그리기 화면과 상관없이 어디서든 쓸 수 있다.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-sky-haze bg-white px-1 font-sans text-[11px] font-bold leading-5 text-ink-muted">
      {children}
    </kbd>
  );
}

/** 툴바 사이 구분선 */
export function ToolbarDivider() {
  return <span className="mx-1 hidden h-6 w-px bg-sky-haze sm:block" aria-hidden="true" />;
}

type ToolbarButtonProps = {
  onClick?: () => void;
  title: string;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  /** 진한 바탕으로 눈에 띄게 (저장처럼 주요 동작) */
  primary?: boolean;
};

export function ToolbarButton({ onClick, title, children, active, disabled, primary }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      disabled={disabled}
      className={`flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold transition disabled:opacity-40 ${
        primary ? "bg-ink text-white shadow-sm enabled:hover:bg-sky-deep" : active ? "bg-sky-haze text-sky-deep" : "text-ink enabled:hover:bg-sky-soft"
      }`}
    >
      {children}
    </button>
  );
}

type ToolbarMenuProps = {
  /** 툴바에 보이는 버튼 내용 */
  label: ReactNode;
  title: string;
  /** 메뉴를 버튼 오른쪽 끝에 맞춘다 (툴바 오른쪽에 있는 메뉴) */
  alignRight?: boolean;
  primary?: boolean;
  /** 세로 도구 막대 안의 아이콘형 버튼으로 보이고 메뉴는 오른쪽으로 펼쳐진다 */
  compact?: boolean;
  /** 펼쳐진 메뉴 내용. close를 부르면 메뉴가 닫힌다 */
  children: (close: () => void) => ReactNode;
};

/** 누르면 아래로 펼쳐지는 툴바 메뉴. 바깥을 누르거나 Esc를 누르면 닫힌다. */
export function ToolbarMenu({ label, title, alignRight, primary, compact, children }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {compact ? (
        <button
          type="button"
          title={title}
          aria-label={title}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-14 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${open ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"}`}
        >
          {label}
        </button>
      ) : (
        <ToolbarButton title={title} active={open} primary={primary} onClick={() => setOpen((v) => !v)}>
          {label}
          <span className={`text-[10px] transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
            ▼
          </span>
        </ToolbarButton>
      )}
      {open && (
        <div
          role="menu"
          className={`absolute ${compact ? "left-full top-0 ml-2" : "top-full mt-2"} z-40 w-72 max-w-[calc(100vw-2rem)] rounded-3xl border border-white/90 bg-white p-4 text-ink shadow-card-hover ${
            compact ? "" : alignRight ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** 툴바 메뉴 안의 한 줄짜리 버튼 */
export function MenuItem({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold hover:bg-sky-soft disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
