// 스토리 장면 목록. 장면을 새로 추가하려면 밑그림 이미지를 assets/story에 넣고 여기에 항목을 하나 더 적는다
// (DB에는 database/seeds/content.sql 로 그림 정보와 이미지 경로 reference_image_key 를 넣는다).
// 장면마다 밑그림, 크기, 채점에서 뺄 영역, 따라 그리기 대상에서 뺄 영역을 정한다.
import forestGuide from "../assets/story/forest-guide.webp";
import type { Rect } from "../lib/drawing/strokes";

export type Scene = {
  /** 주소에 쓰이는 이름 (#/story/<id>) */
  id: string;
  /** DB drawings.drawing_id (기록 저장·리더보드용). 아직 DB에 없는 장면이면 비워 둔다. */
  drawingId?: number;
  title: string;
  line: string;
  guide: string;
  width: number;
  height: number;
  /** 채점에서 뺄 영역 (밑그림 안의 안내 문구 상자 등) */
  scoreExclude: Rect[];
  /** 이 영역의 흰 선은 따라 그리기 대상에서 빼고 회색 선(배경)으로 바꾼다 */
  backgroundRegions: Rect[];
  /**
   * 브러쉬 최대 굵기를 기본(6)보다 낮출 때. 흰 선이 아주 가는 밑그림이면 굵은 브러쉬로 선을 덮어 버리지 않게 줄인다.
   * 흰 선 평균 두께 × 1.2 정도가 알맞다 (숲속의 노래: 흰 선 약 4.2픽셀 → 6이라 기본값 그대로).
   */
  maxBrushSize?: number;
  /**
   * 실제로 그려지는 선 굵기 = 굵기 설정 × 이 값 (기본 1). 밑그림마다 흰 선 두께가 달라서, 굵기 6이 흰 선 두께와 비슷해지도록 맞춘다.
   * 흰 선 두께(px) ÷ 4.3 정도 (숲속의 노래: 흰 선 약 4.2px → 1).
   */
  brushScale?: number;
};

export const scenes: Scene[] = [
  {
    id: "forest-music",
    drawingId: 1,
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
