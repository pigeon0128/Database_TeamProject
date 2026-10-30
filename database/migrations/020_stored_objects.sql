BEGIN;

-- 3D 색칠하기에서 '수납하기'로 보낸 색칠 오브젝트. 모양(spec)은 서버가 검증한 프리미티브 목록과 색 샘플만 담는다.
CREATE TABLE user_stored_objects (
    object_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
    source_model TEXT NOT NULL CHECK (source_model ~ '^[a-z0-9_-]{1,32}$'),
    thumbnail TEXT NOT NULL CHECK (char_length(thumbnail) <= 80000),
    spec JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_stored_objects_user ON user_stored_objects (user_id, object_id DESC);

COMMIT;
