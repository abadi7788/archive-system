'use client';
import React, { useEffect, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { statusDisplayMeta, type TranslationKeys } from '../lib/i18n';
import { DocItem, formatBytes, formatDateISO } from './types';

const API = '/api/v1';

// Lightweight in-memory preview cache for snappy row switching without flicker
const previewBlobCache = new Map<string, { url: string; mime: string }>();
const MAX_CACHE_ENTRIES = 16;

function cacheBlob(docId: string, url: string, mime: string) {
  if (previewBlobCache.has(docId)) {
    previewBlobCache.delete(docId);
  }
  previewBlobCache.set(docId, { url, mime });
  if (previewBlobCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = previewBlobCache.keys().next().value;
    if (oldestKey) {
      const entry = previewBlobCache.get(oldestKey);
      if (entry) URL.revokeObjectURL(entry.url);
      previewBlobCache.delete(oldestKey);
    }
  }
}

export function renderHighlightedText(snippet?: string | null, query?: string) {
  if (!snippet) return null;

  // Backend returns ⟦matched⟧ markers; if absent but query is active, highlight client-side cleanly
  if (snippet.includes('⟦') && snippet.includes('⟧')) {
    const parts = snippet.split(/(⟦[^⟧]+⟧)/g);
    return (
      <>
        {parts.map((part, idx) =>
          part.startsWith('⟦') && part.endsWith('⟧') ? (
            <mark
              key={idx}
              className="rounded px-1 py-0.5 bg-amber-200/80 dark:bg-amber-500/30 text-slate-900 dark:text-amber-100 font-semibold"
            >
              {part.slice(1, -1)}
            </mark>
          ) : (
            <React.Fragment key={idx}>{part}</React.Fragment>
          )
        )}
      </>
    );
  }

  const cleanQ = (query || '').trim();
  if (!cleanQ) return <>{snippet}</>;

  const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = snippet.split(regex);
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === cleanQ.toLowerCase() ? (
          <mark
            key={idx}
            className="rounded px-1 py-0.5 bg-amber-200/80 dark:bg-amber-500/30 text-slate-900 dark:text-amber-100 font-semibold"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={idx}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export default function DocumentInspector({
  doc,
  token,
  query,
  canManage,
  canPrint,
  t,
  dir,
  onOpenFullPreview,
  onPrintDoc,
  onToggleStar,
  onDownload,
  onEdit,
  onRequestDelete,
  onCloseMobile,
}: {
  doc: DocItem | null;
  token: string;
  query: string;
  canManage: boolean;
  canPrint: boolean;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onOpenFullPreview: (doc: DocItem) => void;
  onPrintDoc: (doc: DocItem) => void;
  onToggleStar: (doc: DocItem) => void;
  onDownload: (doc: DocItem) => void;
  onEdit: (doc: DocItem) => void;
  onRequestDelete: (doc: DocItem) => void;
  onCloseMobile?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [blobMime, setBlobMime] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    if (!doc || !token) {
      setBlobUrl('');
      setBlobMime('');
      setLoadingPreview(false);
      setPreviewFailed(false);
      return;
    }

    const cached = previewBlobCache.get(doc.id);
    if (cached) {
      setBlobUrl(cached.url);
      setBlobMime(cached.mime);
      setLoadingPreview(false);
      setPreviewFailed(false);
      return;
    }

    const controller = new AbortController();
    setLoadingPreview(true);
    setPreviewFailed(false);
    setBlobUrl('');

    fetch(`${API}/documents/${doc.id}/file?inline=true`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('preview-error');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const mime = doc.mime_type || blob.type || '';
        cacheBlob(doc.id, url, mime);
        if (!controller.signal.aborted) {
          setBlobUrl(url);
          setBlobMime(mime);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPreviewFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingPreview(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [doc, token]);

  if (!doc) {
    return (
      <div
        dir={dir}
        className="card h-full min-h-[420px] p-6 flex flex-col items-center justify-center text-center"
      >
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 grid place-items-center mb-3.5">
          <AppIcon name="eye" size={22} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          {t.inspectorEmptyTitle}
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-[230px] leading-relaxed">
          {t.inspectorEmptyDesc}
        </p>
      </div>
    );
  }

  const effectiveMime = (blobMime || doc.mime_type || '').toLowerCase();
  const isImage = effectiveMime.startsWith('image/');
  const isPdf = effectiveMime === 'application/pdf';
  const statusMeta = statusDisplayMeta(doc.status, t);
  const ownerDisplay = doc.owner_name || doc.owner_username || '—';
  const excerptSource = doc.snippet || (query.trim() && doc.extracted_text ? doc.extracted_text.slice(0, 260) : null);

  return (
    <div dir={dir} className="card flex flex-col overflow-hidden">
      {/* Inspector Header */}
      <div className="px-4 py-3.5 border-b border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-blue-50/90 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 ring-1 ring-blue-600/10 dark:ring-blue-400/20 grid place-items-center shrink-0">
            <AppIcon name={isImage ? 'image' : 'file'} size={15} />
          </span>
          <h3 className="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate">
            {t.inspectorTitle}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleStar(doc)}
            title={doc.is_starred ? t.removeFromStarred : t.addToStarred}
            aria-label={doc.is_starred ? t.removeFromStarred : t.addToStarred}
            className={`p-1.5 rounded-lg transition-colors ${
              doc.is_starred
                ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-500'
            }`}
          >
            <AppIcon name={doc.is_starred ? 'starFilled' : 'star'} size={15} />
          </button>
          {canPrint && (
            <button
              type="button"
              onClick={() => onPrintDoc(doc)}
              title={t.print}
              aria-label={t.print}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <AppIcon name="printer" size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenFullPreview(doc)}
            title={canPrint ? t.openFullPreviewPrint : t.openFullPreview}
            aria-label={canPrint ? t.openFullPreviewPrint : t.openFullPreview}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <AppIcon name="maximize" size={15} />
          </button>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={t.close}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <AppIcon name="x" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Live Preview Canvas */}
      <div className="p-4 pb-3">
        <div
          onClick={() => onOpenFullPreview(doc)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenFullPreview(doc);
            }
          }}
          className="group relative w-full h-56 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-slate-100/90 to-slate-200/40 dark:from-slate-950/90 dark:to-slate-900/70 overflow-hidden cursor-pointer flex items-center justify-center"
        >
          {loadingPreview ? (
            <div className="flex flex-col items-center gap-2 text-slate-400 dark:text-slate-500">
              <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
              <span className="text-[11px] font-medium">{t.loadingPreview}</span>
            </div>
          ) : blobUrl && isImage ? (
            <img
              src={blobUrl}
              alt={doc.file_name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-[1.02]"
            />
          ) : blobUrl && isPdf ? (
            <div className="relative w-full h-full">
              <iframe
                src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                title={doc.file_name}
                className="w-full h-full border-0 pointer-events-none bg-white"
              />
              <div className="absolute inset-0 bg-transparent" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 text-center">
              <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 grid place-items-center mb-2">
                <AppIcon name={isImage ? 'image' : 'file'} size={22} />
              </div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                {previewFailed ? t.previewUnavailable : canPrint ? t.openFullPreviewPrint : t.openFullPreview}
              </p>
            </div>
          )}

          {/* Subtle hover affordance */}
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white">
              <AppIcon name="maximize" size={12} />
              <span>{canPrint ? t.openFullPreviewPrint : t.openFullPreview}</span>
            </span>
          </div>
        </div>

        {/* File Title */}
        <h4
          className="mt-3 text-sm font-bold text-slate-900 dark:text-white leading-snug break-words"
          dir="auto"
        >
          {doc.file_name}
        </h4>

        {/* Highlighted Search Snippet (when searching inside image/document content) */}
        {excerptSource && (
          <div className="mt-3 rounded-lg bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 p-3">
            <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1">
              {t.matchedExcerpt}
            </div>
            <p
              className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 line-clamp-4"
              dir="auto"
            >
              {renderHighlightedText(excerptSource, query)}
            </p>
          </div>
        )}

        {/* Summary (when not duplicating snippet) */}
        {!excerptSource && doc.summary && (
          <p
            className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-3"
            dir="auto"
          >
            {doc.summary}
          </p>
        )}
      </div>

      {/* Structured Metadata Rows */}
      <div className="px-4 py-2 border-t border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.uploadedByLabel}</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate text-end">
            {ownerDisplay}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.departmentLabel}</span>
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-end">
            {doc.department || '—'}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.classificationLabel}</span>
          <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-end">
            {doc.classification || '—'}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.folderPathLabel}</span>
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate text-end" dir="auto">
            {doc.folder_breadcrumb || t.rootHome}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.dateLabel}</span>
          <span dir="ltr" className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
            {formatDateISO(doc.created_at)}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.sizeLabel}</span>
          <span dir="ltr" className="font-medium text-slate-800 dark:text-slate-200 tabular-nums">
            {formatBytes(doc.file_size)}
          </span>
        </div>
        <div className="py-2 flex items-center justify-between gap-3">
          <span className="text-slate-500 dark:text-slate-400 shrink-0">{t.statusLabel}</span>
          <span className={`font-semibold ${statusMeta.textClass}`}>{statusMeta.label}</span>
        </div>
      </div>

      {/* Quick Direct Actions */}
      <div className="p-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenFullPreview(doc)}
            className="btn btn-primary flex-1 py-2.5 text-xs"
          >
            <AppIcon name="eye" size={15} />
            <span className="truncate">{t.openFullPreview}</span>
          </button>
          {canPrint && (
            <button
              type="button"
              onClick={() => onPrintDoc(doc)}
              title={t.print}
              aria-label={t.print}
              className="btn btn-muted py-2.5 px-3 text-xs shrink-0"
            >
              <AppIcon name="printer" size={15} />
            </button>
          )}
        </div>

        <div className={`grid gap-2 ${canManage ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={() => onDownload(doc)}
            className="btn btn-muted py-2 px-2.5 text-xs"
          >
            <AppIcon name="download" size={14} />
            <span className="truncate">{t.download}</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => onEdit(doc)}
              className="btn btn-muted py-2 px-2.5 text-xs"
            >
              <AppIcon name="edit" size={14} />
              <span className="truncate">{t.edit}</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={() => onRequestDelete(doc)}
              className="btn py-2 px-2.5 text-xs border border-rose-200 dark:border-rose-900/70 bg-rose-50/80 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70"
            >
              <AppIcon name="trash" size={14} />
              <span className="truncate">{t.deleteAction}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
