BEGIN;

-- 생물 도감의 무생물에서 대관람차(그림 16번)를 빼고 놀이터(그림 17번)를 넣는다.
-- 놀이터 그림과 도감 정보는 바로 뒤에 seeds/content.sql 이 넣는다 (pnpm db:migrate 는 마이그레이션 뒤에 content.sql 을 매번 실행한다).
-- 여기서는 이미 대관람차가 들어 있는 DB에서 대관람차와 그 그림에 딸린 행을 지운다.
-- 빈 DB에서는 지울 행이 없다. 번호와 이름이 둘 다 맞을 때만 지운다 (seeds/content.sql 과 같은 규칙).

-- 그리던 그림 (키: story:<장면 id>, src/data/creatures.ts 의 creature-<slug>)
DELETE FROM drawing_drafts
WHERE draft_key = 'story:creature-ferriswheel';

-- 기록과 완성 그림 (user_artworks 는 기록을 지우면 함께 지워진다: ON DELETE CASCADE).
-- 완성 그림 파일(uploads/)은 pnpm db:migrate 가 이 파일을 실행한 뒤에 지운다 (scripts/db-migrate.js).
DELETE FROM play_records
WHERE drawing_id = 16
  AND EXISTS (SELECT 1 FROM drawings d WHERE d.drawing_id = 16 AND d.title = '대관람차');

-- 그림 (도감 정보 creature_profiles·facts·tips·sources 는 함께 지워진다: ON DELETE CASCADE)
DELETE FROM drawings
WHERE drawing_id = 16
  AND title = '대관람차';

COMMIT;
