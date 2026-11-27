'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';

export default function UploadSourceMenu({ t, onFiles, onFolder }: { t: TranslationKeys; onFiles: () => void; onFolder: () => void }) {
  const [open, setOpen] = useState(false);
  const id = useId(), host = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  function choose(callback: () => void) { setOpen(false); trigger.current?.focus(); callback(); }
  return <div ref={host} className="relative inline-block" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        if (!open) { setOpen(true); return; }
        const buttons = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button') || []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }}>
    <button ref={trigger} type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      className="btn btn-primary text-xs" onClick={() => setOpen(!open)}><AppIcon name="upload" size={16} />{t.uploadMenuLabel}<span aria-hidden="true">▾</span></button>
    {open && <div ref={menu} id={id} role="menu" aria-label={t.uploadMenuLabel} className="absolute start-0 top-full mt-2 z-20 min-w-40 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-surface shadow-lg text-start">
      <button type="button" role="menuitem" className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-brand-50 dark:hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-brand-500" onClick={() => choose(onFiles)}><AppIcon name="file" size={17} />{t.uploadFilesOption}</button>
      <button type="button" role="menuitem" className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-brand-50 dark:hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-brand-500" onClick={() => choose(onFolder)}><AppIcon name="folder" size={17} />{t.uploadFolderOption}</button>
    </div>}
  </div>;
}
