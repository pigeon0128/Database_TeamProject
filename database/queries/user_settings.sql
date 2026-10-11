-- 사용자 그리기 설정 불러오기 / 저장하기
-- 앱(src/lib/userSettings.ts)의 DrawingSettings 필드와 1:1로 대응한다.
--   brushSize    ↔ brush_size
--   guideVisible ↔ guide_visible
--   guideOpacity ↔ guide_opacity

-- 1) 불러오기: 닉네임으로 설정을 찾는다. 행이 없으면 앱이 기본값을 쓴다.
SELECT
    s.brush_size,
    s.guide_visible,
    s.guide_opacity,
    s.updated_at
FROM user_settings s
JOIN users u ON s.user_id = u.user_id
WHERE u.nickname = 'user_A';

-- 2) 저장하기: 처음이면 INSERT, 이미 있으면 바뀐 값으로 UPDATE (UPSERT)
INSERT INTO user_settings (user_id, brush_size, guide_visible, guide_opacity)
SELECT user_id, 4, TRUE, 60
FROM users
WHERE nickname = 'user_A'
ON CONFLICT (user_id) DO UPDATE
SET
    brush_size = EXCLUDED.brush_size,
    guide_visible = EXCLUDED.guide_visible,
    guide_opacity = EXCLUDED.guide_opacity,
    updated_at = NOW();
