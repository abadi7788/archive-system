'use client';
import { FormEvent, useEffect, useState } from 'react';
import DateField from './DateField';
import { getTranslations } from '../lib/i18n';
import { localizeApiError } from '../lib/errorLocalizer';
import type { LocaleCode } from './types';

type EventRow = { id: string; actor_name: string; action: string; resource_type: string;
  resource_id?: string; detail: Record<string, unknown>; ip_address?: string; created_at: string };
const EMPTY = { employee: '', action: '', from_date: '', to_date: '' };
const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'تسجيل الدخول', 'auth.logout': 'تسجيل الخروج', 'auth.login_failed': 'محاولة دخول فاشلة',
  'user.created': 'إنشاء موظف', 'user.updated': 'تعديل الموظف أو صلاحياته', 'user.password_changed': 'تغيير كلمة المرور',
  'document.uploaded': 'رفع مستند', 'document.updated': 'تعديل مستند', 'document.downloaded': 'تحميل مستند',
  'document.previewed': 'معاينة مستند', 'document.print_requested': 'طلب طباعة مستند',
  'document.trashed': 'نقل مستند للسلة', 'document.restored': 'استعادة مستند',
  'folder.created': 'إنشاء مجلد', 'folder.trashed': 'حذف مجلد', 'folder.restored': 'استعادة مجلد',
  'gemini_key.created': 'إضافة مفتاح Gemini', 'gemini_key.updated': 'تعديل مفتاح Gemini', 'gemini_key.deleted': 'حذف مفتاح Gemini',
  'document.bulk_downloaded_zip': 'تحميل ملفات مضغوطة',
  'document.bulk_moved': 'نقل مجموعة مستندات',
  'document.bulk_trashed': 'حذف مجموعة مستندات',
  'document.chat': 'استعلام عن مستند',
  'document.edited': 'تعديل مستند',
  'document.exported': 'تصدير مستندات',
  'document.opened': 'فتح مستند',
  'document.permanently_deleted': 'حذف مستند نهائياً',
  'document.share_created': 'إنشاء مشاركة',
  'document.shared_downloaded': 'تحميل مستند مشترك',
  'document.shared_opened': 'فتح مستند مشترك',
  'employee_relationship.created': 'إنشاء علاقة مستقلة',
  'employee_relationship.updated': 'تعديل علاقة مستقلة',
  'employee_relationship.deleted': 'إلغاء علاقة مستقلة',
  'document.copied': 'نسخ مستند للأرشيف الشخصي',
  'employee_link_group.created': 'إنشاء ربط موظفين',
  'employee_link_group.deleted': 'حذف ربط موظفين',
  'employee_link_group.updated': 'تعديل ربط موظفين',
  'folder.permanently_deleted': 'حذف مجلد نهائياً',
  'folder.permissions_updated': 'تعديل صلاحيات مجلد',
  'folder.updated': 'تعديل مجلد',
  'folder.renamed': 'إعادة تسمية مجلد',
  'document.renamed': 'إعادة تسمية ملف',
  'system.ai_reindex_triggered': 'بدء إعادة الفهرسة',
  'system.backup_created': 'إنشاء نسخة احتياطية',
  'taxonomy.created': 'إضافة قسم أو تصنيف',
  'taxonomy.deleted': 'حذف قسم أو تصنيف',
  'trash.emptied': 'إفراغ سلة المحذوفات',
  'request.post': 'إضافة / إجراء', 'request.patch': 'تعديل إعدادات', 'request.put': 'تحديث إعدادات', 'request.delete': 'حذف',
  'system.gemini_settings_updated': 'تعديل إعدادات Gemini',
};
export default function AuditPanel({ token, locale }: { token: string; locale: LocaleCode }) {
  const ar = locale === 'ar';
  const t = getTranslations(locale);
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setBusy(true); setError('');
      try {
        const params = new URLSearchParams({ limit: '100', offset: String(page * 100) });
        Object.entries(applied).forEach(([key, value]) => { if (value) params.set(key, value); });
        const response = await fetch(`/api/v1/audit?${params}`, { headers: { Authorization: `Bearer ${token}`, 'Accept-Language': locale }, cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(localizeApiError(data?.detail, response.status, locale, getTranslations(locale)));
        setRows(data);
      } catch (err: any) { if (!controller.signal.aborted) setError(err.message || t.errorGeneric); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void load();
    return () => controller.abort();
  }, [applied, page, refresh, token, locale, t.errorGeneric]);
  function apply(event: FormEvent) { event.preventDefault(); setPage(0); setApplied({ ...filters }); }
  return <section className="card min-w-0 overflow-hidden">
    <div className="p-4 sm:p-5 space-y-4 border-b border-slate-200 dark:border-slate-700">
      <h3 className="font-bold text-lg">{t.auditTitle}</h3>
      <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 items-end">
        <label className="text-sm font-semibold">{ar ? 'الموظف' : 'Employee'}<input className="field mt-1" value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })} /></label>
        <label className="text-sm font-semibold">{ar ? 'نوع العملية' : 'Action'}<select className="field mt-1" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}><option value="">{ar ? 'كل العمليات' : 'All actions'}</option>{Object.entries(ACTION_LABELS).map(([key, label]) => <option key={key} value={key}>{ar ? label : key}</option>)}</select></label>
        <label className="text-sm font-semibold">{t.fromDate}<DateField label={t.fromDate} className="mt-1" value={filters.from_date} onChange={(value) => setFilters({ ...filters, from_date: value })} /></label>
        <label className="text-sm font-semibold">{t.toDate}<DateField label={t.toDate} className="mt-1" value={filters.to_date} onChange={(value) => setFilters({ ...filters, to_date: value })} /></label>
        <div className="flex flex-wrap gap-2"><button className="btn btn-primary" disabled={busy}>{ar ? 'تطبيق' : 'Apply'}</button><button type="button" className="btn btn-muted" onClick={() => { setFilters(EMPTY); setApplied({ ...EMPTY }); setPage(0); }}>{t.clear}</button></div>
      </form>
      <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'الفلاتر الزمنية حسب UTC. وقت الحدث معروض حسب توقيت جهازك. الطباعة تسجل كطلب طباعة؛ لا يستطيع المتصفح تأكيد خروج الورق.' : 'Date filters use UTC. Event times use your device timezone. Printing is logged as a print request; physical output cannot be confirmed.'}</p>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
    <div className="max-h-[58dvh] overflow-auto overscroll-contain">
      <table className="w-full text-sm text-start min-w-[720px]">
        <thead className="sticky top-0 bg-slate-100 dark:bg-[#132942]"><tr>{[ar ? 'الموظف' : 'Employee', t.auditAction, t.auditResource, ar ? 'تفاصيل العملية' : 'Details', 'IP', t.auditTime].map((name) => <th key={name} className="p-3 text-start font-bold">{name}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{rows.map((event) => <tr key={event.id}>
          <td className="p-3 font-semibold">{event.actor_name}</td><td className="p-3"><span>{ar ? ACTION_LABELS[event.action] || event.action : event.action}</span></td>
          <td className="p-3 text-slate-700 dark:text-slate-200"><span dir="ltr">{event.resource_type}</span>{event.resource_id && <span dir="ltr" className="block text-xs mt-1 break-all">{event.resource_id}</span>}</td>
          <td className="p-3 max-w-sm"><dl className="text-xs font-medium space-y-1">{Object.entries(event.detail).filter(([key]) => key !== 'actor_name').map(([key, value]) => <div key={key} className="break-words"><dt className="inline font-bold">{key}: </dt><dd className="inline" dir="auto">{typeof value === 'string' ? value : JSON.stringify(value)}</dd></div>)}</dl></td>
          <td className="p-3 text-xs" dir="ltr">{event.ip_address || '—'}</td><td className="p-3 whitespace-nowrap text-xs font-medium" dir="ltr">{new Date(event.created_at).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && !busy && <p className="p-8 text-center text-sm">{t.noAuditEvents}</p>}
    </div>
    <div className="p-4 flex flex-wrap gap-2 items-center border-t border-slate-200 dark:border-slate-700">
      <button disabled={busy || page === 0} className="btn btn-muted text-xs" onClick={() => setPage(page - 1)}>{ar ? 'السابق' : 'Previous'}</button>
      <span dir="ltr" className="text-sm px-2">{page + 1}</span><button disabled={busy || rows.length < 100} className="btn btn-muted text-xs" onClick={() => setPage(page + 1)}>{ar ? 'التالي' : 'Next'}</button>
      <button disabled={busy} className="btn btn-muted text-xs ms-auto" onClick={() => setRefresh(refresh + 1)}>{busy ? (ar ? 'جارٍ التحميل…' : 'Loading…') : ar ? 'تحديث السجل' : 'Reload log'}</button>
    </div>
  </section>;
}
