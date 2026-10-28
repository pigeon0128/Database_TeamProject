// 도감 생물 목록과 밑그림 이미지(assets/creatures). DB에는 이미지 경로(drawings.reference_image_key)만 있다.
// 도감 정보(분류·사는 곳·그릴 때 살펴볼 점)와 수집 현황도 DB에서 GET /api/collection 으로 받는다.
// 여기에는 그리기 화면에 필요한 번호·크기·선 두께만 둔다. drawingId 와 이름은 database/seeds/content.sql 과 맞춘다.
// 밑그림은 스토리 장면과 같은 형식(밝은 회색 바탕 + 따라 그릴 흰 선)이라 같은 채점·기록 저장을 쓴다.
import airplane from "../assets/creatures/airplane.png";
import cactus from "../assets/creatures/cactus.png";
import cat from "../assets/creatures/cat.png";
import dandelion from "../assets/creatures/dandelion.png";
import dog from "../assets/creatures/dog.png";
import lion from "../assets/creatures/lion.png";
import playground from "../assets/creatures/playground.png";
import robot from "../assets/creatures/robot.png";
import rose from "../assets/creatures/rose.png";
import seaturtle from "../assets/creatures/seaturtle.png";
import soccerball from "../assets/creatures/soccerball.png";
import sportscar from "../assets/creatures/sportscar.png";
import sunflower from "../assets/creatures/sunflower.png";
import tree from "../assets/creatures/tree.png";
import zebra from "../assets/creatures/zebra.png";
import type { Scene } from "./scenes";

export const CATEGORY_LABELS = { animal: "동물", plant: "식물", object: "무생물" } as const;
export type CreatureCategory = keyof typeof CATEGORY_LABELS;

type CreatureGuide = {
  /** 주소에 쓰이는 이름 (#/creatures/<slug>), DB creature_profiles.slug */
  slug: string;
  /** DB drawings.drawing_id */
  drawingId: number;
  /** DB drawings.title 과 같은 이름 (DB를 불러오기 전이나 리더보드에서 쓴다) */
  name: string;
  /** DB creature_profiles.category. API가 없는 로컬 미리보기에서도 목록을 나누기 위해 함께 둔다. */
  category: CreatureCategory;
  /** 밑그림 이미지 */
  guide: string;
  /** 밑그림 크기 (px). 도감 밑그림은 모두 1500x1500 정사각형 */
  width: number;
  height: number;
  /** 밑그림의 흰 선 두께 (px). 브러쉬 굵기를 이 두께에 맞춘다 (Scene.brushScale). 도감 밑그림은 모두 6px */
  lineWidth: number;
};

const CREATURE_GUIDES: CreatureGuide[] = [
  { slug: "lion", drawingId: 2, name: "사자", category: "animal", guide: lion, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "zebra", drawingId: 3, name: "얼룩말", category: "animal", guide: zebra, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "cat", drawingId: 4, name: "고양이", category: "animal", guide: cat, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "seaturtle", drawingId: 5, name: "바다거북", category: "animal", guide: seaturtle, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "dog", drawingId: 6, name: "골든 리트리버", category: "animal", guide: dog, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "sunflower", drawingId: 7, name: "해바라기", category: "plant", guide: sunflower, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "rose", drawingId: 8, name: "장미", category: "plant", guide: rose, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "cactus", drawingId: 9, name: "사와로 선인장", category: "plant", guide: cactus, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "tree", drawingId: 10, name: "느티나무", category: "plant", guide: tree, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "dandelion", drawingId: 11, name: "민들레", category: "plant", guide: dandelion, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "airplane", drawingId: 12, name: "비행기", category: "object", guide: airplane, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "sportscar", drawingId: 13, name: "스포츠카", category: "object", guide: sportscar, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "soccerball", drawingId: 14, name: "축구공", category: "object", guide: soccerball, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "robot", drawingId: 15, name: "로봇", category: "object", guide: robot, width: 1500, height: 1500, lineWidth: 6 },
  { slug: "playground", drawingId: 17, name: "놀이터", category: "object", guide: playground, width: 1500, height: 1500, lineWidth: 6 },
];

/** API·DB가 없는 로컬 미리보기에서 보여 줄 최소 도감 목록. */
export const localCreatureCatalog = CREATURE_GUIDES.map(({ drawingId, name, slug, category }) => ({ drawingId, name, slug, category }));

/** 생물 하나를 그리기 화면에서 쓰는 장면으로. 채점에서 빼는 영역은 없다 (밑그림에 안내 문구가 없음) */
const toScene = (c: CreatureGuide): Scene => ({
  id: `creature-${c.slug}`,
  drawingId: c.drawingId,
  title: c.name,
  line: "",
  guide: c.guide,
  width: c.width,
  height: c.height,
  scoreExclude: [],
  backgroundRegions: [],
  brushScale: Math.round((c.lineWidth / 4.3) * 10) / 10,
});

export const creatureScenes: Scene[] = CREATURE_GUIDES.map(toScene);

export const findCreatureScene = (slug: string) => creatureScenes.find((s) => s.id === `creature-${slug}`);

/** 밑그림 이미지 (도감 목록 카드) */
export const creatureGuide = (slug: string) => CREATURE_GUIDES.find((g) => g.slug === slug)?.guide ?? null;
