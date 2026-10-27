// 색칠하기의 구역 나누기. 따라 그릴 흰 선만 벽으로 보고, 흰 선으로 둘러싸인 부분끼리 한 구역으로 묶는다.
// 붓을 대는 순간 그 자리의 구역을 정하고, 붓을 떼기 전까지는 그 구역 안에만 색이 칠해진다 (components/TracingCanvas.tsx, paint.ts).
// 회색·검은 선(배경 그림)은 벽이 아니라서 그 위로 이어 칠할 수 있다. 선 그림을 색 위에 덮으므로 선은 그대로 보인다.
// - 흰 선: LIGHT_LINE 보다 밝은 픽셀. 구역의 벽이고, 어떤 구역도 칠하지 않는다
// - 구역: 흰 선을 CLOSE_GAP 픽셀 두껍게 한 벽으로 나눈 덩어리 (대각선으로는 잇지 않아 가는 선 틈으로 새지 않는다).
//   여자아이 머리카락처럼 흰 선이 가닥마다 끊겨 있어도 그 틈이 막혀 안팎이 나뉜다.
//   그다음 두껍게 해서 빠진 자리(흰 선이 아닌 곳)를 모든 구역이 한 픽셀씩 동시에 넓혀 나눠 가지므로, 칠할 수 없는 빈 곳이 남지 않는다.
// - 선 그림(lines): 밑그림에서 선(회색·검은 선, 흰 선)만 남긴 투명 그림. 색 위에 덮어서 선이 보이게 한다

/** 밑그림 바탕 회색의 밝기 (guideImage.ts 와 같음) */
const BG = 182;
/**
 * 흰 선으로 보는 밝기. 흰 선 가운데(255)와 바탕(182)의 중간값은 218 이지만,
 * 그러면 남자아이 재킷의 흰 테두리 중 흐린 곳(200~218)으로 재킷과 뒤 배경이 이어져서 200 으로 낮췄다.
 */
const LIGHT_LINE = 200;
/** 구역을 나눌 때 흰 선을 두껍게 하는 픽셀 수. 이보다 두 배 좁은 흰 선 틈은 막힌다 (2 이하는 여자아이 머리카락 안팎이 이어짐) */
const CLOSE_GAP = 3;
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
  /** 흰 선 (칠하지 않는 곳) */
  const isWhite = (i: number) => value[i] > LIGHT_LINE;
  // 구역을 나눌 벽: 흰 선을 CLOSE_GAP 번 상하좌우로 두껍게 한다
  let wall = new Uint8Array(n);
  for (let i = 0; i < n; i++) wall[i] = isWhite(i) ? 1 : 0;
  for (let step = 0; step < CLOSE_GAP; step++) {
    const grown = wall.slice();
    for (let i = 0; i < n; i++) {
      if (wall[i]) continue;
      const x = i % width;
      if ((x > 0 && wall[i - 1]) || (x < width - 1 && wall[i + 1]) || (i >= width && wall[i - width]) || (i < n - width && wall[i + width])) grown[i] = 1;
    }
    wall = grown;
  }
  const isWall = (i: number) => wall[i] === 1;

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

  // 벽을 두껍게 해서 빠진 자리(흰 선이 아닌 곳)를 모든 구역이 한 픽셀씩 동시에 넓혀 나눠 가진다 (먼저 닿은 구역이 갖는다).
  // 흰 선 틈은 양쪽 구역이 가운데서 만나므로 다시 이어지지 않고, 흰 선 사이의 좁은 곳도 옆 구역에 들어가 칠할 수 있다.
  const free = (j: number) => !labels[j] && !isWhite(j);
  let front: number[] = [];
  for (let i = 0; i < n; i++) if (free(i)) front.push(i);
  while (front.length) {
    const taken: number[] = [];
    for (const j of front) {
      if (!free(j)) continue;
      const x = j % width;
      const id = (x > 0 && labels[j - 1]) || (x < width - 1 && labels[j + 1]) || (j >= width && labels[j - width]) || (j < n - width && labels[j + width]) || 0;
      if (id) taken.push(j, id);
    }
    if (!taken.length) break;
    const nextFront: number[] = [];
    for (let k = 0; k < taken.length; k += 2) {
      const j = taken[k];
      const id = taken[k + 1];
      if (labels[j]) continue;
      labels[j] = id;
      const x = j % width;
      const y = (j - x) / width;
      const box = boxes[id];
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
      if (x > 0) nextFront.push(j - 1);
      if (x < width - 1) nextFront.push(j + 1);
      if (j >= width) nextFront.push(j - width);
      if (j < n - width) nextFront.push(j + width);
    }
    front = nextFront;
  }

  // 흰 선으로 완전히 둘러싸인 작은 자리(눈동자 빛 등)는 두껍게 한 벽에 묻혀 어느 구역도 닿지 못하므로 따로 구역을 만든다.
  for (let start = 0; start < n; start++) {
    if (!free(start)) continue;
    const id = next++;
    const box = [width, height, 0, 0];
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top) {
      const i = stack[--top];
      const x = i % width;
      const y = (i - x) / width;
      box[0] = Math.min(box[0], x);
      box[1] = Math.min(box[1], y);
      box[2] = Math.max(box[2], x);
      box[3] = Math.max(box[3], y);
      for (const j of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, y > 0 ? i - width : -1, y < height - 1 ? i + width : -1]) {
        if (j >= 0 && free(j)) {
          labels[j] = id;
          stack[top++] = j;
        }
      }
    }
    boxes.push(box);
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
