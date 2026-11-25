BEGIN;

CREATE VIEW v_grade_leaderboard AS
WITH best_attempts AS (
    SELECT
        p.record_id,
        p.user_id,
        p.drawing_id,
        u.grade,
        u.nickname,
        p.similarity_score,
        p.duration_ms,
        p.played_at,
        ROW_NUMBER() OVER (
            -- grade is fixed per user and lets a grade filter reach the join.
            PARTITION BY p.user_id, p.drawing_id, u.grade
            ORDER BY p.similarity_score DESC, p.duration_ms, p.played_at, p.record_id
        ) AS attempt_rank
    FROM play_records p
    JOIN users u ON u.user_id = p.user_id
    WHERE u.grade IS NOT NULL
),
ranked AS (
    SELECT
        record_id, user_id, drawing_id, grade, nickname, similarity_score, duration_ms, played_at,
        ROW_NUMBER() OVER (
            PARTITION BY drawing_id, grade
            ORDER BY similarity_score DESC, duration_ms, played_at, record_id
        ) AS grade_ranking
    FROM best_attempts
    WHERE attempt_rank = 1
)
SELECT
    r.record_id, r.user_id, r.drawing_id, r.grade, r.nickname,
    r.similarity_score, r.duration_ms, r.played_at, a.image_key, r.grade_ranking
FROM ranked r
LEFT JOIN user_artworks a ON a.record_id = r.record_id;

COMMIT;
