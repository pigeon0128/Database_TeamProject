BEGIN;

-- 8. 그리던 그림 (이어서 그리기)
-- 그림을 다 그리기 전에 화면을 나가도, 다른 기기에서 로그인해도 이어서 그릴 수 있도록 그리던 획을 보관한다.
-- 사용자마다 그림 하나당 한 행. 완료(기록 저장)하거나 새로 그리기를 고르면 지운다.
CREATE TABLE drawing_drafts (
    user_id BIGINT NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    -- 어떤 그림인지: 스토리 장면은 'story:<장면 id>', 캐릭터 그리기는 'character'
    -- (캐릭터 그리기처럼 drawings 표에 없는 그림도 있어서 drawing_id 대신 앱의 이름을 쓴다)
    draft_key VARCHAR(100) NOT NULL,
    -- 획 목록: [{ type, color, size, erase, fade, points: [[x, y], ...] }, ...]
    strokes JSONB NOT NULL,
    -- 캐릭터 이름처럼 그림과 같이 저장할 값
    name VARCHAR(20),
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, draft_key),
    CONSTRAINT chk_drafts_key_nonempty
        CHECK (LENGTH(TRIM(draft_key)) > 0),
    CONSTRAINT chk_drafts_strokes_array
        CHECK (jsonb_typeof(strokes) = 'array')
);

COMMIT;
