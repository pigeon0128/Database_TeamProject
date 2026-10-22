BEGIN;

-- 완성 그림을 원래 설계(001_initial.sql)대로 되돌림: 그림 파일은 서버 폴더(uploads/)에 두고 DB에는 경로(image_key)만 저장한다.
-- 005_artwork_images.sql 이 더했던 그림 데이터 칸(image_data, content_type)과 그 제약을 지우고,
-- 경로가 꼭 있어야 한다는 원래 규칙(NOT NULL, chk_artwork_image_nonempty)을 다시 건다.
-- 이 파일보다 먼저 pnpm db:migrate(scripts/db-migrate.js)가 DB에 있던 그림을 파일로 꺼내 image_key 를 채운다.
ALTER TABLE user_artworks
    DROP CONSTRAINT IF EXISTS chk_artwork_has_image,
    DROP CONSTRAINT IF EXISTS chk_artwork_content_type,
    DROP COLUMN IF EXISTS image_data,
    DROP COLUMN IF EXISTS content_type;

ALTER TABLE user_artworks
    ALTER COLUMN image_key SET NOT NULL,
    ADD CONSTRAINT chk_artwork_image_nonempty
        CHECK (LENGTH(TRIM(image_key)) > 0);

COMMIT;
