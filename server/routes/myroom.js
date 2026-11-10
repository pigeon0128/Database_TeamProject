import { Router } from "express"
import { requireUser } from "../auth.js"
import { pool } from "../db.js"
import { BadRequest } from "../errors.js"
import { validateLayout } from "../../shared/myroom.js"
import { artworkFileExists } from "../storage.js"
import {
  validateColoredSpec,
  validateSourceModel,
  validateStoredName,
  validateThumbnail,
} from "../../shared/colored.js"

const MAX_STORED_OBJECTS = 50

// /api/collection과 같은 대표 작품 규칙: 이미지가 저장된 내 완료 기록 중 점수↓ 시간↑ 완료시각↑ ID↑.
// creature_profiles는 분류에만 사용한다. 없는 장면은 기존 /api/drawings와 같이 story다.
async function roomArtworks(client, userId, ids = null) {
  const { rows } = await client.query(
    `WITH ranked_artworks AS (
       SELECT p.drawing_id, a.image_key,
              ROW_NUMBER() OVER (
                PARTITION BY p.drawing_id
                ORDER BY p.similarity_score DESC, p.duration_ms ASC, p.played_at ASC, p.record_id ASC
              ) AS rn
         FROM play_records p JOIN user_artworks a ON a.record_id = p.record_id
        WHERE p.user_id = $1 AND ($2::bigint[] IS NULL OR p.drawing_id = ANY($2::bigint[]))
     )
     SELECT d.drawing_id, d.title, c.slug, a.image_key,
            CASE WHEN c.drawing_id IS NULL THEN 'story' ELSE 'creature' END AS kind
       FROM ranked_artworks a JOIN drawings d ON d.drawing_id = a.drawing_id
       LEFT JOIN creature_profiles c ON c.drawing_id = d.drawing_id
      WHERE a.rn = 1 ORDER BY d.chapter_id, d.drawing_order, d.drawing_id`,
    [userId, ids],
  )
  const available = await Promise.all(
    rows.map((r) => artworkFileExists(r.image_key)),
  )
  return rows
    .filter((_, i) => available[i])
    .map((r) => ({
      drawingId: Number(r.drawing_id),
      name: r.title,
      kind: r.kind,
      slug: r.slug,
      imageKey: r.image_key,
    }))
}

const summary = (row) => ({
  id: Number(row.object_id),
  name: row.name,
  sourceModel: row.source_model,
  thumbnail: row.thumbnail,
  createdAt: row.created_at,
})

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

myroomRoutes.get("/artworks", async (req, res) => {
  res.json({ artworks: await roomArtworks(pool, req.userId) })
})

// 3D 색칠하기에서 '수납하기'로 보낸 오브젝트 (수납함)
myroomRoutes.get("/storage", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT object_id, name, source_model, thumbnail, created_at FROM user_stored_objects WHERE user_id = $1 ORDER BY object_id DESC",
    [req.userId],
  )
  res.json({ objects: rows.map(summary) })
})

myroomRoutes.get("/storage/:id", async (req, res) => {
  if (!/^[1-9][0-9]{0,15}$/.test(req.params.id))
    throw new BadRequest("수납함 번호가 올바르지 않아요.")
  const { rows } = await pool.query(
    "SELECT * FROM user_stored_objects WHERE object_id = $1 AND user_id = $2",
    [req.params.id, req.userId],
  )
  if (!rows.length)
    return res.status(404).json({ error: "수납함에서 오브젝트를 찾지 못했어요." })
  res.json({ ...summary(rows[0]), spec: rows[0].spec })
})

// 수납함에서 오브젝트를 지운다. 저장된 방에 놓여 있으면 지우지 않는다 (방에서 먼저 제거하고 저장해야 한다).
myroomRoutes.delete("/storage/:id", async (req, res) => {
  if (!/^[1-9][0-9]{0,15}$/.test(req.params.id))
    throw new BadRequest("수납함 번호가 올바르지 않아요.")
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    // 방 저장(PUT)과 같은 사용자 행을 잠가서, 지우는 동안 새로 배치되는 일을 막는다.
    await client.query("SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE", [
      req.userId,
    ])
    const { rows: placed } = await client.query(
      `SELECT 1 FROM user_myrooms
       WHERE user_id = $1 AND layout->'objects' @> jsonb_build_array(jsonb_build_object('storedObjectId', $2::bigint))`,
      [req.userId, req.params.id],
    )
    if (placed.length) {
      await client.query("ROLLBACK")
      return res.status(409).json({
        error: "저장된 방에 놓여 있어요. 방에서 제거하고 저장한 뒤 삭제해 주세요.",
      })
    }
    const { rowCount } = await client.query(
      "DELETE FROM user_stored_objects WHERE object_id = $1 AND user_id = $2",
      [req.params.id, req.userId],
    )
    await client.query("COMMIT")
    if (!rowCount)
      return res.status(404).json({ error: "수납함에서 오브젝트를 찾지 못했어요." })
    res.json({ ok: true })
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
})

myroomRoutes.post("/storage", async (req, res) => {
  let name, sourceModel, thumbnail, spec
  try {
    name = validateStoredName(req.body?.name)
    sourceModel = validateSourceModel(req.body?.sourceModel)
    thumbnail = validateThumbnail(req.body?.thumbnail)
    spec = validateColoredSpec(req.body?.spec)
  } catch (error) {
    throw new BadRequest(error.message)
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT 1 FROM users WHERE user_id = $1 FOR UPDATE", [
      req.userId,
    ])
    const { rows: count } = await client.query(
      "SELECT COUNT(*)::int AS n FROM user_stored_objects WHERE user_id = $1",
      [req.userId],
    )
    if (count[0].n >= MAX_STORED_OBJECTS) {
      await client.query("ROLLBACK")
      return res.status(409).json({
        error: `수납함은 최대 ${MAX_STORED_OBJECTS}개까지 보관할 수 있어요.`,
      })
    }
    const { rows } = await client.query(
      `INSERT INTO user_stored_objects (user_id, name, source_model, thumbnail, spec)
       VALUES ($1, $2, $3, $4, $5) RETURNING object_id, name, source_model, thumbnail, created_at`,
      [req.userId, name, sourceModel, thumbnail, JSON.stringify(spec)],
    )
    await client.query("COMMIT")
    res.status(201).json(summary(rows[0]))
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
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
  const storedIds = [
    ...new Set(
      layout.objects.flatMap((o) => (o.storedObjectId ? [o.storedObjectId] : [])),
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
      const artworks = await roomArtworks(client, req.userId, ids)
      if (artworks.length !== ids.length)
        throw new BadRequest(
          "이미지가 저장된 내 도감·스토리 완성 작품만 전시할 수 있어요.",
        )
    }
    if (storedIds.length) {
      const { rows } = await client.query(
        "SELECT object_id FROM user_stored_objects WHERE user_id = $1 AND object_id = ANY($2::bigint[])",
        [req.userId, storedIds],
      )
      if (rows.length !== storedIds.length)
        throw new BadRequest("내 수납함의 오브젝트만 배치할 수 있어요.")
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
