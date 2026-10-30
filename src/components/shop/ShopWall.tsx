// 기프트샵 중앙선 위, 점원 캐릭터 너머에 깔리는 배경: 정면에서 본 선물 가게 벽장.
// 진한 마호가니 나무장이 기둥으로 세 칸으로 나뉘고, 칸마다 유리 선반이 층층이 있다.
//   왼쪽 칸: 리본·가격표 달린 틴케이스, 작은 집 모양 틴, 초콜릿 그릇
//   가운데·오른쪽 칸: 차 틴, 색색 선물 상자, 세워 둔 상자
// 기둥에는 튤립 벽등, 오른쪽 위에는 간판과 매달린 은색 오너먼트, 가운데 아래에는 하얀 나뭇가지 장식이 있다.

const LINE = "#2B1414";
const MAHOGANY = "#6A2416";
const MAHOGANY_DARK = "#43150C";
const MAHOGANY_LIGHT = "#94402A";
const GOLD = "#E3B04B";

const tinColors = ["#3E6FA8", "#B8344A", "#2F7D6B", "#7A4E9C", "#C98A2E", "#2B3F6B"];
const houseColors = ["#F28FA6", "#7FB6E6", "#E2574C", "#B28AD8", "#F5C44E", "#8CC9A6", "#F0A35E"];
const boxColors = ["#F2B8C6", "#D9414E", "#FFF1D6", "#8FC9E8", "#C7A3E0", "#F5D06A", "#9ACD7E", "#E87F5A"];

/** 칸 너비만큼 물건을 일정 간격으로 늘어놓는다 */
const spread = (left: number, right: number, w: number, gap: number) => {
  const count = Math.floor((right - left + gap) / (w + gap));
  const start = left + (right - left - (count * (w + gap) - gap)) / 2;
  return Array.from({ length: count }, (_, i) => start + i * (w + gap));
};

/** 리본과 금색 가격표가 달린 네모 틴케이스. 앞면에 작은 그림 */
function Tin({ x, base, color, seed }: { x: number; base: number; color: string; seed: number }) {
  const w = 56;
  const h = 78;
  const y = base - h;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill={color} stroke={LINE} strokeWidth="3" />
      <rect x={x + 8} y={y + 14} width={w - 16} height={h - 30} rx="3" fill="#F7E7C6" stroke={LINE} strokeWidth="2" />
      {seed % 2 ? (
        <path d={`M${x + 12} ${y + 50}l10-14 8 9 7-11 9 16Z`} fill="#6BAF6E" />
      ) : (
        <circle cx={x + w / 2} cy={y + 36} r="9" fill="#E2574C" />
      )}
      <path d={`M${x + w / 2} ${y}v${h}`} stroke={GOLD} strokeWidth="4" opacity="0.9" />
      <path d={`M${x + w / 2} ${y + 2}c-14-12-20 2-8 4M${x + w / 2} ${y + 2}c14-12 20 2 8 4`} fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M${x + w / 2} ${y + 4}l${10 + (seed % 3) * 4} 22`} stroke="#8A6A3A" strokeWidth="1.5" />
      <rect x={x + w / 2 + 4 + (seed % 3) * 4} y={y + 24} width="20" height="14" rx="2" fill="#F2D68A" stroke={LINE} strokeWidth="2" transform={`rotate(${12 - (seed % 3) * 6} ${x + w / 2 + 14} ${y + 31})`} />
    </g>
  );
}

/** 작은 집 모양 틴: 뾰족 지붕, 창문 격자, 문 */
function House({ x, base, color, seed }: { x: number; base: number; color: string; seed: number }) {
  const w = 44;
  const h = 62 + (seed % 3) * 10;
  const y = base - h;
  const roof = seed % 2 ? `M${x - 3} ${y + 18}L${x + w / 2} ${y - 6}L${x + w + 3} ${y + 18}Z` : `M${x - 3} ${y + 14}h${w + 6}l-6-14h${-w + 6}Z`;
  return (
    <g>
      <rect x={x} y={y + 14} width={w} height={h - 14} fill={color} stroke={LINE} strokeWidth="3" />
      <path d={roof} fill="#5B3A6E" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      {[0, 1].map((r) =>
        [0, 1].map((c) => <rect key={`${r}${c}`} x={x + 8 + c * 18} y={y + 24 + r * 16} width="10" height="10" fill="#FFF3C4" stroke={LINE} strokeWidth="1.5" />),
      )}
      <rect x={x + w / 2 - 6} y={base - 16} width="12" height="16" rx="5" fill="#7A3E1F" stroke={LINE} strokeWidth="1.5" />
    </g>
  );
}

/** 뚜껑 달린 차 틴 */
function TeaTin({ x, base, color }: { x: number; base: number; color: string }) {
  return (
    <g>
      <rect x={x} y={base - 54} width="40" height="54" rx="3" fill={color} stroke={LINE} strokeWidth="2.5" />
      <rect x={x - 2} y={base - 60} width="44" height="10" rx="2" fill="#E9E2D0" stroke={LINE} strokeWidth="2.5" />
      <rect x={x + 6} y={base - 40} width="28" height="20" rx="2" fill="#FFF8EC" stroke={LINE} strokeWidth="1.5" />
      <path d={`M${x + 12} ${base - 30}h16`} stroke={LINE} strokeWidth="2" opacity="0.5" />
    </g>
  );
}

/** 선반 한 단: 유리판 + 앞쪽 하이라이트 + 얇은 금속 받침 */
function GlassShelf({ left, right, y }: { left: number; right: number; y: number }) {
  return (
    <g>
      <rect x={left} y={y} width={right - left} height="9" fill="#CFE8EE" opacity="0.85" stroke={LINE} strokeWidth="2" />
      <path d={`M${left + 4} ${y + 2}H${right - 4}`} stroke="#FFFFFF" strokeWidth="2" opacity="0.9" />
      <rect x={left} y={y + 9} width={right - left} height="4" fill="#000000" opacity="0.18" />
    </g>
  );
}

/** 기둥에 붙은 튤립 벽등 */
function Sconce({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <ellipse cx={x} cy={y - 6} rx="60" ry="50" fill="#FFE7A6" opacity="0.28" />
      <path d={`M${x} ${y + 34}v-20q0-10 10-10`} fill="none" stroke={GOLD} strokeWidth="5" strokeLinecap="round" />
      <path d={`M${x - 20} ${y - 24}q20 50 40 0q-6 6-10-4q-10 8-20 0q-4 10-10 4Z`} fill="#FFF6DE" stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <circle cx={x} cy={y - 4} r="5" fill="#FFF3B0" />
    </g>
  );
}

/** 천장에서 매달린 길쭉한 은색 오너먼트 */
function Ornament({ x, top, len }: { x: number; top: number; len: number }) {
  const y = top + 40;
  const stroke = { stroke: LINE, strokeWidth: 2.5 };
  return (
    <g>
      <path d={`M${x} ${top}v40`} stroke="#9A9A9A" strokeWidth="2" />
      <ellipse cx={x} cy={y + 8} rx="8" ry="9" fill="#F2F4F6" {...stroke} />
      <ellipse cx={x} cy={y + 34} rx="18" ry="18" fill="#F2F4F6" {...stroke} />
      <path d={`M${x - 14} ${y + 48}L${x} ${y + 48 + len}L${x + 14} ${y + 48}Z`} fill="#F2F4F6" {...stroke} strokeLinejoin="round" />
      <ellipse cx={x} cy={y + 50} rx="15" ry="6" fill="#DDE2E8" {...stroke} />
      <path d={`M${x - 6} ${y + 26}q-4 10 0 16M${x - 5} ${y + 60}L${x - 1} ${y + 40 + len * 0.8}`} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** 하얀 나뭇가지 장식과 꼬마전구 */
function BranchTree({ x, base }: { x: number; base: number }) {
  const branches = [
    `M${x} ${base}V${base - 220}`,
    `M${x} ${base - 60}q-50-40-90-110`,
    `M${x} ${base - 90}q60-40 100-120`,
    `M${x} ${base - 140}q-40-30-60-90`,
    `M${x} ${base - 150}q40-30 50-80`,
    `M${x - 60} ${base - 120}q-30-10-50-40`,
    `M${x + 70} ${base - 160}q30-10 50-30`,
  ];
  const lights = [[-88, -168], [-48, -228], [-108, -158], [102, -208], [52, -228], [118, -188], [0, -222], [-30, -150], [36, -130]];
  return (
    <g>
      {branches.map((d) => (
        <path key={d} d={d} fill="none" stroke="#F5F2EC" strokeWidth="6" strokeLinecap="round" />
      ))}
      {branches.map((d) => (
        <path key={`s${d}`} d={d} fill="none" stroke="#C9C2B6" strokeWidth="2" strokeLinecap="round" transform="translate(2 2)" opacity="0.6" />
      ))}
      {lights.map(([dx, dy]) => (
        <g key={`${dx}${dy}`}>
          <circle cx={x + dx} cy={base + dy} r="9" fill="#FFE7A6" opacity="0.45" />
          <circle cx={x + dx} cy={base + dy} r="3.5" fill="#FFF6C2" />
        </g>
      ))}
    </g>
  );
}

export function ShopWall({ className }: { className?: string }) {
  const bays = { a: [92, 548], b: [612, 1028], c: [1092, 1508] } as const;
  const shelves = [250, 380, 510, 640];
  const pillars = [40, 560, 1040, 1520];
  return (
    <svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMin slice" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="shop-wall-bay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A2A1A" />
          <stop offset="1" stopColor="#7A3C22" />
        </linearGradient>
      </defs>
      {/* 벽과 천장 */}
      <rect width="1600" height="700" fill="#E9D3AE" />
      <rect width="1600" height="34" fill="#3A1A10" />
      {[200, 520, 800, 1080, 1400].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="34" rx="20" ry="6" fill="#FFF6C2" />
          <path d={`M${x - 70} 40L${x - 20} 34h40l50 6Z`} fill="#FFF6C2" opacity="0.18" />
        </g>
      ))}

      {/* 나무장 몸체와 칸 안쪽 */}
      <rect x="30" y="64" width="1540" height="636" fill={MAHOGANY} stroke={LINE} strokeWidth="4" />
      {Object.values(bays).map(([l, r]) => (
        <rect key={l} x={l - 12} y="132" width={r - l + 24} height="568" fill="url(#shop-wall-bay)" stroke={LINE} strokeWidth="3" />
      ))}

      {/* 위쪽 장식 몰딩: 굵은 띠 + 이빨 무늬 */}
      <rect x="20" y="58" width="1560" height="26" fill={MAHOGANY_LIGHT} stroke={LINE} strokeWidth="4" />
      <rect x="30" y="84" width="1540" height="18" fill={MAHOGANY_DARK} />
      {Array.from({ length: 77 }, (_, i) => (
        <rect key={i} x={36 + i * 20} y="102" width="10" height="12" fill={MAHOGANY_LIGHT} stroke={LINE} strokeWidth="1.5" />
      ))}
      <path d="M30 120H1570" stroke={LINE} strokeWidth="3" />

      {/* 간판 */}
      <rect x="1180" y="142" width="240" height="56" rx="10" fill="#FFF3DD" stroke={GOLD} strokeWidth="5" />
      <text x="1300" y="181" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontStyle="italic" fontWeight="700" fontSize="30" fill="#8E2430">
        Gift Shop
      </text>

      {/* 왼쪽 칸: 틴케이스, 집 모양 틴, 리본 상자, 초콜릿 그릇 */}
      {spread(bays.a[0], bays.a[1], 56, 8).map((x, i) => <Tin key={`t${x}`} x={x} base={shelves[0]} color={tinColors[i % tinColors.length]} seed={i} />)}
      {spread(bays.a[0], bays.a[1], 44, 6).map((x, i) => <House key={`h${x}`} x={x} base={shelves[1]} color={houseColors[i % houseColors.length]} seed={i} />)}
      {spread(bays.a[0], bays.a[1], 56, 8).map((x, i) => <Tin key={`u${x}`} x={x} base={shelves[2]} color={tinColors[(i + 3) % tinColors.length]} seed={i + 1} />)}
      {spread(bays.a[0], bays.a[1], 70, 12).map((x, i) => (
        <g key={`c${x}`}>
          <path d={`M${x} ${shelves[3] - 30}h70l-8 30h-54Z`} fill="#F3EEE6" stroke={LINE} strokeWidth="2.5" />
          {[0, 1, 2, 3, 4].map((k) => (
            <circle key={k} cx={x + 10 + k * 12} cy={shelves[3] - 34 - ((k + i) % 2) * 6} r="7" fill={k % 2 ? "#6B3A1E" : "#8A5230"} stroke={LINE} strokeWidth="1.5" />
          ))}
        </g>
      ))}

      {/* 가운데·오른쪽 칸: 차 틴, 선물 상자, 세워 둔 상자, 가격표 상자 */}
      {[bays.b, bays.c].map(([l, r], b) => (
        <g key={l}>
          {spread(l, r, 40, 6).map((x, i) => <TeaTin key={`tea${x}`} x={x} base={shelves[0]} color={["#7FA8D6", "#9C86C9", "#F1E3C2"][(i + b) % 3]} />)}
          {spread(l, r, 30, 4).map((x, i) => (
            <g key={`box${x}`}>
              <rect x={x} y={shelves[1] - 34} width="30" height="34" fill={boxColors[(i * 3 + b) % boxColors.length]} stroke={LINE} strokeWidth="2" />
              <rect x={x} y={shelves[1] - 64} width="30" height="30" fill={boxColors[(i * 5 + 2 + b) % boxColors.length]} stroke={LINE} strokeWidth="2" />
              <path d={`M${x + 15} ${shelves[1] - 64}v30`} stroke="#FFFFFF" strokeWidth="3" opacity="0.7" />
            </g>
          ))}
          {spread(l, r, 22, 3).map((x, i) => (
            <rect key={`bk${x}`} x={x} y={shelves[2] - 70 + (i % 4) * 4} width="22" height={70 - (i % 4) * 4} rx="2" fill={boxColors[(i * 7 + b) % boxColors.length]} stroke={LINE} strokeWidth="2" />
          ))}
          {spread(l, r, 48, 10).map((x, i) => (
            <g key={`pr${x}`}>
              <rect x={x} y={shelves[3] - 46} width="48" height="46" rx="3" fill={boxColors[(i * 2 + 1 + b) % boxColors.length]} stroke={LINE} strokeWidth="2.5" />
              <rect x={x + 10} y={shelves[3] - 8} width="28" height="12" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            </g>
          ))}
        </g>
      ))}

      {/* 유리 선반 */}
      {Object.values(bays).map(([l, r]) => shelves.map((y) => <GlassShelf key={`${l}-${y}`} left={l - 12} right={r + 12} y={y} />))}

      {/* 기둥: 세로 홈이 파인 기둥과 머리 장식 */}
      {pillars.map((x) => (
        <g key={x}>
          <rect x={x} y="120" width="40" height="580" fill={MAHOGANY_LIGHT} stroke={LINE} strokeWidth="3" />
          <path d={`M${x + 12} 140V690M${x + 20} 140V690M${x + 28} 140V690`} stroke={MAHOGANY_DARK} strokeWidth="2.5" opacity="0.7" />
          <rect x={x - 6} y="120" width="52" height="16" fill={MAHOGANY} stroke={LINE} strokeWidth="3" />
        </g>
      ))}
      {[580, 1060].map((x) => (
        <Sconce key={x} x={x} y={190} />
      ))}

      {/* 매달린 오너먼트와 나뭇가지 장식 */}
      {[
        [1130, 160],
        [1460, 210],
        [1540, 140],
      ].map(([x, len]) => (
        <Ornament key={x} x={x} top={120} len={len} />
      ))}
      <BranchTree x={820} base={700} />
    </svg>
  );
}
