export type LocaleCode = 'ar' | 'en' | 'fr' | 'es' | 'tr' | 'de' | 'ru' | 'zh' | 'ja' | 'hi' | 'ur';
export type ThemeMode = 'light' | 'dark';

export type User = {
  id: string;
  username: string;
  full_name?: string | null;
  job_title?: string | null;
  role: string;
  department?: string | null;
  preferred_language?: LocaleCode | null;
  preferred_theme?: ThemeMode;
  is_active?: boolean;
  must_change_password?: boolean;
  can_print?: boolean;
};

export type ArchiveScope = 'all' | 'recent' | 'starred';

export type TaxonomyItem = {
  id: string;
  name: string;
};

export type TaxonomyData = {
  departments: TaxonomyItem[];
  classifications: TaxonomyItem[];
};

export type BulkUploadTask = {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};

export type OwnerSummary = {
  id: string;
  username: string;
  full_name?: string | null;
  job_title?: string | null;
  department?: string | null;
  role?: string;
  display_name: string;
};

export type EmployeeLinkGroup = {
  id: string;
  name: string;
  created_at?: string | null;
  members: OwnerSummary[];
};

export type FolderItem = {
  id: string;
  name: string;
  parent_id?: string | null;
  path?: string;
  owner_id?: string;
  owner_name?: string | null;
  owner_username?: string | null;
  owner_job_title?: string | null;
  can_manage?: boolean;
  item_count?: number;
  subfolder_count?: number;
  updated_at?: string | null;
  deleted_at?: string | null;
  deleted_by_name?: string | null;
};

export type DocItem = {
  id: string;
  file_name: string;
  summary?: string | null;
  snippet?: string | null;
  extracted_text?: string | null;
  status?: string;
  classification?: string | null;
  department?: string | null;
  keywords?: string[];
  mime_type?: string;
  file_size?: number;
  folder_id?: string | null;
  folder_breadcrumb?: string | null;
  folder_path?: string | null;
  owner_id?: string;
  owner_name?: string | null;
  owner_username?: string | null;
  owner_job_title?: string | null;
  can_manage?: boolean;
  is_starred?: boolean;
  created_at?: string;
  deleted_at?: string | null;
  deleted_by_name?: string | null;
};

export type TrashData = {
  folders: FolderItem[];
  documents: DocItem[];
  total_count: number;
};

export type ArchiveFilters = {
  department: string;
  mime_type: string;
  classification: string;
  keyword: string;
  owner_id: string;
  from_date: string;
  to_date: string;
};

export type SystemSummary = {
  provider: string;
  total_documents: number;
  indexed_documents: number;
  pending_documents: number;
  stored_file_bytes: number;
  disk_capacity_bytes?: number | null;
  disk_free_bytes?: number | null;
  user_count: number;
  gemini_configured: boolean;
  gemini_model: string;
};

export type GeminiSettings = {
  has_db_key: boolean;
  masked_key?: string | null;
  is_enabled: boolean;
  env_fallback_configured: boolean;
  effective_configured: boolean;
  model: string;
};

export type StorageMetrics = {
  provider: string;
  saved_files: number;
  stored_file_bytes: number;
  disk_capacity_bytes?: number | null;
  disk_free_bytes?: number | null;
  connection_ok: boolean;
};

export type AuditItem = {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  detail?: Record<string, unknown>;
  created_at: string;
};

export type ToastItem = {
  id: string;
  type: 'ok' | 'err' | 'info';
  text: string;
};

export function formatBytes(n?: number | null): string {
  const bytes = Number(n || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function pad2(num: number): string {
  return num < 10 ? `0${num}` : String(num);
}

/** Standard ISO YYYY-MM-DD using Western digits 0-9 across all languages. */
export function formatDateISO(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Standard ISO YYYY-MM-DD HH:mm using Western digits 0-9 across all languages. */
export function formatDateTimeISO(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${formatDateISO(value)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
