// 메인 화면 오른쪽 아래에 놓이는 놀이공원 기념품 상점(GIFTSHOP) 그림.
// 빨강·노랑 줄무늬 차양, 전구 달린 간판, 진열창 앞에 앉은 곰인형으로 기념품 가게 분위기를 낸다.

const RED = "#E23B3B";
const RED_DARK = "#B8262B";
const YELLOW = "#FFD23F";
const YELLOW_DARK = "#F2A91D";
const CREAM = "#FFF1C9";
const LINE = "#5A2E1A";

const BEAR = "#D9A35A";
const BEAR_DARK = "#B97F3A";
const BEAR_LIGHT = "#F3D39A";
const BOW = "#6E4A2E";

/** 간판 테두리 전구 위치 */
const bulbs = [
  ...Array.from({ length: 11 }, (_, i) => [60 + i * 39.2, 30] as const),
  ...Array.from({ length: 11 }, (_, i) => [60 + i * 39.2, 118] as const),
  [44, 74] as const,
  [468, 74] as const,
];

/** 차양 아래 물결 장식: 폭 40씩 빨강·노랑 번갈아 */
const scallops = Array.from({ length: 12 }, (_, i) => 16 + i * 40);

export default function GiftShopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={className}>
      <defs>
        <pattern id="giftshop-stripes" x="16" y="0" width="80" height="512" patternUnits="userSpaceOnUse">
          <rect width="40" height="512" fill={RED} />
          <rect x="40" width="40" height="512" fill={YELLOW} />
        </pattern>
        <clipPath id="giftshop-window">
          <rect x="204" y="292" width="248" height="128" rx="10" />
        </clipPath>
      </defs>

      {/* 간판 기둥과 깃발 줄 */}
      <rect x="150" y="128" width="22" height="44" fill={YELLOW_DARK} stroke={LINE} strokeWidth="6" />
      <rect x="340" y="128" width="22" height="44" fill={YELLOW_DARK} stroke={LINE} strokeWidth="6" />
      <path d="M172 142q84 34 168 0" fill="none" stroke={LINE} strokeWidth="4" />
      {[
        [190, 150, "#1E82DC"],
        [224, 158, YELLOW],
        [256, 160, "#00C98F"],
        [288, 158, RED],
        [322, 150, "#1E82DC"],
      ].map(([x, y, color]) => (
        <path key={x} d={`M${Number(x) - 11} ${Number(y) - 4}h22l-11 20Z`} fill={color as string} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      ))}

      {/* 간판 */}
      <rect x="36" y="18" width="440" height="112" rx="26" fill={RED} stroke={LINE} strokeWidth="8" />
      <rect x="58" y="40" width="396" height="68" rx="16" fill={RED_DARK} />
      {bulbs.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill="#FFF6C2" stroke={YELLOW_DARK} strokeWidth="3" />
      ))}
      <text
        x="256"
        y="98"
        textAnchor="middle"
        textLength="372"
        lengthAdjust="spacingAndGlyphs"
        fontFamily="'Arial Black', 'Arial Rounded MT Bold', Arial, sans-serif"
        fontWeight="900"
        fontSize="64"
        fill={YELLOW}
        stroke={LINE}
        strokeWidth="8"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        GIFTSHOP
      </text>

      {/* 반짝이 */}
      <path d="M18 8l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill={YELLOW} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />
      <path d="M492 128l4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill={YELLOW} stroke={LINE} strokeWidth="3" strokeLinejoin="round" />

      {/* 벽 */}
      <rect x="36" y="228" width="440" height="244" fill={CREAM} stroke={LINE} strokeWidth="8" />
      <rect x="36" y="440" width="440" height="32" fill={YELLOW} stroke={LINE} strokeWidth="8" />

      {/* 줄무늬 차양 */}
      <path d="M64 168h384l48 64H16Z" fill="url(#giftshop-stripes)" stroke={LINE} strokeWidth="8" strokeLinejoin="round" />
      {scallops.map((x, i) => (
        <path key={x} d={`M${x} 230h40v6a20 20 0 0 1-40 0Z`} fill={i % 2 === 0 ? RED : YELLOW} stroke={LINE} strokeWidth="6" strokeLinejoin="round" />
      ))}
      <rect x="230" y="176" width="52" height="22" rx="11" fill={CREAM} stroke={LINE} strokeWidth="5" />
      <path d="M256 180l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" fill={RED} />

      {/* 문 */}
      <path d="M64 470V322a52 52 0 0 1 104 0v148Z" fill={RED} stroke={LINE} strokeWidth="8" strokeLinejoin="round" />
      <circle cx="116" cy="326" r="22" fill="#CFE6FA" stroke={LINE} strokeWidth="6" />
      <path d="M116 312l4 9 10 1-7 7 2 10-9-5-9 5 2-10-7-7 10-1Z" fill={YELLOW} />
      <circle cx="148" cy="404" r="7" fill={YELLOW} stroke={LINE} strokeWidth="4" />
      <rect x="82" y="364" width="68" height="24" rx="6" fill={YELLOW} stroke={LINE} strokeWidth="4" />
      <text x="116" y="382" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="15" fill={LINE}>OPEN</text>

      {/* 진열창: 안쪽 선반과 레서판다 인형들 */}
      <rect x="196" y="284" width="264" height="144" rx="14" fill={YELLOW_DARK} stroke={LINE} strokeWidth="8" />
      <g clipPath="url(#giftshop-window)">
        <rect x="204" y="292" width="248" height="128" fill="#FBE6A6" />
        <path d="M204 292h248v40H204Z" fill="#FFEFC0" />
        <rect x="204" y="344" width="248" height="8" fill="#C98A3C" />
        {[226, 262, 394, 430].map((x) => (
          <g key={x}>
            <circle cx={x} cy={326} r="15" fill="#D9672A" stroke={LINE} strokeWidth="3" />
            <circle cx={x - 12} cy={314} r="6" fill="#D9672A" stroke={LINE} strokeWidth="3" />
            <circle cx={x + 12} cy={314} r="6" fill="#D9672A" stroke={LINE} strokeWidth="3" />
            <ellipse cx={x} cy={331} rx="10" ry="7" fill="#FFF6E8" />
            <circle cx={x - 5} cy={324} r="2.5" fill={LINE} />
            <circle cx={x + 5} cy={324} r="2.5" fill={LINE} />
          </g>
        ))}
        {[218, 244, 412, 438].map((x, i) => (
          <rect key={x} x={x - 10} y={366} width="20" height="22" rx="5" fill={i % 2 === 0 ? RED : "#1E82DC"} stroke={LINE} strokeWidth="3" />
        ))}
        <path d="M376 300l40 40M408 296l40 40" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="8" strokeLinecap="round" />
      </g>

      {/* 보도 */}
      <rect x="12" y="472" width="488" height="28" rx="6" fill={RED_DARK} stroke={LINE} strokeWidth="8" />
      <path d="M92 476v20M172 476v20M252 476v20M412 476v20" stroke="#8F1D22" strokeWidth="4" />

      {/* 진열창 앞의 곰인형 */}
      <g stroke={LINE} strokeWidth="6" strokeLinejoin="round">
        {/* 몸통 */}
        <ellipse cx="328" cy="430" rx="50" ry="42" fill={BEAR} />
        <ellipse cx="328" cy="438" rx="28" ry="24" fill={BEAR_LIGHT} strokeWidth="0" />
        {/* 팔 */}
        <ellipse cx="282" cy="426" rx="16" ry="26" fill={BEAR} transform="rotate(22 282 426)" />
        <ellipse cx="374" cy="426" rx="16" ry="26" fill={BEAR} transform="rotate(-22 374 426)" />
        {/* 발 */}
        <ellipse cx="296" cy="468" rx="24" ry="17" fill={BEAR} />
        <ellipse cx="360" cy="468" rx="24" ry="17" fill={BEAR} />
        <ellipse cx="296" cy="470" rx="12" ry="9" fill={BEAR_LIGHT} strokeWidth="0" />
        <ellipse cx="360" cy="470" rx="12" ry="9" fill={BEAR_LIGHT} strokeWidth="0" />
        {/* 귀 */}
        <circle cx="290" cy="320" r="18" fill={BEAR} />
        <circle cx="366" cy="320" r="18" fill={BEAR} />
        <circle cx="290" cy="320" r="9" fill={BEAR_DARK} strokeWidth="0" />
        <circle cx="366" cy="320" r="9" fill={BEAR_DARK} strokeWidth="0" />
        {/* 머리 */}
        <ellipse cx="328" cy="354" rx="48" ry="44" fill={BEAR} />
        <ellipse cx="328" cy="370" rx="22" ry="16" fill={BEAR_LIGHT} strokeWidth="4" />
      </g>
      <circle cx="311" cy="350" r="5.5" fill="#1F1712" />
      <circle cx="345" cy="350" r="5.5" fill="#1F1712" />
      <circle cx="313" cy="348" r="1.8" fill="#FFFFFF" />
      <circle cx="347" cy="348" r="1.8" fill="#FFFFFF" />
      <path d="M321 362q7-5 14 0q-1 7-7 8q-6-1-7-8Z" fill="#1F1712" />
      <path d="M328 370v5M321 377q7 5 14 0" fill="none" stroke="#1F1712" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="300" cy="370" rx="7" ry="4.5" fill="#F28C8C" opacity="0.55" />
      <ellipse cx="356" cy="370" rx="7" ry="4.5" fill="#F28C8C" opacity="0.55" />
      {/* 체크무늬 리본 */}
      <g stroke={LINE} strokeWidth="4" strokeLinejoin="round">
        <path d="M328 400l-34-16v34Z" fill={BOW} />
        <path d="M328 400l34-16v34Z" fill={BOW} />
        <path d="M322 404l-12 30 10-4 6 8 4-32Z" fill={BOW} />
        <path d="M334 404l12 30-10-4-6 8-4-32Z" fill={BOW} />
        <rect x="320" y="392" width="16" height="16" rx="4" fill={BOW} />
      </g>
      <path d="M304 389v24M316 394v14M340 394v14M352 389v24M298 396h24M334 396h24M298 406h24M334 406h24" stroke="#C9A982" strokeWidth="2" opacity="0.75" />

    </svg>
  );
}
