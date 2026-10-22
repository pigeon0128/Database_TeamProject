// 기록 API: 기록 저장(/api/play-records), 리더보드(/api/leaderboard).
// 표: play_records, user_artworks. 완성 그림은 서버 폴더에 파일로 두고 DB에는 경로(image_key)만 저장한다
// (migrations/001_initial.sql 의 원래 설계, 파일 저장은 ../storage.js). 브라우저는 /uploads/<image_key> 로 그림을 받는다.
import { Router } from "express";
import { requireUser, sessionUserId } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";
import { artworkKey, removeFile, saveFile } from "../storage.js";

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

// 기록을 저장하고, 완성 그림은 사용자·그림마다 최고 기록 1개에만 남긴다 (리더보드·도감이 보여 주는 그림이 그것뿐이라서).
// 새 기록이 최고 기록이 되면 그림 파일을 저장하고 이전 최고 기록의 그림(행과 파일)을 지운다. 아니면 기록만 저장한다.
// "최고"는 리더보드 규칙과 같다: 일치율↓, 걸린 시간↑, 완료 시각↑, 기록 ID↑ (database/queries/leaderboard.sql)
//
// 파일과 DB는 한 트랜잭션으로 묶을 수 없어서 순서로 맞춘다:
//   새 파일 쓰기 → DB 커밋 → 이전 파일 지우기. DB가 실패하면 새 파일을 지우고, 이전 파일은 커밋한 뒤에만 지운다.
recordRoutes.post("/play-records", requireUser, async (req, res) => {
  const drawingId = Number(req.body?.drawingId);
  const score = Number(req.body?.similarityScore);
  const durationMs = Number(req.body?.durationMs);
  if (!Number.isInteger(drawingId) || drawingId <= 0) throw new BadRequest("그림 정보가 올바르지 않아요.");
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new BadRequest("점수는 0~100 사이여야 해요.");
  if (!Number.isInteger(durationMs) || durationMs < 0) throw new BadRequest("걸린 시간이 올바르지 않아요.");
  const artwork = readArtwork(req.body?.image);

  const client = await pool.connect();
  let newKey = null;
  let oldKeys = [];
  try {
    await client.query("BEGIN");
    // 같은 사용자가 동시에 두 기록을 올려도 최고 기록 판단이 꼬이지 않게 사용자 행을 잠근다
    await client.query("SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE", [req.userId]);
    const { rows } = await client.query(
      `INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms)
       VALUES ($1, $2, ROUND($3::numeric, 2), $4)
       RETURNING record_id, played_at`,
      [req.userId, drawingId, score, durationMs],
    );
    const recordId = rows[0].record_id;
    const best = await client.query(
      `SELECT record_id FROM play_records
        WHERE user_id = $1 AND drawing_id = $2
        ORDER BY similarity_score DESC, duration_ms ASC, played_at ASC, record_id ASC
        LIMIT 1`,
      [req.userId, drawingId],
    );
    const isBest = String(best.rows[0].record_id) === String(recordId);
    if (artwork && isBest) {
      const removed = await client.query(
        `DELETE FROM user_artworks a USING play_records p
          WHERE a.record_id = p.record_id AND p.user_id = $1 AND p.drawing_id = $2 AND p.record_id <> $3
          RETURNING a.image_key`,
        [req.userId, drawingId, recordId],
      );
      oldKeys = removed.rows.map((r) => r.image_key);
      newKey = artworkKey(req.userId, recordId);
      await saveFile(newKey, artwork);
      await client.query("INSERT INTO user_artworks (record_id, image_key) VALUES ($1, $2)", [recordId, newKey]);
    }
    await client.query("COMMIT");
    await Promise.all(oldKeys.map(removeFile));
    res.status(201).json({ recordId: Number(recordId), playedAt: rows[0].played_at, isBest, imageKey: newKey });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (newKey) await removeFile(newKey);
    throw err;
  } finally {
    client.release();
  }
});

// database/queries/leaderboard.sql 과 같은 규칙(사용자별 최고 기록 1건, 일치율↓ 시간↑ 완료시각↑ 기록ID↑)에
// 그림 ID·개수를 매개변수로 받고, 상위 N명 밖에 있는 내 순위도 함께 돌려준다. 기록의 그림 경로(image_key)도 함께 준다.
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
               a.image_key
          FROM best_attempts b
          JOIN users u ON u.user_id = b.user_id
          LEFT JOIN user_artworks a ON a.record_id = b.record_id
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
    imageKey: r.image_key,
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
