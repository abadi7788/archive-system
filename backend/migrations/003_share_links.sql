CREATE TABLE IF NOT EXISTS share_links (
 id UUID PRIMARY KEY,
 document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
 created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT TRUE,
 failed_attempts INTEGER NOT NULL DEFAULT 0,
 locked_until TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_share_links_document_id ON share_links(document_id);
CREATE INDEX IF NOT EXISTS ix_share_links_created_by ON share_links(created_by);
CREATE INDEX IF NOT EXISTS ix_share_links_expires_at ON share_links(expires_at);
