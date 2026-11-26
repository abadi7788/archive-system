'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TranslationKeys } from '../lib/i18n';

export default function RenameDialog({ name, file, t, onSave, onClose }: {
  name: string; file: boolean; t: TranslationKeys; onSave: (name: string) => Promise<void>; onClose: () => void;
}) {
  const index = file ? name.lastIndexOf('.') : -1;
  const extension = index > 0 ? name.slice(index) : '';
  const [value, setValue] = useState(extension ? name.slice(0, index) : name);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const container = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus(); input.current?.select();
    return () => previous?.focus();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await onSave(value); onClose(); }
    catch (error: any) { setError(error.message || t.errorGeneric); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[90] bg-navy-deep/70 backdrop-blur-sm grid place-items-center p-4" onKeyDown={(event) => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const items = container.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}>
    <form ref={container} role="dialog" aria-modal="true" aria-labelledby="rename-title" onSubmit={submit} className="card w-full max-w-md p-6 space-y-5">
      <h2 id="rename-title" className="text-lg font-bold">{t.rename}</h2>
      <p className="text-xs text-slate-600 dark:text-slate-300 break-all" dir="auto">{name}</p>
      <label className="block text-sm font-semibold">{t.renameNameLabel}
        <div className="flex items-center gap-2 mt-2">
          <input ref={input} value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} required maxLength={file ? 250 - extension.length : 180}
            className="field min-w-0" dir="auto" />
          {extension && <span dir="ltr" className="text-sm text-slate-500 shrink-0">{extension}</span>}
        </div>
      </label>
      {file && <p className="text-xs text-slate-600 dark:text-slate-300">{t.renameExtensionHint}</p>}
      {error && <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onClose}>{t.cancel}</button>
        <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>{busy ? t.saving : t.rename}</button>
      </div>
    </form>
  </div>;
}
