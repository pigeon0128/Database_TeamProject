-- 앱에 들어 있는 장면(챕터·그림) 목록. 기록 저장과 리더보드가 drawing_id 로 장면을 찾으므로 꼭 있어야 한다.
-- (src/data/scenes.ts 의 drawingId 와 맞춘다. 장면을 추가하면 여기에도 한 줄 추가한다)
-- 여러 번 실행해도 된다: 이미 있으면 건너뛴다. pnpm db:migrate 가 마이그레이션 뒤에 매번 실행한다.

BEGIN;

INSERT INTO chapters (chapter_id, title, chapter_order)
OVERRIDING SYSTEM VALUE
VALUES (1, '숲속의 만남', 1)
ON CONFLICT DO NOTHING;

INSERT INTO drawings (drawing_id, chapter_id, title, reference_image_key, drawing_order)
OVERRIDING SYSTEM VALUE
VALUES (1, 1, '숲속의 노래', 'story/forest-guide.webp', 1)
ON CONFLICT DO NOTHING;

-- 번호를 직접 넣었으므로, 다음에 자동으로 붙일 번호를 가장 큰 번호 뒤로 맞춘다.
SELECT setval(pg_get_serial_sequence('chapters', 'chapter_id'), (SELECT MAX(chapter_id) FROM chapters));
SELECT setval(pg_get_serial_sequence('drawings', 'drawing_id'), (SELECT MAX(drawing_id) FROM drawings));

COMMIT;
