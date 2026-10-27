// 장면 하나에 필요한 준비물을 만들고 캐시한다. 픽셀 계산이 무거우므로 장면마다 한 번만 하고 화면끼리 같이 쓴다.
// - loadScenePreview: 손질한 밑그림과 완성 예시 이미지 (장면 고르기 화면은 이것만 쓴다)
// - loadSceneAssets: 위 이미지 + 채점용 마스크 (그리기 화면)
// - loadSceneRegions: 색칠할 구역 (그리기 화면)
import type { Scene } from "../../data/scenes";
import { makeTracedExample, prepareGuide } from "./guideImage";
import { buildRegions, type Regions } from "./regions";
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
    const guide = await loadGuide(scene);
    const [guideUrl, exampleUrl] = await Promise.all([toUrl(guide), toUrl(makeTracedExample(guide, scene.scoreExclude))]);
    return { guideUrl, exampleUrl };
  });

const loadSceneMasks = (scene: Scene) =>
  cached(masks, scene, async () => buildGuideMasks(await loadGuide(scene), scene.width, scene.height, scene.scoreExclude));

const regionCache = new Map<string, Promise<Regions>>();

/** 색칠할 구역 (손질한 밑그림을 선으로 나눈 것) */
export const loadSceneRegions = (scene: Scene) => cached(regionCache, scene, async () => buildRegions(await loadGuide(scene)));

export async function loadSceneAssets(scene: Scene): Promise<SceneAssets> {
  const [preview, sceneMasks] = await Promise.all([loadScenePreview(scene), loadSceneMasks(scene)]);
  return { ...preview, masks: sceneMasks };
}
