BEGIN;

-- 원본 그림(밑그림) 이미지를 DB에 보관한다.
-- 처음 설계는 reference_image_key(파일 경로)만 두는 방식이었지만, 따로 파일 저장소를 두지 않도록 이미지 자체도 저장한다
-- (005_artwork_images.sql 의 완성 그림과 같은 방식). 경로는 그대로 남겨 이미지 파일을 찾는 이름으로 쓴다.
-- 이미지는 pnpm db:migrate 가 database/seeds/guides/<reference_image_key> 파일을 읽어 넣는다.
ALTER TABLE drawings
    ADD COLUMN reference_image BYTEA,
    ADD COLUMN reference_content_type VARCHAR(50);

ALTER TABLE drawings
    ADD CONSTRAINT chk_drawings_image_type
        CHECK (reference_image IS NULL OR reference_content_type IS NOT NULL);

COMMIT;
