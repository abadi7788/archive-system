'use client';
import { FormEvent, useRef, useState } from 'react';
import { AppIcon } from './BrandMark';
import PasswordInput from './components/PasswordInput';
import type { LocaleCode } from './components/types';
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
  onDownload,
  onClose,
}: {
  doc: PreviewDoc;
  token: string;
  language: LocaleCode;
  onDownload?: () => void;
  onClose: () => void;
}) {
  const t = getTranslations(language);
  const dir = getDirection(language);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [tab, setTab] = useState<'preview' | 'text' | 'chat' | 'share'>('preview');
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [expiry, setExpiry] = useState('24');
  const [shareUrl, setShareUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [copiedNotice, setCopiedNotice] = useState('');

  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const isPdf = doc.mime_type === 'application/pdf';

  function handlePrint() {
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
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || t.errorGeneric);
      setHistory((v) => [...v, { q: question, a: d.answer }]);
      setQuestion('');
    } catch (e: any) {
      setNotice(e.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  async function createShare(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const r = await fetch(`/api/v1/documents/${doc.id}/share`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ password: sharePassword, expires_in_hours: Number(expiry) }),
        cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || t.errorGeneric);
      setShareUrl(`${window.location.origin}/shared#${encodeURIComponent(d.share_token)}`);
    } catch (e: any) {
      setNotice(e.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      dir={dir}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="w-full max-w-6xl h-[92vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Action Toolbar: Title + Download + Print + Close */}
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
              {doc.file_name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {[doc.owner_name, doc.classification, doc.department].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLocalDownload}
              className="btn btn-muted text-xs py-2 px-3"
              title={t.download}
            >
              <AppIcon name="download" size={15} />
              <span className="hidden sm:inline">{t.download}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-muted text-xs py-2 px-3"
              title={t.print}
            >
              <AppIcon name="printer" size={15} />
              <span className="hidden sm:inline">{t.print}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-muted text-xs py-2 px-3"
              aria-label={t.close}
            >
              <AppIcon name="x" size={15} />
              <span className="hidden sm:inline">{t.close}</span>
            </button>
          </div>
        </header>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-1 px-4 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 overflow-x-auto">
          {(
            [
              ['preview', t.preview],
              ['text', t.extractedText],
              ['chat', t.askDocument],
              ['share', t.secureShare],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setNotice('');
              }}
              className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {notice && (
          <div className="mx-4 mt-3 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 px-3.5 py-2.5 text-xs font-medium">
            {notice}
          </div>
        )}

        {/* Instant Preview Tab */}
        {tab === 'preview' && (
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 p-3 sm:p-5 flex items-center justify-center overflow-auto">
            {isPdf ? (
              <iframe
                ref={iframeRef}
                title={doc.file_name}
                src={doc.objectUrl}
                className="w-full h-full min-h-[60vh] rounded-xl bg-white border border-slate-200 dark:border-slate-800"
              />
            ) : (
              <img
                src={doc.objectUrl}
                alt={doc.file_name}
                referrerPolicy="no-referrer"
                className="max-w-full max-h-full object-contain rounded-xl shadow-sm bg-white dark:bg-slate-900"
              />
            )}
          </div>
        )}

        {/* Extracted Text & Metadata Tab */}
        {tab === 'text' && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                {doc.summary && (
                  <p className="text-sm text-slate-700 dark:text-slate-200">{doc.summary}</p>
                )}
                {doc.keywords && doc.keywords.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {doc.keywords.join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn btn-muted text-xs py-1.5 px-3 shrink-0"
                onClick={async () => {
                  await navigator.clipboard.writeText(doc.extracted_text || '');
                  setCopiedNotice(t.copied);
                  window.setTimeout(() => setCopiedNotice(''), 1800);
                }}
              >
                {copiedNotice || t.copyText}
              </button>
            </div>
            <div
              className="flex-1 p-5 overflow-auto select-text whitespace-pre-wrap leading-7 text-sm text-slate-800 dark:text-slate-200"
              dir="auto"
            >
              {doc.extracted_text || t.noExtractedText}
            </div>
          </div>
        )}

        {/* Ask Document Tab */}
        {tab === 'chat' && (
          <div className="flex-1 min-h-0 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-5">
            <div className="flex-1 overflow-y-auto space-y-3.5">
              {!history.length && (
                <div className="h-full grid place-items-center text-sm text-slate-400 dark:text-slate-500">
                  {t.askPlaceholder}
                </div>
              )}
              {history.map((m, i) => (
                <div key={i} className="space-y-2">
                  <div className="bg-blue-50 dark:bg-blue-950/50 text-slate-900 dark:text-slate-100 rounded-xl px-4 py-3 text-sm font-medium">
                    {m.q}
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-7">
                    {m.a}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={ask} className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <input
                className="field"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t.askPlaceholder}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
                {busy ? '…' : t.send}
              </button>
            </form>
          </div>
        )}

        {/* Secure Share Tab */}
        {tab === 'share' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 max-w-xl">
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.shareHelp}</p>
            <form onSubmit={createShare} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
              <button type="submit" className="btn btn-primary text-xs" disabled={busy}>
                {busy ? '…' : t.createLink}
              </button>
            </form>
            {shareUrl && (
              <div className="mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70">
                <label className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-2">
                  {t.copyLink}
                </label>
                <div className="flex gap-2">
                  <input className="field text-xs" dir="ltr" readOnly value={shareUrl} />
                  <button
                    type="button"
                    className="btn btn-muted text-xs shrink-0"
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                  >
                    {t.copyLink}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
