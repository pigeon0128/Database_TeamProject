BEGIN;

-- 7. 사용자 그리기 설정
-- 그림을 새로 고를 때마다 설정이 기본값으로 돌아가지 않도록, 사용자가 마지막으로 바꾼 값을 보관한다.
-- 사용자당 한 행 (users 1 : 0..1 user_settings). 행이 없으면 앱의 기본값을 쓴다.
CREATE TABLE user_settings (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(user_id) ON DELETE CASCADE,
    brush_size SMALLINT NOT NULL DEFAULT 6,
    guide_visible BOOLEAN NOT NULL DEFAULT TRUE,
    guide_opacity SMALLINT NOT NULL DEFAULT 80,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 앱의 굵기 조절 범위 (브러쉬와 지우개가 같은 값을 쓰므로 지우개 최대치까지 허용)
    CONSTRAINT chk_settings_brush_size
        CHECK (brush_size BETWEEN 2 AND 48),
    -- 밑그림 진하기 (%)
    CONSTRAINT chk_settings_guide_opacity
        CHECK (guide_opacity BETWEEN 10 AND 100)
);

COMMIT;
