-- 그리던 그림 (이어서 그리기) 불러오기 / 저장하기 / 지우기
-- 앱(src/lib/drawingDraft.ts)과 API(server/routes/drafts.js 의 /api/drafts)가 쓰는 쿼리와 같다.

-- 1) 그리던 그림 목록 (장면 고르기 화면의 "이어 그리기" 표시)
SELECT d.draft_key, d.saved_at, jsonb_array_length(d.strokes) AS stroke_count
FROM drawing_drafts d
JOIN users u ON d.user_id = u.user_id
WHERE u.nickname = 'user_A'
ORDER BY d.saved_at DESC;

-- 2) 그림 하나 불러오기
SELECT d.strokes, d.name, d.saved_at
FROM drawing_drafts d
JOIN users u ON d.user_id = u.user_id
WHERE u.nickname = 'user_A' AND d.draft_key = 'story:forest-music';

-- 3) 저장하기: 처음이면 INSERT, 이미 있으면 UPDATE (UPSERT)
INSERT INTO drawing_drafts (user_id, draft_key, strokes, name)
SELECT user_id, 'story:forest-music', '[]'::jsonb, NULL
FROM users
WHERE nickname = 'user_A'
ON CONFLICT (user_id, draft_key) DO UPDATE
SET
    strokes = EXCLUDED.strokes,
    name = EXCLUDED.name,
    saved_at = NOW();

-- 4) 다 그렸거나(기록 저장) 새로 그리기를 고르면 지운다
DELETE FROM drawing_drafts
WHERE user_id = (SELECT user_id FROM users WHERE nickname = 'user_A')
  AND draft_key = 'story:forest-music';
