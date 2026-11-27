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

/** 꾹 누르고 있어야 하는 시간 (ms) */
const HOLD_MS = 1000;

/**
 * 꾹 눌러야 실행되는 버튼 (전체 지우기처럼 되돌리기 어려운 동작의 안전장치).
 * 누르고 있으면 버튼 안에 빨간 게이지가 왼쪽부터 차고, 다 차면 onConfirm. 중간에 떼면 게이지가 빠르게 비워진다.
 * 짧게 누르면 "꾹 눌러요" 안내를 잠깐 보여 준다. 키보드는 Space/Enter 를 누르고 있으면 된다.
 */
export function HoldToConfirmButton({
  onConfirm,
  title,
  children,
  disabled,
  holdMs = HOLD_MS,
  hintText = "꾹 누르고 있으면 실행돼요",
}: {
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  holdMs?: number;
  /** 짧게 눌렀을 때 잠깐 보여 주는 안내 */
  hintText?: string;
}) {
  // 게이지는 CSS 전환(transition)으로 움직이고, 실행은 타이머로 정한다 (화면 새로 그리기가 느려도 시간은 정확하게).
  //   누르는 중: 남은 시간 동안 100% 까지 일정한 속도로
  //   뗐을 때: 지금 위치에서 0% 까지 빠르게 (채우는 속도의 4배). 다시 누르면 남은 만큼만 더 누르면 된다
  const [gauge, setGauge] = useState<{ to: number; ms: number }>({ to: 0, ms: 0 });
  const [hint, setHint] = useState(false);
  const holding = useRef(false);
  /** 눌렀을 때의 게이지 위치(0~1)와 시각: 뗐을 때 지금 위치를 계산한다 */
  const holdFrom = useRef({ progress: 0, at: 0 });
  /** 뗀 뒤 비워지는 중의 시작 위치와 시각 */
  const drainFrom = useRef({ progress: 0, at: 0 });
  const confirmTimer = useRef(0);
  const hintTimer = useRef(0);
  useEffect(() => () => (window.clearTimeout(confirmTimer.current), window.clearTimeout(hintTimer.current)), []);

  /** 지금 게이지 위치 (0~1) */
  const current = () => {
    const now = performance.now();
    if (holding.current) return Math.min(1, holdFrom.current.progress + (now - holdFrom.current.at) / holdMs);
    return Math.max(0, drainFrom.current.progress - ((now - drainFrom.current.at) / holdMs) * 4);
  };

  const start = () => {
    if (disabled || holding.current) return;
    const from = current();
    holding.current = true;
    holdFrom.current = { progress: from, at: performance.now() };
    setHint(false);
    const left = (1 - from) * holdMs;
    setGauge({ to: 1, ms: left });
    confirmTimer.current = window.setTimeout(() => {
      holding.current = false;
      drainFrom.current = { progress: 0, at: performance.now() };
      setGauge({ to: 0, ms: 0 });
      onConfirm();
    }, left);
  };

  const cancel = () => {
    if (!holding.current) return;
    const now = current();
    holding.current = false;
    window.clearTimeout(confirmTimer.current);
    drainFrom.current = { progress: now, at: performance.now() };
    setGauge({ to: 0, ms: (now * holdMs) / 4 });
    // 거의 바로 뗐으면 꾹 눌러야 한다고 알려 준다
    if (now < 0.25) {
      setHint(true);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHint(false), 1600);
    }
  };
  const active = gauge.to > 0;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        title={`${title} (꾹 누르기)`}
        aria-label={`${title}: 꾹 누르고 있으면 실행돼요`}
        disabled={disabled}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // 누른 채 버튼 밖으로 나가도 떼기 전까지는 계속 센다
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // 잡을 수 없는 포인터면 그냥 센다
          }
          start();
        }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") cancel();
        }}
        onBlur={cancel}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative flex h-10 touch-none select-none items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors disabled:opacity-40 ${
          active ? "text-rose-700" : "text-ink enabled:hover:bg-rose-50"
        }`}
      >
        {/* 빨간 게이지 */}
        <span
          className="pointer-events-none absolute inset-y-0 left-0 bg-rose-400/45"
          style={{ width: `${gauge.to * 100}%`, transition: `width ${gauge.ms}ms linear` }}
          aria-hidden="true"
        />
        <span className="relative flex items-center gap-1.5">{children}</span>
      </button>
      {hint && (
        <span role="status" className="absolute left-1/2 top-full z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-3 py-1 text-xs font-bold text-white shadow-lg">
          {hintText}
        </span>
      )}
    </span>
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
  /** true 가 되면 메뉴를 펼친다 */
  autoOpen?: boolean;
  /** 펼친 메뉴의 너비 (Tailwind 클래스, 기본 w-72) */
  menuWidth?: string;
  /** 펼쳐진 메뉴 내용. close를 부르면 메뉴가 닫힌다 */
  children: (close: () => void) => ReactNode;
};

/** 누르면 아래로 펼쳐지는 툴바 메뉴. 바깥을 누르거나 Esc를 누르면 닫힌다. */
export function ToolbarMenu({ label, title, alignRight, primary, compact, autoOpen, menuWidth = "w-72", children }: ToolbarMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // autoOpen 이 true 가 되면 한 번 펼친다 (다른 화면에서 이 메뉴를 바로 쓰라고 보냈을 때)
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

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
          className={`flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold transition ${open ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"}`}
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
          className={`absolute ${compact ? "left-full top-0 ml-2" : "top-full mt-2"} z-40 ${menuWidth} max-w-[calc(100vw-2rem)] rounded-3xl border border-white/90 bg-white p-4 text-ink shadow-card-hover ${
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
