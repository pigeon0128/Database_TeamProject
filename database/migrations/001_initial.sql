
BEGIN;

-- 1. 유저
CREATE TABLE users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nickname VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_nickname_nonempty
        CHECK (LENGTH(TRIM(nickname)) > 0)
);

-- 2. 챕터
CREATE TABLE chapters (
    chapter_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    chapter_order INTEGER NOT NULL UNIQUE,
    CONSTRAINT chk_chapters_order
        CHECK (chapter_order > 0)
);

-- 3. 원본 그림
CREATE TABLE drawings (
    drawing_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chapter_id BIGINT NOT NULL
        REFERENCES chapters(chapter_id) ON DELETE RESTRICT,
    title VARCHAR(100) NOT NULL,
    reference_image_key TEXT NOT NULL,
    drawing_order INTEGER NOT NULL,
    CONSTRAINT uq_drawings_chapter_order
        UNIQUE (chapter_id, drawing_order),
    CONSTRAINT chk_drawings_order
        CHECK (drawing_order > 0),
    CONSTRAINT chk_drawings_image_nonempty
        CHECK (LENGTH(TRIM(reference_image_key)) > 0)
);

-- 4. 플레이 기록
CREATE TABLE play_records (
    record_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL
        REFERENCES users(user_id) ON DELETE RESTRICT,
    drawing_id BIGINT NOT NULL
        REFERENCES drawings(drawing_id) ON DELETE RESTRICT,
    similarity_score NUMERIC(5,2) NOT NULL,
    duration_ms INTEGER NOT NULL,
    played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_play_score
        CHECK (similarity_score BETWEEN 0 AND 100),
    CONSTRAINT chk_play_duration
        CHECK (duration_ms >= 0)
);

-- 5. 사용자 완성 작품
CREATE TABLE user_artworks (
    artwork_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    record_id BIGINT NOT NULL UNIQUE
        REFERENCES play_records(record_id) ON DELETE CASCADE,
    image_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_artwork_image_nonempty
        CHECK (LENGTH(TRIM(image_key)) > 0)
);

-- 6. 조회 성능을 위한 인덱스
CREATE INDEX idx_play_records_user_date
    ON play_records(user_id, played_at DESC);

CREATE INDEX idx_play_records_drawing_ranking
    ON play_records(
        drawing_id,
        similarity_score DESC,
        duration_ms ASC
    );

COMMIT;
  