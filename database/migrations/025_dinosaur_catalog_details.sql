BEGIN;

-- 국립중앙과학관 공룡과학관 자료를 아이 눈높이로 다시 쓴 공룡 도감 상세 정보.
-- 원문은 2015년 감수 자료이므로 행동·기능에 관한 내용은 단정하지 않고 관찰 가능한 특징을 중심으로 쓴다.
UPDATE creature_profiles p
SET summary = v.summary
FROM (VALUES
    ('iguanodon', '엄지손가락에 뾰족한 가시가 있고 두 발과 네 발을 모두 사용했던 초식 공룡이에요.'),
    ('stegosaurus', '등에 커다란 골판이 줄지어 있고 꼬리 끝에 긴 가시가 있는 초식 공룡이에요.'),
    ('triceratops', '얼굴에 세 개의 뿔과 커다란 목 방패가 있는 튼튼한 초식 공룡이에요.'),
    ('tyrannosaurus', '커다란 머리와 강한 턱, 튼튼한 뒷다리를 가진 대형 육식 공룡이에요.'),
    ('brachiosaurus', '앞다리가 뒷다리보다 길고 목을 높이 뻗은 거대한 초식 공룡이에요.'),
    ('ankylosaurus', '온몸을 단단한 골편으로 보호하고 꼬리 끝에 커다란 곤봉이 있는 초식 공룡이에요.'),
    ('parasaurolophus', '머리 뒤로 길게 뻗은 속이 빈 볏과 오리주둥이 같은 입이 특징인 초식 공룡이에요.'),
    ('velociraptor', '작고 날렵한 몸과 뒷발의 낫 모양 발톱이 특징인 육식 공룡이에요.'),
    ('spinosaurus', '등에 돛처럼 솟은 돌기와 악어처럼 길고 납작한 주둥이가 있는 대형 육식 공룡이에요.'),
    ('pachycephalosaurus', '머리 위의 두껍고 둥근 돔과 머리 주변의 작은 돌기가 특징인 초식 공룡이에요.')
) AS v (slug, summary)
WHERE p.slug = v.slug;

DELETE FROM creature_facts f
USING creature_profiles p
WHERE f.drawing_id = p.drawing_id
  AND p.slug IN ('iguanodon', 'stegosaurus', 'triceratops', 'tyrannosaurus', 'brachiosaurus', 'ankylosaurus', 'parasaurolophus', 'velociraptor', 'spinosaurus', 'pachycephalosaurus');

INSERT INTO creature_facts (drawing_id, fact_order, label, content)
SELECT p.drawing_id, v.fact_order, v.label, v.content
FROM (VALUES
    ('iguanodon', 1, '분류', '조각류 · 초식 공룡'),
    ('iguanodon', 2, '시대', '전기 백악기 · 약 1억 2,600만~1억 2,500만 년 전'),
    ('iguanodon', 3, '크기', '길이 6~10m · 무게 1~3톤'),
    ('iguanodon', 4, '발견 지역', '영국, 벨기에, 독일, 스페인, 미국, 몽골'),
    ('iguanodon', 5, '특징', '앞발 엄지에 뾰족한 가시가 있고 두 발과 네 발을 모두 사용했어요'),
    ('stegosaurus', 1, '분류', '검룡류 · 초식 공룡'),
    ('stegosaurus', 2, '시대', '후기 쥐라기 · 약 1억 5,500만~1억 5,000만 년 전'),
    ('stegosaurus', 3, '크기', '길이 약 9m · 무게 2~5톤'),
    ('stegosaurus', 4, '발견 지역', '미국, 포르투갈'),
    ('stegosaurus', 5, '특징', '등에 커다란 골판이 줄지어 있고 꼬리 끝에 긴 가시 네 개가 있어요'),
    ('triceratops', 1, '분류', '각룡류 · 초식 공룡'),
    ('triceratops', 2, '시대', '후기 백악기 · 약 6,800만~6,500만 년 전'),
    ('triceratops', 3, '크기', '길이 7.9~9m · 무게 6~12톤'),
    ('triceratops', 4, '발견 지역', '미국, 캐나다'),
    ('triceratops', 5, '특징', '코 위에 짧은 뿔 하나, 눈 위에 긴 뿔 두 개와 넓은 목 방패가 있어요'),
    ('tyrannosaurus', 1, '분류', '수각류 · 육식 공룡'),
    ('tyrannosaurus', 2, '시대', '후기 백악기 · 약 6,700만~6,500만 년 전'),
    ('tyrannosaurus', 3, '크기', '길이 10~13m · 무게 5.4~6.8톤'),
    ('tyrannosaurus', 4, '발견 지역', '미국, 캐나다'),
    ('tyrannosaurus', 5, '특징', '커다란 머리와 강한 턱, 튼튼한 뒷다리와 긴 꼬리를 가졌어요'),
    ('brachiosaurus', 1, '분류', '용각류 · 초식 공룡'),
    ('brachiosaurus', 2, '시대', '후기 쥐라기 · 약 1억 5,400만~1억 5,300만 년 전'),
    ('brachiosaurus', 3, '크기', '길이 25~28m · 무게 25~29톤'),
    ('brachiosaurus', 4, '발견 지역', '미국 콜로라도, 유타, 오클라호마'),
    ('brachiosaurus', 5, '특징', '앞다리가 뒷다리보다 길고 목을 높이 뻗은 거대한 공룡이에요'),
    ('ankylosaurus', 1, '분류', '곡룡류 · 초식 공룡'),
    ('ankylosaurus', 2, '시대', '후기 백악기 · 약 6,650만~6,600만 년 전'),
    ('ankylosaurus', 3, '크기', '길이 8~11m · 무게 약 6톤'),
    ('ankylosaurus', 4, '발견 지역', '미국, 캐나다'),
    ('ankylosaurus', 5, '특징', '낮고 넓은 몸을 골편으로 보호하고 꼬리 끝에 커다란 곤봉이 있어요'),
    ('parasaurolophus', 1, '분류', '조각류 · 초식 공룡'),
    ('parasaurolophus', 2, '시대', '후기 백악기 · 약 7,650만~7,300만 년 전'),
    ('parasaurolophus', 3, '크기', '길이 9~10m · 무게 약 2.5톤'),
    ('parasaurolophus', 4, '발견 지역', '캐나다, 미국'),
    ('parasaurolophus', 5, '특징', '머리 뒤로 길게 뻗은 속이 빈 볏과 오리주둥이 같은 입이 있어요'),
    ('velociraptor', 1, '분류', '수각류 · 육식 공룡'),
    ('velociraptor', 2, '시대', '후기 백악기 · 약 7,500만~7,100만 년 전'),
    ('velociraptor', 3, '크기', '길이 1.5~2m · 무게 10~15kg'),
    ('velociraptor', 4, '발견 지역', '몽골, 중국'),
    ('velociraptor', 5, '특징', '잘 발달된 뒷다리와 긴 꼬리, 뒷발의 낫 모양 발톱이 있어요'),
    ('spinosaurus', 1, '분류', '수각류 · 육식 공룡'),
    ('spinosaurus', 2, '시대', '백악기 · 약 1억 1,200만~9,700만 년 전'),
    ('spinosaurus', 3, '크기', '길이 12~17m · 무게 12~20톤'),
    ('spinosaurus', 4, '발견 지역', '이집트, 모로코 등 북아프리카'),
    ('spinosaurus', 5, '특징', '등에 돛처럼 솟은 돌기와 악어처럼 길고 납작한 주둥이가 있어요'),
    ('pachycephalosaurus', 1, '분류', '후두류 · 초식 공룡'),
    ('pachycephalosaurus', 2, '시대', '후기 백악기 · 약 7,000만~6,600만 년 전'),
    ('pachycephalosaurus', 3, '크기', '길이 약 4.5m · 무게 약 450kg'),
    ('pachycephalosaurus', 4, '발견 지역', '미국 서부, 캐나다'),
    ('pachycephalosaurus', 5, '특징', '머리 위에 두꺼운 둥근 돔과 그 둘레를 감싼 작은 돌기가 있어요')
) AS v (slug, fact_order, label, content)
JOIN creature_profiles p ON p.slug = v.slug;

DELETE FROM creature_tips t
USING creature_profiles p
WHERE t.drawing_id = p.drawing_id
  AND p.slug IN ('iguanodon', 'stegosaurus', 'triceratops', 'tyrannosaurus', 'brachiosaurus', 'ankylosaurus', 'parasaurolophus', 'velociraptor', 'spinosaurus', 'pachycephalosaurus');

INSERT INTO creature_tips (drawing_id, tip_order, content)
SELECT p.drawing_id, v.tip_order, v.content
FROM (VALUES
    ('iguanodon', 1, '앞발 엄지의 뾰족한 가시를 표현해요.'),
    ('iguanodon', 2, '긴 꼬리가 몸의 균형을 잡는 모습을 살펴봐요.'),
    ('stegosaurus', 1, '목부터 꼬리까지 이어지는 골판의 크기 변화를 표현해요.'),
    ('stegosaurus', 2, '꼬리 끝에 있는 네 개의 긴 가시를 빠뜨리지 않아요.'),
    ('triceratops', 1, '세 개의 뿔과 넓은 목 방패를 먼저 그려요.'),
    ('triceratops', 2, '무거운 몸을 받치는 네 다리를 굵고 튼튼하게 표현해요.'),
    ('tyrannosaurus', 1, '커다란 머리와 이빨이 보이는 강한 턱을 표현해요.'),
    ('tyrannosaurus', 2, '굵은 뒷다리와 균형을 잡는 긴 꼬리를 그려요.'),
    ('brachiosaurus', 1, '앞다리를 뒷다리보다 길게 그려요.'),
    ('brachiosaurus', 2, '긴 목에서 등으로 이어지는 높고 완만한 곡선을 표현해요.'),
    ('ankylosaurus', 1, '머리부터 꼬리까지 이어지는 갑옷 같은 골편을 그려요.'),
    ('ankylosaurus', 2, '꼬리 끝의 둥글고 커다란 곤봉을 강조해요.'),
    ('parasaurolophus', 1, '머리 뒤로 길고 부드럽게 뻗은 볏을 표현해요.'),
    ('parasaurolophus', 2, '납작한 오리주둥이와 굵은 뒷다리를 살펴봐요.'),
    ('velociraptor', 1, '뒷발 두 번째 발가락의 낫 모양 발톱을 강조해요.'),
    ('velociraptor', 2, '달릴 때 균형을 잡는 길고 곧은 꼬리를 그려요.'),
    ('spinosaurus', 1, '등에 크게 솟은 돛 모양을 먼저 그려요.'),
    ('spinosaurus', 2, '악어처럼 길고 납작한 주둥이와 날카로운 이빨을 표현해요.'),
    ('pachycephalosaurus', 1, '머리 위의 크고 둥근 돔을 강조해요.'),
    ('pachycephalosaurus', 2, '돔 주변의 작은 돌기와 길고 뾰족한 주둥이를 표현해요.')
) AS v (slug, tip_order, content)
JOIN creature_profiles p ON p.slug = v.slug;

DELETE FROM creature_sources s
USING creature_profiles p
WHERE s.drawing_id = p.drawing_id
  AND p.slug IN ('iguanodon', 'stegosaurus', 'triceratops', 'tyrannosaurus', 'brachiosaurus', 'ankylosaurus', 'parasaurolophus', 'velociraptor', 'spinosaurus', 'pachycephalosaurus');

INSERT INTO creature_sources (drawing_id, source_order, citation, url)
SELECT p.drawing_id, v.source_order, v.citation, v.url
FROM (VALUES
    ('iguanodon', 1, '이구아노돈, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=17'),
    ('stegosaurus', 1, '스테고사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=5'),
    ('triceratops', 1, '트리케라톱스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=12'),
    ('tyrannosaurus', 1, '티라노사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=38'),
    ('brachiosaurus', 1, '브라키오사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=26'),
    ('ankylosaurus', 1, '안킬로사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=3'),
    ('parasaurolophus', 1, '파라사우롤로푸스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=97'),
    ('velociraptor', 1, '벨로키랍토르, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=45'),
    ('spinosaurus', 1, '스피노사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=61'),
    ('pachycephalosaurus', 1, '파키케팔로사우루스, 국립중앙과학관 공룡과학관', 'https://www.science.go.kr/mps/scienceSubject/dinosaur/view.do?subjectSid=6')
) AS v (slug, source_order, citation, url)
JOIN creature_profiles p ON p.slug = v.slug;

COMMIT;
