BEGIN;

-- 해바라기의 "꽃" 항목을 "특징"으로 바꾸고, "잎" 항목과 잎에 관한 그릴 때 살펴볼 점은 뺀다 (근거: 한국민족문화대백과사전 「해바라기」, database/creature-sources.md).
-- 빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 고친 내용을 넣는다.
UPDATE creature_facts f
SET label = '특징',
    content = '커다란 꽃 한 송이는 사실 작은 꽃들이 모인 것으로, 가장자리에는 혀 모양 꽃이, 가운데에는 작은 꽃이 빽빽하게 있어요'
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug = 'sunflower'
  AND f.label = '꽃';

DELETE FROM creature_facts f
USING creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug = 'sunflower'
  AND f.label = '잎';

-- 그릴 때 살펴볼 점에서도 잎 이야기를 뺀다
DELETE FROM creature_tips t
USING creature_profiles p
WHERE t.drawing_id = p.drawing_id
  AND p.slug = 'sunflower'
  AND t.content = '잎은 넓적하고 가장자리가 들쭉날쭉해요.';

COMMIT;
