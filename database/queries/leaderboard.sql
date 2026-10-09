
WITH best_attempts AS (
    SELECT
        p.record_id,
        p.user_id,
        p.drawing_id,
        p.similarity_score,
        p.duration_ms,
        p.played_at,
        ROW_NUMBER() OVER (
            PARTITION BY p.user_id, p.drawing_id
            ORDER BY
                p.similarity_score DESC,
                p.duration_ms ASC,
                p.played_at ASC,
                p.record_id ASC
        ) AS attempt_rank
    FROM play_records p
    WHERE p.drawing_id = 1
)
SELECT
    ROW_NUMBER() OVER (
        ORDER BY
            b.similarity_score DESC,
            b.duration_ms ASC,
            b.played_at ASC,
            b.record_id ASC
    ) AS ranking,
    u.nickname,
    b.similarity_score,
    b.duration_ms,
    b.played_at
FROM best_attempts b
JOIN users u ON b.user_id = u.user_id
WHERE b.attempt_rank = 1
ORDER BY ranking
LIMIT 10;
