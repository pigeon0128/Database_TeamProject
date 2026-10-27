-- 앱에 들어 있는 장면(챕터·그림) 목록과 도감 생물 정보. 기록 저장과 리더보드가 drawing_id 로 그림을 찾으므로 꼭 있어야 한다.
-- (src/data/scenes.ts, src/data/creatures.ts 의 drawingId 와 맞춘다. 그림을 추가하면 여기에도 추가한다)
-- 여러 번 실행해도 된다: 이미 있으면 건너뛴다. pnpm db:migrate 가 마이그레이션 뒤에 매번 실행한다.
-- reference_image_key 는 밑그림 이미지의 경로다 (앱의 src/assets/<경로> 파일).
-- 도감 설명은 출처(creature_sources)에서 확인한 사실을 아이 눈높이로 새로 쓴 글이다. 근거와 이용 조건: database/creature-sources.md

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
    (17, 2, '놀이터', 'creatures/playground.png', 15)
ON CONFLICT DO NOTHING;

-- 도감 정보는 번호와 이름이 둘 다 맞는 그림에만 붙인다 (다른 내용의 그림이 같은 번호를 쓰고 있으면 건너뜀).
INSERT INTO creature_profiles (drawing_id, slug, category, summary)
SELECT d.drawing_id, v.slug, v.category, v.summary
FROM (VALUES
    (2, '사자', 'lion', 'animal', '고양이과 동물 가운데 가장 무리 지어 사는 큰 육식 동물이에요.'),
    (3, '얼룩말', 'zebra', 'animal', '검은 줄무늬와 흰 줄무늬가 온몸을 덮은 말 무리 동물이에요.'),
    (4, '고양이', 'cat', 'animal', '사람과 함께 살며 쥐를 잡는 작은 육식 동물이에요.'),
    (5, '바다거북', 'seaturtle', 'animal', '노처럼 생긴 다리로 바다를 헤엄치는 거북이에요.'),
    (6, '골든 리트리버', 'dog', 'animal', '스코틀랜드에서 사냥을 돕도록 기른 개예요.'),
    (7, '해바라기', 'sunflower', 'plant', '키가 크고 해처럼 커다란 노란 꽃이 피는 식물이에요.'),
    (8, '장미', 'rose', 'plant', '줄기에 날카로운 가시가 있고 향기로운 꽃이 피는 나무예요.'),
    (9, '사와로 선인장', 'cactus', 'plant', '소노라 사막에서만 자라는 아주 큰 선인장이에요.'),
    (10, '느티나무', 'tree', 'plant', '가지가 사방으로 고르게 자라 둥근 모양이 되는 큰 나무예요.'),
    (11, '민들레', 'dandelion', 'plant', '봄에 노란 꽃이 피고, 흰 털이 달린 열매가 멀리 날아가는 풀이에요.'),
    (12, '비행기', 'airplane', 'object', '날개에 생기는 힘으로 하늘을 나는 기계예요.'),
    (13, '스포츠카', 'sportscar', 'object', '엔진의 힘으로 바퀴를 돌려 도로를 달리는 자동차예요.'),
    (14, '축구공', 'soccerball', 'object', '발로 차서 상대 골문에 넣는 축구 경기에 쓰는 둥근 공이에요.'),
    (15, '로봇', 'robot', 'object', '사람과 비슷한 모습과 기능을 가진 자동 기계예요.'),
    (17, '놀이터', 'playground', 'object', '그네·시소·미끄럼틀 같은 시설을 갖추고 안전하게 놀 수 있도록 따로 만든 곳이에요.')
) AS v (drawing_id, name, slug, category, summary)
JOIN drawings d ON d.drawing_id = v.drawing_id AND d.title = v.name
ON CONFLICT DO NOTHING;

INSERT INTO creature_facts (drawing_id, fact_order, label, content)
SELECT p.drawing_id, v.fact_order, v.label, v.content
FROM (VALUES
    ('lion', 1, '분류', '포유류 · 고양이과'),
    ('lion', 2, '사는 곳', '아프리카와 인도'),
    ('lion', 3, '크기', '몸길이 암컷 160~184cm, 수컷 184~208cm'),
    ('lion', 4, '특징', '''프라이드''라는 무리를 지어 살고, 둥근 머리와 둥근 귀, 꼬리 끝의 어두운 털 뭉치가 특징이에요'),
    ('zebra', 1, '분류', '포유류 · 말과'),
    ('zebra', 2, '사는 곳', '아프리카'),
    ('zebra', 3, '먹이', '주로 풀을 먹고, 나무껍질·열매·잎도 먹어요'),
    ('zebra', 4, '특징', '가장 큰 얼룩말인 그레비얼룩말은 줄무늬가 80개쯤 있고, 털 아래 피부는 검거나 짙은 갈색이에요'),
    ('cat', 1, '분류', '포유류 · 고양이과'),
    ('cat', 2, '사는 곳', '사람의 집. 우리나라에는 약 1,000년 전에 들어온 것으로 짐작해요'),
    ('cat', 3, '먹이', '원래는 작은 쥐, 새, 물고기, 벌레 등을 잡아먹어요'),
    ('cat', 4, '특징', '앞발가락은 5개, 뒷발가락은 4개이고 발가락 끝에 날카로운 발톱이 있어요'),
    ('seaturtle', 1, '분류', '파충류 · 거북목'),
    ('seaturtle', 2, '종류', '전 세계에 7종이 있고, 우리나라 바다에서는 5종이 확인돼요'),
    ('seaturtle', 3, '먹이', '해초류'),
    ('seaturtle', 4, '특징', '다리가 배의 노 모양이라 헤엄치기 좋아요. 알은 모래 해변에 낳아요'),
    ('dog', 1, '분류', '포유류 · 개과'),
    ('dog', 2, '조상', '개는 늑대에서 나온 동물이에요'),
    ('dog', 3, '원래 살던 곳', '스코틀랜드'),
    ('dog', 4, '특징', '시각장애인 안내견이나 수색·구조견으로도 일해요'),
    ('sunflower', 1, '분류', '국화과 · 한해살이풀'),
    ('sunflower', 2, '원래 살던 곳', '북아메리카'),
    ('sunflower', 3, '크기', '키가 2m 정도까지 자라요'),
    ('sunflower', 4, '해 따라 기울기', '어릴 때는 해를 따라 기울고, 다 자라면 동쪽을 바라본 채 멈춰요'),
    ('sunflower', 5, '특징', '커다란 꽃 한 송이는 사실 작은 꽃들이 모인 것으로, 가장자리에는 혀 모양 꽃이, 가운데에는 작은 꽃이 빽빽하게 있어요'),
    ('rose', 1, '분류', '장미과 · 잎이 지는 키 작은 나무'),
    ('rose', 2, '꽃 피는 때', '6~7월'),
    ('rose', 3, '특징', '줄기와 가지에 날카롭고 굵은 가시가 있고, 잎 가장자리는 톱니 모양이에요'),
    ('rose', 4, '품종', '지금의 장미는 중국의 들장미가 유럽으로 건너가 유럽 들장미와 섞여 만들어졌어요'),
    ('cactus', 1, '분류', '선인장과'),
    ('cactus', 2, '사는 곳', '미국 애리조나 중부에서 멕시코 소노라까지 이어진 소노라 사막'),
    ('cactus', 3, '크기·나이', '15m까지 자라고 보통 150~175년을 살아요'),
    ('cactus', 4, '특징', '35살쯤 처음 꽃이 피고, 팔은 50~70살쯤 생겨요. 비가 오면 주름이 아코디언처럼 늘어나 물을 저장해요'),
    ('tree', 1, '분류', '느릅나무과 · 잎이 지는 큰 나무'),
    ('tree', 2, '사는 곳', '우리나라, 일본, 대만, 중국'),
    ('tree', 3, '크기', '높이 26m, 줄기 지름 3m까지 자라요'),
    ('tree', 4, '특징', '옛날부터 마을의 정자나무로 가장 많이 쓰였어요'),
    ('dandelion', 1, '분류', '국화과 · 여러해살이풀'),
    ('dandelion', 2, '사는 곳', '우리나라 곳곳'),
    ('dandelion', 3, '특징', '줄기 없이 잎이 뿌리에서 바로 나오고, 잎은 깊게 갈라지며 톱니가 있어요. 열매에 난 흰 털이 씨앗을 멀리 옮겨요'),
    ('airplane', 1, '분류', '탈것'),
    ('airplane', 2, '나는 원리', '날개 위쪽은 공기 압력이 낮고 아래쪽은 높아서 날개를 위로 밀어 올리는 힘(양력)이 생겨요'),
    ('airplane', 3, '생김새', '앞날개가 하늘에 뜨는 힘을 만들고, 꼬리날개가 균형을 잡아요'),
    ('sportscar', 1, '분류', '탈것 (자동차)'),
    ('sportscar', 2, '움직이는 원리', '휘발유나 경유로 엔진을 움직이고, 그 힘으로 바퀴를 돌려 달려요'),
    ('sportscar', 3, '우리나라 첫 자동차', '1911년쯤 미국산 승용차가 처음 들어온 것으로 짐작해요'),
    ('sportscar', 4, '처음 만든 국산차', '1955년에 시발자동차회사가 세워져 ''첫걸음''이라는 뜻의 ''시발'' 자동차를 만들었어요'),
    ('soccerball', 1, '분류', '운동 도구'),
    ('soccerball', 2, '쓰임', '11명이 한 팀이 되어 공을 차서 상대편 골문에 넣는 축구 경기'),
    ('soccerball', 3, '크기', '둘레 68~71cm, 무게 369~453g'),
    ('soccerball', 4, '특징', '1970년 월드컵 공 ''텔스타''는 가죽 조각 32개를 이어 만들어 그때 가장 둥근 공이었어요'),
    ('robot', 1, '분류', '기계'),
    ('robot', 2, '쓰임', '공장에서 사람 대신 조립하거나 검사하고, 우주·깊은 바다·원자로처럼 위험한 곳에서도 일해요'),
    ('robot', 3, '특징', '우리나라에서는 2004년 카이스트(KAIST)에서 사람 모양 로봇 ''휴보''를 만들었어요'),
    ('playground', 1, '분류', '놀이 시설'),
    ('playground', 2, '뜻', '안전하고 자유롭게 놀 수 있도록 시설을 갖추어 따로 마련한 곳이에요'),
    ('playground', 3, '시설', '그네, 시소, 미끄럼틀 등이 있어요'),
    ('playground', 4, '있는 곳', '아파트단지에는 놀이터가 대부분 있어요'),
    ('playground', 5, '옛날 놀이터', '옛날에는 마당이 가장 중요한 놀이터였고, 마을 어귀의 당나무 아래나 도시의 골목길·빈터에서도 놀았어요')
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
    ('playground', 1, '미끄럼틀은 위에서 아래로 넓게 휘어지며 내려와요.'),
    ('playground', 2, '사다리는 긴 기둥 두 개 사이에 가로대를 나란히 그려요.')
) AS v (slug, tip_order, content)
JOIN creature_profiles p ON p.slug = v.slug
ON CONFLICT DO NOTHING;

-- 도감 정보의 출처 (migrations/011_creature_sources.sql). 출처를 고른 근거와 이용 조건: database/creature-sources.md
INSERT INTO creature_sources (drawing_id, source_order, citation, url)
SELECT p.drawing_id, v.source_order, v.citation, v.url
FROM (VALUES
    ('lion', 1, '사자, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0025906'),
    ('zebra', 1, '7 Facts to Celebrate International Zebra Day!, Smithsonian''s National Zoo', 'https://nationalzoo.si.edu/animals/news/7-facts-celebrate-international-zebra-day'),
    ('cat', 1, '고양이, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0003811'),
    ('seaturtle', 1, '거북, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0001829'),
    ('dog', 1, '개, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0001561'),
    ('dog', 2, 'Golden Retriever, American Kennel Club', 'https://www.akc.org/dog-breeds/golden-retriever/'),
    ('sunflower', 1, '해바라기, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0062587'),
    ('sunflower', 2, 'Atamian 외, Science 353(6299), 2016', 'https://doi.org/10.1126/science.aaf9793'),
    ('sunflower', 3, 'Sunflowers Move by the Clock, UC Davis', 'https://www.ucdavis.edu/news/sunflowers-move-clock'),
    ('rose', 1, '장미, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0048459'),
    ('cactus', 1, '선인장, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0028888'),
    ('cactus', 2, 'The Saguaro Cactus, U.S. National Park Service', 'https://www.nps.gov/sagu/learn/nature/saguaro.htm'),
    ('cactus', 3, 'How Saguaros Grow, U.S. National Park Service', 'https://www.nps.gov/sagu/learn/nature/how-saguaros-grow.htm'),
    ('tree', 1, '느티나무, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0013309'),
    ('dandelion', 1, '민들레, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0020094'),
    ('airplane', 1, '비행기, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0025262'),
    ('sportscar', 1, '자동차, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0047885'),
    ('soccerball', 1, '축구, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0057920'),
    ('soccerball', 2, 'The adidas Telstar begins ball chain, FIFA', 'https://inside.fifa.com/news/telstar-story-fifa-world-cup-ball-3073424'),
    ('robot', 1, '로봇, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0074082'),
    ('playground', 1, '놀이터, 『한국민족문화대백과사전』', 'https://encykorea.aks.ac.kr/Article/E0013056')
) AS v (slug, source_order, citation, url)
JOIN creature_profiles p ON p.slug = v.slug
ON CONFLICT DO NOTHING;

-- 색칠하기의 특수 브러쉬와 가격(셀) (migrations/018). slug 는 앱의 무늬 이름(src/lib/drawing/brushPatterns.ts)과 맞춘다.
-- 가격은 임시 값이다. 이미 있는 브러쉬는 건너뛰므로, 가격을 바꾸려면 UPDATE 를 따로 쓴다.
INSERT INTO special_brushes (slug, name, price, brush_order)
VALUES
    ('wave', '물결', 100, 1),
    ('hearts', '하트', 100, 2),
    ('stars', '별', 100, 3),
    ('rainbow', '무지개', 100, 4),
    ('leaf', '나뭇잎', 100, 5),
    ('flower', '꽃', 100, 6),
    ('clouds', '구름', 100, 7),
    ('strawberries', '딸기', 100, 8),
    ('butterflies', '나비', 100, 9),
    ('rose', '장미', 100, 10)
ON CONFLICT DO NOTHING;

-- 번호를 직접 넣었으므로, 다음에 자동으로 붙일 번호를 가장 큰 번호 뒤로 맞춘다.
SELECT setval(pg_get_serial_sequence('chapters', 'chapter_id'), (SELECT MAX(chapter_id) FROM chapters));
SELECT setval(pg_get_serial_sequence('drawings', 'drawing_id'), (SELECT MAX(drawing_id) FROM drawings));

COMMIT;
