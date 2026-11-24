'use client';
import React, { FormEvent, useMemo, useState } from 'react';
import { AppIcon } from '../BrandMark';
import {
  ArchiveFilters,
  DocItem,
  FolderItem,
  User,
  formatBytes,
  formatDateISO,
  statusMeta,
} from './types';

function renderHighlightedSnippet(snippet?: string | null) {
  if (!snippet) return null;
  const parts = snippet.split(/(⟦[^⟧]+⟧)/g);
  return (
    <p className="text-xs leading-6 text-slate-600 mt-2 line-clamp-3" dir="auto">
      {parts.map((part, idx) =>
        part.startsWith('⟦') && part.endsWith('⟧') ? (
          <mark
            key={idx}
            className="rounded px-1 py-0.5 bg-amber-100 text-slate-900 font-bold"
          >
            {part.slice(1, -1)}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </p>
  );
}

export default function ArchiveView({
  user,
  folders,
  docs,
  categories,
  departments,
  selectedFolder,
  query,
  filters,
  busy,
  onQueryChange,
  onFiltersChange,
  onSelectFolder,
  onSearch,
  onResetSearch,
  onCreateFolder,
  onPreviewDoc,
  onDownloadDoc,
  onDeleteDoc,
  onExport,
  onGoUpload,
}: {
  user: User;
  folders: FolderItem[];
  docs: DocItem[];
  categories: string[];
  departments: string[];
  selectedFolder: string;
  query: string;
  filters: ArchiveFilters;
  busy: boolean;
  onQueryChange: (val: string) => void;
  onFiltersChange: (next: ArchiveFilters) => void;
  onSelectFolder: (folderId: string) => void;
  onSearch: (overrideFolderId?: string, overrideQuery?: string, overrideFilters?: ArchiveFilters) => void;
  onResetSearch: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onPreviewDoc: (doc: DocItem) => void;
  onDownloadDoc: (doc: DocItem) => void;
  onDeleteDoc: (doc: DocItem) => Promise<void>;
  onExport: (kind: 'excel' | 'pdf') => void;
  onGoUpload: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [docToDelete, setDocToDelete] = useState<DocItem | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const canModify = user.role !== 'viewer';

  const folderMap = useMemo(() => {
    const map: Record<string, FolderItem> = {};
    folders.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [folders]);

  const breadcrumbChain = useMemo(() => {
    const chain: FolderItem[] = [];
    const seen = new Set<string>();
    let currId: string | null | undefined = selectedFolder || null;
    while (currId && folderMap[currId] && !seen.has(currId)) {
      seen.add(currId);
      chain.unshift(folderMap[currId]);
      currId = folderMap[currId].parent_id;
    }
    return chain;
  }, [selectedFolder, folderMap]);

  const visibleFolders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return folders.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (!selectedFolder) {
      return folders.filter((f) => !f.parent_id);
    }
    return folders.filter((f) => f.parent_id === selectedFolder);
  }, [folders, selectedFolder, query]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => v && v.trim() !== '').length;
  }, [filters]);

  function resolveDocFullPath(doc: DocItem): string {
    if (doc.folder_path) return doc.folder_path;
    if (!doc.folder_id || !folderMap[doc.folder_id]) {
      return `الرئيسية > ${doc.file_name}`;
    }
    const parts: string[] = [];
    const seen = new Set<string>();
    let curr: string | null | undefined = doc.folder_id;
    while (curr && folderMap[curr] && !seen.has(curr)) {
      seen.add(curr);
      parts.unshift(folderMap[curr].name);
      curr = folderMap[curr].parent_id;
    }
    return `الرئيسية > ${parts.join(' > ')} > ${doc.file_name}`;
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch();
  }

  async function handleFolderCreate(e: FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await onCreateFolder(newFolderName.trim(), selectedFolder || null);
      setNewFolderName('');
      setShowNewFolder(false);
    } finally {
      setCreatingFolder(false);
    }
  }

  async function confirmDeleteDoc() {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      await onDeleteDoc(docToDelete);
      setDocToDelete(null);
    } finally {
      setDeletingDoc(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Compact Header Banner */}
      <section className="archive-hero !mb-0">
        <div>
          <h2>الأرشيف الإلكتروني</h2>
          <p>
            تصفح المجلدات وابحث في أسماء الملفات ومحتوى المستندات بسهولة وسرعة.
          </p>
        </div>
        <div className="archive-hero-actions flex-wrap">
          <div className="archive-count-chip">
            <span>المستندات الظاهرة</span>
            <b dir="ltr" className="tabular-nums">{docs.length}</b>
          </div>
          {canModify && (
            <>
              <button
                type="button"
                onClick={() => setShowNewFolder((v) => !v)}
                className="btn btn-muted inline-flex items-center gap-2 text-xs"
              >
                <AppIcon name="folder" size={16} />
                <span>مجلد جديد</span>
              </button>
              <button
                type="button"
                onClick={onGoUpload}
                className="btn archive-upload-button text-xs"
              >
                <AppIcon name="upload" size={16} />
                <span>رفع مستند</span>
              </button>
            </>
          )}
        </div>
      </section>

      {/* Inline New Folder Bar */}
      {showNewFolder && canModify && (
        <form
          onSubmit={handleFolderCreate}
          className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-sky-200 bg-sky-50/40"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-sky-900 shrink-0">
            <AppIcon name="folder" size={18} className="text-sky-600" />
            <span>
              إنشاء مجلد داخل:{' '}
              {breadcrumbChain.length
                ? breadcrumbChain[breadcrumbChain.length - 1].name
                : 'الرئيسية'}
            </span>
          </div>
          <input
            className="field flex-1"
            placeholder="أدخل اسم المجلد الجديد (مثال: العقود 2026)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            maxLength={180}
            required
            autoFocus
          />
          <div className="flex items-center gap-2 shrink-0">
            <button type="submit" disabled={creatingFolder} className="btn btn-primary text-xs">
              {creatingFolder ? 'جاري الإنشاء...' : 'حفظ المجلد'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName('');
              }}
              className="btn btn-muted text-xs"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {/* Search Bar & Collapsible Filters */}
      <section className="card archive-search-card p-5">
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <AppIcon name="search" size={18} />
              </span>
              <input
                type="search"
                className="field field-icon-start"
                placeholder="ابحث باسم الملف أو بأي نص داخل المستندات والصور..."
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button type="submit" disabled={busy} className="btn btn-primary px-5 text-sm">
                {busy ? 'جاري البحث...' : 'بحث'}
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`btn text-xs inline-flex items-center gap-2 ${
                  filtersOpen || activeFilterCount > 0
                    ? 'border-sky-300 bg-sky-50 text-sky-800'
                    : 'btn-muted'
                }`}
              >
                <AppIcon name="filter" size={15} />
                <span>فلاتر البحث</span>
                {activeFilterCount > 0 && (
                  <span
                    dir="ltr"
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-sky-600 text-white text-[10px] font-bold tabular-nums"
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
              {(query.trim() || activeFilterCount > 0) && (
                <button
                  type="button"
                  onClick={onResetSearch}
                  className="btn btn-muted text-xs"
                >
                  مسح
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Filters Panel */}
          {filtersOpen && (
            <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block text-xs font-bold text-slate-600">
                القسم
                <input
                  list="archive-departments-list"
                  className="field mt-1.5 text-sm"
                  placeholder="جميع الأقسام"
                  value={filters.department}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, department: e.target.value })
                  }
                />
                <datalist id="archive-departments-list">
                  {departments.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </label>

              <label className="block text-xs font-bold text-slate-600">
                نوع الملف
                <select
                  className="field mt-1.5 text-sm"
                  value={filters.mime_type}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, mime_type: e.target.value })
                  }
                >
                  <option value="">جميع الأنواع</option>
                  <option value="application/pdf">ملفات PDF</option>
                  <option value="image/jpeg">صور JPEG</option>
                  <option value="image/png">صور PNG</option>
                  <option value="image/webp">صور WEBP</option>
                  <option value="image/tiff">صور TIFF</option>
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-600">
                التصنيف
                <select
                  className="field mt-1.5 text-sm"
                  value={filters.classification}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, classification: e.target.value })
                  }
                >
                  <option value="">جميع التصنيفات</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-600">
                كلمة مفتاحية
                <input
                  className="field mt-1.5 text-sm"
                  placeholder="مثال: فاتورة، عقد، موارد..."
                  value={filters.keyword}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, keyword: e.target.value })
                  }
                />
              </label>

              <label className="block text-xs font-bold text-slate-600">
                من تاريخ <span dir="ltr" className="text-[11px] font-normal text-slate-400">(YYYY-MM-DD)</span>
                <div dir="ltr" className="mt-1.5">
                  <input
                    type="date"
                    lang="en-CA"
                    className="field text-sm text-left tabular-nums"
                    value={filters.from_date}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, from_date: e.target.value })
                    }
                  />
                </div>
              </label>

              <label className="block text-xs font-bold text-slate-600">
                إلى تاريخ <span dir="ltr" className="text-[11px] font-normal text-slate-400">(YYYY-MM-DD)</span>
                <div dir="ltr" className="mt-1.5">
                  <input
                    type="date"
                    lang="en-CA"
                    className="field text-sm text-left tabular-nums"
                    value={filters.to_date}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, to_date: e.target.value })
                    }
                  />
                </div>
              </label>
            </div>
          )}
        </form>
      </section>

      {/* Breadcrumb Bar + Export & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav
          aria-label="مسار المجلد"
          className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-slate-600"
        >
          <button
            type="button"
            onClick={() => onSelectFolder('')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
              !selectedFolder
                ? 'bg-white text-sky-800 border border-sky-200 shadow-sm'
                : 'hover:bg-white text-slate-600'
            }`}
          >
            <AppIcon name="archive" size={15} />
            <span>الرئيسية</span>
          </button>

          {breadcrumbChain.map((crumb, idx) => {
            const isLast = idx === breadcrumbChain.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span className="text-slate-400 select-none">›</span>
                <button
                  type="button"
                  onClick={() => onSelectFolder(crumb.id)}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                    isLast
                      ? 'bg-white text-sky-800 border border-sky-200 shadow-sm'
                      : 'hover:bg-white text-slate-600'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              شبكة
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                viewMode === 'list'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              قائمة
            </button>
          </div>
          <button
            type="button"
            onClick={() => onExport('excel')}
            className="btn bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs py-2"
          >
            تصدير Excel
          </button>
          <button
            type="button"
            onClick={() => onExport('pdf')}
            className="btn bg-white border-slate-200 text-slate-700 hover:bg-slate-50 text-xs py-2"
          >
            تصدير PDF
          </button>
        </div>
      </div>

      {/* Large Folder Grid Cards */}
      {visibleFolders.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800">
              المجلدات (<span dir="ltr" className="tabular-nums">{visibleFolders.length}</span>)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleFolders.map((folder) => {
              const count = folder.item_count ?? 0;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className="card group p-5 text-right flex flex-col justify-between gap-4 hover:border-sky-300 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-50 to-teal-50 border border-sky-100 text-sky-700 grid place-items-center shrink-0 group-hover:from-sky-600 group-hover:to-teal-600 group-hover:text-white transition-colors">
                      <AppIcon name="folder" size={24} />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-100 px-3 py-1 text-xs font-bold text-sky-800">
                      <span dir="ltr" className="tabular-nums">{count}</span>
                      <span>ملف / صورة</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 truncate group-hover:text-sky-800 transition-colors">
                      {folder.name}
                    </h4>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        آخر تعديل:{' '}
                        <span dir="ltr" className="inline-block tabular-nums font-medium text-slate-600">
                          {formatDateISO(folder.updated_at)}
                        </span>
                      </span>
                      {folder.subfolder_count ? (
                        <span className="text-teal-700 font-semibold">
                          <span dir="ltr" className="tabular-nums">{folder.subfolder_count}</span> مجلد فرعي
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Files Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold text-slate-800">
            الملفات والمستندات (<span dir="ltr" className="tabular-nums">{docs.length}</span>)
          </h3>
          {query.trim() && (
            <span className="text-xs text-sky-700 font-semibold">
              نتائج البحث عن: «{query.trim()}»
            </span>
          )}
        </div>

        {docs.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mb-3">
              <AppIcon name="archive" size={26} />
            </div>
            <h4 className="text-base font-extrabold text-slate-800">
              لا توجد مستندات مطابقة حالياً
            </h4>
            <p className="text-sm text-slate-500 mt-1">
              {query.trim() || activeFilterCount > 0
                ? 'جرّب تعديل كلمات البحث أو إزالة الفلاتر لعرض جميع الملفات.'
                : 'هذا المجلد فارغ حالياً. يمكنك رفع مستند جديد أو اختيار مجلد آخر.'}
            </p>
            {canModify && !query.trim() && (
              <button
                type="button"
                onClick={onGoUpload}
                className="btn btn-primary mt-4 text-xs"
              >
                رفع مستند جديد
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {docs.map((doc) => {
              const isPdf = doc.mime_type === 'application/pdf';
              const status = statusMeta(doc.status);
              const fullPath = resolveDocFullPath(doc);
              return (
                <article
                  key={doc.id}
                  className="card p-5 flex flex-col justify-between gap-4 hover:border-sky-200"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <span
                        className={`w-12 h-12 rounded-2xl shrink-0 grid place-items-center text-xs font-black border ${
                          isPdf
                            ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                            : 'bg-sky-50 text-sky-700 border-sky-200/70'
                        }`}
                      >
                        {isPdf ? 'PDF' : 'IMG'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-extrabold text-slate-900 truncate"
                          title={doc.file_name}
                        >
                          {doc.file_name}
                        </h4>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span dir="ltr" className="tabular-nums">
                            {formatDateISO(doc.created_at)}
                          </span>
                          {doc.file_size ? (
                            <>
                              <span>·</span>
                              <span dir="ltr" className="tabular-nums">
                                {formatBytes(doc.file_size)}
                              </span>
                            </>
                          ) : null}
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Full Folder Path Badge */}
                    <div
                      className="mt-3 inline-flex items-center gap-1.5 max-w-full rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                      title={fullPath}
                    >
                      <AppIcon name="folder" size={13} className="text-sky-600 shrink-0" />
                      <span className="truncate">{fullPath}</span>
                    </div>

                    {/* Metadata tags */}
                    {(doc.department || doc.classification) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {doc.department && (
                          <span className="rounded-md bg-teal-50 text-teal-800 px-2 py-0.5 text-[10px] font-bold">
                            {doc.department}
                          </span>
                        )}
                        {doc.classification && (
                          <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 text-[10px] font-bold">
                            {doc.classification}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Highlighted Matching Text Snippet */}
                    {renderHighlightedSnippet(doc.snippet || doc.summary)}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="btn btn-primary flex-1 py-2 text-xs"
                    >
                      معاينة والنص المستخرج
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadDoc(doc)}
                      className="btn btn-muted py-2 px-3 text-xs"
                      title="تنزيل الملف"
                    >
                      تنزيل
                    </button>
                    {canModify && (
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc)}
                        className="btn py-2 px-2.5 text-xs border-rose-200/80 bg-rose-50/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                        title="حذف الملف"
                        aria-label={`حذف ${doc.file_name}`}
                      >
                        <AppIcon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 overflow-hidden">
            {docs.map((doc) => {
              const isPdf = doc.mime_type === 'application/pdf';
              const status = statusMeta(doc.status);
              const fullPath = resolveDocFullPath(doc);
              return (
                <article
                  key={doc.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <span
                      className={`w-11 h-11 rounded-xl shrink-0 grid place-items-center text-xs font-black border ${
                        isPdf
                          ? 'bg-rose-50 text-rose-700 border-rose-200/70'
                          : 'bg-sky-50 text-sky-700 border-sky-200/70'
                      }`}
                    >
                      {isPdf ? 'PDF' : 'IMG'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {doc.file_name}
                        </h4>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                        >
                          {status.label}
                        </span>
                        {doc.department && (
                          <span className="rounded-md bg-teal-50 text-teal-800 px-2 py-0.5 text-[10px] font-bold">
                            {doc.department}
                          </span>
                        )}
                        {doc.classification && (
                          <span className="rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 text-[10px] font-bold">
                            {doc.classification}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          <AppIcon name="folder" size={12} className="text-sky-600" />
                          <span>{fullPath}</span>
                        </span>
                        <span dir="ltr" className="tabular-nums">
                          {formatDateISO(doc.created_at)}
                        </span>
                        {doc.file_size ? (
                          <span dir="ltr" className="tabular-nums">
                            {formatBytes(doc.file_size)}
                          </span>
                        ) : null}
                      </div>

                      {renderHighlightedSnippet(doc.snippet || doc.summary)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="btn btn-primary py-2 px-4 text-xs"
                    >
                      معاينة
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownloadDoc(doc)}
                      className="btn btn-muted py-2 px-3.5 text-xs"
                    >
                      تنزيل
                    </button>
                    {canModify && (
                      <button
                        type="button"
                        onClick={() => setDocToDelete(doc)}
                        className="btn py-2 px-2.5 text-xs border-rose-200/80 bg-rose-50/80 text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                        title="حذف الملف"
                        aria-label={`حذف ${doc.file_name}`}
                      >
                        <AppIcon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {docToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-doc-title"
          dir="rtl"
          className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deletingDoc) setDocToDelete(null);
          }}
        >
          <div className="card max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <span className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 grid place-items-center shrink-0">
                <AppIcon name="trash" size={20} />
              </span>
              <div>
                <h3 id="delete-doc-title" className="text-base font-extrabold text-slate-900">
                  تأكيد حذف الملف
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  لا يمكن التراجع عن هذا الإجراء بعد التنفيذ.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-700 leading-7">
              هل أنت متأكد من رغبتك في حذف الملف{' '}
              <b className="text-slate-900 break-all">«{docToDelete.file_name}»</b>{' '}
              نهائياً من الأرشيف؟
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deletingDoc}
                onClick={() => setDocToDelete(null)}
                className="btn btn-muted text-xs"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deletingDoc}
                onClick={confirmDeleteDoc}
                className="btn bg-rose-600 hover:bg-rose-700 text-white text-xs px-5"
              >
                {deletingDoc ? 'جاري الحذف...' : 'تأكيد الحذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
