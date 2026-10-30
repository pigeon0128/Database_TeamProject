// 3D 색칠하기로 칠할 수 있는 오브젝트 목록. three.js 없이 고르기 화면에서도 쓸 수 있게 따로 둔다.
export const MODELS = [
  { id: "monster", name: "꼬마 몬스터", emoji: "👾" },
  { id: "bear", name: "아기 곰", emoji: "🐻" },
  { id: "rabbit", name: "토끼", emoji: "🐰" },
  { id: "cat", name: "고양이", emoji: "🐱" },
  { id: "dino", name: "공룡", emoji: "🦕" },
  { id: "robot", name: "로봇", emoji: "🤖" },
  { id: "unicorn", name: "유니콘", emoji: "🦄" },
  { id: "car", name: "자동차", emoji: "🚗" },
  { id: "rocket", name: "로켓", emoji: "🚀" },
  { id: "plane", name: "비행기", emoji: "✈️" },
  { id: "train", name: "기차", emoji: "🚂" },
  { id: "house", name: "집", emoji: "🏠" },
  { id: "gift", name: "선물상자", emoji: "🎁" },
] as const;
export type ModelId = (typeof MODELS)[number]["id"];

export const findModel = (id: string) => MODELS.find((item) => item.id === id);
