-- Idempotent. Startup applies the same changes for existing installations.
ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ;
ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS last_error_code VARCHAR(48);
ALTER TABLE gemini_usage ADD COLUMN IF NOT EXISTS checked_at TIMESTAMPTZ;
UPDATE gemini_usage SET quota_exhausted = FALSE,
    retry_after = NOW() + INTERVAL '60 seconds', last_error_code = 'rate_limited'
WHERE quota_exhausted = TRUE AND last_error_code IS NULL;
