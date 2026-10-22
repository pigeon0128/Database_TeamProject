-- =========================================================
-- 1. 사용자별 도감 전체 조회
-- $1: user_id
-- =========================================================

WITH ranked_artworks AS (
    SELECT
        pr.drawing_id,
        pr.record_id,
        pr.similarity_score,
        pr.duration_ms,
        ua.artwork_id,
        ua.image_key,
        ROW_NUMBER() OVER (
            PARTITION BY pr.drawing_id
            ORDER BY
                pr.similarity_score DESC,
                pr.duration_ms ASC,
                pr.played_at ASC,
                pr.record_id ASC
        ) AS rn
    FROM play_records pr
    JOIN user_artworks ua
        ON pr.record_id = ua.record_id
    WHERE pr.user_id = $1
)
SELECT
    d.drawing_id,
    d.chapter_id,
    d.title,
    d.reference_image_key,
    d.drawing_order,
    (ra.artwork_id IS NOT NULL) AS is_collected,
    ra.image_key AS representative_image_key,
    -- 그림 파일은 서버 폴더에 있고 image_key 는 그 경로다 (010_artwork_files.sql). 앱은 /uploads/<image_key> 로 그림을 받는다.
    ra.record_id AS representative_record_id,
    ra.similarity_score AS best_score,
    ra.duration_ms AS best_duration_ms
FROM drawings d
JOIN chapters c
    ON d.chapter_id = c.chapter_id
LEFT JOIN ranked_artworks ra
    ON d.drawing_id = ra.drawing_id
    AND ra.rn = 1
ORDER BY c.chapter_order, d.drawing_order;


-- =========================================================
-- 2. 챕터별 도감 수집 현황 조회
-- $1: user_id
-- =========================================================

WITH collected_drawings AS (
    SELECT DISTINCT
        pr.drawing_id
    FROM play_records pr
    JOIN user_artworks ua
        ON pr.record_id = ua.record_id
    WHERE pr.user_id = $1
)
SELECT
    c.chapter_id,
    c.title,
    COUNT(d.drawing_id) AS total_drawings,
    COUNT(cd.drawing_id) AS collected_drawings
FROM chapters c
LEFT JOIN drawings d
    ON c.chapter_id = d.chapter_id
LEFT JOIN collected_drawings cd
    ON d.drawing_id = cd.drawing_id
GROUP BY
    c.chapter_id,
    c.title,
    c.chapter_order
ORDER BY c.chapter_order;


-- =========================================================
-- 3. 생물 도감 목록: 도감 정보 + 내 수집 현황
-- (1번과 같은 대표 작품 규칙. 앱의 GET /api/collection 이 쓰는 쿼리, server/routes/collection.js)
-- $1: user_id
-- =========================================================

WITH ranked_artworks AS (
    SELECT
        pr.drawing_id,
        pr.record_id,
        pr.similarity_score,
        pr.duration_ms,
        ROW_NUMBER() OVER (
            PARTITION BY pr.drawing_id
            ORDER BY
                pr.similarity_score DESC,
                pr.duration_ms ASC,
                pr.played_at ASC,
                pr.record_id ASC
        ) AS rn
    FROM play_records pr
    JOIN user_artworks ua
        ON pr.record_id = ua.record_id
    WHERE pr.user_id = $1
)
SELECT
    d.drawing_id,
    d.title,
    p.slug,
    p.category,
    p.summary,
    (ra.record_id IS NOT NULL) AS is_collected,
    ra.record_id AS representative_record_id,
    ra.similarity_score AS best_score,
    ra.duration_ms AS best_duration_ms,
    COALESCE((
        SELECT json_agg(json_build_object('label', f.label, 'content', f.content) ORDER BY f.fact_order)
        FROM creature_facts f
        WHERE f.drawing_id = d.drawing_id
    ), '[]'::json) AS facts,
    COALESCE((
        SELECT json_agg(t.content ORDER BY t.tip_order)
        FROM creature_tips t
        WHERE t.drawing_id = d.drawing_id
    ), '[]'::json) AS tips,
    COALESCE((
        SELECT json_agg(json_build_object('citation', s.citation, 'url', s.url) ORDER BY s.source_order)
        FROM creature_sources s
        WHERE s.drawing_id = d.drawing_id
    ), '[]'::json) AS sources
FROM creature_profiles p
JOIN drawings d
    ON d.drawing_id = p.drawing_id
JOIN chapters c
    ON d.chapter_id = c.chapter_id
LEFT JOIN ranked_artworks ra
    ON d.drawing_id = ra.drawing_id
    AND ra.rn = 1
ORDER BY c.chapter_order, d.drawing_order;
