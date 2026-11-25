'use client';
import React, { useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';
import { DocItem, FolderItem, TrashData, User, formatBytes, formatDateISO } from './types';

export default function TrashView({
  user,
  trash,
  loading,
  t,
  dir,
  onRestoreDoc,
  onRestoreFolder,
  onPermanentDeleteDoc,
  onPermanentDeleteFolder,
  onEmptyTrash,
}: {
  user: User;
  trash: TrashData;
  loading: boolean;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onRestoreDoc: (doc: DocItem) => Promise<void>;
  onRestoreFolder: (folder: FolderItem) => Promise<void>;
  onPermanentDeleteDoc: (doc: DocItem) => Promise<void>;
  onPermanentDeleteFolder: (folder: FolderItem) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
}) {
  const isAdmin = user.role === 'admin';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<
    | { kind: 'doc'; item: DocItem }
    | { kind: 'folder'; item: FolderItem }
    | { kind: 'empty' }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRestore(kind: 'doc' | 'folder', item: DocItem | FolderItem) {
    setBusyId(item.id);
    try {
      if (kind === 'doc') {
        await onRestoreDoc(item as DocItem);
      } else {
        await onRestoreFolder(item as FolderItem);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmPermanent() {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      if (confirmTarget.kind === 'doc') {
        await onPermanentDeleteDoc(confirmTarget.item);
      } else if (confirmTarget.kind === 'folder') {
        await onPermanentDeleteFolder(confirmTarget.item);
      } else {
        await onEmptyTrash();
      }
      setConfirmTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header Bar */}
      <div className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>{t.trashTitle}</span>
            <span dir="ltr" className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
              ({trash.total_count})
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin ? t.trashSubtitleAdmin : t.trashSubtitleEmployee}
          </p>
        </div>

        {isAdmin && trash.total_count > 0 && (
          <button
            type="button"
            onClick={() => setConfirmTarget({ kind: 'empty' })}
            className="btn btn-danger text-xs shrink-0"
          >
            <AppIcon name="trash" size={15} />
            <span>{t.emptyTrash}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60" />
              </div>
              <div className="h-8 w-24 rounded-lg bg-slate-100 dark:bg-slate-800/70" />
            </div>
          ))}
        </div>
      ) : trash.total_count === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 grid place-items-center mb-3">
            <AppIcon name="trash" size={22} />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t.trashEmptyTitle}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.trashEmptyDesc}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Trashed Folders */}
          {trash.folders.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.foldersTitle} · <span dir="ltr" className="tabular-nums">{trash.folders.length}</span>
              </h3>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {trash.folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 grid place-items-center shrink-0">
                        <AppIcon name="folder" size={18} />
                      </span>
                      <div className="min-w-0">
                        <b className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {folder.name}
                        </b>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                          {folder.owner_name && <span>{folder.owner_name}</span>}
                          {folder.deleted_at && (
                            <>
                              {folder.owner_name && <span aria-hidden="true">·</span>}
                              <span>
                                {t.deletedOn}:{' '}
                                <span dir="ltr" className="tabular-nums">{formatDateISO(folder.deleted_at)}</span>
                              </span>
                            </>
                          )}
                          {isAdmin && folder.deleted_by_name && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>
                                {t.deletedBy}: {folder.deleted_by_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyId === folder.id}
                        onClick={() => handleRestore('folder', folder)}
                        className="btn btn-muted text-xs py-1.5 px-3"
                      >
                        <AppIcon name="restore" size={14} />
                        <span>{busyId === folder.id ? t.restoring : t.restore}</span>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setConfirmTarget({ kind: 'folder', item: folder })}
                          className="btn btn-danger text-xs py-1.5 px-3"
                        >
                          <AppIcon name="trash" size={14} />
                          <span>{t.permanentDelete}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Trashed Documents */}
          {trash.documents.length > 0 && (
            <section className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.filesTitle} · <span dir="ltr" className="tabular-nums">{trash.documents.length}</span>
              </h3>
              <div className="card divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                {trash.documents.map((doc) => {
                  const isPdf = doc.mime_type === 'application/pdf';
                  return (
                    <div
                      key={doc.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 grid place-items-center text-[11px] font-bold shrink-0">
                          {isPdf ? 'PDF' : 'IMG'}
                        </span>
                        <div className="min-w-0">
                          <b className="block text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {doc.file_name}
                          </b>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                            {doc.owner_name && <span>{doc.owner_name}</span>}
                            {doc.file_size ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span dir="ltr" className="tabular-nums">{formatBytes(doc.file_size)}</span>
                              </>
                            ) : null}
                            {doc.deleted_at && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {t.deletedOn}:{' '}
                                  <span dir="ltr" className="tabular-nums">{formatDateISO(doc.deleted_at)}</span>
                                </span>
                              </>
                            )}
                            {isAdmin && doc.deleted_by_name && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {t.deletedBy}: {doc.deleted_by_name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={busyId === doc.id}
                          onClick={() => handleRestore('doc', doc)}
                          className="btn btn-muted text-xs py-1.5 px-3"
                        >
                          <AppIcon name="restore" size={14} />
                          <span>{busyId === doc.id ? t.restoring : t.restore}</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setConfirmTarget({ kind: 'doc', item: doc })}
                            className="btn btn-danger text-xs py-1.5 px-3"
                          >
                            <AppIcon name="trash" size={14} />
                            <span>{t.permanentDelete}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Admin Permanent Delete / Empty Confirmation Modal */}
      {confirmTarget && isAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[85] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deleting) setConfirmTarget(null);
          }}
        >
          <div className="card max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800">
              <span className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 grid place-items-center shrink-0">
                <AppIcon name="trash" size={18} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {confirmTarget.kind === 'empty' ? t.confirmEmptyTrashTitle : t.confirmPermanentTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {confirmTarget.kind === 'empty' ? t.confirmEmptyTrashDesc : t.confirmPermanentDesc}
                </p>
              </div>
            </div>

            {confirmTarget.kind !== 'empty' && (
              <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-slate-200 break-all">
                «{confirmTarget.kind === 'doc' ? confirmTarget.item.file_name : confirmTarget.item.name}»
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmTarget(null)}
                className="btn btn-muted text-xs"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmPermanent}
                className="btn btn-danger text-xs px-4"
              >
                {deleting ? t.deleting : t.deletePermanently}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
