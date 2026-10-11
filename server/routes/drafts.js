// 그리던 그림 API (/api/drafts, 이어서 그리기): 사용자마다 그림 하나당 한 행(drawing_drafts).
// 그림 이름(키)은 앱 src/lib/drawingDraft.ts 가 만드는 규칙과 같아야 한다: 'story:<장면 id>' 또는 'character'
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

const DRAFT_KEY_RULE = /^(story:[a-z0-9-]{1,80}|character)$/;

function readDraftKey(req) {
  const key = String(req.params.key ?? "");
  if (!DRAFT_KEY_RULE.test(key)) throw new BadRequest("그림 이름이 올바르지 않아요.");
  return key;
}

export const draftRoutes = Router();

// 그리던 그림 목록 (장면 고르기 화면의 "이어 그리기" 표시)
draftRoutes.get("/", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT draft_key, saved_at, jsonb_array_length(strokes) AS stroke_count FROM drawing_drafts WHERE user_id = $1 ORDER BY saved_at DESC",
    [req.userId],
  );
  res.json({ drafts: rows.map((r) => ({ key: r.draft_key, savedAt: r.saved_at, strokeCount: r.stroke_count })) });
});

// 그림 하나 불러오기. 없으면 draft: null
draftRoutes.get("/:key", requireUser, async (req, res) => {
  const key = readDraftKey(req);
  const { rows } = await pool.query("SELECT strokes, name, saved_at FROM drawing_drafts WHERE user_id = $1 AND draft_key = $2", [
    req.userId,
    key,
  ]);
  res.json({ draft: rows.length ? { strokes: rows[0].strokes, name: rows[0].name, savedAt: rows[0].saved_at } : null });
});

// 저장하기: 처음이면 INSERT, 이미 있으면 UPDATE
draftRoutes.put("/:key", requireUser, async (req, res) => {
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
draftRoutes.delete("/:key", requireUser, async (req, res) => {
  const key = readDraftKey(req);
  await pool.query("DELETE FROM drawing_drafts WHERE user_id = $1 AND draft_key = $2", [req.userId, key]);
  res.json({ ok: true });
});
