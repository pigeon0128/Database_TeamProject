
BEGIN;

INSERT INTO users (nickname)
VALUES ('user_A'), ('user_B'), ('user_C');

INSERT INTO chapters (title, chapter_order)
VALUES ('숲속의 만남', 1);

INSERT INTO drawings (
    chapter_id, title,
    reference_image_key, drawing_order
)
VALUES (
    1,
    '첫 번째 장면',
    'references/chapter1/scene1.png',
    1
);

INSERT INTO play_records (
    user_id, drawing_id,
    similarity_score, duration_ms
)
VALUES
    (1, 1, 82.50, 65000),
    (1, 1, 96.50, 43200),
    (2, 1, 96.50, 51800),
    (3, 1, 91.20, 38100);

INSERT INTO user_artworks (record_id, image_key)
VALUES
    (1, 'artworks/test/attempt1.png'),
    (2, 'artworks/test/attempt2.png'),
    (3, 'artworks/test/attempt3.png'),
    (4, 'artworks/test/attempt4.png');

COMMIT;
