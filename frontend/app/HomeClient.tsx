'use client';
import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import BrandMark, { AppIcon } from './BrandMark';
import DocumentModal from './DocumentModal';
import LanguageSelect from './LanguageSelect';
import ArchiveView from './components/ArchiveView';
import FirstLoginPasswordModal from './components/FirstLoginPasswordModal';
import PasswordInput from './components/PasswordInput';
import PWAInstallButton from './components/PWAInstallButton';
import SettingsView from './components/SettingsView';
import {
  SystemStatusOverlay,
  SystemStatusPill,
  useSystemHealth,
} from './components/SystemStatus';
import {
  ArchiveFilters,
  AuditItem,
  DocItem,
  FolderItem,
  StorageMetrics,
  SystemSummary,
  User,
  roleLabel,
} from './components/types';
import UploadView from './components/UploadView';

const API = '/api/v1';
const AUTH_STORAGE_KEY = 'archive-system-session';

type NavView = 'archive' | 'upload' | 'settings';

const NAV_ITEMS: { key: NavView; icon: string; label: string }[] = [
  { key: 'archive', icon: 'archive', label: 'الأرشيف' },
  { key: 'upload', icon: 'upload', label: 'رفع مستند' },
  { key: 'settings', icon: 'settings', label: 'الإعدادات' },
];

const EMPTY_FILTERS: ArchiveFilters = {
  department: '',
  mime_type: '',
  classification: '',
  keyword: '',
  from_date: '',
  to_date: '',
};

export default function HomeClient() {
  const health = useSystemHealth();

  // Auth & Session
  const [token, setToken] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  // Navigation & Global UI
  const [view, setView] = useState<NavView>('archive');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Archive State
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ArchiveFilters>(EMPTY_FILTERS);
  const [searchBusy, setSearchBusy] = useState(false);
  const [activeDoc, setActiveDoc] = useState<any>(null);

  // Admin & Settings State
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [systemSummary, setSystemSummary] = useState<SystemSummary | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [stepUpToken, setStepUpToken] = useState('');
  const [provider, setProvider] = useState('local');

  const clearSession = useCallback(() => {
    setToken('');
    setUser(null);
    setStepUpToken('');
    setProfileMenuOpen(false);
    setActiveDoc(null);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistSession = useCallback((nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    } catch {
      // ignore storage errors
    }
  }, []);

  const request = useCallback(
    async (path: string, init: RequestInit = {}, authToken?: string) => {
      const effectiveToken = authToken ?? token;
      const mergedHeaders: Record<string, string> = {
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
        ...((init.headers as Record<string, string>) || {}),
      };

      let response: Response;
      try {
        response = await fetch(`${API}${path}`, {
          ...init,
          headers: mergedHeaders,
          cache: 'no-store',
        });
      } catch {
        health.reportConnectionFailure();
        throw new Error('تعذر الاتصال بسيرفر الأرشفة. يرجى التحقق من الشبكة والمحاولة مجدداً.');
      }

      if (response.status === 502 || response.status === 503 || response.status === 504) {
        health.reportConnectionFailure();
      }

      if (response.status === 401 && effectiveToken && !mergedHeaders['X-Admin-Step-Up']) {
        clearSession();
        throw new Error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
      }

      if (response.status === 204) {
        return null;
      }

      const raw = await response.text();
      let data: any;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        if (!response.ok) {
          throw new Error('الخدمة غير متاحة مؤقتاً. يرجى المحاولة لاحقاً.');
        }
        return raw;
      }

      if (!response.ok) {
        const detail =
          typeof data?.detail === 'string'
            ? data.detail
            : Array.isArray(data?.detail)
            ? data.detail.map((item: any) => item?.msg || '').filter(Boolean).join(' · ')
            : 'تعذر إتمام الطلب.';
        throw new Error(detail || 'تعذر إتمام الطلب.');
      }
      return data;
    },
    [token, clearSession, health]
  );

  // Restore saved session on mount
  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    try {
      const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.token && saved?.user) {
        setToken(saved.token);
        setUser(saved.user);
      }
    } catch {
      // ignore corrupted session storage
    }
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Revoke preview blob URL on close/unmount
  useEffect(() => {
    return () => {
      if (activeDoc?.objectUrl) {
        URL.revokeObjectURL(activeDoc.objectUrl);
      }
    };
  }, [activeDoc]);

  const buildFilterParams = useCallback(
    (qStr: string, folderId: string, flt: ArchiveFilters) => {
      const params = new URLSearchParams();
      if (qStr.trim()) params.set('q', qStr.trim());
      if (folderId) params.set('folder_id', folderId);
      if (flt.department.trim()) params.set('department', flt.department.trim());
      if (flt.mime_type) params.set('mime_type', flt.mime_type);
      if (flt.classification) params.set('classification', flt.classification);
      if (flt.keyword.trim()) params.set('keyword', flt.keyword.trim());
      if (flt.from_date) params.set('from_date', flt.from_date);
      if (flt.to_date) params.set('to_date', flt.to_date);
      return params;
    },
    []
  );

  const loadDocuments = useCallback(
    async (
      overrideFolderId?: string,
      overrideQuery?: string,
      overrideFilters?: ArchiveFilters,
      authToken?: string
    ) => {
      const fid = overrideFolderId !== undefined ? overrideFolderId : selectedFolder;
      const qStr = overrideQuery !== undefined ? overrideQuery : query;
      const flt = overrideFilters !== undefined ? overrideFilters : filters;
      setSearchBusy(true);
      try {
        const params = buildFilterParams(qStr, fid, flt);
        const hasSearch = Boolean(qStr.trim());
        const endpoint = hasSearch
          ? `/search?${params.toString()}`
          : `/documents${params.toString() ? `?${params.toString()}` : ''}`;
        const list = await request(endpoint, {}, authToken);
        setDocs(Array.isArray(list) ? list : []);
      } catch (e: any) {
        setNotice({ type: 'err', text: e?.message || 'تعذر تحميل المستندات.' });
      } finally {
        setSearchBusy(false);
      }
    },
    [selectedFolder, query, filters, buildFilterParams, request]
  );

  const loadArchiveMetadata = useCallback(
    async (authToken?: string) => {
      try {
        const [flds, cats, depts] = await Promise.all([
          request('/folders', {}, authToken),
          request('/folders/classifications', {}, authToken),
          request('/folders/departments', {}, authToken).catch(() => []),
        ]);
        setFolders(Array.isArray(flds) ? flds : []);
        setCategories(Array.isArray(cats) ? cats : []);
        setDepartments(Array.isArray(depts) ? depts : []);
      } catch {
        // non-blocking
      }
    },
    [request]
  );

  const loadAdminData = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    try {
      const [uList, aList, summary] = await Promise.all([
        request('/users'),
        request('/audit?limit=100').catch(() => []),
        request('/admin/system-summary').catch(() => null),
      ]);
      setUsers(Array.isArray(uList) ? uList : []);
      setAudit(Array.isArray(aList) ? aList : []);
      if (summary) {
        setSystemSummary(summary);
        if (summary.provider) setProvider(summary.provider);
      }
    } catch {
      // handled per action
    }
  }, [token, user, request]);

  // Initial data load whenever authenticated & password change not blocking
  useEffect(() => {
    if (!token || !user || user.must_change_password) return;
    loadArchiveMetadata();
    loadDocuments('', '', EMPTY_FILTERS);
    if (user.role === 'admin') {
      loadAdminData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.id, user?.must_change_password]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const body = new URLSearchParams({ username: username.trim(), password });
      const data = await request(
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        },
        ''
      );
      persistSession(data.access_token, data.user);
      setPassword('');
      setView('archive');
      setSelectedFolder('');
      setQuery('');
      setFilters(EMPTY_FILTERS);
      setNotice(null);
    } catch (err: any) {
      setAuthError(err?.message || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasswordChange(currentPassword: string, newPassword: string) {
    const res = await request('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (res?.user) {
      persistSession(token, res.user);
    } else if (user) {
      persistSession(token, { ...user, must_change_password: false });
    }
  }

  async function handleSelectFolder(folderId: string) {
    setSelectedFolder(folderId);
    await loadDocuments(folderId, query, filters);
  }

  async function handleResetSearch() {
    setQuery('');
    setFilters(EMPTY_FILTERS);
    await loadDocuments(selectedFolder, '', EMPTY_FILTERS);
  }

  async function handleCreateFolder(name: string, parentId: string | null) {
    await request('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    await loadArchiveMetadata();
    setNotice({ type: 'ok', text: `تم إنشاء المجلد «${name}» بنجاح.` });
  }

  async function handleDeleteFolder(folderId: string) {
    await request(`/folders/${folderId}`, { method: 'DELETE' });
    if (selectedFolder === folderId) {
      setSelectedFolder('');
      await loadDocuments('', query, filters);
    }
    await loadArchiveMetadata();
    setNotice({ type: 'ok', text: 'تم حذف المجلد.' });
  }

  async function handleUploadDocument(payload: {
    file: File;
    folderId: string;
    department: string;
    classification: string;
    keywords: string;
    summary: string;
  }): Promise<DocItem> {
    const form = new FormData();
    form.append('file', payload.file);
    if (payload.folderId) form.append('folder_id', payload.folderId);
    if (payload.department.trim()) form.append('department', payload.department.trim());
    if (payload.classification.trim()) form.append('classification', payload.classification.trim());
    if (payload.keywords.trim()) form.append('keywords', payload.keywords.trim());
    if (payload.summary.trim()) form.append('summary', payload.summary.trim());

    const created = await request('/documents', { method: 'POST', body: form });
    await loadArchiveMetadata();
    await loadDocuments(payload.folderId || selectedFolder, '', EMPTY_FILTERS);
    return created;
  }

  async function handlePreviewDoc(doc: DocItem) {
    try {
      const [details, fileRes] = await Promise.all([
        request(`/documents/${doc.id}`),
        fetch(`${API}/documents/${doc.id}/file`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        }),
      ]);
      if (!fileRes.ok) {
        if (fileRes.status === 502 || fileRes.status === 503 || fileRes.status === 504) {
          health.reportConnectionFailure();
        }
        throw new Error('تعذر تحميل معاينة الملف.');
      }
      const blob = await fileRes.blob();
      const objectUrl = URL.createObjectURL(blob);
      setActiveDoc({ ...details, mime_type: details.mime_type || doc.mime_type, objectUrl });
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'تعذر فتح المستند.' });
    }
  }

  async function handleDownloadDoc(doc: DocItem) {
    try {
      const res = await fetch(`${API}/documents/${doc.id}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('تعذر تنزيل الملف.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'تعذر تنزيل الملف.' });
    }
  }

  async function handleExport(kind: 'excel' | 'pdf') {
    try {
      const params = buildFilterParams(query, selectedFolder, filters);
      const res = await fetch(`${API}/exports/${kind}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('تعذر تصدير التقرير.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = kind === 'excel' ? 'archive-export.xlsx' : 'archive-export.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setNotice({ type: 'err', text: err?.message || 'تعذر تصدير التقرير.' });
    }
  }

  async function handleCreateUser(payload: {
    username: string;
    password: string;
    role: string;
    department: string;
  }) {
    await request('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        role: payload.role,
        department: payload.department || null,
        must_change_password: true,
      }),
    });
    await loadAdminData();
  }

  async function handleUpdateUser(
    userId: string,
    payload: {
      username?: string;
      role?: string;
      department?: string | null;
      is_active?: boolean;
      password?: string;
    }
  ) {
    await request(`/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadAdminData();
  }

  async function handleUnlockStorage(masterPassword: string) {
    const res = await request('/auth/admin/master-challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: masterPassword }),
    });
    const st = res.step_up_token;
    setStepUpToken(st);
    const [cfg, metrics] = await Promise.all([
      request('/admin/storage', { headers: { 'X-Admin-Step-Up': st } }),
      request('/admin/storage/metrics', { headers: { 'X-Admin-Step-Up': st } }),
    ]);
    if (cfg?.provider) setProvider(cfg.provider);
    if (metrics) setStorageMetrics(metrics);
  }

  async function handleSaveProvider() {
    await request('/admin/storage', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Step-Up': stepUpToken,
      },
      body: JSON.stringify({ provider }),
    });
    const metrics = await request('/admin/storage/metrics', {
      headers: { 'X-Admin-Step-Up': stepUpToken },
    });
    setStorageMetrics(metrics);
  }

  async function handleTestStorage(): Promise<string> {
    const res = await request('/admin/storage/test', {
      method: 'POST',
      headers: { 'X-Admin-Step-Up': stepUpToken },
    });
    return res?.ok ? 'الاتصال بمزود التخزين ناجح.' : 'تعذر الاتصال بمزود التخزين.';
  }

  async function handleCreateBackup() {
    const res = await fetch(`${API}/admin/backup/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Admin-Step-Up': stepUpToken,
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const txt = await res.text();
      let detail = 'تعذر إنشاء النسخة الاحتياطية.';
      try {
        detail = JSON.parse(txt)?.detail || detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-yemany-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleTriggerReindex(force: boolean) {
    const res = await request('/admin/reindex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    await loadAdminData();
    return res;
  }

  const pageTitle =
    view === 'archive' ? 'الأرشيف' : view === 'upload' ? 'رفع مستند' : 'الإعدادات';

  // ---------------- LOGIN SCREEN ----------------
  if (!token || !user) {
    return (
      <>
        <SystemStatusOverlay
          status={health.status}
          reason={health.reason}
          checking={health.checking}
          onRetry={health.retry}
        />

        <main className="login-shell" dir="rtl">
          <section className="login-panel">
            <div className="login-panel-top">
              <BrandMark size={40} compact />
              <span>نظام الأرشفة الإلكتروني · Archive-Yemany</span>
            </div>

            <div className="login-panel-content">
              <span className="login-panel-tag">
                <i />
                <span>أرشفة مؤسسية مشفرة + بحث ذكي OCR</span>
              </span>
              <h1>
                أرشيفك الإلكتروني
                <br />
                <em>أسرع وأكثر أماناً</em>
              </h1>
              <p>
                احفظ مستنداتك وصورك في مجلدات منظمة، واستخرج النصوص العربية والإنجليزية تلقائياً للبحث الفوري داخل المحتوى.
              </p>

              <div className="login-visual" aria-hidden="true">
                <div className="login-visual-ring ring-a" />
                <div className="login-visual-ring ring-b" />
                <div className="login-doc doc-back">
                  <b>PDF</b>
                  <span>ملف رسمي</span>
                  <i />
                  <i />
                  <i />
                  <small>AES-256</small>
                </div>
                <div className="login-doc doc-front">
                  <b>OCR AI</b>
                  <span>فهرسة ذكية</span>
                  <i />
                  <i />
                  <i />
                  <small>جاهز للبحث ✓</small>
                </div>
                <div className="login-float-chip">Gemini 2.5 Flash OCR</div>
                <div className="login-float-lock">🔐</div>
              </div>
            </div>

            <div className="login-panel-foot">
              <span>نظام الأرشفة الإلكتروني</span>
              <span>PostgreSQL · FastAPI · Docker</span>
            </div>
          </section>

          <section className="login-form-side">
            <div className="login-form-top">
              <SystemStatusPill status={health.status} onClick={health.retry} />
              <div className="flex items-center gap-2">
                <PWAInstallButton compact />
                <LanguageSelect current="ar" />
              </div>
            </div>

            <form onSubmit={handleLogin} className="login-form-card">
              <div className="login-form-icon">
                <BrandMark size={40} compact />
              </div>
              <div className="login-form-eyebrow">ARCHIVE-YEMANY WORKSPACE</div>
              <h2>تسجيل الدخول</h2>
              <p className="login-form-sub">
                أدخل بيانات حسابك للوصول إلى الأرشيف الإلكتروني والمستندات المفهرسة.
              </p>

              <label htmlFor="login-username">اسم المستخدم</label>
              <div className="login-input-wrap">
                <span aria-hidden="true">👤</span>
                <input
                  id="login-username"
                  dir="ltr"
                  className="text-right"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم"
                  autoComplete="username"
                  required
                />
              </div>

              <label htmlFor="login-password">كلمة المرور</label>
              <PasswordInput
                id="login-password"
                variant="login"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                autoComplete="current-password"
                required
              />

              {authError && (
                <p role="alert" className="login-error">
                  {authError}
                </p>
              )}

              <button type="submit" disabled={authBusy} className="login-submit">
                <b>{authBusy ? 'جاري التحقق...' : 'الدخول إلى الأرشيف'}</b>
                <span aria-hidden="true">←</span>
              </button>

              <div className="login-form-note">
                <span>●</span>
                <span>جلسة مؤمّنة بالتشفير الكامل وصلاحيات دقيقة للأدوار</span>
              </div>
            </form>

            <div className="login-mobile-brand">
              <BrandMark size={30} compact />
              <span>نظام الأرشفة الإلكتروني</span>
            </div>
          </section>
        </main>
      </>
    );
  }

  // ---------------- MAIN WORKSPACE ----------------
  return (
    <div className="app-shell flex flex-col lg:flex-row" dir="rtl">
      <SystemStatusOverlay
        status={health.status}
        reason={health.reason}
        checking={health.checking}
        onRetry={health.retry}
      />

      {user.must_change_password && (
        <FirstLoginPasswordModal
          user={user}
          onSubmit={handlePasswordChange}
          onLogout={clearSession}
        />
      )}

      {/* Right-Hand Navigation Sidebar (RTL) */}
      <aside className="app-sidebar lg:w-72 lg:min-h-screen lg:sticky lg:top-0 lg:h-screen flex flex-col justify-between shrink-0 text-white">
        <div>
          {/* Sidebar Brand */}
          <div className="px-5 flex items-center justify-between gap-3 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <BrandMark size={42} compact />
              <div className="min-w-0">
                <b className="block text-sm font-extrabold tracking-tight text-white truncate">
                  نظام الأرشفة الإلكتروني
                </b>
                <span className="block text-[11px] text-sky-200/80 truncate">
                  Archive-Yemany
                </span>
              </div>
            </div>
            <div className="lg:hidden">
              <SystemStatusPill status={health.status} dark onClick={health.retry} />
            </div>
          </div>

          {/* Primary Navigation (3 Clean Sections) */}
          <nav
            aria-label="التنقل الرئيسي"
            className="px-3 flex lg:flex-col gap-1.5 overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setView(item.key);
                    setNotice(null);
                    if (item.key === 'settings' && user.role === 'admin') {
                      loadAdminData();
                    }
                  }}
                  className={`nav-item flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold shrink-0 ${
                    active ? 'bg-sky-500 text-white' : 'text-slate-300'
                  }`}
                >
                  <AppIcon name={item.icon} size={19} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: PWA Install + Live Status + User + Logout */}
        <div className="hidden lg:flex flex-col gap-3 p-4 border-t border-white/10">
          <PWAInstallButton dark />

          <div className="flex items-center justify-between px-1">
            <SystemStatusPill status={health.status} dark onClick={health.retry} />
          </div>

          <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/25 border border-sky-400/30 text-sky-100 font-black text-sm grid place-items-center shrink-0">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <b className="block text-xs font-extrabold text-white truncate">
                {user.username}
              </b>
              <span className="block text-[11px] text-sky-200/75 truncate">
                {roleLabel(user.role)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={clearSession}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-200 hover:bg-rose-500/20 transition-colors"
          >
            <AppIcon name="logout" size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="app-header border-b px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block">
              <SystemStatusPill status={health.status} onClick={health.retry} />
            </div>

            <div className="hidden md:block">
              <PWAInstallButton compact />
            </div>

            <LanguageSelect current="ar" />

            {/* Top-Left User Profile Dropdown Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50 transition-colors"
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
              >
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-600 to-teal-600 text-white font-black grid place-items-center">
                  {user.username.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-[110px] truncate">{user.username}</span>
                <span className="text-slate-400 text-[10px]">▾</span>
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 z-50"
                >
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <b className="block text-xs font-extrabold text-slate-900 truncate">
                      {user.username}
                    </b>
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {roleLabel(user.role)}
                      {user.department ? ` · ${user.department}` : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setView('settings');
                      setProfileMenuOpen(false);
                    }}
                    className="mt-1 w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 text-right"
                  >
                    <AppIcon name="settings" size={15} className="text-sky-600" />
                    <span>إعدادات الحساب</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={clearSession}
                    className="mt-1 w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 text-right"
                  >
                    <AppIcon name="logout" size={15} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="app-content w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1">
          {notice && (
            <div
              role="status"
              className={`mb-5 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                notice.type === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <span>{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                className="text-xs font-bold opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {view === 'archive' && (
            <ArchiveView
              user={user}
              folders={folders}
              docs={docs}
              categories={categories}
              departments={departments}
              selectedFolder={selectedFolder}
              query={query}
              filters={filters}
              busy={searchBusy}
              onQueryChange={setQuery}
              onFiltersChange={setFilters}
              onSelectFolder={handleSelectFolder}
              onSearch={loadDocuments}
              onResetSearch={handleResetSearch}
              onCreateFolder={handleCreateFolder}
              onPreviewDoc={handlePreviewDoc}
              onDownloadDoc={handleDownloadDoc}
              onExport={handleExport}
              onGoUpload={() => setView('upload')}
            />
          )}

          {view === 'upload' && (
            <UploadView
              user={user}
              folders={folders}
              departments={departments}
              categories={categories}
              defaultFolderId={selectedFolder}
              onUpload={handleUploadDocument}
              onGoArchive={(folderId) => {
                setView('archive');
                if (folderId !== undefined) {
                  setSelectedFolder(folderId);
                  loadDocuments(folderId, '', EMPTY_FILTERS);
                }
              }}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              user={user}
              users={users}
              folders={folders}
              departments={departments}
              categories={categories}
              audit={audit}
              systemSummary={systemSummary}
              storageMetrics={storageMetrics}
              stepUpActive={Boolean(stepUpToken)}
              provider={provider}
              onChangePassword={handlePasswordChange}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onUnlockStorage={handleUnlockStorage}
              onProviderChange={setProvider}
              onSaveProvider={handleSaveProvider}
              onTestStorage={handleTestStorage}
              onCreateBackup={handleCreateBackup}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onTriggerReindex={handleTriggerReindex}
              onRefreshAdmin={loadAdminData}
            />
          )}
        </main>
      </div>

      {/* Document Preview + Extracted Text + Ask + Share Modal */}
      {activeDoc && (
        <DocumentModal
          doc={activeDoc}
          token={token}
          language="ar"
          onClose={() => setActiveDoc(null)}
        />
      )}
    </div>
  );
}
