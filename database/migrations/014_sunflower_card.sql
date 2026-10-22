BEGIN;

-- 해바라기 도감 카드 고치기
-- 한 줄 소개를 한국민족문화대백과사전 「해바라기」의 정의 문장으로 바꾸고, "동쪽을 보는 까닭" 항목을 뺀다.
-- 빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 고친 내용을 넣는다.
UPDATE creature_profiles
SET summary = '국화과에 속하는 일년생 초본식물.'
WHERE slug = 'sunflower';

DELETE FROM creature_facts f
USING creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug = 'sunflower'
  AND f.label = '동쪽을 보는 까닭';

-- 뒤 항목(꽃, 잎)의 순서를 한 칸씩 당긴다 (seeds/content.sql 의 순서와 맞춘다). 기본키가 겹치지 않도록 앞에서부터 하나씩.
UPDATE creature_facts f
SET fact_order = 5
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id AND p.slug = 'sunflower' AND f.label = '꽃' AND f.fact_order = 6;

UPDATE creature_facts f
SET fact_order = 6
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id AND p.slug = 'sunflower' AND f.label = '잎' AND f.fact_order = 7;

COMMIT;
