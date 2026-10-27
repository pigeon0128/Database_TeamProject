// 그리기 화면 틀: 위 툴바 / 왼쪽 도구 막대(브러쉬·지우개) + 가운데 그림판 (+ 오른쪽 정보 패널) / 아래 상태 막대.
// 색칠할 수 있는 화면(tools.paintable)에서는 브러쉬 버튼을 누르면 브러쉬 패널(BrushPanel)이 옆으로 펼쳐진다.
import { useCallback, useState, type ReactNode } from "react";
import { comboText } from "../../lib/drawing/shortcuts";
import { navigate } from "../../router";
import { ToolbarButton, ToolbarDivider } from "../toolbar";
import { BrushPanel } from "./BrushPanel";
import type { DrawingTools } from "./useDrawingTools";

/** 왼쪽에 떠 있는 도구 막대의 버튼 */
function RailButton({
  active,
  onClick,
  label,
  shortcut,
  children,
  toggle,
  more,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut: string;
  children: ReactNode;
  /** 브러쉬 패널을 여닫는 버튼 (패널의 "바깥 누르면 닫기"에서 뺀다) */
  toggle?: boolean;
  /** 옆으로 펼쳐지는 메뉴가 있으면 > 표시. true 면 펼쳐진 상태 (표시가 반대로 돈다) */
  more?: { open: boolean };
}) {
  return (
    <button
      type="button"
      data-brush-toggle={toggle || undefined}
      aria-expanded={more ? more.open : undefined}
      onClick={onClick}
      aria-pressed={active}
      title={`${label} (${shortcut})`}
      className={`relative flex w-14 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
        active ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      <span className="text-xl leading-none">{children}</span>
      {label}
      {more && (
        // 옆으로 브러쉬가 더 있다는 표시. 펼치면 반대로 돌아 "닫기"를 뜻한다
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={`absolute right-0.5 top-[38%] h-3 w-3 -translate-y-1/2 transition-transform duration-200 ${more.open ? "rotate-180" : ""}`}
        >
          <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

type DrawingShellProps = {
  tools: DrawingTools;
  /** 왼쪽 끝 버튼이 돌아갈 곳 */
  back: { path: string; label: string };
  /** 툴바 왼쪽 묶음 (제목, 굵기, 되돌리기 등) */
  toolbarStart: ReactNode;
  /** 툴바 오른쪽 묶음 (도움말, 전체 지우기, 저장 등) */
  toolbarEnd: ReactNode;
  /** 그림판 가로/세로 비율 */
  aspect: number;
  /** 아래 상태 막대 내용 */
  footer?: ReactNode;
  /** 그림판 오른쪽 정보 패널 (넓은 화면에서만 보인다, 도감 카드 등) */
  aside?: ReactNode;
  /** 그림판 (TracingCanvas) */
  children: ReactNode;
};

/**
 * 그리기 화면 틀. 화면 전체를 쓰고 스크롤 없이 한 화면에 들어온다.
 *   위: 툴바 (메뉴를 누르면 굵기 조절 바, 밑그림 설정, 단축키 등이 펼쳐진다)
 *   가운데: 왼쪽 도구 막대(브러쉬/지우개) + 남은 공간을 꽉 채우는 그림판
 *   아래: 상태 막대 (점수, 도움말 등)
 */
export function DrawingShell({ tools, back, toolbarStart, toolbarEnd, aspect, footer, aside, children }: DrawingShellProps) {
  const [brushPanel, setBrushPanel] = useState(false);
  const closeBrushPanel = useCallback(() => setBrushPanel(false), []);
  return (
    // 흰 바탕에 옅은 회색 점무늬(화이트보드 느낌), 그 위에 반투명 흰 카드와 진한 글자
    <div
      className="flex h-dvh flex-col gap-3 bg-white p-3 text-ink"
      style={{ backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1.2px)", backgroundSize: "12px 12px" }}
    >
      <header className="relative z-30 flex flex-wrap items-center gap-1 rounded-3xl border border-white/90 bg-white/76 px-2 py-1.5 shadow-card backdrop-blur-sm">
        <ToolbarButton title={back.label} onClick={() => navigate(back.path)}>
          ← <span className="hidden sm:inline">{back.label}</span>
        </ToolbarButton>
        <ToolbarDivider />
        {toolbarStart}
        <div className="ml-auto flex flex-wrap items-center gap-1">{toolbarEnd}</div>
      </header>

      <div className="flex min-h-0 flex-1 gap-3">
        <nav
          aria-label="그리기 도구"
          className="relative z-20 flex flex-col gap-1 self-start rounded-3xl border border-white/90 bg-white/76 p-1.5 shadow-card backdrop-blur-sm"
        >
          {/* 색칠할 수 있는 화면에서는 브러쉬 버튼을 누르면 옆으로 브러쉬 패널이 펼쳐진다 */}
          <RailButton
            label="브러쉬"
            toggle
            more={tools.paintable ? { open: brushPanel } : undefined}
            shortcut={comboText(tools.keys.brush)}
            active={!tools.erase}
            onClick={() => {
              tools.setErase(false);
              if (tools.paintable) setBrushPanel((open) => !open);
            }}
          >
            🖌️
          </RailButton>
          {brushPanel && <BrushPanel tools={tools} onClose={closeBrushPanel} />}
          <RailButton label="지우개" shortcut={comboText(tools.keys.eraser)} active={tools.erase} onClick={() => tools.setErase(true)}>
            🧽
          </RailButton>
        </nav>
        {/* 남은 공간 안에서 비율을 지키며 그림판을 최대한 크게 */}
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
          <div style={{ width: `min(100cqw, calc(100cqh * ${aspect}))` }}>{children}</div>
        </div>
        {aside ? (
          <aside className="hidden w-72 shrink-0 overflow-y-auto rounded-3xl border border-white/90 bg-white/76 p-4 shadow-card backdrop-blur-sm lg:block">{aside}</aside>
        ) : (
          // 그림판이 가운데 오도록 도구 막대만큼 오른쪽도 비워 둔다
          <div className="hidden w-[4.25rem] shrink-0 lg:block" aria-hidden="true" />
        )}
      </div>

      {footer && (
        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl border border-white/90 bg-white/76 px-4 py-2 shadow-card backdrop-blur-sm">{footer}</footer>
      )}
    </div>
  );
}
