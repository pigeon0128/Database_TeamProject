// DOROLAND 그림 그리기 API 서버
// 실행: pnpm dev:server  (기본 포트 3001, 개발 중에는 Vite가 /api 요청을 이 서버로 넘긴다)
import express from "express";
import { pool } from "./db.js";
import { clearSessionCookie, hashPassword, requireUser, sessionUserId, setSessionCookie, verifyPassword } from "./auth.js";

const app = express();
// 요청 본문(JSON) 크기 제한. 그림이 들어가는 요청(그리던 그림, 완성 그림이 붙은 기록)만 크게 받는다.
const smallJson = express.json({ limit: "100kb" });
const largeJson = express.json({ limit: "5mb" });
const carriesImage = (path) => path.startsWith("/api/drafts/") || path === "/api/play-records";
app.use((req, res, next) => (carriesImage(req.path) ? largeJson : smallJson)(req, res, next));

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
/** 완성 그림 최대 크기 (PNG, 바이트) */
const MAX_ARTWORK_BYTES = 3 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** "data:image/png;base64,..." 를 PNG 바이트로. 없으면 null */
function readArtwork(value) {
  if (value == null) return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(value));
  if (!match) throw new BadRequest("그림 형식이 올바르지 않아요.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_ARTWORK_BYTES) throw new BadRequest("그림이 너무 커서 저장하지 못했어요.");
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new BadRequest("그림 형식이 올바르지 않아요.");
  return bytes;
}

// 기록과 완성 그림(선택)을 한 트랜잭션으로 저장한다: 둘 다 들어가거나 둘 다 안 들어간다.
app.post("/api/play-records", requireUser, async (req, res) => {
  const drawingId = Number(req.body?.drawingId);
  const score = Number(req.body?.similarityScore);
  const durationMs = Number(req.body?.durationMs);
  if (!Number.isInteger(drawingId) || drawingId <= 0) throw new BadRequest("그림 정보가 올바르지 않아요.");
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new BadRequest("점수는 0~100 사이여야 해요.");
  if (!Number.isInteger(durationMs) || durationMs < 0) throw new BadRequest("걸린 시간이 올바르지 않아요.");
  const artwork = readArtwork(req.body?.image);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms)
       VALUES ($1, $2, ROUND($3::numeric, 2), $4)
       RETURNING record_id, played_at`,
      [req.userId, drawingId, score, durationMs],
    );
    if (artwork) {
      await client.query("INSERT INTO user_artworks (record_id, image_data, content_type) VALUES ($1, $2, 'image/png')", [
        rows[0].record_id,
        artwork,
      ]);
    }
    await client.query("COMMIT");
    res.status(201).json({ recordId: Number(rows[0].record_id), playedAt: rows[0].played_at, hasArtwork: !!artwork });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
});

// ── 완성 그림 ─────────────────────────────────────────────
// 기록 하나의 그림 (리더보드에서 보기). 한 번 저장된 그림은 바뀌지 않으므로 브라우저가 오래 보관해도 된다.
app.get("/api/artworks/:recordId", requireUser, async (req, res) => {
  const recordId = Number(req.params.recordId);
  if (!Number.isInteger(recordId) || recordId <= 0) throw new BadRequest("기록 정보가 올바르지 않아요.");
  const { rows } = await pool.query("SELECT image_data, content_type FROM user_artworks WHERE record_id = $1 AND image_data IS NOT NULL", [
    recordId,
  ]);
  if (!rows.length) return res.status(404).json({ error: "저장된 그림이 없어요." });
  res.set("Content-Type", rows[0].content_type);
  res.set("Cache-Control", "private, max-age=31536000, immutable");
  res.send(rows[0].image_data);
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

// ── 그리던 그림 (이어서 그리기) ───────────────────────────
// 사용자마다 그림 하나당 한 행(drawing_drafts). 그림 이름: 'story:<장면 id>' 또는 'character'
const DRAFT_KEY_RULE = /^(story:[a-z0-9-]{1,80}|character)$/;

function readDraftKey(req) {
  const key = String(req.params.key ?? "");
  if (!DRAFT_KEY_RULE.test(key)) throw new BadRequest("그림 이름이 올바르지 않아요.");
  return key;
}

// 그리던 그림 목록 (장면 고르기 화면의 "이어 그리기" 표시)
app.get("/api/drafts", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT draft_key, saved_at, jsonb_array_length(strokes) AS stroke_count FROM drawing_drafts WHERE user_id = $1 ORDER BY saved_at DESC",
    [req.userId],
  );
  res.json({ drafts: rows.map((r) => ({ key: r.draft_key, savedAt: r.saved_at, strokeCount: r.stroke_count })) });
});

// 그림 하나 불러오기. 없으면 draft: null
app.get("/api/drafts/:key", requireUser, async (req, res) => {
  const key = readDraftKey(req);
  const { rows } = await pool.query("SELECT strokes, name, saved_at FROM drawing_drafts WHERE user_id = $1 AND draft_key = $2", [
    req.userId,
    key,
  ]);
  res.json({ draft: rows.length ? { strokes: rows[0].strokes, name: rows[0].name, savedAt: rows[0].saved_at } : null });
});

// 저장하기: 처음이면 INSERT, 이미 있으면 UPDATE
app.put("/api/drafts/:key", requireUser, async (req, res) => {
  const key = readDraftKey(req);
  const strokes = req.body?.strokes;
  if (!Array.isArray(strokes) || !strokes.every((s) => s && typeof s === "object" && Array.isArray(s.points))) {
    throw new BadRequest("그림 데이터가 올바르지 않아요.");
  }
  const name = req.body?.name == null ? null : String(req.body.name).slice(0, 20);
  const { rows } = await pool.query(
    `INSERT INTO drawing_drafts (user_id, draft_key, strokes, name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, draft_key) DO UPDATE
     SET strokes = EXCLUDED.strokes, name = EXCLUDED.name, saved_at = NOW()
     RETURNING saved_at`,
    [req.userId, key, JSON.stringify(strokes), name],
  );
  res.json({ savedAt: rows[0].saved_at });
});

// 다 그렸거나(기록 저장) 새로 그리기를 고르면 지운다
app.delete("/api/drafts/:key", requireUser, async (req, res) => {
  const key = readDraftKey(req);
  await pool.query("DELETE FROM drawing_drafts WHERE user_id = $1 AND draft_key = $2", [req.userId, key]);
  res.json({ ok: true });
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
               b.record_id, b.user_id, u.nickname, b.similarity_score, b.duration_ms, b.played_at,
               EXISTS (
                   SELECT 1 FROM user_artworks a WHERE a.record_id = b.record_id AND a.image_data IS NOT NULL
               ) AS has_artwork
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
    recordId: Number(r.record_id),
    hasArtwork: r.has_artwork,
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
  // 요청 본문이 너무 큼 (express.json 의 limit)
  if (err.type === "entity.too.large") return res.status(413).json({ error: "그림이 너무 커서 저장하지 못했어요." });
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
