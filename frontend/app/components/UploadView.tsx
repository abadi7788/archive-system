'use client';
import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';
import { DocItem, FolderItem, User, formatBytes } from './types';

export default function UploadView({
  user,
  folders,
  departments,
  categories,
  defaultFolderId,
  t,
  onUpload,
  onGoArchive,
}: {
  user: User;
  folders: FolderItem[];
  departments: string[];
  categories: string[];
  defaultFolderId: string;
  t: TranslationKeys;
  onUpload: (
    payload: {
      file: File;
      folderId: string;
      department: string;
      classification: string;
      keywords: string;
      summary: string;
    },
    onProgress: (percent: number) => void
  ) => Promise<DocItem>;
  onGoArchive: (folderId?: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [department, setDepartment] = useState(user.department || '');
  const [classification, setClassification] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadedDoc, setUploadedDoc] = useState<DocItem | null>(null);

  const writableFolders = folders.filter((f) => f.can_manage !== false);

  const parsedKeywordTags = useMemo(
    () =>
      keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 12),
    [keywords]
  );

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (user.role === 'viewer') {
    return (
      <section className="card p-8 text-center max-w-xl mx-auto">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] grid place-items-center mb-3">
          <AppIcon name="lock" size={22} />
        </div>
        <h2 className="text-base font-bold text-[#0F2137] dark:text-white">{t.viewerNoUploadTitle}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t.viewerNoUploadDesc}</p>
        <button type="button" onClick={() => onGoArchive()} className="btn btn-primary mt-5 text-xs">
          {t.backToArchive}
        </button>
      </section>
    );
  }

  function pickFile(candidate: File | null) {
    setError('');
    setUploadedDoc(null);
    setProgress(0);
    if (!candidate) {
      setFile(null);
      return;
    }
    const allowedMimes = [
      'application/pdf',
      'application/x-pdf',
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/x-png',
      'image/webp',
      'image/tiff',
    ];
    const ext = (candidate.name || '').toLowerCase().split('.').pop() || '';
    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff'];
    if (!allowedMimes.includes((candidate.type || '').toLowerCase()) && !allowedExts.includes(ext)) {
      setError(t.dropzoneHint);
      return;
    }
    if (candidate.size > 40 * 1024 * 1024) {
      setError(t.dropzoneHint);
      return;
    }
    setFile(candidate);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setProgress(5);
    setError('');
    try {
      const created = await onUpload(
        {
          file,
          folderId,
          department,
          classification,
          keywords,
          summary,
        },
        (pct) => setProgress(pct)
      );
      setProgress(100);
      setUploadedDoc(created);
      setFile(null);
      setClassification('');
      setKeywords('');
      setSummary('');
    } catch (err: any) {
      setError(err?.message || t.errorGeneric);
      setProgress(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {uploadedDoc && (
        <div className="card p-4 border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
              <AppIcon name="checkCircle" size={18} />
              <span className="truncate">
                {t.uploadSuccess}: {uploadedDoc.file_name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onGoArchive(uploadedDoc.folder_id || '')}
              className="btn btn-primary text-xs py-1.5"
            >
              {t.openInArchive}
            </button>
            <button
              type="button"
              onClick={() => setUploadedDoc(null)}
              className="btn btn-muted text-xs py-1.5"
            >
              {t.uploadAnother}
            </button>
          </div>
        </div>
      )}

      {/* Unified Executive Upload Studio Card */}
      <form onSubmit={handleSubmit} className="card overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0B192B]/60 border-b border-slate-200/85 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] ring-1 ring-[#0891B2]/20 grid place-items-center shrink-0">
              <AppIcon name="upload" size={18} />
            </span>
            <h2 className="text-base font-bold text-[#0F2137] dark:text-white truncate">
              {t.uploadPageTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onGoArchive(folderId || undefined)}
            className="btn btn-muted text-xs py-1.5 px-3 shrink-0"
          >
            {t.backToArchive}
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Interactive Dropzone */}
          <div>
            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300 mb-2">
              {t.fileOrImageLabel} <span className="text-rose-500">*</span>
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0] || null);
              }}
              className={`relative rounded-2xl border-2 border-dashed p-7 sm:p-8 text-center transition-all ${
                dragging
                  ? 'border-[#0891B2] bg-brand-50/70 dark:bg-[#132942]/70'
                  : file
                  ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/35 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/75 dark:bg-[#0B192B]/50 hover:border-[#0891B2] dark:hover:border-[#0891B2]'
              }`}
            >
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp,image/tiff"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label={t.fileOrImageLabel}
              />

              {!file ? (
                <div className="space-y-2.5 pointer-events-none">
                  <div className="mx-auto w-13 h-13 w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] ring-1 ring-[#0891B2]/20 grid place-items-center">
                    <AppIcon name="upload" size={22} />
                  </div>
                  <p className="text-sm font-bold text-[#0F2137] dark:text-slate-100">
                    {t.dropzoneTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                    {t.dropzoneHint}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 bg-white shadow-sm"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 grid place-items-center font-bold text-sm shrink-0">
                      PDF
                    </div>
                  )}
                  <div className="text-start min-w-0">
                    <p className="text-sm font-bold text-[#0F2137] dark:text-white truncate max-w-xs sm:max-w-md">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums" dir="ltr">
                      {formatBytes(file.size)}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="relative z-10 mt-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      {t.removeFile}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Live Upload Progress Bar */}
          {busy && (
            <div className="space-y-1.5 rounded-xl bg-brand-50/70 dark:bg-[#132942] p-3.5 border border-brand-200/80 dark:border-[#0891B2]/30">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#0E7490] dark:text-[#22D3EE]">{t.uploadingProgress}</span>
                <span dir="ltr" className="tabular-nums text-[#0F2137] dark:text-slate-200">
                  {progress}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-white dark:bg-[#0A1626] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0E7490] to-[#0891B2] transition-all duration-150"
                  style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
                />
              </div>
            </div>
          )}

          {/* Target Folder & Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.targetFolderLabel}
              <select
                className="field mt-1.5"
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
              >
                <option value="">{t.noFolderRoot}</option>
                {writableFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.path && f.path !== '/' ? `${f.path}/${f.name}` : f.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.departmentLabel}
              {departments.length > 0 ? (
                <select
                  className="field mt-1.5"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">{t.selectDepartmentPlaceholder}</option>
                  {department && !departments.includes(department) && (
                    <option value={department}>{department}</option>
                  )}
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field mt-1.5"
                  placeholder={t.departmentPlaceholder}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              )}
            </label>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.classificationLabel} ({t.optional})
              {categories.length > 0 ? (
                <select
                  className="field mt-1.5"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                >
                  <option value="">{t.selectClassificationPlaceholder}</option>
                  {classification && !categories.includes(classification) && (
                    <option value={classification}>{classification}</option>
                  )}
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="field mt-1.5"
                  placeholder={t.keywordPlaceholder}
                  value={classification}
                  onChange={(e) => setClassification(e.target.value)}
                />
              )}
            </label>

            <div>
              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.keywordsCommaLabel}
                <input
                  className="field mt-1.5"
                  placeholder={t.keywordPlaceholder}
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </label>
              {parsedKeywordTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parsedKeywordTags.map((tag, idx) => (
                    <span
                      key={`${tag}-${idx}`}
                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] border border-brand-200/80 dark:border-[#0891B2]/30"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
            {t.notesSummaryLabel} ({t.optional})
            <textarea
              rows={3}
              className="field mt-1.5 resize-y"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </label>

          {error && (
            <p role="alert" className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <button type="submit" disabled={busy || !file} className="btn btn-primary px-7 py-2.5">
              <AppIcon name="upload" size={16} />
              <span>{busy ? `${t.uploadingProgress} (${progress}%)` : t.uploadSubmit}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
