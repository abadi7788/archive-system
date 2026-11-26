'use client';
import { useEffect, useRef, useState } from 'react';
import { AppIcon } from '../BrandMark';
import type { DocItem } from './types';

/** Authenticated, lazy-loaded previews. Never put bearer tokens in URLs or caches. */
export default function FileThumbnail({ doc, token }: { doc: DocItem; token: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const mime = (doc.mime_type || '').toLowerCase();
  const extension = doc.file_name.split('.').pop()?.toLowerCase() || '';
  const isImage = mime.startsWith('image/');
  const isPdf = mime === 'application/pdf' || extension === 'pdf';
  useEffect(() => {
    if ((!isImage && !isPdf) || (doc.file_size || 0) > 20 * 1024 * 1024) return;
    const controller = new AbortController();
    let objectUrl = '';
    let started = false;
    setUrl('');
    async function load() {
      if (started) return;
      started = true;
      try {
        const response = await fetch(`/api/v1/documents/${doc.id}/file?inline=true`, {
          headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal,
        });
        if (!response.ok) return;
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        if (isPdf) {
          const { pdfThumbnail } = await import('../lib/pdfThumbnail');
          const thumbnail = await pdfThumbnail(blob, controller.signal);
          if (!controller.signal.aborted) setUrl(thumbnail);
        } else {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch { /* A meaningful file icon remains visible if preview is unavailable. */ }
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { void load(); observer.disconnect(); }
    }, { rootMargin: '120px' });
    if (host.current) observer.observe(host.current);
    return () => { controller.abort(); observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [doc.id, token, isImage, isPdf]);
  const word = ['doc', 'docx', 'odt'].includes(extension);
  const excel = ['xls', 'xlsx', 'csv', 'ods'].includes(extension);
  return <div ref={host} className="archive-thumbnail relative h-40 sm:h-44 w-full mb-3 rounded-xl overflow-hidden bg-slate-100 dark:bg-[#0A1626] flex items-center justify-center border border-slate-200 dark:border-slate-700">
    {url ? <img src={url} alt={doc.file_name} onError={() => setUrl('')} className="w-full h-full object-contain" />
      : <div className={`flex flex-col items-center gap-2 ${excel ? 'text-emerald-600 dark:text-emerald-400' : word ? 'text-brand-600 dark:text-brand-400' : isPdf ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
        <AppIcon name={isImage ? 'image' : excel ? 'grid' : 'file'} size={48} />
        <b dir="ltr" className="text-sm tracking-wider">{word ? 'WORD' : excel ? 'EXCEL' : extension.toUpperCase() || 'FILE'}</b>
      </div>}
  </div>;
}
