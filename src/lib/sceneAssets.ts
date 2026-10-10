// 장면 하나에 필요한 준비물(손질한 밑그림, 완성 예시, 채점용 마스크)을 한 번에 만들고 캐시한다.
// 무거운 픽셀 계산이라 장면마다 한 번만 하고, 선택 화면과 그리기 화면이 결과를 같이 쓴다.
import type { Scene } from "../data/scenes";
import { makeTracedExample, prepareGuide } from "./guideImage";
import { buildGuideMasks, type GuideMasks } from "./traceScore";

export type SceneAssets = {
  /** 손질한 밑그림 (음표 등을 회색 선으로) */
  guideUrl: string;
  /** 완성 예시 (흰 선을 검은 선으로 칠한 그림) — 선택 화면 미리보기에도 쓴다 */
  exampleUrl: string;
  /** 채점용 흰 선 / 회색 구역 위치 */
  masks: GuideMasks;
};

// 장면마다 한 번만 만들어서, 선택 화면과 그리기 화면이 같이 쓴다. (페이지를 새로 고치기 전까지 유지)
const cache = new Map<string, Promise<SceneAssets>>();

const toUrl = (canvas: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(URL.createObjectURL(blob)) : reject(new Error("이미지를 만들지 못했습니다")))),
  );

function build(scene: Scene): Promise<SceneAssets> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`밑그림을 불러오지 못했습니다: ${scene.id}`));
    img.src = scene.guide;
  }).then(async (img) => {
    const guide = prepareGuide(img, scene.width, scene.height, scene.backgroundRegions, scene.scoreExclude);
    const masks = buildGuideMasks(guide, scene.width, scene.height, scene.scoreExclude);
    const [guideUrl, exampleUrl] = await Promise.all([toUrl(guide), toUrl(makeTracedExample(guide, scene.scoreExclude))]);
    return { guideUrl, exampleUrl, masks };
  });
}

export function loadSceneAssets(scene: Scene): Promise<SceneAssets> {
  let assets = cache.get(scene.id);
  if (!assets) {
    assets = build(scene);
    // 실패하면 다음에 다시 시도할 수 있게 지운다.
    assets.catch(() => cache.delete(scene.id));
    cache.set(scene.id, assets);
  }
  return assets;
}
