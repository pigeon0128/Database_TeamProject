BEGIN;

-- 원래 설계로 되돌림: drawings 는 밑그림의 경로(reference_image_key)만 보관하고, 이미지 파일은 앱(src/assets)에 둔다.
-- 잠깐 있었던 008_drawing_images.sql(밑그림 이미지를 DB에 저장)은 지웠다. 그 마이그레이션을 이미 실행한 DB에서
-- 그때 추가한 칸을 지우고, 실행하지 않은 DB에서는 아무것도 하지 않는다 (IF EXISTS).
ALTER TABLE drawings
    DROP CONSTRAINT IF EXISTS chk_drawings_image_type,
    DROP COLUMN IF EXISTS reference_image,
    DROP COLUMN IF EXISTS reference_content_type;

COMMIT;
