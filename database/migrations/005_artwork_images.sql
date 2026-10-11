BEGIN;

-- 사용자 완성 작품의 이미지를 DB에 직접 저장한다.
-- 원래 user_artworks 는 이미지 파일을 다른 저장소에 두고 경로(image_key)만 보관하는 설계였지만,
-- 따로 파일 저장소를 두지 않도록 그림 자체(PNG)를 image_data 에 넣는다.
-- 경로만 있는 기존 행(예시 데이터)도 그대로 쓸 수 있게, 경로나 이미지 중 하나만 있으면 된다.
ALTER TABLE user_artworks
    ADD COLUMN image_data BYTEA,
    ADD COLUMN content_type VARCHAR(50);

ALTER TABLE user_artworks
    ALTER COLUMN image_key DROP NOT NULL,
    DROP CONSTRAINT chk_artwork_image_nonempty,
    ADD CONSTRAINT chk_artwork_has_image
        CHECK (
            (image_key IS NOT NULL AND LENGTH(TRIM(image_key)) > 0)
            OR image_data IS NOT NULL
        ),
    -- 이미지가 있으면 종류(image/png 등)도 있어야 한다
    ADD CONSTRAINT chk_artwork_content_type
        CHECK (image_data IS NULL OR content_type IS NOT NULL);

COMMIT;
