// 3D 색칠하기 화면. 스프레이 색을 고르고, 캐릭터를 360도 돌려 가며 스프레이로 칠한 뒤 지금 보이는 모습을 PNG로 저장한다.
// 서버 없이 브라우저에서만 동작한다. three.js 처리는 paintScene.ts 에 있다.
import { useEffect, useRef, useState, type ReactNode } from "react";
import DorobusBackdrop from "../components/DorobusBackdrop";
import { DrawingCoach } from "../components/drawing/DrawingCoach";
import DrawingSceneDecor from "../components/drawing/DrawingSceneDecor";
import { ToolbarButton, ToolbarDivider, ToolbarMenu } from "../components/toolbar";
import { downloadImage } from "../lib/download";
import { navigate } from "../router";
import { RoomError, storeInRoom } from "../features/paint3d/room";
import { makeThumbnail } from "../features/paint3d/roomExport";
import { PaintScene, type PaintMode, type PaintState, type ViewDirection } from "../features/paint3d/paintScene";

import { findModel, type ModelId } from "../features/paint3d/models";

const PALETTE = ["#f25c54", "#ff9f1c", "#fee500", "#00e8aa", "#1e82dc", "#7b61ff", "#ff7eb6", "#8d6e63", "#363636", "#ffffff"];
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

/** 왼쪽에 떠 있는 도구 막대의 버튼 (그리기 화면의 브러쉬/지우개 버튼과 같은 모양) */
function RailButton({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex w-14 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-bold transition ${
        active ? "bg-sky-haze text-sky-deep" : "text-ink-muted hover:bg-sky-soft"
      }`}
    >
      <span className="text-xl leading-none">{children}</span>
      {label}
    </button>
  );
}

export default function Paint3DPage({ modelId }: { modelId: ModelId }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PaintScene | null>(null);
  const [state, setState] = useState<PaintState>({ canUndo: false, painted: false, part: null });
  const modelInfo = findModel(modelId)!;
  const [mode, setMode] = useState<PaintMode>("spray");
  const [color, setColor] = useState(PALETTE[4]);
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
        <button type="button" onClick={() => navigate("/studio")} aria-label="AI 화실" className="mr-1 flex items-center gap-1 px-1 text-lg font-black tracking-[-0.04em] text-[#64a5ff] sm:px-2">
          <span className="text-xl">💨</span><span className="hidden xl:inline">DOROBUS</span>
        </button>
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
        {SIZES.map((s) => (
          <ToolbarButton key={s.label} title={`스프레이 ${s.label}`} active={radius === s.radius} onClick={() => setRadius(s.radius)}>
            <span className="inline-block rounded-full bg-current" style={{ width: 4 + s.radius * 30, height: 4 + s.radius * 30 }} aria-hidden="true" />
            <span className="hidden md:inline">{s.label}</span>
          </ToolbarButton>
        ))}
        <ToolbarDivider />
        <div role="group" aria-label="브러시 농도" className="flex items-center gap-1">
          <span className="px-1 text-xs text-ink-muted">농도</span>
          {STRENGTHS.map((s) => (
            <ToolbarButton key={s.label} title={`브러시 농도 ${s.label}`} active={strength === s.value} onClick={() => setStrength(s.value)}>
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color, opacity: s.opacity }} aria-hidden="true" />
              <span>{s.label}</span>
            </ToolbarButton>
          ))}
        </div>
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
          <ToolbarButton title="전체 지우기" onClick={() => sceneRef.current?.clear()} disabled={!state.painted}>
            🗑️ <span className="hidden md:inline">전체 지우기</span>
          </ToolbarButton>
        </div>
      </header>


      <div className="relative z-10 flex min-h-0 flex-1 gap-3">
        <nav aria-label="색칠 도구" className="tool-rail relative z-20 flex flex-col gap-1 self-start rounded-3xl border border-white/90 bg-white/76 p-1.5 shadow-card backdrop-blur-sm">
          <RailButton label="스프레이" active={mode === "spray"} onClick={() => setMode("spray")}>
            🎨
          </RailButton>
          <RailButton label="페인트 통" active={mode === "fill"} onClick={() => setMode("fill")}>
            🪣
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
          <ToolbarMenu compact title="6방향 보기" label={<span className="text-xs">🎯 방향</span>}>
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

        <div className="relative z-0 min-h-0 min-w-0 flex-1">
          {/* three.js 캔버스가 이 상자를 꽉 채운다 */}
          <div ref={containerRef} className="absolute inset-0 overflow-hidden rounded-3xl border border-white/90 bg-white/60 shadow-card backdrop-blur-[2px]" />
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

        {/* 스프레이 색 */}
        <nav aria-label="스프레이 색" className="color-palette grid grid-cols-2 items-center gap-2 self-start rounded-3xl border border-white/90 bg-white/76 p-2 shadow-card backdrop-blur-sm">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`색 ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={`h-9 w-9 rounded-full border border-black/10 transition ${color === c ? "ring-3 ring-sky-deep ring-offset-2" : "hover:scale-110"}`}
              style={{ backgroundColor: c }}
            />
          ))}
          {/* 직접 고르기 */}
          <label
            title="다른 색 고르기"
            className={`relative h-9 w-9 cursor-pointer overflow-hidden rounded-full border border-black/10 ${PALETTE.includes(color) ? "" : "ring-3 ring-sky-deep ring-offset-2"}`}
            style={{ background: PALETTE.includes(color) ? "conic-gradient(#f25c54, #fee500, #00e8aa, #1e82dc, #7b61ff, #f25c54)" : color }}
          >
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="다른 색 고르기" />
          </label>
        </nav>
        <DrawingCoach mode="paint3d" character="codex" />
      </div>

      <footer className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl border border-white/90 bg-white/76 px-4 py-2 shadow-card backdrop-blur-sm">
        <span className="text-sm font-black">
          {mode === "rotate" ? "🔄 돌리기" : mode === "fill" ? "🪣 페인트 통" : "🎨 스프레이"}
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-ink-muted">
          <span className="inline-block h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} aria-hidden="true" />
          선택한 색
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
          {mode !== "rotate" && state.part ? `🎯 ${state.part}${mode === "fill" ? " · 터치하면 전체 색칠" : "만 칠해져요"}` : "오브젝트 위에서 누르면 그 부위가 칠해져요"}
        </span>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
          {state.painted ? "칠한 흔적이 있어요" : "아직 칠하지 않았어요"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ToolbarButton title="그림 저장 (PNG)" onClick={save} disabled={!state.painted} primary>
            💾 저장
          </ToolbarButton>
          <ToolbarButton title="마이룸 수납함에 보관 (저장하지 않아도 돼요)" onClick={store} disabled={!state.painted || storing} primary>
            📦 {storing ? "수납 중…" : "수납하기"}
          </ToolbarButton>
        </div>
      </footer>
    </div>
  );
}
