BEGIN;

-- 기존 데이터베이스에도 새 공룡 7종을 도감 항목으로 추가한다.
INSERT INTO drawings (drawing_id, chapter_id, title, reference_image_key, drawing_order)
OVERRIDING SYSTEM VALUE
VALUES
    (21, 2, '티라노사우루스', 'creatures/dinosaurs/tyrannosaurus-guide.webp', 19),
    (22, 2, '브라키오사우루스', 'creatures/dinosaurs/brachiosaurus-guide.webp', 20),
    (23, 2, '안킬로사우루스', 'creatures/dinosaurs/ankylosaurus-guide.webp', 21),
    (24, 2, '파라사우롤로푸스', 'creatures/dinosaurs/parasaurolophus-guide.webp', 22),
    (25, 2, '벨로시랩터', 'creatures/dinosaurs/velociraptor-guide.webp', 23),
    (26, 2, '스피노사우루스', 'creatures/dinosaurs/spinosaurus-guide.webp', 24),
    (27, 2, '파키케팔로사우루스', 'creatures/dinosaurs/pachycephalosaurus-guide.webp', 25)
ON CONFLICT (drawing_id) DO UPDATE SET
    chapter_id = EXCLUDED.chapter_id,
    title = EXCLUDED.title,
    reference_image_key = EXCLUDED.reference_image_key,
    drawing_order = EXCLUDED.drawing_order;

INSERT INTO creature_profiles (drawing_id, slug, category, summary)
VALUES
    (21, 'tyrannosaurus', 'dinosaur', '튼튼한 뒷다리와 크고 강한 턱을 가진 육식 공룡이에요.'),
    (22, 'brachiosaurus', 'dinosaur', '긴 목을 높이 뻗어 나무의 잎을 먹던 거대한 초식 공룡이에요.'),
    (23, 'ankylosaurus', 'dinosaur', '온몸을 단단한 갑옷처럼 보호하고 꼬리 끝에 곤봉이 있는 초식 공룡이에요.'),
    (24, 'parasaurolophus', 'dinosaur', '머리 뒤로 길게 뻗은 볏이 특징인 초식 공룡이에요.'),
    (25, 'velociraptor', 'dinosaur', '날렵한 몸과 발의 낫 모양 발톱이 특징인 작은 육식 공룡이에요.'),
    (26, 'spinosaurus', 'dinosaur', '등에 돛처럼 솟은 돌기가 있고 긴 주둥이를 가진 육식 공룡이에요.'),
    (27, 'pachycephalosaurus', 'dinosaur', '머리 위의 두껍고 둥근 뼈가 특징인 공룡이에요.')
ON CONFLICT (drawing_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    category = EXCLUDED.category,
    summary = EXCLUDED.summary;

SELECT setval(
    pg_get_serial_sequence('drawings', 'drawing_id'),
    GREATEST((SELECT MAX(drawing_id) FROM drawings), 1),
    true
);

COMMIT;
