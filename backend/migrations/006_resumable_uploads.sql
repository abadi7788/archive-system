-- Automatically mirrored by Base.metadata.create_all + startup ALTERs. Idempotent.
BEGIN;
ALTER TABLE documents ALTER COLUMN file_size TYPE BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_item_size INTEGER NOT NULL DEFAULT 160;
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(250) NOT NULL,
    file_size BIGINT NOT NULL,
    received BIGINT NOT NULL DEFAULT 0,
    stored_bytes BIGINT NOT NULL DEFAULT 24,
    chunks INTEGER NOT NULL DEFAULT 0,
    last_digest VARCHAR(64), last_offset BIGINT,
    options JSONB NOT NULL DEFAULT '{}',
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS ix_upload_sessions_expires_at ON upload_sessions(expires_at);
COMMIT;
