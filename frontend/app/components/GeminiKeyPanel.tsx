'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import PasswordInput from './PasswordInput';
import { getTranslations } from '../lib/i18n';
import { localizeApiError } from '../lib/errorLocalizer';
import type { LocaleCode } from './types';

type KeyRow = { id: string; label: string; kind: 'system' | 'user' | 'environment'; masked_key: string;
  is_active: boolean; status: 'active' | 'limited' | 'disabled'; requests_today: number;
  daily_limit: number; remaining_estimate: number };

function KeyControls({ row, busy, update, remove, ar }: { row: KeyRow; busy: boolean; ar: boolean;
  update: (row: KeyRow, payload: object) => Promise<void>; remove: (row: KeyRow) => void }) {
  const [limit, setLimit] = useState(String(row.daily_limit));
  return <div className="flex flex-wrap items-center gap-2">
    <label className="sr-only" htmlFor={`limit-${row.kind}-${row.id}`}>{ar ? 'الحد اليومي' : 'Daily limit'}</label>
    <input id={`limit-${row.kind}-${row.id}`} type="number" min={1} max={1000000} dir="ltr" className="field !w-28 text-sm" value={limit} onChange={(e) => setLimit(e.target.value)} />
    <button type="button" disabled={busy || !Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000000}
      className="btn btn-muted text-xs" onClick={() => void update(row, { daily_limit: Number(limit) })}>{ar ? 'حفظ الحد' : 'Save limit'}</button>
    {row.kind === 'system' && <>
      <button type="button" disabled={busy} className="btn btn-muted text-xs" onClick={() => void update(row, { is_active: !row.is_active })}>{row.is_active ? (ar ? 'تعطيل' : 'Disable') : (ar ? 'تفعيل' : 'Enable')}</button>
      <button type="button" disabled={busy} className="btn btn-danger text-xs" onClick={() => remove(row)}>{ar ? 'حذف' : 'Delete'}</button>
    </>}
  </div>;
}

export default function GeminiKeyPanel({ token, locale }: { token: string; locale: LocaleCode }) {
  const ar = locale === 'ar';
  const t = getTranslations(locale);
  const [rows, setRows] = useState<KeyRow[]>([]);
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [limit, setLimit] = useState('1500');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleting, setDeleting] = useState<KeyRow | null>(null);
  const request = useCallback(async (path = '', options: RequestInit = {}) => {
    const response = await fetch(`/api/v1/admin/gemini-keys${path}`, { ...options, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept-Language': locale } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(localizeApiError(data?.detail, response.status, locale, getTranslations(locale)));
    return data;
  }, [token, locale]);
  const load = useCallback(async () => { setRows(await request()); }, [request]);
  useEffect(() => {
    let active = true;
    const refresh = () => request().then((data) => { if (active) setRows(data); }).catch((error) => { if (active) setNotice(error.message); });
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [request]);
  async function mutate(path: string, method: string, body?: object) {
    setBusy(true); setNotice('');
    try { await request(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); await load(); setNotice(t.savedSuccess); return true; }
    catch (error: any) { setNotice(error.message || t.errorGeneric); return false; }
    finally { setBusy(false); }
  }
  async function add(event: FormEvent) {
    event.preventDefault();
    if (await mutate('', 'POST', { label: label.trim(), api_key: key.trim(), daily_limit: Number(limit) })) { setKey(''); setLabel(''); }
  }
  return <section className="space-y-4">
    <div className="card p-5 space-y-3">
      <h3 className="text-lg font-bold">{t.geminiKeysTitle}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{t.geminiKeysDescription}</p>
      <form onSubmit={add} className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
        <label className="text-sm font-semibold">{ar ? 'اسم المفتاح' : 'Key label'}<input required maxLength={120} className="field mt-1" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
        <label className="text-sm font-semibold">Gemini API Key<PasswordInput required minLength={20} maxLength={256} value={key} onChange={(e) => setKey(e.target.value)} wrapperClassName="mt-1" autoComplete="off" dir="ltr" showLabel={t.showPassword} hideLabel={t.hidePassword} /></label>
        <label className="text-sm font-semibold">{ar ? 'الحد اليومي التقديري' : 'Estimated daily limit'}<input required type="number" min={1} max={1000000} dir="ltr" className="field mt-1" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
        <button disabled={busy} className="btn btn-primary">{busy ? t.saving : ar ? 'إضافة مفتاح' : 'Add key'}</button>
      </form>
      {notice && <p role="status" className="text-sm font-semibold text-brand-700 dark:text-brand-300">{notice}</p>}
    </div>
    <div className="grid gap-3">
      {rows.map((row) => <article key={`${row.kind}-${row.id}`} className="card p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h4 className="font-bold">{row.label} <span className="text-xs font-medium text-slate-600 dark:text-slate-300">({row.kind === 'user' ? (ar ? 'موظف' : 'Employee') : row.kind === 'environment' ? (ar ? 'بيئة النشر' : 'Environment') : (ar ? 'النظام' : 'System')})</span></h4><code dir="ltr" className="text-sm">{row.masked_key}</code></div>
          <span className={`self-start rounded-lg px-3 py-1 text-xs font-bold ${row.status === 'active' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : row.status === 'limited' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
            {row.status === 'active' ? (ar ? 'نشط' : 'Active') : row.status === 'limited' ? (ar ? 'وصل للحد' : 'Limited') : (ar ? 'معطّل' : 'Disabled')}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm"><span>{ar ? 'طلبات اليوم' : 'Today'}: <b dir="ltr">{row.requests_today}</b></span><span>{ar ? 'الحد اليومي' : 'Daily limit'}: <b dir="ltr">{row.daily_limit}</b></span><span>{ar ? 'المتبقي التقديري' : 'Estimated remaining'}: <b dir="ltr">{row.remaining_estimate}</b></span></div>
        <KeyControls row={row} ar={ar} busy={busy} update={async (entry, payload) => { await mutate(`/${entry.id}?kind=${entry.kind}`, 'PATCH', payload); }} remove={setDeleting} />
      </article>)}
      {!rows.length && <p className="card p-6 text-sm">{ar ? 'لا توجد مفاتيح محفوظة. أضف مفتاحاً لبدء المعالجة.' : 'No saved keys. Add a key to begin processing.'}</p>}
    </div>
    {deleting && <div role="alertdialog" aria-modal="true" aria-labelledby="delete-key-title" className="fixed inset-0 z-[90] bg-slate-950/70 flex items-center justify-center p-4">
      <div className="card p-6 w-full max-w-md space-y-4"><h3 id="delete-key-title" className="font-bold">{ar ? 'حذف المفتاح؟' : 'Delete key?'} {deleting.label}</h3>
        <div className="flex gap-2"><button disabled={busy} className="btn btn-danger" onClick={async () => { if (await mutate(`/${deleting.id}`, 'DELETE')) setDeleting(null); }}>{t.deleteAction}</button><button disabled={busy} className="btn btn-muted" onClick={() => setDeleting(null)}>{t.cancel}</button></div>
        {notice && <p role="status">{notice}</p>}
      </div>
    </div>}
  </section>;
}
