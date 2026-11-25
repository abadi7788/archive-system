'use client';
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { statusDisplayMeta, type TranslationKeys } from '../lib/i18n';
import DocumentInspector, { renderHighlightedText } from './DocumentInspector';
import {
  ArchiveFilters,
  ArchiveScope,
  BulkUploadTask,
  DocItem,
  FolderItem,
  OwnerSummary,
  User,
  formatBytes,
  formatDateISO,
} from './types';

export const DRAG_DOC_IDS_MIME = 'application/x-archive-doc-ids';

export default function ArchiveView({
  user,
  token,
  canPrint,
  archiveScope,
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
  bulkUploadTasks,
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
  onPrintDoc,
  onToggleStar,
  onEditDoc,
  onDownloadDoc,
  onDeleteDoc,
  onMoveDocsToFolder,
  onBulkTrashDocs,
  onBulkDownloadZip,
  onBulkUploadFiles,
  onDismissUploadTray,
  onGoUpload,
}: {
  user: User;
  token: string;
  canPrint: boolean;
  archiveScope: ArchiveScope;
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
  bulkUploadTasks: BulkUploadTask[];
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
  onPrintDoc: (doc: DocItem) => void;
  onToggleStar: (doc: DocItem) => void;
  onEditDoc: (doc: DocItem) => void;
  onDownloadDoc: (doc: DocItem) => void;
  onDeleteDoc: (doc: DocItem) => Promise<void>;
  onMoveDocsToFolder: (docIds: string[], targetFolderId: string | null) => Promise<void>;
  onBulkTrashDocs: (docIds: string[]) => Promise<void>;
  onBulkDownloadZip: (docIds: string[]) => Promise<void>;
  onBulkUploadFiles: (files: File[], targetFolderId: string | null) => Promise<void>;
  onDismissUploadTray: () => void;
  onGoUpload: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // Live Document Inspector selection state
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  // Multi-select checkboxes for Bulk Actions
  const [checkedDocIds, setCheckedDocIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [bulkTargetFolderId, setBulkTargetFolderId] = useState<string>('');
  const [showBulkTrashModal, setShowBulkTrashModal] = useState(false);

  // Drag & Drop (OS files upload + Drag-to-Folder move)
  const [draggingExternalFiles, setDraggingExternalFiles] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const dragDepthRef = useRef(0);

  // Soft-delete modals
  const [docToTrash, setDocToTrash] = useState<DocItem | null>(null);
  const [folderToTrash, setFolderToTrash] = useState<FolderItem | null>(null);
  const [trashing, setTrashing] = useState(false);

  const canCreate = user.role !== 'viewer';
  const showOwnerColumn = user.role === 'admin' || visibleOwners.length > 1;
  const writableFolders = useMemo(
    () => folders.filter((f) => f.can_manage !== false),
    [folders]
  );

  // Keep selectedDoc and checkedDocIds synced with visible docs list
  useEffect(() => {
    const visibleIds = new Set(docs.map((d) => d.id));
    setCheckedDocIds((prev) => prev.filter((id) => visibleIds.has(id)));
    if (!docs.length) {
      setSelectedDocId(null);
      setMobileInspectorOpen(false);
      return;
    }
    setSelectedDocId((prev) => {
      if (prev && visibleIds.has(prev)) return prev;
      return docs[0].id;
    });
  }, [docs]);

  // Keyboard shortcuts: Ctrl+K / Cmd+K focuses search; ArrowUp / ArrowDown navigates document rows
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() || '';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      if (!docs.length) return;
      e.preventDefault();
      setSelectedDocId((prev) => {
        const currentIdx = prev ? docs.findIndex((d) => d.id === prev) : -1;
        if (e.key === 'ArrowDown') {
          const nextIdx = currentIdx < docs.length - 1 ? currentIdx + 1 : 0;
          return docs[nextIdx].id;
        }
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : docs.length - 1;
        return docs[prevIdx].id;
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // Subfolders visible at current folder level (only in 'all' archive scope without active search)
  const childFolders = useMemo(() => {
    if (archiveScope !== 'all' || hasActiveSearch) return [];
    const parentTarget = selectedFolder || null;
    return folders.filter((f) => (f.parent_id || null) === parentTarget);
  }, [archiveScope, folders, selectedFolder, hasActiveSearch]);

  const linkedEmployeesCount = useMemo(() => {
    if (user.role === 'admin') {
      return visibleOwners.length;
    }
    return visibleOwners.filter((o) => o.id !== user.id).length;
  }, [visibleOwners, user.id, user.role]);

  const allDocsChecked = docs.length > 0 && checkedDocIds.length === docs.length;
  const manageableCheckedIds = useMemo(() => {
    if (!checkedDocIds.length || user.role === 'viewer') return [];
    const checkedSet = new Set(checkedDocIds);
    return docs
      .filter((d) => checkedSet.has(d.id) && d.can_manage !== false)
      .map((d) => d.id);
  }, [checkedDocIds, docs, user.role]);

  function toggleCheckDoc(docId: string) {
    setCheckedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  function toggleCheckAll() {
    if (allDocsChecked) {
      setCheckedDocIds([]);
    } else {
      setCheckedDocIds(docs.map((d) => d.id));
    }
  }

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

  async function handleConfirmBulkMove(e: FormEvent) {
    e.preventDefault();
    if (!manageableCheckedIds.length) return;
    setBulkBusy(true);
    try {
      await onMoveDocsToFolder(manageableCheckedIds, bulkTargetFolderId || null);
      setShowBulkMoveModal(false);
      setCheckedDocIds([]);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleConfirmBulkTrash() {
    if (!manageableCheckedIds.length) return;
    setBulkBusy(true);
    try {
      await onBulkTrashDocs(manageableCheckedIds);
      setShowBulkTrashModal(false);
      setCheckedDocIds([]);
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkZipClick() {
    if (!checkedDocIds.length) return;
    setBulkBusy(true);
    try {
      await onBulkDownloadZip(checkedDocIds);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleSelectRow(doc: DocItem) {
    setSelectedDocId(doc.id);
    if (typeof window !== 'undefined' && window.innerWidth < 1280) {
      setMobileInspectorOpen(true);
    }
  }

  // Workspace-level drag & drop for OS files
  function isExternalFileDrag(e: React.DragEvent): boolean {
    const types = Array.from(e.dataTransfer?.types || []);
    return types.includes('Files') && !types.includes(DRAG_DOC_IDS_MIME);
  }

  function handleWorkspaceDragEnter(e: React.DragEvent) {
    if (!canCreate || !isExternalFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDraggingExternalFiles(true);
  }

  function handleWorkspaceDragOver(e: React.DragEvent) {
    if (!canCreate || !isExternalFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleWorkspaceDragLeave(e: React.DragEvent) {
    if (!canCreate || !isExternalFileDrag(e)) return;
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setDraggingExternalFiles(false);
    }
  }

  async function handleWorkspaceDrop(e: React.DragEvent) {
    if (!canCreate) return;
    if (e.dataTransfer.types.includes(DRAG_DOC_IDS_MIME)) {
      setDraggingExternalFiles(false);
      dragDepthRef.current = 0;
      return;
    }
    e.preventDefault();
    dragDepthRef.current = 0;
    setDraggingExternalFiles(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await onBulkUploadFiles(files, selectedFolder || null);
    }
  }

  // Folder row drop target (accepts BOTH dragged archive documents AND external OS files)
  async function handleFolderRowDrop(e: React.DragEvent, folder: FolderItem) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setDraggingExternalFiles(false);
    dragDepthRef.current = 0;

    if (!canCreate || folder.can_manage === false) return;

    const rawDocIds = e.dataTransfer.getData(DRAG_DOC_IDS_MIME);
    if (rawDocIds) {
      try {
        const ids: string[] = JSON.parse(rawDocIds);
        if (Array.isArray(ids) && ids.length > 0) {
          await onMoveDocsToFolder(ids, folder.id);
          setCheckedDocIds((prev) => prev.filter((id) => !ids.includes(id)));
        }
      } catch {
        // ignore invalid drag payload
      }
      return;
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      await onBulkUploadFiles(files, folder.id);
    }
  }

  const canManageSelected = Boolean(
    selectedDoc && selectedDoc.can_manage !== false && user.role !== 'viewer'
  );

  const tableColCount = (showOwnerColumn ? 7 : 6);
  const hasActiveUploads = bulkUploadTasks.some((task) => task.status === 'uploading');

  return (
    <div
      className="relative w-full max-w-[1680px] mx-auto"
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      {/* Full-area Drag & Drop OS File Upload Overlay */}
      {draggingExternalFiles && canCreate && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-blue-600/12 dark:bg-blue-500/15 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="rounded-2xl border-2 border-dashed border-blue-600 dark:border-blue-400 bg-white/95 dark:bg-slate-900/95 px-8 py-7 text-center shadow-2xl max-w-md">
            <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 grid place-items-center mb-3">
              <AppIcon name="upload" size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t.dropFilesHereTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t.dropFilesHereDesc}
            </p>
          </div>
        </div>
      )}

      {/* 2-Column Inner Split (Center Workspace + Opposite Live Document Inspector = 3 Panes total with Sidebar) */}
      <div className="flex flex-col xl:flex-row items-start gap-4 lg:gap-5">
        {/* =============================================================== */}
        {/* PANE 2: CENTER WORKSPACE (Toolbar + 3 KPIs + Elevated Table)     */}
        {/* =============================================================== */}
        <div className="flex-1 min-w-0 w-full space-y-4">
          {/* 1. Unified Compact Top Toolbar */}
          <section className="card p-3.5 sm:p-4 space-y-3">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
            >
              {/* Search Bar (Ctrl+K shortcut) */}
              <div className="relative flex-1 min-w-0">
                <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <AppIcon name="search" size={16} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="field field-icon-start pe-14 text-xs sm:text-sm bg-slate-50/80 dark:bg-slate-950/60 focus:bg-white dark:focus:bg-slate-900"
                />
                {query ? (
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
                ) : (
                  <kbd
                    dir="ltr"
                    className="hidden sm:inline-flex pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 items-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-semibold text-slate-400 dark:text-slate-500"
                  >
                    Ctrl+K
                  </kbd>
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

                {canCreate && archiveScope === 'all' && (
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
            {showNewFolder && canCreate && archiveScope === 'all' && (
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

          {/* Live Bulk Drag & Drop Upload Progress Tray */}
          {bulkUploadTasks.length > 0 && (
            <section className="card p-3.5 space-y-2.5 border-blue-200/90 dark:border-blue-800/70">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <AppIcon name="upload" size={15} className="text-blue-600 dark:text-blue-400" />
                  <span>
                    {t.uploadingFilesTitle} ({bulkUploadTasks.length})
                  </span>
                </div>
                {!hasActiveUploads && (
                  <button
                    type="button"
                    onClick={onDismissUploadTray}
                    aria-label={t.close}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {bulkUploadTasks.map((task) => (
                  <div key={task.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                        {task.fileName}
                      </span>
                      <span
                        dir="ltr"
                        className={`tabular-nums shrink-0 font-semibold ${
                          task.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : task.status === 'done'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {task.status === 'error' ? task.error || 'Error' : `${task.progress}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-150 ${
                          task.status === 'error'
                            ? 'bg-rose-500'
                            : task.status === 'done'
                            ? 'bg-emerald-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, task.progress))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 2. Unified Executive Metric Strip (Single cohesive surface with hairline dividers) */}
          <section
            aria-label="Archive Summary"
            className="card grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse divide-slate-200/75 dark:divide-slate-800/80 overflow-hidden"
          >
            <div className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {t.statDocuments}
                </div>
                <div
                  dir="ltr"
                  className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {docs.length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600/10 dark:ring-blue-400/20 grid place-items-center shrink-0">
                <AppIcon name="file" size={18} />
              </div>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {t.statFolders}
                </div>
                <div
                  dir="ltr"
                  className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {folders.length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50/90 dark:bg-amber-950/45 text-amber-600 dark:text-amber-400 ring-1 ring-amber-600/10 dark:ring-amber-400/20 grid place-items-center shrink-0">
                <AppIcon name="folder" size={18} />
              </div>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {t.statLinkedEmployees}
                </div>
                <div
                  dir="ltr"
                  className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {linkedEmployeesCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-600/10 dark:ring-emerald-400/20 grid place-items-center shrink-0">
                <AppIcon name="users" size={18} />
              </div>
            </div>
          </section>

          {/* 3. Elevated White Files & Folders Table (ZERO PDF/Excel export buttons) */}
          <section className="card overflow-hidden">
            {/* Table Top Header: Breadcrumbs OR Bulk Selection Action Bar */}
            {checkedDocIds.length > 0 ? (
              <div className="px-4 py-2.5 border-b border-blue-200 dark:border-blue-800/80 bg-blue-50/90 dark:bg-blue-950/40 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200">
                  <span
                    dir="ltr"
                    className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md bg-blue-600 text-white text-[11px] tabular-nums"
                  >
                    {checkedDocIds.length}
                  </span>
                  <span>{t.bulkSelectedLabel}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {manageableCheckedIds.length > 0 && (
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => {
                        setBulkTargetFolderId(selectedFolder || '');
                        setShowBulkMoveModal(true);
                      }}
                      className="btn btn-muted py-1.5 px-2.5 text-xs"
                    >
                      <AppIcon name="folderMove" size={14} />
                      <span>{t.bulkMoveToFolder}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={handleBulkZipClick}
                    className="btn btn-muted py-1.5 px-2.5 text-xs"
                  >
                    <AppIcon name="zip" size={14} />
                    <span>{t.bulkDownloadZip}</span>
                  </button>

                  {manageableCheckedIds.length > 0 && (
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => setShowBulkTrashModal(true)}
                      className="btn py-1.5 px-2.5 text-xs border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                    >
                      <AppIcon name="trash" size={14} />
                      <span>{t.bulkDeleteSelected}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setCheckedDocIds([])}
                    className="btn btn-muted py-1.5 px-2.5 text-xs"
                  >
                    {t.bulkClearSelection}
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/60 dark:bg-slate-900/60">
                <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs min-w-0">
                  {archiveScope === 'recent' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-blue-700 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/50">
                      <AppIcon name="clock" size={13} />
                      <span>{t.navRecent}</span>
                    </span>
                  ) : archiveScope === 'starred' ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md font-bold text-amber-700 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/40">
                      <AppIcon name="starFilled" size={13} />
                      <span>{t.navStarred}</span>
                    </span>
                  ) : (
                    <>
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
                    </>
                  )}
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
              </div>
            )}

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/75 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/75">
                    <th className="py-2.5 ps-4 pe-1 w-9 text-center">
                      <input
                        type="checkbox"
                        checked={allDocsChecked}
                        disabled={docs.length === 0}
                        onChange={toggleCheckAll}
                        aria-label={t.selectAllFiles}
                        className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer align-middle"
                      />
                    </th>
                    <th className="py-2.5 px-3 text-start">{t.fileNameLabel}</th>
                    <th className="py-2.5 px-3 text-start hidden md:table-cell">{t.departmentLabel}</th>
                    {showOwnerColumn && (
                      <th className="py-2.5 px-3 text-start hidden sm:table-cell">{t.ownerLabel}</th>
                    )}
                    <th className="py-2.5 px-3 text-start hidden sm:table-cell whitespace-nowrap">
                      {t.dateLabel}
                    </th>
                    <th className="py-2.5 px-3 text-end whitespace-nowrap">{t.sizeLabel}</th>
                    <th className="py-2.5 px-3 text-end w-24" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                  {/* Loading Skeleton Rows */}
                  {(busy || loadingFolders) && !docs.length && !childFolders.length && (
                    <>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={`sk-${i}`} className="animate-pulse">
                          <td className="py-3.5 ps-4 pe-1">
                            <div className="w-3.5 h-3.5 rounded bg-slate-200/80 dark:bg-slate-800 mx-auto" />
                          </td>
                          <td className="py-3.5 px-3">
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

                  {/* Subfolder Rows (Drop Targets for Drag-to-Folder Move & Direct Upload) */}
                  {childFolders.map((folder) => {
                    const canManageFolder = folder.can_manage !== false && user.role !== 'viewer';
                    const isDropTarget = dragOverFolderId === folder.id;
                    return (
                      <tr
                        key={`folder-${folder.id}`}
                        onClick={() => onSelectFolder(folder.id)}
                        onDragOver={(e) => {
                          if (!canManageFolder) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverFolderId(folder.id);
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          if (dragOverFolderId === folder.id) setDragOverFolderId(null);
                        }}
                        onDrop={(e) => handleFolderRowDrop(e, folder)}
                        title={canManageFolder ? t.dropOntoFolderHint : undefined}
                        className={`group cursor-pointer transition-colors ${
                          isDropTarget
                            ? 'bg-blue-50 dark:bg-blue-950/60 ring-2 ring-inset ring-blue-500'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <td className="py-3 ps-4 pe-1 text-center" />
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 grid place-items-center shrink-0">
                              <AppIcon name={isDropTarget ? 'folderOpen' : 'folder'} size={17} />
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

                  {/* Document Rows (Draggable to Folders + Multi-select + Star + Optional Print) */}
                  {docs.map((doc) => {
                    const isSelected = doc.id === selectedDocId;
                    const isChecked = checkedDocIds.includes(doc.id);
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
                        draggable={canManageDoc}
                        onDragStart={(e) => {
                          if (!canManageDoc) return;
                          const idsToDrag =
                            isChecked && manageableCheckedIds.length > 0
                              ? manageableCheckedIds
                              : [doc.id];
                          e.dataTransfer.setData(DRAG_DOC_IDS_MIME, JSON.stringify(idsToDrag));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onClick={() => handleSelectRow(doc)}
                        onDoubleClick={() => onPreviewDoc(doc)}
                        aria-selected={isSelected}
                        className={`group cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/90 dark:bg-blue-950/40'
                            : isChecked
                            ? 'bg-blue-50/45 dark:bg-blue-950/25'
                            : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/45'
                        }`}
                      >
                        <td
                          className="py-3 ps-4 pe-1 text-center align-top"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheckDoc(doc.id)}
                            aria-label={doc.file_name}
                            className="mt-1.5 w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                          />
                        </td>

                        <td className="py-3 px-3">
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
                                onToggleStar(doc);
                              }}
                              title={doc.is_starred ? t.removeFromStarred : t.addToStarred}
                              aria-label={doc.is_starred ? t.removeFromStarred : t.addToStarred}
                              className={`p-1.5 rounded-lg transition-colors ${
                                doc.is_starred
                                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <AppIcon name={doc.is_starred ? 'starFilled' : 'star'} size={14} />
                            </button>

                            {canPrint && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPrintDoc(doc);
                                }}
                                title={t.print}
                                aria-label={t.print}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors"
                              >
                                <AppIcon name="printer" size={14} />
                              </button>
                            )}

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
                      <td colSpan={tableColCount} className="py-14 px-6 text-center">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 grid place-items-center mx-auto mb-3">
                          <AppIcon
                            name={
                              archiveScope === 'starred'
                                ? 'star'
                                : archiveScope === 'recent'
                                ? 'clock'
                                : 'archive'
                            }
                            size={22}
                          />
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
            canPrint={canPrint}
            t={t}
            dir={dir}
            onOpenFullPreview={onPreviewDoc}
            onPrintDoc={onPrintDoc}
            onToggleStar={onToggleStar}
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
              canPrint={canPrint}
              t={t}
              dir={dir}
              onOpenFullPreview={(doc) => {
                setMobileInspectorOpen(false);
                onPreviewDoc(doc);
              }}
              onPrintDoc={onPrintDoc}
              onToggleStar={onToggleStar}
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

      {/* Bulk Move to Folder Modal */}
      {showBulkMoveModal && (
        <div
          role="dialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[88] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setShowBulkMoveModal(false);
          }}
        >
          <form onSubmit={handleConfirmBulkMove} className="card w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.bulkMoveModalTitle} ({manageableCheckedIds.length})
              </h3>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkMoveModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.targetFolderLabel}
              <select
                className="field mt-1.5"
                value={bulkTargetFolderId}
                onChange={(e) => setBulkTargetFolderId(e.target.value)}
              >
                <option value="">{t.noFolderRoot}</option>
                {writableFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path && f.path !== '/' ? `${f.path}/${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkMoveModal(false)}
                className="btn btn-muted text-xs"
              >
                {t.cancel}
              </button>
              <button type="submit" disabled={bulkBusy} className="btn btn-primary text-xs px-5">
                {bulkBusy ? t.saving : t.bulkMoveConfirm}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Trash Confirmation Modal */}
      {showBulkTrashModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[88] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setShowBulkTrashModal(false);
          }}
        >
          <div className="card w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t.bulkTrashModalTitle} ({manageableCheckedIds.length})
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t.bulkTrashModalDesc}
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkTrashModal(false)}
                className="btn btn-muted text-xs"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleConfirmBulkTrash}
                className="btn btn-danger text-xs px-4"
              >
                {bulkBusy ? t.movingToTrash : t.moveToTrashConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soft Delete Confirmation Modal (Single File or Folder -> Recycle Bin) */}
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
          <div className="card w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {docToTrash ? t.confirmTrashDocTitle : t.confirmTrashFolderTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {docToTrash ? t.confirmTrashDocDesc : t.confirmTrashFolderDesc}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {docToTrash ? docToTrash.file_name : folderToTrash?.name}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
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
