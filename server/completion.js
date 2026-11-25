// 완성 기준: 일치율이 이 값(%) 이상인 기록만 "완성 작품"·"도감 수집 완료"로 친다.
// 쓰는 곳: routes/summary.js (메인 화면 내 그림 요약), routes/collection.js (도감 수집 현황)
export const COMPLETE_SCORE = 80;

/** 이 점수가 완성 기준을 넘는지 */
export const isComplete = (score) => score !== null && score !== undefined && Number(score) >= COMPLETE_SCORE;
