'use client';
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { statusDisplayMeta, type TranslationKeys } from '../lib/i18n';
import DocumentInspector, { renderHighlightedText } from './DocumentInspector';
import {
  ArchiveFilters,
  DocItem,
  FolderItem,
  OwnerSummary,
  User,
  formatBytes,
  formatDateISO,
} from './types';

export default function ArchiveView({
  user,
  token,
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
  token: string;
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
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Live Document Inspector selection state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Soft-delete modals
  const [docToTrash, setDocToTrash] = useState<DocItem | null>(null);
  const [folderToTrash, setFolderToTrash] = useState<FolderItem | null>(null);
  const [trashing, setTrashing] = useState(false);

  const canCreate = user.role !== 'viewer';
  const showOwnerColumn = user.role === 'admin' || visibleOwners.length > 1;

  // Keep selectedDoc synced with visible docs list
  useEffect(() => {
    if (!docs.length) {
      setSelectedDocId(null);
      setMobileInspectorOpen(false);
      return;
    }
    setSelectedDocId((prev) => {
      if (prev && docs.some((d) => d.id === prev)) return prev;
      return docs[0].id;
    });
  }, [docs]);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedDocId) || null,
    [docs, selectedDocId]
  );

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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.department) count++;
    if (filters.mime_type) count++;
    if (filters.classification) count++;
    if (filters.keyword.trim()) count++;
    if (filters.owner_id) count++;
    if (filters.from_date) count++;
    if (filters.to_date) count++;
    return count;
  }, [filters]);

  const hasActiveSearch = Boolean(query.trim()) || activeFiltersCount > 0;

  // Subfolders visible at current folder level (hidden during active text search to prioritize matched documents)
  const childFolders = useMemo(() => {
    if (hasActiveSearch) return [];
    const parentTarget = selectedFolder || null;
    return folders.filter((f) => (f.parent_id || null) === parentTarget);
  }, [folders, selectedFolder, hasActiveSearch]);

  // Linked employees count for KPI card
  const linkedEmployeesCount = useMemo(() => {
    if (user.role === 'admin') {
      return visibleOwners.length;
    }
    // For employees, show number of linked teammates (excluding self if listed, or total shared members)
    const others = visibleOwners.filter((o) => o.id !== user.id).length;
    return others;
  }, [visibleOwners, user.id, user.role]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    onSearch();
  }

  async function handleCreateFolderSubmit(e: FormEvent) {
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

  async function handleConfirmTrash() {
    setTrashing(true);
    try {
      if (docToTrash) {
        await onDeleteDoc(docToTrash);
        setDocToTrash(null);
        setMobileInspectorOpen(false);
      } else if (folderToTrash) {
        await onDeleteFolder(folderToTrash);
        setFolderToTrash(null);
      }
    } finally {
      setTrashing(false);
    }
  }

  function handleSelectRow(doc: DocItem) {
    setSelectedDocId(doc.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      setMobileInspectorOpen(true);
    }
  }

  const canManageSelected = Boolean(
    selectedDoc && selectedDoc.can_manage !== false && user.role !== 'viewer'
  );

  return (
    <div className="w-full max-w-[1680px] mx-auto">
      {/* 2-Column Inner Split (Center Workspace + Opposite Live Document Inspector = 3 Panes total with Sidebar) */}
      <div className="flex flex-col xl:flex-row items-start gap-4 lg:gap-5">
        {/* =============================================================== */}
        {/* PANE 2: CENTER WORKSPACE (Toolbar + 3 KPIs + Elevated Table)     */}
        {/* =============================================================== */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* 1. Unified Compact Top Toolbar */}
          <section className="card p-3.5 sm:p-4 space-y-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-0">
                <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <AppIcon name="search" size={16} />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="field field-icon-start pe-9 text-xs sm:text-sm"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      onQueryChange('');
                      onSearch(selectedFolder, '', filters);
                    }}
                    aria-label={t.clear}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                )}
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="submit"
                  disabled={busy}
                  className="btn btn-muted py-2 px-3.5 text-xs whitespace-nowrap shrink-0"
                >
                  <AppIcon name="search" size={14} />
                  <span>{busy ? t.searching : t.searchButton}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`btn py-2 px-3 text-xs whitespace-nowrap shrink-0 ${
                    filtersOpen || activeFiltersCount > 0
                      ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                      : 'btn-muted'
                  }`}
                >
                  <AppIcon name="filter" size={14} />
                  <span>{t.filters}</span>
                  {activeFiltersCount > 0 && (
                    <span
                      dir="ltr"
                      className="ms-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-blue-600 text-white text-[10px] font-bold tabular-nums"
                    >
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {canCreate && (
                  <button
                    type="button"
                    onClick={() => setShowNewFolder((v) => !v)}
                    className="btn btn-muted py-2 px-3 text-xs whitespace-nowrap shrink-0"
                  >
                    <AppIcon name="folderPlus" size={15} />
                    <span>{t.newFolder}</span>
                  </button>
                )}

                {canCreate && (
                  <button
                    type="button"
                    onClick={onGoUpload}
                    className="btn btn-primary py-2 px-3.5 text-xs whitespace-nowrap shrink-0"
                  >
                    <AppIcon name="plus" size={15} />
                    <span>{t.uploadDocument}</span>
                  </button>
                )}
              </div>
            </form>

            {/* Collapsible Filters Panel */}
            {filtersOpen && (
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.departmentLabel}
                  </label>
                  <select
                    value={filters.department}
                    onChange={(e) => {
                      const next = { ...filters, department: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                    className="field text-xs py-2 min-h-[38px]"
                  >
                    <option value="">{t.allDepartments}</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.fileTypeLabel}
                  </label>
                  <select
                    value={filters.mime_type}
                    onChange={(e) => {
                      const next = { ...filters, mime_type: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                    className="field text-xs py-2 min-h-[38px]"
                  >
                    <option value="">{t.allFileTypes}</option>
                    <option value="application/pdf">PDF</option>
                    <option value="image/jpeg">JPEG</option>
                    <option value="image/png">PNG</option>
                    <option value="image/webp">WEBP</option>
                    <option value="image/tiff">TIFF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.classificationLabel}
                  </label>
                  <select
                    value={filters.classification}
                    onChange={(e) => {
                      const next = { ...filters, classification: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                    className="field text-xs py-2 min-h-[38px]"
                  >
                    <option value="">{t.allClassifications}</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {showOwnerColumn && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      {t.ownerLabel}
                    </label>
                    <select
                      value={filters.owner_id}
                      onChange={(e) => {
                        const next = { ...filters, owner_id: e.target.value };
                        onFiltersChange(next);
                        onSearch(selectedFolder, query, next);
                      }}
                      className="field text-xs py-2 min-h-[38px]"
                    >
                      <option value="">{t.allEmployees}</option>
                      {visibleOwners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.keywordLabel}
                  </label>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(e) => onFiltersChange({ ...filters, keyword: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        onSearch();
                      }
                    }}
                    placeholder={t.keywordPlaceholder}
                    className="field text-xs py-2 min-h-[38px]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.fromDate}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    value={filters.from_date}
                    onChange={(e) => {
                      const next = { ...filters, from_date: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                    className="field text-xs py-2 min-h-[38px] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.toDate}
                  </label>
                  <input
                    type="date"
                    dir="ltr"
                    value={filters.to_date}
                    onChange={(e) => {
                      const next = { ...filters, to_date: e.target.value };
                      onFiltersChange(next);
                      onSearch(selectedFolder, query, next);
                    }}
                    className="field text-xs py-2 min-h-[38px] tabular-nums"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => onSearch()}
                    className="btn btn-primary py-2 px-3 text-xs flex-1"
                  >
                    {t.searchButton}
                  </button>
                  <button
                    type="button"
                    onClick={onResetSearch}
                    className="btn btn-muted py-2 px-3 text-xs"
                  >
                    {t.clear}
                  </button>
                </div>
              </div>
            )}

            {/* Inline New Folder Creator */}
            {showNewFolder && canCreate && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                  <AppIcon name="folderPlus" size={16} className="text-blue-600 dark:text-blue-400" />
                  <span>
                    {t.createFolderInside}:{' '}
                    <strong className="text-slate-900 dark:text-white">
                      {selectedFolder && folderMap[selectedFolder]
                        ? folderMap[selectedFolder].name
                        : t.rootHome}
                    </strong>
                  </span>
                </div>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={t.folderNamePlaceholder}
                  autoFocus
                  required
                  className="field text-xs py-2 min-h-[38px] flex-1"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="submit"
                    disabled={creatingFolder || !newFolderName.trim()}
                    className="btn btn-primary py-2 px-4 text-xs"
                  >
                    {creatingFolder ? t.creating : t.saveFolder}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewFolder(false);
                      setNewFolderName('');
                    }}
                    className="btn btn-muted py-2 px-3 text-xs"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* 2. Compact 3-Card Quick KPI Strip */}
          <section aria-label="Archive Summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* KPI 1: Documents */}
            <div className="card px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
                <AppIcon name="file" size={19} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t.statDocuments}
                </div>
                <div
                  dir="ltr"
                  className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {docs.length}
                </div>
              </div>
            </div>

            {/* KPI 2: Folders */}
            <div className="card px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                <AppIcon name="folder" size={19} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t.statFolders}
                </div>
                <div
                  dir="ltr"
                  className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {folders.length}
                </div>
              </div>
            </div>

            {/* KPI 3: Linked Employees */}
            <div className="card px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 grid place-items-center shrink-0">
                <AppIcon name="users" size={19} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  {t.statLinkedEmployees}
                </div>
                <div
                  dir="ltr"
                  className="text-xl font-bold text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {linkedEmployeesCount}
                </div>
              </div>
            </div>
          </section>

          {/* 3. Elevated White Files & Folders Table */}
          <section className="card overflow-hidden">
            {/* Table Top Header: Breadcrumbs + Export Controls */}
            <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/60 dark:bg-slate-900/60">
              <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectFolder('')}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${
                    !selectedFolder
                      ? 'font-bold text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/50'
                      : 'font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <AppIcon name="archive" size={13} />
                  <span>{t.rootHome}</span>
                </button>
                {breadcrumbChain.map((crumb, idx) => {
                  const isLast = idx === breadcrumbChain.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">
                        /
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectFolder(crumb.id)}
                        className={`px-2 py-1 rounded-md transition-colors truncate max-w-[180px] ${
                          isLast
                            ? 'font-bold text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/50'
                            : 'font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  );
                })}
                {hasActiveSearch && (
                  <button
                    type="button"
                    onClick={onResetSearch}
                    className="ms-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t.clear}
                  </button>
                )}
              </nav>

              {/* Export Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onExport('xlsx')}
                  disabled={!docs.length}
                  className="btn btn-muted py-1.5 px-2.5 text-[11px]"
                >
                  <AppIcon name="download" size={13} />
                  <span>{t.exportExcel}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onExport('pdf')}
                  disabled={!docs.length}
                  className="btn btn-muted py-1.5 px-2.5 text-[11px]"
                >
                  <AppIcon name="download" size={13} />
                  <span>{t.exportPdf}</span>
                </button>
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900">
                    <th className="py-2.5 px-4 text-start">{t.fileNameLabel}</th>
                    <th className="py-2.5 px-3 text-start hidden md:table-cell">{t.departmentLabel}</th>
                    {showOwnerColumn && (
                      <th className="py-2.5 px-3 text-start hidden sm:table-cell">{t.ownerLabel}</th>
                    )}
                    <th className="py-2.5 px-3 text-start hidden sm:table-cell whitespace-nowrap">{t.dateLabel}</th>
                    <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.sizeLabel}</th>
                    <th className="py-2.5 px-3 text-end w-10" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                  {/* Loading Skeleton Rows */}
                  {(busy || loadingFolders) && !docs.length && !childFolders.length && (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={`sk-${i}`} className="animate-pulse">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-200/80 dark:bg-slate-800 shrink-0" />
                              <div className="space-y-1.5 flex-1">
                                <div className="h-3.5 w-44 rounded bg-slate-200/80 dark:bg-slate-800" />
                                <div className="h-2.5 w-28 rounded bg-slate-100 dark:bg-slate-800/60" />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 hidden md:table-cell">
                            <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-slate-800" />
                          </td>
                          {showOwnerColumn && (
                            <td className="py-3.5 px-3 hidden sm:table-cell">
                              <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-slate-800" />
                            </td>
                          )}
                          <td className="py-3.5 px-3 hidden sm:table-cell">
                            <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-slate-800" />
                          </td>
                          <td className="py-3.5 px-3">
                            <div className="h-3 w-12 ms-auto rounded bg-slate-200/80 dark:bg-slate-800" />
                          </td>
                          <td className="py-3.5 px-3" />
                        </tr>
                      ))}
                    </>
                  )}

                  {/* Subfolder Rows */}
                  {childFolders.map((folder) => {
                    const canManageFolder = folder.can_manage !== false && user.role !== 'viewer';
                    return (
                      <tr
                        key={`folder-${folder.id}`}
                        onClick={() => onSelectFolder(folder.id)}
                        className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                              <AppIcon name="folder" size={17} />
                            </span>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {folder.name}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 tabular-nums">
                                <span>
                                  {folder.item_count || 0} {t.itemsCount}
                                </span>
                                {Boolean(folder.subfolder_count) && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {folder.subfolder_count} {t.subfoldersCount}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 hidden md:table-cell">
                          {t.foldersTitle}
                        </td>
                        {showOwnerColumn && (
                          <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden sm:table-cell truncate max-w-[140px]">
                            {folder.owner_name || folder.owner_username || '—'}
                          </td>
                        )}
                        <td
                          dir="ltr"
                          className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell whitespace-nowrap tabular-nums text-start"
                        >
                          {formatDateISO(folder.updated_at)}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-400 dark:text-slate-500 text-end">
                          —
                        </td>
                        <td className="py-3 px-3 text-end">
                          {canManageFolder && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFolderToTrash(folder);
                              }}
                              title={t.moveToTrash}
                              aria-label={t.moveToTrash}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Document Rows */}
                  {docs.map((doc) => {
                    const isSelected = doc.id === selectedDocId;
                    const isImg = (doc.mime_type || '').toLowerCase().startsWith('image/');
                    const isPdf = (doc.mime_type || '').toLowerCase() === 'application/pdf';
                    const statusMeta = statusDisplayMeta(doc.status, t);
                    const canManageDoc = doc.can_manage !== false && user.role !== 'viewer';
                    const snippetText =
                      doc.snippet ||
                      (query.trim() && doc.extracted_text ? doc.extracted_text.slice(0, 180) : null);

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleSelectRow(doc)}
                        onDoubleClick={() => onPreviewDoc(doc)}
                        aria-selected={isSelected}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/90 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/45'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <span
                              className={`mt-0.5 w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                                isImg
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                                  : isPdf
                                  ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400'
                              }`}
                            >
                              <AppIcon name={isImg ? 'image' : 'file'} size={16} />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div
                                className={`font-semibold truncate leading-snug ${
                                  isSelected
                                    ? 'text-blue-700 dark:text-blue-300'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                                dir="auto"
                              >
                                {doc.file_name}
                              </div>

                              {/* Clean unboxed secondary metadata line */}
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {doc.folder_breadcrumb && (
                                  <>
                                    <span className="truncate max-w-[200px]" dir="auto">
                                      {doc.folder_breadcrumb}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span className={statusMeta.textClass}>{statusMeta.label}</span>
                              </div>

                              {/* Highlighted Search Content Snippet right below filename */}
                              {snippetText && (
                                <p
                                  className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2"
                                  dir="auto"
                                >
                                  {renderHighlightedText(snippetText, query)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell align-top">
                          <div className="truncate max-w-[140px]">{doc.department || '—'}</div>
                          {doc.classification && (
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[140px] mt-0.5">
                              {doc.classification}
                            </div>
                          )}
                        </td>

                        {showOwnerColumn && (
                          <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden sm:table-cell align-top truncate max-w-[130px]">
                            {doc.owner_name || doc.owner_username || '—'}
                          </td>
                        )}

                        <td
                          dir="ltr"
                          className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell align-top whitespace-nowrap tabular-nums text-start"
                        >
                          {formatDateISO(doc.created_at)}
                        </td>

                        <td
                          dir="ltr"
                          className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 align-top whitespace-nowrap tabular-nums text-end"
                        >
                          {formatBytes(doc.file_size)}
                        </td>

                        <td className="py-3 px-3 text-end align-top">
                          <div className="inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPreviewDoc(doc);
                              }}
                              title={t.preview}
                              aria-label={t.preview}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                            >
                              <AppIcon name="eye" size={14} />
                            </button>
                            {canManageDoc && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDocToTrash(doc);
                                }}
                                title={t.moveToTrash}
                                aria-label={t.moveToTrash}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                              >
                                <AppIcon name="trash" size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Empty State */}
                  {!busy && !loadingFolders && !childFolders.length && !docs.length && (
                    <tr>
                      <td colSpan={showOwnerColumn ? 6 : 5} className="py-14 px-6 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 grid place-items-center mx-auto mb-3">
                          <AppIcon name="archive" size={22} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                          {t.emptyArchiveTitle}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                          {hasActiveSearch ? t.emptySearchDesc : t.emptyArchiveDesc}
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          {hasActiveSearch ? (
                            <button type="button" onClick={onResetSearch} className="btn btn-muted text-xs">
                              {t.clear}
                            </button>
                          ) : (
                            canCreate && (
                              <button type="button" onClick={onGoUpload} className="btn btn-primary text-xs">
                                <AppIcon name="plus" size={14} />
                                <span>{t.uploadDocument}</span>
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* =============================================================== */}
        {/* PANE 3: LIVE DOCUMENT INSPECTOR (Desktop Sticky Pane)           */}
        {/* =============================================================== */}
        <aside className="hidden xl:block w-[350px] 2xl:w-[385px] shrink-0 sticky top-20">
          <DocumentInspector
            doc={selectedDoc}
            token={token}
            query={query}
            canManage={canManageSelected}
            t={t}
            dir={dir}
            onOpenFullPreview={onPreviewDoc}
            onDownload={onDownloadDoc}
            onEdit={onEditDoc}
            onRequestDelete={(doc) => setDocToTrash(doc)}
          />
        </aside>
      </div>

      {/* Responsive Slide-Over Inspector Drawer for < xl screens */}
      {mobileInspectorOpen && selectedDoc && (
        <div
          className="fixed inset-0 z-50 xl:hidden bg-slate-950/55 backdrop-blur-sm flex justify-end"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileInspectorOpen(false);
          }}
        >
          <div className="w-full max-w-sm h-full bg-[#F1F5F9] dark:bg-[#0B1120] p-3 overflow-y-auto shadow-2xl">
            <DocumentInspector
              doc={selectedDoc}
              token={token}
              query={query}
              canManage={canManageSelected}
              t={t}
              dir={dir}
              onOpenFullPreview={(doc) => {
                setMobileInspectorOpen(false);
                onPreviewDoc(doc);
              }}
              onDownload={onDownloadDoc}
              onEdit={(doc) => {
                setMobileInspectorOpen(false);
                onEditDoc(doc);
              }}
              onRequestDelete={(doc) => setDocToTrash(doc)}
              onCloseMobile={() => setMobileInspectorOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal (Files & Folders -> Recycle Bin) */}
      {(docToTrash || folderToTrash) && (
        <div
          role="alertdialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[88] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !trashing) {
              setDocToTrash(null);
              setFolderToTrash(null);
            }
          }}
        >
          <div className="card max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {docToTrash ? t.confirmTrashDocTitle : t.confirmTrashFolderTitle}
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200 break-words">
                  {docToTrash ? docToTrash.file_name : folderToTrash?.name}
                </p>
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {docToTrash ? t.confirmTrashDocDesc : t.confirmTrashFolderDesc}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
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
                onClick={handleConfirmTrash}
                className="btn btn-danger text-xs"
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
