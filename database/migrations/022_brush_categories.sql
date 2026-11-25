BEGIN;

-- 기프트샵에서 특수 브러쉬를 종류(폴더)별로 나눠 판다: 무늬 / 반짝이 / 사이버틱 / 삼색반짝이.
-- 이미 있던 10개(물결·하트·별 …)는 모두 무늬다. 산 기록(user_brushes)은 그대로 둔다.
-- 브러쉬 목록 자체는 seeds/content.sql 이 넣는다.
ALTER TABLE special_brushes
    ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'pattern';

-- 기존 행을 채운 뒤에는 새 브러쉬마다 종류를 꼭 적게 한다
ALTER TABLE special_brushes
    ALTER COLUMN category DROP DEFAULT;

ALTER TABLE special_brushes
    ADD CONSTRAINT chk_special_brush_category
        CHECK (category IN ('pattern', 'glitter', 'cyber', 'tricolor'));

COMMIT;
