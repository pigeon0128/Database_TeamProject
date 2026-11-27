// AI 밑그림(서버 /api/ai/sketch 가 돌려준 그림)을 도감 밑그림과 똑같은 형식으로 맞춘다.
//   도감 밑그림 형식: 밝기 BG(182) 회색 바탕 + 흰 선(255). 흰 선이 색칠 구역의 벽이 된다 (regions.ts 의 buildRegions).
// AI는 그림체 참고를 따라 회색 바탕 + 흰 선으로 그리지만, 바탕 회색이 조금 다르거나 색이 살짝 섞일 수 있어서
// 밝기만 보고 "바탕"과 "선"을 다시 나눠 바탕은 정확히 182, 선은 255 로 칠한다 (선 가장자리는 그 사이로 부드럽게).
// 혹시 흰 바탕 + 검은 선으로 나오면 검은 선을 흰 선으로 뒤집어 같은 형식으로 만든다.
import { buildRegions, type Regions } from "./regions";

/** 도감 밑그림 바탕 회색 밝기 (guideImage.ts, regions.ts 와 같음) */
const BG = 182;
/** 바탕과 이만큼 밝기가 달라야 선으로 보기 시작한다 (바탕의 잡티·압축 무늬는 버린다) */
const LINE_START = 18;
/** 바탕과 이만큼 다르면 완전한 선 */
const LINE_FULL = 60;
/** 바탕이 이보다 밝으면 흰 바탕 + 어두운 선 그림으로 본다 */
const WHITE_PAPER = 215;

export type AiGuide = {
  /** 도감 형식으로 맞춘 밑그림 (PNG data URL) */
  url: string;
  /** 흰 선으로 나눈 색칠 구역 */
  regions: Regions;
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("AI 밑그림을 불러오지 못했어요."));
    img.src = src;
  });

/** 가장 많은 밝기 = 바탕 밝기 (그림 대부분이 바탕이다) */
function backgroundLevel(value: Uint8Array) {
  const hist = new Uint32Array(256);
  for (const v of value) hist[v]++;
  let best = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v;
  return best;
}

/** 받은 그림(또는 보관해 둔 밑그림)을 도감 형식으로 맞추고 색칠 구역을 나눈다 */
export async function makeAiGuide(src: string, width: number, height: number): Promise<AiGuide> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, width, height);

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const n = width * height;
  const value = new Uint8Array(n);
  for (let i = 0; i < n; i++) value[i] = Math.round(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);

  const bg = backgroundLevel(value);
  // 회색 바탕이면 바탕보다 밝은 곳이 선, 흰 바탕이면 바탕보다 어두운 곳이 선
  const darkLines = bg > WHITE_PAPER;
  for (let i = 0; i < n; i++) {
    const diff = darkLines ? bg - value[i] : value[i] - bg;
    const t = Math.max(0, Math.min(1, (diff - LINE_START) / (LINE_FULL - LINE_START)));
    const v = Math.round(BG + t * (255 - BG));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);

  return { url: canvas.toDataURL("image/png"), regions: buildRegions(canvas) };
}
