'use client';
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrandMark, { AppIcon } from './BrandMark';
import DocumentModal from './DocumentModal';
import ArchiveView, { DRAG_DOC_IDS_MIME } from './components/ArchiveView';
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
  ArchiveScope,
  AuditItem,
  BulkUploadTask,
  DocItem,
  EmployeeLinkGroup,
  FolderItem,
  GeminiSettings,
  LocaleCode,
  OwnerSummary,
  StorageMetrics,
  SystemSummary,
  TaxonomyData,
  ThemeMode,
  ToastItem,
  TrashData,
  User,
} from './components/types';
import {
  getDirection,
  getTranslations,
  isSupportedLocale,
  LANGUAGES,
  roleDisplayLabel,
} from './lib/i18n';
import { localizeApiError, localizeServerMessage } from './lib/errorLocalizer';

const API = '/api/v1';
const SESSION_KEY = 'archive-system-session';
const PREF_LANG_KEY = 'archive-pref-lang';
const PREF_LANG_CHOSEN_KEY = 'archive-pref-lang-chosen';
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

const EMPTY_TAXONOMY: TaxonomyData = {
  departments: [],
  classifications: [],
};

const MAX_BULK_UPLOAD_FILES = 20;
const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;
const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/webp',
  'image/tiff',
  'image/bmp',
  'image/gif',
]);
const ALLOWED_UPLOAD_EXTS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'tif',
  'tiff',
  'bmp',
  'gif',
]);

function isAllowedUploadFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (ALLOWED_UPLOAD_MIMES.has(mime)) return true;
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() || '' : '';
  return ALLOWED_UPLOAD_EXTS.has(ext);
}

function readInitialLocale(propLocale?: LocaleCode): LocaleCode {
  if (typeof window !== 'undefined') {
    const saved = window.localStorage.getItem(PREF_LANG_KEY);
    if (isSupportedLocale(saved)) return saved;
  }
  if (propLocale && isSupportedLocale(propLocale)) return propLocale;
  return 'ar';
}

function readHasChosenLanguage(): boolean {
  if (typeof window !== 'undefined') {
    if (window.localStorage.getItem(PREF_LANG_CHOSEN_KEY) === '1') return true;
    const saved = window.localStorage.getItem(PREF_LANG_KEY);
    if (isSupportedLocale(saved)) return true;
  }
  return false;
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
  const [languageChosen, setLanguageChosen] = useState<boolean>(() => readHasChosenLanguage());
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
  const [folderTreeOpen, setFolderTreeOpen] = useState(true);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});

  // Archive & Explorer Data
  const [archiveScope, setArchiveScope] = useState<ArchiveScope>('all');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [visibleOwners, setVisibleOwners] = useState<OwnerSummary[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyData>(EMPTY_TAXONOMY);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [filters, setFilters] = useState<ArchiveFilters>(EMPTY_FILTERS);
  const [searchBusy, setSearchBusy] = useState(false);
  const [bulkUploadTasks, setBulkUploadTasks] = useState<BulkUploadTask[]>([]);
  const [sidebarDragOverId, setSidebarDragOverId] = useState<string | null>(null);

  // Recycle Bin
  const [trash, setTrash] = useState<TrashData>(EMPTY_TRASH);
  const [loadingTrash, setLoadingTrash] = useState(false);

  // Modals
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocItem | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [preLoginLangOpen, setPreLoginLangOpen] = useState(false);

  // Admin State
  const [users, setUsers] = useState<User[]>([]);
  const [linkGroups, setLinkGroups] = useState<EmployeeLinkGroup[]>([]);
  const [audit, setAudit] = useState<AuditItem[]>([]);
  const [systemSummary, setSystemSummary] = useState<SystemSummary | null>(null);
  const [geminiSettings, setGeminiSettings] = useState<GeminiSettings | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [stepUpToken, setStepUpToken] = useState<string>('');
  const [provider, setProvider] = useState<string>('local');

  // Toasts & Refs
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const previewUrlRef = useRef<string | null>(null);
  const uploadTrayTimerRef = useRef<number | null>(null);

  const canPrint = Boolean(user && (user.role === 'admin' || user.can_print));

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

  // Enforce global print restriction for employees without print permission
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const printBlocked = Boolean(user && !canPrint);
    document.documentElement.classList.toggle('print-blocked', printBlocked);

    if (!printBlocked) {
      return () => {
        document.documentElement.classList.remove('print-blocked');
      };
    }

    const handleBlockPrintShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleBlockPrintShortcut, true);
    return () => {
      window.removeEventListener('keydown', handleBlockPrintShortcut, true);
      document.documentElement.classList.remove('print-blocked');
    };
  }, [user, canPrint]);

  // Persist user preferences locally
  const applyLocalPreferences = useCallback((nextLocale?: LocaleCode | null, nextTheme?: ThemeMode | null) => {
    if (nextLocale && isSupportedLocale(nextLocale)) {
      setLocale(nextLocale);
      setLanguageChosen(true);
      try {
        window.localStorage.setItem(PREF_LANG_KEY, nextLocale);
        window.localStorage.setItem(PREF_LANG_CHOSEN_KEY, '1');
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
    if (uploadTrayTimerRef.current) {
      window.clearTimeout(uploadTrayTimerRef.current);
      uploadTrayTimerRef.current = null;
    }
    setToken('');
    setUser(null);
    setArchiveScope('all');
    setFolders([]);
    setDocs([]);
    setVisibleOwners([]);
    setTaxonomy(EMPTY_TAXONOMY);
    setBulkUploadTasks([]);
    setSidebarDragOverId(null);
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
      if (!headers.has('Accept-Language')) {
        headers.set('Accept-Language', locale);
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
    [token, locale, health, clearSession, t.networkError, t.sessionExpired]
  );

  const parseErrorDetail = async (res: Response, fallback: string): Promise<string> => {
    let rawDetail = '';
    try {
      const data = await res.json();
      if (typeof data?.detail === 'string' && data.detail.trim()) {
        rawDetail = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail[0]?.msg) {
        rawDetail = String(data.detail[0].msg);
      } else if (typeof data?.message === 'string' && data.message.trim()) {
        rawDetail = data.message;
      }
    } catch {
      // ignore non-JSON body
    }
    return localizeApiError(rawDetail || fallback, res.status, locale, t);
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

  const loadTaxonomy = useCallback(
    async (overrideToken?: string) => {
      try {
        const res = await apiFetch('/taxonomy', {}, overrideToken);
        if (res.ok) {
          const data = await res.json();
          setTaxonomy({
            departments: Array.isArray(data?.departments) ? data.departments : [],
            classifications: Array.isArray(data?.classifications) ? data.classifications : [],
          });
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
      overrideToken?: string,
      overrideScope?: ArchiveScope
    ) => {
      const activeScope = overrideScope !== undefined ? overrideScope : archiveScope;
      const activeFolder = overrideFolderId !== undefined ? overrideFolderId : selectedFolder;
      const activeQuery = overrideQuery !== undefined ? overrideQuery : query;
      const activeFilters = overrideFilters !== undefined ? overrideFilters : filters;

      setSearchBusy(true);
      try {
        const params = new URLSearchParams();
        if (activeQuery.trim()) params.set('q', activeQuery.trim());
        if (activeScope === 'starred') {
          params.set('starred_only', 'true');
        } else if (activeScope === 'recent') {
          params.set('recent_only', 'true');
        } else if (activeFolder) {
          params.set('folder_id', activeFolder);
        }
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
    [apiFetch, archiveScope, selectedFolder, query, filters]
  );

  const loadAdminData = useCallback(
    async (overrideToken?: string, overrideStepUp?: string) => {
      try {
        const activeStepUp = overrideStepUp ?? stepUpToken;
        const [usersRes, groupsRes, auditRes, summaryRes, geminiRes] = await Promise.all([
          apiFetch('/users', {}, overrideToken),
          apiFetch('/users/link-groups', {}, overrideToken),
          apiFetch('/audit?limit=100', {}, overrideToken),
          apiFetch('/admin/system-summary', {}, overrideToken),
          apiFetch('/admin/gemini-settings', {}, overrideToken),
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
        if (activeStepUp) {
          const metricsRes = await apiFetch(
            '/admin/storage/metrics',
            { headers: { 'X-Admin-Step-Up': activeStepUp } },
            overrideToken
          );
          if (metricsRes.ok) {
            const data: StorageMetrics = await metricsRes.json();
            setStorageMetrics(data);
          }
        }
      } catch {
        // ignore
      }
    },
    [apiFetch, stepUpToken]
  );

  const loadWorkspaceData = useCallback(
    async (activeToken: string, role: string) => {
      await Promise.all([
        loadFolders(activeToken),
        loadDocuments('', '', EMPTY_FILTERS, activeToken, 'all'),
        loadVisibleOwners(activeToken),
        loadTaxonomy(activeToken),
        loadTrash(activeToken),
      ]);

      if (role === 'admin') {
        await loadAdminData(activeToken);
      }
    },
    [loadFolders, loadDocuments, loadVisibleOwners, loadTaxonomy, loadTrash, loadAdminData]
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

      // Sync language/theme permanently between device and DB account
      if (freshUser.preferred_language && isSupportedLocale(freshUser.preferred_language)) {
        applyLocalPreferences(freshUser.preferred_language, freshUser.preferred_theme || null);
        setShowLanguageModal(false);
      } else {
        if (freshUser.preferred_theme) {
          applyLocalPreferences(null, freshUser.preferred_theme);
        }
        // Save the device's pre-login chosen language permanently to the user's account
        const deviceLang = readInitialLocale(initialLocale);
        if (readHasChosenLanguage() && isSupportedLocale(deviceLang)) {
          try {
            const prefRes = await apiFetch(
              '/auth/preferences',
              {
                method: 'PATCH',
                body: JSON.stringify({ preferred_language: deviceLang }),
              },
              nextToken
            );
            if (prefRes.ok) {
              freshUser = await prefRes.json();
              setUser(freshUser);
              persistSession(nextToken, freshUser);
            }
          } catch {
            // ignore silent sync failure
          }
          setShowLanguageModal(false);
        } else {
          setShowLanguageModal(true);
        }
      }

      // If mandatory password change is pending, wait until completed before loading archive workspace
      if (!freshUser.must_change_password) {
        await loadWorkspaceData(nextToken, freshUser.role);
      }
    },
    [
      apiFetch,
      persistSession,
      applyLocalPreferences,
      initialLocale,
      loadWorkspaceData,
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

  // Admin-managed standardized taxonomy lists (used as dropdowns in Upload & Edit)
  const standardizedDepartments = useMemo(
    () => taxonomy.departments.map((item) => item.name),
    [taxonomy.departments]
  );

  const standardizedCategories = useMemo(
    () => taxonomy.classifications.map((item) => item.name),
    [taxonomy.classifications]
  );

  // Merged unique departments and classifications (for Archive search filters)
  const departments = useMemo(() => {
    const set = new Set<string>(standardizedDepartments);
    if (user?.department) set.add(user.department);
    docs.forEach((d) => {
      if (d.department) set.add(d.department);
    });
    users.forEach((u) => {
      if (u.department) set.add(u.department);
    });
    return Array.from(set).sort();
  }, [standardizedDepartments, docs, users, user]);

  const categories = useMemo(() => {
    const set = new Set<string>(standardizedCategories);
    docs.forEach((d) => {
      if (d.classification) set.add(d.classification);
    });
    return Array.from(set).sort();
  }, [standardizedCategories, docs]);

  // Handlers: Auth & Preferences
  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError('');
    if (!loginUsername.trim() || !loginPassword) return;

    setLoginBusy(true);
    try {
      const formBody = new URLSearchParams();
      formBody.set('username', loginUsername.trim());
      formBody.set('password', loginPassword);

      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept-Language': locale,
        },
        body: formBody.toString(),
      });
      if (!res.ok) {
        const msg =
          res.status === 401
            ? t.invalidCredentials
            : await parseErrorDetail(res, t.invalidCredentials);
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
    const data = await res.json();
    if (user) {
      const updatedUser: User = data?.user || { ...user, must_change_password: false };
      setUser(updatedUser);
      persistSession(token, updatedUser);
    }
    pushToast('ok', t.savedSuccess);
  }

  async function handleFirstLoginPasswordChange(newPassword: string) {
    const res = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        new_password: newPassword,
      }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    if (user) {
      const updatedUser: User = data?.user || { ...user, must_change_password: false };
      setUser(updatedUser);
      persistSession(token, updatedUser);
      await loadWorkspaceData(token, updatedUser.role);
    }
    pushToast('ok', t.savedSuccess);
  }

  // Handlers: Archive Explorer
  function handleSelectFolder(folderId: string) {
    setArchiveScope('all');
    setSelectedFolder(folderId);
    loadDocuments(folderId, query, filters, undefined, 'all');
  }

  function handleSelectArchiveScope(nextScope: ArchiveScope) {
    setSection('archive');
    setMobileNavOpen(false);
    setArchiveScope(nextScope);
    setSelectedFolder('');
    loadDocuments('', query, filters, undefined, nextScope);
  }

  function handleResetSearch() {
    setQuery('');
    setFilters(EMPTY_FILTERS);
    loadDocuments(selectedFolder, '', EMPTY_FILTERS, undefined, archiveScope);
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
      const res = await apiFetch(`/documents/${doc.id}/file?inline=true`);
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
      const res = await apiFetch(`/documents/${doc.id}/file?inline=false`);
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

  async function handlePrintDoc(doc: DocItem) {
    if (!canPrint) return;
    try {
      const res = await apiFetch(`/documents/${doc.id}/file?inline=true`);
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
        return;
      }
      const blob = await res.blob();
      const mime = (doc.mime_type || blob.type || '').toLowerCase();
      const blobUrl = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const cleanup = () => {
        window.setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      };

      if (mime.startsWith('image/')) {
        const frameDoc = iframe.contentWindow?.document;
        if (!frameDoc) {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
          return;
        }
        frameDoc.open();
        frameDoc.write(`<!doctype html><html><head><title></title><style>
          @page { margin: 8mm; }
          html, body { margin: 0; padding: 0; background: #fff; text-align: center; }
          img { max-width: 100%; max-height: 98vh; object-fit: contain; display: block; margin: 0 auto; }
        </style></head><body><img id="print-img" /></body></html>`);
        frameDoc.close();
        const imgEl = frameDoc.getElementById('print-img') as HTMLImageElement | null;
        if (imgEl) {
          imgEl.onload = () => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } finally {
              cleanup();
            }
          };
          imgEl.src = blobUrl;
        } else {
          cleanup();
        }
      } else {
        iframe.onload = () => {
          window.setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } finally {
              cleanup();
            }
          }, 250);
        };
        iframe.src = blobUrl;
      }
    } catch (err: any) {
      pushToast('err', err?.message || t.errorGeneric);
    }
  }

  async function handleToggleStar(doc: DocItem) {
    const nextStarred = !Boolean(doc.is_starred);
    const prevDocs = docs;
    setDocs((curr) => {
      if (archiveScope === 'starred' && !nextStarred) {
        return curr.filter((item) => item.id !== doc.id);
      }
      return curr.map((item) =>
        item.id === doc.id ? { ...item, is_starred: nextStarred } : item
      );
    });

    try {
      const res = await apiFetch(`/documents/${doc.id}/star`, { method: 'POST' });
      if (!res.ok) {
        setDocs(prevDocs);
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
      }
    } catch (err: any) {
      setDocs(prevDocs);
      pushToast('err', err?.message || t.errorGeneric);
    }
  }

  async function handleMoveDocsToFolder(docIds: string[], targetFolderId: string | null) {
    if (!docIds.length) return;
    const res = await apiFetch('/documents/bulk/move', {
      method: 'POST',
      body: JSON.stringify({ document_ids: docIds, folder_id: targetFolderId }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await Promise.all([loadFolders(), loadDocuments()]);
    pushToast('ok', t.movedToFolderSuccess);
  }

  async function handleBulkTrashDocs(docIds: string[]) {
    if (!docIds.length) return;
    const res = await apiFetch('/documents/bulk/trash', {
      method: 'POST',
      body: JSON.stringify({ document_ids: docIds }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      pushToast('err', msg);
      throw new Error(msg);
    }
    await Promise.all([loadFolders(), loadDocuments(), loadTrash()]);
    pushToast('ok', t.savedSuccess);
  }

  async function handleBulkDownloadZip(docIds: string[]) {
    if (!docIds.length) return;
    try {
      const res = await apiFetch('/documents/bulk/download-zip', {
        method: 'POST',
        body: JSON.stringify({ document_ids: docIds }),
      });
      if (!res.ok) {
        const msg = await parseErrorDetail(res, t.errorGeneric);
        pushToast('err', msg);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archive-documents-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast('ok', t.savedSuccess);
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

  function uploadFileViaXhr(
    payload: {
      file: File;
      folderId?: string | null;
      department?: string;
      classification?: string;
      keywords?: string;
      summary?: string;
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
      xhr.open('POST', `${API}/documents`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept-Language', locale);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 401) {
          clearSession(t.sessionExpired);
          reject(new Error(t.sessionExpired));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          try {
            const doc: DocItem = JSON.parse(xhr.responseText);
            resolve(doc);
          } catch {
            reject(new Error(t.errorGeneric));
          }
        } else {
          let rawDetail = '';
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (typeof parsed?.detail === 'string') rawDetail = parsed.detail;
            else if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) {
              rawDetail = String(parsed.detail[0].msg);
            }
          } catch {
            // ignore
          }
          reject(new Error(localizeApiError(rawDetail, xhr.status, locale, t)));
        }
      };

      xhr.onerror = () => {
        health.reportConnectionFailure();
        reject(new Error(t.networkError));
      };

      xhr.send(formData);
    });
  }

  // Single document upload from dedicated UploadView
  async function handleUploadDocument(
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
    try {
      const doc = await uploadFileViaXhr(payload, onProgress);
      await Promise.all([loadFolders(), loadDocuments()]);
      pushToast('ok', t.uploadSuccess);
      return doc;
    } catch (err: any) {
      pushToast('err', err?.message || t.errorGeneric);
      throw err;
    }
  }

  // Bulk Drag & Drop Upload (1–20 files) directly inside Archive
  async function handleBulkUploadFiles(files: File[], targetFolderId: string | null) {
    if (!files.length) return;
    if (uploadTrayTimerRef.current) {
      window.clearTimeout(uploadTrayTimerRef.current);
      uploadTrayTimerRef.current = null;
    }

    let queue = files;
    if (files.length > MAX_BULK_UPLOAD_FILES) {
      pushToast('info', t.dropFilesHereDesc);
      queue = files.slice(0, MAX_BULK_UPLOAD_FILES);
    }

    const initialTasks: BulkUploadTask[] = queue.map((file, idx) => {
      const id = `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      if (file.size > MAX_UPLOAD_BYTES || !isAllowedUploadFile(file)) {
        return { id, fileName: file.name, progress: 0, status: 'error', error: t.dropzoneHint };
      }
      return { id, fileName: file.name, progress: 0, status: 'uploading' };
    });

    setBulkUploadTasks(initialTasks);

    let successCount = 0;
    let errorCount = initialTasks.filter((task) => task.status === 'error').length;

    for (let i = 0; i < queue.length; i += 1) {
      const task = initialTasks[i];
      if (task.status === 'error') continue;

      setBulkUploadTasks((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, status: 'uploading', progress: 2 } : item
        )
      );

      try {
        await uploadFileViaXhr(
          {
            file: queue[i],
            folderId: targetFolderId,
            department: user?.department || '',
          },
          (pct) => {
            setBulkUploadTasks((prev) =>
              prev.map((item) => (item.id === task.id ? { ...item, progress: pct } : item))
            );
          }
        );
        successCount += 1;
        setBulkUploadTasks((prev) =>
          prev.map((item) =>
            item.id === task.id ? { ...item, status: 'done', progress: 100 } : item
          )
        );
      } catch (err: any) {
        errorCount += 1;
        setBulkUploadTasks((prev) =>
          prev.map((item) =>
            item.id === task.id
              ? { ...item, status: 'error', error: err?.message || t.errorGeneric }
              : item
          )
        );
      }
    }

    if (successCount > 0) {
      await Promise.all([loadFolders(), loadDocuments()]);
      pushToast('ok', t.uploadSuccess);
    } else if (errorCount > 0) {
      pushToast('err', t.errorGeneric);
    }

    if (errorCount === 0) {
      uploadTrayTimerRef.current = window.setTimeout(() => {
        setBulkUploadTasks([]);
        uploadTrayTimerRef.current = null;
      }, 4500);
    }
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

  // Handlers: Admin Users, Taxonomy & Linking
  async function handleCreateUser(payload: {
    username: string;
    full_name: string;
    job_title: string;
    password: string;
    role: string;
    department: string;
    can_print?: boolean;
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
      can_print?: boolean;
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

  async function handleCreateTaxonomyItem(
    kind: 'department' | 'classification',
    name: string
  ) {
    const res = await apiFetch('/taxonomy', {
      method: 'POST',
      body: JSON.stringify({ kind, name }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await loadTaxonomy();
    pushToast('ok', t.savedSuccess);
  }

  async function handleDeleteTaxonomyItem(itemId: string) {
    const res = await apiFetch(`/taxonomy/${itemId}`, { method: 'DELETE' });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    await loadTaxonomy();
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
    return { message: localizeServerMessage(data?.message, true, locale, t) };
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
    const ok = Boolean(data?.ok);
    return { ok, message: localizeServerMessage(data?.message, ok, locale, t) };
  }

  async function handleUnlockStorage(masterPassword: string) {
    const res = await apiFetch('/auth/admin/master-challenge', {
      method: 'POST',
      body: JSON.stringify({ password: masterPassword }),
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    const nextStepUp = data?.step_up_token || '';
    setStepUpToken(nextStepUp);
    if (nextStepUp) {
      await loadAdminData(token, nextStepUp);
    }
    pushToast('ok', t.savedSuccess);
  }

  async function handleSaveProvider() {
    const res = await apiFetch('/admin/storage', {
      method: 'PUT',
      headers: stepUpToken ? { 'X-Admin-Step-Up': stepUpToken } : {},
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
    const res = await apiFetch('/admin/storage/test', {
      method: 'POST',
      headers: stepUpToken ? { 'X-Admin-Step-Up': stepUpToken } : {},
    });
    if (!res.ok) {
      const msg = await parseErrorDetail(res, t.errorGeneric);
      throw new Error(msg);
    }
    const data = await res.json();
    return localizeServerMessage(data?.message, true, locale, t);
  }

  async function handleCreateBackup() {
    const res = await apiFetch('/admin/backup/create', {
      method: 'POST',
      headers: stepUpToken ? { 'X-Admin-Step-Up': stepUpToken } : {},
    });
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
      message: localizeServerMessage(data?.message, true, locale, t),
    };
  }

  function handleNavigate(target: SectionKey) {
    setSection(target);
    setMobileNavOpen(false);
    if (target === 'trash') {
      loadTrash();
    } else if (target === 'settings' && user?.role === 'admin') {
      loadAdminData();
      loadTaxonomy();
    } else if (target === 'archive') {
      setArchiveScope('all');
      loadFolders();
      loadDocuments(selectedFolder, query, filters, undefined, 'all');
    } else if (target === 'upload') {
      loadTaxonomy();
    }
  }

  if (!hydrated) {
    return (
      <main
        aria-busy="true"
        className="min-h-[100svh] bg-[#F1F5F9] dark:bg-[#0A1626] flex items-center justify-center"
      >
        <div className="w-8 h-8 rounded-full border-2 border-[#0E7490] border-t-transparent animate-spin" />
      </main>
    );
  }

  // =========================================================================
  // PRE-LOGIN FIRST-VISIT LANGUAGE SELECTION SCREEN (Shown ONCE before Login)
  // =========================================================================
  if (!user && !languageChosen) {
    return (
      <>
        <LanguageSelectionModal
          variant="page"
          currentLocale={locale}
          onSelect={(selectedLocale) => {
            applyLocalPreferences(selectedLocale, null);
          }}
        />
        <SystemStatusOverlay
          status={health.status}
          reason={health.reason}
          checking={health.checking}
          t={t}
          dir={dir}
          onRetry={health.retry}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // =========================================================================
  // EXECUTIVE LOGIN PORTAL
  // =========================================================================
  if (!user || !token) {
    return (
      <div
        dir={dir}
        className="min-h-[100svh] auth-canvas flex flex-col items-center justify-center p-4 sm:p-6 transition-colors"
      >
        <main className="card-elevated w-full max-w-4xl overflow-hidden grid lg:grid-cols-2">
          <section className="vault-showcase p-7 sm:p-10 text-white flex flex-col justify-between">
            <div className="flex items-center gap-3">
              <BrandMark size={48} />
              <div>
                <p dir="ltr" className="text-[10px] tracking-[0.2em] font-bold text-cyan-200">ARCHIVE · YEMANY</p>
                <h2 className="mt-1 text-lg font-bold">{t.appName}</h2>
              </div>
            </div>
            <div aria-hidden="true" className="hidden lg:flex justify-center py-12">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-9 shadow-executive">
                <AppIcon name="archive" size={90} className="text-cyan-200" />
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-slate-300">
              <AppIcon name="folder" size={17} /><span>{t.navArchive}</span>
              <span className="h-1 w-1 rounded-full bg-cyan-300" />
              <AppIcon name="search" size={17} /><span>{t.appShort}</span>
            </div>
          </section>
          <div className="bg-white dark:bg-[#0F2137] p-7 sm:p-10">
            <div className="flex justify-end gap-2 mb-7">
              <button type="button" onClick={() => setPreLoginLangOpen(true)} className="btn btn-secondary text-xs gap-2">
                <AppIcon name="globe" size={15} />
                {LANGUAGES.find((language) => language.code === locale)?.nativeName}
              </button>
              <button type="button" onClick={() => applyLocalPreferences(null, theme === 'dark' ? 'light' : 'dark')}
                className="btn btn-secondary" aria-label={t.appearanceLabel} title={theme === 'dark' ? t.themeLight : t.themeDark}>
                <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center mb-7">
              <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                {t.signInTitle}
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
                <div className="relative">
                <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400"><AppIcon name="user" size={16} /></span>
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder={t.usernamePlaceholder}
                  className="field field-icon-start"
                />
                </div>
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
                  startIcon={<AppIcon name="lock" size={16} />}
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
            <div className="mt-7 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <SystemStatusPill status={health.status} t={t} onClick={health.retry} />
              <PWAInstallButton label={t.installApp} closeLabel={t.close} dir={dir} />
            </div>
          </div>
        </main>
        {preLoginLangOpen && <LanguageSelectionModal variant="modal" currentLocale={locale} onSelect={(selectedLocale) => {
          applyLocalPreferences(selectedLocale, null);
          setPreLoginLangOpen(false);
        }} />}

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
  // MANDATORY FIRST-LOGIN PASSWORD REPLACEMENT GATE (Un-bypassable)
  // =========================================================================
  if (user.must_change_password) {
    return (
      <>
        <FirstLoginPasswordModal
          user={user}
          t={t}
          dir={dir}
          onSubmit={handleFirstLoginPasswordChange}
          onLogout={() => clearSession()}
        />
        <SystemStatusOverlay
          status={health.status}
          reason={health.reason}
          checking={health.checking}
          t={t}
          dir={dir}
          onRetry={health.retry}
        />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
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
      ? archiveScope === 'recent'
        ? t.navRecent
        : archiveScope === 'starred'
        ? t.navStarred
        : t.navArchive
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

  const handleSidebarFolderDragOver = (
    e: React.DragEvent,
    dropId: string
  ) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes(DRAG_DOC_IDS_MIME) || types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'move';
      if (sidebarDragOverId !== dropId) {
        setSidebarDragOverId(dropId);
      }
    }
  };

  const handleSidebarFolderDrop = (
    e: React.DragEvent,
    targetFolderId: string | null
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setSidebarDragOverId(null);

    const rawDocIds = e.dataTransfer.getData(DRAG_DOC_IDS_MIME);
    if (rawDocIds) {
      try {
        const ids = JSON.parse(rawDocIds);
        if (Array.isArray(ids) && ids.length > 0) {
          void handleMoveDocsToFolder(ids, targetFolderId);
          return;
        }
      } catch {
        // ignore invalid payload
      }
    }

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      setSection('archive');
      void handleBulkUploadFiles(droppedFiles, targetFolderId);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full sidebar-navy text-slate-200 select-none">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between gap-2.5 border-b border-white/10 shrink-0">
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

      {(user.role === 'admin' || user.role === 'archiver') && (
        <div className="px-3 pt-4">
          <button type="button" onClick={() => handleNavigate('upload')} className="btn btn-primary w-full gap-2">
            <AppIcon name="upload" size={16} />{t.navUpload}
          </button>
        </div>
      )}

      {/* Navigation Links + Shortcuts + Quick Collapsible Folder Tree */}
      <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        <div className="space-y-1">
          {navItems.map((item) => {
            const active =
              item.key === 'archive'
                ? section === 'archive' && archiveScope === 'all'
                : section === item.key;
            return (
              <React.Fragment key={item.key}>
                <button
                  type="button"
                  onClick={() => handleNavigate(item.key)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-[#0E7490]/30 text-white font-semibold ring-1 ring-[#0891B2]/40'
                      : 'text-slate-300 font-medium hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className={active ? 'text-[#22D3EE]' : 'text-slate-400'}>
                      <AppIcon name={item.icon} size={18} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      dir="ltr"
                      className={`min-w-[22px] h-5 px-1.5 rounded-md text-[11px] font-semibold inline-flex items-center justify-center tabular-nums ${
                        active
                          ? 'bg-[#0891B2] text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>

                {item.key === 'archive' && (
                  <div className="ps-3 space-y-0.5 pt-0.5 pb-1">
                    <button
                      type="button"
                      onClick={() => handleSelectArchiveScope('recent')}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                        section === 'archive' && archiveScope === 'recent'
                          ? 'bg-[#0E7490]/30 text-white font-semibold ring-1 ring-[#0891B2]/40'
                          : 'text-slate-400 font-medium hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <AppIcon
                        name="clock"
                        size={15}
                        className={
                          section === 'archive' && archiveScope === 'recent'
                            ? 'text-[#22D3EE] shrink-0'
                            : 'text-slate-500 shrink-0'
                        }
                      />
                      <span className="truncate">{t.navRecent}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectArchiveScope('starred')}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-colors ${
                        section === 'archive' && archiveScope === 'starred'
                          ? 'bg-[#0E7490]/30 text-white font-semibold ring-1 ring-[#0891B2]/40'
                          : 'text-slate-400 font-medium hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <AppIcon
                        name="star"
                        size={15}
                        className={
                          section === 'archive' && archiveScope === 'starred'
                            ? 'text-amber-400 shrink-0'
                            : 'text-slate-500 shrink-0'
                        }
                      />
                      <span className="truncate">{t.navStarred}</span>
                    </button>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Collapsible Quick Folder Tree (supports Drag-to-Folder & Drag-to-Upload) */}
        <div className="pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setFolderTreeOpen((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span className="truncate">{t.quickFolders}</span>
            <AppIcon
              name={folderTreeOpen ? 'chevronDown' : dir === 'rtl' ? 'chevronLeft' : 'chevronRight'}
              size={14}
            />
          </button>

          {folderTreeOpen && (
            <div className="mt-1.5 space-y-0.5">
              {/* All Files / Root entry */}
              <button
                type="button"
                onClick={() => {
                  setSection('archive');
                  setMobileNavOpen(false);
                  handleSelectFolder('');
                }}
                onDragOver={(e) => handleSidebarFolderDragOver(e, '__root__')}
                onDragLeave={() => {
                  if (sidebarDragOverId === '__root__') setSidebarDragOverId(null);
                }}
                onDrop={(e) => handleSidebarFolderDrop(e, null)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                  sidebarDragOverId === '__root__'
                    ? 'bg-[#0E7490]/30 text-white ring-2 ring-[#22D3EE] font-semibold'
                    : section === 'archive' && archiveScope === 'all' && !selectedFolder
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <AppIcon
                    name="archive"
                    size={14}
                    className={
                      section === 'archive' && archiveScope === 'all' && !selectedFolder
                        ? 'text-[#22D3EE] shrink-0'
                        : 'text-slate-500 shrink-0'
                    }
                  />
                  <span className="truncate">{t.allFiles}</span>
                </span>
              </button>

              {/* Recursive Folder Nodes */}
              {(() => {
                const byParent = new Map<string, FolderItem[]>();
                folders.forEach((f) => {
                  const key = f.parent_id || '__root__';
                  const list = byParent.get(key) || [];
                  list.push(f);
                  byParent.set(key, list);
                });

                const renderBranch = (parentKey: string, depth: number): React.ReactNode => {
                  const items = byParent.get(parentKey) || [];
                  return items.map((folder) => {
                    const children = byParent.get(folder.id) || [];
                    const hasChildren = children.length > 0;
                    const isExpanded = Boolean(expandedFolderIds[folder.id]);
                    const isSelected =
                      section === 'archive' &&
                      archiveScope === 'all' &&
                      selectedFolder === folder.id;
                    const isDragTarget = sidebarDragOverId === folder.id;

                    return (
                      <div key={folder.id}>
                        <div
                          style={{ paddingInlineStart: `${depth * 14}px` }}
                          onDragOver={(e) => handleSidebarFolderDragOver(e, folder.id)}
                          onDragLeave={() => {
                            if (sidebarDragOverId === folder.id) setSidebarDragOverId(null);
                          }}
                          onDrop={(e) => handleSidebarFolderDrop(e, folder.id)}
                          className={`group flex items-center gap-1 rounded-lg pe-2 py-1 text-xs transition-colors ${
                            isDragTarget
                              ? 'bg-[#0E7490]/30 text-white ring-2 ring-[#22D3EE] font-semibold'
                              : isSelected
                              ? 'bg-slate-800 text-white font-semibold'
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedFolderIds((prev) => ({
                                  ...prev,
                                  [folder.id]: !prev[folder.id],
                                }));
                              }}
                              aria-label="Toggle folder"
                              className="p-1 rounded text-slate-500 hover:text-slate-200 shrink-0"
                            >
                              <AppIcon
                                name={
                                  isExpanded
                                    ? 'chevronDown'
                                    : dir === 'rtl'
                                    ? 'chevronLeft'
                                    : 'chevronRight'
                                }
                                size={12}
                              />
                            </button>
                          ) : (
                            <span className="w-5 shrink-0" />
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSection('archive');
                              setMobileNavOpen(false);
                              handleSelectFolder(folder.id);
                              if (hasChildren && !isExpanded) {
                                setExpandedFolderIds((prev) => ({ ...prev, [folder.id]: true }));
                              }
                            }}
                            className="flex-1 min-w-0 flex items-center justify-between gap-2 py-0.5 text-start"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <AppIcon
                                name={isSelected || isExpanded ? 'folderOpen' : 'folder'}
                                size={14}
                                className={
                                  isSelected
                                    ? 'text-[#22D3EE] shrink-0'
                                    : 'text-amber-400/80 shrink-0'
                                }
                              />
                              <span className="truncate">{folder.name}</span>
                            </span>
                            {typeof folder.item_count === 'number' && folder.item_count > 0 && (
                              <span
                                dir="ltr"
                                className="text-[10px] text-slate-500 group-hover:text-slate-300 tabular-nums shrink-0"
                              >
                                {folder.item_count}
                              </span>
                            )}
                          </button>
                        </div>

                        {hasChildren && isExpanded && (
                          <div className="mt-0.5 space-y-0.5">
                            {renderBranch(folder.id, Math.min(depth + 1, 4))}
                          </div>
                        )}
                      </div>
                    );
                  });
                };

                return renderBranch('__root__', 0);
              })()}
            </div>
          )}
        </div>
      </nav>

      {/* Sidebar Footer: User Profile Card + Install + Logout */}
      <div className="p-3 border-t border-white/10 space-y-2.5 shrink-0">
        <div className="flex items-center gap-3 rounded-lg bg-white/[0.05] border border-white/10 px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg bg-[#0E7490]/25 border border-[#0891B2]/30 text-cyan-200 font-bold text-sm grid place-items-center shrink-0">
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
      className="min-h-[100svh] bg-[#F1F5F9] dark:bg-[#0A1626] text-slate-900 dark:text-slate-100 flex transition-colors"
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 shrink-0 sticky top-0 h-[100svh] border-e border-white/10 z-30">
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
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-[#0F2137]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Menu"
            >
              <AppIcon name="menu" size={18} />
            </button>
            <span className="hidden sm:grid w-9 h-9 rounded-xl bg-brand-50 dark:bg-[#132942] text-brand-600 dark:text-brand-400 place-items-center">
              <AppIcon name={section === 'archive' ? 'archive' : section === 'upload' ? 'upload' : section === 'trash' ? 'trash' : 'settings'} size={17} />
            </span>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button type="button" className="btn btn-secondary p-2" title={t.retry} aria-label={t.retry}
              onClick={() => {
                if (section === 'archive') {
                  void loadFolders();
                  void loadDocuments(selectedFolder, query, filters, undefined, archiveScope);
                } else if (section === 'trash') void loadTrash();
                else if (section === 'settings' && user.role === 'admin') void loadAdminData();
                else { void loadFolders(); void loadTaxonomy(); }
              }}>
              <AppIcon name="refresh" size={16} className={searchBusy ? 'animate-spin' : ''} />
            </button>
            <button type="button" className="btn btn-secondary p-2" title={theme === 'dark' ? t.themeLight : t.themeDark} aria-label={t.appearanceLabel}
              onClick={() => { void handleUpdatePreferences({ preferred_theme: theme === 'dark' ? 'light' : 'dark' }).catch(() => {}); }}>
              <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <SystemStatusPill status={health.status} t={t} onClick={health.retry} />
          </div>
        </header>

        {/* Active Workspace View */}
        <main className="flex-1 p-4 sm:p-5 lg:p-6">
          {section === 'archive' && (
            <ArchiveView
              user={user}
              token={token}
              canPrint={canPrint}
              archiveScope={archiveScope}
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
              bulkUploadTasks={bulkUploadTasks}
              t={t}
              dir={dir}
              onQueryChange={setQuery}
              onFiltersChange={setFilters}
              onSelectFolder={handleSelectFolder}
              onSearch={(fId, q, f) => loadDocuments(fId, q, f, undefined, archiveScope)}
              onResetSearch={handleResetSearch}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleSoftDeleteFolder}
              onPreviewDoc={handlePreviewDoc}
              onPrintDoc={handlePrintDoc}
              onToggleStar={handleToggleStar}
              onEditDoc={(doc) => setEditingDoc(doc)}
              onDownloadDoc={handleDownloadDoc}
              onDeleteDoc={handleSoftDeleteDoc}
              onMoveDocsToFolder={handleMoveDocsToFolder}
              onBulkTrashDocs={handleBulkTrashDocs}
              onBulkDownloadZip={handleBulkDownloadZip}
              onBulkUploadFiles={handleBulkUploadFiles}
              onDismissUploadTray={() => setBulkUploadTasks([])}
              onGoUpload={() => handleNavigate('upload')}
            />
          )}

          {section === 'upload' && (
            <UploadView
              user={user}
              folders={folders}
              departments={standardizedDepartments}
              categories={standardizedCategories}
              defaultFolderId={selectedFolder}
              t={t}
              onUpload={handleUploadDocument}
              onGoArchive={(folderId) => {
                setArchiveScope('all');
                if (folderId !== undefined) {
                  setSelectedFolder(folderId);
                  loadDocuments(folderId, query, filters, undefined, 'all');
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
              taxonomy={taxonomy}
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
              onCreateTaxonomyItem={handleCreateTaxonomyItem}
              onDeleteTaxonomyItem={handleDeleteTaxonomyItem}
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
                await Promise.all([
                  loadAdminData(),
                  loadFolders(),
                  loadVisibleOwners(),
                  loadTaxonomy(),
                  loadTrash(),
                ]);
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
          canPrint={canPrint}
          onDownload={() => handleDownloadDoc({ id: previewDoc.id, file_name: previewDoc.file_name })}
          onClose={handleClosePreview}
        />
      )}

      {/* Edit & Move Document Modal */}
      {editingDoc && (
        <EditDocumentModal
          doc={editingDoc}
          folders={folders}
          departments={standardizedDepartments}
          categories={standardizedCategories}
          t={t}
          dir={dir}
          onSave={handleSaveDocEdit}
          onClose={() => setEditingDoc(null)}
        />
      )}

      {/* Post-login Language Selection Fallback (only if logged in from a fresh browser with no account language) */}
      {showLanguageModal && (
        <LanguageSelectionModal
          variant="modal"
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
