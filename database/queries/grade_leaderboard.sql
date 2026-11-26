-- $1: drawing_id, $2: grade (1~9), $3: 결과 개수 (NULL은 10, 최대 50)
-- 전체 학년 옵션(0)은 기존 전체 리더보드 경로를 사용한다.
SELECT
    record_id, user_id, drawing_id, grade, nickname,
    similarity_score, duration_ms, played_at, image_key, grade_ranking
FROM v_grade_leaderboard
WHERE drawing_id = $1 AND grade = $2
ORDER BY grade_ranking
LIMIT LEAST(COALESCE($3::bigint, 10), 50);
