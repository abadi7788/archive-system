-- Rebuild stored search vector so summary/keywords participate in full-text indexing.
DROP INDEX IF EXISTS ix_documents_extracted_text_fts;
ALTER TABLE documents DROP COLUMN IF EXISTS search_vector;
ALTER TABLE documents ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
  to_tsvector('simple', coalesce(extracted_text,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(metadata ->> 'keywords',''))
) STORED;
CREATE INDEX ix_documents_extracted_text_fts ON documents USING GIN(search_vector);
