# Archive-Yemany

Multilingual enterprise archive workspace (Arabic RTL and English, French, Spanish, Turkish, German, Russian, Chinese, Japanese, Hindi, and Urdu): FastAPI + PostgreSQL + async SQLAlchemy, Next.js, OCR/full-text search, encrypted object/file storage, hierarchical roles, and auditable document lifecycle.

## Run locally

1. Copy `.env.example` to `.env` and replace all placeholder/default credentials. Keep `.env` private; never commit it.
2. Run `docker compose up --build` from the repository root. The API is at `http://localhost:8000`, the web app at `http://localhost:3000`.
3. The first startup can create an administrator when `BOOTSTRAP_ADMIN_USERNAME` and `BOOTSTRAP_ADMIN_PASSWORD` are supplied. Production bootstrap passwords must meet the 12-character policy.

The frontend keeps access tokens in tab-scoped `sessionStorage` so language-route changes do not log the user out; it clears them on logout or when the tab's session ends. API requests go through Next.js, avoiding browser-side calls to a device's `localhost`. The Arena development preview uses the requested demo login `admin` / `admin`; this is development-only and must never be used in a deployed environment.

### Run without Docker

Install PostgreSQL and create the database/role specified in `.env`, then run these in separate terminals from the repository root:

```sh
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd backend && set -a && . ../.env && set +a
../.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log
```

```sh
cd frontend
npm ci
BACKEND_INTERNAL_URL=http://127.0.0.1:8000 npm run dev
```

Node.js 22+ is used by the frontend container; Next.js 16 and React 19 are pinned by the lockfile. The current dependency audit reports no known npm vulnerabilities.

## Database migrations

Fresh databases are created from the SQLAlchemy model metadata at startup. For existing databases, apply reviewed SQL migrations in order:

```sh
set -a && . ./.env && set +a
export PGPASSWORD="$POSTGRES_PASSWORD"
for migration in backend/migrations/001_archive_features.sql backend/migrations/002_fts_metadata.sql backend/migrations/003_share_links.sql; do
  psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f "$migration"
done
unset PGPASSWORD
```

Back up the database before running migrations. `create_all` does not alter existing tables.

## Implemented capabilities

- Roles: `admin`, `archiver`, `viewer` (legacy `employee` remains accepted for existing rows).
- Upload for PDF and supported raster image types; encrypted at rest with the Fernet key; OCR output includes extracted text, summary, classification, keywords and structured metadata.
- Per-user Gemini key first, then configured system keys in priority order on quota/rate-limit failure. With all keys exhausted the document remains queued.
- Full-text search over extracted text, summary and keyword metadata; department/type/classification/folder/keyword/date filters.
- Folder ownership and admin-managed read/write grants; viewer accounts cannot upload, edit or delete.
- Admin user lifecycle (create, edit username/department/role, deactivate/reactivate), document lifecycle audit records, and step-up protected storage metrics.
- PDF and image in-browser previews with selectable/copyable OCR text; Gemini Q&A is grounded in the selected document's extracted text.
- Selectable search-result exports to XLSX/PDF; password-protected share links with expiry and failed-attempt lockout. New share tokens are delivered in the URL fragment, removed from browser history on load, and excluded from Uvicorn access logs.
- Step-up authenticated ZIP backup of the PostgreSQL dump plus **all** storage objects (including unreferenced objects). ZIP members are Fernet-encrypted with `MASTER_ENCRYPTION_KEY`; keep that key separately and securely for recovery. Interactive backups are capped at 2 GiB, and the container includes `pg_dump`.
- No-store response headers; access tokens stay in memory, and document previews use temporary in-memory object URLs that are revoked when closed.

## Operational notes

- Set real Google Gemini API keys in deployment secrets. OCR has not been validated against your provider credentials until an authenticated document request succeeds.
- The API currently processes OCR inline during upload. Quota-exhausted documents are marked queued, but a persistent worker/retry scheduler and admin notification delivery must be configured separately for automated retries.
- Storage provider selection is process-local; migrating providers requires copying encrypted objects while preserving IDs and key configuration. Backups are on-demand (not scheduled); cloud replication is not enabled.
- Use TLS, a secret manager, strong non-default credentials, reviewed database migrations, backups, rate limiting and an external audit-log retention policy before production.
