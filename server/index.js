// DOROLAND 그림 그리기 API 서버
// 실행: pnpm dev:server  (기본 포트 3001, 개발 중에는 Vite가 /api 요청을 이 서버로 넘긴다)
import express from "express";
import { pool } from "./db.js";
import { clearSessionCookie, hashPassword, requireUser, sessionUserId, setSessionCookie, verifyPassword } from "./auth.js";

const app = express();
app.use(express.json({ limit: "100kb" }));

/** 400 오류를 낼 때 쓰는 예외 */
class BadRequest extends Error {
  status = 400;
}

const LOGIN_ID_RULE = /^[\p{L}\p{N}_-]{2,20}$/u;
const MIN_PASSWORD = 4;
const MAX_PASSWORD = 72;

function readCredentials(body) {
  const loginId = String(body?.loginId ?? "").trim();
  const password = String(body?.password ?? "");
  if (!LOGIN_ID_RULE.test(loginId)) throw new BadRequest("아이디는 2~20자의 한글·영문·숫자·_·- 만 쓸 수 있어요.");
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD)
    throw new BadRequest(`비밀번호는 ${MIN_PASSWORD}~${MAX_PASSWORD}자로 입력해 주세요.`);
  return { loginId, password };
}

const toUser = (row) => ({ id: Number(row.user_id), loginId: row.nickname });

// ── 상태 확인 ──────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});

// ── 로그인 ────────────────────────────────────────────────
// 아이디는 users.nickname 을 그대로 쓴다.
app.post("/api/auth/register", async (req, res) => {
  const { loginId, password } = readCredentials(req.body);
  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO users (nickname, password_hash) VALUES ($1, $2)
     ON CONFLICT (nickname) DO NOTHING
     RETURNING user_id, nickname`,
    [loginId, passwordHash],
  );
  if (!rows.length) return res.status(409).json({ error: "이미 사용 중인 아이디예요." });
  setSessionCookie(res, rows[0].user_id);
  res.status(201).json({ user: toUser(rows[0]) });
});

app.post("/api/auth/login", async (req, res) => {
  const { loginId, password } = readCredentials(req.body);
  const { rows } = await pool.query("SELECT user_id, nickname, password_hash FROM users WHERE nickname = $1", [loginId]);
  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return res.status(401).json({ error: "아이디 또는 비밀번호가 맞지 않아요." });
  }
  setSessionCookie(res, row.user_id);
  res.json({ user: toUser(row) });
});

app.post("/api/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const uid = sessionUserId(req);
  if (!uid) return res.json({ user: null });
  const { rows } = await pool.query("SELECT user_id, nickname FROM users WHERE user_id = $1", [uid]);
  if (!rows.length) {
    clearSessionCookie(res);
    return res.json({ user: null });
  }
  res.json({ user: toUser(rows[0]) });
});

// ── 그림 목록 ─────────────────────────────────────────────
app.get("/api/drawings", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT d.drawing_id, d.title, d.reference_image_key, d.drawing_order,
            c.chapter_id, c.title AS chapter_title, c.chapter_order
       FROM drawings d
       JOIN chapters c ON c.chapter_id = d.chapter_id
      ORDER BY c.chapter_order, d.drawing_order`,
  );
  res.json({
    drawings: rows.map((r) => ({
      id: Number(r.drawing_id),
      title: r.title,
      referenceImageKey: r.reference_image_key,
      order: r.drawing_order,
      chapter: { id: Number(r.chapter_id), title: r.chapter_title, order: r.chapter_order },
    })),
  });
});

// ── 플레이 기록 저장 ──────────────────────────────────────
app.post("/api/play-records", requireUser, async (req, res) => {
  const drawingId = Number(req.body?.drawingId);
  const score = Number(req.body?.similarityScore);
  const durationMs = Number(req.body?.durationMs);
  if (!Number.isInteger(drawingId) || drawingId <= 0) throw new BadRequest("그림 정보가 올바르지 않아요.");
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new BadRequest("점수는 0~100 사이여야 해요.");
  if (!Number.isInteger(durationMs) || durationMs < 0) throw new BadRequest("걸린 시간이 올바르지 않아요.");

  const { rows } = await pool.query(
    `INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms)
     VALUES ($1, $2, ROUND($3::numeric, 2), $4)
     RETURNING record_id, played_at`,
    [req.userId, drawingId, score, durationMs],
  );
  res.status(201).json({ recordId: Number(rows[0].record_id), playedAt: rows[0].played_at });
});

// ── 그리기 설정 ───────────────────────────────────────────
// 사용자당 한 행(user_settings). 범위는 database/migrations/003_user_settings.sql 의 CHECK 제약과 같다.
function readSettings(body) {
  const int = (value, min, max, name) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < min || n > max) throw new BadRequest(`${name} 값은 ${min}~${max} 사이여야 해요.`);
    return n;
  };
  if (typeof body?.guideVisible !== "boolean") throw new BadRequest("밑그림 보이기 값이 올바르지 않아요.");
  return {
    brushSize: int(body.brushSize, 2, 48, "굵기"),
    guideVisible: body.guideVisible,
    guideOpacity: int(body.guideOpacity, 10, 100, "밑그림 진하기"),
    smoothing: int(body.smoothing, 0, 100, "손떨림 보정"),
    fade: int(body.fade, 0, 100, "선 끝 얇게"),
  };
}

const toSettings = (r) => ({
  brushSize: r.brush_size,
  guideVisible: r.guide_visible,
  guideOpacity: r.guide_opacity,
  smoothing: r.smoothing,
  fade: r.fade,
  updatedAt: r.updated_at,
});

// 저장된 설정이 없으면 settings: null (앱이 기본값이나 브라우저에 있던 값을 쓴다)
app.get("/api/settings", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT brush_size, guide_visible, guide_opacity, smoothing, fade, updated_at FROM user_settings WHERE user_id = $1",
    [req.userId],
  );
  res.json({ settings: rows.length ? toSettings(rows[0]) : null });
});

// 처음이면 INSERT, 이미 있으면 UPDATE (database/queries/user_settings.sql 의 UPSERT와 같다)
app.put("/api/settings", requireUser, async (req, res) => {
  const s = readSettings(req.body);
  const { rows } = await pool.query(
    `INSERT INTO user_settings (user_id, brush_size, guide_visible, guide_opacity, smoothing, fade)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
     SET brush_size = EXCLUDED.brush_size,
         guide_visible = EXCLUDED.guide_visible,
         guide_opacity = EXCLUDED.guide_opacity,
         smoothing = EXCLUDED.smoothing,
         fade = EXCLUDED.fade,
         updated_at = NOW()
     RETURNING brush_size, guide_visible, guide_opacity, smoothing, fade, updated_at`,
    [req.userId, s.brushSize, s.guideVisible, s.guideOpacity, s.smoothing, s.fade],
  );
  res.json({ settings: toSettings(rows[0]) });
});

// ── 리더보드 ──────────────────────────────────────────────
// database/queries/leaderboard.sql 과 같은 규칙(사용자별 최고 기록 1건, 일치율↓ 시간↑ 완료시각↑ 기록ID↑)에
// 그림 ID·개수를 매개변수로 받고, 상위 N명 밖에 있는 내 순위도 함께 돌려준다.
app.get("/api/leaderboard", async (req, res) => {
  const drawingId = Number(req.query.drawingId);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  if (!Number.isInteger(drawingId) || drawingId <= 0) throw new BadRequest("그림 정보가 올바르지 않아요.");
  const me = sessionUserId(req);

  const { rows } = await pool.query(
    `WITH best_attempts AS (
        SELECT p.record_id, p.user_id, p.similarity_score, p.duration_ms, p.played_at,
               ROW_NUMBER() OVER (
                   PARTITION BY p.user_id
                   ORDER BY p.similarity_score DESC, p.duration_ms ASC, p.played_at ASC, p.record_id ASC
               ) AS attempt_rank
          FROM play_records p
         WHERE p.drawing_id = $1
     ), ranked AS (
        SELECT ROW_NUMBER() OVER (
                   ORDER BY b.similarity_score DESC, b.duration_ms ASC, b.played_at ASC, b.record_id ASC
               ) AS ranking,
               b.user_id, u.nickname, b.similarity_score, b.duration_ms, b.played_at
          FROM best_attempts b
          JOIN users u ON u.user_id = b.user_id
         WHERE b.attempt_rank = 1
     )
     SELECT * FROM ranked
      WHERE ranking <= $2 OR user_id = $3
      ORDER BY ranking`,
    [drawingId, limit, me],
  );

  const entries = rows.map((r) => ({
    ranking: Number(r.ranking),
    userId: Number(r.user_id),
    nickname: r.nickname,
    score: Number(r.similarity_score),
    durationMs: r.duration_ms,
    playedAt: r.played_at,
  }));
  res.json({
    top: entries.filter((e) => e.ranking <= limit),
    me: entries.find((e) => me !== null && String(e.userId) === me) ?? null,
  });
});

// ── 오류 처리 ─────────────────────────────────────────────
app.use("/api", (_req, res) => res.status(404).json({ error: "없는 API 주소예요." }));

app.use((err, _req, res, _next) => {
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  // 외래키 위반: 없는 그림/사용자를 가리킬 때
  if (err.code === "23503") return res.status(400).json({ error: "존재하지 않는 그림이거나 사용자예요." });
  // 테이블이 없을 때: 마이그레이션을 다 실행하지 않은 DB
  if (err.code === "42P01") {
    console.error("[db] 테이블 없음:", err.message);
    return res.status(503).json({ error: "데이터베이스 테이블이 없어요. database/migrations 의 SQL을 순서대로 실행했는지 확인해 주세요." });
  }
  // 데이터베이스에 연결할 수 없을 때
  if (["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "28P01", "3D000"].includes(err.code)) {
    console.error("[db] 연결 실패:", err.message);
    return res.status(503).json({ error: "데이터베이스에 연결할 수 없어요. 서버 설정(.env)을 확인해 주세요." });
  }
  console.error(err);
  res.status(500).json({ error: "서버 오류가 발생했어요." });
});

const port = Number(process.env.API_PORT) || 3001;
app.listen(port, () => console.log(`[api] http://localhost:${port} 에서 실행 중`));
