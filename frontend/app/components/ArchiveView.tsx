'use client';
import FileThumbnail from './FileThumbnail';
import DateField from './DateField';
import RenameDialog from './RenameDialog';
import { droppedFiles, importDirectoryPaths } from '../lib/uploads';
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

type ViewMode = 'list' | 'grid';
type SortOrder = 'newest' | 'oldest' | 'name' | 'size';
type QuickTypeFilter = 'all' | 'pdf' | 'image';

const VIEW_MODE_STORAGE_KEY = 'archive_yemany_view_mode';

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
  onToggleStar,
  onEditDoc,
  onDeleteDoc,
  onMoveDocsToFolder,
  onBulkTrashDocs,
  onBulkDownloadZip,
  onBulkUploadFiles,
  onDismissUploadTray,
  onRename,
  onSaveDisplaySize,
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
  onToggleStar: (doc: DocItem) => void;
  onEditDoc: (doc: DocItem) => void;
  onDeleteDoc: (doc: DocItem) => Promise<void>;
  onMoveDocsToFolder: (docIds: string[], targetFolderId: string | null) => Promise<void>;
  onBulkTrashDocs: (docIds: string[]) => Promise<void>;
  onBulkDownloadZip: (docIds: string[]) => Promise<void>;
  onBulkUploadFiles: (files: File[], targetFolderId: string | null) => Promise<void>;
  onDismissUploadTray: () => void;
  onRename: (kind: 'file' | 'folder', item: DocItem | FolderItem, name: string) => Promise<void>;
  onSaveDisplaySize: (size: number) => Promise<void>;
}) {
  const workspace = useRef<HTMLDivElement>(null);
  const [renameTarget, setRenameTarget] = useState<{ kind: 'file' | 'folder'; item: DocItem | FolderItem } | null>(null);
  const [itemSize, setItemSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(`archive-item-size:${user.id}`));
      if (saved >= 100 && saved <= 280) return saved;
    } catch { /* local storage can be restricted */ }
    return user.preferred_item_size || 160;
  });
  const saveSize = useRef(onSaveDisplaySize);
  saveSize.current = onSaveDisplaySize;
  const firstSizeEffect = useRef(true);
  useEffect(() => {
    try { localStorage.setItem(`archive-item-size:${user.id}`, String(itemSize)); } catch { /* ignore */ }
    if (firstSizeEffect.current) {
      firstSizeEffect.current = false;
      if (itemSize === (user.preferred_item_size || 160)) return;
    }
    const timer = setTimeout(() => { void saveSize.current(itemSize).catch(() => {}); }, 500);
    return () => clearTimeout(timer);
  }, [itemSize, user.id]);
  useEffect(() => {
    const element = workspace.current;
    if (!element) return;
    function zoom(event: WheelEvent) {
      if (!event.ctrlKey || !(event.target as HTMLElement).closest('.archive-items')) return;
      event.preventDefault();
      if (event.deltaY) setItemSize((size) => Math.max(100, Math.min(280, size + (event.deltaY < 0 ? 10 : -10))));
    }
    element.addEventListener('wheel', zoom, { passive: false });
    return () => element.removeEventListener('wheel', zoom);
  }, []);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  // View mode (List / Grid) + Instant Sort + Quick File Type Filter
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [quickType, setQuickType] = useState<QuickTypeFilter>('all');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${VIEW_MODE_STORAGE_KEY}:${user.id}`);
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved);
      }
    } catch {
      // ignore storage access issues
    }
  }, []);

  function handleChangeViewMode(next: ViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(`${VIEW_MODE_STORAGE_KEY}:${user.id}`, next);
    } catch {
      // ignore
    }
  }

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
  const isRtl = dir === 'rtl';

  const writableFolders = useMemo(
    () => folders.filter((f) => f.can_manage !== false),
    [folders]
  );

  // Apply quickType & sortOrder to docs without mutating source list
  const displayedDocs = useMemo(() => {
    let list = docs;
    if (quickType === 'pdf') {
      list = list.filter((d) => (d.mime_type || '').toLowerCase() === 'application/pdf');
    } else if (quickType === 'image') {
      list = list.filter((d) => (d.mime_type || '').toLowerCase().startsWith('image/'));
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortOrder === 'oldest') {
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      if (sortOrder === 'name') {
        return (a.file_name || '').localeCompare(b.file_name || '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }
      if (sortOrder === 'size') {
        return (b.file_size || 0) - (a.file_size || 0);
      }
      // newest (default)
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
    return sorted;
  }, [docs, quickType, sortOrder]);

  const totalDocsBytes = useMemo(
    () => docs.reduce((sum, d) => sum + (Number(d.file_size) || 0), 0),
    [docs]
  );

  // Keep selectedDoc and checkedDocIds synced with visible docs list
  useEffect(() => {
    const visibleIds = new Set(displayedDocs.map((d) => d.id));
    setCheckedDocIds((prev) => prev.filter((id) => visibleIds.has(id)));
    if (!displayedDocs.length) {
      setSelectedDocId(null);
      setMobileInspectorOpen(false);
      return;
    }
    setSelectedDocId((prev) => {
      if (prev && visibleIds.has(prev)) return prev;
      return displayedDocs[0].id;
    });
  }, [displayedDocs]);

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
      if (!displayedDocs.length) return;
      e.preventDefault();
      setSelectedDocId((prev) => {
        const currentIdx = prev ? displayedDocs.findIndex((d) => d.id === prev) : -1;
        if (e.key === 'ArrowDown') {
          const nextIdx = currentIdx < displayedDocs.length - 1 ? currentIdx + 1 : 0;
          return displayedDocs[nextIdx].id;
        }
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : displayedDocs.length - 1;
        return displayedDocs[prevIdx].id;
      });
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayedDocs]);

  const selectedDoc = useMemo(
    () => displayedDocs.find((d) => d.id === selectedDocId) || docs.find((d) => d.id === selectedDocId) || null,
    [displayedDocs, docs, selectedDocId]
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

  const hasActiveSearch = Boolean(query.trim()) || activeFiltersCount > 0 || quickType !== 'all';

  const childFolders = useMemo(() => {
    if (archiveScope !== 'all' || Boolean(query.trim()) || activeFiltersCount > 0) return [];
    const parentTarget = selectedFolder || null;
    return folders.filter((f) => (f.parent_id || null) === parentTarget);
  }, [archiveScope, folders, selectedFolder, query, activeFiltersCount]);

  const allDocsChecked = displayedDocs.length > 0 && checkedDocIds.length === displayedDocs.length;
  const manageableCheckedIds = useMemo(() => {
    if (!checkedDocIds.length || user.role === 'viewer') return [];
    const checkedSet = new Set(checkedDocIds);
    return displayedDocs
      .filter((d) => checkedSet.has(d.id) && d.can_manage !== false)
      .map((d) => d.id);
  }, [checkedDocIds, displayedDocs, user.role]);

  function toggleCheckDoc(docId: string) {
    setCheckedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  }

  function toggleCheckAll() {
    if (allDocsChecked) {
      setCheckedDocIds([]);
    } else {
      setCheckedDocIds(displayedDocs.map((d) => d.id));
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
    const files = await droppedFiles(e.dataTransfer);
    if (files.length > 0 || importDirectoryPaths(files).length > 0) {
      await onBulkUploadFiles(files, selectedFolder || null);
    }
  }

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

    const files = await droppedFiles(e.dataTransfer);
    if (files.length > 0 || importDirectoryPaths(files).length > 0) {
      await onBulkUploadFiles(files, folder.id);
    }
  }

  function clearSingleFilter(field: keyof ArchiveFilters) {
    const next = { ...filters, [field]: '' };
    onFiltersChange(next);
    onSearch(selectedFolder, query, next);
  }

  function handleFullReset() {
    setQuickType('all');
    onResetSearch();
  }

  const canManageSelected = Boolean(
    selectedDoc && selectedDoc.can_manage !== false && user.role !== 'viewer'
  );

  const tableColCount = showOwnerColumn ? 7 : 6;
  const hasActiveUploads = bulkUploadTasks.some((task) => task.status === 'uploading');

  const sortLabels: Record<SortOrder, string> = isRtl
    ? {
        newest: 'الأحدث أولاً',
        oldest: 'الأقدم أولاً',
        name: 'الاسم (أ - ي)',
        size: 'الأكبر حجماً',
      }
    : {
        newest: 'Newest first',
        oldest: 'Oldest first',
        name: 'Name (A–Z)',
        size: 'Largest size',
      };

  const quickTypeLabels: Record<QuickTypeFilter, string> = isRtl
    ? { all: 'الكل', pdf: 'PDF', image: 'صور' }
    : { all: 'All', pdf: 'PDF', image: 'Images' };

  return (
    <div
      ref={workspace}
      style={{ '--item-size': `${itemSize}px`, '--row-icon-size': `${Math.round(itemSize / 5)}px` } as React.CSSProperties}
      className="archive-workspace relative w-full h-full min-h-0 mx-auto"
      onDragEnter={handleWorkspaceDragEnter}
      onDragOver={handleWorkspaceDragOver}
      onDragLeave={handleWorkspaceDragLeave}
      onDrop={handleWorkspaceDrop}
    >
      {renameTarget && <RenameDialog name={renameTarget.kind === 'file' ? (renameTarget.item as DocItem).file_name : (renameTarget.item as FolderItem).name}
        file={renameTarget.kind === 'file'} t={t} onClose={() => setRenameTarget(null)}
        onSave={(name) => onRename(renameTarget.kind, renameTarget.item, name)} />}
      {/* Full-area Drag & Drop OS File Upload Overlay */}
      {draggingExternalFiles && canCreate && (
        <div className="pointer-events-none fixed inset-0 z-40 bg-[#0E7490]/14 dark:bg-[#0891B2]/20 backdrop-blur-[2px] flex items-center justify-center p-6">
          <div className="rounded-2xl border-2 border-dashed border-[#0E7490] dark:border-[#22D3EE] bg-white/95 dark:bg-[#0F2137]/95 px-8 py-7 text-center shadow-2xl max-w-md">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] grid place-items-center mb-3 ring-1 ring-[#0891B2]/25">
              <AppIcon name="upload" size={24} />
            </div>
            <h3 className="text-base font-bold text-[#0F2137] dark:text-white">
              {t.dropFilesHereTitle}
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t.dropFilesHereDesc}
            </p>
          </div>
        </div>
      )}

      {/* 2-Column Inner Split (Center Workspace + Opposite Live Document Inspector) */}
      <div className="flex h-full min-h-0 min-w-0 items-stretch gap-4 lg:gap-5">
        {/* =============================================================== */}
        {/* PANE 2: CENTER WORKSPACE                                         */}
        {/* =============================================================== */}
        <div className="flex-1 min-w-0 min-h-0 w-full flex flex-col gap-3">
          {/* 1. Executive 4-Card KPI Strip */}
          <section aria-label="Archive Summary" className="archive-summary shrink-0 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="card px-4 py-3.5 flex items-center justify-between gap-3 border-s-[3px] border-s-[#0E7490]">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {t.statDocuments}
                </div>
                <div
                  dir="ltr"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F2137] dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {displayedDocs.length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] ring-1 ring-[#0891B2]/20 grid place-items-center shrink-0">
                <AppIcon name="file" size={18} />
              </div>
            </div>

            <div className="card px-4 py-3.5 flex items-center justify-between gap-3 border-s-[3px] border-s-amber-500">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {t.statFolders}
                </div>
                <div
                  dir="ltr"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-[#0F2137] dark:text-white tabular-nums leading-tight mt-0.5 text-start"
                >
                  {folders.length}
                </div>
              </div>
              <div className="archive-folder-icon w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/45 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 grid place-items-center shrink-0">
                <AppIcon name="folder" size={18} />
              </div>
            </div>

            <div className="card px-4 py-3.5 flex items-center justify-between gap-3 border-s-[3px] border-s-[#0891B2]">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 truncate">
                  {t.sizeLabel}
                </div>
                <div
                  dir="ltr"
                  className="text-base sm:text-xl font-bold tracking-tight text-[#0F2137] dark:text-white tabular-nums leading-tight mt-1 text-start truncate"
                >
                  {formatBytes(totalDocsBytes)}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-[#132942] text-[#0891B2] dark:text-[#22D3EE] ring-1 ring-[#0891B2]/20 grid place-items-center shrink-0">
                <AppIcon name="storage" size={18} />
              </div>
            </div>

          </section>

          {/* 2. Unified Executive Search & Command Surface */}
          <section className="archive-search card shrink-0 max-h-[48dvh] overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3">
            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5"
            >
              {/* Search keeps its keyboard shortcut without a visual badge. */}
              <div className="relative flex flex-1 min-w-0 items-center gap-2">
                <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                  <AppIcon name="search" size={16} />
                </span>
                <input
                  ref={searchInputRef}
                  type="search"
                  enterKeyHint="search"
                  aria-label={t.searchPlaceholder}
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="field field-icon-start field-icon-end min-w-0 flex-1 text-xs sm:text-sm bg-slate-50/85 dark:bg-[#0B192B]/70 focus:bg-white dark:focus:bg-[#0F2137]"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => {
                      onQueryChange('');
                      onSearch(selectedFolder, '', filters);
                    }}
                    aria-label={t.clear}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-[#0F2137] dark:hover:text-slate-200 transition-colors"
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                ) : null}
              </div>

              {/* Action Controls */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`btn py-2 px-3 text-xs whitespace-nowrap shrink-0 ${
                    filtersOpen || activeFiltersCount > 0
                      ? 'border-[#0891B2]/50 dark:border-[#0891B2] bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE]'
                      : 'btn-muted'
                  }`}
                >
                  <AppIcon name="sliders" size={14} />
                  <span>{t.filters}</span>
                  {activeFiltersCount > 0 && (
                    <span
                      dir="ltr"
                      className="ms-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md bg-[#0E7490] text-white text-[11px] font-bold tabular-nums"
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

              </div>
            </form>

            {/* Quick Filter Chips + Sort + List/Grid View Switcher */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
              {/* Quick Type Segmented Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'pdf', 'image'] as QuickTypeFilter[]).map((typeKey) => {
                  const active = quickType === typeKey;
                  return (
                    <button
                      key={typeKey}
                      type="button"
                      onClick={() => setQuickType(typeKey)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#0E7490] text-white shadow-sm'
                          : 'bg-slate-100/90 dark:bg-[#132942] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#1B3654]'
                      }`}
                    >
                      {quickTypeLabels[typeKey]}
                    </button>
                  );
                })}

                {/* Active Filter Removable Chips */}
                {filters.department && (
                  <button
                    type="button"
                    onClick={() => clearSingleFilter('department')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] border border-brand-200/80 dark:border-[#0891B2]/35"
                  >
                    <span>{filters.department}</span>
                    <AppIcon name="x" size={11} />
                  </button>
                )}
                {filters.classification && (
                  <button
                    type="button"
                    onClick={() => clearSingleFilter('classification')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] border border-brand-200/80 dark:border-[#0891B2]/35"
                  >
                    <span>{filters.classification}</span>
                    <AppIcon name="x" size={11} />
                  </button>
                )}
                {filters.mime_type && (
                  <button
                    type="button"
                    onClick={() => clearSingleFilter('mime_type')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] border border-brand-200/80 dark:border-[#0891B2]/35"
                  >
                    <span dir="ltr">{filters.mime_type.split('/')[1]?.toUpperCase()}</span>
                    <AppIcon name="x" size={11} />
                  </button>
                )}
              </div>

              {/* Sort Selector + List/Grid View Switcher */}
              <div className="flex items-center gap-2 ms-auto">
                <div className="relative flex items-center">
                  <span className="pointer-events-none absolute start-2.5 text-slate-400 dark:text-slate-500">
                    <AppIcon name="sort" size={13} />
                  </span>
                  <select
                    aria-label="Sort"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#132942] text-[#0F2137] dark:text-slate-200 text-xs font-medium py-1.5 ps-7 pe-2.5 outline-none focus:border-[#0E7490]"
                  >
                    <option value="newest">{sortLabels.newest}</option>
                    <option value="oldest">{sortLabels.oldest}</option>
                    <option value="name">{sortLabels.name}</option>
                    <option value="size">{sortLabels.size}</option>
                  </select>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>{t.displaySize}</span><input type="range" min={100} max={280} step={10} value={itemSize}
                    aria-label={t.displaySize} onChange={(event) => setItemSize(Number(event.target.value))} className="w-20 accent-brand-600" />
                </label>
                <div
                  role="group"
                  aria-label="View Mode"
                  className="inline-flex items-center p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-[#0B192B]"
                >
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('list')}
                    title={t.listView}
                    aria-label={t.listView}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-[#183350] text-[#0E7490] dark:text-[#22D3EE] shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#0F2137] dark:hover:text-white'
                    }`}
                  >
                    <AppIcon name="list" size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('grid')}
                    title={t.gridView}
                    aria-label={t.gridView}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-[#183350] text-[#0E7490] dark:text-[#22D3EE] shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-[#0F2137] dark:hover:text-white'
                    }`}
                  >
                    <AppIcon name="grid" size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Collapsible Advanced Filters Panel */}
            {filtersOpen && (
              <form onSubmit={(event) => { event.preventDefault(); onSearch(); }} className="pt-3 border-t border-slate-200/80 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.departmentLabel}
                  </label>
                  <select
                    value={filters.department}
                    onChange={(e) => {
                      const next = { ...filters, department: e.target.value };
                      onFiltersChange(next);

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
                    {t.classificationLabel}
                  </label>
                  <select
                    value={filters.classification}
                    onChange={(e) => {
                      const next = { ...filters, classification: e.target.value };
                      onFiltersChange(next);

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
                    {t.fromDate}
                  </label>
                  <DateField
                    label={t.fromDate}
                    value={filters.from_date}
                    onChange={(value) => {
                      const next = { ...filters, from_date: value };
                      onFiltersChange(next);

                    }}
                    className="field text-xs py-2 min-h-[38px] tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t.toDate}
                  </label>
                  <DateField
                    label={t.toDate}
                    value={filters.to_date}
                    onChange={(value) => {
                      const next = { ...filters, to_date: value };
                      onFiltersChange(next);

                    }}
                    className="field text-xs py-2 min-h-[38px] tabular-nums"
                  />
                </div>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary py-2 px-3 text-xs flex-1"
                  >
                    {dir === 'rtl' ? 'تطبيق الفلاتر' : 'Apply filters'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFullReset}
                    className="btn btn-muted py-2 px-3 text-xs"
                  >
                    {t.clear}
                  </button>
                </div>
              </form>
            )}

            {/* Inline New Folder Creator */}
            {showNewFolder && canCreate && archiveScope === 'all' && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 shrink-0">
                  <AppIcon name="folderPlus" size={16} className="text-[#0E7490] dark:text-[#22D3EE]" />
                  <span>
                    {t.createFolderInside}:{' '}
                    <strong className="text-[#0F2137] dark:text-white">
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
            <section className="card p-3.5 space-y-2.5 border-[#0891B2]/45 dark:border-[#0891B2]/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F2137] dark:text-slate-100">
                  <AppIcon name="upload" size={15} className="text-[#0E7490] dark:text-[#22D3EE]" />
                  <span>
                    {t.uploadingFilesTitle} ({bulkUploadTasks.length})
                  </span>
                </div>
                {!hasActiveUploads && (
                  <button
                    type="button"
                    onClick={onDismissUploadTray}
                    aria-label={t.close}
                    className="p-1 rounded-md text-slate-400 hover:text-[#0F2137] dark:hover:text-slate-200"
                  >
                    <AppIcon name="x" size={14} />
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {bulkUploadTasks.map((task) => (
                  <div key={task.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-[#0F2137] dark:text-slate-200">
                        {task.fileName}
                      </span>
                      <span
                        dir="ltr"
                        className={`tabular-nums shrink-0 font-semibold ${
                          task.status === 'error'
                            ? 'text-rose-600 dark:text-rose-400'
                            : task.status === 'done'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-[#0E7490] dark:text-[#22D3EE]'
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
                            : 'bg-[#0E7490]'
                        }`}
                        style={{ width: `${Math.max(4, Math.min(100, task.progress))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Elevated White Explorer Card (List Table OR Architectural Card Grid) */}
          <section className="card flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Explorer Top Header: Breadcrumbs OR Bulk Selection Action Bar */}
            {checkedDocIds.length > 0 ? (
              <div className="px-4 py-2.5 border-b border-brand-200 dark:border-[#0891B2]/45 bg-brand-50/90 dark:bg-[#132942] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#155E75] dark:text-cyan-100">
                  <span
                    dir="ltr"
                    className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-md bg-[#0E7490] text-white text-[11px] tabular-nums"
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
              <div className="px-4 py-3 border-b border-slate-200/85 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/75 dark:bg-[#0B192B]/60">
                <nav aria-label="Breadcrumb" className="flex items-center flex-wrap gap-1 text-xs min-w-0">
                  {archiveScope === 'recent' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[#0E7490] dark:text-[#22D3EE] bg-brand-50 dark:bg-[#132942] ring-1 ring-[#0891B2]/20">
                      <AppIcon name="clock" size={13} />
                      <span>{t.navRecent}</span>
                    </span>
                  ) : archiveScope === 'starred' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-500/20">
                      <AppIcon name="starFilled" size={13} />
                      <span>{t.navStarred}</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectFolder('')}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                          !selectedFolder
                            ? 'font-bold text-[#0E7490] dark:text-[#22D3EE] bg-brand-50 dark:bg-[#132942] ring-1 ring-[#0891B2]/20'
                            : 'font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10 hover:text-[#0F2137] dark:hover:text-white'
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
                              className={`px-2.5 py-1 rounded-lg transition-colors truncate max-w-[180px] ${
                                isLast
                                  ? 'font-bold text-[#0E7490] dark:text-[#22D3EE] bg-brand-50 dark:bg-[#132942] ring-1 ring-[#0891B2]/20'
                                  : 'font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/10'
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
                      onClick={handleFullReset}
                      className="ms-2 text-[11px] font-semibold text-[#0E7490] dark:text-[#22D3EE] hover:underline"
                    >
                      {t.clear}
                    </button>
                  )}
                </nav>

                {displayedDocs.length > 0 && viewMode === 'grid' && (
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allDocsChecked}
                      onChange={toggleCheckAll}
                      className="w-3.5 h-3.5 accent-[#0E7490] rounded cursor-pointer"
                    />
                    <span>{t.selectAllFiles}</span>
                  </label>
                )}
              </div>
            )}

            {/* =========================================================== */}
            {/* VIEW MODE A: EXECUTIVE HIGH-CLARITY TABLE                   */}
            {/* =========================================================== */}
            {viewMode === 'list' ? (
              <div className="flex-1 min-h-0 overflow-auto overscroll-contain archive-items file-list-scroll">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-[#0B192B]/40">
                      <th className="py-2.5 ps-4 pe-1 w-9 text-center">
                        <input
                          type="checkbox"
                          checked={allDocsChecked}
                          disabled={displayedDocs.length === 0}
                          onChange={toggleCheckAll}
                          aria-label={t.selectAllFiles}
                          className="w-3.5 h-3.5 accent-[#0E7490] rounded cursor-pointer align-middle"
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
                      <th className="py-2.5 px-3 text-end w-28" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs sm:text-sm">
                    {/* Loading Skeleton Rows */}
                    {(busy || loadingFolders) && !displayedDocs.length && !childFolders.length && (
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

                    {/* Subfolder Rows */}
                    {childFolders.map((folder) => {
                      const canManageFolder = folder.can_manage !== false && user.role !== 'viewer';
                      const isDropTarget = dragOverFolderId === folder.id;
                      return (
                        <tr
                          key={`folder-${folder.id}`}
                          onContextMenu={(event) => { if (canManageFolder) { event.preventDefault(); setRenameTarget({ kind: 'folder', item: folder }); } }}
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
                              ? 'bg-brand-50 dark:bg-[#132942] ring-2 ring-inset ring-[#0891B2]'
                              : 'hover:bg-slate-50/90 dark:hover:bg-[#132942]/50'
                          }`}
                        >
                          <td className="py-3 ps-4 pe-1 text-center" />
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 grid place-items-center shrink-0">
                                <AppIcon name={isDropTarget ? 'folderOpen' : 'folder'} size={17} />
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-[#0F2137] dark:text-slate-100 truncate">
                                  {folder.name}
                                </div>
                                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mt-0.5 tabular-nums">
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
                          <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden md:table-cell">
                            {t.foldersTitle}
                          </td>
                          {showOwnerColumn && (
                            <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden sm:table-cell truncate max-w-[140px]">
                              {folder.owner_name || folder.owner_username || '—'}
                            </td>
                          )}
                          <td
                            dir="ltr"
                            className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden sm:table-cell whitespace-nowrap tabular-nums text-start"
                          >
                            {formatDateISO(folder.updated_at)}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-400 dark:text-slate-500 text-end">
                            —
                          </td>
                          <td className="py-3 px-3 text-end">
                            {canManageFolder && <span className="inline-flex items-center"><button type="button" onClick={(event) => { event.stopPropagation(); setRenameTarget({ kind: 'folder', item: folder }); }} aria-label={`${t.rename}: ${folder.name}`} title={t.rename}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-300"><AppIcon name="edit" size={14} /></button></span>}
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
                    {displayedDocs.map((doc) => {
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
                          onContextMenu={(event) => { if (canManageDoc) { event.preventDefault(); setRenameTarget({ kind: 'file', item: doc }); } }}
                            onDoubleClick={() => onPreviewDoc(doc)}
                          aria-selected={isSelected}
                          className={`group cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-brand-50/85 dark:bg-[#132942]/85'
                              : isChecked
                              ? 'bg-brand-50/45 dark:bg-[#132942]/45'
                              : 'hover:bg-slate-50/90 dark:hover:bg-[#132942]/35'
                          }`}
                        >
                          <td
                            className={`py-3 ps-4 pe-1 text-center align-top ${
                              isSelected ? 'border-s-[3px] border-s-[#0E7490]' : ''
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheckDoc(doc.id)}
                              aria-label={doc.file_name}
                              className="mt-1.5 w-3.5 h-3.5 accent-[#0E7490] rounded cursor-pointer"
                            />
                          </td>

                          <td className="py-3 px-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <span
                                className={`mt-0.5 w-8 h-8 rounded-lg grid place-items-center shrink-0 ring-1 ${
                                  isImg
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                                    : isPdf
                                    ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 ring-rose-500/20'
                                    : 'bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] ring-[#0891B2]/20'
                                }`}
                              >
                                <AppIcon name={isImg ? 'image' : 'file'} size={16} />
                              </span>

                              <div className="min-w-0 flex-1">
                                <div
                                  className={`font-semibold truncate leading-snug ${
                                    isSelected
                                      ? 'text-[#0E7490] dark:text-[#22D3EE]'
                                      : 'text-[#0F2137] dark:text-slate-100'
                                  }`}
                                  dir="auto"
                                >
                                  {doc.file_name}
                                </div>

                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                  {doc.folder_breadcrumb && (
                                    <>
                                      <span className="truncate max-w-[200px]" dir="auto">
                                        {doc.folder_breadcrumb}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  )}
                                  <span className={`inline-flex items-center gap-1 ${statusMeta.textClass}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                                    <span>{statusMeta.label}</span>
                                  </span>
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
                              <div className="text-xs font-medium text-[#0E7490] dark:text-[#22D3EE] truncate max-w-[140px] mt-0.5">
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
                            className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300 hidden sm:table-cell align-top whitespace-nowrap tabular-nums text-start"
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
                            <div className="inline-flex flex-wrap items-center justify-end gap-0.5">
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
                                    : 'text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/10'
                                }`}
                              >
                                <AppIcon name={doc.is_starred ? 'starFilled' : 'star'} size={14} />
                              </button>


                              {canManageDoc && <button type="button" onClick={(event) => { event.stopPropagation(); setRenameTarget({ kind: 'file', item: doc }); }}
                                aria-label={`${t.rename}: ${doc.file_name}`} title={t.rename} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-300"><AppIcon name="edit" size={14} /></button>}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPreviewDoc(doc);
                                }}
                                title={t.preview}
                                aria-label={t.preview}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0E7490] dark:hover:text-[#22D3EE] hover:bg-brand-50 dark:hover:bg-white/10 transition-colors"
                              >
                                <AppIcon name="eye" size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Empty State */}
                    {!busy && !loadingFolders && !childFolders.length && !displayedDocs.length && (
                      <tr>
                        <td colSpan={tableColCount} className="py-16 px-6 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] border border-brand-200/70 dark:border-[#0891B2]/25 text-[#0E7490] dark:text-[#22D3EE] grid place-items-center mx-auto mb-3.5">
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
                          <h3 className="text-sm font-bold text-[#0F2137] dark:text-slate-100">
                            {t.emptyArchiveTitle}
                          </h3>
                          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                            {hasActiveSearch ? t.emptySearchDesc : t.emptyArchiveDesc}
                          </p>
                          <div className="mt-4 flex items-center justify-center gap-2">
                            {hasActiveSearch ? (
                              <button type="button" onClick={handleFullReset} className="btn btn-muted text-xs">
                                {t.clear}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* =========================================================== */
              /* VIEW MODE B: ARCHITECTURAL LUXURY CARD GRID                 */
              /* =========================================================== */
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain archive-items archive-grid-scroll p-4 sm:p-5 space-y-5 bg-[#F8FAFC]/60 dark:bg-[#0B192B]/30">
                {/* Subfolder Cards */}
                {childFolders.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      {t.foldersTitle} ({childFolders.length})
                    </h3>
                    <div className="archive-item-grid grid gap-3">
                      {childFolders.map((folder) => {
                        const canManageFolder = folder.can_manage !== false && user.role !== 'viewer';
                        const isDropTarget = dragOverFolderId === folder.id;
                        return (
                          <div
                            key={`grid-folder-${folder.id}`}
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
                            className={`group card card-interactive p-3.5 flex items-center justify-between gap-3 cursor-pointer ${
                              isDropTarget ? 'ring-2 ring-[#0891B2] bg-brand-50/70 dark:bg-[#132942]' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="archive-folder-icon w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 grid place-items-center shrink-0">
                                <AppIcon name={isDropTarget ? 'folderOpen' : 'folder'} size={19} />
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-[#0F2137] dark:text-white truncate">
                                  {folder.name}
                                </div>
                                <div className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums mt-0.5">
                                  {folder.item_count || 0} {t.itemsCount}
                                </div>
                              </div>
                            </div>
                            {canManageFolder && <span className="inline-flex items-center"><button type="button" onClick={(event) => { event.stopPropagation(); setRenameTarget({ kind: 'folder', item: folder }); }} aria-label={`${t.rename}: ${folder.name}`} title={t.rename}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-300"><AppIcon name="edit" size={14} /></button></span>}
                            {canManageFolder && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderToTrash(folder);
                                }}
                                title={t.moveToTrash}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              >
                                <AppIcon name="trash" size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Document Cards */}
                {displayedDocs.length > 0 && (
                  <div className="space-y-2.5">
                    {childFolders.length > 0 && (
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        {t.filesTitle} ({displayedDocs.length})
                      </h3>
                    )}
                    <div className="archive-item-grid grid gap-3.5">
                      {displayedDocs.map((doc) => {
                        const isSelected = doc.id === selectedDocId;
                        const isChecked = checkedDocIds.includes(doc.id);
                        const isImg = (doc.mime_type || '').toLowerCase().startsWith('image/');
                        const isPdf = (doc.mime_type || '').toLowerCase() === 'application/pdf';
                        const statusMeta = statusDisplayMeta(doc.status, t);
                        const canManageDoc = doc.can_manage !== false && user.role !== 'viewer';
                        const snippetText =
                          doc.snippet ||
                          (query.trim() && doc.extracted_text
                            ? doc.extracted_text.slice(0, 140)
                            : doc.summary || null);

                        return (
                          <div
                            key={`grid-doc-${doc.id}`}
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
                            onContextMenu={(event) => { if (canManageDoc) { event.preventDefault(); setRenameTarget({ kind: 'file', item: doc }); } }}
                            onDoubleClick={() => onPreviewDoc(doc)}
                            className={`group card card-interactive p-4 flex flex-col justify-between cursor-pointer ${
                              isSelected
                                ? 'ring-2 ring-[#0E7490] dark:ring-[#22D3EE] bg-brand-50/40 dark:bg-[#132942]/80'
                                : ''
                            }`}
                          >
                            <div>
                              {/* Card Top Row */}
                              <FileThumbnail doc={doc} token={token} />
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleCheckDoc(doc.id)}
                                    aria-label={doc.file_name}
                                    className="w-3.5 h-3.5 accent-[#0E7490] rounded cursor-pointer"
                                  />
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                      isImg
                                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                        : isPdf
                                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                                        : 'bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE]'
                                    }`}
                                  >
                                    <AppIcon name={isImg ? 'image' : 'file'} size={13} />
                                    <span dir="ltr">{isPdf ? 'PDF' : isImg ? 'IMG' : 'DOC'}</span>
                                  </span>
                                </div>

                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleStar(doc);
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                      doc.is_starred
                                        ? 'text-amber-500'
                                        : 'text-slate-300 dark:text-slate-600 hover:text-amber-500'
                                    }`}
                                  >
                                    <AppIcon name={doc.is_starred ? 'starFilled' : 'star'} size={14} />
                                  </button>
                                  {canManageDoc && <button type="button" onClick={(event) => { event.stopPropagation(); setRenameTarget({ kind: 'file', item: doc }); }}
                                aria-label={`${t.rename}: ${doc.file_name}`} title={t.rename} className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 dark:text-slate-300"><AppIcon name="edit" size={14} /></button>}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onPreviewDoc(doc);
                                    }}
                                    title={t.preview}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0E7490] dark:hover:text-[#22D3EE] hover:bg-brand-50 dark:hover:bg-white/10"
                                  >
                                    <AppIcon name="eye" size={14} />
                                  </button>
                                </div>
                              </div>

                              {/* Title */}
                              <h4
                                className={`text-sm font-bold leading-snug line-clamp-2 ${
                                  isSelected
                                    ? 'text-[#0E7490] dark:text-[#22D3EE]'
                                    : 'text-[#0F2137] dark:text-white'
                                }`}
                                dir="auto"
                              >
                                {doc.file_name}
                              </h4>

                              {/* Badges */}
                              {(doc.department || doc.classification) && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {doc.department && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-[#0B192B] text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                                      {doc.department}
                                    </span>
                                  )}
                                  {doc.classification && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] truncate max-w-[130px]">
                                      {doc.classification}
                                    </span>
                                  )}
                                </div>
                              )}

                              {snippetText && (
                                <p
                                  className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed"
                                  dir="auto"
                                >
                                  {renderHighlightedText(snippetText, query)}
                                </p>
                              )}
                            </div>

                            {/* Card Footer */}
                            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span className={`inline-flex items-center gap-1 font-semibold ${statusMeta.textClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                                <span>{statusMeta.label}</span>
                              </span>
                              <span dir="ltr" className="tabular-nums">
                                {formatBytes(doc.file_size)} · {formatDateISO(doc.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty State in Grid View */}
                {!busy && !loadingFolders && !childFolders.length && !displayedDocs.length && (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] border border-brand-200/70 dark:border-[#0891B2]/25 text-[#0E7490] dark:text-[#22D3EE] grid place-items-center mx-auto mb-3">
                      <AppIcon name="archive" size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0F2137] dark:text-slate-100">
                      {t.emptyArchiveTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                      {hasActiveSearch ? t.emptySearchDesc : t.emptyArchiveDesc}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        {/* =============================================================== */}
        {/* PANE 3: LIVE DOCUMENT INSPECTOR (Desktop Sticky Pane)           */}
        {/* =============================================================== */}
        <aside className="hidden xl:block w-[310px] 2xl:w-[360px] min-h-0 h-full overflow-y-auto overscroll-contain shrink-0">
          <DocumentInspector
            doc={selectedDoc}
            token={token}
            query={query}
            canManage={canManageSelected}
            canPrint={canPrint}
            t={t}
            dir={dir}
            onOpenFullPreview={onPreviewDoc}
            onToggleStar={onToggleStar}
            onEdit={onEditDoc}
          />
        </aside>
      </div>

      {/* Responsive Slide-Over Inspector Drawer for < xl screens */}
      {mobileInspectorOpen && selectedDoc && (
        <div
          className="fixed inset-0 z-50 xl:hidden bg-[#091524]/60 backdrop-blur-sm flex justify-end"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileInspectorOpen(false);
          }}
        >
          <div className="w-full max-w-sm h-full bg-[#F1F5F9] dark:bg-[#0A1626] p-3 overflow-y-auto shadow-2xl">
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
                onToggleStar={onToggleStar}
                onEdit={(doc) => {
                setMobileInspectorOpen(false);
                onEditDoc(doc);
              }}
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
          className="fixed inset-0 z-[88] bg-[#091524]/65 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setShowBulkMoveModal(false);
          }}
        >
          <form onSubmit={handleConfirmBulkMove} className="card-elevated w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                {t.bulkMoveModalTitle} ({manageableCheckedIds.length})
              </h3>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => setShowBulkMoveModal(false)}
                className="p-1 text-slate-400 hover:text-[#0F2137] dark:hover:text-slate-200"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>
            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
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
          className="fixed inset-0 z-[88] bg-[#091524]/65 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !bulkBusy) setShowBulkTrashModal(false);
          }}
        >
          <div className="card-elevated w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                  {t.bulkTrashModalTitle} ({manageableCheckedIds.length})
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
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

      {/* Soft Delete Confirmation Modal */}
      {(docToTrash || folderToTrash) && (
        <div
          role="alertdialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[88] bg-[#091524]/65 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !trashing) {
              setDocToTrash(null);
              setFolderToTrash(null);
            }
          }}
        >
          <div className="card-elevated w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={19} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                  {docToTrash ? t.confirmTrashDocTitle : t.confirmTrashFolderTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {docToTrash ? t.confirmTrashDocDesc : t.confirmTrashFolderDesc}
                </p>
                <p className="mt-2 text-xs font-semibold text-[#0F2137] dark:text-slate-200 truncate">
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
