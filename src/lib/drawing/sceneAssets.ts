// 장면 하나에 필요한 준비물을 만들고 캐시한다. 픽셀 계산이 무거우므로 장면마다 한 번만 하고 화면끼리 같이 쓴다.
// - loadScenePreview: 손질한 밑그림과 완성 예시 이미지 (장면 고르기 화면은 이것만 쓴다)
// - loadSceneAssets: 위 이미지 + 채점용 마스크 (그리기 화면)
// - loadSceneRegions: 색칠할 구역 (그리기 화면)
// - renderDraftPreview: 그리던 그림을 그리기 화면처럼 겹친 미리보기 (장면 고르기 화면의 "이어 그리기" 카드)
import type { Scene } from "../../data/scenes";
import { loadBrushTextures } from "./brushPatterns";
import { makeTracedExample, prepareGuide } from "./guideImage";
import { makeCanvas, renderPaint } from "./paint";
import { drawStroke } from "./penStroke";
import { buildRegions, type Regions } from "./regions";
import type { PaintStroke, Stroke } from "./strokes";
import { buildGuideMasks, type GuideMasks } from "./traceScore";

type ScenePreview = {
  /** 손질한 밑그림 (음표 등을 회색 선으로) */
  guideUrl: string;
  /** 완성 예시 (흰 선을 검은 선으로 칠한 그림) — 선택 화면 미리보기에도 쓴다 */
  exampleUrl: string;
};

type SceneAssets = ScenePreview & {
  /** 채점용 흰 선 / 회색 구역 위치 */
  masks: GuideMasks;
};

const toUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("이미지를 만들지 못했습니다")))),
  );

/** 장면 id마다 한 번만 만든다. 실패하면 다음에 다시 시도할 수 있게 지운다. (페이지를 새로 고치기 전까지 유지) */
function cached<T>(cache: Map<string, Promise<T>>, scene: Scene, make: () => Promise<T>) {
  let value = cache.get(scene.id);
  if (!value) {
    value = make();
    value.catch(() => cache.delete(scene.id));
    cache.set(scene.id, value);
  }
  return value;
}

const guides = new Map<string, Promise<HTMLCanvasElement>>();
const previews = new Map<string, Promise<ScenePreview>>();
const masks = new Map<string, Promise<GuideMasks>>();

/** 원본 밑그림을 불러와 따라 그리지 않을 흰 선을 회색으로 바꾼 캔버스 (색칠할 구역도 이 캔버스로 나눈다) */
const loadGuide = (scene: Scene) =>
  cached(guides, scene, () =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`밑그림을 불러오지 못했습니다: ${scene.id}`));
      img.src = scene.guide;
    }).then((img) => prepareGuide(img, scene.width, scene.height, scene.backgroundRegions, scene.scoreExclude)),
  );

export const loadScenePreview = (scene: Scene) =>
  cached(previews, scene, async () => {
    // 새 챕터 장면은 선화와 색칠용 이미지가 모두 준비되어 있으므로 목록에서 무거운 캔버스 변환을 하지 않는다.
    if (scene.example) return { guideUrl: scene.guide, exampleUrl: scene.example };
    const guide = await loadGuide(scene);
    const [guideUrl, exampleUrl] = await Promise.all([toUrl(guide), toUrl(makeTracedExample(guide, scene.scoreExclude))]);
    return { guideUrl, exampleUrl };
  });

const loadSceneMasks = (scene: Scene) =>
  cached(masks, scene, async () => buildGuideMasks(await loadGuide(scene), scene.width, scene.height, scene.scoreExclude));

const regionCache = new Map<string, Promise<Regions>>();

/** 색칠할 구역 (손질한 밑그림을 선으로 나눈 것) */
export const loadSceneRegions = (scene: Scene) => cached(regionCache, scene, async () => buildRegions(await loadGuide(scene)));

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });

/**
 * 그리던 그림 미리보기: 그리기 화면과 똑같이 (흰 바탕 → 밑그림 → 색칠 → 밑그림 선 → 펜 선) 겹친 이미지 주소.
 * guideOpacity: 밑그림 진하기 (0~1, 0이면 밑그림을 넣지 않는다). 다 쓰면 URL.revokeObjectURL 로 놓아준다.
 */
export async function renderDraftPreview(scene: Scene, strokes: (Stroke | PaintStroke)[], guideOpacity: number) {
  const { width, height } = scene;
  // 색칠이나 지우개가 있을 때만 무거운 구역 나누기를 한다
  const needsRegions = strokes.some((s) => s.type === "paint" || s.erase);
  const [guide, regions] = await Promise.all([
    guideOpacity > 0 ? loadScenePreview(scene).then((p) => loadImage(p.guideUrl)) : null,
    needsRegions ? loadSceneRegions(scene) : null,
    loadBrushTextures(strokes.flatMap((s) => (s.type === "paint" && s.pattern ? [s.pattern] : []))),
  ]);

  const out = makeCanvas(width, height);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (guide) {
    ctx.globalAlpha = guideOpacity;
    ctx.drawImage(guide, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  if (regions) {
    const paint = makeCanvas(width, height);
    renderPaint(paint.getContext("2d")!, strokes, regions);
    ctx.drawImage(paint, 0, 0);
    if (guide) {
      ctx.globalAlpha = guideOpacity;
      ctx.drawImage(regions.lines, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
  // 펜 선은 따로 그려야 지우개가 밑그림·색까지 지우지 않는다
  const pen = makeCanvas(width, height);
  const penCtx = pen.getContext("2d")!;
  for (const s of strokes) if (s.type === "stroke") drawStroke(penCtx, s);
  ctx.drawImage(pen, 0, 0);
  return toUrl(out);
}

export async function loadSceneAssets(scene: Scene): Promise<SceneAssets> {
  const [preview, sceneMasks] = await Promise.all([loadScenePreview(scene), loadSceneMasks(scene)]);
  return { ...preview, masks: sceneMasks };
}
