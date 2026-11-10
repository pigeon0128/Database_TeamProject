// 기프트샵 화면(pages/ShopPage.tsx)의 그림들. (중앙선 위 배경은 ShopWall.tsx)
//   CounterBackdrop: 중앙선 아래 카운터. 나뭇결과 이음 홈이 있는 나무 수납장 앞면.
//   BrushBox: 중앙선 아래의 브러쉬 상자. 붓들이 가운데를 중심으로 부채꼴로 퍼져 놓이고, 붓 머리는 아래를 향한다.
//     붓 머리는 브러쉬마다 무늬 그림(public/assets/shop/brushes/<slug>.png)으로 채운다.
import type { KeyboardEvent } from "react";
import type { SpecialBrush } from "../../lib/api";

const LINE = "#2B1A1A";
const WOOD_DARK = "#4A2615";
const WOOD = "#7A3E1F";
const WOOD_LIGHT = "#A0582C";

/** 나뭇결 한 줄: 위에서 아래로 살짝 물결치는 선 (seed 로 모양을 정해 매번 같게 그린다) */
function grainPath(x: number, top: number, bottom: number, seed: number) {
  const amp = 3 + (seed % 5);
  const waves = 3 + (seed % 3);
  const step = (bottom - top) / (waves * 2);
  let d = `M${x} ${top}`;
  for (let i = 0; i < waves * 2; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    d += `q${dir * amp} ${step / 2} 0 ${step}`;
  }
  return d;
}

/**
 * 중앙선 아래 카운터 배경: 나무 수납장 앞면.
 * 위에 굵은 상판 띠, 그 아래 세로 문짝들이 이음 홈으로 나뉘고, 문짝마다 나뭇결과 옹이가 있다. 맨 아래는 어두운 걸레받이.
 */
export function CounterBackdrop({ className }: { className?: string }) {
  const doors = Array.from({ length: 6 }, (_, i) => i * 270);
  return (
    <svg viewBox="0 0 1600 460" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={className}>
      <rect width="1600" height="460" fill="#9A4B1C" />
      {/* 상판 띠 */}
      <rect width="1600" height="56" fill="#B25B24" />
      <path d="M0 8H1600" stroke="#D7843F" strokeWidth="5" />
      {Array.from({ length: 14 }, (_, i) => (
        <path key={i} d={`M${i * 120 + 10} ${18 + (i % 3) * 9}q60 ${i % 2 ? 6 : -6} 120 0`} fill="none" stroke="#8A3F14" strokeWidth="2.5" opacity="0.55" />
      ))}
      <rect y="56" width="1600" height="10" fill="#5E2A0E" />
      {/* 문짝 */}
      {doors.map((x, d) => (
        <g key={x}>
          <rect x={x + 8} y="74" width="254" height="318" rx="6" fill={d % 2 ? "#A3521F" : "#9C4D1C"} stroke={LINE} strokeWidth="4" />
          <path d={`M${x + 14} 388V80H${x + 256}`} fill="none" stroke="#C26F31" strokeWidth="5" strokeLinecap="round" />
          <path d={`M${x + 256} 80V386H${x + 14}`} fill="none" stroke="#6E3110" strokeWidth="5" strokeLinecap="round" />
          {Array.from({ length: 9 }, (_, g) => {
            const seed = d * 13 + g * 7;
            return <path key={g} d={grainPath(x + 30 + g * 26 + (seed % 9), 92, 372, seed)} fill="none" stroke="#6E3110" strokeWidth={g % 3 === 0 ? 3 : 2} opacity={g % 3 === 0 ? 0.55 : 0.35} strokeLinecap="round" />;
          })}
          {/* 옹이 */}
          <g transform={`translate(${x + 80 + ((d * 53) % 110)} ${150 + ((d * 71) % 170)})`} fill="none" stroke="#5E2A0E" opacity="0.6">
            <ellipse rx="10" ry="16" strokeWidth="3" />
            <ellipse rx="4" ry="8" strokeWidth="2.5" />
          </g>
          <rect x={x + 120} y="224" width="30" height="8" rx="4" fill="#E8C27A" stroke={LINE} strokeWidth="3" />
        </g>
      ))}
      {/* 걸레받이와 바닥 */}
      <rect y="398" width="1600" height="62" fill="#2E1A10" />
      <path d="M0 400H1600" stroke={LINE} strokeWidth="4" />
      <path d="M0 412H1600" stroke="#4A2C1A" strokeWidth="3" />
    </svg>
  );
}

/** 붓 하나의 모양 (머리가 아래, 손잡이 끝이 (0,0)). 머리 가운데는 대략 y=245 */
const HEAD_PATH = "M-14 196C-34 214-36 256-14 280C-4 291 2 298 4 306C10 292 30 270 32 244C34 220 22 204 14 196Z";
const HEAD_CENTER = 245;

function Brush({ brush, selected, onPick }: { brush: SpecialBrush; selected: boolean; onPick: () => void }) {
  const clipId = `brush-head-${brush.slug}`;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPick();
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${brush.name} 브러쉬, ${brush.owned ? "가지고 있음" : `${brush.price}셀`}`}
      onClick={onPick}
      onKeyDown={onKey}
      className={`cursor-pointer outline-none transition-[translate] duration-300 hover:-translate-y-4 focus-visible:-translate-y-4 ${selected ? "-translate-y-4" : ""}`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={HEAD_PATH} />
        </clipPath>
      </defs>
      {/* 손잡이: 끝은 가늘고 쇠붙이 쪽이 굵다 */}
      <path d="M-7 10Q0-4 7 10L15 172H-15Z" fill="#F5A04B" stroke={LINE} strokeWidth="5" strokeLinejoin="round" />
      <path d="M-5 14L-12 168H-4L0 14Z" fill="#E07B30" />
      <circle cx="4" cy="40" r="2.5" fill="#FFFFFF" opacity="0.8" />
      {/* 쇠붙이 */}
      <rect x="-15" y="172" width="30" height="26" rx="3" fill="#D6D6D6" stroke={LINE} strokeWidth="5" />
      <path d="M-13 182h26M-13 189h26" stroke="#9A9A9A" strokeWidth="3" />
      {/* 머리: 브러쉬 무늬 그림으로 채운다 */}
      <g clipPath={`url(#${clipId})`}>
        <image href={`/assets/shop/brushes/${brush.slug}.png`} x="-38" y="194" width="72" height="114" preserveAspectRatio="xMidYMid slice" />
      </g>
      <path d={HEAD_PATH} fill="none" stroke={selected ? "#FFD23F" : LINE} strokeWidth={selected ? 7 : 5} strokeLinejoin="round" />
      <path d="M-18 222C-22 240-18 258-8 272M18 214C22 232 18 252 10 266" fill="none" stroke={LINE} strokeWidth="3" strokeLinecap="round" opacity="0.45" />
    </g>
  );
}

/** 브러쉬 상자: 사다리꼴 상자 안에 붓이 부채꼴로 놓이고, 앞판 아래에 이름·가격표가 붙는다 */
export function BrushBox({ brushes, selected, onPick, className }: { brushes: SpecialBrush[]; selected: string | null; onPick: (b: SpecialBrush) => void; className?: string }) {
  const n = brushes.length;
  const xs = brushes.map((_, i) => (n === 1 ? 500 : 110 + (780 * i) / (n - 1)));
  // 모든 붓 손잡이가 상자 위쪽 먼 한 점을 향하게 해서 부채꼴로 퍼지게 한다
  const pivot = { x: 500, y: -520 };
  const headY = 300;
  return (
    <svg viewBox="0 0 1000 470" className={className} role="group" aria-label="특수 브러쉬 상자">
      {/* 상자 */}
      <path d="M80 26H920L986 366H14Z" fill={WOOD_DARK} stroke={LINE} strokeWidth="6" strokeLinejoin="round" />
      <path d="M98 42H902L960 352H40Z" fill="#9E2433" />
      <path d="M98 42H902L912 96H88Z" fill="#000000" opacity="0.18" />
      {brushes.map((b, i) => {
        const dx = xs[i] - pivot.x;
        const dy = headY - pivot.y;
        const len = Math.hypot(dx, dy);
        const ox = xs[i] - (dx / len) * HEAD_CENTER;
        const oy = headY - (dy / len) * HEAD_CENTER;
        const angle = (-Math.atan2(dx, dy) * 180) / Math.PI;
        return (
          <g key={b.slug} transform={`translate(${ox} ${oy}) rotate(${angle})`}>
            <Brush brush={b} selected={selected === b.slug} onPick={() => onPick(b)} />
          </g>
        );
      })}
      {/* 앞판 */}
      <rect x="6" y="362" width="988" height="34" rx="6" fill={WOOD} stroke={LINE} strokeWidth="6" />
      <path d="M20 372H980" stroke={WOOD_LIGHT} strokeWidth="4" />
      {/* 이름·가격표 */}
      {brushes.map((b, i) => (
        <g key={b.slug} className="cursor-pointer" onClick={() => onPick(b)}>
          <path d={`M${xs[i]} 396v8`} stroke={LINE} strokeWidth="3" />
          <rect x={xs[i] - 40} y="404" width="80" height="54" rx="8" fill={b.owned ? "#EAF6DA" : "#FFF8EC"} stroke={selected === b.slug ? "#FFD23F" : LINE} strokeWidth={selected === b.slug ? 5 : 3} />
          <text x={xs[i]} y="428" textAnchor="middle" fontSize="18" fontWeight="900" fill={LINE}>
            {b.name}
          </text>
          <text x={xs[i]} y="450" textAnchor="middle" fontSize="15" fontWeight="800" fill={b.owned ? "#3B6D11" : "#B8262B"}>
            {b.owned ? "보유" : `${b.price}셀`}
          </text>
        </g>
      ))}
    </svg>
  );
}
