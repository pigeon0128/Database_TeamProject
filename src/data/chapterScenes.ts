// 챕터별 선화·색칠용 이미지를 WebP로 최적화해 장면 데이터로 자동 구성한다.
// 파일명에 포함한 실제 크기를 읽어 다양한 가로·세로 비율을 왜곡 없이 표시한다.
import type { Scene } from "./scenes";

type ChapterScene = Scene & { chapter: string };

const lineartFiles = import.meta.glob("../assets/story/chapters/*/lineart/*_lineart.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const coloringFiles = import.meta.glob("../assets/story/chapters/*/coloring/*_coloring.webp", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export const storyChapters = [
  { id: "special", label: "기존 장면", title: "도로랜드 이야기" },
  { id: "ch1-1", label: "CH 1-1", title: "도로랜드에서 온 초대장" },
  { id: "ch1-2", label: "CH 1-2", title: "사라진 지도 조각과 운전면허시험" },
  { id: "ch1-3", label: "CH 1-3", title: "출입금지 너머의 비밀" },
  { id: "ch2-2", label: "CH 2-2", title: "멈춰버린 하모니아" },
  { id: "ch2-3", label: "CH 2-3", title: "소리에도 생명이 있구나" },
  { id: "ch3-1", label: "CH 3-1", title: "밤에 나타난 파란 빛" },
  { id: "ch3-2", label: "CH 3-2", title: "기억의 틈" },
  { id: "ch3-3", label: "CH 3-3", title: "흩어진 부품들" },
] as const;

const chapterOrder = new Map<string, number>(storyChapters.map((chapter, index) => [chapter.id, index]));
const filePattern = /\/chapters\/([^/]+)\/lineart\/(.+)__(\d+)x(\d+)_lineart\.webp$/;

const parsedScenes: ChapterScene[] = Object.entries(lineartFiles)
  .map(([path, guide]) => {
    const match = filePattern.exec(path);
    if (!match) throw new Error(`챕터 장면 파일 이름을 읽을 수 없어요: ${path}`);
    const [, chapter, base, width, height] = match;
    const colorPath = path.replace("/lineart/", "/coloring/").replace("_lineart.webp", "_coloring.webp");
    const example = coloringFiles[colorPath];
    if (!example) throw new Error(`색칠용 장면을 찾을 수 없어요: ${colorPath}`);

    const id = base.startsWith(`${chapter}-`) ? base : `${chapter}-${base}`;
    return {
      id,
      chapter,
      // 실제 표시 번호는 챕터별 정렬이 끝난 뒤 01부터 다시 붙인다.
      title: "",
      line: "색을 입혀 장면을 완성해 보세요!",
      guide,
      example,
      width: Number(width),
      height: Number(height),
      scoreExclude: [],
      backgroundRegions: [],
    };
  })
  .sort((a, b) => {
    const chapterDifference = (chapterOrder.get(a.chapter) ?? 99) - (chapterOrder.get(b.chapter) ?? 99);
    return chapterDifference || a.id.localeCompare(b.id, "ko", { numeric: true });
  });

const sceneCountByChapter = new Map<string, number>();

export const chapterScenes: ChapterScene[] = parsedScenes.map((scene) => {
  const sceneNumber = (sceneCountByChapter.get(scene.chapter) ?? 0) + 1;
  sceneCountByChapter.set(scene.chapter, sceneNumber);
  return { ...scene, title: `장면 ${String(sceneNumber).padStart(2, "0")}` };
});
