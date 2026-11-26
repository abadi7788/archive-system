'use client';
import { FormEvent, useRef, useState } from 'react';
import { AppIcon } from './BrandMark';
import PasswordInput from './components/PasswordInput';
import type { LocaleCode } from './components/types';
import { localizeApiError } from './lib/errorLocalizer';
import { getDirection, getTranslations } from './lib/i18n';

type PreviewDoc = {
  id: string;
  file_name: string;
  mime_type?: string;
  objectUrl: string;
  extracted_text?: string;
  summary?: string;
  classification?: string;
  department?: string;
  owner_name?: string | null;
  keywords?: string[];
};

export default function DocumentModal({
  doc,
  token,
  language,
  canPrint = false,
  onDownload,
  onDelete,
  onClose,
}: {
  doc: PreviewDoc;
  token: string;
  language: LocaleCode;
  canPrint?: boolean;
  onDownload?: () => void;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const t = getTranslations(language);
  const dir = getDirection(language);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState<'preview' | 'text' | 'chat' | 'share'>('preview');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [expiry, setExpiry] = useState('24');
  const [shareUrl, setShareUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedNotice, setCopiedNotice] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedAnswerIdx, setCopiedAnswerIdx] = useState<number | null>(null);

  const auth = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept-Language': language,
  };
  const isPdf = doc.mime_type === 'application/pdf';
  const isImage = (doc.mime_type || '').startsWith('image/');

  async function handlePrint() {
    if (!canPrint) return;
    try {
      const response = await fetch(`/api/v1/documents/${doc.id}/print`, { method: 'POST', headers: auth, cache: 'no-store' });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(localizeApiError(body.detail, response.status, language, t)); }
    } catch (error: any) { setNotice(error.message || t.errorGeneric); return; }
    if (isPdf && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // fallback below
      }
    }
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const cleanup = () => {
      window.setTimeout(() => {
        if (printFrame.parentNode) printFrame.parentNode.removeChild(printFrame);
      }, 1500);
    };

    if (isPdf) {
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } finally {
          cleanup();
        }
      };
      printFrame.src = doc.objectUrl;
    } else {
      const fDoc = printFrame.contentDocument;
      if (fDoc) {
        fDoc.open();
        fDoc.close();
        const img = fDoc.createElement('img');
        img.src = doc.objectUrl;
        img.alt = doc.file_name;
        img.style.maxWidth = '100%';
        img.style.display = 'block';
        img.style.margin = '0 auto';
        img.onload = () => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } finally {
            cleanup();
          }
        };
        fDoc.body.style.margin = '0';
        fDoc.body.appendChild(img);
      } else {
        cleanup();
      }
    }
  }

  function handleLocalDownload() {
    if (onDownload) {
      onDownload();
      return;
    }
    const a = document.createElement('a');
    a.href = doc.objectUrl;
    a.download = doc.file_name || 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      const r = await fetch(`/api/v1/documents/${doc.id}/chat`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ question }),
        cache: 'no-store',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(localizeApiError(d?.detail, r.status, language, t));
      }
      setHistory((v) => [...v, { q: question, a: d.answer }]);
      setQuestion('');
    } catch (e: any) {
      setNotice(e?.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function createShare(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setCopiedShare(false);
    try {
      const r = await fetch(`/api/v1/documents/${doc.id}/share`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ password: sharePassword, expires_in_hours: Number(expiry) }),
        cache: 'no-store',
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(localizeApiError(d?.detail, r.status, language, t));
      }
      setShareUrl(`${window.location.origin}/shared#${encodeURIComponent(d.share_token)}`);
    } catch (e: any) {
      setNotice(e?.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  const tabsList = [
    { key: 'preview' as const, label: t.preview, icon: 'eye' },
    { key: 'text' as const, label: t.extractedText, icon: 'file' },
    { key: 'chat' as const, label: t.askDocument, icon: 'sparkles' },
    { key: 'share' as const, label: t.secureShare, icon: 'share' },
  ];

  const wordCount = (doc.extracted_text || '').trim()
    ? (doc.extracted_text || '').trim().split(/\s+/).length
    : 0;

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-[#091524]/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {confirmDelete && <div role="alertdialog" aria-modal="true" className="absolute inset-0 z-10 bg-slate-950/75 flex items-center justify-center p-4">
        <div className="card p-6 max-w-md w-full space-y-4"><h3 className="font-bold">{t.confirmTrashDocTitle}</h3><p className="text-sm">{doc.file_name}</p>
          <div className="flex gap-2"><button disabled={deleting} className="btn btn-danger" onClick={async () => {
            setDeleting(true);
            try { await onDelete?.(); } catch (error: any) { setNotice(error.message || t.errorGeneric); setConfirmDelete(false); } finally { setDeleting(false); }
          }}>{t.deleteAction}</button><button disabled={deleting} className="btn btn-muted" onClick={() => setConfirmDelete(false)}>{t.cancel}</button></div>
        </div>
      </div>}
      <section className="w-full max-w-6xl h-[92vh] bg-white dark:bg-[#0F2137] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Executive Deep Navy Header Bar */}
        <header className="shrink-0 sidebar-navy text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span
              className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 text-xs font-bold border ${
                isPdf
                  ? 'bg-rose-500/20 border-rose-400/30 text-rose-200'
                  : 'bg-[#0E7490]/35 border-[#0891B2]/45 text-[#22D3EE]'
              }`}
            >
              <AppIcon name={isPdf ? 'file' : 'image'} size={19} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-white truncate" dir="auto">
                {doc.file_name}
              </h2>
              <p className="text-xs text-slate-300/90 mt-0.5 truncate">
                {[doc.owner_name, doc.classification, doc.department].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLocalDownload}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2 px-3 transition-colors"
              title={t.download}
            >
              <AppIcon name="download" size={15} />
              <span className="hidden sm:inline">{t.download}</span>
            </button>
            {canPrint && (isPdf || isImage) && (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2 px-3 transition-colors"
                title={t.print}
              >
                <AppIcon name="printer" size={15} />
                <span className="hidden sm:inline">{t.print}</span>
              </button>
            )}
            {onDelete && <button type="button" onClick={() => setConfirmDelete(true)} title={t.deleteAction} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300/30 bg-rose-500/20 hover:bg-rose-500/40 text-white text-xs font-semibold py-2 px-3"><AppIcon name="trash" size={15} /><span className="hidden sm:inline">{t.deleteAction}</span></button>}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-rose-500/30 hover:border-rose-400/40 text-white text-xs font-semibold py-2 px-3 transition-colors"
              aria-label={t.close}
            >
              <AppIcon name="x" size={15} />
              <span className="hidden sm:inline">{t.close}</span>
            </button>
          </div>
        </header>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-slate-200/85 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0B192B]/80 overflow-x-auto shrink-0">
          {tabsList.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTab(item.key);
                  setNotice('');
                }}
                className={`inline-flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'border-[#0E7490] text-[#0E7490] dark:border-[#22D3EE] dark:text-[#22D3EE] bg-white/60 dark:bg-white/[0.03]'
                    : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-[#0F2137] dark:hover:text-slate-200'
                }`}
              >
                <AppIcon name={item.icon} size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-xs font-medium shrink-0">
            {notice}
          </div>
        )}

        {/* Instant Preview Tab */}
        {tab === 'preview' && (
          <div className="flex-1 min-h-0 preview-grid p-3 sm:p-5 flex items-center justify-center overflow-auto">
            {isPdf ? (
              <iframe
                ref={iframeRef}
                title={doc.file_name}
                src={`${doc.objectUrl}#toolbar=0&navpanes=0`}
                className="w-full h-full min-h-[60vh] rounded-xl bg-white border border-slate-200/90 dark:border-slate-800 shadow-sm"
              />
            ) : isImage ? (
              <img
                src={doc.objectUrl}
                alt={doc.file_name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded-xl shadow-md bg-white dark:bg-[#0F2137] border border-slate-200/80 dark:border-slate-800 p-1"
              />
            ) : <div className="flex flex-col items-center gap-4 text-slate-600 dark:text-slate-300"><AppIcon name="file" size={64} /><b dir="auto">{doc.file_name}</b></div>}
          </div>
        )}

        {/* Extracted Text & Metadata Tab */}
        {tab === 'text' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#F8FAFC] dark:bg-[#0A1626]">
            <div className="px-5 sm:px-6 py-4 bg-white dark:bg-[#0F2137] border-b border-slate-200/85 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                {doc.summary && (
                  <p className="text-sm text-[#0F2137] dark:text-slate-200 leading-relaxed" dir="auto">
                    {doc.summary}
                  </p>
                )}
                {doc.keywords && doc.keywords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {doc.keywords.map((kw, idx) => (
                      <span
                        key={`${kw}-${idx}`}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] border border-brand-200/80 dark:border-[#0891B2]/30"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {wordCount > 0 && (
                  <span
                    dir="ltr"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#132942] text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums"
                  >
                    {wordCount} words
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-muted text-xs py-1.5 px-3 shrink-0"
                  onClick={async () => {
                    await navigator.clipboard.writeText(doc.extracted_text || '');
                    setCopiedNotice(t.copied);
                    window.setTimeout(() => setCopiedNotice(''), 1800);
                  }}
                >
                  <AppIcon name={copiedNotice ? 'check' : 'copy'} size={14} />
                  <span>{copiedNotice || t.copyText}</span>
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 sm:p-6 overflow-auto">
              <div
                className="card max-w-4xl mx-auto p-5 sm:p-7 select-text whitespace-pre-wrap leading-8 text-sm text-[#0F2137] dark:text-slate-200"
                dir="auto"
              >
                {doc.extracted_text || t.noExtractedText}
              </div>
            </div>
          </div>
        )}

        {/* Ask Document AI Assistant Tab */}
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col bg-[#F1F5F9] dark:bg-[#0A1626]">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="max-w-3xl mx-auto space-y-4 h-full">
                {!history.length ? (
                  <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center px-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-[#132942] border border-brand-200/80 dark:border-[#0891B2]/30 text-[#0E7490] dark:text-[#22D3EE] grid place-items-center mb-3.5">
                      <AppIcon name="sparkles" size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                      {t.askDocument}
                    </h3>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 max-w-md leading-relaxed">
                      {t.askPlaceholder}
                    </p>
                  </div>
                ) : (
                  history.map((m, i) => (
                    <div key={i} className="space-y-2.5">
                      <div className="flex justify-end">
                        <div
                          className="max-w-[85%] rounded-2xl rounded-ee-sm bg-[#0E7490] text-white px-4 py-3 text-sm font-medium shadow-sm"
                          dir="auto"
                        >
                          {m.q}
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[92%] card px-4 py-3.5 text-sm text-[#0F2137] dark:text-slate-200 whitespace-pre-wrap leading-7">
                          <div dir="auto">{m.a}</div>
                          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                            <button
                              type="button"
                              onClick={async () => {
                                await navigator.clipboard.writeText(m.a);
                                setCopiedAnswerIdx(i);
                                window.setTimeout(() => setCopiedAnswerIdx(null), 1600);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#0E7490] dark:hover:text-[#22D3EE] transition-colors"
                            >
                              <AppIcon name={copiedAnswerIdx === i ? 'check' : 'copy'} size={12} />
                              <span>{copiedAnswerIdx === i ? t.copied : t.copyText}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="bg-white dark:bg-[#0F2137] border-t border-slate-200/85 dark:border-slate-800 p-4">
              <form onSubmit={ask} className="max-w-3xl mx-auto flex gap-2.5">
                <input
                  className="field flex-1"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t.askPlaceholder}
                />
                <button type="submit" className="btn btn-primary px-5" disabled={busy || !question.trim()}>
                  <AppIcon name="sparkles" size={15} />
                  <span>{busy ? '…' : t.send}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Secure Share Tab */}
        {tab === 'share' && (
          <div className="flex-1 overflow-y-auto bg-[#F1F5F9] dark:bg-[#0A1626] p-5 sm:p-8">
            <div className="card max-w-xl mx-auto p-6 sm:p-7">
              <div className="flex items-start gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-[#132942] border border-brand-200/80 dark:border-[#0891B2]/30 text-[#0E7490] dark:text-[#22D3EE] grid place-items-center shrink-0">
                  <AppIcon name="lock" size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.secureShare}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {t.shareHelp}
                  </p>
                </div>
              </div>

              <form onSubmit={createShare} className="mt-5 space-y-4">
                <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                  {t.linkPassword}
                  <PasswordInput
                    wrapperClassName="mt-1.5"
                    minLength={6}
                    required
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="ab1234"
                    showLabel={t.showPassword}
                    hideLabel={t.hidePassword}
                    startIcon={<AppIcon name="key" size={16} />}
                  />
                </label>
                <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                  {t.linkExpiry}
                  <select
                    className="field mt-1.5"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  >
                    <option value="24">24 {t.hours}</option>
                    <option value="168">7 {t.days}</option>
                    <option value="720">30 {t.days}</option>
                  </select>
                </label>
                <button type="submit" className="btn btn-primary text-xs px-5 py-2.5" disabled={busy}>
                  <AppIcon name="share" size={15} />
                  <span>{busy ? '…' : t.createLink}</span>
                </button>
              </form>

              {shareUrl && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70">
                  <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-2">
                    {t.copyLink}
                  </label>
                  <div className="flex gap-2">
                    <input className="field text-xs font-mono" dir="ltr" readOnly value={shareUrl} />
                    <button
                      type="button"
                      className="btn btn-primary text-xs shrink-0"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareUrl);
                        setCopiedShare(true);
                        window.setTimeout(() => setCopiedShare(false), 1800);
                      }}
                    >
                      <AppIcon name={copiedShare ? 'check' : 'copy'} size={14} />
                      <span>{copiedShare ? t.copied : t.copyLink}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
