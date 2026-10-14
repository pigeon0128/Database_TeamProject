// 장면 목록 API (/api/drawings): 챕터와 원본 그림(drawings). 리더보드의 장면 고르기에 쓴다.
// 밑그림 이미지(/api/drawings/:id/image)도 DB(drawings.reference_image, migrations/008)에서 꺼내 준다.
import { Router } from "express";
import { pool } from "../db.js";
import { BadRequest } from "../errors.js";

export const drawingRoutes = Router();

drawingRoutes.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT d.drawing_id, d.title, d.reference_image_key, d.drawing_order,
            c.chapter_id, c.title AS chapter_title, c.chapter_order,
            p.category
       FROM drawings d
       JOIN chapters c ON c.chapter_id = d.chapter_id
       LEFT JOIN creature_profiles p ON p.drawing_id = d.drawing_id
      ORDER BY c.chapter_order, d.drawing_order`,
  );
  res.json({
    drawings: rows.map((r) => ({
      id: Number(r.drawing_id),
      title: r.title,
      referenceImageKey: r.reference_image_key,
      order: r.drawing_order,
      chapter: { id: Number(r.chapter_id), title: r.chapter_title, order: r.chapter_order },
      // 도감 생물이면 동물·식물·무생물, 스토리 장면이면 null
      category: r.category,
    })),
  });
});

// 밑그림 이미지. 바뀔 수 있으므로(pnpm db:migrate 로 다시 넣음) 매번 확인하되, 같으면 304로 다시 받지 않는다 (Express 의 ETag).
drawingRoutes.get("/:id/image", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest("그림 정보가 올바르지 않아요.");
  const { rows } = await pool.query(
    "SELECT reference_image, reference_content_type FROM drawings WHERE drawing_id = $1 AND reference_image IS NOT NULL",
    [id],
  );
  if (!rows.length) return res.status(404).json({ error: "밑그림이 없어요. pnpm db:migrate 를 실행해 주세요." });
  res.set("Content-Type", rows[0].reference_content_type);
  res.set("Cache-Control", "no-cache");
  res.send(rows[0].reference_image);
});
