BEGIN;

-- 기프트샵의 특수 브러쉬 가격을 종류와 상관없이 모두 100셀로 맞춘다.
-- (전에는 무늬 100 / 반짝이 150 / 사이버틱·삼색반짝이 200셀이었다.) 이미 산 기록(user_brushes)과 셀은 그대로 둔다.
-- seeds/content.sql 도 같은 값으로 바꿨다. 시드는 이미 있는 브러쉬를 건너뛰므로 이미 만든 DB는 이 파일로 바꾼다.
UPDATE special_brushes
SET price = 100
WHERE price <> 100;

COMMIT;
