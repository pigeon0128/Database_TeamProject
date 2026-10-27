// 색칠하기의 구역 나누기. 밑그림의 선(검은·회색 선과 흰 선)을 벽으로 보고, 선으로 둘러싸인 바탕 부분끼리 한 구역으로 묶는다.
// 붓을 대는 순간 그 자리의 구역을 정하고, 붓을 떼기 전까지는 그 구역 안에만 색이 칠해진다 (components/ColoringCanvas.tsx).
// - 구역: 바탕 회색 픽셀을 상하좌우로 이어 붙인 덩어리 (대각선으로는 잇지 않아 가는 선 틈으로 새지 않는다)
// - 구역 마스크: 구역 픽셀 + 붙어 있는 선 픽셀 DILATE 줄. 색이 선 밑까지 들어가 선과 색 사이에 틈이 보이지 않게 한다
// - 선 그림(lines): 밑그림에서 선만 남긴 투명 그림. 색 위에 덮어서 칠해도 선이 보이게 한다

/** 밑그림 바탕 회색의 밝기 (guideImage.ts 와 같음) */
const BG = 182;
/** 바탕에서 이만큼 넘게 어둡거나 밝으면 선(벽) */
const DARK_EDGE = 40;
const LIGHT_EDGE = 25;
/** 검은 선의 가장 진한 밝기 (선 그림에서 이 밝기를 완전히 불투명하게) */
const DARK_CORE = 70;
/** 구역 마스크를 선 쪽으로 넓히는 픽셀 수 */
const DILATE = 2;
/** 붓을 선 위에 댔을 때 가까운 구역을 찾는 거리 */
const PICK_RADIUS = 10;

export type Region = {
  id: number;
  /** 마스크가 차지하는 사각형 (캔버스 좌표) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 사각형 크기의 캔버스. 구역 안만 불투명 */
  mask: HTMLCanvasElement;
};

export type Regions = {
  width: number;
  height: number;
  /** (x, y)에 붓을 댔을 때 칠할 구역 번호. 선 위면 가장 가까운 구역, 근처에 구역이 없으면 0 */
  at: (x: number, y: number) => number;
  region: (id: number) => Region;
  /** 선만 남긴 투명 그림 (색 위에 덮는다) */
  lines: HTMLCanvasElement;
};

export function buildRegions(guide: HTMLCanvasElement): Regions {
  const { width, height } = guide;
  const n = width * height;
  const data = guide.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, width, height).data;

  const value = new Uint8Array(n);
  for (let i = 0; i < n; i++) value[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  const isWall = (i: number) => value[i] < BG - DARK_EDGE || value[i] > BG + LIGHT_EDGE;

  // 구역 번호 붙이기 (0 = 선). 구역마다 사각형 범위도 기록한다.
  const labels = new Int32Array(n);
  const boxes: number[][] = [[0, 0, 0, 0]];
  const stack = new Int32Array(n);
  let next = 1;
  for (let start = 0; start < n; start++) {
    if (labels[start] || isWall(start)) continue;
    const id = next++;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    const visit = (j: number) => {
      if (labels[j] || isWall(j)) return;
      labels[j] = id;
      stack[top++] = j;
    };
    while (top) {
      const i = stack[--top];
      const x = i % width;
      const y = (i - x) / width;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    boxes.push([minX, minY, maxX, maxY]);
  }

  const lines = document.createElement("canvas");
  lines.width = width;
  lines.height = height;
  const lineCtx = lines.getContext("2d")!;
  const lineImage = lineCtx.createImageData(width, height);
  const out = lineImage.data;
  for (let i = 0; i < n; i++) {
    const v = value[i];
    // 바탕 위에 겹쳤을 때 원래 밝기가 되는 투명도로 선을 남긴다 (흐린 가장자리도 자연스럽게)
    const dark = v < BG;
    const a = dark ? Math.min(1, (BG - v) / (BG - DARK_CORE)) : Math.min(1, (v - BG) / (255 - BG));
    if (a < 0.08) continue;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = dark ? DARK_CORE : 255;
    out[i * 4 + 3] = a * 255;
  }
  lineCtx.putImageData(lineImage, 0, 0);

  const cache = new Map<number, Region>();
  function region(id: number): Region {
    const hit = cache.get(id);
    if (hit) return hit;
    const [minX, minY, maxX, maxY] = boxes[id];
    const x = Math.max(0, minX - DILATE);
    const y = Math.max(0, minY - DILATE);
    const w = Math.min(width, maxX + DILATE + 1) - x;
    const h = Math.min(height, maxY + DILATE + 1) - y;
    // 사각형 안에서: 구역 픽셀 = 1, 그 옆의 선 픽셀로 DILATE 번 넓힌다 (다른 구역 픽셀로는 넓히지 않는다)
    let inside = new Uint8Array(w * h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (labels[(y + yy) * width + x + xx] === id) inside[yy * w + xx] = 1;
    for (let step = 0; step < DILATE; step++) {
      const grown = inside.slice();
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) {
          const j = yy * w + xx;
          if (inside[j] || labels[(y + yy) * width + x + xx]) continue;
          if ((xx > 0 && inside[j - 1]) || (xx < w - 1 && inside[j + 1]) || (yy > 0 && inside[j - w]) || (yy < h - 1 && inside[j + w])) grown[j] = 1;
        }
      inside = grown;
    }
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const ctx = mask.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    for (let j = 0; j < w * h; j++) if (inside[j]) image.data[j * 4 + 3] = 255;
    ctx.putImageData(image, 0, 0);
    const r = { id, x, y, w, h, mask };
    cache.set(id, r);
    return r;
  }

  function at(px: number, py: number) {
    const cx = Math.round(px);
    const cy = Math.round(py);
    // 가까운 거리부터 둘레를 넓혀 가며 찾는다
    for (let r = 0; r <= PICK_RADIUS; r++) {
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const id = labels[y * width + x];
          if (id) return id;
        }
    }
    return 0;
  }

  return { width, height, at, region, lines };
}
