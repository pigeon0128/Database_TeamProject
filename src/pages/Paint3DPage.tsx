// 3D 색칠하기 화면. 스프레이 색을 고르고, 캐릭터를 360도 돌려 가며 스프레이로 칠한 뒤 지금 보이는 모습을 PNG로 저장한다.
// 서버 없이 브라우저에서만 동작한다. three.js 처리는 paintScene.ts 에 있다.
// 화면 모양은 그리기 화면(components/drawing/DrawingShell.tsx)과 맞춘다:
//   위 툴바(이름·되돌리기 / 도움말·전체 지우기·수납·저장), 왼쪽 도구 막대, 가운데 3D 화면, 오른쪽 도구 패널(크기·농도·색), 아래 한 줄 상태 막대
import { useEffect, useRef, useState } from "react";
import DorobusBackdrop from "../components/DorobusBackdrop";
import HomeLogo from "../components/HomeLogo";
import { DrawingCoach } from "../components/drawing/DrawingCoach";
import { RailButton } from "../components/drawing/DrawingShell";
import DrawingSceneDecor, { sideCharacters } from "../components/drawing/DrawingSceneDecor";
import { Section, Swatch } from "../components/drawing/ToolPanel";
import { BASIC_COLORS, RECENT_MAX, loadRecent, saveRecent } from "../components/drawing/useDrawingTools";
import { HoldToConfirmButton, ToolbarButton, ToolbarDivider, ToolbarMenu } from "../components/toolbar";
import { downloadImage } from "../lib/download";
import { navigate } from "../router";
import { RoomError, storeInRoom } from "../features/paint3d/room";
import { makeThumbnail } from "../features/paint3d/roomExport";
import { PaintScene, type PaintMode, type PaintState, type ViewDirection } from "../features/paint3d/paintScene";

import { findModel, type ModelId } from "../features/paint3d/models";

/** 그리기 화면과 같은 색 목록 */
const PALETTE = BASIC_COLORS;
const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
/** 오른쪽 안내 캐릭터 (그리기 화면들과 같은 자리) */
const SIDE = sideCharacters.paint3d;
const SIZES = [
  { label: "작게", radius: 0.12 },
  { label: "보통", radius: 0.22 },
  { label: "크게", radius: 0.38 },
];
const STRENGTHS = [
  { label: "짙게", value: 2.2, opacity: 1 },
  { label: "보통", value: 1, opacity: 0.6 },
  { label: "옅게", value: 0.3, opacity: 0.25 },
];
const VIEWS: { id: ViewDirection; label: string }[] = [
  { id: "front", label: "정면" }, { id: "back", label: "후면" },
  { id: "left", label: "왼쪽" }, { id: "right", label: "오른쪽" },
  { id: "top", label: "위" }, { id: "bottom", label: "아래" },
];

export default function Paint3DPage({ modelId }: { modelId: ModelId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PaintScene | null>(null);
  const [state, setState] = useState<PaintState>({ canUndo: false, painted: false, part: null });
  const modelInfo = findModel(modelId)!;
  const [mode, setMode] = useState<PaintMode>("spray");
  const [color, setColor] = useState(PALETTE[6].color);
  /** 방금 쓴 색: 그리기 화면과 같은 목록 (이 브라우저에 RECENT_MAX 개까지) */
  const [recentColors, setRecentColors] = useState<string[]>(loadRecent);
  const colorRef = useRef(color);
  colorRef.current = color;
  /** 접힌 도움말 버튼 자리 (3D 화면 오른쪽 위 안쪽) */
  const [coachSlot, setCoachSlot] = useState<HTMLDivElement | null>(null);
  const [radius, setRadius] = useState(SIZES[1].radius);
  const [strength, setStrength] = useState(1);
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotationAxis, setRotationAxis] = useState<"x" | "y" | "z">("y");
  const [rotationSpeed, setRotationSpeed] = useState(4);
  // 이름 칸은 오브젝트 이름으로 시작한다 (고쳐 쓸 수 있고, 비우면 오브젝트 이름이 쓰인다)
  const defaultName = modelInfo.name;
  const [name, setName] = useState<string>(defaultName);

  useEffect(() => {
    const scene = new PaintScene(containerRef.current!, setState);
    sceneRef.current = scene;
    // 스포이드: 가져온 색을 고르고 바로 스프레이로 칠할 수 있게 한다 (그리기 화면의 스포이드와 같다)
    scene.onPick = (hex) => {
      setColor(hex);
      setMode("spray");
    };
    // 한 번 칠하기를 마치면 그 색을 "방금 쓴 색" 맨 앞에 둔다
    scene.onPaint = () => {
      const used = colorRef.current;
      setRecentColors((prev) => {
        if (prev[0] === used) return prev;
        const next = [used, ...prev.filter((c) => !sameColor(c, used))].slice(0, RECENT_MAX);
        saveRecent(next);
        return next;
      });
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => sceneRef.current?.setModel(modelId), [modelId]);
  useEffect(() => sceneRef.current?.setMode(mode), [mode]);
  useEffect(() => sceneRef.current?.setColor(color), [color]);
  useEffect(() => sceneRef.current?.setRadius(radius), [radius]);
  useEffect(() => sceneRef.current?.setStrength(strength), [strength]);
  useEffect(() => sceneRef.current?.setAutoRotate(autoRotate), [autoRotate]);
  useEffect(() => sceneRef.current?.setRotationSpeed(rotationSpeed), [rotationSpeed]);

  // Ctrl+Z 되돌리기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        sceneRef.current?.undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const [storing, setStoring] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string; login?: boolean } | null>(null);

  const save = () => {
    const url = sceneRef.current?.exportImage();
    if (url) {
      downloadImage(url, `${name.trim() || defaultName}.png`);
      setNotice(null);
    }
  };

  // 저장한 캐릭터를 마이룸 수납함에 보관한다. 모양과 칠한 색을 서버로 보내면 마이룸이 Babylon.js로 다시 만든다.
  const store = async () => {
    const scene = sceneRef.current;
    const image = scene?.exportFrontImage();
    if (!scene || !image || storing) return;
    setStoring(true);
    setNotice(null);
    try {
      const { sourceModel, spec } = scene.exportRoomObject();
      const thumbnail = await makeThumbnail(image);
      const stored = await storeInRoom({ name: name.trim() || defaultName, sourceModel, thumbnail, spec });
      setNotice({ kind: "ok", text: `'${stored.name}'을(를) 마이룸 수납함에 보관했어요.` });
    } catch (e) {
      setNotice({
        kind: "error",
        text: e instanceof Error ? e.message : "수납하지 못했어요.",
        login: e instanceof RoomError && e.status === 401,
      });
    } finally {
      setStoring(false);
    }
  };

  return (
    <div className="paint-page relative flex h-dvh flex-col gap-3 overflow-hidden bg-[#eef7ff] p-3 text-ink">
      <DorobusBackdrop />
      <DrawingSceneDecor mode="paint3d" />
      <header className="relative z-30 flex flex-wrap items-center gap-1 rounded-3xl border border-white/90 bg-white/76 px-2 py-1.5 shadow-card backdrop-blur-sm">
        <HomeLogo textClassName="hidden xl:inline" />
        <ToolbarDivider />
        <ToolbarButton title="다른 오브젝트 고르기" onClick={() => navigate("/paint3d")}>
          ← <span className="hidden sm:inline">오브젝트 고르기</span>
        </ToolbarButton>
        <ToolbarDivider />
        <span className="mr-1 rounded-full bg-sun px-3 py-1 text-sm font-black text-ink" title="지금 칠하는 오브젝트">
          <span aria-hidden="true">{modelInfo.emoji}</span> {modelInfo.name}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={defaultName}
          onFocus={(e) => e.currentTarget.select()}
          maxLength={20}
          aria-label="캐릭터 이름"
          className="h-10 w-36 rounded-full bg-sky-soft px-4 text-sm font-bold text-ink outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-sky-deep sm:w-44"
        />
        <ToolbarDivider />
        <ToolbarButton title="되돌리기 (Ctrl+Z)" onClick={() => sceneRef.current?.undo()} disabled={!state.canUndo}>
          ↩️ <span className="hidden md:inline">되돌리기</span>
        </ToolbarButton>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <ToolbarMenu title="색칠 방법" label="❓ 도움말" alignRight>
            {() => (
              <ul className="list-disc space-y-1 pl-4 text-sm font-medium">
                <li>
                  <b>스프레이</b>: 한 번 눌러도 칠해져요. 농도를 짙게·보통·옅게 고를 수 있어요. 누른 채 문지르거나 오래 누르면 색이 쌓여 진해져요.
                </li>
                <li>귀·머리·배·팔·다리 등 각 부위는 따로 칠해져요. 누른 채 다른 부위로 넘어가도 처음 칠하던 부위만 칠해져요.</li>
                <li>
                  <b>오른쪽 버튼</b>으로 끌거나 <b>두 손가락</b>으로 밀면 캐릭터가 돌아가요.
                </li>
                <li>
                  <b>휠</b>이나 두 손가락 벌리기로 가까이 볼 수 있어요.
                </li>
                <li><b>페인트 통</b>: 원하는 부위를 한 번 터치하면 그 부위 전체가 선택한 색으로 채워져요.</li>
                <li>저장하면 지금 보이는 방향 그대로 그림 파일이 돼요.</li>
              </ul>
            )}
          </ToolbarMenu>
          <HoldToConfirmButton title="전체 지우기" hintText="꾹 누르고 있으면 다 지워져요" onConfirm={() => sceneRef.current?.clear()} disabled={!state.painted}>
            🗑️ <span className="hidden md:inline">전체 지우기</span>
          </HoldToConfirmButton>
          <ToolbarButton title="마이룸 수납함에 보관 (저장하지 않아도 돼요)" onClick={store} disabled={!state.painted || storing}>
            📦 <span className="hidden md:inline">{storing ? "수납 중…" : "수납하기"}</span>
          </ToolbarButton>
          <ToolbarButton title="그림 저장 (PNG)" onClick={save} disabled={!state.painted} primary>
            💾 저장
          </ToolbarButton>
        </div>
      </header>


      <div className="relative z-10 flex min-h-0 flex-1 gap-3">
        <nav aria-label="색칠 도구" className="tool-rail relative z-20 flex flex-col gap-1.5 self-start rounded-3xl border border-white/90 bg-white/76 p-2 shadow-card backdrop-blur-sm">
          <RailButton label="스프레이" active={mode === "spray"} onClick={() => setMode("spray")}>
            🎨
          </RailButton>
          <RailButton label="페인트통" active={mode === "fill"} onClick={() => setMode("fill")}>
            🪣
          </RailButton>
          <RailButton label="스포이드" active={mode === "picker"} onClick={() => setMode("picker")}>
            💧
          </RailButton>
          <RailButton label="돌리기" active={mode === "rotate"} onClick={() => setMode("rotate")}>
            🔄
          </RailButton>
          <span className="mx-2 my-1 h-px bg-sky-haze" aria-hidden="true" />
          <div className="relative">
            <RailButton label="빙글빙글" active={autoRotate} onClick={() => setAutoRotate((v) => !v)}>
              🌀
            </RailButton>
            {autoRotate && (
              <div className="absolute left-full top-0 z-20 ml-2 w-44 max-w-[calc(100vw-8rem)] rounded-2xl border border-sky-haze bg-white/95 p-3 shadow-card">
                <label htmlFor="rotation-speed" className="flex items-center justify-between text-xs font-bold">
                  회전 속도 <output htmlFor="rotation-speed">{(rotationSpeed / 4).toFixed(1)}배</output>
                </label>
                <div className="mt-2 flex gap-1" role="group" aria-label="자동 회전 축">
                  {(["x", "y", "z"] as const).map((axis) => (
                    <button key={axis} type="button" aria-pressed={rotationAxis === axis}
                      onClick={() => { setRotationAxis(axis); sceneRef.current?.setRotationAxis(axis); }}
                      className={`!w-auto flex-1 rounded-lg !px-2 !py-1 text-xs font-bold ${rotationAxis === axis ? "bg-sky-deep text-white" : "bg-sky-soft text-ink"}`}>
                      {axis.toUpperCase()}축
                    </button>
                  ))}
                </div>
                <input id="rotation-speed" type="range" min="0.4" max="12" step="0.4" value={rotationSpeed}
                  onChange={(e) => { const speed = Number(e.target.value); setRotationSpeed(speed); sceneRef.current?.setRotationSpeed(speed); }}
                  className="mt-2 block h-7 w-full cursor-pointer touch-none accent-sky-deep" />
                <div className="flex justify-between text-[10px] text-ink-muted"><span>천천히</span><span>빠르게</span></div>
              </div>
            )}
          </div>
          <ToolbarMenu compact title="6방향 보기" label={<><span className="text-2xl leading-none">🎯</span>방향</>}>
            {(close) => (
              <div className="grid grid-cols-3 gap-2" aria-label="바라보는 방향">
                {VIEWS.map((view) => (
                  <button key={view.id} type="button" role="menuitem"
                    onClick={() => { setAutoRotate(false); sceneRef.current?.setAutoRotate(false); sceneRef.current?.setView(view.id); close(); }}
                    className="rounded-xl bg-sky-soft px-2 py-3 text-sm font-bold hover:bg-sky-haze">
                    {view.label}
                  </button>
                ))}
              </div>
            )}
          </ToolbarMenu>
        </nav>

        {/* 3D 화면은 좌우를 살짝 줄여 양옆의 배경 캐릭터가 보이게 한다.
            --side-gap: 3D 화면과 오른쪽 도구 패널 사이 빈자리 폭 (오른쪽 여백 + 줄 간격 12px) */}
        <div className="relative z-0 min-h-0 min-w-0 flex-1 [--side-gap:12px] lg:mx-16 lg:[--side-gap:76px] xl:mx-28 xl:[--side-gap:124px]">
          {SIDE && (
            // 오른쪽 안내 캐릭터: 그리기 화면들처럼 3D 화면 오른쪽 아래에 연하게, 얼굴을 빈자리 가운데에 맞춘다
            // (빈자리보다 큰 몸은 3D 화면과 도구 패널 뒤로 들어간다, 클릭도 막지 않는다)
            <div
              className={`pointer-events-none absolute bottom-0 -z-10 hidden opacity-[0.30] lg:block xl:opacity-[0.42] ${SIDE.size}`}
              style={{ left: "calc(100% + var(--side-gap) / 2)", transform: `translateX(-${SIDE.faceX * 100}%)` }}
              aria-hidden="true"
            >
              <span className={`absolute inset-[18%] rounded-full blur-3xl ${SIDE.glow}`} />
              <img src={SIDE.src} alt="" className="relative h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(52,95,145,0.16)]" />
            </div>
          )}
          {/* three.js 캔버스가 이 상자를 꽉 채운다 */}
          <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-3xl bg-white shadow-card" />
          {/* 접힌 도움말 버튼 자리: 3D 화면 오른쪽 위 안쪽 (그리기 화면처럼 모서리에 붙인다) */}
          <div ref={setCoachSlot} className="absolute right-3 top-3 z-10" />
          {notice && (
            <div role="status" className={`absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2 text-sm font-bold shadow-card ${notice.kind === "ok" ? "bg-white text-sky-deep" : "bg-white text-red-600"}`}>
              <span>{notice.kind === "ok" ? "📦" : "⚠️"} {notice.text}</span>
              {(notice.kind === "ok" || notice.login) && (
                <button type="button" onClick={() => navigate(notice.login ? "/" : "/myroom")} className="!w-auto underline">
                  {notice.login ? "다시 로그인" : "마이룸 열기"}
                </button>
              )}
              <button type="button" aria-label="알림 닫기" onClick={() => setNotice(null)} className="!w-auto text-ink-muted">✕</button>
            </div>
          )}
        </div>

        {/* 오른쪽 도구 패널 (그리기 화면의 ToolPanel 과 같은 모양): 고른 도구의 설정 */}
        <aside
          aria-label="도구 설정"
          className="relative z-20 w-64 shrink-0 self-start overflow-y-auto rounded-3xl border border-white/90 bg-white/90 p-4 text-ink shadow-card backdrop-blur-sm"
          style={{ maxHeight: "100%" }}
        >
          {mode === "spray" && (
            <>
              <Section title="크기">
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="스프레이 크기">
                  {SIZES.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      aria-pressed={radius === s.radius}
                      onClick={() => setRadius(s.radius)}
                      className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs font-bold transition ${radius === s.radius ? "bg-ink text-white" : "bg-sky-soft text-ink-muted hover:bg-sky-haze"}`}
                    >
                      <span className="flex h-6 items-center">
                        <span className="block rounded-full bg-current" style={{ width: 4 + s.radius * 40, height: 4 + s.radius * 40 }} aria-hidden="true" />
                      </span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </Section>
              <Section title="농도">
                <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="스프레이 농도">
                  {STRENGTHS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      aria-pressed={strength === s.value}
                      onClick={() => setStrength(s.value)}
                      className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs font-bold transition ${strength === s.value ? "bg-ink text-white" : "bg-sky-soft text-ink-muted hover:bg-sky-haze"}`}
                    >
                      <span className="block h-5 w-5 rounded-full border border-black/10" style={{ backgroundColor: color, opacity: s.opacity }} aria-hidden="true" />
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink-muted">누른 채 문지르거나 오래 누르면 색이 쌓여 진해져요.</p>
              </Section>
            </>
          )}
          {mode === "fill" && <p className="mb-4 rounded-2xl bg-sky-soft p-3 text-xs font-bold leading-relaxed">🪣 부위를 한 번 누르면 그 부위 전체가 고른 색으로 칠해져요.</p>}
          {mode === "picker" && (
            <p className="mb-4 rounded-2xl bg-sky-soft p-3 text-sm font-bold leading-relaxed">💧 오브젝트에서 원하는 색깔을 찍어 보세요. 찍은 색으로 바로 스프레이를 쓸 수 있어요.</p>
          )}
          {mode === "rotate" && (
            <p className="rounded-2xl bg-sky-soft p-3 text-xs font-bold leading-relaxed">🔄 끌어서 오브젝트를 돌려 보세요. 휠이나 두 손가락 벌리기로 가까이 볼 수 있어요.</p>
          )}
          {mode !== "rotate" && (
            <Section title="모든 색">
              <div className="grid grid-cols-6 gap-2">
                {PALETTE.map((c) => (
                  <Swatch key={c.color} color={c.color} name={c.name} selected={sameColor(color, c.color)} onPick={setColor} />
                ))}
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-muted">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full" />
                다른 색 고르기
              </label>
            </Section>
          )}
          {mode !== "rotate" && (
            <Section title="방금 쓴 색">
              {recentColors.length ? (
                <div className="flex flex-wrap gap-2">
                  {recentColors.map((c) => (
                    <Swatch key={c} color={c} name={c} selected={sameColor(color, c)} onPick={setColor} />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-medium text-ink-muted">색을 칠하면 여기에 모여요.</p>
              )}
            </Section>
          )}
        </aside>
        <DrawingCoach mode="paint3d" character="codex" foldedSlot={coachSlot} />
      </div>

      {/* 아래 상태 막대: 그리기 화면의 점수 막대처럼 한 줄 */}
      <footer className="relative z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-white/90 bg-white/76 px-3 py-1.5 text-xs shadow-card backdrop-blur-sm">
        <span className="font-black">{mode === "rotate" ? "🔄 돌리기" : mode === "fill" ? "🪣 페인트통" : mode === "picker" ? "💧 스포이드" : "🎨 스프레이"}</span>
        <span className="flex items-center gap-1.5 rounded-lg bg-sky-soft px-2 py-0.5 text-[11px] font-bold text-ink-muted">
          <span className="inline-block h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: color }} aria-hidden="true" />
          선택한 색
        </span>
        <span className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
          {mode === "picker"
            ? "오브젝트를 누르면 그 자리의 색을 가져와요"
            : mode !== "rotate" && state.part
              ? `🎯 ${state.part}${mode === "fill" ? " · 터치하면 전체 색칠" : "만 칠해져요"}`
              : "오브젝트 위에서 누르면 그 부위가 칠해져요"}
        </span>
        <span className="ml-auto rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
          {state.painted ? "칠한 흔적이 있어요" : "아직 칠하지 않았어요"}
        </span>
      </footer>
    </div>
  );
}
