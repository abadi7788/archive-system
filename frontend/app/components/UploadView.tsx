'use client';
import React, { FormEvent, useMemo, useRef, useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';
import { droppedFiles, isAllowedUploadFile, UPLOAD_ACCEPT } from '../lib/uploads';
import { DocItem, FolderItem, User, formatBytes } from './types';

type Payload = { file: File; folderId: string; department: string; classification: string; keywords: string; summary: string };
export default function UploadView({ user, folders, departments, categories, defaultFolderId, t, onUpload, onGoArchive, onFinished }: {
  user: User; folders: FolderItem[]; departments: string[]; categories: string[]; defaultFolderId: string; t: TranslationKeys;
  onUpload: (payload: Payload, onProgress: (percent: number) => void) => Promise<DocItem>;
  onGoArchive: (folderId?: string) => void; onFinished: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [folderId, setFolderId] = useState(defaultFolderId || '');
  const [department, setDepartment] = useState(user.department || '');
  const [classification, setClassification] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(0);
  const [tasks, setTasks] = useState<Record<string, { progress: number; error?: string; done?: boolean }>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const directoryInput = useRef<HTMLInputElement>(null);
  const writableFolders = folders.filter((f) => f.can_manage !== false);
  const parsedKeywordTags = useMemo(() => keywords.split(',').map((k) => k.trim()).filter(Boolean).slice(0, 12), [keywords]);
  const fileKey = (file: File) => `${file.webkitRelativePath || file.name}:${file.size}:${file.lastModified}`;

  function addFiles(candidates: File[]) {
    if (busy) return;
    const valid = candidates.filter(isAllowedUploadFile);
    setError(valid.length !== candidates.length ? t.unsupportedFiles : '');
    setDone(0);
    setFiles((previous) => Array.from(new Map([...previous, ...valid].map((file) => [fileKey(file), file])).values()));
  }
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!files.length || busy) return;
    setBusy(true); setError('');
    // Snapshot common metadata for the entire batch; fields are disabled while uploading.
    const options = { folderId, department, classification, keywords, summary };
    let completed = 0;
    const failed: File[] = [];
    for (const file of files) {
      const key = fileKey(file);
      setTasks((previous) => ({ ...previous, [key]: { progress: 0 } }));
      try {
        await onUpload({ ...options, file }, (progress) => setTasks((previous) => ({ ...previous, [key]: { progress } })));
        completed += 1;
        setTasks((previous) => ({ ...previous, [key]: { progress: 100, done: true } }));
      } catch (failure: any) {
        failed.push(file);
        setTasks((previous) => ({ ...previous, [key]: { progress: 0, error: failure.message || t.errorGeneric } }));
      }
    }
    setDone(completed);
    if (completed) await onFinished().catch(() => {});
    setFiles(failed); // Retrying failures never uploads successful files a second time.
    setBusy(false);
  }
  if (user.role === 'viewer') return <section className="card p-8 text-center"><h2>{t.viewerNoUploadTitle}</h2><p>{t.viewerNoUploadDesc}</p></section>;
  return <div className="max-w-4xl mx-auto space-y-4">
    <form onSubmit={handleSubmit} className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <h2 className="font-bold flex items-center gap-2"><AppIcon name="upload" size={20} />{t.uploadPageTitle}</h2>
        <button type="button" className="btn btn-secondary text-xs" disabled={busy} onClick={() => onGoArchive(folderId)}>{t.backToArchive}</button>
      </div>
      <fieldset disabled={busy} className="p-5 sm:p-6 space-y-5 min-w-0">
        <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={async (event) => { event.preventDefault(); setDragging(false); try { addFiles(await droppedFiles(event.dataTransfer)); } catch { setError(t.errorGeneric); } }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center ${dragging ? 'border-brand-500 bg-brand-50 dark:bg-navy-surface' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-navy-deep'}`}>
          <AppIcon name="upload" size={28} className="mx-auto mb-3 text-brand-600 dark:text-brand-300" />
          <p className="font-bold">{t.dropzoneTitle}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2" dir="ltr">{t.dropzoneHint}</p>
          <div className="flex flex-wrap justify-center gap-3 mt-5">
            <button type="button" onClick={() => fileInput.current?.click()} className="btn btn-primary text-xs">{t.chooseFiles}</button>
            <button type="button" onClick={() => directoryInput.current?.click()} className="btn btn-secondary text-xs"><AppIcon name="folder" size={16} />{t.chooseDirectory}</button>
          </div>
          <input ref={fileInput} type="file" accept={UPLOAD_ACCEPT} multiple className="hidden" aria-label={t.chooseFiles}
            onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <input ref={directoryInput} type="file" multiple {...({ webkitdirectory: '', directory: '' } as any)} className="hidden" aria-label={t.chooseDirectory}
            onChange={(event) => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300">{t.batchMetadataHint}</p>
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


        {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
        {files.length > 0 && <ul className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800" aria-label={t.chooseFiles}>
          {files.map((file) => { const key = fileKey(file), task = tasks[key]; return <li key={key} className="py-3 flex items-center gap-3 text-sm">
            <AppIcon name="file" size={20} className="text-brand-600 shrink-0" />
            <div className="min-w-0 flex-1"><p className="truncate" dir="auto">{file.webkitRelativePath || file.name}</p>
              <p className="text-xs text-slate-500" dir="ltr">{formatBytes(file.size)}{task ? ` · ${task.progress}%` : ''}</p>
              {busy && task && <progress aria-label={file.name} value={task.progress} max={100} className="w-full accent-brand-600" />}
              {task?.error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">{task.error}</p>}
            </div>
            <button type="button" className="btn btn-secondary p-2" aria-label={`${t.removeFile}: ${file.name}`} onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}><AppIcon name="x" size={15} /></button>
          </li>; })}
        </ul>}
        {done > 0 && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{t.uploadSuccess}: {done}</p>}
        <button type="submit" disabled={busy || !files.length} className="btn btn-primary w-full sm:w-auto"><AppIcon name="upload" size={17} />{busy ? t.uploadingProgress : t.uploadSubmit}{files.length ? ` (${files.length})` : ''}</button>
      </fieldset>
    </form>
  </div>;
}
