-- PostgreSQL migration for hierarchical roles, folders, document metadata and audit.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'archiver';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(160);
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY, name VARCHAR(180) NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  path VARCHAR(1024) NOT NULL DEFAULT '/', metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS ix_folders_owner_id ON folders(owner_id);
CREATE TABLE IF NOT EXISTS folder_grants (
  id UUID PRIMARY KEY, folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL DEFAULT 'read', metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT uq_folder_user_grant UNIQUE(folder_id,user_id)
);
CREATE INDEX IF NOT EXISTS ix_folder_grants_folder_id ON folder_grants(folder_id);
CREATE INDEX IF NOT EXISTS ix_folder_grants_user_id ON folder_grants(user_id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS department VARCHAR(160);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS classification VARCHAR(120);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS keywords JSONB NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS ix_documents_folder_id ON documents(folder_id);
CREATE INDEX IF NOT EXISTS ix_documents_department ON documents(department);
CREATE INDEX IF NOT EXISTS ix_documents_classification ON documents(classification);
CREATE TABLE IF NOT EXISTS audit_logs (
 id UUID PRIMARY KEY, actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
 action VARCHAR(80) NOT NULL, resource_type VARCHAR(80) NOT NULL, resource_id VARCHAR(80),
 detail JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address INET, user_agent TEXT,
 metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
