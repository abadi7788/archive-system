'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import PasswordInput from './PasswordInput';
import { AppIcon } from '../BrandMark';
import { getTranslations } from '../lib/i18n';
import { GEMINI_TEXT, indexingMessage } from '../lib/geminiI18n';
import { localizeApiError } from '../lib/errorLocalizer';
import type { LocaleCode } from './types';

type KeyRow = { id: string; label: string; kind: 'system' | 'user' | 'environment'; masked_key: string;
  is_active: boolean; status: 'active' | 'limited' | 'disabled'; reason?: string; retry_at?: string; checked_at?: string;
  requests_today: number; daily_limit: number; remaining_estimate: number };
type Snapshot = { model: string; queued: number; processing: number; failed: number; reasons: Record<string, number> };
const EMPTY: Snapshot = { model: '—', queued: 0, processing: 0, failed: 0, reasons: {} };

function Budget({ row, busy, locale, onSave }: { row: KeyRow; busy: boolean; locale: LocaleCode; onSave: (limit: number) => void }) {
  const c = GEMINI_TEXT[locale], t = getTranslations(locale);
  const [limit, setLimit] = useState(String(row.daily_limit));
  useEffect(() => { setLimit(String(row.daily_limit)); }, [row.daily_limit]);
  return <details className="text-xs">
    <summary className="cursor-pointer font-semibold py-2">{c.usage}: {row.requests_today} / {row.daily_limit}</summary>
    <div className="mt-2 space-y-2">
      <p className="text-slate-600 dark:text-slate-300">{c.limitHint}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="font-semibold">{c.limit}<input aria-label={`${c.limit}: ${row.label}`} type="number" min={1} max={1000000} dir="ltr" className="field mt-1 !w-36" value={limit} onChange={e => setLimit(e.target.value)} /></label>
        <button type="button" className="btn btn-muted text-xs" disabled={busy || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000000} onClick={() => onSave(Number(limit))}>{t.saveChanges}</button>
      </div>
      <p>{c.remaining}: {row.remaining_estimate}</p>
    </div>
  </details>;
}

export default function GeminiKeyPanel({ token, locale }: { token: string; locale: LocaleCode }) {
  const t = getTranslations(locale), c = GEMINI_TEXT[locale];
  const [rows, setRows] = useState<KeyRow[]>([]), [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const [label, setLabel] = useState(''), [key, setKey] = useState('');
  const [busy, setBusy] = useState(''), [loaded, setLoaded] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  const [deleting, setDeleting] = useState<KeyRow | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`/api/v1/admin/${path}`, { ...options, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Language': locale } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(localizeApiError(data?.detail, response.status, locale, getTranslations(locale)));
    return data;
  }, [token, locale]);
  const load = useCallback(async () => {
    const [keys, state] = await Promise.all([request('gemini-keys'), request('gemini-status')]);
    if (!Array.isArray(keys)) throw new Error(t.errorGeneric);
    return { keys: keys as KeyRow[], state: state?.model ? state as Snapshot : EMPTY };
  }, [request, t.errorGeneric]);
  useEffect(() => {
    let active = true;
    setLoaded(false); setError(''); setResults({});
    const refresh = () => load().then(data => { if (active) { setRows(data.keys); setSnapshot(data.state); setLoaded(true); } })
      .catch(e => { if (active) setError(e.message); });
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [load]);
  async function refresh() { const data = await load(); setRows(data.keys); setSnapshot(data.state); setLoaded(true); }
  async function mutate(row: KeyRow, method: string, payload?: object) {
    setBusy(row.id); setError(''); setNotice('');
    try {
      await request(`gemini-keys/${row.id}?kind=${row.kind}`, { method, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      if (method === 'DELETE') setDeleting(null);
      await refresh(); setResults({}); setNotice(t.savedSuccess);
    } catch (e: any) { setError(e.message || t.errorGeneric); }
    finally { setBusy(''); }
  }
  async function test(row: KeyRow) {
    setBusy(`test-${row.id}`); setError(''); setNotice('');
    try {
      const result = await request(`gemini-keys/${row.id}/test?kind=${row.kind}`, { method: 'POST' });
      setResults(previous => ({ ...previous, [`${row.kind}-${row.id}`]: result.code }));
      await refresh();
    } catch (e: any) { setError(e.message || t.errorGeneric); }
    finally { setBusy(''); }
  }
  async function add(event: FormEvent) {
    event.preventDefault(); setBusy('add'); setError(''); setNotice('');
    try {
      await request('gemini-keys', { method: 'POST', body: JSON.stringify({ label: label.trim(), api_key: key.trim(), daily_limit: 1500 }) });
      setKey(''); setLabel(''); await refresh(); setNotice(t.savedSuccess);
    } catch (e: any) { setError(e.message || t.errorGeneric); }
    finally { setBusy(''); }
  }
  const system = rows.filter(row => row.kind === 'system'), primary = system.find(row => row.is_active)?.id;
  function group(kind: KeyRow['kind'], title: string) {
    const items = rows.filter(row => row.kind === kind);
    if (!items.length) return null;
    return <section className="space-y-3" aria-label={title}>
      <h4 className="font-bold text-sm">{title}</h4>
      <div className="grid gap-3 xl:grid-cols-2">{items.map(row => {
        const result = results[`${row.kind}-${row.id}`];
        const reason = !row.is_active ? '' : row.reason || (row.status === 'limited' ? 'rate_limited' : row.status === 'disabled' ? 'invalid_key' : 'unchecked');
        const ok = row.is_active && reason === 'ready';
        const bad = !row.is_active || ['invalid_key', 'unreadable_key', 'model_unavailable', 'region_unsupported'].includes(reason);
        return <article key={`${kind}-${row.id}`} className={`card p-4 space-y-3 ${kind === 'system' && row.id === primary ? 'ring-1 ring-brand-500/40' : ''}`} aria-label={row.label}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0"><h5 className="font-bold break-words">{row.label}</h5><code dir="ltr" className="text-xs text-slate-500">{row.masked_key}</code></div>
            {kind === 'system' && row.is_active && <span className="rounded-lg bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-200 text-xs font-bold px-2.5 py-1">{row.id === primary ? c.primary : c.backup}</span>}
          </div>
          <p role={result === reason ? 'status' : undefined} className={`text-xs font-semibold leading-relaxed ${ok ? 'text-emerald-700 dark:text-emerald-300' : bad ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>{!row.is_active ? t.statusInactive : indexingMessage(reason, locale)}</p>
          {row.retry_at && <p className="text-xs text-slate-500">{c.retryAt}: <time dateTime={row.retry_at}>{new Date(row.retry_at).toLocaleTimeString(locale)}</time></p>}
          {row.checked_at && <p className="text-xs text-slate-500">{c.checked}: <time dateTime={row.checked_at}>{new Date(row.checked_at).toLocaleString(locale)}</time></p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} className="btn btn-primary text-xs" onClick={() => void test(row)}><AppIcon name="refresh" size={14} />{busy === `test-${row.id}` ? t.testing : t.testConnection}</button>
            {kind === 'system' && <>
              {row.id !== primary && row.is_active && <button type="button" disabled={!!busy} className="btn btn-muted text-xs" onClick={() => void mutate(row, 'PATCH', { make_primary: true })}>{c.makePrimary}</button>}
              <button type="button" disabled={!!busy} className="btn btn-muted text-xs" onClick={() => void mutate(row, 'PATCH', { is_active: !row.is_active })}>{row.is_active ? c.disable : c.enable}</button>
              <button type="button" disabled={!!busy} className="btn btn-danger text-xs" onClick={() => setDeleting(row)}>{t.deleteAction}</button>
            </>}
          </div>
          {result && result !== reason && <p role="status" className="text-sm font-semibold">{indexingMessage(result, locale)}</p>}
          <Budget row={row} locale={locale} busy={!!busy} onSave={limit => void mutate(row, 'PATCH', { daily_limit: limit })} />
        </article>;
      })}</div>
    </section>;
  }
  return <section className="space-y-5">
    <div className="card p-5 space-y-3">
      <h3 className="text-lg font-bold">{t.geminiKeysTitle}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.geminiKeysDescription}</p>
      <p className="text-sm leading-relaxed p-3 rounded-xl bg-brand-50 dark:bg-brand-950/40">{c.help}</p>
      <p className="text-xs text-slate-500">{c.model}: <code dir="ltr">{snapshot.model}</code></p>
      <div className="grid grid-cols-3 gap-2">
        {(['queued', 'processing', 'failed'] as const).map((status, i) => <div key={status} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center"><b className="block text-xl tabular-nums">{loaded ? snapshot[status] : '—'}</b><span className="text-xs">{[t.statusPending, t.statusProcessing, t.statusFailed][i]}</span></div>)}
      </div>
      {Object.entries(snapshot.reasons).map(([reason, count]) => <p key={reason} className="text-xs text-amber-700 dark:text-amber-300">{indexingMessage(reason, locale)} <b>({count})</b></p>)}
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-brand-700 dark:text-brand-300">{notice}</p>}
    </div>
    {loaded && !rows.length && <p className="text-sm">{c.empty}</p>}
    {group('system', c.system)}
    <details open={!system.length} className="card p-5">
      <summary className="font-bold cursor-pointer">{c.addKey}</summary>
      <form onSubmit={add} className="mt-4 grid md:grid-cols-2 gap-3 items-end">
        <label className="text-sm font-semibold">{c.keyName}<input required maxLength={120} className="field mt-1" value={label} onChange={e => setLabel(e.target.value)} /></label>
        <label className="text-sm font-semibold">Gemini API Key<PasswordInput required minLength={20} maxLength={256} value={key} onChange={e => setKey(e.target.value)} wrapperClassName="mt-1" autoComplete="off" dir="ltr" showLabel={t.showPassword} hideLabel={t.hidePassword} /></label>
        <button disabled={!!busy} className="btn btn-primary md:col-span-2 md:justify-self-start">{busy === 'add' ? t.saving : c.addKey}</button>
      </form>
    </details>
    {group('user', c.personal)}
    {group('environment', c.environment)}
    {deleting && <div role="alertdialog" aria-modal="true" aria-labelledby="delete-key-title" className="fixed inset-0 z-[90] bg-slate-950/70 flex items-center justify-center p-4"><div className="card p-6 w-full max-w-md space-y-4">
      <h3 id="delete-key-title" className="font-bold">{t.deleteAction}: {deleting.label}</h3>
      <div className="flex gap-2"><button disabled={!!busy} className="btn btn-danger" onClick={() => void mutate(deleting, 'DELETE')}>{t.deleteAction}</button><button disabled={!!busy} className="btn btn-muted" onClick={() => setDeleting(null)}>{t.cancel}</button></div>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div></div>}
  </section>;
}
