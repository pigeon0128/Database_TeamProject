// 도감 API (/api/collection): 생물 도감 목록과 내 수집 현황.
// database/queries/collection.sql 의 3번 쿼리와 같다 (대표 작품 규칙은 리더보드와 같다: 일치율↓ 시간↑ 완료시각↑ 기록ID↑).
// 표: creature_profiles·creature_facts·creature_tips (migrations/007), creature_sources (migrations/011), drawings, play_records, user_artworks
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";

export const collectionRoutes = Router();

collectionRoutes.get("/", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    `WITH ranked_artworks AS (
        SELECT pr.drawing_id, pr.record_id, pr.similarity_score, pr.duration_ms, ua.image_key,
               ROW_NUMBER() OVER (
                   PARTITION BY pr.drawing_id
                   ORDER BY pr.similarity_score DESC, pr.duration_ms ASC, pr.played_at ASC, pr.record_id ASC
               ) AS rn
          FROM play_records pr
          JOIN user_artworks ua ON pr.record_id = ua.record_id
         WHERE pr.user_id = $1
     )
     SELECT d.drawing_id, d.title, p.slug, p.category, p.summary,
            (ra.record_id IS NOT NULL) AS is_collected,
            ra.record_id AS representative_record_id,
            ra.image_key AS representative_image_key,
            ra.similarity_score AS best_score,
            ra.duration_ms AS best_duration_ms,
            COALESCE((SELECT json_agg(json_build_object('label', f.label, 'content', f.content) ORDER BY f.fact_order)
                        FROM creature_facts f WHERE f.drawing_id = d.drawing_id), '[]'::json) AS facts,
            COALESCE((SELECT json_agg(t.content ORDER BY t.tip_order)
                        FROM creature_tips t WHERE t.drawing_id = d.drawing_id), '[]'::json) AS tips,
            COALESCE((SELECT json_agg(json_build_object('citation', s.citation, 'url', s.url) ORDER BY s.source_order)
                        FROM creature_sources s WHERE s.drawing_id = d.drawing_id), '[]'::json) AS sources
       FROM creature_profiles p
       JOIN drawings d ON d.drawing_id = p.drawing_id
       JOIN chapters c ON d.chapter_id = c.chapter_id
       LEFT JOIN ranked_artworks ra ON d.drawing_id = ra.drawing_id AND ra.rn = 1
      ORDER BY c.chapter_order, d.drawing_order`,
    [req.userId],
  );
  res.json({
    creatures: rows.map((r) => ({
      drawingId: Number(r.drawing_id),
      name: r.title,
      slug: r.slug,
      category: r.category,
      summary: r.summary,
      facts: r.facts,
      tips: r.tips,
      sources: r.sources,
      collected: r.is_collected,
      recordId: r.representative_record_id === null ? null : Number(r.representative_record_id),
      imageKey: r.representative_image_key,
      bestScore: r.best_score === null ? null : Number(r.best_score),
      bestDurationMs: r.best_duration_ms,
    })),
  });
});
