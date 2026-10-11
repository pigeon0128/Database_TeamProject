// 기록 API: 기록 저장(/api/play-records), 완성 그림 보기(/api/artworks/:recordId), 리더보드(/api/leaderboard).
// 표: play_records, user_artworks (그림은 image_data 에 PNG로 저장, migrations/005_artwork_images.sql)
import { Router } from "express";
import { requireUser, sessionUserId } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

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

export const recordRoutes = Router();

// 기록과 완성 그림(선택)을 한 트랜잭션으로 저장한다: 둘 다 들어가거나 둘 다 안 들어간다.
recordRoutes.post("/play-records", requireUser, async (req, res) => {
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

// 기록 하나의 그림 (리더보드에서 보기). 한 번 저장된 그림은 바뀌지 않으므로 브라우저가 오래 보관해도 된다.
recordRoutes.get("/artworks/:recordId", requireUser, async (req, res) => {
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

// database/queries/leaderboard.sql 과 같은 규칙(사용자별 최고 기록 1건, 일치율↓ 시간↑ 완료시각↑ 기록ID↑)에
// 그림 ID·개수를 매개변수로 받고, 상위 N명 밖에 있는 내 순위도 함께 돌려준다.
recordRoutes.get("/leaderboard", async (req, res) => {
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
