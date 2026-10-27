// 색칠하기의 구역 나누기. 따라 그릴 흰 선만 벽으로 보고, 흰 선으로 둘러싸인 부분끼리 한 구역으로 묶는다.
// 붓을 대는 순간 그 자리의 구역을 정하고, 붓을 떼기 전까지는 그 구역 안에만 색이 칠해진다 (components/TracingCanvas.tsx, paint.ts).
// 회색·검은 선(배경 그림)은 벽이 아니라서 그 위로 이어 칠할 수 있다. 선 그림을 색 위에 덮으므로 선은 그대로 보인다.
// - 흰 선: LIGHT_LINE 보다 밝은 픽셀. 구역의 벽이고, 어떤 구역도 칠하지 않는다
// - 구역: 흰 선이 아닌 픽셀을 상하좌우로 이어 붙인 덩어리 (대각선으로는 잇지 않아 가는 선 틈으로 새지 않는다)
// - 선 그림(lines): 밑그림에서 선(회색·검은 선, 흰 선)만 남긴 투명 그림. 색 위에 덮어서 선이 보이게 한다

/** 밑그림 바탕 회색의 밝기 (guideImage.ts 와 같음) */
const BG = 182;
/**
 * 흰 선으로 보는 밝기. 흰 선 가운데(255)와 바탕(182)의 중간값은 218 이지만,
 * 그러면 남자아이 재킷의 흰 테두리 중 흐린 곳(200~218)으로 재킷과 뒤 배경이 이어져서 200 으로 낮췄다.
 */
const LIGHT_LINE = 200;
/** 검은 선의 가장 진한 밝기 (선 그림에서 이 밝기를 완전히 불투명하게) */
const DARK_CORE = 70;
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
  /** 흰 선 (구역의 벽, 칠하지 않는 곳) */
  const isWall = (i: number) => value[i] > LIGHT_LINE;

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
    const x = minX;
    const y = minY;
    const w = maxX + 1 - x;
    const h = maxY + 1 - y;
    // 사각형 안에서 이 구역 픽셀만 불투명하게. 선 픽셀은 구역에 들지 않으므로 색이 선을 넘거나 선 위에 칠해지지 않는다.
    const mask = document.createElement("canvas");
    mask.width = w;
    mask.height = h;
    const ctx = mask.getContext("2d")!;
    const image = ctx.createImageData(w, h);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (labels[(y + yy) * width + x + xx] === id) image.data[(yy * w + xx) * 4 + 3] = 255;
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
