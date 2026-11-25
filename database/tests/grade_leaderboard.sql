-- Run with psql -X -v ON_ERROR_STOP=1 -f database/tests/grade_leaderboard.sql
-- Use a disposable test DB with migrations through 025. Rows are rolled back; sequences may advance.
BEGIN;

DO $test$
DECLARE
    suffix text := txid_current()::text;
    fixture_chapter bigint;
    drawing_a bigint;
    drawing_b bigint;
    a bigint;
    b bigint;
    c bigint;
    d bigint;
    e bigint;
    other_grade bigint;
    ungraded bigint;
    best_a bigint;
    new_best_b bigint;
    test_grade integer;
    rejected_constraint text;
    result_ids bigint[];
    result_ranks bigint[];
    earlier timestamptz := TIMESTAMPTZ '2026-01-01 12:00:00+00';
    later timestamptz := TIMESTAMPTZ '2026-01-02 12:00:00+00';
BEGIN
    INSERT INTO users (nickname) VALUES ('grade_a_' || suffix) RETURNING user_id INTO a;
    FOR test_grade IN 1..9 LOOP
        UPDATE users SET grade = test_grade WHERE user_id = a;
        IF (SELECT grade FROM users WHERE user_id = a) IS DISTINCT FROM test_grade THEN
            RAISE EXCEPTION 'Allowed grade % did not round-trip', test_grade;
        END IF;
    END LOOP;
    FOREACH test_grade IN ARRAY ARRAY[0, -1, 10, 32767] LOOP
        BEGIN
            UPDATE users SET grade = test_grade WHERE user_id = a;
            RAISE EXCEPTION 'Invalid grade % was accepted', test_grade;
        EXCEPTION WHEN check_violation THEN
            GET STACKED DIAGNOSTICS rejected_constraint = CONSTRAINT_NAME;
            IF rejected_constraint IS DISTINCT FROM 'chk_users_grade' THEN
                RAISE;
            END IF;
        END;
    END LOOP;
    UPDATE users SET grade = NULL WHERE user_id = a;
    IF (SELECT grade FROM users WHERE user_id = a) IS NOT NULL THEN
        RAISE EXCEPTION 'Explicit NULL grade did not round-trip';
    END IF;
    UPDATE users SET grade = 2 WHERE user_id = a;
    INSERT INTO users (nickname, grade) VALUES ('grade_b_' || suffix, 2) RETURNING user_id INTO b;
    INSERT INTO users (nickname, grade) VALUES ('grade_c_' || suffix, 2) RETURNING user_id INTO c;
    INSERT INTO users (nickname, grade) VALUES ('grade_d_' || suffix, 2) RETURNING user_id INTO d;
    INSERT INTO users (nickname, grade) VALUES ('grade_e_' || suffix, 2) RETURNING user_id INTO e;
    INSERT INTO users (nickname, grade) VALUES ('grade_other_' || suffix, 7) RETURNING user_id INTO other_grade;
    INSERT INTO users (nickname) VALUES ('grade_null_' || suffix) RETURNING user_id INTO ungraded;
    IF (SELECT grade FROM users WHERE user_id = ungraded) IS NOT NULL THEN
        RAISE EXCEPTION 'Omitted grade was not NULL';
    END IF;

    INSERT INTO chapters (title, chapter_order)
    SELECT 'Grade fixture ' || suffix, COALESCE(MAX(chapter_order), 0) + 1 FROM chapters
    RETURNING chapter_id INTO fixture_chapter;
    INSERT INTO drawings (chapter_id, title, reference_image_key, drawing_order)
    VALUES (fixture_chapter, 'Grade A', 'grade-fixture/a', 1) RETURNING drawing_id INTO drawing_a;
    INSERT INTO drawings (chapter_id, title, reference_image_key, drawing_order)
    VALUES (fixture_chapter, 'Grade B', 'grade-fixture/b', 2) RETURNING drawing_id INTO drawing_b;

    -- Insert worse ties first so a later ordering key cannot mask an earlier one.
    INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms, played_at)
    VALUES (a, drawing_a, 94, 1, earlier),
           (a, drawing_a, 95, 1400, earlier),
           (a, drawing_a, 95, 1000, later),
           (e, drawing_a, 94, 1, earlier),
           (d, drawing_a, 95, 1400, earlier),
           (c, drawing_a, 95, 1000, later);

    INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms, played_at)
    VALUES (a, drawing_a, 95, 1000, earlier) RETURNING record_id INTO best_a;
    INSERT INTO user_artworks (record_id, image_key) VALUES (best_a, 'grade-fixture/best-a.png');

    INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms, played_at)
    VALUES (a, drawing_a, 95, 1000, earlier),
           (b, drawing_a, 95, 1000, earlier),
           (other_grade, drawing_a, 99, 1000, earlier),
           (ungraded, drawing_a, 100, 500, earlier),
           (b, drawing_b, 70, 1000, earlier),
           (a, drawing_b, 80, 1000, earlier);

    SELECT array_agg(user_id ORDER BY grade_ranking), array_agg(grade_ranking ORDER BY grade_ranking)
      INTO result_ids, result_ranks
      FROM v_grade_leaderboard WHERE drawing_id = drawing_a AND grade = 2;
    IF result_ids IS DISTINCT FROM ARRAY[a, b, c, d, e]
       OR result_ranks IS DISTINCT FROM ARRAY[1, 2, 3, 4, 5]::bigint[] THEN
        RAISE EXCEPTION 'Unexpected grade ranking: %, ranks %', result_ids, result_ranks;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM v_grade_leaderboard
        WHERE record_id = best_a AND user_id = a AND drawing_id = drawing_a AND grade = 2
          AND nickname = 'grade_a_' || suffix AND similarity_score = 95 AND duration_ms = 1000
          AND played_at = earlier AND image_key = 'grade-fixture/best-a.png' AND grade_ranking = 1
    ) OR NOT EXISTS (
        SELECT 1 FROM v_grade_leaderboard WHERE drawing_id = drawing_a AND user_id = b AND image_key IS NULL
    ) THEN
        RAISE EXCEPTION 'Best-attempt selection, nickname or optional artwork join failed';
    END IF;
    IF (SELECT array_agg(user_id ORDER BY grade_ranking) FROM v_grade_leaderboard
        WHERE drawing_id = drawing_b AND grade = 2) IS DISTINCT FROM ARRAY[a, b]
       OR (SELECT grade_ranking FROM v_grade_leaderboard
           WHERE drawing_id = drawing_b AND user_id = a) IS DISTINCT FROM 1::bigint
       OR (SELECT grade_ranking FROM v_grade_leaderboard
           WHERE drawing_id = drawing_a AND user_id = other_grade AND grade = 7) IS DISTINCT FROM 1::bigint
       OR EXISTS (SELECT 1 FROM v_grade_leaderboard WHERE user_id = ungraded) THEN
        RAISE EXCEPTION 'Grade/drawing partitions or NULL exclusion failed';
    END IF;

    UPDATE users SET grade = 7, nickname = 'grade_moved_' || suffix WHERE user_id = a;
    IF NOT EXISTS (
        SELECT 1 FROM v_grade_leaderboard WHERE record_id = best_a
          AND grade = 7 AND grade_ranking = 2 AND nickname = 'grade_moved_' || suffix
    ) OR (SELECT grade_ranking FROM v_grade_leaderboard
          WHERE drawing_id = drawing_a AND grade = 2 AND user_id = b) IS DISTINCT FROM 1::bigint
       OR EXISTS (SELECT 1 FROM v_grade_leaderboard WHERE grade = 2 AND user_id = a) THEN
        RAISE EXCEPTION 'Grade change did not refresh both partitions';
    END IF;
    UPDATE users SET grade = NULL WHERE user_id = a;
    IF EXISTS (SELECT 1 FROM v_grade_leaderboard WHERE user_id = a) THEN
        RAISE EXCEPTION 'Clearing grade did not remove old ranking rows';
    END IF;

    INSERT INTO play_records (user_id, drawing_id, similarity_score, duration_ms, played_at)
    VALUES (b, drawing_a, 98, 1200, later) RETURNING record_id INTO new_best_b;
    IF (SELECT record_id FROM v_grade_leaderboard
        WHERE drawing_id = drawing_a AND grade = 2 AND grade_ranking = 1) IS DISTINCT FROM new_best_b THEN
        RAISE EXCEPTION 'A new attempt did not refresh the selected record';
    END IF;

    RAISE NOTICE 'Grade constraint, partitions, all tie-breakers, live updates and artwork join passed';
END;
$test$;

ROLLBACK;
