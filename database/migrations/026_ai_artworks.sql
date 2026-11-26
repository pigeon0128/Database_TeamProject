BEGIN;

-- AI 그림 연습실(#/ai-studio)에서 만든 그림 중 "마이룸에 추가"한 그림.
-- 그림 파일은 완성 그림과 같은 서버 폴더(uploads/ai-artworks/<사용자>/<번호>.png)에 두고, 여기에는 경로만 둔다.
-- 마이룸은 액자에 걸 그림을 번호(artworkDrawingId)로 가리키므로, AI 그림은 1000000000 + ai_artwork_id 로 보여 준다
-- (장면 번호 drawings.drawing_id 와 겹치지 않게. shared/myroom.js 의 AI_ARTWORK_BASE).
-- 개발 중 다른 번호(024_ai_artworks.sql)로 먼저 만든 DB에서도 다시 돌릴 수 있게 IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS user_ai_artworks (
    ai_artwork_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    -- 마이룸 작품 목록에 보이는 이름 (아이가 쓴 설명의 앞부분)
    title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 40),
    image_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_artworks_user ON user_ai_artworks (user_id, ai_artwork_id);

COMMIT;
