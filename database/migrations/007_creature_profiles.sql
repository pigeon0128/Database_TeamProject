BEGIN;

-- 8. 도감 생물 정보
-- 도감 생물도 하나의 그림(drawings 한 행)이다: 이름은 drawings.title, 챕터는 '생물 도감'.
-- 그래서 기록·완성 그림·리더보드·도감 수집 현황(queries/collection.sql)을 스토리 장면과 같은 표로 처리한다.
-- 이 표들은 그림에 붙는 도감 설명만 담는다 (drawings 1 : 0..1 creature_profiles 1 : N facts/tips).
CREATE TABLE creature_profiles (
    drawing_id BIGINT PRIMARY KEY
        REFERENCES drawings(drawing_id) ON DELETE CASCADE,
    -- 앱 주소(#/creatures/<slug>)와 밑그림 파일 이름 (src/data/creatures.ts)
    slug VARCHAR(40) NOT NULL UNIQUE,
    -- 동물 / 식물 / 무생물
    category VARCHAR(10) NOT NULL,
    -- 도감 카드에 보여 줄 한 줄 소개
    summary TEXT NOT NULL,
    CONSTRAINT chk_creature_category
        CHECK (category IN ('animal', 'plant', 'object')),
    CONSTRAINT chk_creature_slug
        CHECK (slug ~ '^[a-z0-9-]+$')
);

-- 도감 정보 항목 (분류, 사는 곳, 먹이, 크기 등). 생물마다 항목이 달라서 (이름, 내용) 행으로 둔다.
CREATE TABLE creature_facts (
    drawing_id BIGINT NOT NULL
        REFERENCES creature_profiles(drawing_id) ON DELETE CASCADE,
    fact_order SMALLINT NOT NULL,
    label VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (drawing_id, fact_order),
    CONSTRAINT chk_creature_fact_order
        CHECK (fact_order > 0)
);

-- 그릴 때 살펴볼 점 (그리기 화면 옆 도감 카드에 보여 준다)
CREATE TABLE creature_tips (
    drawing_id BIGINT NOT NULL
        REFERENCES creature_profiles(drawing_id) ON DELETE CASCADE,
    tip_order SMALLINT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (drawing_id, tip_order),
    CONSTRAINT chk_creature_tip_order
        CHECK (tip_order > 0)
);

COMMIT;
