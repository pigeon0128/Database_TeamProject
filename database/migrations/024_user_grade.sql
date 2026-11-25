BEGIN;

-- NULL은 미설정 상태다. 1~6은 초등학교, 7~9는 중학교 1~3학년이다.
ALTER TABLE users
    ADD COLUMN grade SMALLINT,
    ADD CONSTRAINT chk_users_grade CHECK (grade BETWEEN 1 AND 9);

COMMIT;
