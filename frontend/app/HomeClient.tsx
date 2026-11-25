'use client';
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrandMark, { AppIcon } from './BrandMark';
import DocumentModal from './DocumentModal';
import ArchiveView from './components/ArchiveView';
import EditDocumentModal from './components/EditDocumentModal';
import FirstLoginPasswordModal from './components/FirstLoginPasswordModal';
import LanguageSelectionModal from './components/LanguageSelectionModal';
import PasswordInput from './components/PasswordInput';
import PWAInstallButton from './components/PWAInstallButton';
import SettingsView from './components/SettingsView';
import {
  SystemStatusOverlay,
  SystemStatusPill,
  useSystemHealth,
} from './components/SystemStatus';
import ToastContainer from './components/ToastContainer';
import TrashView from './components/TrashView';
import UploadView from './components/UploadView';
import {
  ArchiveFilters,
  AuditItem,
  DocItem,
  EmployeeLinkGroup,
  FolderItem,
  GeminiSettings,
  LocaleCode,
  OwnerSummary,
  StorageMetrics,
  SystemSummary,
  ThemeMode,
  ToastItem,
  TrashData,
  User,
} from './components/types';
import {
  getDirection,
  getTranslations,
  isSupportedLocale,
  roleDisplayLabel,
} from './lib/i18n';

const API = '/api/v1';
const SESSION_KEY = 'archive-system-session';
const PREF_LANG_KEY = 'archive-pref-lang';
const PREF_THEME_KEY = 'archive-pref-theme';

type SectionKey = 'archive' | 'upload' | 'trash' | 'settings';

type PreviewDocState = {
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

const EMPTY_FILTERS: ArchiveFilters = {
  department: '',
  mime_type: '',
  classification: '',
  keyword: '',
  owner_id: '',
  from_date: '',
  to_date: '',
};

const EMPTY_TRASH: TrashData = {
  folders: [],
  documents: [],
  total_count: 0,
};

function readInitialLocale(propLocale?: LocaleCode): LocaleCode {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(PREF_LANG_KEY);
    if (isSupportedLocale(saved)) return saved;
  }
  if (propLocale && isSupportedLocale(propLocale)) return propLocale;
  return 'ar';
}

function readInitialTheme(): ThemeMode {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(PREF_THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  }
  return 'light';
}

export default function HomeClient({ initialLocale }: { initialLocale?: LocaleCode }) {
  const health = useSystemHealth();

  // Preferences
  const [locale, setLocale] = useState<LocaleCode>(() => readInitialLocale(initialLocale));
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());

  const t = useMemo(() => getTranslations(locale), [locale]);
  const dir = useMemo(() => getDirection(locale), [locale]);

  // Auth & Session
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Login Form
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Navigation
  const [section, setSection] = useState<SectionKey>('archive');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Archive & Explorer Data
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [visibleOwners, setVisibleOwners] = useState<OwnerSummary[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [filters, setFilters] = useState<ArchiveFilters>(EMPTY_FILTERS);
  const [searchBusy, setSearchBusy] = useState(false);

  // Recycle Bin
  const [trash, setTrash] = useState<TrashData>(EMPTY_TRASH);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // Modals
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Admin State
  const [users, setUsers] = useState<User[]>([]);
  const [linkGroups, setLinkGroups] = useState<EmployeeLinkGroup[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [systemSummary, setSystemSummary] = useState<SystemSummary | null>(null);
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettings | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [stepUpToken, setStepUpToken] = useState<string>('');
  const [provider, setProvider] = useState<string>('local');

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const previewUrlRef = useRef<string | null>(null);

  const pushToast = useCallback((type: ToastItem['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Apply lang, dir, and dark class to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [locale, dir, theme]);

  // Persist user preferences locally
  const applyLocalPreferences = useCallback((nextLocale?: LocaleCode | null, nextTheme?: ThemeMode | null) => {
    if (nextLocale && isSupportedLocale(nextLocale)) {
      setLocale(nextLocale);
      try {
        window.localStorage.setItem(PREF_LANG_KEY, nextLocale);
      } catch {
        // ignore storage restrictions
      }
    }
    if (nextTheme === 'light' || nextTheme === 'dark') {
      setTheme(nextTheme);
      try {
        window.localStorage.setItem(PREF_THEME_KEY, nextTheme);
      } catch {
        // ignore storage restrictions
      }
    }
  }, []);

  const persistSession = useCallback((nextToken: string, nextUser: User) => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
    } catch {
      // ignore storage errors
    }
  }, []);

  const clearSession = useCallback((reason?: string) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setToken('');
    setUser(null);
    setFolders([]);
    setDocs([]);
    setVisibleOwners([]);
    setTrash(EMPTY_TRASH);
    setUsers([]);
    setLinkGroups([]);
    setAudit([]);
    setSystemSummary(null);
    setGeminiSettings(null);
    setStorageMetrics(null);
    setStepUpToken('');
    setPreviewDoc(null);
    setEditingDoc(null);
    setShowLanguageModal(false);
    setSelectedFolder('');
    setQuery('');
    setFilters(EMPTY_FILTERS);
    setSection('archive');
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    if (reason) {
      pushToast('info', reason);
    }
  }, [pushToast]);

  // Authenticated fetch helper
  const apiFetch = useCallback(
    async (
      path: string,
      options: RequestInit = {},
      overrideToken?: string
    ): Promise<Response> => {
      const activeToken = overrideToken ?? token;
      const headers = new Headers(options.headers || {});
      if (activeToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has('Content-Type')
      ) {
        headers.set('Content-Type', 'application/json');
      }

      let res: Response;
      try {
        res = await fetch(`${API}${path}`, {
          ...options,
          headers,
          cache: 'no-store',
        });
      } catch {
        health.reportConnectionFailure();
        throw new Error(t.networkError);
      }

      if (res.status === 401 && activeToken) {
        clearSession(t.sessionExpired);
        throw new Error(t.sessionExpired);
      }

      return res;
    },
    [token, health, clearSession, t.networkError, t.sessionExpired]
  );

  const parseErrorDetail = async (res: Response, fallback: string): Promise<string> => {
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
      if (Array.isArray(data?.detail) && data.detail[0]?.msg) return String(data.detail[0].msg);
      if (typeof data?.message === 'string' && data.message.trim()) return data.message;
    } catch {
      // ignore
    }
    return fallback;
  };

  // Loaders
  const loadFolders = useCallback(
    async (overrideToken?: string) => {
      setLoadingFolders(true);
      try {
        const res = await apiFetch('/folders', {}, overrideToken);
        if (res.ok) {
          const data = await res.json();
          setFolders(Array.isArray(data) ? data : []);
        }
      } catch {
        // handled in apiFetch
      } finally {
        setLoadingFolders(false);
      }
    },
    [apiFetch]
  );

  const loadVisibleOwners = useCallback(
    async (overrideToken?: string) => {
      try {
        const res = await apiFetch('/users/visible-owners', {}, overrideToken);
        if (res.ok) {
          const data = await res.json();
          setVisibleOwners(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      }
    },
    [apiFetch]
  );

  const loadTrash = useCallback(
    async (overrideToken?: string) => {
      setLoadingTrash(true);
      try {
        const res = await apiFetch('/trash', {}, overrideToken);
        if (res.ok) {
          const data = await res.json();
          setTrash({
            folders: Array.isArray(data?.folders) ? data.folders : [],
            documents: Array.isArray(data?.documents) ? data.documents : [],
            total_count: Number(data?.total_count || 0),
          });
        }
      } catch {
        // ignore
      } finally {
        setLoadingTrash(false);
      }
    },
    [apiFetch]
  );

  const loadDocuments = useCallback(
    async (
      overrideFolderId?: string,
      overrideQuery?: string,
      overrideFilters?: ArchiveFilters,
      overrideToken?: string
    ) => {
      const activeFolder = overrideFolderId !== undefined ? overrideFolderId : selectedFolder;
      const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
      const activeFilters = overrideFilters !== undefined ? overrideFilters : filters;

      setSearchBusy(true);
      try {
        const params = new URLSearchParams();
        if (activeQuery.trim()) params.set('q', activeQuery.trim());
        if (activeFolder) params.set('folder_id', activeFolder);
        if (activeFilters.department) params.set('department', activeFilters.department);
        if (activeFilters.mime_type) params.set('mime_type', activeFilters.mime_type);
        if (activeFilters.classification) params.set('classification', activeFilters.classification);
        if (activeFilters.keyword.trim()) params.set('keyword', activeFilters.keyword.trim());
        if (activeFilters.owner_id) params.set('owner_id', activeFilters.owner_id);
        if (activeFilters.from_date) params.set('from_date', activeFilters.from_date);
        if (activeFilters.to_date) params.set('to_date', activeFilters.to_date);

        const qs = params.toString();
        const res = await apiFetch(`/search${qs ? `?${qs}` : ''}`, {}, overrideToken);
        if (res.ok) {
          const data = await res.json();
          setDocs(Array.isArray(data) ? data : []);
        }
      } catch {
        // ignore
      } finally {
        setSearchBusy(false);
      }
    },
    [apiFetch, selectedFolder, query, filters]
  );

  const loadAdminData = useCallback(
    async (overrideToken?: string) => {
      try {
        const [usersRes, groupsRes, auditRes, summaryRes, geminiRes, metricsRes] = await Promise.all([
          apiFetch('/users', {}, overrideToken),
          apiFetch('/users/link-groups', {}, overrideToken),
          apiFetch('/audit?limit=100', {}, overrideToken),
          apiFetch('/admin/system-summary', {}, overrideToken),
          apiFetch('/admin/gemini-settings', {}, overrideToken),
          apiFetch('/admin/storage-metrics', {}, overrideToken),
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(Array.isArray(data) ? data : []);
        }
        if (groupsRes.ok) {
          const data = await groupsRes.json();
          setLinkGroups(Array.isArray(data) ? data : []);
        }
        if (auditRes.ok) {
          const data = await auditRes.json();
          setAudit(Array.isArray(data) ? data : []);
        }
        if (summaryRes.ok) {
          const data: SystemSummary = await summaryRes.json();
          setSystemSummary(data);
          if (data?.provider) setProvider(data.provider);
        }
        if (geminiRes.ok) {
          const data: GeminiSettings = await geminiRes.json();
          setGeminiSettings(data);
        }
        if (metricsRes.ok) {
          const data: StorageMetrics = await metricsRes.json();
          setStorageMetrics(data);
        }
      } catch {
        // ignore
      }
    },
    [apiFetch]
  );

  const bootstrapSession = useCallback(
    async (nextToken: string, initialUser: User) => {
      let freshUser = initialUser;
      try {
        const meRes = await apiFetch('/auth/me', {}, nextToken);
        if (meRes.ok) {
          freshUser = await meRes.json();
        }
      } catch {
        // fallback to initialUser
      }

      setToken(nextToken);
      setUser(freshUser);
      persistSession(nextToken, freshUser);

      // Sync user saved preferences from DB
      if (freshUser.preferred_language && isSupportedLocale(freshUser.preferred_language)) {
        applyLocalPreferences(freshUser.preferred_language, freshUser.preferred_theme || null);
        setShowLanguageModal(false);
      } else {
        if (freshUser.preferred_theme) {
          applyLocalPreferences(null, freshUser.preferred_theme);
        }
        // First sign-in language choice modal (for both Admin and employees)
        setShowLanguageModal(true);
      }

      await Promise.all([
        loadFolders(nextToken),
        loadDocuments('', '', EMPTY_FILTERS, nextToken),
        loadVisibleOwners(nextToken),
        loadTrash(nextToken),
      ]);

      if (freshUser.role === 'admin') {
        await loadAdminData(nextToken);
      }
    },
    [
      apiFetch,
      persistSession,
      applyLocalPreferences,
      loadFolders,
      loadDocuments,
      loadVisibleOwners,
      loadTrash,
      loadAdminData,
    ]
  );

  // Restore session on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = window.sessionStorage.getItem(SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token && parsed?.user && active) {
            await bootstrapSession(parsed.token, parsed.user);
          }
        }
      } catch {
        // ignore corrupted session
      } finally {
        if (active) setHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived unique departments and classifications
  const departments = useMemo(() => {
    const set = new Set<string>();
    if (user?.department) set.add(user.department);
    docs.forEach((d) => {
      if (d.department) set.add(d.department);
    });
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [docs, users, user]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    docs.forEach((d) => {
      if (d.classification) set.add(d.classification);
    });
    return Array.from(set).sort();
  }, [docs]);

  // Handlers: Auth & Preferences
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword) return;

    setLoginBusy(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.invalidCredentials);
        setLoginError(msg);
        return;
      }
      const data = await res.json();
      setLoginPassword('');
      await bootstrapSession(data.access_token, data.user);
    } catch {
      health.reportConnectionFailure();
      setLoginError(t.networkError);
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleUpdatePreferences(prefs: {
    preferred_language?: LocaleCode;
    preferred_theme?: ThemeMode;
  }) {
    applyLocalPreferences(prefs.preferred_language || null, prefs.preferred_theme || null);
    if (!token || !user) return;

    const res = await apiFetch('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    const updatedUser: User = await res.json();
    setUser(updatedUser);
    persistSession(token, updatedUser);
    if (prefs.preferred_language) {
      setShowLanguageModal(false);
    }
    const nextT = getTranslations(prefs.preferred_language || locale);
    pushToast('ok', nextT.savedSuccess);
  }

  async function handleChangePassword(currentPassword: string, newPassword: string) {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    if (user) {
      const updatedUser: User = { ...user, must_change_password: false };
      setUser(updatedUser);
      persistSession(token, updatedUser);
    }
    pushToast('ok', t.savedSuccess);
  }

  // Handlers: Archive Explorer
  function handleSelectFolder(folderId: string) {
    setSelectedFolder(folderId);
    loadDocuments(folderId, query, filters);
  }

  function handleResetSearch() {
    setQuery('');
    setFilters(EMPTY_FILTERS);
    loadDocuments(selectedFolder, '', EMPTY_FILTERS);
  }

  async function handleCreateFolder(name: string, parentId: string | null) {
    const res = await apiFetch('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await loadFolders();
    pushToast('ok', t.savedSuccess);
  }

  async function handleSoftDeleteFolder(folder: FolderItem) {
    const res = await apiFetch(`/folders/${folder.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    const nextFolder = selectedFolder === folder.id ? folder.parent_id || '' : selectedFolder;
    setSelectedFolder(nextFolder);
    await Promise.all([loadFolders(), loadDocuments(nextFolder, query, filters), loadTrash()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleSoftDeleteDoc(doc: DocItem) {
    const res = await apiFetch(`/documents/${doc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await Promise.all([loadFolders(), loadDocuments(), loadTrash()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handlePreviewDoc(doc: DocItem) {
    try {
      const res = await apiFetch(`/documents/${doc.id}/download?inline=true`);
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
        return;
      }
      const blob = await res.blob();
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objectUrl;

      setPreviewDoc({
        id: doc.id,
        file_name: doc.file_name,
        mime_type: doc.mime_type || blob.type,
        objectUrl,
        extracted_text: doc.extracted_text || '',
        summary: doc.summary || '',
        classification: doc.classification || '',
        department: doc.department || '',
        owner_name: doc.owner_name || doc.owner_username || null,
        keywords: doc.keywords || [],
      });
    } catch (err: any) {
      pushToast('err', err?.message || t.errorGeneric);
    }
  }

  function handleClosePreview() {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewDoc(null);
  }

  async function handleDownloadDoc(doc: { id: string; file_name: string }) {
    try {
      const res = await apiFetch(`/documents/${doc.id}/download`);
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      pushToast('err', err?.message || t.errorGeneric);
    }
  }

  async function handleSaveDocEdit(
    docId: string,
    payload: {
      file_name: string;
      folder_id: string | null;
      department: string | null;
      classification: string | null;
      summary: string | null;
      keywords: string[];
    }
  ) {
    const res = await apiFetch(`/documents/${docId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await Promise.all([loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleExport(kind: 'xlsx' | 'pdf') {
    if (!docs.length) {
      pushToast('info', t.emptyArchiveTitle);
      return;
    }
    try {
      const params = new URLSearchParams();
      params.set('format', kind);
      docs.forEach((d) => params.append('ids', d.id));
      const res = await apiFetch(`/exports/documents/export?${params.toString()}`);
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archive-export.${kind}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast('ok', t.savedSuccess);
    } catch (err: any) {
      pushToast('err', err?.message || t.errorGeneric);
    }
  }

  // Real XHR upload with progress bar (0% - 100%)
  function handleUploadDocument(
    payload: {
      file: File;
      folderId: string;
      department: string;
      classification: string;
      keywords: string;
      summary: string;
    },
    onProgress: (percent: number) => void
  ): Promise<DocItem> {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', payload.file);
      if (payload.folderId) formData.append('folder_id', payload.folderId);
      if (payload.department) formData.append('department', payload.department);
      if (payload.classification) formData.append('classification', payload.classification);
      if (payload.keywords) formData.append('keywords', payload.keywords);
      if (payload.summary) formData.append('summary', payload.summary);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/documents/upload`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
          onProgress(pct);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 401) {
          clearSession(t.sessionExpired);
          reject(new Error(t.sessionExpired));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          try {
            const doc: DocItem = JSON.parse(xhr.responseText);
            await Promise.all([loadFolders(), loadDocuments()]);
            pushToast('ok', t.uploadSuccess);
            resolve(doc);
          } catch {
            reject(new Error(t.errorGeneric));
          }
        } else {
          let errMsg = t.errorGeneric;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (typeof parsed?.detail === 'string') errMsg = parsed.detail;
          } catch {
            // ignore
          }
          pushToast('err', errMsg);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        health.reportConnectionFailure();
        pushToast('err', t.networkError);
        reject(new Error(t.networkError));
      };

      xhr.send(formData);
    });
  }

  // Handlers: Recycle Bin
  async function handleRestoreDoc(doc: DocItem) {
    const res = await apiFetch(`/trash/documents/${doc.id}/restore`, { method: 'POST' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await Promise.all([loadTrash(), loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleRestoreFolder(folder: FolderItem) {
    const res = await apiFetch(`/trash/folders/${folder.id}/restore`, { method: 'POST' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await Promise.all([loadTrash(), loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handlePermanentDeleteDoc(doc: DocItem) {
    const res = await apiFetch(`/trash/documents/${doc.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await loadTrash();
    if (user?.role === 'admin') await loadAdminData();
    pushToast('ok', t.savedSuccess);
  }

  async function handlePermanentDeleteFolder(folder: FolderItem) {
    const res = await apiFetch(`/trash/folders/${folder.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await loadTrash();
    if (user?.role === 'admin') await loadAdminData();
    pushToast('ok', t.savedSuccess);
  }

  async function handleEmptyTrash() {
    const res = await apiFetch('/trash/empty', { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await loadTrash();
    if (user?.role === 'admin') await loadAdminData();
    pushToast('ok', t.savedSuccess);
  }

  // Handlers: Admin Users & Linking
  async function handleCreateUser(payload: {
    username: string;
    full_name: string;
    job_title: string;
    password: string;
    role: string;
    department: string;
  }) {
    const res = await apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await Promise.all([loadAdminData(), loadVisibleOwners()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleUpdateUser(
    userId: string,
    payload: {
      username?: string;
      full_name?: string | null;
      job_title?: string | null;
      role?: string;
      department?: string | null;
      is_active?: boolean;
      password?: string;
    }
  ) {
    const res = await apiFetch(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const updated = await res.json();
    if (user && updated?.id === user.id) {
      const merged: User = { ...user, ...updated };
      setUser(merged);
      persistSession(token, merged);
    }
    await Promise.all([loadAdminData(), loadVisibleOwners()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleCreateLinkGroup(name: string, memberIds: string[]) {
    const res = await apiFetch('/users/link-groups', {
      method: 'POST',
      body: JSON.stringify({ name, member_ids: memberIds }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await Promise.all([loadAdminData(), loadVisibleOwners(), loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleUpdateLinkGroup(groupId: string, name: string, memberIds: string[]) {
    const res = await apiFetch(`/users/link-groups/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, member_ids: memberIds }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await Promise.all([loadAdminData(), loadVisibleOwners(), loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleDeleteLinkGroup(groupId: string) {
    const res = await apiFetch(`/users/link-groups/${groupId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await Promise.all([loadAdminData(), loadVisibleOwners(), loadFolders(), loadDocuments()]);
    pushToast('ok', t.savedSuccess);
  }

  // Handlers: Admin Gemini / Storage / Reindex
  async function handleSaveGeminiSettings(payload: {
    api_key?: string;
    is_enabled: boolean;
    clear_key?: boolean;
  }): Promise<{ message: string }> {
    const res = await apiFetch('/admin/gemini-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    await loadAdminData();
    pushToast('ok', t.savedSuccess);
    return { message: data?.message || t.savedSuccess };
  }

  async function handleTestGeminiSettings(
    apiKey?: string
  ): Promise<{ ok: boolean; message: string }> {
    const res = await apiFetch('/admin/gemini-settings/test', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey || null }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      return { ok: false, message: msg };
    }
    const data = await res.json();
    return { ok: Boolean(data?.ok), message: data?.message || t.savedSuccess };
  }

  async function handleUnlockStorage(masterPassword: string) {
    const res = await apiFetch('/admin/storage-step-up', {
      method: 'POST',
      body: JSON.stringify({ master_password: masterPassword }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    setStepUpToken(data?.step_up_token || 'unlocked');
    pushToast('ok', t.savedSuccess);
  }

  async function handleSaveProvider() {
    const res = await apiFetch('/admin/storage-provider', {
      method: 'POST',
      headers: stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {},
      body: JSON.stringify({ provider }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await loadAdminData();
    pushToast('ok', t.savedSuccess);
  }

  async function handleTestStorage(): Promise<string> {
    const res = await apiFetch('/admin/storage-test', {
      method: 'POST',
      headers: stepUpToken ? { 'X-Step-Up-Token': stepUpToken } : {},
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    return data?.message || t.savedSuccess;
  }

  async function handleCreateBackup() {
    const res = await apiFetch('/admin/backup', { method: 'POST' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    pushToast('ok', t.savedSuccess);
  }

  async function handleTriggerReindex(
    force: boolean
  ): Promise<{ queued_count: number; message: string }> {
    const res = await apiFetch('/admin/reindex', {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    await loadAdminData();
    pushToast('ok', t.savedSuccess);
    return {
      queued_count: Number(data?.queued_count || 0),
      message: data?.message || t.savedSuccess,
    };
  }

  function handleNavigate(target: SectionKey) {
    setSection(target);
    setMobileNavOpen(false);
    if (target === 'trash') {
      loadTrash();
    } else if (target === 'settings' && user?.role === 'admin') {
      loadAdminData();
    } else if (target === 'archive') {
      loadFolders();
      loadDocuments();
    }
  }

  if (!hydrated) {
    return (
      <main
        aria-busy="true"
        className="min-h-[100svh] bg-[#F8FAFC] dark:bg-[#0B1120] flex items-center justify-center"
      >
        <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
      </main>
    );
  }

  // =========================================================================
  // MINIMAL LUXURY LOGIN SCREEN (Zero marketing slogans, zero clutter)
  // =========================================================================
  if (!user || !token) {
    return (
      <div
        dir={dir}
        className="min-h-[100svh] bg-[#F8FAFC] dark:bg-[#0B1120] flex flex-col items-center justify-center p-4 sm:p-6 transition-colors"
      >
        <main className="w-full max-w-sm">
          <div className="card p-7 sm:p-8 shadow-sm">
            <div className="flex flex-col items-center text-center mb-7">
              <BrandMark size={48} />
              <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t.appName}
              </h1>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {t.usernameLabel}
                </label>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  className="field"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  {t.passwordLabel}
                </label>
                <PasswordInput
                  id="login-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  required
                  showLabel={t.showPassword}
                  hideLabel={t.hidePassword}
                />
              </div>

              {loginError && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginBusy}
                className="btn btn-primary w-full py-2.5 text-sm mt-2"
              >
                {loginBusy ? t.signingIn : t.signInButton}
              </button>
            </form>
          </div>
        </main>

        <SystemStatusOverlay
          status={health.status}
          reason={health.reason}
          checking={health.checking}
          t={t}
          dir={dir}
          onRetry={health.retry}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  // =========================================================================
  // ENTERPRISE WORKSPACE SHELL
  // =========================================================================
  const userDisplayName = user.full_name?.trim() || user.username;
  const userSubtitle = user.job_title?.trim() || roleDisplayLabel(user.role, t);
  const avatarInitial = (userDisplayName[0] || 'U').toUpperCase();

  const pageTitle =
    section === 'archive'
      ? t.navArchive
      : section === 'upload'
      ? t.navUpload
      : section === 'trash'
      ? t.navTrash
      : t.navSettings;

  const navItems: {
    key: SectionKey;
    label: string;
    icon: Parameters<typeof AppIcon>[0]['name'];
    badge?: number;
  }[] = [
    { key: 'archive', label: t.navArchive, icon: 'archive' },
    { key: 'upload', label: t.navUpload, icon: 'upload' },
    { key: 'trash', label: t.navTrash, icon: 'trash', badge: trash.total_count },
    { key: 'settings', label: t.navSettings, icon: 'settings' },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-200 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between gap-2.5 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size={34} compact />
          <span className="text-sm font-bold text-white tracking-tight truncate">
            {t.appName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label={t.close}
        >
          <AppIcon name="x" size={18} />
        </button>
      </div>

      {/* Navigation Links (Clean soft rounded active highlight, NO glowing side bar) */}
      <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = section === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleNavigate(item.key)}
              className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active
                  ? 'bg-blue-600/20 text-white font-semibold'
                  : 'text-slate-300 font-medium hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={active ? 'text-blue-400' : 'text-slate-400'}>
                  <AppIcon name={item.icon} size={18} />
                </span>
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  dir="ltr"
                  className={`min-w-[22px] h-5 px-1.5 rounded-md text-[11px] font-semibold inline-flex items-center justify-center tabular-nums ${
                    active
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer: User Profile Card + Install + Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-2.5 shrink-0">
        <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 border border-slate-800/80 px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-600/25 border border-blue-500/30 text-blue-200 font-bold text-sm grid place-items-center shrink-0">
            {avatarInitial}
          </div>
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-xs font-semibold text-white truncate max-w-full leading-snug">
              {userDisplayName}
            </span>
            <span className="text-[11px] text-slate-400 truncate max-w-full leading-snug mt-0.5">
              {userSubtitle}
            </span>
          </div>
        </div>

        <PWAInstallButton dark label={t.installApp} closeLabel={t.close} dir={dir} />

        <button
          type="button"
          onClick={() => clearSession()}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-rose-500/15 hover:text-rose-200 hover:border-rose-500/30 transition-colors"
        >
          <AppIcon name="logout" size={15} />
          <span>{t.logout}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      dir={dir}
      className="min-h-[100svh] bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex transition-colors"
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 shrink-0 sticky top-0 h-[100svh] border-e border-slate-800/80 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-sm flex"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <aside className="w-64 max-w-[82vw] h-full shadow-2xl">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Minimal Top Header (NO Language Dropdown) */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Menu"
            >
              <AppIcon name="menu" size={18} />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <SystemStatusPill status={health.status} t={t} onClick={health.retry} />
          </div>
        </header>

        {/* Active Workspace View */}
        <main className="flex-1 p-4 sm:p-6 lg:p-7">
          {section === 'archive' && (
            <ArchiveView
              user={user}
              folders={folders}
              docs={docs}
              visibleOwners={visibleOwners}
              categories={categories}
              departments={departments}
              selectedFolder={selectedFolder}
              query={query}
              filters={filters}
              busy={searchBusy}
              loadingFolders={loadingFolders}
              t={t}
              dir={dir}
              onQueryChange={setQuery}
              onFiltersChange={setFilters}
              onSelectFolder={handleSelectFolder}
              onSearch={(fId, q, f) => loadDocuments(fId, q, f)}
              onResetSearch={handleResetSearch}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleSoftDeleteFolder}
              onPreviewDoc={handlePreviewDoc}
              onEditDoc={(doc) => setEditingDoc(doc)}
              onDownloadDoc={handleDownloadDoc}
              onDeleteDoc={handleSoftDeleteDoc}
              onExport={handleExport}
              onGoUpload={() => handleNavigate('upload')}
            />
          )}

          {section === 'upload' && (
            <UploadView
              user={user}
              folders={folders}
              departments={departments}
              categories={categories}
              defaultFolderId={selectedFolder}
              t={t}
              onUpload={handleUploadDocument}
              onGoArchive={(folderId) => {
                if (folderId !== undefined) {
                  setSelectedFolder(folderId);
                  loadDocuments(folderId, query, filters);
                }
                setSection('archive');
              }}
            />
          )}

          {section === 'trash' && (
            <TrashView
              user={user}
              trash={trash}
              loading={loadingTrash}
              t={t}
              dir={dir}
              onRestoreDoc={handleRestoreDoc}
              onRestoreFolder={handleRestoreFolder}
              onPermanentDeleteDoc={handlePermanentDeleteDoc}
              onPermanentDeleteFolder={handlePermanentDeleteFolder}
              onEmptyTrash={handleEmptyTrash}
            />
          )}

          {section === 'settings' && (
            <SettingsView
              user={user}
              users={users}
              linkGroups={linkGroups}
              folders={folders}
              departments={departments}
              categories={categories}
              audit={audit}
              systemSummary={systemSummary}
              geminiSettings={geminiSettings}
              storageMetrics={storageMetrics}
              stepUpActive={Boolean(stepUpToken)}
              provider={provider}
              locale={locale}
              theme={theme}
              t={t}
              dir={dir}
              onUpdatePreferences={handleUpdatePreferences}
              onChangePassword={handleChangePassword}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onCreateLinkGroup={handleCreateLinkGroup}
              onUpdateLinkGroup={handleUpdateLinkGroup}
              onDeleteLinkGroup={handleDeleteLinkGroup}
              onSaveGeminiSettings={handleSaveGeminiSettings}
              onTestGeminiSettings={handleTestGeminiSettings}
              onUnlockStorage={handleUnlockStorage}
              onProviderChange={setProvider}
              onSaveProvider={handleSaveProvider}
              onTestStorage={handleTestStorage}
              onCreateBackup={handleCreateBackup}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleSoftDeleteFolder}
              onTriggerReindex={handleTriggerReindex}
              onRefreshAdmin={async () => {
                await Promise.all([loadAdminData(), loadFolders(), loadVisibleOwners(), loadTrash()]);
              }}
            />
          )}
        </main>
      </div>

      {/* Quick Preview Modal */}
      {previewDoc && (
        <DocumentModal
          doc={previewDoc}
          token={token}
          language={locale}
          onDownload={() => handleDownloadDoc({ id: previewDoc.id, file_name: previewDoc.file_name })}
          onClose={handleClosePreview}
        />
      )}

      {/* Edit & Move Document Modal */}
      {editingDoc && (
        <EditDocumentModal
          doc={editingDoc}
          folders={folders}
          departments={departments}
          categories={categories}
          t={t}
          dir={dir}
          onSave={handleSaveDocEdit}
          onClose={() => setEditingDoc(null)}
        />
      )}

      {/* First-Login Mandatory Password Change Modal */}
      {user.must_change_password && (
        <FirstLoginPasswordModal
          user={user}
          t={t}
          dir={dir}
          onSubmit={handleChangePassword}
          onLogout={() => clearSession()}
        />
      )}

      {/* First-Login Language Selection Modal (after password change if required) */}
      {!user.must_change_password && showLanguageModal && (
        <LanguageSelectionModal
          currentLocale={locale}
          onSelect={async (selectedLocale) => {
            await handleUpdatePreferences({ preferred_language: selectedLocale });
          }}
        />
      )}

      {/* Connection Status Overlay */}
      <SystemStatusOverlay
        status={health.status}
        reason={health.reason}
        checking={health.checking}
        t={t}
        dir={dir}
        onRetry={health.retry}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
