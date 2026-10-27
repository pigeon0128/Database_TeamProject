// 브러쉬 고르기 패널: 왼쪽 도구 막대의 🖌️ 브러쉬 버튼을 누르면 옆으로 펼쳐진다.
// 펜 모양의 브러쉬들이 세로로 놓이고, 고른 펜이 오른쪽으로 쏙 나온다. 아래에는 색 동그라미(색 고르기)와 굵기 버튼이 있다.
//   펜: 따라 그리기 선 (채점함) / 색칠 붓: 고른 색으로 구역 칠하기 / 특수 브러쉬: 무늬로 구역 칠하기 (셀로 사서 쓴다)
// 안 산 특수 브러쉬는 🔒 가격이 붙고, 누르면 사기 창이 뜬다 (lib/specialBrushes.ts → POST /api/brushes/<slug>/purchase).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { SpecialBrush } from "../../lib/api";
import { patternFor } from "../../lib/drawing/brushPatterns";
import { useSpecialBrushes } from "../../lib/specialBrushes";
import { BASIC_COLORS, type DrawingTools } from "./useDrawingTools";

/** 펜 몸통에 깔 무늬 미리보기 */
function PatternSwatch({ slug, color, className }: { slug: string; color: string; className: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.fillStyle = patternFor(ctx, slug, color, 0.6);
    ctx.fillRect(0, 0, 128, 48);
  }, [slug, color]);
  return <canvas ref={ref} width={128} height={48} className={className} aria-hidden="true" />;
}

/**
 * 가로로 누운 펜 그림. body 는 몸통(색이나 무늬), tip 은 펜촉 색.
 * 고르지 않은 펜은 왼쪽 패널 가장자리 밖으로 반쯤 들어가 있고, 고른 펜은 오른쪽으로 나온다.
 */
function PenButton({ label, active, onClick, body, tip, badge }: { label: string; active: boolean; onClick: () => void; body: ReactNode; tip: string; badge?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`group relative flex h-9 shrink-0 items-center transition-transform duration-200 ${active ? "translate-x-0" : "-translate-x-5 hover:-translate-x-2"}`}
    >
      <span className="relative h-6 w-20 overflow-hidden rounded-l-md border border-black/15 shadow-sm">{body}</span>
      {/* 펜 고리 */}
      <span className="h-6 w-2.5 border-y border-black/15 bg-white" />
      {/* 펜촉 */}
      <span className="h-4 w-4 border border-black/10" style={{ background: tip, clipPath: "polygon(0 0, 100% 35%, 100% 65%, 0 100%)" }} />
      {badge}
    </button>
  );
}

function Popover({ children }: { children: ReactNode }) {
  return <div className="absolute left-full top-0 z-40 ml-2 w-60 rounded-3xl border border-white/90 bg-white p-4 text-ink shadow-card-hover">{children}</div>;
}

type Pop = "color" | "size" | null;

export function BrushPanel({ tools, onClose }: { tools: DrawingTools; onClose: () => void }) {
  const { brush, paintColor, setBrush, setPaintColor } = tools;
  const specials = useSpecialBrushes(true);
  const [pop, setPop] = useState<Pop>(null);
  const [buying, setBuying] = useState<SpecialBrush | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyBusy, setBuyBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc 를 누르면 닫는다 (사기 창이 떠 있을 때는 그 창만 닫는다)
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      // 브러쉬 버튼(여닫기)은 그 버튼이 처리한다
      const target = e.target as Element;
      if (!buying && !ref.current?.contains(target) && !target.closest?.("[data-brush-toggle]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (buying) setBuying(null);
      else if (pop) setPop(null);
      else onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [buying, pop, onClose]);

  const pickSpecial = (b: SpecialBrush) => {
    if (b.owned) return setBrush(b.slug);
    setBuyError(null);
    setBuying(b);
  };
  const buy = (b: SpecialBrush) => {
    setBuyBusy(true);
    setBuyError(null);
    specials
      .buy(b.slug)
      .then(
        () => {
          setBuying(null);
          setBrush(b.slug);
        },
        (err: Error) => setBuyError(err.message),
      )
      .finally(() => setBuyBusy(false));
  };
  const pickColor = (c: string) => {
    setPaintColor(c);
    // 펜은 검정 고정이므로, 색을 고르면 색칠 붓으로 바꾼다
    if (brush === "pen") setBrush("color");
  };

  const cells = specials.cells ?? 0;
  const selectedName =
    brush === "pen" ? "펜" : brush === "color" ? "색칠 붓" : (specials.brushes?.find((b) => b.slug === brush)?.name ?? "특수 브러쉬");

  return (
    <div ref={ref} className="absolute left-full top-0 z-40 ml-2 flex">
      <div className="flex max-h-[calc(100dvh-7rem)] w-32 flex-col rounded-3xl border border-white/90 bg-white/95 py-3 shadow-card-hover backdrop-blur-sm">
        <p className="mb-1 px-3 text-center text-[11px] font-black text-sky-deep">{selectedName}</p>
        {/* 펜들 (넘치면 세로로 스크롤). 왼쪽으로 숨은 펜이 보이지 않게 가로는 자른다 */}
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto overflow-x-hidden pl-1">
          <PenButton label="펜 (따라 그리기)" active={brush === "pen"} onClick={() => setBrush("pen")} tip="#363636" body={<span className="block h-full w-full bg-[#363636]" />} />
          <PenButton
            label="색칠 붓"
            active={brush === "color"}
            onClick={() => setBrush("color")}
            tip={paintColor}
            body={<span className="block h-full w-full" style={{ background: paintColor }} />}
          />
          {specials.error && <p className="px-2 text-[11px] font-bold text-red-600">{specials.error}</p>}
          {specials.brushes?.map((b) => (
            <PenButton
              key={b.slug}
              label={b.owned ? b.name : `${b.name} — ${b.price}셀로 사기`}
              active={brush === b.slug}
              onClick={() => pickSpecial(b)}
              tip={paintColor}
              body={<PatternSwatch slug={b.slug} color={paintColor} className="h-full w-full" />}
              badge={
                !b.owned && (
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-1.5 text-[10px] font-black text-ink shadow-sm">🔒 {b.price}</span>
                )
              }
            />
          ))}
        </div>

        <div className="mx-3 my-2 h-px bg-sky-haze" />
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            title="색 고르기"
            aria-label="색 고르기"
            aria-pressed={pop === "color"}
            onClick={() => setPop(pop === "color" ? null : "color")}
            className={`h-8 w-8 rounded-full border-2 shadow-sm ${pop === "color" ? "border-sky-deep" : "border-white"}`}
            style={{ background: paintColor, outline: "1px solid rgb(0 0 0 / 0.1)" }}
          />
          <button
            type="button"
            title="굵기"
            aria-label="굵기"
            aria-pressed={pop === "size"}
            onClick={() => setPop(pop === "size" ? null : "size")}
            className={`flex h-8 w-8 flex-col items-center justify-center gap-[3px] rounded-full ${pop === "size" ? "bg-sky-haze" : "hover:bg-sky-soft"}`}
          >
            <span className="h-[2px] w-5 rounded bg-ink" />
            <span className="h-[3px] w-5 rounded bg-ink" />
            <span className="h-[5px] w-5 rounded bg-ink" />
          </button>
          {specials.cells !== null && <span className="rounded-full bg-sun px-2 py-0.5 text-[11px] font-black text-ink">💠 {specials.cells}셀</span>}
        </div>
      </div>

      {pop === "color" && (
        <Popover>
          <p className="mb-2 text-sm font-extrabold">색 {brush === "pen" && <span className="text-xs text-ink-muted">(고르면 색칠 붓으로 바뀌어요)</span>}</p>
          <div className="grid grid-cols-6 gap-1.5">
            {BASIC_COLORS.map((c) => (
              <button
                key={c.color}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => pickColor(c.color)}
                className={`h-8 w-8 rounded-full border ${paintColor === c.color ? "ring-2 ring-sky-deep ring-offset-1" : "border-black/10"}`}
                style={{ background: c.color }}
              />
            ))}
            <input type="color" value={paintColor} onChange={(e) => pickColor(e.target.value)} title="다른 색" aria-label="다른 색" className="h-8 w-8 cursor-pointer rounded-full" />
          </div>
          <p className="mt-2 text-xs font-medium text-ink-muted">특수 브러쉬 무늬에도 이 색이 섞여요.</p>
        </Popover>
      )}
      {pop === "size" && (
        <Popover>
          <label className="block text-sm font-bold">
            {tools.painting ? "색칠 붓" : tools.erase ? "지우개" : "펜"} 굵기 {tools.size}
            <input
              type="range"
              min={tools.sizeMin}
              max={tools.sizeMax}
              value={tools.size}
              onChange={(e) => tools.setSize(Number(e.target.value))}
              className="mt-2 w-full accent-sky-deep"
            />
          </label>
        </Popover>
      )}

      {/* 사기 창은 body 에 바로 붙인다 (도구 막대의 흐림 효과 안에서는 화면 전체를 덮지 못한다) */}
      {buying &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" role="dialog" aria-modal="true" aria-label={`${buying.name} 브러쉬 사기`}>
            <div className="w-80 max-w-full rounded-3xl bg-white p-5 text-center shadow-card-hover">
              <PatternSwatch slug={buying.slug} color={paintColor} className="mx-auto mb-3 h-12 w-32 rounded-xl" />
              <p className="text-lg font-extrabold">{buying.name} 브러쉬</p>
              <p className="mt-1 text-sm font-bold text-ink-muted">
                {buying.price}셀로 살까요? (가진 셀 {cells})
              </p>
              {buyError && <p className="mt-2 text-sm font-bold text-red-600">{buyError}</p>}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setBuying(null)} className="flex-1 rounded-full bg-sky-soft py-2 text-sm font-bold hover:bg-sky-haze">
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => buy(buying)}
                  disabled={buyBusy || cells < buying.price}
                  className="flex-1 rounded-full bg-sky-deep py-2 text-sm font-bold text-white disabled:opacity-40"
                >
                  {cells < buying.price ? "셀이 부족해요" : "사기"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
