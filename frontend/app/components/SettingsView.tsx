'use client';
import React, { FormEvent, useState } from 'react';
import { AppIcon } from '../BrandMark';
import PasswordInput, { validateFlexiblePassword } from './PasswordInput';
import {
  AuditItem,
  FolderItem,
  StorageMetrics,
  SystemSummary,
  User,
  formatBytes,
  formatDateArabic,
  roleLabel,
} from './types';

type SettingsTab = 'account' | 'admin';
type AdminSubTab = 'users' | 'storage' | 'taxonomy' | 'reindex' | 'audit';

export default function SettingsView({
  user,
  users,
  folders,
  departments,
  categories,
  audit,
  systemSummary,
  storageMetrics,
  stepUpActive,
  provider,
  onChangePassword,
  onCreateUser,
  onUpdateUser,
  onUnlockStorage,
  onProviderChange,
  onSaveProvider,
  onTestStorage,
  onCreateBackup,
  onCreateFolder,
  onDeleteFolder,
  onTriggerReindex,
  onRefreshAdmin,
}: {
  user: User;
  users: User[];
  folders: FolderItem[];
  departments: string[];
  categories: string[];
  audit: AuditItem[];
  systemSummary: SystemSummary | null;
  storageMetrics: StorageMetrics | null;
  stepUpActive: boolean;
  provider: string;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onCreateUser: (payload: {
    username: string;
    password: string;
    role: string;
    department: string;
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    payload: {
      username?: string;
      role?: string;
      department?: string | null;
      is_active?: boolean;
      password?: string;
    }
  ) => Promise<void>;
  onUnlockStorage: (masterPassword: string) => Promise<void>;
  onProviderChange: (val: string) => void;
  onSaveProvider: () => Promise<void>;
  onTestStorage: () => Promise<string>;
  onCreateBackup: () => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onTriggerReindex: (force: boolean) => Promise<{ queued_count: number; message: string }>;
  onRefreshAdmin: () => Promise<void>;
}) {
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState<SettingsTab>('account');
  const [adminSub, setAdminSub] = useState<AdminSubTab>('users');

  // Account Password Form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Admin Create User Form
  const [uName, setUName] = useState('');
  const [uPass, setUPass] = useState('');
  const [uRole, setURole] = useState('archiver');
  const [uDept, setUDept] = useState('');
  const [uBusy, setUBusy] = useState(false);
  const [uNotice, setUNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('archiver');
  const [editDept, setEditDept] = useState('');
  const [editPass, setEditPass] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  // Storage Step-Up
  const [masterPass, setMasterPass] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMsg, setStorageMsg] = useState('');

  // Taxonomy
  const [newFolderName, setNewFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  // Reindex
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');

  async function handleAccountPassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const err = validateFlexiblePassword(newPw);
    if (err) {
      setPwMsg({ type: 'err', text: err });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.' });
      return;
    }
    setPwBusy(true);
    try {
      await onChangePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'ok', text: 'تم تحديث كلمة المرور بنجاح.' });
    } catch (e: any) {
      setPwMsg({ type: 'err', text: e?.message || 'تعذر تغيير كلمة المرور.' });
    } finally {
      setPwBusy(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setUNotice(null);
    const err = validateFlexiblePassword(uPass);
    if (err) {
      setUNotice({ type: 'err', text: err });
      return;
    }
    setUBusy(true);
    try {
      await onCreateUser({
        username: uName.trim(),
        password: uPass,
        role: uRole,
        department: uDept.trim(),
      });
      setUName('');
      setUPass('');
      setUDept('');
      setURole('archiver');
      setUNotice({
        type: 'ok',
        text: 'تم إنشاء المستخدم بكلمة مرور مؤقتة؛ سيُطلب منه تغييرها تلقائياً عند أول تسجيل دخول.',
      });
    } catch (e: any) {
      setUNotice({ type: 'err', text: e?.message || 'تعذر إنشاء المستخدم.' });
    } finally {
      setUBusy(false);
    }
  }

  function openEdit(target: User) {
    setEditingUser(target);
    setEditName(target.username);
    setEditRole(target.role);
    setEditDept(target.department || '');
    setEditPass('');
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (editPass.trim()) {
      const err = validateFlexiblePassword(editPass);
      if (err) {
        setUNotice({ type: 'err', text: err });
        return;
      }
    }
    setEditBusy(true);
    try {
      await onUpdateUser(editingUser.id, {
        username: editName.trim(),
        role: editRole,
        department: editDept.trim() || null,
        ...(editPass.trim() ? { password: editPass } : {}),
      });
      setEditingUser(null);
      setUNotice({ type: 'ok', text: 'تم تحديث بيانات المستخدم بنجاح.' });
    } catch (e: any) {
      setUNotice({ type: 'err', text: e?.message || 'تعذر تحديث بيانات المستخدم.' });
    } finally {
      setEditBusy(false);
    }
  }

  const diskTotal = storageMetrics?.disk_capacity_bytes ?? systemSummary?.disk_capacity_bytes ?? 0;
  const diskFree = storageMetrics?.disk_free_bytes ?? systemSummary?.disk_free_bytes ?? 0;
  const diskUsed = diskTotal > 0 ? Math.max(0, diskTotal - diskFree) : 0;
  const diskPct = diskTotal > 0 ? Math.min(100, Math.round((diskUsed / diskTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      <section className="archive-hero !mb-0">
        <div>
          <span className="section-eyebrow">SETTINGS & GOVERNANCE</span>
          <h2>الإعدادات وإدارة الحساب</h2>
          <p>
            إدارة بيانات حسابك وكلمة المرور
            {isAdmin ? '، بالإضافة إلى إدارة المستخدمين، التخزين، التصنيفات، وإعادة الفهرسة الذكية.' : '.'}
          </p>
        </div>

        {/* Main Settings Tabs */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shrink-0">
          <button
            type="button"
            onClick={() => setTab('account')}
            className={`rounded-lg px-4 py-2 text-xs font-extrabold transition-colors ${
              tab === 'account' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            إعدادات الحساب
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                onRefreshAdmin();
              }}
              className={`rounded-lg px-4 py-2 text-xs font-extrabold transition-colors ${
                tab === 'admin' ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              إدارة النظام
            </button>
          )}
        </div>
      </section>

      {/* ACCOUNT SETTINGS TAB (Visible to all users) */}
      {tab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Profile Card */}
          <section className="card p-6 lg:col-span-5 space-y-5">
            <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-600 to-teal-600 text-white font-black text-xl grid place-items-center shrink-0">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 truncate">{user.username}</h3>
                <span className="mt-1 inline-flex rounded-full bg-sky-50 border border-sky-200/70 px-3 py-0.5 text-xs font-bold text-sky-800">
                  {roleLabel(user.role)}
                </span>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <dt className="text-slate-500">اسم المستخدم</dt>
                <dd className="font-bold text-slate-900" dir="ltr">
                  {user.username}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <dt className="text-slate-500">الصلاحية</dt>
                <dd className="font-bold text-slate-900">{roleLabel(user.role)}</dd>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <dt className="text-slate-500">القسم</dt>
                <dd className="font-bold text-slate-900">{user.department || 'عام / غير محدد'}</dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-slate-500">حالة الحساب</dt>
                <dd className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  نشط
                </dd>
              </div>
            </dl>
          </section>

          {/* Change Password Card */}
          <form onSubmit={handleAccountPassword} className="card p-6 lg:col-span-7 space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">تغيير كلمة المرور</h3>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك استخدام كلمة مرور مرنة (6 أحرف على الأقل تحتوي على حرفين وأرقام أو رموز مثل{' '}
                <span dir="ltr" className="font-mono font-bold text-slate-700">
                  ab1234
                </span>
                ).
              </p>
            </div>

            <label className="block text-xs font-bold text-slate-700">
              كلمة المرور الحالية
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                placeholder="أدخل كلمة المرور الحالية"
                autoComplete="current-password"
                required
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-bold text-slate-700">
                كلمة المرور الجديدة
                <PasswordInput
                  wrapperClassName="mt-1.5"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="مثال: ab1234"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>

              <label className="block text-xs font-bold text-slate-700">
                تأكيد كلمة المرور الجديدة
                <PasswordInput
                  wrapperClassName="mt-1.5"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة"
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
            </div>

            {pwMsg && (
              <p
                role="alert"
                className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${
                  pwMsg.type === 'ok'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
              >
                {pwMsg.text}
              </p>
            )}

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={pwBusy} className="btn btn-primary text-xs px-6">
                {pwBusy ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN SETTINGS TAB (Admin role ONLY) */}
      {tab === 'admin' && isAdmin && (
        <div className="space-y-5">
          {/* Admin Sub-tabs */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['users', 'users', 'إدارة المستخدمين'],
                ['storage', 'storage', 'التخزين والنسخ الاحتياطي'],
                ['taxonomy', 'folder', 'الأقسام والتصنيفات'],
                ['reindex', 'sparkles', 'إعادة الفهرسة الذكية (AI)'],
                ['audit', 'audit', 'سجل التدقيق'],
              ] as [AdminSubTab, string, string][]
            ).map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAdminSub(key)}
                className={`btn text-xs inline-flex items-center gap-2 ${
                  adminSub === key
                    ? 'btn-primary'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AppIcon name={icon} size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 1. USERS MANAGEMENT */}
          {adminSub === 'users' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <form onSubmit={handleCreateUser} className="card p-6 xl:col-span-5 space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <h3 className="text-base font-extrabold text-slate-900">إنشاء مستخدم جديد</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    كلمة المرور المؤقتة تتبع السياسة المرنة (6 أحرف على الأقل مثل{' '}
                    <span dir="ltr" className="font-mono font-bold">
                      ab1234
                    </span>
                    ) وسيُطلب من المستخدم تغييرها عند أول دخول.
                  </p>
                </div>

                <label className="block text-xs font-bold text-slate-700">
                  اسم المستخدم (أحرف إنجليزية وأرقام)
                  <input
                    className="field mt-1.5 text-sm"
                    dir="ltr"
                    placeholder="ahmed.ali"
                    pattern="[A-Za-z0-9_.-]+"
                    minLength={3}
                    value={uName}
                    onChange={(e) => setUName(e.target.value)}
                    required
                  />
                </label>

                <label className="block text-xs font-bold text-slate-700">
                  كلمة المرور المؤقتة
                  <PasswordInput
                    wrapperClassName="mt-1.5"
                    placeholder="مثال: ab1234"
                    minLength={6}
                    value={uPass}
                    onChange={(e) => setUPass(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-bold text-slate-700">
                    الصلاحية
                    <select
                      className="field mt-1.5 text-sm"
                      value={uRole}
                      onChange={(e) => setURole(e.target.value)}
                    >
                      <option value="archiver">موظف أرشفة</option>
                      <option value="viewer">عرض فقط</option>
                      <option value="admin">مدير النظام</option>
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    القسم
                    <input
                      className="field mt-1.5 text-sm"
                      placeholder="المالية / الموارد البشرية"
                      value={uDept}
                      onChange={(e) => setUDept(e.target.value)}
                    />
                  </label>
                </div>

                {uNotice && (
                  <p
                    role="alert"
                    className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                      uNotice.type === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    {uNotice.text}
                  </p>
                )}

                <button type="submit" disabled={uBusy} className="btn btn-primary w-full text-xs">
                  {uBusy ? 'جاري الإنشاء...' : 'إنشاء الحساب بكلمة مرور مؤقتة'}
                </button>
              </form>

              <section className="card p-6 xl:col-span-7 overflow-x-auto">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                  <h3 className="text-base font-extrabold text-slate-900">
                    المستخدمون ({users.length})
                  </h3>
                </div>
                <table className="w-full text-sm text-right">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-100">
                      <th className="pb-2.5 font-bold">المستخدم</th>
                      <th className="pb-2.5 font-bold">الصلاحية</th>
                      <th className="pb-2.5 font-bold">القسم</th>
                      <th className="pb-2.5 font-bold">الحالة</th>
                      <th className="pb-2.5 font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="py-3 font-bold text-slate-900">
                          <div>{u.username}</div>
                          {u.must_change_password && (
                            <span className="inline-block mt-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                              بانتظار تغيير كلمة المرور
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-xs text-slate-700">{roleLabel(u.role)}</td>
                        <td className="py-3 text-xs text-slate-600">{u.department || '—'}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                              u.is_active !== false
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {u.is_active !== false ? 'نشط' : 'موقوف'}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(u)}
                              className="btn btn-muted py-1.5 px-2.5 text-xs"
                            >
                              تعديل
                            </button>
                            {u.id !== user.id && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateUser(u.id, { is_active: u.is_active === false })
                                }
                                className="btn btn-muted py-1.5 px-2.5 text-xs"
                              >
                                {u.is_active !== false ? 'تعطيل' : 'تفعيل'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {/* 2. STORAGE USAGE & BACKUP */}
          {adminSub === 'storage' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card stat-card">
                  <div className="stat-card-head">
                    <span>المستندات المحفوظة</span>
                    <span className="stat-icon stat-blue">
                      <AppIcon name="archive" size={18} />
                    </span>
                  </div>
                  <b className="stat-value">
                    {storageMetrics?.saved_files ?? systemSummary?.total_documents ?? 0}
                  </b>
                  <span className="stat-foot">إجمالي الملفات المؤرشفة</span>
                </div>

                <div className="card stat-card">
                  <div className="stat-card-head">
                    <span>حجم الملفات المؤرشفة</span>
                    <span className="stat-icon stat-teal">
                      <AppIcon name="storage" size={18} />
                    </span>
                  </div>
                  <b className="stat-value stat-value-small" dir="ltr">
                    {formatBytes(
                      storageMetrics?.stored_file_bytes ?? systemSummary?.stored_file_bytes
                    )}
                  </b>
                  <span className="stat-foot">المساحة الفعلية للمستندات</span>
                </div>

                <div className="card stat-card">
                  <div className="stat-card-head">
                    <span>المساحة المتاحة على القرص</span>
                    <span className="stat-icon stat-violet">
                      <AppIcon name="storage" size={18} />
                    </span>
                  </div>
                  <b className="stat-value stat-value-small" dir="ltr">
                    {diskFree ? formatBytes(diskFree) : '—'}
                  </b>
                  <span className="stat-foot">من أصل {diskTotal ? formatBytes(diskTotal) : '—'}</span>
                </div>

                <div className="card stat-card">
                  <div className="stat-card-head">
                    <span>مزود التخزين النشط</span>
                    <span className="stat-icon stat-amber">
                      <AppIcon name="settings" size={18} />
                    </span>
                  </div>
                  <b className="stat-value stat-value-small uppercase">
                    {storageMetrics?.provider || systemSummary?.provider || provider}
                  </b>
                  <span className="stat-foot">تخزين مشفر AES-256 / Fernet</span>
                </div>
              </div>

              {diskTotal > 0 && (
                <section className="card p-5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                    <span>استهلاك سعة القرص</span>
                    <span dir="ltr">{diskPct}%</span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-sky-500 to-teal-500 transition-all"
                      style={{ width: `${diskPct}%` }}
                    />
                  </div>
                </section>
              )}

              {/* Step-Up Protected Storage & Backup Controls */}
              <section className="card p-6 space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">
                  إعدادات التخزين المتقدمة والنسخ الاحتياطي المشفر
                </h3>
                {!stepUpActive ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setStorageBusy(true);
                      setStorageMsg('');
                      try {
                        await onUnlockStorage(masterPass);
                        setMasterPass('');
                        setStorageMsg('تم فتح إعدادات التخزين بنجاح.');
                      } catch (err: any) {
                        setStorageMsg(err?.message || 'كلمة المرور الرئيسية غير صحيحة.');
                      } finally {
                        setStorageBusy(false);
                      }
                    }}
                    className="max-w-md space-y-3"
                  >
                    <p className="text-xs text-slate-600 leading-6">
                      أدخل كلمة المرور الرئيسية للنظام (Master Admin Password) لتعديل مزود التخزين أو تنزيل نسخة احتياطية مشفرة.
                    </p>
                    <PasswordInput
                      value={masterPass}
                      onChange={(e) => setMasterPass(e.target.value)}
                      placeholder="كلمة المرور الرئيسية للنظام"
                      required
                    />
                    <button type="submit" disabled={storageBusy} className="btn btn-primary text-xs">
                      {storageBusy ? 'جاري التحقق...' : 'فتح الإعدادات المتقدمة'}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-xl">
                      <label className="block text-xs font-bold text-slate-700 flex-1">
                        مزود التخزين
                        <select
                          className="field mt-1.5 text-sm"
                          value={provider}
                          onChange={(e) => onProviderChange(e.target.value)}
                        >
                          <option value="local">تخزين محلي (Docker Volume)</option>
                          <option value="s3">تخزين سحابي S3 / MinIO</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            await onSaveProvider();
                            setStorageMsg('تم حفظ مزود التخزين.');
                          } catch (err: any) {
                            setStorageMsg(err?.message || 'تعذر حفظ المزود.');
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-primary text-xs"
                      >
                        حفظ المزود
                      </button>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            const res = await onTestStorage();
                            setStorageMsg(res);
                          } catch (err: any) {
                            setStorageMsg(err?.message || 'فشل اختبار الاتصال.');
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-muted text-xs"
                      >
                        اختبار الاتصال
                      </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <b className="text-sm text-slate-900 block">إنشاء نسخة احتياطية مشفرة (ZIP)</b>
                        <span className="text-xs text-slate-500">
                          تشمل قاعدة بيانات PostgreSQL وكافة ملفات الأرشيف مشفرة بمفتاح النظام.
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            await onCreateBackup();
                            setStorageMsg('تم إنشاء وتنزيل النسخة الاحتياطية بنجاح.');
                          } catch (err: any) {
                            setStorageMsg(err?.message || 'تعذر إنشاء النسخة الاحتياطية.');
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-primary text-xs shrink-0"
                      >
                        تنزيل نسخة احتياطية الآن
                      </button>
                    </div>
                  </div>
                )}

                {storageMsg && (
                  <p className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-2.5 text-xs font-semibold text-sky-900">
                    {storageMsg}
                  </p>
                )}
              </section>
            </div>
          )}

          {/* 3. DEPARTMENTS & CATEGORIES */}
          {adminSub === 'taxonomy' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="card p-6 space-y-4">
                <h3 className="text-base font-extrabold text-slate-900">إدارة مجلدات الأرشيف</h3>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newFolderName.trim()) return;
                    setFolderBusy(true);
                    try {
                      await onCreateFolder(newFolderName.trim(), null);
                      setNewFolderName('');
                    } finally {
                      setFolderBusy(false);
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    className="field flex-1 text-sm"
                    placeholder="اسم مجلد رئيسي جديد..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={folderBusy} className="btn btn-primary text-xs">
                    {folderBusy ? '...' : 'إضافة مجلد'}
                  </button>
                </form>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {folders.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">لا توجد مجلدات بعد.</p>
                  ) : (
                    folders.map((f) => (
                      <div key={f.id} className="py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <b className="text-sm text-slate-800 block truncate">{f.name}</b>
                          <span className="text-[11px] text-slate-500">
                            {f.item_count ?? 0} ملف / صورة · آخر تعديل {formatDateArabic(f.updated_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteFolder(f.id)}
                          className="btn btn-muted py-1 px-2.5 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          حذف
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="card p-6 space-y-5">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">الأقسام النشطة</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {departments.length === 0 ? (
                      <span className="text-xs text-slate-400">لا توجد أقسام مسجلة بعد.</span>
                    ) : (
                      departments.map((d) => (
                        <span
                          key={d}
                          className="rounded-lg bg-teal-50 border border-teal-200/70 px-3 py-1.5 text-xs font-bold text-teal-900"
                        >
                          {d}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-base font-extrabold text-slate-900">التصنيفات المكتشفة</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {categories.length === 0 ? (
                      <span className="text-xs text-slate-400">لا توجد تصنيفات بعد.</span>
                    ) : (
                      categories.map((c) => (
                        <span
                          key={c}
                          className="rounded-lg bg-sky-50 border border-sky-200/70 px-3 py-1.5 text-xs font-bold text-sky-900"
                        >
                          {c}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* 4. AI RE-INDEXING */}
          {adminSub === 'reindex' && (
            <section className="card p-6 space-y-5 max-w-3xl">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    إعادة الفهرسة الذكية واستخراج النصوص (Gemini OCR)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-6">
                    يقوم النظام بتشغيل مهمة خلفية باستخدام{' '}
                    <span dir="ltr" className="font-mono font-bold text-slate-700">
                      {systemSummary?.gemini_model || 'gemini-2.5-flash'}
                    </span>{' '}
                    لاستخراج النصوص العربية والإنجليزية من الصور وملفات PDF وحفظها في قاعدة البيانات للبحث السريع.
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold shrink-0 ${
                    systemSummary?.gemini_configured
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {systemSummary?.gemini_configured ? 'مفتاح Gemini مفعّل' : 'مفتاح GEMINI_API_KEY غير مضبوط'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                  <span className="text-xs text-slate-500">إجمالي المستندات</span>
                  <b className="block text-2xl font-black text-slate-900 mt-1">
                    {systemSummary?.total_documents ?? 0}
                  </b>
                </div>
                <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-4">
                  <span className="text-xs text-emerald-800">مستندات مفهرسة</span>
                  <b className="block text-2xl font-black text-emerald-900 mt-1">
                    {systemSummary?.indexed_documents ?? 0}
                  </b>
                </div>
                <div className="rounded-2xl bg-amber-50/70 border border-amber-200/70 p-4">
                  <span className="text-xs text-amber-800">بحاجة للفهرسة</span>
                  <b className="block text-2xl font-black text-amber-900 mt-1">
                    {systemSummary?.pending_documents ?? 0}
                  </b>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={reindexBusy}
                  onClick={async () => {
                    setReindexBusy(true);
                    setReindexMsg('');
                    try {
                      const res = await onTriggerReindex(false);
                      setReindexMsg(res.message);
                    } catch (e: any) {
                      setReindexMsg(e?.message || 'تعذر بدء إعادة الفهرسة.');
                    } finally {
                      setReindexBusy(false);
                    }
                  }}
                  className="btn btn-primary text-xs inline-flex items-center gap-2"
                >
                  <AppIcon name="sparkles" size={16} />
                  <span>{reindexBusy ? 'جاري الجدولة...' : 'فهرسة المستندات غير المفهرسة'}</span>
                </button>

                <button
                  type="button"
                  disabled={reindexBusy}
                  onClick={async () => {
                    setReindexBusy(true);
                    setReindexMsg('');
                    try {
                      const res = await onTriggerReindex(true);
                      setReindexMsg(res.message);
                    } catch (e: any) {
                      setReindexMsg(e?.message || 'تعذر بدء إعادة الفهرسة الشاملة.');
                    } finally {
                      setReindexBusy(false);
                    }
                  }}
                  className="btn btn-muted text-xs"
                >
                  إعادة فهرسة جميع المستندات بالكامل
                </button>
              </div>

              {reindexMsg && (
                <p className="rounded-xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs font-semibold text-sky-900">
                  {reindexMsg}
                </p>
              )}
            </section>
          )}

          {/* 5. AUDIT LOG */}
          {adminSub === 'audit' && (
            <section className="card p-6 overflow-x-auto">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">
                سجل التدقيق الأمني ({audit.length})
              </h3>
              <table className="w-full text-xs text-right">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-100">
                    <th className="pb-2.5 font-bold">الحدث</th>
                    <th className="pb-2.5 font-bold">المورد</th>
                    <th className="pb-2.5 font-bold">التفاصيل</th>
                    <th className="pb-2.5 font-bold">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audit.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 font-bold text-slate-800" dir="ltr">
                        {a.action}
                      </td>
                      <td className="py-2.5 text-slate-600">{a.resource_type}</td>
                      <td className="py-2.5 text-slate-500 max-w-xs truncate" dir="ltr">
                        {a.detail ? JSON.stringify(a.detail) : '—'}
                      </td>
                      <td className="py-2.5 text-slate-500">{formatDateArabic(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingUser(null);
          }}
        >
          <form onSubmit={handleSaveEdit} className="card max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">
              تعديل بيانات المستخدم: {editingUser.username}
            </h3>

            <label className="block text-xs font-bold text-slate-700">
              اسم المستخدم
              <input
                className="field mt-1.5 text-sm"
                dir="ltr"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              الصلاحية
              <select
                className="field mt-1.5 text-sm"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
              >
                <option value="archiver">موظف أرشفة</option>
                <option value="viewer">عرض فقط</option>
                <option value="admin">مدير النظام</option>
              </select>
            </label>

            <label className="block text-xs font-bold text-slate-700">
              القسم
              <input
                className="field mt-1.5 text-sm"
                value={editDept}
                onChange={(e) => setEditDept(e.target.value)}
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              إعادة تعيين كلمة مرور مؤقتة (اختياري)
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={editPass}
                onChange={(e) => setEditPass(e.target.value)}
                placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                autoComplete="new-password"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="btn btn-muted text-xs"
              >
                إلغاء
              </button>
              <button type="submit" disabled={editBusy} className="btn btn-primary text-xs">
                {editBusy ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
