// 그리기 화면 틀: 위 툴바 / 왼쪽 도구 막대 + 가운데 그림판 + 오른쪽 도구 패널(ToolPanel, 그 아래 정보 패널) / 아래 상태 막대.
// 도구 막대: 펜 · 채우기 · 브러쉬 · 특수 브러쉬 · 지우개 · 스포이드 (색칠할 수 없는 화면에서는 펜·지우개만)
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { comboText } from "../../lib/drawing/shortcuts";
import { navigate } from "../../router";
import DorobusBackdrop from "../DorobusBackdrop";
import HomeLogo from "../HomeLogo";
import { ToolbarButton, ToolbarDivider } from "../toolbar";
import { CanvasControlsSlot, NARROW_SLOT, WIDE_SLOT, type SlotLayout } from "./canvasSlots";
import { DrawingCoach, type CoachCharacter, type CoachMode } from "./DrawingCoach";
import DrawingSceneDecor, { sideCharacters, type DrawingSceneDecorMode } from "./DrawingSceneDecor";
import { ToolPanel } from "./ToolPanel";
import type { DrawingTools } from "./useDrawingTools";

/** 왼쪽에 떠 있는 도구 막대의 버튼. dot 이 있으면 아이콘 옆에 지금 색을 작은 점으로 보여 준다 */
export function RailButton({
  active,
  onClick,
  label,
  shortcut,
  children,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  shortcut?: string;
  children: ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={`relative flex w-[4.5rem] flex-col items-center gap-1 rounded-2xl py-3 text-xs font-bold transition ${
        active ? "bg-ink text-white shadow-card" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      <span className="relative text-2xl leading-none">
        {children}
        {dot && <span className="absolute -bottom-0.5 -right-1.5 h-2.5 w-2.5 rounded-full border border-white" style={{ background: dot }} aria-hidden="true" />}
      </span>
      <span className={`whitespace-nowrap ${label.length > 4 ? "text-[11px] tracking-tight" : ""}`}>{label}</span>
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
  /** 정보 패널 (도감 카드 등). 툴바 오른쪽 위 "도감 설명" 버튼을 누르면 오른쪽 도구 패널 자리에 보인다 */
  aside?: ReactNode;
  /** 그림판 (TracingCanvas) */
  children: ReactNode;
  /** 기능과 점수 규칙을 단계별로 설명하는 안내 캐릭터 */
  coachMode?: CoachMode;
  /** 콘텐츠를 담당하는 도로버스 안내 캐릭터 */
  coachCharacter?: CoachCharacter;
  /** 도화지 바깥의 Dorobus 캐릭터 배경 */
  backgroundScene?: DrawingSceneDecorMode;
  /** 그림판 오른쪽 위 바깥 버튼 자리에 더할 버튼 (확대·축소 아래, 접힌 도움말 위. 예: AI 조언) */
  canvasExtra?: ReactNode;
};

/**
 * 그리기 화면 틀. 화면 전체를 쓰고 스크롤 없이 한 화면에 들어온다.
 *   위: 툴바 (메뉴를 누르면 굵기 조절 바, 밑그림 설정, 단축키 등이 펼쳐진다)
 *   가운데: 왼쪽 도구 막대(브러쉬/지우개) + 남은 공간을 꽉 채우는 그림판
 *   아래: 상태 막대 (점수, 도움말 등)
 */
export function DrawingShell({
  tools,
  back,
  toolbarStart,
  toolbarEnd,
  aspect,
  footer,
  aside,
  children,
  coachMode,
  coachCharacter = "codex",
  backgroundScene = "free",
  canvasExtra,
}: DrawingShellProps) {
  const { tool, setTool, paintable, paintColor } = tools;
  /** 오른쪽에 도구 패널 대신 정보 패널(도감 설명)을 보이는지 */
  const [showInfo, setShowInfo] = useState(false);
  /** 그림판 오른쪽 위 바깥의 버튼 자리: 확대·축소 버튼(TracingCanvas)과 접힌 도움말 버튼(DrawingCoach) */
  const [zoomSlot, setZoomSlot] = useState<HTMLDivElement | null>(null);
  const [coachSlot, setCoachSlot] = useState<HTMLDivElement | null>(null);
  // 그림판 옆 빈자리 폭을 재서 버튼 모양을 고른다 (canvasSlots.ts). 창 크기·그림 비율이 바뀌면 다시 잰다.
  const columnRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [slotLayout, setSlotLayout] = useState<SlotLayout>("wide");
  /** 그림판 오른쪽 빈자리 폭 (px). 안내 캐릭터 크기를 맞춘다 */
  const [sideGap, setSideGap] = useState(0);
  useEffect(() => {
    const column = columnRef.current;
    const board = boardRef.current;
    if (!column || !board) return;
    const measure = () => {
      const gap = (column.clientWidth - board.clientWidth) / 2;
      setSideGap(gap);
      setSlotLayout(gap >= WIDE_SLOT ? "wide" : gap >= NARROW_SLOT ? "narrow" : "inside");
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(column);
    observer.observe(board);
    return () => observer.disconnect();
  }, []);
  const side = sideCharacters[backgroundScene];
  /** 안내 캐릭터를 세울 만한 빈자리 폭 (px). 이보다 좁으면 숨긴다 */
  const SIDE_MIN = 90;
  /** AI 조언 말풍선이 떠 있는 동안 코덱스 도움말을 잠근다 (말풍선이 같은 자리에 겹친다) */
  const [coachLocked, setCoachLocked] = useState(false);
  const slotContext = useMemo(() => ({ slot: zoomSlot, layout: slotLayout, lockCoach: setCoachLocked }), [zoomSlot, slotLayout]);
  const infoOpen = !!aside && showInfo;
  return (
    // 흰 바탕에 옅은 회색 점무늬(화이트보드 느낌), 그 위에 반투명 흰 카드와 진한 글자
    <div
      className="relative flex h-dvh flex-col gap-3 overflow-hidden bg-[#eef7ff] p-3 text-ink"
    >
      <DorobusBackdrop />
      <DrawingSceneDecor mode={backgroundScene} />
      <header className="relative z-30 flex flex-wrap items-center gap-1 rounded-3xl border border-white/90 bg-white/76 px-2 py-1.5 shadow-card backdrop-blur-sm">
        <HomeLogo textClassName="hidden xl:inline" />
        {back.path !== "/" && (
          <>
            <ToolbarDivider />
            <ToolbarButton title={back.label} onClick={() => navigate(back.path)}>
              ← <span className="hidden sm:inline">{back.label}</span>
            </ToolbarButton>
          </>
        )}
        <ToolbarDivider />
        {toolbarStart}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {aside && (
            <ToolbarButton title={infoOpen ? "그리기 도구 보기" : "도감 설명 보기"} onClick={() => setShowInfo((v) => !v)}>
              {infoOpen ? "🎨 그리기 도구" : "📖 도감 설명"}
            </ToolbarButton>
          )}
          {toolbarEnd}
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 gap-3">
        <nav
          aria-label="그리기 도구"
          className="relative z-20 flex flex-col gap-1.5 self-start rounded-3xl border border-white/90 bg-white/76 p-2 shadow-card backdrop-blur-sm"
        >
          <RailButton label="펜" shortcut={comboText(tools.keys.brush)} active={tool === "pen"} onClick={() => setTool("pen")}>
            ✏️
          </RailButton>
          {paintable && (
            <>
              <RailButton label="채우기" active={tool === "fill"} onClick={() => setTool("fill")} dot={paintColor}>
                🪣
              </RailButton>
              <RailButton label="브러쉬" active={tool === "brush"} onClick={() => setTool("brush")} dot={paintColor}>
                🖌️
              </RailButton>
              <RailButton label="특수 브러쉬" active={tool === "special"} onClick={() => setTool("special")}>
                ✨
              </RailButton>
            </>
          )}
          <RailButton label="지우개" shortcut={comboText(tools.keys.eraser)} active={tool === "eraser"} onClick={() => setTool("eraser")}>
            🧽
          </RailButton>
          {paintable && (
            <RailButton label="스포이드" active={tool === "picker"} onClick={() => setTool("picker")}>
              💧
            </RailButton>
          )}
        </nav>
        {/* 남은 공간 안에서 비율을 지키며 그림판을 최대한 크게 */}
        <div ref={columnRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center [container-type:size]">
          <div ref={boardRef} className="relative" style={{ width: `min(100cqw, calc(100cqh * ${aspect}))` }}>
            <CanvasControlsSlot.Provider value={slotContext}>{children}</CanvasControlsSlot.Provider>
            {/* 그림판 오른쪽 위 바깥: 확대·축소 버튼, 그 아래 접힌 도움말 버튼 (그림도 오른쪽 도구 패널도 가리지 않는다).
                빈자리가 거의 없으면 그림판 안 오른쪽 위에 둔다 */}
            <div
              className={`absolute z-10 flex flex-col gap-2 ${
                slotLayout === "inside" ? "right-2 top-2 items-end" : "left-full top-0 ml-2 items-start"
              }`}
            >
              <div ref={setZoomSlot} />
              {canvasExtra && <CanvasControlsSlot.Provider value={slotContext}>{canvasExtra}</CanvasControlsSlot.Provider>}
              <div ref={setCoachSlot} />
            </div>
            {side && slotLayout !== "inside" && sideGap >= SIDE_MIN && (
              // 안내 캐릭터: 그림판 오른쪽 빈자리 아래쪽에, 도감 그리기의 배경 캐릭터(NATY)처럼 연하게.
              // 얼굴을 빈자리 가운데에 맞추고, 빈자리보다 큰 몸은 그림판과 도구 패널 뒤로 들어간다 (-z-10, 클릭도 막지 않는다)
              <div
                className={`pointer-events-none absolute bottom-0 -z-10 hidden opacity-[0.30] md:block xl:opacity-[0.42] ${side.size}`}
                // 빈자리 가운데보다 살짝 오른쪽 (빈자리가 좁으면 덜 옮겨 얼굴이 패널에 가리지 않게)
                style={{ left: `calc(100% + ${sideGap / 2 + Math.min(48, sideGap * 0.25)}px)`, transform: `translateX(-${side.faceX * 100}%)` }}
                aria-hidden="true"
              >
                <span className={`absolute inset-[18%] rounded-full blur-3xl ${side.glow}`} />
                <img src={side.src} alt="" className="relative h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(52,95,145,0.16)]" />
              </div>
            )}
          </div>
        </div>
        {/* 오른쪽: 고른 도구의 설정 (굵기, 색, 특수 브러쉬). "도감 설명"을 누르면 그 자리에 정보 패널(도감 카드)이 대신 보인다 */}
        {infoOpen ? (
          <aside aria-label="도감 설명" className="relative z-20 w-72 shrink-0 overflow-y-auto rounded-3xl border border-white/90 bg-white/90 p-4 shadow-card backdrop-blur-sm">
            {aside}
          </aside>
        ) : (
          <aside
            aria-label="도구 설정"
            className="relative z-20 w-64 shrink-0 self-start overflow-y-auto rounded-3xl border border-white/90 bg-white/90 p-4 shadow-card backdrop-blur-sm"
            style={{ maxHeight: "100%" }}
          >
            <ToolPanel tools={tools} />
          </aside>
        )}
        {coachMode && <DrawingCoach mode={coachMode} character={coachCharacter} foldedSlot={coachSlot} compact={slotLayout !== "wide"} locked={coachLocked} />}
      </div>

      {footer && (
        <footer className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-2xl border border-white/90 bg-white/76 px-3 py-1.5 shadow-card backdrop-blur-sm">{footer}</footer>
      )}
    </div>
  );
}
