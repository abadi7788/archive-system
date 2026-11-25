'use client';
import React, { FormEvent, useMemo, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { statusDisplayMeta, type TranslationKeys } from '../lib/i18n';
import {
  ArchiveFilters,
  DocItem,
  FolderItem,
  OwnerSummary,
  User,
  formatBytes,
  formatDateISO,
} from './types';

function renderHighlightedSnippet(snippet?: string | null) {
  if (!snippet) return null;
  const parts = snippet.split(/(⟦[^⟧]+⟧)/g);
  return (
    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 mt-2 line-clamp-2" dir="auto">
      {parts.map((part, idx) =>
        part.startsWith('⟦') && part.endsWith('⟧') ? (
          <mark
            key={idx}
            className="rounded px-1 bg-amber-100 dark:bg-amber-900/60 text-slate-900 dark:text-amber-100 font-semibold"
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
  visibleOwners,
  categories,
  departments,
  selectedFolder,
  query,
  filters,
  busy,
  loadingFolders,
  t,
  dir,
  onQueryChange,
  onFiltersChange,
  onSelectFolder,
  onSearch,
  onResetSearch,
  onCreateFolder,
  onDeleteFolder,
  onPreviewDoc,
  onEditDoc,
  onDownloadDoc,
  onDeleteDoc,
  onExport,
  onGoUpload,
}: {
  user: User;
  folders: FolderItem[];
  docs: DocItem[];
  visibleOwners: OwnerSummary[];
  categories: string[];
  departments: string[];
  selectedFolder: string;
  query: string;
  filters: ArchiveFilters;
  busy: boolean;
  loadingFolders: boolean;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onQueryChange: (val: string) => void;
  onFiltersChange: (next: ArchiveFilters) => void;
  onSelectFolder: (folderId: string) => void;
  onSearch: (overrideFolderId?: string, overrideQuery?: string, overrideFilters?: ArchiveFilters) => void;
  onResetSearch: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folder: FolderItem) => Promise<void>;
  onPreviewDoc: (doc: DocItem) => void;
  onEditDoc: (doc: DocItem) => void;
  onDownloadDoc: (doc: DocItem) => void;
  onDeleteDoc: (doc: DocItem) => Promise<void>;
  onExport: (kind: 'xlsx' | 'pdf') => void;
  onGoUpload: () => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [docToTrash, setDocToTrash] = useState<DocItem | null>(null);
  const [folderToTrash, setFolderToTrash] = useState<FolderItem | null>(null);
  const [trashing, setTrashing] = useState(false);

  const canCreate = user.role !== 'viewer';
  const showOwnerFilter = user.role === 'admin' || visibleOwners.length > 1;
  const showOwnerMeta = user.role === 'admin' || visibleOwners.length > 1;

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
    let list = folders;
    if (filters.owner_id) {
      list = list.filter((f) => f.owner_id === filters.owner_id);
    }
    if (q) {
      return list.filter((f) => f.name.toLowerCase().includes(q));
    }
    if (!selectedFolder) {
      return list.filter((f) => !f.parent_id || !folderMap[f.parent_id]);
    }
    return list.filter((f) => f.parent_id === selectedFolder);
  }, [folders, selectedFolder, query, filters.owner_id, folderMap]);

  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter((v) => v && v.trim() !== '').length;
  }, [filters]);

  function resolveDocPath(doc: DocItem): string {
    if (doc.folder_breadcrumb) return `${t.rootHome} / ${doc.folder_breadcrumb}`;
    if (!doc.folder_id || !folderMap[doc.folder_id]) return t.rootHome;
    const parts: string[] = [];
    const seen = new Set<string>();
    let curr: string | null | undefined = doc.folder_id;
    while (curr && folderMap[curr] && !seen.has(curr)) {
      seen.add(curr);
      parts.unshift(folderMap[curr].name);
      curr = folderMap[curr].parent_id;
    }
    return `${t.rootHome} / ${parts.join(' / ')}`;
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

  async function confirmTrash() {
    setTrashing(true);
    try {
      if (docToTrash) {
        await onDeleteDoc(docToTrash);
        setDocToTrash(null);
      } else if (folderToTrash) {
        await onDeleteFolder(folderToTrash);
        setFolderToTrash(null);
      }
    } finally {
      setTrashing(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Unified Compact Enterprise Toolbar (Search + Filters + New Folder + Upload) */}
      <section className="card p-3.5 sm:p-4">
        <form onSubmit={handleSearchSubmit} className="space-y-3.5">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                <AppIcon name="search" size={17} />
              </span>
              <input
                type="search"
                className="field field-icon-start"
                placeholder={t.searchPlaceholder}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
              />
            </div>

            {/* Action Cluster */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button type="submit" disabled={busy} className="btn btn-primary text-xs px-4">
                {busy ? t.searching : t.searchButton}
              </button>

              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`btn text-xs ${
                  filtersOpen || activeFilterCount > 0
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                    : 'btn-muted'
                }`}
              >
                <AppIcon name="filter" size={15} />
                <span>{t.filters}</span>
                {activeFilterCount > 0 && (
                  <span dir="ltr" className="tabular-nums font-bold">
                    ({activeFilterCount})
                  </span>
                )}
              </button>

              {(query.trim() || activeFilterCount > 0) && (
                <button
                  type="button"
                  onClick={onResetSearch}
                  className="btn btn-muted text-xs"
                >
                  {t.clear}
                </button>
              )}

              {canCreate && (
                <>
                  <div className="hidden lg:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setShowNewFolder((v) => !v)}
                    className="btn btn-muted text-xs"
                  >
                    <AppIcon name="folderPlus" size={15} />
                    <span>{t.newFolder}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onGoUpload}
                    className="btn btn-primary text-xs"
                  >
                    <AppIcon name="upload" size={15} />
                    <span>{t.uploadDocument}</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Collapsible Filters Drawer */}
          {filtersOpen && (
            <div className="pt-3.5 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {showOwnerFilter && (
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t.ownerLabel}
                  <select
                    className="field mt-1 text-xs"
                    value={filters.owner_id}
                    onChange={(e) => {
                      const next = { ...filters, owner_id: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                  >
                    <option value="">{t.allEmployees}</option>
                    {visibleOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.display_name}
                        {owner.job_title ? ` — ${owner.job_title}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.departmentLabel}
                <input
                  list="archive-departments-list"
                  className="field mt-1 text-xs"
                  placeholder={t.allDepartments}
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

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.fileTypeLabel}
                <select
                  className="field mt-1 text-xs"
                  value={filters.mime_type}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, mime_type: e.target.value })
                  }
                >
                  <option value="">{t.allFileTypes}</option>
                  <option value="application/pdf">PDF</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WEBP</option>
                  <option value="image/tiff">TIFF</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.classificationLabel}
                <select
                  className="field mt-1 text-xs"
                  value={filters.classification}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, classification: e.target.value })
                  }
                >
                  <option value="">{t.allClassifications}</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.keywordLabel}
                <input
                  className="field mt-1 text-xs"
                  placeholder={t.keywordPlaceholder}
                  value={filters.keyword}
                  onChange={(e) =>
                    onFiltersChange({ ...filters, keyword: e.target.value })
                  }
                />
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.fromDate}
                <div dir="ltr" className="mt-1">
                  <input
                    type="date"
                    lang="en-CA"
                    className="field text-xs text-left tabular-nums"
                    value={filters.from_date}
                    onChange={(e) =>
                      onFiltersChange({ ...filters, from_date: e.target.value })
                    }
                  />
                </div>
              </label>

              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                {t.toDate}
                <div dir="ltr" className="mt-1">
                  <input
                    type="date"
                    lang="en-CA"
                    className="field text-xs text-left tabular-nums"
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

      {/* Inline New Folder Creator */}
      {showNewFolder && canCreate && (
        <form
          onSubmit={handleFolderCreate}
          className="card p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-blue-200 dark:border-blue-800/80 bg-blue-50/40 dark:bg-blue-950/20"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-300 shrink-0">
            <AppIcon name="folderPlus" size={16} />
            <span>
              {t.createFolderInside}:{' '}
              {breadcrumbChain.length ? breadcrumbChain[breadcrumbChain.length - 1].name : t.rootHome}
            </span>
          </div>
          <input
            className="field flex-1"
            placeholder={t.folderNamePlaceholder}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            maxLength={180}
            required
            autoFocus
          />
          <div className="flex items-center gap-2 shrink-0">
            <button type="submit" disabled={creatingFolder} className="btn btn-primary text-xs">
              {creatingFolder ? t.creating : t.saveFolder}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName('');
              }}
              className="btn btn-muted text-xs"
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {/* Breadcrumbs + View Mode & Export Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
          <button
            type="button"
            onClick={() => onSelectFolder('')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors ${
              !selectedFolder
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <AppIcon name="archive" size={14} />
            <span>{t.rootHome}</span>
          </button>

          {breadcrumbChain.map((crumb, idx) => {
            const isLast = idx === breadcrumbChain.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                <span className="text-slate-400 dark:text-slate-600 select-none">/</span>
                <button
                  type="button"
                  onClick={() => onSelectFolder(crumb.id)}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                    isLast
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AppIcon name="grid" size={14} />
              <span>{t.gridView}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AppIcon name="list" size={14} />
              <span>{t.listView}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!docs.length}
            onClick={() => onExport('xlsx')}
            className="btn btn-muted text-xs py-1.5 px-3"
          >
            {t.exportExcel}
          </button>
          <button
            type="button"
            disabled={!docs.length}
            onClick={() => onExport('pdf')}
            className="btn btn-muted text-xs py-1.5 px-3"
          >
            {t.exportPdf}
          </button>
        </div>
      </div>

      {/* Folders Section */}
      {loadingFolders ? (
        <section className="space-y-3" aria-busy="true">
          <div className="h-4 w-28 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : visibleFolders.length > 0 ? (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t.foldersTitle} · <span dir="ltr" className="tabular-nums">{visibleFolders.length}</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {visibleFolders.map((folder) => {
              const count = folder.item_count ?? 0;
              return (
                <div
                  key={folder.id}
                  className="card group p-4 flex flex-col justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectFolder(folder.id)}
                      className="flex items-center gap-3 min-w-0 flex-1 text-start"
                    >
                      <span className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <AppIcon name="folder" size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {folder.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          <span dir="ltr" className="tabular-nums">{count}</span> {t.itemsCount}
                          {folder.subfolder_count ? (
                            <>
                              {' · '}
                              <span dir="ltr" className="tabular-nums">{folder.subfolder_count}</span> {t.subfoldersCount}
                            </>
                          ) : null}
                        </p>
                      </div>
                    </button>

                    {folder.can_manage && (
                      <button
                        type="button"
                        onClick={() => setFolderToTrash(folder)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                        title={t.moveToTrash}
                        aria-label={`${t.moveToTrash} ${folder.name}`}
                      >
                        <AppIcon name="trash" size={15} />
                      </button>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {showOwnerMeta && folder.owner_name ? (
                      <span className="inline-flex items-center gap-1 truncate font-medium text-slate-600 dark:text-slate-300">
                        <AppIcon name="user" size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{folder.owner_name}</span>
                      </span>
                    ) : (
                      <span>{t.lastModified}</span>
                    )}
                    <span dir="ltr" className="tabular-nums shrink-0">
                      {formatDateISO(folder.updated_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Files Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t.filesTitle} · <span dir="ltr" className="tabular-nums">{docs.length}</span>
          </h3>
        </div>

        {/* Skeleton Loaders during Search / Fetch */}
        {busy ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-4/5 rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="h-2.5 w-3/5 rounded bg-slate-100 dark:bg-slate-800/70" />
                    </div>
                  </div>
                  <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                  <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                </div>
              ))}
            </div>
          ) : (
            <div className="card divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
                  </div>
                  <div className="h-7 w-24 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
                </div>
              ))}
            </div>
          )
        ) : docs.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 grid place-items-center mb-3">
              <AppIcon name="file" size={22} />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.emptyArchiveTitle}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              {query.trim() || activeFilterCount > 0 ? t.emptySearchDesc : t.emptyArchiveDesc}
            </p>
            {canCreate && !query.trim() && (
              <button type="button" onClick={onGoUpload} className="btn btn-primary mt-4 text-xs">
                <AppIcon name="upload" size={15} />
                <span>{t.uploadDocument}</span>
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {docs.map((doc) => {
              const isPdf = doc.mime_type === 'application/pdf';
              const status = statusDisplayMeta(doc.status, t);
              const pathLabel = resolveDocPath(doc);
              return (
                <article
                  key={doc.id}
                  className="card p-4 flex flex-col justify-between gap-3.5 hover:border-slate-300 dark:hover:border-slate-700"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => onPreviewDoc(doc)}
                        className={`w-10 h-10 rounded-lg shrink-0 grid place-items-center text-[11px] font-bold border transition-colors ${
                          isPdf
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/70 dark:border-rose-900/60'
                            : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/70 dark:border-blue-900/60'
                        }`}
                        title={t.preview}
                      >
                        {isPdf ? 'PDF' : 'IMG'}
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onPreviewDoc(doc)}
                          className="block w-full text-start text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
                          title={doc.file_name}
                        >
                          {doc.file_name}
                        </button>

                        {/* Clean unboxed metadata line */}
                        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span dir="ltr" className="tabular-nums">
                            {formatDateISO(doc.created_at)}
                          </span>
                          {doc.file_size ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span dir="ltr" className="tabular-nums">
                                {formatBytes(doc.file_size)}
                              </span>
                            </>
                          ) : null}
                          <span aria-hidden="true">·</span>
                          <span className={`font-medium ${status.textClass}`}>{status.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Path, Owner, Department & Classification — clean unboxed metadata */}
                    <div className="mt-3 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 truncate" title={pathLabel}>
                        <AppIcon name="folder" size={12} className="shrink-0 text-slate-400" />
                        <span className="truncate">{pathLabel}</span>
                      </div>
                      {(showOwnerMeta && doc.owner_name) || doc.department || doc.classification ? (
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 truncate">
                          {showOwnerMeta && doc.owner_name && (
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {doc.owner_name}
                            </span>
                          )}
                          {showOwnerMeta && doc.owner_name && (doc.department || doc.classification) && (
                            <span aria-hidden="true">·</span>
                          )}
                          {[doc.department, doc.classification].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </div>

                    {renderHighlightedSnippet(doc.snippet || doc.summary)}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="btn btn-primary flex-1 py-1.5 text-xs"
                    >
                      <AppIcon name="eye" size={14} />
                      <span>{t.preview}</span>
                    </button>
                    {doc.can_manage && (
                      <button
                        type="button"
                        onClick={() => onEditDoc(doc)}
                        className="btn btn-muted p-2"
                        title={t.edit}
                        aria-label={`${t.edit} ${doc.file_name}`}
                      >
                        <AppIcon name="edit" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDownloadDoc(doc)}
                      className="btn btn-muted p-2"
                      title={t.download}
                      aria-label={`${t.download} ${doc.file_name}`}
                    >
                      <AppIcon name="download" size={14} />
                    </button>
                    {doc.can_manage && (
                      <button
                        type="button"
                        onClick={() => setDocToTrash(doc)}
                        className="btn btn-muted p-2 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800"
                        title={t.moveToTrash}
                        aria-label={`${t.moveToTrash} ${doc.file_name}`}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {docs.map((doc) => {
              const isPdf = doc.mime_type === 'application/pdf';
              const status = statusDisplayMeta(doc.status, t);
              const pathLabel = resolveDocPath(doc);
              return (
                <article
                  key={doc.id}
                  className="p-3.5 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className={`w-9 h-9 rounded-lg shrink-0 grid place-items-center text-[11px] font-bold border ${
                        isPdf
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200/70 dark:border-rose-900/60'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200/70 dark:border-blue-900/60'
                      }`}
                    >
                      {isPdf ? 'PDF' : 'IMG'}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onPreviewDoc(doc)}
                        className="block text-start text-sm font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-full"
                      >
                        {doc.file_name}
                      </button>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{pathLabel}</span>
                        {showOwnerMeta && doc.owner_name && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {doc.owner_name}
                            </span>
                          </>
                        )}
                        {doc.department && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{doc.department}</span>
                          </>
                        )}
                        {doc.classification && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{doc.classification}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span dir="ltr" className="tabular-nums">
                          {formatDateISO(doc.created_at)}
                        </span>
                        {doc.file_size ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span dir="ltr" className="tabular-nums">
                              {formatBytes(doc.file_size)}
                            </span>
                          </>
                        ) : null}
                        <span aria-hidden="true">·</span>
                        <span className={`font-medium ${status.textClass}`}>{status.label}</span>
                      </div>

                      {renderHighlightedSnippet(doc.snippet || doc.summary)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPreviewDoc(doc)}
                      className="btn btn-primary py-1.5 px-3 text-xs"
                    >
                      <AppIcon name="eye" size={14} />
                      <span>{t.preview}</span>
                    </button>
                    {doc.can_manage && (
                      <button
                        type="button"
                        onClick={() => onEditDoc(doc)}
                        className="btn btn-muted p-2"
                        title={t.edit}
                      >
                        <AppIcon name="edit" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDownloadDoc(doc)}
                      className="btn btn-muted p-2"
                      title={t.download}
                    >
                      <AppIcon name="download" size={14} />
                    </button>
                    {doc.can_manage && (
                      <button
                        type="button"
                        onClick={() => setDocToTrash(doc)}
                        className="btn btn-muted p-2 hover:text-rose-600 dark:hover:text-rose-400"
                        title={t.moveToTrash}
                      >
                        <AppIcon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Move to Recycle Bin Confirmation Modal (File or Folder) */}
      {(docToTrash || folderToTrash) && (
        <div
          role="dialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !trashing) {
              setDocToTrash(null);
              setFolderToTrash(null);
            }
          }}
        >
          <div className="card max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {docToTrash ? t.confirmTrashDocTitle : t.confirmTrashFolderTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {docToTrash ? t.confirmTrashDocDesc : t.confirmTrashFolderDesc}
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300 font-medium break-all">
              «{docToTrash ? docToTrash.file_name : folderToTrash?.name}»
            </p>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={trashing}
                onClick={() => {
                  setDocToTrash(null);
                  setFolderToTrash(null);
                }}
                className="btn btn-muted text-xs"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={trashing}
                onClick={confirmTrash}
                className="btn btn-danger text-xs px-4"
              >
                {trashing ? t.movingToTrash : t.moveToTrashConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
