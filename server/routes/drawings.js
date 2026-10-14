// 장면 목록 API (/api/drawings): 챕터와 원본 그림(drawings). 리더보드의 장면 고르기에 쓴다.
import { Router } from "express";
import { pool } from "../db.js";

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
