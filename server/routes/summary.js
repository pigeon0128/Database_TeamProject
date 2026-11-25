// 내 그림 요약 API (/api/summary): 메인(AI 화실) 화면의 "내 그림 요약"·셀·모드별 완성 기록에 쓰는 숫자를 한 번에 돌려준다.
// 읽기만 하는 조회다 (표·칸은 바꾸지 않는다).
// 완성 작품: 완성 그림(user_artworks)이 저장된 기록 중 일치율이 COMPLETE_SCORE(80%) 이상인 그림(drawing) 수.
// 그림은 그림마다 최고 기록 1개에만 남으므로(routes/records.js), 그림 하나는 많아야 1개로 센다.
// 수집 도감: 그중 도감 생물 수. 도감 화면(/api/collection)의 "수집 완료"와 같은 기준이다 (../completion.js).
// 표: users.cells, play_records, user_artworks, creature_profiles(도감 생물인지), user_stored_objects(3D 색칠 수납함)
import { Router } from "express";
import { requireUser } from "../auth.js";
import { pool } from "../db.js";
import { COMPLETE_SCORE } from "../completion.js";

export const summaryRoutes = Router();

summaryRoutes.get("/", requireUser, async (req, res) => {
  const { rows } = await pool.query(
    `WITH saved AS (
        SELECT pr.drawing_id, pr.similarity_score
          FROM play_records pr
          JOIN user_artworks ua ON ua.record_id = pr.record_id
         WHERE pr.user_id = $1
     ),
     completed AS (
        SELECT DISTINCT drawing_id FROM saved WHERE similarity_score >= $2
     )
     SELECT
       (SELECT cells FROM users WHERE user_id = $1) AS cells,
       (SELECT MAX(similarity_score) FROM play_records WHERE user_id = $1) AS best_score,
       (SELECT COUNT(*) FROM completed) AS completed,
       (SELECT COUNT(*) FROM completed c JOIN creature_profiles p ON p.drawing_id = c.drawing_id) AS creature_completed,
       (SELECT COUNT(*) FROM creature_profiles) AS creature_total,
       (SELECT COUNT(*) FROM user_stored_objects WHERE user_id = $1) AS stored_objects`,
    [req.userId, COMPLETE_SCORE],
  );
  const r = rows[0];
  const completed = Number(r.completed);
  res.json({
    cells: Number(r.cells ?? 0),
    bestScore: r.best_score === null ? null : Number(r.best_score),
    completeScore: COMPLETE_SCORE,
    completedArtworks: completed,
    storyCompleted: completed - Number(r.creature_completed),
    creatureCollected: Number(r.creature_completed),
    creatureTotal: Number(r.creature_total),
    storedObjects: Number(r.stored_objects),
  });
});
