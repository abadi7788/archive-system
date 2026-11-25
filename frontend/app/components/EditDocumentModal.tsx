'use client';
import React, { FormEvent, useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';
import type { DocItem, FolderItem } from './types';

export default function EditDocumentModal({
  doc,
  folders,
  departments,
  categories,
  t,
  dir,
  onSave,
  onClose,
}: {
  doc: DocItem;
  folders: FolderItem[];
  departments: string[];
  categories: string[];
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onSave: (
    docId: string,
    payload: {
      file_name: string;
      folder_id: string | null;
      department: string | null;
      classification: string | null;
      summary: string | null;
      keywords: string[];
    }
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [fileName, setFileName] = useState(doc.file_name || '');
  const [folderId, setFolderId] = useState(doc.folder_id || '');
  const [department, setDepartment] = useState(doc.department || '');
  const [classification, setClassification] = useState(doc.classification || '');
  const [summary, setSummary] = useState(doc.summary || '');
  const [keywordsText, setKeywordsText] = useState((doc.keywords || []).join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const writableFolders = folders.filter((f) => f.can_manage !== false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fileName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const parsedKeywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 50);
      await onSave(doc.id, {
        file_name: fileName.trim(),
        folder_id: folderId || null,
        department: department.trim() || null,
        classification: classification.trim() || null,
        summary: summary.trim() || null,
        keywords: parsedKeywords,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-doc-title"
      dir={dir}
      className="fixed inset-0 z-[85] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form onSubmit={handleSubmit} className="card w-full max-w-lg p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 grid place-items-center shrink-0">
              <AppIcon name="edit" size={18} />
            </span>
            <h3 id="edit-doc-title" className="text-base font-bold text-slate-900 dark:text-white truncate">
              {t.editDocTitle}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label={t.close}
          >
            <AppIcon name="x" size={18} />
          </button>
        </div>

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t.fileNameLabel}
          <input
            className="field mt-1.5"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            maxLength={250}
            required
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.classificationLabel}
            <input
              list="edit-doc-categories"
              className="field mt-1.5"
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
            />
            <datalist id="edit-doc-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.departmentLabel}
            <input
              list="edit-doc-departments"
              className="field mt-1.5"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
            <datalist id="edit-doc-departments">
              {departments.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </label>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            {t.keywordsCommaLabel}
            <input
              className="field mt-1.5"
              value={keywordsText}
              onChange={(e) => setKeywordsText(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t.notesSummaryLabel}
          <textarea
            rows={3}
            className="field mt-1.5 resize-y"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="pt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-muted text-xs">
            {t.cancel}
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary text-xs px-5">
            {busy ? t.saving : t.saveChanges}
          </button>
        </div>
      </form>
    </div>
  );
}
