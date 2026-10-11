/** 1234567 → "20:34" (타이머용) */
export function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** 83400 → "1분 23.4초" (기록용) */
export function formatDuration(ms: number) {
  const sec = ms / 1000;
  const min = Math.floor(sec / 60);
  const rest = (sec - min * 60).toFixed(1);
  return min ? `${min}분 ${rest}초` : `${rest}초`;
}

/** ISO 시각 → "10. 9. 오후 11:58" */
export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** 96.5 → "96.50" */
export const formatScore = (score: number) => score.toFixed(2);
