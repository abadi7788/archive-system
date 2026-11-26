'use client';
import RelationshipsPanel from './RelationshipsPanel';
import GeminiKeyPanel from './GeminiKeyPanel';
import AuditPanel from './AuditPanel';
import React, { FormEvent, useMemo, useState } from 'react';
import { AppIcon } from '../BrandMark';
import { LANGUAGES, roleDisplayLabel, type TranslationKeys } from '../lib/i18n';
import PasswordInput, { validateFlexiblePassword } from './PasswordInput';
import {
  FolderItem,
  LocaleCode,
  StorageMetrics,
  SystemSummary,
  TaxonomyData,
  ThemeMode,
  User,
  formatBytes,
  formatDateISO,
} from './types';

type SettingsTab = 'account' | 'admin';
type AdminSubTab = 'users' | 'linking' | 'gemini' | 'storage' | 'taxonomy' | 'reindex' | 'audit';

export default function SettingsView({
  user,
  token,
  users,
  folders,
  taxonomy,
  departments,
  categories,
  systemSummary,
  storageMetrics,
  stepUpActive,
  provider,
  locale,
  theme,
  t,
  dir,
  onUpdatePreferences,
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
  onCreateTaxonomyItem,
  onDeleteTaxonomyItem,
  onTriggerReindex,
  onRefreshAdmin,
}: {
  user: User;
  token: string;
  users: User[];
  folders: FolderItem[];
  taxonomy: TaxonomyData;
  departments: string[];
  categories: string[];
  systemSummary: SystemSummary | null;
  storageMetrics: StorageMetrics | null;
  stepUpActive: boolean;
  provider: string;
  locale: LocaleCode;
  theme: ThemeMode;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onUpdatePreferences: (prefs: { preferred_language?: LocaleCode; preferred_theme?: ThemeMode }) => Promise<void>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onCreateUser: (payload: {
    username: string;
    full_name: string;
    job_title: string;
    password: string;
    role: string;
    department: string;
    can_print: boolean;
    gemini_api_key?: string;
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    payload: {
      username?: string;
      full_name?: string | null;
      job_title?: string | null;
      role?: string;
      department?: string | null;
      is_active?: boolean;
      can_print?: boolean;
      password?: string;
      gemini_api_key?: string;
    }
  ) => Promise<void>;
  onUnlockStorage: (masterPassword: string) => Promise<void>;
  onProviderChange: (val: string) => void;
  onSaveProvider: () => Promise<void>;
  onTestStorage: () => Promise<string>;
  onCreateBackup: () => Promise<void>;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onDeleteFolder: (folder: FolderItem) => Promise<void>;
  onCreateTaxonomyItem: (kind: 'department' | 'classification', name: string) => Promise<void>;
  onDeleteTaxonomyItem: (itemId: string) => Promise<void>;
  onTriggerReindex: (force: boolean) => Promise<{ queued_count: number; message: string }>;
  onRefreshAdmin: () => Promise<void>;
}) {
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState<SettingsTab>('account');
  const [adminSub, setAdminSub] = useState<AdminSubTab>('users');

  // Preferences state
  const [prefBusy, setPrefBusy] = useState(false);

  // Account Password Form
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Admin Create User Form + Search
  const [userTableSearch, setUserTableSearch] = useState('');
  const [uName, setUName] = useState('');
  const [uFullName, setUFullName] = useState('');
  const [uJobTitle, setUJobTitle] = useState('');
  const [uPass, setUPass] = useState('');
  const [uRole, setURole] = useState('archiver');
  const [uDept, setUDept] = useState('');
  const [uCanPrint, setUCanPrint] = useState(false);
  const [uGeminiKey, setUGeminiKey] = useState('');
  const [uBusy, setUBusy] = useState(false);
  const [uNotice, setUNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editRole, setEditRole] = useState('archiver');
  const [editDept, setEditDept] = useState('');
  const [editCanPrint, setEditCanPrint] = useState(false);
  const [editPass, setEditPass] = useState('');
  const [editGeminiKey, setEditGeminiKey] = useState('');
  const [clearPersonalKey, setClearPersonalKey] = useState(false);
  const [editBusy, setEditBusy] = useState(false);

  // Storage / Taxonomy / Reindex
  const [masterPass, setMasterPass] = useState('');
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMsg, setStorageMsg] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [taxBusy, setTaxBusy] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexMsg, setReindexMsg] = useState('');

  const filteredTableUsers = useMemo(() => {
    const q = userTableSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.job_title || '').toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q)
    );
  }, [users, userTableSearch]);

  async function handleAccountPassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const err = validateFlexiblePassword(newPw, t.passwordPolicyError);
    if (err) {
      setPwMsg({ type: 'err', text: err });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'err', text: t.passwordMismatch });
      return;
    }
    setPwBusy(true);
    try {
      await onChangePassword(curPw, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      setPwMsg({ type: 'ok', text: t.savedSuccess });
    } catch (e: any) {
      setPwMsg({ type: 'err', text: e?.message || t.errorGeneric });
    } finally {
      setPwBusy(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setUNotice(null);
    const err = validateFlexiblePassword(uPass, t.passwordPolicyError);
    if (err) {
      setUNotice({ type: 'err', text: err });
      return;
    }
    setUBusy(true);
    try {
      await onCreateUser({
        username: uName.trim(),
        full_name: uFullName.trim(),
        job_title: uJobTitle.trim(),
        password: uPass,
        role: uRole,
        department: uDept.trim(),
        can_print: uRole === 'admin' ? true : uCanPrint,
        ...(uGeminiKey.trim() ? { gemini_api_key: uGeminiKey.trim() } : {}),
      });
      setUName('');
      setUFullName('');
      setUJobTitle('');
      setUPass('');
      setUDept('');
      setURole('archiver');
      setUCanPrint(false);
      setUGeminiKey('');
      setUNotice({ type: 'ok', text: t.savedSuccess });
    } catch (e: any) {
      setUNotice({ type: 'err', text: e?.message || t.errorGeneric });
    } finally {
      setUBusy(false);
    }
  }

  function openEditUser(target: User) {
    setEditingUser(target);
    setEditName(target.username);
    setEditFullName(target.full_name || '');
    setEditJobTitle(target.job_title || '');
    setEditRole(target.role);
    setEditDept(target.department || '');
    setEditCanPrint(Boolean(target.role === 'admin' || target.can_print));
    setEditPass('');
    setEditGeminiKey('');
    setClearPersonalKey(false);
  }

  async function handleSaveEditUser(e: FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    if (editPass.trim()) {
      const err = validateFlexiblePassword(editPass, t.passwordPolicyError);
      if (err) {
        setUNotice({ type: 'err', text: err });
        return;
      }
    }
    setEditBusy(true);
    try {
      await onUpdateUser(editingUser.id, {
        username: editName.trim(),
        full_name: editFullName.trim() || null,
        job_title: editJobTitle.trim() || null,
        role: editRole,
        department: editDept.trim() || null,
        can_print: editRole === 'admin' ? true : editCanPrint,
        ...(editPass.trim() ? { password: editPass } : {}),
        ...(clearPersonalKey ? { gemini_api_key: '' } : editGeminiKey.trim() ? { gemini_api_key: editGeminiKey.trim() } : {}),
      });
      setEditingUser(null);
      setUNotice({ type: 'ok', text: t.savedSuccess });
    } catch (e: any) {
      setUNotice({ type: 'err', text: e?.message || t.errorGeneric });
    } finally {
      setEditBusy(false);
    }
  }

  const diskTotal = storageMetrics?.disk_capacity_bytes ?? systemSummary?.disk_capacity_bytes ?? 0;
  const diskFree = storageMetrics?.disk_free_bytes ?? systemSummary?.disk_free_bytes ?? 0;
  const diskUsed = diskTotal > 0 ? Math.max(0, diskTotal - diskFree) : 0;
  const diskPct = diskTotal > 0 ? Math.min(100, Math.round((diskUsed / diskTotal) * 100)) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Main Settings Segmented Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#0F2137] border border-slate-200/85 dark:border-slate-800 shadow-sm">
          <button
            type="button"
            onClick={() => setTab('account')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === 'account'
                ? 'bg-[#0E7490] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#0F2137] dark:hover:text-white'
            }`}
          >
            <AppIcon name="user" size={14} />
            <span>{t.tabAccount}</span>
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                onRefreshAdmin();
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                tab === 'admin'
                  ? 'bg-[#0E7490] text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#0F2137] dark:hover:text-white'
              }`}
            >
              <AppIcon name="shield" size={14} />
              <span>{t.tabAdmin}</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= ACCOUNT & PREFERENCES TAB (ALL USERS) ================= */}
      {tab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Profile + Language & Theme Card */}
          <div className="lg:col-span-5 space-y-5">
            {/* Profile Details */}
            <section className="card overflow-hidden">
              <div className="vault-showcase p-5 flex items-center gap-3.5 text-white border-b border-white/10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0891B2] to-[#0E7490] border border-white/25 text-white font-bold text-lg grid place-items-center shrink-0 shadow-md">
                  {(user.full_name || user.username).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {user.full_name || user.username}
                  </h3>
                  <p className="text-xs text-cyan-200/90 truncate mt-0.5">
                    {user.job_title || roleDisplayLabel(user.role, t)}
                  </p>
                </div>
              </div>

              <dl className="p-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <dt className="text-slate-600 dark:text-slate-300">{t.usernameLabel}</dt>
                  <dd className="font-semibold text-[#0F2137] dark:text-white" dir="ltr">
                    @{user.username}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <dt className="text-slate-600 dark:text-slate-300">{t.jobTitleLabel}</dt>
                  <dd className="font-semibold text-[#0F2137] dark:text-white">
                    {user.job_title || roleDisplayLabel(user.role, t)}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                  <dt className="text-slate-600 dark:text-slate-300">{t.departmentLabel}</dt>
                  <dd className="font-semibold text-[#0F2137] dark:text-white">
                    {user.department || '—'}
                  </dd>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <dt className="text-slate-600 dark:text-slate-300">{t.accountStatusLabel}</dt>
                  <dd className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{t.statusActive}</span>
                  </dd>
                </div>
              </dl>
            </section>

            {/* Language & Light/Dark Mode Preferences */}
            <section className="card p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] grid place-items-center shrink-0">
                  <AppIcon name="globe" size={16} />
                </span>
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                  {t.preferencesTitle}
                </h3>
              </div>

              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.languageLabel}
                <select
                  disabled={prefBusy}
                  value={locale}
                  onChange={async (e) => {
                    const nextLang = e.target.value as LocaleCode;
                    setPrefBusy(true);
                    try {
                      await onUpdatePreferences({ preferred_language: nextLang });
                    } finally {
                      setPrefBusy(false);
                    }
                  }}
                  className="field mt-1.5"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} — {l.englishName}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300 mb-2">
                  {t.appearanceLabel}
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={prefBusy}
                    onClick={async () => {
                      if (theme === 'light') return;
                      setPrefBusy(true);
                      try {
                        await onUpdatePreferences({ preferred_theme: 'light' });
                      } finally {
                        setPrefBusy(false);
                      }
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      theme === 'light'
                        ? 'border-[#0E7490] bg-brand-50 text-[#0E7490] ring-1 ring-[#0E7490]/20 dark:bg-[#132942] dark:text-[#22D3EE]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#132942]'
                    }`}
                  >
                    <AppIcon name="sun" size={15} />
                    <span>{t.themeLight}</span>
                  </button>
                  <button
                    type="button"
                    disabled={prefBusy}
                    onClick={async () => {
                      if (theme === 'dark') return;
                      setPrefBusy(true);
                      try {
                        await onUpdatePreferences({ preferred_theme: 'dark' });
                      } finally {
                        setPrefBusy(false);
                      }
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                      theme === 'dark'
                        ? 'border-[#0891B2] bg-[#132942] text-cyan-100 ring-1 ring-[#0891B2]/35'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#132942]'
                    }`}
                  >
                    <AppIcon name="moon" size={15} />
                    <span>{t.themeDark}</span>
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* Change Password Form */}
          <form onSubmit={handleAccountPassword} className="card p-5 sm:p-6 lg:col-span-7 space-y-4 h-fit">
            <div className="flex items-start gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <span className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] ring-1 ring-[#0891B2]/20 grid place-items-center shrink-0">
                <AppIcon name="lock" size={17} />
              </span>
              <div>
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.changePasswordTitle}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.passwordPolicyHint}</p>
              </div>
            </div>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.currentPasswordLabel}
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                autoComplete="current-password"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                required
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.newPasswordLabel}
                <PasswordInput
                  wrapperClassName="mt-1.5"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  showLabel={t.showPassword}
                  hideLabel={t.hidePassword}
                  minLength={6}
                  required
                />
              </label>

              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.confirmPasswordLabel}
                <PasswordInput
                  wrapperClassName="mt-1.5"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  showLabel={t.showPassword}
                  hideLabel={t.hidePassword}
                  minLength={6}
                  required
                />
              </label>
            </div>

            {pwMsg && (
              <p
                role="alert"
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  pwMsg.type === 'ok'
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                {pwMsg.text}
              </p>
            )}

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={pwBusy} className="btn btn-primary text-xs px-6">
                {pwBusy ? t.saving : t.updatePasswordButton}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= SYSTEM ADMIN TAB (ADMIN ONLY) ================= */}
      {tab === 'admin' && isAdmin && (
        <div className="space-y-5">
          {/* Admin Sub-tabs */}
          <div className="card p-2 flex flex-wrap gap-1.5">
            {(
              [
                ['users', 'users', t.adminUsers],
                ['linking', 'link', t.adminLinking],
                ['gemini', 'key', t.adminGemini],
                ['storage', 'storage', t.adminStorage],
                ['taxonomy', 'folder', t.adminTaxonomy],
                ['reindex', 'refresh', t.adminReindex],
                ['audit', 'audit', t.adminAudit],
              ] as [AdminSubTab, string, string][]
            ).map(([key, icon, label]) => {
              const active = adminSub === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAdminSub(key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#0E7490] text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#132942] hover:text-[#0F2137] dark:hover:text-white'
                  }`}
                >
                  <AppIcon name={icon} size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* 1. EMPLOYEES MANAGEMENT */}
          {adminSub === 'users' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <form onSubmit={handleCreateUser} className="card p-5 xl:col-span-5 space-y-3.5 h-fit">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.createUserTitle}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.tempPasswordHint}</p>
                </div>

                <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                  {t.fullNameLabel}
                  <input
                    className="field mt-1"
                    placeholder={t.fullNamePlaceholder}
                    value={uFullName}
                    onChange={(e) => setUFullName(e.target.value)}
                    maxLength={160}
                  />
                </label>

                <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                  {t.jobTitleLabel}
                  <input
                    className="field mt-1"
                    placeholder={t.jobTitlePlaceholder}
                    value={uJobTitle}
                    onChange={(e) => setUJobTitle(e.target.value)}
                    maxLength={160}
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                    {t.usernameLabel}
                    <input
                      className="field mt-1"
                      dir="ltr"
                      placeholder="ahmed.ali"
                      pattern="[A-Za-z0-9_.-]+"
                      minLength={3}
                      value={uName}
                      onChange={(e) => setUName(e.target.value)}
                      required
                    />
                  </label>

                  <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                    {t.departmentLabel}
                    <input
                      className="field mt-1"
                      placeholder={t.departmentPlaceholder}
                      value={uDept}
                      onChange={(e) => setUDept(e.target.value)}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                    {t.tempPasswordLabel}
                    <PasswordInput
                      wrapperClassName="mt-1"
                      placeholder="ab1234"
                      minLength={6}
                      value={uPass}
                      onChange={(e) => setUPass(e.target.value)}
                      autoComplete="new-password"
                      showLabel={t.showPassword}
                      hideLabel={t.hidePassword}
                      required
                    />
                  </label>

                  <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                    {t.roleLabel}
                    <select
                      className="field mt-1"
                      value={uRole}
                      onChange={(e) => {
                        const nextRole = e.target.value;
                        setURole(nextRole);
                        if (nextRole === 'admin') setUCanPrint(true);
                      }}
                    >
                      <option value="archiver">{t.roleArchiver}</option>
                      <option value="viewer">{t.roleViewer}</option>
                      <option value="admin">{t.roleAdmin}</option>
                    </select>
                  </label>
                </div>

                <label className="block text-xs font-semibold">{locale === 'ar' ? 'مفتاح Gemini خاص بالموظف (اختياري)' : 'Personal Gemini key (optional)'}
                  <PasswordInput wrapperClassName="mt-1" value={uGeminiKey} onChange={(e) => setUGeminiKey(e.target.value)} autoComplete="off" dir="ltr" showLabel={t.showPassword} hideLabel={t.hidePassword} />
                </label>
                {/* Admin-controlled Print Permission Toggle */}
                <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-[#132942]/50 px-3.5 py-2.5 cursor-pointer">
                  <div className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F2137] dark:text-slate-100">
                      <AppIcon name="printer" size={14} className="text-[#0E7490] dark:text-[#22D3EE] shrink-0" />
                      <span>{t.printPermissionLabel}</span>
                    </span>
                    <span className="block text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                      {uRole === 'admin'
                        ? t.printAdminAlways
                        : uCanPrint
                        ? t.printAllowed
                        : t.printRestricted}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={uRole === 'admin' ? true : uCanPrint}
                    disabled={uRole === 'admin'}
                    onChange={(e) => setUCanPrint(e.target.checked)}
                    className="w-4 h-4 accent-[#0E7490] cursor-pointer shrink-0"
                  />
                </label>

                {uNotice && (
                  <p
                    role="alert"
                    className={`rounded-xl border px-3 py-2 text-xs font-medium ${
                      uNotice.type === 'ok'
                        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                        : 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {uNotice.text}
                  </p>
                )}

                <button type="submit" disabled={uBusy} className="btn btn-primary w-full text-xs">
                  {uBusy ? t.creating : t.createUserButton}
                </button>
              </form>

              <section className="card p-5 xl:col-span-7 overflow-x-auto">
                <div className="pb-3.5 mb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                    {t.usersListTitle} · <span dir="ltr" className="tabular-nums">{filteredTableUsers.length}</span>
                  </h3>
                  <div className="relative w-full sm:w-56">
                    <span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <AppIcon name="search" size={14} />
                    </span>
                    <input
                      type="search"
                      value={userTableSearch}
                      onChange={(e) => setUserTableSearch(e.target.value)}
                      placeholder={t.searchEmployeesPlaceholder}
                      className="field field-icon-start py-1.5 min-h-[34px] text-xs"
                    />
                  </div>
                </div>
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                      <th className="pb-2.5 font-semibold text-start">{t.fullNameLabel}</th>
                      <th className="pb-2.5 font-semibold text-start">{t.jobTitleLabel}</th>
                      <th className="pb-2.5 font-semibold text-start">{t.printPermissionLabel}</th>
                      <th className="pb-2.5 font-semibold text-start">{t.accountStatusLabel}</th>
                      <th className="pb-2.5 font-semibold text-end" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredTableUsers.map((u) => {
                      const isRowAdmin = u.role === 'admin';
                      const rowCanPrint = Boolean(isRowAdmin || u.can_print);
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/75 dark:hover:bg-[#132942]/40 transition-colors">
                          <td className="py-3 pe-2">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-[#132942] text-[#0E7490] dark:text-[#22D3EE] font-bold text-[11px] grid place-items-center shrink-0">
                                {(u.full_name || u.username).slice(0, 1).toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-[#0F2137] dark:text-white truncate">
                                  {u.full_name || u.username}
                                </div>
                                <div className="text-[11px] text-slate-600 dark:text-slate-300" dir="ltr">
                                  @{u.username}
                                </div>
                              </div>
                            </div>
                            {u.must_change_password && (
                              <span className="block mt-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {t.pendingPwChange}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pe-2 text-slate-700 dark:text-slate-300">
                            <div>{u.job_title || roleDisplayLabel(u.role, t)}</div>
                            <div className="text-[11px] text-slate-400">
                              {[roleDisplayLabel(u.role, t), u.department].filter(Boolean).join(' · ')}
                            </div>
                          </td>
                          <td className="py-3 pe-2">
                            {isRowAdmin ? (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <AppIcon name="printer" size={13} />
                                <span>{t.printAllowed}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUpdateUser(u.id, { can_print: !rowCanPrint })}
                                className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                  rowCanPrint
                                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#132942]/60 text-slate-600 dark:text-slate-300 hover:border-[#0891B2]'
                                }`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    rowCanPrint ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                <span>{rowCanPrint ? t.printAllowed : t.printRestricted}</span>
                              </button>
                            )}
                          </td>
                          <td className="py-3 pe-2">
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold ${
                                u.is_active !== false
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.is_active !== false ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>{u.is_active !== false ? t.statusActive : t.statusInactive}</span>
                            </span>
                          </td>
                          <td className="py-3 text-end">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditUser(u)}
                                className="btn btn-muted py-1 px-2.5 text-xs"
                              >
                                {t.edit}
                              </button>
                              {u.id !== user.id && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateUser(u.id, { is_active: u.is_active === false })}
                                  className="btn btn-muted py-1 px-2.5 text-xs"
                                >
                                  {u.is_active !== false ? t.deactivate : t.activate}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            </div>
          )}

          {/* 2. EMPLOYEE DATA LINKING */}
          {adminSub === 'linking' && <RelationshipsPanel token={token} users={users} locale={locale} />}

          {/* 3. ADMIN-ONLY GEMINI API KEY MANAGEMENT */}
          {adminSub === 'gemini' && <GeminiKeyPanel token={token} locale={locale} />}

          {/* 4. STORAGE & BACKUP */}
          {adminSub === 'storage' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4 border-s-[3px] border-s-[#0E7490]">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.storedDocs}</span>
                  <b className="block mt-1.5 text-2xl font-bold text-[#0F2137] dark:text-white tabular-nums" dir="ltr">
                    {storageMetrics?.saved_files ?? systemSummary?.total_documents ?? 0}
                  </b>
                </div>
                <div className="card p-4 border-s-[3px] border-s-[#0891B2]">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.storedSize}</span>
                  <b className="block mt-1.5 text-2xl font-bold text-[#0F2137] dark:text-white tabular-nums" dir="ltr">
                    {formatBytes(storageMetrics?.stored_file_bytes ?? systemSummary?.stored_file_bytes)}
                  </b>
                </div>
                <div className="card p-4 border-s-[3px] border-s-emerald-500">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.freeSpace}</span>
                  <b className="block mt-1.5 text-2xl font-bold text-[#0F2137] dark:text-white tabular-nums" dir="ltr">
                    {diskFree ? formatBytes(diskFree) : '—'}
                  </b>
                </div>
                <div className="card p-4 border-s-[3px] border-s-amber-500">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.storageType}</span>
                  <b className="block mt-1.5 text-2xl font-bold text-[#0F2137] dark:text-white">
                    {(storageMetrics?.provider || systemSummary?.provider || provider) === 's3'
                      ? t.storageCloud
                      : t.storageLocal}
                  </b>
                </div>
              </div>

              {diskTotal > 0 && (
                <section className="card p-5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#0F2137] dark:text-slate-300 mb-2">
                    <span>{t.diskUsage}</span>
                    <span dir="ltr" className="tabular-nums text-[#0E7490] dark:text-[#22D3EE]">{diskPct}%</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-[#132942] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0E7490] to-[#0891B2] transition-all"
                      style={{ width: `${diskPct}%` }}
                    />
                  </div>
                </section>
              )}

              <section className="card p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.advancedStorageTitle}</h3>
                {!stepUpActive ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setStorageBusy(true);
                      setStorageMsg('');
                      try {
                        await onUnlockStorage(masterPass);
                        setMasterPass('');
                        setStorageMsg(t.savedSuccess);
                      } catch (err: any) {
                        setStorageMsg(err?.message || t.errorGeneric);
                      } finally {
                        setStorageBusy(false);
                      }
                    }}
                    className="max-w-md space-y-3"
                  >
                    <PasswordInput
                      value={masterPass}
                      onChange={(e) => setMasterPass(e.target.value)}
                      placeholder={t.masterPasswordLabel}
                      showLabel={t.showPassword}
                      hideLabel={t.hidePassword}
                      startIcon={<AppIcon name="lock" size={16} />}
                      required
                    />
                    <button type="submit" disabled={storageBusy} className="btn btn-primary text-xs">
                      {storageBusy ? '...' : t.unlockAdvanced}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 max-w-lg">
                      <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300 flex-1">
                        {t.storageType}
                        <select
                          className="field mt-1"
                          value={provider}
                          onChange={(e) => onProviderChange(e.target.value)}
                        >
                          <option value="local">{t.storageLocal}</option>
                          <option value="s3">{t.storageCloud}</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            await onSaveProvider();
                            setStorageMsg(t.savedSuccess);
                          } catch (err: any) {
                            setStorageMsg(err?.message || t.errorGeneric);
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-primary text-xs"
                      >
                        {t.saveSettings}
                      </button>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            setStorageMsg(await onTestStorage());
                          } catch (err: any) {
                            setStorageMsg(err?.message || t.errorGeneric);
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-muted text-xs"
                      >
                        {t.testConnection}
                      </button>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <b className="text-sm text-[#0F2137] dark:text-white block">{t.backupTitle}</b>
                        <span className="text-xs text-slate-600 dark:text-slate-300">{t.backupDesc}</span>
                      </div>
                      <button
                        type="button"
                        disabled={storageBusy}
                        onClick={async () => {
                          setStorageBusy(true);
                          try {
                            await onCreateBackup();
                            setStorageMsg(t.savedSuccess);
                          } catch (err: any) {
                            setStorageMsg(err?.message || t.errorGeneric);
                          } finally {
                            setStorageBusy(false);
                          }
                        }}
                        className="btn btn-primary text-xs shrink-0"
                      >
                        <AppIcon name="download" size={14} />
                        <span>{t.downloadBackup}</span>
                      </button>
                    </div>
                  </div>
                )}

                {storageMsg && (
                  <p className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">{storageMsg}</p>
                )}
              </section>
            </div>
          )}

          {/* 5. FOLDERS & CATEGORIES */}
          {adminSub === 'taxonomy' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <section className="card p-5 space-y-4">
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.manageFoldersTitle}</h3>
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
                    className="field flex-1"
                    placeholder={t.folderNamePlaceholder}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    required
                  />
                  <button type="submit" disabled={folderBusy} className="btn btn-primary text-xs">
                    {t.addFolder}
                  </button>
                </form>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
                  {folders.map((f) => (
                    <div key={f.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <b className="text-xs font-semibold text-[#0F2137] dark:text-white block truncate">
                          {f.name}
                        </b>
                        <span className="text-[11px] text-slate-600 dark:text-slate-300">
                          {f.owner_name ? `${f.owner_name} · ` : ''}
                          <span dir="ltr" className="tabular-nums">{f.item_count ?? 0}</span> {t.itemsCount} ·{' '}
                          <span dir="ltr" className="tabular-nums">{formatDateISO(f.updated_at)}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteFolder(f)}
                        className="btn btn-muted py-1 px-2.5 text-xs text-rose-600 dark:text-rose-400"
                      >
                        {t.moveToTrash}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="card p-5 space-y-5">
                {/* Standardized Departments Management */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                    {t.manageDepartmentsTitle}
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newDeptName.trim()) return;
                      setTaxBusy(true);
                      try {
                        await onCreateTaxonomyItem('department', newDeptName.trim());
                        setNewDeptName('');
                      } finally {
                        setTaxBusy(false);
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      className="field flex-1 text-xs"
                      placeholder={t.addDepartmentPlaceholder}
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      maxLength={160}
                      required
                    />
                    <button type="submit" disabled={taxBusy} className="btn btn-primary text-xs px-4">
                      {t.addItemButton}
                    </button>
                  </form>
                  {taxonomy.departments.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t.noTaxonomyItems}
                      {departments.length > 0 ? ` (${departments.join(' · ')})` : ''}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 px-3">
                      {taxonomy.departments.map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-[#0F2137] dark:text-slate-200 truncate">
                            {item.name}
                          </span>
                          <button
                            type="button"
                            disabled={taxBusy}
                            onClick={async () => {
                              setTaxBusy(true);
                              try {
                                await onDeleteTaxonomyItem(item.id);
                              } finally {
                                setTaxBusy(false);
                              }
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            aria-label={t.deleteAction}
                          >
                            <AppIcon name="trash" size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Standardized Classifications Management */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">
                    {t.manageClassificationsTitle}
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newClassName.trim()) return;
                      setTaxBusy(true);
                      try {
                        await onCreateTaxonomyItem('classification', newClassName.trim());
                        setNewClassName('');
                      } finally {
                        setTaxBusy(false);
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      className="field flex-1 text-xs"
                      placeholder={t.addClassificationPlaceholder}
                      value={newClassName}
                      onChange={(e) => setNewClassName(e.target.value)}
                      maxLength={160}
                      required
                    />
                    <button type="submit" disabled={taxBusy} className="btn btn-primary text-xs px-4">
                      {t.addItemButton}
                    </button>
                  </form>
                  {taxonomy.classifications.length === 0 ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {t.noTaxonomyItems}
                      {categories.length > 0 ? ` (${categories.join(' · ')})` : ''}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto rounded-xl border border-slate-200/80 dark:border-slate-800 px-3">
                      {taxonomy.classifications.map((item) => (
                        <div key={item.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                          <span className="font-medium text-[#0F2137] dark:text-slate-200 truncate">
                            {item.name}
                          </span>
                          <button
                            type="button"
                            disabled={taxBusy}
                            onClick={async () => {
                              setTaxBusy(true);
                              try {
                                await onDeleteTaxonomyItem(item.id);
                              } finally {
                                setTaxBusy(false);
                              }
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            aria-label={t.deleteAction}
                          >
                            <AppIcon name="trash" size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* 6. RE-INDEXING */}
          {adminSub === 'reindex' && (
            <section className="card p-5 max-w-2xl space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.reindexTitle}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{t.reindexDesc}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-50/70 dark:bg-[#132942] border border-brand-200/70 dark:border-[#0891B2]/25 p-3.5">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.indexedDocsLabel}</span>
                  <b className="block mt-1 text-xl font-bold text-[#0E7490] dark:text-[#22D3EE] tabular-nums" dir="ltr">
                    {systemSummary?.indexed_documents ?? 0}
                  </b>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-[#132942]/60 border border-slate-200/80 dark:border-slate-700 p-3.5">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{t.pendingDocsLabel}</span>
                  <b className="block mt-1 text-xl font-bold text-[#0F2137] dark:text-white tabular-nums" dir="ltr">
                    {systemSummary?.pending_documents ?? 0}
                  </b>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={reindexBusy}
                  onClick={async () => {
                    setReindexBusy(true);
                    try {
                      const res = await onTriggerReindex(false);
                      setReindexMsg(res.message);
                    } catch (err: any) {
                      setReindexMsg(err?.message || t.errorGeneric);
                    } finally {
                      setReindexBusy(false);
                    }
                  }}
                  className="btn btn-primary text-xs"
                >
                  <AppIcon name="refresh" size={14} />
                  <span>{t.reindexPending}</span>
                </button>
                <button
                  type="button"
                  disabled={reindexBusy}
                  onClick={async () => {
                    setReindexBusy(true);
                    try {
                      const res = await onTriggerReindex(true);
                      setReindexMsg(res.message);
                    } catch (err: any) {
                      setReindexMsg(err?.message || t.errorGeneric);
                    } finally {
                      setReindexBusy(false);
                    }
                  }}
                  className="btn btn-muted text-xs"
                >
                  {t.reindexAll}
                </button>
              </div>
              {reindexMsg && (
                <p className="text-xs font-semibold text-[#0E7490] dark:text-[#22D3EE]">{reindexMsg}</p>
              )}
            </section>
          )}

          {/* 7. AUDIT LOG */}
          {adminSub === 'audit' && <AuditPanel token={token} locale={locale} />}
        </div>
      )}

      {/* Edit Employee Modal */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          dir={dir}
          className="fixed inset-0 z-[85] bg-[#091524]/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !editBusy) setEditingUser(null);
          }}
        >
          <form onSubmit={handleSaveEditUser} className="card-elevated max-w-md w-full p-6 space-y-3.5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-[#0F2137] dark:text-white">{t.editUserTitle}</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 text-slate-400 hover:text-[#0F2137] dark:hover:text-slate-200"
              >
                <AppIcon name="x" size={16} />
              </button>
            </div>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.fullNameLabel}
              <input
                className="field mt-1"
                placeholder={t.fullNamePlaceholder}
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                maxLength={160}
              />
            </label>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.jobTitleLabel}
              <input
                className="field mt-1"
                placeholder={t.jobTitlePlaceholder}
                value={editJobTitle}
                onChange={(e) => setEditJobTitle(e.target.value)}
                maxLength={160}
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.usernameLabel}
                <input
                  className="field mt-1"
                  dir="ltr"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </label>

              <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
                {t.departmentLabel}
                <input
                  className="field mt-1"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.roleLabel}
              <select
                className="field mt-1"
                value={editRole}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setEditRole(nextRole);
                  if (nextRole === 'admin') setEditCanPrint(true);
                }}
              >
                <option value="archiver">{t.roleArchiver}</option>
                <option value="viewer">{t.roleViewer}</option>
                <option value="admin">{t.roleAdmin}</option>
              </select>
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 cursor-pointer">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0F2137] dark:text-slate-100">
                  <AppIcon name="printer" size={14} className="text-[#0E7490] dark:text-[#22D3EE] shrink-0" />
                  <span>{t.printPermissionLabel}</span>
                </span>
                <span className="block text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  {editRole === 'admin'
                    ? t.printAdminAlways
                    : editCanPrint
                    ? t.printAllowed
                    : t.printRestricted}
                </span>
              </div>
              <input
                type="checkbox"
                checked={editRole === 'admin' ? true : editCanPrint}
                disabled={editRole === 'admin'}
                onChange={(e) => setEditCanPrint(e.target.checked)}
                className="w-4 h-4 accent-[#0E7490] cursor-pointer shrink-0"
              />
            </label>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.resetPasswordOptional}
              <PasswordInput
                wrapperClassName="mt-1"
                value={editPass}
                onChange={(e) => setEditPass(e.target.value)}
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                autoComplete="new-password"
              />
            </label>

            <label className="block text-xs font-semibold">{locale === 'ar' ? 'استبدال مفتاح Gemini الخاص (اتركه فارغاً للإبقاء عليه)' : 'Replace personal Gemini key (leave blank to keep)'}
              <PasswordInput wrapperClassName="mt-1" value={editGeminiKey} disabled={clearPersonalKey} onChange={(e) => setEditGeminiKey(e.target.value)} autoComplete="off" dir="ltr" showLabel={t.showPassword} hideLabel={t.hidePassword} />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={clearPersonalKey} onChange={(e) => setClearPersonalKey(e.target.checked)} />{locale === 'ar' ? 'حذف المفتاح الخاص والاعتماد على مفاتيح النظام' : 'Remove personal key and use system keys'}</label>
            <div className="pt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingUser(null)} className="btn btn-muted text-xs">
                {t.cancel}
              </button>
              <button type="submit" disabled={editBusy} className="btn btn-primary text-xs px-5">
                {editBusy ? t.saving : t.saveChanges}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
