// 그리기 화면 오른쪽 도구 패널: 왼쪽 도구 막대에서 고른 도구의 설정이 늘 펼쳐져 있다.
//   맨 위: 굵기 조절 바 (펜·브러쉬·특수 브러쉬·지우개)
//   브러쉬·채우기: 모든 색 / 방금 쓴 색
//   특수 브러쉬: 붓 모양 목록 (오른쪽 모서리에서 머리가 왼쪽을 보고, 고른 붓이 왼쪽으로 쏙 나온다). 색은 브러쉬에서 고른 색을 쓴다.
//     안 산 붓은 🔒 가격이 붙고, 누르면 상점(#/shop)으로 간다. 상점에서 나오면 이 그리기 화면으로 돌아온다
//   스포이드: 굵기·색 대신 "원하는 색깔에 찍어 보세요" 안내만 보여 준다 (색을 가져오면 바로 브러쉬로 바뀐다)
// 특수 브러쉬 목록·구매: lib/specialBrushes.ts → GET/POST /api/brushes
import { useEffect, useRef } from "react";
import { patternFor } from "../../lib/drawing/brushPatterns";
import { comboText } from "../../lib/drawing/shortcuts";
import { useSpecialBrushes } from "../../lib/specialBrushes";
import { currentPath, navigate } from "../../router";
import { Kbd } from "../toolbar";
import { BASIC_COLORS, BRUSH_MAX_SIZE, type DrawingTools } from "./useDrawingTools";

const BRUSH_W = 168;
const BRUSH_H = 40;

/** 붓 그림: 왼쪽 나무 손잡이, 가운데 쇠 테, 오른쪽을 향한 붓털(무늬로 칠함). 화면에는 BrushArt 가 좌우를 뒤집어 보여 준다 */
function drawBrush(ctx: CanvasRenderingContext2D, slug: string, color: string) {
  const cy = BRUSH_H / 2;
  ctx.clearRect(0, 0, BRUSH_W, BRUSH_H);

  // 손잡이: 끝은 둥글고 쇠 테 쪽으로 갈수록 굵어진다
  const wood = ctx.createLinearGradient(0, cy - 7, 0, cy + 7);
  wood.addColorStop(0, "#e7b47a");
  wood.addColorStop(1, "#a96a35");
  ctx.beginPath();
  ctx.moveTo(9, cy - 3.5);
  ctx.lineTo(88, cy - 6.5);
  ctx.lineTo(88, cy + 6.5);
  ctx.lineTo(9, cy + 3.5);
  ctx.quadraticCurveTo(1, cy, 9, cy - 3.5);
  ctx.fillStyle = wood;
  ctx.fill();
  ctx.strokeStyle = "rgba(90,50,20,0.35)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, cy - 1.6);
  ctx.lineTo(86, cy - 4);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 붓털: 쇠 테에서 나와 살짝 부풀었다가 오른쪽 끝에서 뾰족해진다
  const bristles = new Path2D();
  bristles.moveTo(104, cy - 8);
  bristles.bezierCurveTo(124, cy - 13, 148, cy - 9, BRUSH_W - 3, cy);
  bristles.bezierCurveTo(148, cy + 9, 124, cy + 13, 104, cy + 8);
  bristles.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill(bristles);
  ctx.fillStyle = patternFor(ctx, slug, color, 0.8);
  ctx.fill(bristles);
  ctx.save();
  ctx.clip(bristles);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.8;
  for (const dy of [-5, -2, 1, 4]) {
    ctx.beginPath();
    ctx.moveTo(106, cy + dy * 1.3);
    ctx.quadraticCurveTo(136, cy + dy * 1.1, BRUSH_W - 6, cy + dy * 0.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 0.8;
  ctx.stroke(bristles);

  // 쇠 테
  const metal = ctx.createLinearGradient(0, cy - 9, 0, cy + 9);
  metal.addColorStop(0, "#f4f6f8");
  metal.addColorStop(0.5, "#c3cad2");
  metal.addColorStop(1, "#8d97a3");
  ctx.beginPath();
  ctx.roundRect(86, cy - 9, 21, 18, 3);
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  for (const x of [91, 95]) {
    ctx.beginPath();
    ctx.moveTo(x, cy - 9);
    ctx.lineTo(x, cy + 9);
    ctx.stroke();
  }
}

function BrushArt({ slug, color }: { slug: string; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current!.getContext("2d")!;
    // 좌우를 뒤집어 그린다: 손잡이가 오른쪽, 붓털 머리가 왼쪽을 본다
    ctx.setTransform(-2, 0, 0, 2, BRUSH_W * 2, 0);
    drawBrush(ctx, slug, color);
  }, [slug, color]);
  return <canvas ref={ref} width={BRUSH_W * 2} height={BRUSH_H * 2} style={{ width: BRUSH_W, height: BRUSH_H }} aria-hidden="true" />;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="mb-2 text-sm font-extrabold">
        {title}
        {sub && <span className="ml-1 text-xs font-bold text-ink-muted">· {sub}</span>}
      </h3>
      {children}
    </section>
  );
}

/** 동그란 색 버튼. 고른 색은 진한 테두리 */
function Swatch({ color, name, selected, onPick }: { color: string; name: string; selected: boolean; onPick: (c: string) => void }) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      aria-pressed={selected}
      onClick={() => onPick(color)}
      className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${selected ? "ring-2 ring-ink ring-offset-2" : "border border-black/10"}`}
      style={{ background: color }}
    />
  );
}

const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** 모든 색 · 방금 쓴 색 */
function ColorSections({ tools }: { tools: DrawingTools }) {
  const { paintColor, setPaintColor, recentColors } = tools;
  return (
    <>
      <Section title="모든 색">
        <div className="grid grid-cols-6 gap-2">
          {BASIC_COLORS.map((c) => (
            <Swatch key={c.color} color={c.color} name={c.name} selected={sameColor(paintColor, c.color)} onPick={setPaintColor} />
          ))}
        </div>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-bold text-ink-muted">
          <input type="color" value={paintColor} onChange={(e) => setPaintColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full" />
          다른 색 고르기
        </label>
      </Section>
      <Section title="방금 쓴 색">
        {recentColors.length ? (
          <div className="flex flex-wrap gap-2">
            {recentColors.map((c) => (
              <Swatch key={c} color={c} name={c} selected={sameColor(paintColor, c)} onPick={setPaintColor} />
            ))}
          </div>
        ) : (
          <p className="text-xs font-medium text-ink-muted">색을 칠하면 여기에 모여요.</p>
        )}
      </Section>
    </>
  );
}

/** 굵기 미리보기 점을 특수 브러쉬 무늬로 칠한 것 */
function PatternDot({ slug, color, size }: { slug: string; color: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.fillStyle = patternFor(ctx, slug, color, 0.5);
    ctx.fill();
  }, [slug, color, size]);
  return (
    <canvas
      ref={ref}
      width={Math.ceil(size * 2)}
      height={Math.ceil(size * 2)}
      className="block rounded-full"
      style={{ width: size, height: size, outline: "1px solid rgb(0 0 0 / 0.15)" }}
      aria-hidden="true"
    />
  );
}

function SizeSection({ tools }: { tools: DrawingTools }) {
  const { size, sizeMin, sizeMax, erase, painting, keys } = tools;
  // 미리보기 점: 굵기 범위 안에서의 위치를 6~34px 로 보여 준다
  const dot = 6 + ((size - sizeMin) / Math.max(1, sizeMax - sizeMin)) * 28;
  return (
    <Section title="굵기">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-soft">
          {/* 특수 브러쉬는 고른 무늬로, 나머지는 칠할 색으로 보여 준다 */}
          {tools.tool === "special" && tools.special ? (
            <PatternDot slug={tools.special} color={tools.paintColor} size={dot} />
          ) : (
            <span
              className="block rounded-full"
              style={{ width: dot, height: dot, background: erase ? "#ffffff" : painting ? tools.paintColor : "#363636", outline: "1px solid rgb(0 0 0 / 0.15)" }}
            />
          )}
        </span>
        <input
          type="range"
          min={sizeMin}
          max={sizeMax}
          value={size}
          aria-label="굵기"
          onChange={(e) => tools.setSize(Number(e.target.value))}
          className="min-w-0 flex-1 accent-sky-deep"
        />
        <span className="w-7 text-right text-sm font-black tabular-nums">{size}</span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-ink-muted">
        <Kbd>{comboText(keys.sizeDown)}</Kbd>
        <Kbd>{comboText(keys.sizeUp)}</Kbd> 로도 바꿀 수 있어요
      </p>
      {tools.tool === "pen" && sizeMax < BRUSH_MAX_SIZE && (
        <p className="mt-1 text-xs font-medium text-ink-muted">흰 선 두께에 맞춰 펜은 {sizeMax}까지만 굵게 할 수 있어요.</p>
      )}
    </Section>
  );
}

/** 상점(#/shop)으로 간다. 상점에서 나오면 지금 그리던 화면으로 돌아와 그리던 그림을 바로 이어 그린다 (from, brush 는 ShopPage 가 읽는다) */
function goToShop(slug?: string) {
  const params = new URLSearchParams({ from: currentPath() });
  if (slug) params.set("brush", slug);
  navigate(`/shop?${params}`);
}

function SpecialBrushes({ tools }: { tools: DrawingTools }) {
  const specials = useSpecialBrushes(true);
  const { special, pickSpecial, paintColor } = tools;

  return (
    <Section title="특수 브러쉬">
      {specials.error && <p className="text-xs font-bold text-red-600">{specials.error}</p>}
      {!specials.brushes && !specials.error && <p className="text-xs font-medium text-ink-muted">불러오는 중…</p>}
      {specials.brushes && !special && <p className="mb-1 text-xs font-bold text-sky-deep">쓸 붓을 골라 주세요.</p>}
      {/* 붓은 패널 오른쪽 모서리에서 시작해 머리가 왼쪽을 본다. 고른 붓은 왼쪽으로 쏙 나오고, 나머지는 오른쪽 모서리 밖으로 조금 들어가 있다.
          안 산 붓을 누르면 상점으로 가서 그 붓을 보여 준다 */}
      <div className="-mr-4 flex flex-col overflow-x-hidden">
        {specials.brushes?.map((b) => {
          const active = special === b.slug;
          return (
            <button
              key={b.slug}
              type="button"
              onClick={() => (b.owned ? pickSpecial(b.slug) : goToShop(b.slug))}
              title={b.owned ? b.name : `${b.name} — 상점에서 ${b.price}셀로 사기`}
              aria-label={b.owned ? b.name : `${b.name}, 상점에서 ${b.price}셀로 사기`}
              aria-pressed={active}
              className={`relative flex items-center justify-between rounded-l-xl py-0.5 pl-1 transition-transform duration-200 ${
                active ? "translate-x-0 bg-sky-haze/70" : "translate-x-6 hover:translate-x-3"
              }`}
            >
              <span className={`truncate text-[11px] font-bold ${active ? "text-sky-deep" : "text-ink-muted"}`}>{b.name}</span>
              <BrushArt slug={b.slug} color={paintColor} />
              {!b.owned && (
                <span className="absolute right-9 top-1/2 -translate-y-1/2 rounded-full bg-white/95 px-1.5 text-[10px] font-black text-ink shadow-sm">🔒 {b.price}</span>
              )}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => goToShop()} className="mt-3 w-full rounded-full bg-sun py-2 text-sm font-black text-ink shadow-sm hover:brightness-95">
        🛍️ 상점에서 브러쉬 사기
      </button>
    </Section>
  );
}

/** 오른쪽 도구 패널. 지금 고른 도구에 맞는 설정만 보여 준다 */
export function ToolPanel({ tools }: { tools: DrawingTools }) {
  const { tool } = tools;
  return (
    <div className="text-ink">
      {tool !== "fill" && tool !== "picker" && <SizeSection tools={tools} />}
      {tool === "pen" && <p className="mt-3 text-xs font-medium leading-relaxed text-ink-muted">펜은 검정색으로 흰 선을 따라 그려요. 색은 채우기나 브러쉬로 칠해요.</p>}
      {tool === "eraser" && <p className="mt-3 text-xs font-medium leading-relaxed text-ink-muted">펜 선과 칠한 색을 지워요. 색은 처음 댄 칸 안에서만 지워져요.</p>}
      {tool === "fill" && <p className="mb-4 rounded-2xl bg-sky-soft p-3 text-xs font-bold leading-relaxed">🪣 칸을 한 번 누르면 칸 전체가 고른 색으로 칠해져요.</p>}
      {tool === "special" && <SpecialBrushes tools={tools} />}
      {tool === "picker" && (
        <p className="rounded-2xl bg-sky-soft p-3 text-sm font-bold leading-relaxed">💧 원하는 색깔에 스포이드를 찍어 보세요. 찍은 색으로 바로 브러쉬를 쓸 수 있어요.</p>
      )}
      {(tool === "fill" || tool === "brush") && <ColorSections tools={tools} />}
    </div>
  );
}
