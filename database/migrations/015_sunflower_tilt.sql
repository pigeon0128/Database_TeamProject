BEGIN;

-- 해바라기 "해 따라 움직이기" 항목을 짧게 줄이고, "움직인다" 대신 "기운다"로 쓴다. 한 줄 소개도 바꾼다.
-- 해바라기는 고개를 돌리는 것이 아니라 줄기 동쪽·서쪽이 번갈아 더 자라서 윗부분이 기운다 (근거: database/creature-sources.md).
-- 빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 고친 내용을 넣는다.
UPDATE creature_facts f
SET label = '해 따라 기울기',
    content = '어릴 때는 해를 따라 기울고, 다 자라면 동쪽을 바라본 채 멈춰요'
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug = 'sunflower'
  AND f.label = '해 따라 움직이기';

-- 한 줄 소개 (근거: 한국민족문화대백과사전 「해바라기」 "높이 2m 정도", "꽃은 여름철에 노랗게 피며, 줄기 끝에 대형의 두상화를 이루는데")
UPDATE creature_profiles
SET summary = '키가 크고 해처럼 커다란 노란 꽃이 피는 식물이에요.'
WHERE slug = 'sunflower';

COMMIT;
