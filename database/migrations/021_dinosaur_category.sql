BEGIN;

-- 공룡을 일반 동물과 구분해 도감에서 별도 묶음으로 보여 준다.
ALTER TABLE creature_profiles
    DROP CONSTRAINT IF EXISTS chk_creature_category;

ALTER TABLE creature_profiles
    ADD CONSTRAINT chk_creature_category
        CHECK (category IN ('animal', 'plant', 'dinosaur', 'object'));

COMMIT;
