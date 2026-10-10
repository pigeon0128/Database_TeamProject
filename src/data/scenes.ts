// 스토리 장면 목록. 장면을 새로 추가하려면 밑그림 이미지를 assets/story에 넣고 여기에 항목을 하나 더 적는다.
// 장면마다 밑그림, 크기, 채점에서 뺄 영역, 따라 그리기 대상에서 뺄 영역을 정한다.
import forestGuide from "../assets/story/forest-guide.webp";
import type { Rect } from "../lib/traceScore";

export type Scene = {
  /** 주소에 쓰이는 이름 (#/story/<id>) */
  id: string;
  title: string;
  line: string;
  guide: string;
  width: number;
  height: number;
  /** 채점에서 뺄 영역 (밑그림 안의 안내 문구 상자 등) */
  scoreExclude: Rect[];
  /** 이 영역의 흰 선은 따라 그리기 대상에서 빼고 회색 선(배경)으로 바꾼다 */
  backgroundRegions: Rect[];
};

export const scenes: Scene[] = [
  {
    id: "forest-music",
    title: "숲속의 노래",
    line: "소리에도 생명이 있구나!!",
    guide: forestGuide,
    width: 1500,
    height: 1049,
    scoreExclude: [{ x: 0, y: 0, w: 395, h: 115 }],
    // 위쪽 음표 (캐릭터 손은 y 400부터 시작)
    backgroundRegions: [{ x: 300, y: 0, w: 960, h: 370 }],
  },
];

export const findScene = (id: string) => scenes.find((s) => s.id === id);
