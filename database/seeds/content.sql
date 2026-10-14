-- 앱에 들어 있는 장면(챕터·그림) 목록과 도감 생물 정보. 기록 저장과 리더보드가 drawing_id 로 그림을 찾으므로 꼭 있어야 한다.
-- (src/data/scenes.ts, src/data/creatures.ts 의 drawingId 와 맞춘다. 그림을 추가하면 여기에도 추가한다)
-- 여러 번 실행해도 된다: 이미 있으면 건너뛴다. pnpm db:migrate 가 마이그레이션 뒤에 매번 실행한다.
-- 밑그림 이미지는 reference_image_key 와 같은 경로의 database/seeds/guides 파일을 pnpm db:migrate 가 넣는다.
-- 도감 설명은 아이 눈높이로 새로 쓴 글이다.

BEGIN;

INSERT INTO chapters (chapter_id, title, chapter_order)
OVERRIDING SYSTEM VALUE
VALUES
    (1, '숲속의 만남', 1),
    (2, '생물 도감', 2)
ON CONFLICT DO NOTHING;

INSERT INTO drawings (drawing_id, chapter_id, title, reference_image_key, drawing_order)
OVERRIDING SYSTEM VALUE
VALUES
    (1, 1, '숲속의 노래', 'story/forest-guide.webp', 1),
    (2, 2, '사자', 'creatures/lion.png', 1),
    (3, 2, '얼룩말', 'creatures/zebra.png', 2),
    (4, 2, '고양이', 'creatures/cat.png', 3),
    (5, 2, '바다거북', 'creatures/seaturtle.png', 4),
    (6, 2, '골든 리트리버', 'creatures/dog.png', 5),
    (7, 2, '해바라기', 'creatures/sunflower.png', 6),
    (8, 2, '장미', 'creatures/rose.png', 7),
    (9, 2, '사와로 선인장', 'creatures/cactus.png', 8),
    (10, 2, '느티나무', 'creatures/tree.png', 9),
    (11, 2, '민들레', 'creatures/dandelion.png', 10),
    (12, 2, '비행기', 'creatures/airplane.png', 11),
    (13, 2, '스포츠카', 'creatures/sportscar.png', 12),
    (14, 2, '축구공', 'creatures/soccerball.png', 13),
    (15, 2, '로봇', 'creatures/robot.png', 14),
    (16, 2, '대관람차', 'creatures/ferriswheel.png', 15)
ON CONFLICT DO NOTHING;

-- 도감 정보는 번호와 이름이 둘 다 맞는 그림에만 붙인다 (다른 내용의 그림이 같은 번호를 쓰고 있으면 건너뜀).
INSERT INTO creature_profiles (drawing_id, slug, category, summary)
SELECT d.drawing_id, v.slug, v.category, v.summary
FROM (VALUES
    (2, '사자', 'lion', 'animal', '수컷의 풍성한 갈기로 유명한 초원의 큰 고양이 무리 동물이에요.'),
    (3, '얼룩말', 'zebra', 'animal', '검은 줄무늬와 흰 줄무늬가 있는 아프리카의 말 무리예요.'),
    (4, '고양이', 'cat', 'animal', '사람과 함께 사는 날렵하고 호기심 많은 동물이에요.'),
    (5, '바다거북', 'seaturtle', 'animal', '지느러미 같은 다리로 넓은 바다를 헤엄치는 거북이에요.'),
    (6, '골든 리트리버', 'dog', 'animal', '금빛 털을 가진 순하고 영리한 개예요.'),
    (7, '해바라기', 'sunflower', 'plant', '키가 크고 해처럼 커다란 노란 꽃이 피는 식물이에요.'),
    (8, '장미', 'rose', 'plant', '겹겹이 말린 꽃잎과 줄기의 가시가 특징인 꽃이에요.'),
    (9, '사와로 선인장', 'cactus', 'plant', '사막에서 팔을 든 사람처럼 크게 자라는 선인장이에요.'),
    (10, '느티나무', 'tree', 'plant', '마을 어귀에서 넓은 그늘을 만들어 주는 큰 나무예요.'),
    (11, '민들레', 'dandelion', 'plant', '노란 꽃이 지면 하얀 솜털 씨앗이 바람을 타고 멀리 날아가요.'),
    (12, '비행기', 'airplane', 'object', '하늘을 날아 사람과 짐을 먼 곳까지 옮기는 탈것이에요.'),
    (13, '스포츠카', 'sportscar', 'object', '낮고 날렵한 몸으로 빠르게 달리도록 만든 자동차예요.'),
    (14, '축구공', 'soccerball', 'object', '오각형과 육각형 조각을 이어 만든 둥근 공이에요.'),
    (15, '로봇', 'robot', 'object', '사람처럼 팔과 다리로 움직이는 기계예요.'),
    (16, '대관람차', 'ferriswheel', 'object', '커다란 바퀴가 천천히 돌며 높은 곳에서 경치를 보여 주는 놀이 기구예요.')
) AS v (drawing_id, name, slug, category, summary)
JOIN drawings d ON d.drawing_id = v.drawing_id AND d.title = v.name
ON CONFLICT DO NOTHING;

INSERT INTO creature_facts (drawing_id, fact_order, label, content)
SELECT p.drawing_id, v.fact_order, v.label, v.content
FROM (VALUES
    ('lion', 1, '분류', '포유류 · 고양이과'),
    ('lion', 2, '사는 곳', '아프리카의 넓은 초원(사바나)'),
    ('lion', 3, '먹이', '얼룩말, 영양 같은 초식동물'),
    ('lion', 4, '특징', '여러 마리가 무리를 지어 살고, 수컷은 목 둘레에 풍성한 갈기가 있어요'),
    ('zebra', 1, '분류', '포유류 · 말과'),
    ('zebra', 2, '사는 곳', '아프리카의 초원'),
    ('zebra', 3, '먹이', '풀'),
    ('zebra', 4, '특징', '줄무늬 모양은 사람의 지문처럼 얼룩말마다 조금씩 달라요'),
    ('cat', 1, '분류', '포유류 · 고양이과'),
    ('cat', 2, '사는 곳', '사람의 집 (반려동물)'),
    ('cat', 3, '먹이', '고양이 사료, 원래는 쥐 같은 작은 동물을 사냥해요'),
    ('cat', 4, '특징', '수염으로 주변을 느끼고, 어두운 곳에서도 잘 볼 수 있어요'),
    ('seaturtle', 1, '분류', '파충류 · 바다거북 무리'),
    ('seaturtle', 2, '사는 곳', '따뜻한 바다'),
    ('seaturtle', 3, '먹이', '종류마다 달라요 (해초, 해파리 등)'),
    ('seaturtle', 4, '특징', '평생 바다에서 살지만 알은 모래사장에 올라와서 낳아요'),
    ('dog', 1, '분류', '포유류 · 개과'),
    ('dog', 2, '사는 곳', '사람의 집 (반려동물)'),
    ('dog', 3, '특징', '사냥한 새를 물어 오도록 길러진 개로, 순하고 영리해서 안내견으로도 일해요'),
    ('sunflower', 1, '분류', '국화과 · 한해살이풀'),
    ('sunflower', 2, '원래 살던 곳', '북아메리카'),
    ('sunflower', 3, '크기', '키가 2~3m까지 자라요'),
    ('sunflower', 4, '특징', '커다란 꽃 한 송이는 사실 작은 꽃 수백 개가 모인 것이고, 가운데에 씨앗이 촘촘히 생겨요'),
    ('rose', 1, '분류', '장미과 · 떨기나무'),
    ('rose', 2, '사는 곳', '정원, 공원, 화단'),
    ('rose', 3, '특징', '줄기에 가시가 있고, 사람들이 만든 품종이 아주 많아서 꽃 색과 모양이 다양해요'),
    ('cactus', 1, '분류', '선인장과'),
    ('cactus', 2, '사는 곳', '미국 남서부와 멕시코의 소노라 사막'),
    ('cactus', 3, '특징', '굵은 줄기에 물을 저장하고 잎 대신 가시가 있어요. 아주 천천히 자라서 팔 같은 가지는 수십 년이 지나야 생겨요'),
    ('tree', 1, '분류', '느릅나무과 · 잎이 지는 큰 나무'),
    ('tree', 2, '사는 곳', '우리나라 마을 어귀, 산기슭'),
    ('tree', 3, '특징', '수백 년을 살며 넓은 그늘을 만들어 마을의 정자나무로 많이 심어요'),
    ('dandelion', 1, '분류', '국화과 · 여러해살이풀'),
    ('dandelion', 2, '사는 곳', '길가, 들판, 햇볕이 잘 드는 곳'),
    ('dandelion', 3, '특징', '잎이 땅에 붙어 둥글게 퍼지고, 꽃이 지면 솜털 달린 씨앗이 바람을 타고 멀리 날아가요'),
    ('airplane', 1, '분류', '무생물 · 탈것 (여객기)'),
    ('airplane', 2, '쓰임', '많은 사람과 짐을 싣고 먼 곳까지 빠르게 날아가요'),
    ('airplane', 3, '특징', '빠르게 달리면 날개에 위로 뜨는 힘이 생겨서 하늘을 날 수 있어요'),
    ('sportscar', 1, '분류', '무생물 · 탈것 (자동차)'),
    ('sportscar', 2, '쓰임', '빠르게 달리는 즐거움을 위해 만든 자동차'),
    ('sportscar', 3, '특징', '몸체가 낮고 납작해서 공기의 방해를 적게 받아요'),
    ('soccerball', 1, '분류', '무생물 · 운동 도구'),
    ('soccerball', 2, '쓰임', '축구 경기'),
    ('soccerball', 3, '특징', '전통적인 축구공은 오각형 12개와 육각형 20개 조각을 이어 만들어요'),
    ('robot', 1, '분류', '무생물 · 기계 (사람 모양 로봇)'),
    ('robot', 2, '쓰임', '공장에서 물건을 옮기거나 사람이 하기 위험한 일을 해요'),
    ('robot', 3, '특징', '관절마다 모터가 있어서 팔과 다리를 사람처럼 움직여요'),
    ('ferriswheel', 1, '분류', '무생물 · 놀이 기구'),
    ('ferriswheel', 2, '쓰임', '높은 곳에 올라 주변 경치를 구경해요'),
    ('ferriswheel', 3, '특징', '1893년 미국 시카고 박람회에서 처음 만든 사람의 이름을 따서 영어로 페리스 휠이라고 불러요')
) AS v (slug, fact_order, label, content)
JOIN creature_profiles p ON p.slug = v.slug
ON CONFLICT DO NOTHING;

INSERT INTO creature_tips (drawing_id, tip_order, content)
SELECT p.drawing_id, v.tip_order, v.content
FROM (VALUES
    ('lion', 1, '얼굴 둘레를 감싼 갈기를 먼저 크게 그려 보세요.'),
    ('lion', 2, '앞다리는 굵고 곧게 내려와요.'),
    ('zebra', 1, '줄무늬는 몸의 둥근 곡선을 따라 휘어져요.'),
    ('zebra', 2, '다리의 줄무늬는 가로로 촘촘해요.'),
    ('cat', 1, '귀는 세모 모양으로 뾰족해요.'),
    ('cat', 2, '수염은 코 양옆에서 바깥으로 뻗어요.'),
    ('seaturtle', 1, '등딱지는 여러 조각으로 나뉘어 있어요.'),
    ('seaturtle', 2, '앞 지느러미가 뒤 지느러미보다 길어요.'),
    ('dog', 1, '귀는 얼굴 옆으로 축 늘어져 있어요.'),
    ('dog', 2, '꼬리의 털이 풍성하게 말려 올라가요.'),
    ('sunflower', 1, '가운데 둥근 씨앗 판을 먼저 그리고 꽃잎을 빙 둘러 그려요.'),
    ('sunflower', 2, '잎은 넓적하고 가장자리가 들쭉날쭉해요.'),
    ('rose', 1, '가운데 꽃잎은 돌돌 말려 있고 바깥 꽃잎은 넓게 펼쳐져요.'),
    ('rose', 2, '잎 가장자리는 톱니처럼 들쭉날쭉해요.'),
    ('cactus', 1, '줄기와 팔을 따라 세로 주름 선이 나 있어요.'),
    ('cactus', 2, '팔은 옆으로 나와서 위로 굽어 올라가요.'),
    ('tree', 1, '나뭇잎 덩어리는 뭉게구름처럼 둥글게 그려요.'),
    ('tree', 2, '줄기는 아래로 갈수록 넓게 퍼져요.'),
    ('dandelion', 1, '가운데에서 솜털 씨앗이 동그랗게 사방으로 퍼져요.'),
    ('dandelion', 2, '날아가는 씨앗은 작은 우산처럼 생겼어요.'),
    ('airplane', 1, '날개 아래에 둥근 엔진이 하나씩 달려 있어요.'),
    ('airplane', 2, '꼬리 날개는 위로 곧게 서 있어요.'),
    ('sportscar', 1, '바퀴는 동그랗게, 차체는 낮고 길게 그려요.'),
    ('sportscar', 2, '앞유리는 비스듬히 누워 있어요.'),
    ('soccerball', 1, '가운데 조각부터 그리고 둘레 조각을 하나씩 이어 붙여요.'),
    ('soccerball', 2, '공의 테두리는 크고 둥근 원이에요.'),
    ('robot', 1, '어깨와 무릎 같은 관절은 동그라미로 그려요.'),
    ('robot', 2, '팔과 다리는 여러 마디로 나뉘어 있어요.'),
    ('ferriswheel', 1, '가운데 축에서 바큇살이 사방으로 뻗어요.'),
    ('ferriswheel', 2, '바퀴 둘레에 사람이 타는 칸이 줄지어 달려 있어요.')
) AS v (slug, tip_order, content)
JOIN creature_profiles p ON p.slug = v.slug
ON CONFLICT DO NOTHING;

-- 번호를 직접 넣었으므로, 다음에 자동으로 붙일 번호를 가장 큰 번호 뒤로 맞춘다.
SELECT setval(pg_get_serial_sequence('chapters', 'chapter_id'), (SELECT MAX(chapter_id) FROM chapters));
SELECT setval(pg_get_serial_sequence('drawings', 'drawing_id'), (SELECT MAX(drawing_id) FROM drawings));

COMMIT;
