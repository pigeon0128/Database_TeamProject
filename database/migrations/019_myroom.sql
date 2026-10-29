BEGIN;

-- Policy A: layout contains drawing IDs, never an expiring artwork image_key.
CREATE TABLE user_myrooms (
    user_id BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    schema_version SMALLINT NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    layout JSONB NOT NULL DEFAULT '{"objects":[]}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_myroom_objects CHECK (
        jsonb_typeof(layout) = 'object' AND layout ? 'objects' AND jsonb_typeof(layout->'objects') = 'array'
        AND jsonb_array_length(layout->'objects') <= 40
    )
);

COMMIT;
