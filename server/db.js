import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL 이 설정되지 않았습니다. .env.example 을 참고해 .env 파일을 만드세요.");
}

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // 동시에 여는 DB 연결 수 (기본 10)
  max: Number(process.env.DB_POOL_MAX) || 10,
});

// 연결이 끊긴 유휴 클라이언트 오류로 서버가 죽지 않게 한다.
pool.on("error", (err) => console.error("[db] 유휴 연결 오류:", err.message));
