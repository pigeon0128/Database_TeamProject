BEGIN;

-- 놀이터 "있는 곳" 항목: "빠짐없이 있어요" → "대부분 있어요".
-- 빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 고친 내용을 넣는다.
UPDATE creature_facts f
SET content = '아파트단지에는 놀이터가 대부분 있어요'
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug = 'playground'
  AND f.label = '있는 곳';

COMMIT;
