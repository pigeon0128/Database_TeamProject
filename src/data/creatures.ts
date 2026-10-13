// 도감 생물 목록 (동물 5, 식물 5, 무생물 5). 밑그림은 assets/creatures 의 SVG 로,
// 스토리 장면과 같은 형식(회색 바탕 + 따라 그릴 흰 선, 1200×900)이라 같은 채점 엔진을 쓸 수 있다.
// 도감 정보(분류·서식지 등)는 다음 단계에서 DB에 넣고 API로 불러올 예정이다.
import dandelion from "../assets/creatures/dandelion.svg";
import ladybug from "../assets/creatures/ladybug.svg";
import maple from "../assets/creatures/maple.svg";
import moon from "../assets/creatures/moon.svg";
import pine from "../assets/creatures/pine.svg";
import quartz from "../assets/creatures/quartz.svg";
import rainbow from "../assets/creatures/rainbow.svg";
import snail from "../assets/creatures/snail.svg";
import snowflake from "../assets/creatures/snowflake.svg";
import squirrel from "../assets/creatures/squirrel.svg";
import sunflower from "../assets/creatures/sunflower.svg";
import swallowtail from "../assets/creatures/swallowtail.svg";
import treefrog from "../assets/creatures/treefrog.svg";
import tulip from "../assets/creatures/tulip.svg";
import volcano from "../assets/creatures/volcano.svg";

export type CreatureCategory = "animal" | "plant" | "object";

export const CATEGORY_LABELS: Record<CreatureCategory, string> = { animal: "동물", plant: "식물", object: "무생물" };

export type Creature = {
  /** 주소에 쓰일 이름 */
  id: string;
  name: string;
  category: CreatureCategory;
  /** 밑그림 (SVG) */
  guide: string;
};

/** 밑그림 크기 (모든 생물 같음) */
export const CREATURE_GUIDE_SIZE = { width: 1200, height: 900 };

export const creatures: Creature[] = [
  { id: "swallowtail", name: "호랑나비", category: "animal", guide: swallowtail },
  { id: "ladybug", name: "칠성무당벌레", category: "animal", guide: ladybug },
  { id: "treefrog", name: "청개구리", category: "animal", guide: treefrog },
  { id: "squirrel", name: "다람쥐", category: "animal", guide: squirrel },
  { id: "snail", name: "달팽이", category: "animal", guide: snail },
  { id: "sunflower", name: "해바라기", category: "plant", guide: sunflower },
  { id: "dandelion", name: "민들레", category: "plant", guide: dandelion },
  { id: "tulip", name: "튤립", category: "plant", guide: tulip },
  { id: "pine", name: "소나무", category: "plant", guide: pine },
  { id: "maple", name: "단풍나무", category: "plant", guide: maple },
  { id: "snowflake", name: "눈 결정", category: "object", guide: snowflake },
  { id: "quartz", name: "수정", category: "object", guide: quartz },
  { id: "volcano", name: "화산", category: "object", guide: volcano },
  { id: "rainbow", name: "무지개", category: "object", guide: rainbow },
  { id: "moon", name: "초승달", category: "object", guide: moon },
];
