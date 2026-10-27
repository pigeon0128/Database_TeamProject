// 색칠하기 특수 브러쉬의 무늬. 붓 자국 안에 이 무늬가 드러난다 (special-brushes.html 의 무늬를 옮겨 옴).
// 어떤 브러쉬를 보여 줄지(이름·순서)는 DB special_brushes 가 정하고, 여기서는 slug 로 무늬를 그린다.
// 무늬 일부는 지금 고른 색(color)을 섞어 쓴다.

const TAU = Math.PI * 2;
/** 무늬 한 칸 크기 (캔버스 픽셀) */
const TILE = 96;
/** 그림판이 커서 무늬를 이만큼 키워서 깐다 */
const PATTERN_SCALE = 1.5;
/** 무늬를 비스듬히 깐다 (도) */
const PATTERN_ROTATE = 15;

const palette = ["#f4d52e", "#f16b37", "#e9474e", "#19b7bd", "#3689e7", "#83bd3d", "#8a55c8", "#f277aa"];
const accent = (i: number) => palette[((i % palette.length) + palette.length) % palette.length];

/** 무늬마다 바탕색 */
const backgrounds: Record<string, string> = {
  wave: "#a7e7e6",
  hearts: "#ffc0d3",
  stars: "#29345f",
  rainbow: "#fff0a8",
  leaf: "#edf6d5",
  flower: "#ffe7a8",
  clouds: "#bce7fb",
  strawberries: "#ffd4c7",
  butterflies: "#e8d5fb",
  rose: "#ffe0e8",
};

/** 앱이 그릴 줄 아는 무늬인지 (DB에 앱이 모르는 slug 가 있으면 목록에서 뺀다) */
export const hasPattern = (slug: string) => slug in backgrounds;

const tiles = new Map<string, HTMLCanvasElement>();

function patternTile(slug: string, color: string) {
  const key = `${slug}:${color}`;
  const cachedTile = tiles.get(key);
  if (cachedTile) return cachedTile;
  const tile = document.createElement("canvas");
  tile.width = tile.height = slug === "leaf" ? 64 : TILE;
  const g = tile.getContext("2d")!;
  if (slug === "leaf") g.scale(2 / 3, 2 / 3);
  g.fillStyle = backgrounds[slug];
  g.fillRect(0, 0, TILE, TILE);

  const line = (x1: number, y1: number, x2: number, y2: number, c: string, w = 2) => {
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokeStyle = c;
    g.lineWidth = w;
    g.stroke();
  };
  const dot = (x: number, y: number, r: number, fill: string) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fillStyle = fill;
    g.fill();
  };
  const flower = (x: number, y: number, scale = 1) => {
    const petals = ["#f45f8b", "#ff8fac", "#ffb7c8"];
    for (let k = 0; k < 6; k++) {
      const a = (TAU * k) / 6;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 6.2 * scale, y + Math.sin(a) * 6.2 * scale, 3.1 * scale, 4.8 * scale, a + Math.PI / 2, 0, TAU);
      g.fillStyle = petals[k % petals.length];
      g.fill();
      g.strokeStyle = "#71384a";
      g.lineWidth = 1.35;
      g.stroke();
    }
    dot(x, y, 3.4 * scale, "#ffd43b");
    g.strokeStyle = "#71384a";
    g.lineWidth = 1.5;
    g.stroke();
  };
  const star = (x: number, y: number, r: number, fill: string) => {
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.48 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = "#fffdf9";
    g.lineWidth = 1.5;
    g.stroke();
  };
  const heart = (x: number, y: number, s: number, fill: string) => {
    g.beginPath();
    g.moveTo(x, y + s * 0.38);
    g.bezierCurveTo(x - s * 0.15, y + s * 0.23, x - s * 0.62, y - s * 0.04, x - s * 0.52, y - s * 0.35);
    g.bezierCurveTo(x - s * 0.43, y - s * 0.66, x - s * 0.08, y - s * 0.58, x, y - s * 0.33);
    g.bezierCurveTo(x + s * 0.08, y - s * 0.58, x + s * 0.43, y - s * 0.66, x + s * 0.52, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.62, y - s * 0.04, x + s * 0.15, y + s * 0.23, x, y + s * 0.38);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = "#26232b";
    g.lineWidth = 1.5;
    g.stroke();
  };
  const leaf = (x: number, y: number, size: number, angle: number, fill: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.scale(size, size);
    g.beginPath();
    g.moveTo(0, 38);
    g.quadraticCurveTo(30, 14, 0, -38);
    g.quadraticCurveTo(-30, 14, 0, 38);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.strokeStyle = "#286b3d";
    g.lineWidth = 2.4;
    g.stroke();
    line(0, 34, 0, -34, "#f0f7c7", 2.1);
    for (const yv of [23, 10, -3, -16, -27]) {
      const span = (38 - Math.abs(yv)) * 0.48;
      line(0, yv, span, yv - 6, "#d8efaa", 1.35);
      line(0, yv, -span, yv - 6, "#d8efaa", 1.35);
    }
    g.restore();
  };
  const rose = (x: number, y: number, size: number) => {
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    leaf(-10, 10, 0.34, 0.75, "#4caa4c");
    leaf(10, 10, 0.34, -0.75, "#67bb45");
    g.beginPath();
    g.ellipse(0, 2, 15, 13, 0, 0, TAU);
    g.fillStyle = "#c92f55";
    g.fill();
    g.strokeStyle = "#77243d";
    g.lineWidth = 1.8;
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (TAU * k) / 6;
      g.beginPath();
      g.ellipse(Math.cos(a) * 5.2, Math.sin(a) * 4.2, 6.5, 5.5, a, 0, TAU);
      g.fillStyle = k % 2 ? "#ef5575" : "#f8768b";
      g.fill();
      g.strokeStyle = "#a62c4c";
      g.lineWidth = 1.4;
      g.stroke();
    }
    dot(0, 0, 4, "#ce3659");
    g.beginPath();
    g.moveTo(-2.2, 1);
    g.bezierCurveTo(-4, -3, 3, -4, 3, 0);
    g.bezierCurveTo(3, 4, -2, 4, -2, 1);
    g.strokeStyle = "#ffd1d8";
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
  };
  const cloud = (x: number, y: number, size: number) => {
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    g.beginPath();
    g.moveTo(-19, 8);
    g.bezierCurveTo(-25, 7, -25, -1, -20, -4);
    g.bezierCurveTo(-19, -13, -8, -17, -1, -10);
    g.bezierCurveTo(5, -21, 20, -15, 20, -6);
    g.bezierCurveTo(30, -5, 29, 8, 20, 9);
    g.closePath();
    g.fillStyle = "#fffdf9";
    g.fill();
    g.strokeStyle = "#428fc3";
    g.lineWidth = 2.4;
    g.stroke();
    g.beginPath();
    g.moveTo(-17, 8);
    g.quadraticCurveTo(0, 13, 18, 8);
    g.strokeStyle = "#c4e6fa";
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  };
  const butterfly = (x: number, y: number, size: number, seed: number) => {
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    const shades = [accent(seed), accent(seed + 2), accent(seed + 4)];
    for (const side of [-1, 1]) {
      g.save();
      g.scale(side, 1);
      g.beginPath();
      g.moveTo(0, -2);
      g.bezierCurveTo(3, -17, 21, -20, 20, -7);
      g.bezierCurveTo(19, 1, 8, 4, 2, 3);
      g.closePath();
      g.fillStyle = shades[0];
      g.fill();
      g.strokeStyle = "#302c35";
      g.lineWidth = 1.5;
      g.stroke();
      g.beginPath();
      g.moveTo(1, 2);
      g.bezierCurveTo(10, 0, 19, 5, 15, 13);
      g.bezierCurveTo(11, 20, 4, 13, 1, 5);
      g.closePath();
      g.fillStyle = shades[1];
      g.fill();
      g.stroke();
      g.beginPath();
      g.ellipse(11, -6, 3.5, 5, 0, 0, TAU);
      g.fillStyle = shades[2];
      g.fill();
      g.strokeStyle = "#fffdf9";
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.ellipse(0, 2, 2.5, 12, 0, 0, TAU);
    g.fillStyle = "#302c35";
    g.fill();
    dot(0, -11, 3.2, "#302c35");
    g.beginPath();
    g.moveTo(-1, -13);
    g.quadraticCurveTo(-9, -24, -10, -17);
    g.moveTo(1, -13);
    g.quadraticCurveTo(9, -24, 10, -17);
    g.strokeStyle = "#302c35";
    g.lineWidth = 1.3;
    g.stroke();
    g.restore();
  };
  const strawberry = (x: number, y: number, size: number) => {
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    g.beginPath();
    g.moveTo(-12, -8);
    g.quadraticCurveTo(-19, -15, -9, -15);
    g.lineTo(-3, -12);
    g.lineTo(0, -19);
    g.lineTo(4, -12);
    g.lineTo(12, -15);
    g.quadraticCurveTo(19, -14, 12, -7);
    g.quadraticCurveTo(15, 8, 0, 20);
    g.quadraticCurveTo(-15, 8, -12, -8);
    g.closePath();
    g.fillStyle = "#e8494f";
    g.fill();
    g.strokeStyle = "#8f2c37";
    g.lineWidth = 1.8;
    g.stroke();
    for (let i = 0; i < 9; i++) {
      const sx = ((i % 3) - 1) * 6 + (Math.floor(i / 3) % 2) * 3;
      const sy = -5 + Math.floor(i / 3) * 7;
      g.beginPath();
      g.ellipse(sx, sy, 1.25, 2, 0, 0, TAU);
      g.fillStyle = "#ffdf63";
      g.fill();
    }
    g.beginPath();
    g.moveTo(-9, -12);
    g.quadraticCurveTo(-4, -18, 0, -13);
    g.quadraticCurveTo(4, -19, 10, -12);
    g.quadraticCurveTo(4, -10, 0, -12);
    g.quadraticCurveTo(-4, -9, -9, -12);
    g.closePath();
    g.fillStyle = "#4caa4c";
    g.fill();
    g.strokeStyle = "#286b3d";
    g.lineWidth = 1.2;
    g.stroke();
    g.restore();
  };
  /**
   * 칸 가장자리에 걸친 그림이 잘리지 않게, 칸 밖으로 나간 부분을 반대쪽 가장자리에 이어 그린다.
   * 칸을 이어 깔면 잘린 두 조각이 맞붙어 온전한 모양이 된다 (불투명한 그림에만 쓴다: 겹쳐 그리면 반투명은 진해진다).
   */
  const wrapped = (draw: () => void) => {
    for (const dy of [-TILE, 0, TILE])
      for (const dx of [-TILE, 0, TILE]) {
        g.save();
        g.translate(dx, dy);
        draw();
        g.restore();
      }
  };
  /** 같은 그림을 여러 자리에 놓는다: [x, y, 크기, (나비 색 순번)]. 가장자리에 걸친 그림은 반대쪽에 이어 그린다 */
  const place = (spots: number[][], draw: (x: number, y: number, size: number, seed: number) => void) =>
    wrapped(() => spots.forEach(([x, y, size, seed = 0]) => draw(x, y, size, seed)));

  if (slug === "flower") {
    wrapped(() => {
      for (let y = 8, row = 0; y < TILE; y += 24, row++) for (let x = 8; x < TILE; x += 24) flower(x + (row % 2) * 4, y, 0.9);
    });
  } else if (slug === "wave") {
    // 물결 12줄 × 8픽셀 = 한 칸 높이라 위아래로 이어 깔아도 간격이 같다
      wrapped(() => {
      for (let band = 0; band < 12; band++) {
        const yAt = (x: number) => band * 8 + 4 + Math.sin((x / 48) * TAU + band * 0.6) * 3;
        g.beginPath();
        for (let x = 0; x <= TILE; x += 2) g.lineTo(x, yAt(x));
        g.strokeStyle = band % 3 ? accent(band) : color;
        g.lineWidth = 3.2;
        g.stroke();
        g.beginPath();
        for (let x = 0; x <= TILE; x += 4) g.lineTo(x, yAt(x) + 2.1);
        g.strokeStyle = "#fffdf9";
        g.lineWidth = 0.7;
        g.stroke();
    }
    });
  } else if (slug === "leaf") {
    const leafGreens = ["#4aa34d", "#72bf43", "#358e4b", "#9acb45", "#48ae64", "#78c84d", "#3f9b53"];
      wrapped(() =>
      [
        [14, 17, 0.48, -0.78],
        [47, 12, 0.42, 0.38],
        [81, 20, 0.49, 1.02],
        [31, 48, 0.57, 0.16],
        [68, 51, 0.5, -0.86],
        [13, 82, 0.45, 1.12],
        [80, 81, 0.44, 0.12],
    ].forEach(([x, y, size, angle], i) => leaf(x, y, size, angle, leafGreens[i])),
    );
  } else if (slug === "rainbow") {
    const colors = [color, "#f28c48", "#f6ce4c", "#65bd79", "#4ca9db", "#806bd2"];
    for (let i = 0; i < 12; i++) {
      g.fillStyle = colors[i % colors.length];
      g.fillRect(0, i * 8, TILE, 6);
    }
    g.globalAlpha = 0.28;
    g.fillStyle = "#fffdf9";
    for (let x = -96; x < 192; x += 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 4, 0);
      g.lineTo(x + 100, 96);
      g.lineTo(x + 96, 96);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
    wrapped(() => {
      for (let i = 0; i < 30; i++) dot((i * 31 + 5) % 96, (i * 43 + 9) % 96, 1.25, i % 2 ? "#fffdf9" : "#302c35");
      });
    } else if (slug === "stars") {
      wrapped(() => {
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 6; col++) {
          const x = 8 + col * 16 + (row % 2) * 8;
          const y = 8 + row * 16;
        star(x, y, (row + col) % 3 === 0 ? 7 : 5.5, (row + col) % 4 === 0 ? color : accent(row * 3 + col));
        if ((row + col) % 2 === 0) dot(x + 7, y + 6, 1.5, "#fffdf9");
      }
      });
    } else if (slug === "hearts") {
      wrapped(() => {
      for (let row = 0; row < 6; row++)
        for (let col = 0; col < 6; col++) {
          const x = 9 + col * 16 + (row % 2) * 4;
          const y = 9 + row * 16;
        heart(x, y, 10, (row + col) % 4 === 0 ? color : accent(row * 2 + col));
        if ((row + col) % 3 === 0) dot(x + 7, y + 6, 1.5, "#fffdf9");
      }
    });
  } else if (slug === "rose") {
    place(
      [
        [23, 23, 0.76],
        [70, 21, 0.7],
        [46, 68, 0.78],
        [0, 74, 0.55],
      ],
      rose,
    );
  } else if (slug === "clouds") {
    place(
      [
        [23, 22, 0.68],
        [70, 20, 0.62],
        [47, 55, 0.78],
        [0, 75, 0.5],
      ],
      cloud,
    );
    wrapped(() => {
      for (const [x, y] of [
        [48, 17],
        [84, 45],
        [13, 48],
        [70, 87],
      ])
        dot(x, y, 1.7, "#fffdf9");
    });
  } else if (slug === "butterflies") {
    place(
      [
        [23, 22, 0.72, 0],
        [70, 20, 0.66, 2],
        [45, 61, 0.78, 4],
        [0, 77, 0.52, 1],
      ],
      butterfly,
    );
  } else if (slug === "strawberries") {
    place(
      [
        [22, 23, 0.72],
        [69, 20, 0.66],
        [45, 64, 0.78],
        [0, 77, 0.52],
      ],
      strawberry,
    );
  }
  tiles.set(key, tile);
  return tile;
}

/** ctx 에서 붓 색으로 쓸 무늬. 캔버스 원점에 고정되어 획을 여러 번 나눠 그려도 무늬가 이어진다. */
export function patternFor(ctx: CanvasRenderingContext2D, slug: string, color: string, scale = PATTERN_SCALE) {
  const pattern = ctx.createPattern(patternTile(slug, color), "repeat")!;
  pattern.setTransform(new DOMMatrix().scale(scale).rotate(PATTERN_ROTATE));
  return pattern;
}
