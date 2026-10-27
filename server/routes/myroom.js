import { Router } from "express"
import { requireUser } from "../auth.js"
import { pool } from "../db.js"
import { BadRequest } from "../errors.js"
import { validateLayout } from "../../shared/myroom.js"

const state = (row) =>
  row
    ? {
        schemaVersion: row.schema_version,
        revision: row.revision,
        layout: row.layout,
        updatedAt: row.updated_at,
      }
    : {
        schemaVersion: 1,
        revision: 0,
        layout: { objects: [] },
        updatedAt: null,
      }

export const myroomRoutes = Router()
myroomRoutes.use(requireUser)
myroomRoutes.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM user_myrooms WHERE user_id = $1",
    [req.userId],
  )
  res.json(state(rows[0]))
})

myroomRoutes.put("/", async (req, res) => {
  const expected = req.body?.expectedRevision
  if (
    !Number.isSafeInteger(expected) ||
    expected < 0 ||
    expected >= 2147483647 ||
    req.body?.schemaVersion !== 1
  )
    throw new BadRequest("방 버전이 올바르지 않아요.")
  let layout
  try {
    layout = validateLayout(req.body?.layout)
  } catch (error) {
    throw new BadRequest(error.message)
  }
  const ids = [
    ...new Set(
      layout.objects.flatMap((o) =>
        o.artworkDrawingId ? [o.artworkDrawingId] : [],
      ),
    ),
  ]
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    // The records writer locks the same user row. Ownership cannot race a record replacement.
    await client.query("SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE", [
      req.userId,
    ])
    if (ids.length) {
      const { rows } = await client.query(
        `SELECT DISTINCT p.drawing_id FROM play_records p
         JOIN user_artworks a ON a.record_id = p.record_id
         JOIN creature_profiles c ON c.drawing_id = p.drawing_id
         WHERE p.user_id = $1 AND p.drawing_id = ANY($2::bigint[])`,
        [req.userId, ids],
      )
      if (rows.length !== ids.length)
        throw new BadRequest("내 도감에서 완성한 작품만 전시할 수 있어요.")
    }
    await client.query(
      "INSERT INTO user_myrooms (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
      [req.userId],
    )
    const { rows } = await client.query(
      `UPDATE user_myrooms SET layout = $2, revision = revision + 1, updated_at = NOW()
       WHERE user_id = $1 AND revision = $3 RETURNING *`,
      [req.userId, JSON.stringify(layout), expected],
    )
    if (!rows.length) {
      await client.query("ROLLBACK")
      return res.status(409).json({
        error:
          "다른 화면에서 방이 변경됐어요. 내 배치를 보관한 채 저장된 방을 확인해 주세요.",
      })
    }
    await client.query("COMMIT")
    res.json(state(rows[0]))
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
})
