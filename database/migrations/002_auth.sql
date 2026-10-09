
-- 로그인용 비밀번호 추가.
-- users.nickname 을 로그인 아이디로 사용하고, 비밀번호는 scrypt 해시로만 저장한다.
-- 기존(시드) 사용자는 비밀번호가 없으므로 NULL 을 허용하며, 비밀번호가 없는 계정은 로그인할 수 없다.

BEGIN;

ALTER TABLE users
    ADD COLUMN password_hash TEXT;

COMMIT;
