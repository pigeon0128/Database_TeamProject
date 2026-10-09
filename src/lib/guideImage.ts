import type { Rect } from "./traceScore";

/** 밑그림 바탕 회색의 밝기 */
const BG = 182;

const inRects = (x: number, y: number, rects: Rect[]) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

/**
 * 밑그림을 캔버스에 그리고, backgroundRegions 안의 흰 선을 회색 선(배경)으로 바꾼다.
 * 바탕보다 밝은 만큼 같은 양만큼 어둡게 뒤집어서 선의 부드러운 가장자리를 유지한다.
 * keep 영역(안내 문구 상자 등)은 건드리지 않는다.
 */
export function prepareGuide(img: HTMLImageElement, width: number, height: number, backgroundRegions: Rect[], keep: Rect[] = []) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);
  if (!backgroundRegions.length) return canvas;

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (const r of backgroundRegions) {
    for (let y = Math.max(0, r.y); y < Math.min(height, r.y + r.h); y++) {
      for (let x = Math.max(0, r.x); x < Math.min(width, r.x + r.w); x++) {
        if (inRects(x, y, keep)) continue;
        const i = (y * width + x) * 4;
        const v = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (v <= BG + 4) continue;
        const flipped = Math.max(0, BG - (v - BG));
        data[i] = data[i + 1] = data[i + 2] = flipped;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
