'use client';
import { FormEvent, useEffect, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { localizeApiError } from '../lib/errorLocalizer';
import { getTranslations } from '../lib/i18n';
import type { LocaleCode, User } from './types';

type Relationship = { id: string; user_a_id: string; user_b_id: string; mode: 'mutual' | 'supervisory'; access: 'read' | 'full';
  user_a: { display_name: string; username: string }; user_b: { display_name: string; username: string } };
const blank = { user_a_id: '', user_b_id: '', mode: 'mutual' as Relationship['mode'], access: 'read' as Relationship['access'] };
export default function RelationshipsPanel({ token, users, locale }: { token: string; users: User[]; locale: LocaleCode }) {
  const ar = locale === 'ar', t = getTranslations(locale);
  const [rows, setRows] = useState<Relationship[]>([]), [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(''), [removing, setRemoving] = useState(''), [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function request(path = '', init: RequestInit = {}) {
    const response = await fetch(`/api/v1/relationships${path}`, { ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (!response.ok) { let detail = ''; try { detail = (await response.json()).detail; } catch {} throw new Error(localizeApiError(detail, response.status, locale, t)); }
    return response.status === 204 ? null : response.json();
  }
  async function load() { setLoading(true); try { setRows(await request()); } catch (e: any) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  function reset() { setEditing(''); setForm(blank); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await request(editing ? `/${editing}` : '', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      reset(); setNotice(ar ? 'تم حفظ العلاقة والصلاحيات.' : 'Relationship and permissions saved.'); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(''); setNotice('');
    try { await request(`/${id}`, { method: 'DELETE' }); setRemoving(''); if (editing === id) reset();
      setNotice(ar ? 'تم إلغاء الرابط. لم تُحذف أي ملفات.' : 'Relationship revoked. No files were deleted.'); await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  const active = users.filter(user => user.is_active !== false);
  const filtered = rows.filter(row => [row.user_a?.display_name, row.user_b?.display_name, row.user_a?.username, row.user_b?.username].join(' ').toLowerCase().includes(query.toLowerCase()));
  return <div className="space-y-5">
    <div className="rounded-2xl bg-gradient-to-l from-[#0E7490] to-[#0F2137] text-white p-6 flex items-start gap-4">
      <AppIcon name="users" size={30} className="shrink-0" /><div><h3 className="text-lg font-bold">{ar ? 'روابط واضحة، مساحات مستقلة' : 'Clear relationships, separate workspaces'}</h3>
      <p className="text-sm text-white/80 mt-2 leading-relaxed">{ar ? 'كل رابط بين شخصين فقط. ربط أحمد بسارة وخالد لا يربط سارة بخالد، ولا يخلط ملفاتهم بالأرشيف الشخصي.' : 'Each relationship connects just two people. Connecting A to B and C never connects B to C or mixes their personal archives.'}</p></div>
    </div>
    {error && <p role="alert" className="card p-4 text-rose-600">{error}</p>}
    {notice && <p role="status" className="card p-4 text-emerald-700 dark:text-emerald-300">{notice}</p>}
    <div className="grid xl:grid-cols-12 gap-5 items-start">
      <form onSubmit={save} className="card p-5 xl:col-span-5 space-y-5">
        <h3 className="font-bold">{editing ? (ar ? 'تعديل الرابط' : 'Edit relationship') : (ar ? 'إنشاء رابط مستقل' : 'Create a relationship')}</h3>
        <fieldset disabled={busy} className="space-y-5">
          <div className="grid grid-cols-2 gap-2">{(['mutual', 'supervisory'] as const).map(mode => <label key={mode} className={`rounded-xl border p-3 cursor-pointer ${form.mode === mode ? 'border-brand-500 bg-brand-50 dark:bg-navy-deep' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" name="relationship-mode" value={mode} checked={form.mode === mode} onChange={() => setForm({ ...form, mode })} className="accent-brand-600 me-2" />
            <span className="text-sm font-bold">{mode === 'mutual' ? (ar ? 'ربط متبادل' : 'Mutual') : (ar ? 'ربط إشرافي' : 'Supervisory')}</span>
            <span className="block text-xs text-slate-500 mt-2">{mode === 'mutual' ? (ar ? 'مشاركة في الاتجاهين' : 'Two-way access') : (ar ? 'المشرف ← ملفات الموظف فقط' : 'Supervisor sees employee only')}</span>
          </label>)}</div>
          <label className="block text-xs font-semibold">{form.mode === 'supervisory' ? (ar ? 'المدير / المشرف' : 'Manager / supervisor') : (ar ? 'الطرف الأول' : 'First employee')}
            <select required disabled={!!editing} className="field mt-2" value={form.user_a_id} onChange={e => setForm({ ...form, user_a_id: e.target.value })}>
              <option value="">{ar ? 'اختر المستخدم' : 'Select user'}</option>{active.map(u => <option key={u.id} value={u.id}>{u.full_name || u.username} · @{u.username}</option>)}
            </select></label>
          <label className="block text-xs font-semibold">{form.mode === 'supervisory' ? (ar ? 'الموظف' : 'Employee') : (ar ? 'الطرف الثاني' : 'Second employee')}
            <select required disabled={!!editing} className="field mt-2" value={form.user_b_id} onChange={e => setForm({ ...form, user_b_id: e.target.value })}>
              <option value="">{ar ? 'اختر المستخدم' : 'Select user'}</option>{active.filter(u => u.id !== form.user_a_id).map(u => <option key={u.id} value={u.id}>{u.full_name || u.username} · @{u.username}</option>)}
            </select></label>
          {editing && form.mode === 'supervisory' && <button type="button" className="btn btn-secondary text-xs" onClick={() => setForm({ ...form, user_a_id: form.user_b_id, user_b_id: form.user_a_id })}>{ar ? 'تبديل المشرف والموظف' : 'Swap supervisor and employee'}</button>}
          <label className="block text-xs font-semibold">{ar ? 'مستوى الوصول' : 'Access level'}<select className="field mt-2" value={form.access} onChange={e => setForm({ ...form, access: e.target.value as Relationship['access'] })}>
            <option value="read">{ar ? 'عرض وتحميل فقط' : 'View and download only'}</option><option value="full">{ar ? 'تحكم كامل — إضافة وتعديل وحذف' : 'Full control — add, edit, delete'}</option>
          </select></label>
          <div className="rounded-xl bg-slate-50 dark:bg-navy-deep p-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {form.mode === 'supervisory' ? (ar ? 'الرابط غير ظاهر للموظف، ولا يمنحه أي وصول لملفات المشرف. لا يُرسل إليه إشعار بالربط.' : 'The link is hidden from the employee and grants no access to supervisor files. No linking notification is sent.') : (ar ? 'يرى كل طرف ملفات الآخر في قسم ملفات الفريق فقط.' : 'Both employees see each other’s files in Team files only.')}
            <p className="mt-2">{ar ? 'دور «مشاهد» يظل للقراءة فقط. مدير النظام يحتفظ بصلاحيات الإدارة العامة.' : 'The Viewer role remains read-only. System administrators retain global administration privileges.'}</p>
          </div>
          <div className="flex gap-2"><button type="submit" disabled={busy || !form.user_a_id || !form.user_b_id || form.user_a_id === form.user_b_id} className="btn btn-primary flex-1">{busy ? t.saving : t.saveChanges}</button>
            {editing && <button type="button" onClick={reset} className="btn btn-secondary">{t.cancel}</button>}</div>
        </fieldset>
      </form>
      <section className="card p-5 xl:col-span-7 space-y-4" aria-label={ar ? 'الروابط الحالية' : 'Current relationships'}>
        <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{ar ? 'الروابط الحالية' : 'Current relationships'} <span className="text-brand-600">{rows.length}</span></h3><button type="button" className="btn btn-secondary text-xs" disabled={busy || loading} onClick={load}>{ar ? 'تحديث' : 'Refresh'}</button></div>
        <input type="search" className="field" aria-label={ar ? 'بحث في الروابط' : 'Search relationships'} placeholder={ar ? 'ابحث باسم أحد الطرفين…' : 'Search either employee…'} value={query} onChange={e => setQuery(e.target.value)} />
        {loading ? <p role="status">{ar ? 'جارٍ تحميل الروابط…' : 'Loading relationships…'}</p> : !filtered.length ? <div className="text-center py-10 text-slate-500"><AppIcon name="users" size={32} className="mx-auto mb-3" />{ar ? 'لا توجد روابط مطابقة.' : 'No matching relationships.'}</div> :
          <div className="space-y-3">{filtered.map(row => <article key={row.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
            <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="font-bold truncate">{row.user_a?.display_name}</p><p className="text-xs text-slate-500">{row.mode === 'supervisory' ? (ar ? 'المشرف' : 'Supervisor') : (ar ? 'الطرف الأول' : 'First employee')}</p></div>
              <span className="rounded-full px-3 py-1 bg-brand-50 dark:bg-navy-deep text-brand-600" aria-label={row.mode === 'mutual' ? 'mutual' : 'supervisory'}>{row.mode === 'mutual' ? '↔' : '←'}</span>
              <div className="min-w-0 flex-1"><p className="font-bold truncate">{row.user_b?.display_name}</p><p className="text-xs text-slate-500">{ar ? 'الموظف' : 'Employee'}</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-md px-2 py-1 text-xs bg-slate-100 dark:bg-navy-deep">{row.access === 'full' ? (ar ? 'تحكم كامل' : 'Full control') : (ar ? 'عرض وتحميل' : 'View & download')}</span>
              {row.mode === 'supervisory' && <span className="text-xs text-slate-500">{ar ? 'إشرافي · غير ظاهر للموظف' : 'Supervisory · hidden from employee'}</span>}
              <div className="ms-auto flex gap-2"><button type="button" disabled={busy} className="btn btn-secondary text-xs" onClick={() => { setForm({ user_a_id: row.user_a_id, user_b_id: row.user_b_id, mode: row.mode, access: row.access }); setEditing(row.id); setError(''); }}>{ar ? 'تعديل' : 'Edit'}</button>
                <button type="button" disabled={busy} className="btn btn-secondary text-xs text-rose-600" onClick={() => setRemoving(row.id)}>{ar ? 'إلغاء الرابط' : 'Revoke'}</button></div></div>
            {removing === row.id && <div className="rounded-lg bg-rose-50 dark:bg-navy-deep p-3 text-sm" role="alert"><p>{ar ? 'إلغاء الوصول بين الطرفين؟ لن تُحذف الملفات.' : 'Revoke access between these employees? Files will not be deleted.'}</p><div className="flex gap-2 mt-3"><button type="button" disabled={busy} className="btn btn-primary text-xs" onClick={() => revoke(row.id)}>{ar ? 'تأكيد الإلغاء' : 'Confirm revoke'}</button><button type="button" disabled={busy} className="btn btn-secondary text-xs" onClick={() => setRemoving('')}>{t.cancel}</button></div></div>}
          </article>)}</div>}
      </section>
    </div>
  </div>;
}
