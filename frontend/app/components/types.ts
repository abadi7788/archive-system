export type User = {
  id: string;
  username: string;
  role: string;
  department?: string | null;
  is_active?: boolean;
  must_change_password?: boolean;
};

export type FolderItem = {
  id: string;
  name: string;
  parent_id?: string | null;
  path?: string;
  owner_id?: string;
  item_count?: number;
  subfolder_count?: number;
  updated_at?: string | null;
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
  created_at?: string;
};

export type ArchiveFilters = {
  department: string;
  mime_type: string;
  classification: string;
  keyword: string;
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

export function formatBytes(n?: number | null): string {
  const bytes = Number(n || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

export function formatDateArabic(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-SA-u-nu-latn', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function roleLabel(role: string): string {
  if (role === 'admin') return 'مدير النظام';
  if (role === 'archiver') return 'موظف أرشفة';
  if (role === 'viewer') return 'مستخدم عرض فقط';
  return role;
}

export function statusMeta(status?: string): { label: string; className: string } {
  if (status === 'completed') {
    return { label: 'مفهرس (OCR)', className: 'bg-emerald-50 text-emerald-700 border-emerald-200/70' };
  }
  if (status === 'processing') {
    return { label: 'جاري الاستخراج…', className: 'bg-sky-50 text-sky-700 border-sky-200/70' };
  }
  if (status === 'failed') {
    return { label: 'تعذر الاستخراج', className: 'bg-rose-50 text-rose-700 border-rose-200/70' };
  }
  return { label: 'في قائمة الفهرسة', className: 'bg-amber-50 text-amber-800 border-amber-200/70' };
}
