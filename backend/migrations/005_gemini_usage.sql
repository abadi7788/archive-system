-- Request budgets for database-managed, personal and legacy environment Gemini keys.
-- Safe for existing deployments. Startup create_all also creates this new table.
BEGIN;
CREATE TABLE IF NOT EXISTS gemini_usage (
    fingerprint VARCHAR(64) PRIMARY KEY,
    usage_day DATE NOT NULL,
    requests_used INTEGER NOT NULL DEFAULT 0,
    daily_limit INTEGER NOT NULL DEFAULT 1500,
    quota_exhausted BOOLEAN NOT NULL DEFAULT FALSE,
    provider_disabled BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_created ON audit_logs (actor_id, created_at DESC);
COMMIT;
