BEGIN;

-- 9. 도감 정보의 출처
-- 도감 설명(한 줄 소개·정보 항목)을 공신력 있는 출처에서 확인한 내용으로 바꾸고, 그 출처를 도감 카드에 보여 준다.
-- 출처를 고른 근거와 각 사이트의 이용 조건은 database/creature-sources.md 에 있다.
-- (creature_profiles 1 : N creature_sources)
CREATE TABLE creature_sources (
    drawing_id BIGINT NOT NULL
        REFERENCES creature_profiles(drawing_id) ON DELETE CASCADE,
    source_order SMALLINT NOT NULL,
    -- 화면에 보여 줄 출처 이름. 한국민족문화대백과사전은 사전이 정한 형식 "[항목명], 『한국민족문화대백과사전』"
    citation TEXT NOT NULL,
    url TEXT NOT NULL,
    PRIMARY KEY (drawing_id, source_order),
    CONSTRAINT chk_creature_source_order
        CHECK (source_order > 0),
    CONSTRAINT chk_creature_source_url
        CHECK (url ~ '^https://')
);

-- 이미 도감 정보가 들어 있는 DB: 출처로 확인한 한 줄 소개로 바꾼다.
-- (빈 DB에서는 고칠 행이 없고, 바로 뒤에 seeds/content.sql 이 새 내용을 넣는다)
UPDATE creature_profiles p
SET summary = v.summary
FROM (VALUES
    ('lion', '고양이과 동물 가운데 가장 무리 지어 사는 큰 육식 동물이에요.'),
    ('zebra', '검은 줄무늬와 흰 줄무늬가 온몸을 덮은 말 무리 동물이에요.'),
    ('cat', '사람과 함께 살며 쥐를 잡는 작은 육식 동물이에요.'),
    ('seaturtle', '노처럼 생긴 다리로 바다를 헤엄치는 거북이에요.'),
    ('dog', '스코틀랜드에서 사냥을 돕도록 기른 개예요.'),
    ('sunflower', '어릴 때는 해를 따라 움직이고, 다 자라면 동쪽을 바라보는 키 큰 꽃이에요.'),
    ('rose', '줄기에 날카로운 가시가 있고 향기로운 꽃이 피는 나무예요.'),
    ('cactus', '소노라 사막에서만 자라는 아주 큰 선인장이에요.'),
    ('tree', '가지가 사방으로 고르게 자라 둥근 모양이 되는 큰 나무예요.'),
    ('dandelion', '봄에 노란 꽃이 피고, 흰 털이 달린 열매가 멀리 날아가는 풀이에요.'),
    ('airplane', '날개에 생기는 힘으로 하늘을 나는 기계예요.'),
    ('sportscar', '엔진의 힘으로 바퀴를 돌려 도로를 달리는 자동차예요.'),
    ('soccerball', '발로 차서 상대 골문에 넣는 축구 경기에 쓰는 둥근 공이에요.'),
    ('robot', '사람과 비슷한 모습과 기능을 가진 자동 기계예요.'),
    ('ferriswheel', '커다란 바퀴가 돌아가는 놀이 기구예요.')
) AS v (slug, summary)
WHERE p.slug = v.slug;

-- 정보 항목은 항목 수와 이름이 바뀌어서 지우고, 바로 뒤에 seeds/content.sql 이 새 항목을 넣는다.
-- (pnpm db:migrate 는 마이그레이션 뒤에 content.sql 을 매번 실행한다. 그릴 때 살펴볼 점은 그대로 둔다)
DELETE FROM creature_facts f
USING creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug IN ('lion', 'zebra', 'cat', 'seaturtle', 'dog', 'sunflower', 'rose', 'cactus',
                 'tree', 'dandelion', 'airplane', 'sportscar', 'soccerball', 'robot', 'ferriswheel');

COMMIT;
