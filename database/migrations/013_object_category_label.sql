BEGIN;

-- 무생물 도감 카드의 "분류" 항목에서 앞의 "무생물 · " 을 뺀다 (예: "무생물 · 기계" → "기계").
-- 카드 제목 옆 배지에 이미 "무생물"이 보여서 반복되기 때문이다. 동물·식물의 분류(포유류 · 고양이과 등)는 그대로 둔다.
-- 빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 고친 문구를 넣는다.
UPDATE creature_facts f
SET content = SUBSTRING(f.content FROM LENGTH('무생물 · ') + 1)
FROM creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.category = 'object'
  AND f.label = '분류'
  AND f.content LIKE '무생물 · %';

COMMIT;
