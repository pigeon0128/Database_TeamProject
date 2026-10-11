BEGIN;

-- 사용자가 바꾼 그리기 단축키 (설정 및 방법 화면)
-- 바꾼 동작만 {"동작": "키 조합"} 으로 저장한다. 예: {"brush": "KeyP", "undo": "Ctrl+KeyU"}
-- 없는 동작은 앱의 기본 키(src/lib/shortcuts.ts 의 DEFAULT_SHORTCUTS)를 쓴다.
-- 동작 이름과 키 조합 형식은 앱이 정하므로, DB는 JSON 객체인지만 확인한다 (자세한 검사는 server/routes/settings.js).
ALTER TABLE user_settings
    ADD COLUMN shortcuts JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE user_settings
    ADD CONSTRAINT chk_settings_shortcuts_object
        CHECK (jsonb_typeof(shortcuts) = 'object');

COMMIT;
