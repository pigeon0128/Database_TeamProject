// 오류 처리: 400 오류용 예외, 없는 API 주소, 그리고 모든 오류를 사용자에게 보여 줄 한국어 메시지로 바꾸는 처리기.

/** 400 오류를 낼 때 쓰는 예외 (요청 값이 잘못됐을 때) */
export class BadRequest extends Error {
  status = 400;
}

/** /api 아래 없는 주소 */
export const notFound = (_req, res) => res.status(404).json({ error: "없는 API 주소예요." });

/** 마이그레이션을 다 실행하지 않은 DB: 42P01 표 없음, 42703 칸 없음 */
const MISSING_SCHEMA = ["42P01", "42703"];
/** DB에 연결하지 못함 */
const DB_UNREACHABLE = ["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"];

export function errorHandler(err, _req, res, _next) {
  // 요청 본문이 너무 큼 (express.json 의 limit)
  if (err.type === "entity.too.large") return res.status(413).json({ error: "그림이 너무 커서 저장하지 못했어요." });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  // 외래키 위반: 없는 그림/사용자를 가리킬 때
  if (err.code === "23503") return res.status(400).json({ error: "존재하지 않는 그림이거나 사용자예요." });
  if (MISSING_SCHEMA.includes(err.code)) {
    console.error("[db] 표나 칸 없음:", err.message);
    return res.status(503).json({ error: "데이터베이스 테이블이 없어요. pnpm db:migrate 를 실행해 주세요." });
  }
  if (DB_UNREACHABLE.includes(err.code)) {
    console.error("[db] 연결 실패:", err.message);
    return res.status(503).json({ error: "데이터베이스에 연결할 수 없어요. 서버 설정(.env)을 확인해 주세요." });
  }
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했어요." });
}
