BEGIN;

-- 색칠하기의 특수 브러쉬(무늬 브러쉬)와 그 구매.
-- 특수 브러쉬는 재화 '셀'로 사는 것이라, 누가 어떤 브러쉬를 샀는지를 DB에 둔다.
--   users.cells       사용자가 가진 셀 (사용자당 값 하나라 표를 따로 두지 않고 칸으로)
--   special_brushes   살 수 있는 브러쉬와 가격
--   user_brushes      산 브러쉬 (users N : M special_brushes)
-- 일반 색 브러쉬(빨·주·노·초 …)는 누구나 쓰는 색 값이라 표로 두지 않는다 (앱 상수).

ALTER TABLE users
    ADD COLUMN cells INTEGER NOT NULL DEFAULT 0;

-- 셀은 음수가 될 수 없다 (가진 것보다 비싼 브러쉬는 살 수 없음)
ALTER TABLE users
    ADD CONSTRAINT chk_users_cells
        CHECK (cells >= 0);

-- 무늬를 그리는 방법은 앱이 slug 로 찾는다 (src/lib/drawing/brushPatterns.ts). 목록은 seeds/content.sql 이 넣는다.
CREATE TABLE special_brushes (
    brush_id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- 앱이 무늬를 찾는 이름 (예: wave, hearts)
    slug VARCHAR(20) NOT NULL UNIQUE,
    -- 화면에 보이는 이름 (예: 물결, 하트)
    name VARCHAR(20) NOT NULL,
    -- 가격 (셀)
    price INTEGER NOT NULL,
    -- 브러쉬 목록에서의 순서
    brush_order SMALLINT NOT NULL UNIQUE,
    CONSTRAINT chk_special_brush_slug
        CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT chk_special_brush_name
        CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT chk_special_brush_price
        CHECK (price >= 0),
    CONSTRAINT chk_special_brush_order
        CHECK (brush_order > 0)
);

-- 사용자가 산 특수 브러쉬. 행이 있으면 쓸 수 있다. 같은 브러쉬는 한 번만 산다 (기본 키).
-- 팔린 브러쉬는 지울 수 없게 막는다 (RESTRICT): 산 사람의 브러쉬가 사라지지 않도록.
CREATE TABLE user_brushes (
    user_id BIGINT NOT NULL
        REFERENCES users(user_id) ON DELETE CASCADE,
    brush_id SMALLINT NOT NULL
        REFERENCES special_brushes(brush_id) ON DELETE RESTRICT,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, brush_id)
);

COMMIT;
