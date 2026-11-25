import type { LocaleCode } from '../components/types';

export type LanguageMeta = {
  code: LocaleCode;
  nativeName: string;
  englishName: string;
  dir: 'rtl' | 'ltr';
};

export const LANGUAGES: LanguageMeta[] = [
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', dir: 'ltr' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  { code: 'zh', nativeName: '中文', englishName: 'Chinese', dir: 'ltr' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr' },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', dir: 'rtl' },
];

export const RTL_LOCALES: Set<LocaleCode> = new Set<LocaleCode>(['ar', 'ur']);

export function getDirection(locale: LocaleCode): 'rtl' | 'ltr' {
  return RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
}

export function isSupportedLocale(val?: string | null): val is LocaleCode {
  if (!val) return false;
  return LANGUAGES.some((l) => l.code === val);
}

export type TranslationKeys = {
  appName: string;
  appShort: string;
  // Navigation
  navArchive: string;
  navUpload: string;
  navTrash: string;
  navSettings: string;
  logout: string;
  // Status
  statusOnline: string;
  statusReconnecting: string;
  statusOffline: string;
  offlineTitle: string;
  serverUnavailableTitle: string;
  offlineMessage: string;
  serverUnavailableMessage: string;
  retry: string;
  // Login (clean, zero marketing jargon)
  signInTitle: string;
  usernameLabel: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  signInButton: string;
  signingIn: string;
  invalidCredentials: string;
  showPassword: string;
  hidePassword: string;
  // Language selection modal
  chooseLanguageTitle: string;
  chooseLanguageSubtitle: string;
  saveAndContinue: string;
  // Archive toolbar & explorer
  searchPlaceholder: string;
  searchButton: string;
  searching: string;
  filters: string;
  clear: string;
  newFolder: string;
  uploadDocument: string;
  rootHome: string;
  foldersTitle: string;
  filesTitle: string;
  itemsCount: string;
  subfoldersCount: string;
  lastModified: string;
  ownerLabel: string;
  allEmployees: string;
  allDepartments: string;
  allFileTypes: string;
  allClassifications: string;
  departmentLabel: string;
  fileTypeLabel: string;
  classificationLabel: string;
  keywordLabel: string;
  keywordPlaceholder: string;
  fromDate: string;
  toDate: string;
  gridView: string;
  listView: string;
  exportExcel: string;
  exportPdf: string;
  emptyArchiveTitle: string;
  emptyArchiveDesc: string;
  emptySearchDesc: string;
  folderNamePlaceholder: string;
  createFolderInside: string;
  saveFolder: string;
  creating: string;
  cancel: string;
  // File actions & statuses
  preview: string;
  download: string;
  print: string;
  edit: string;
  moveToTrash: string;
  close: string;
  statusIndexed: string;
  statusProcessing: string;
  statusFailed: string;
  statusPending: string;
  // Modals: Delete & Edit
  confirmTrashDocTitle: string;
  confirmTrashDocDesc: string;
  confirmTrashFolderTitle: string;
  confirmTrashFolderDesc: string;
  moveToTrashConfirm: string;
  movingToTrash: string;
  editDocTitle: string;
  fileNameLabel: string;
  targetFolderLabel: string;
  noFolderRoot: string;
  notesSummaryLabel: string;
  keywordsCommaLabel: string;
  saveChanges: string;
  saving: string;
  // Document preview modal
  extractedText: string;
  askDocument: string;
  secureShare: string;
  copyText: string;
  copied: string;
  noExtractedText: string;
  askPlaceholder: string;
  send: string;
  linkPassword: string;
  linkExpiry: string;
  createLink: string;
  hours: string;
  days: string;
  copyLink: string;
  shareHelp: string;
  // Upload page
  uploadPageTitle: string;
  backToArchive: string;
  fileOrImageLabel: string;
  dropzoneTitle: string;
  dropzoneHint: string;
  removeFile: string;
  uploadSubmit: string;
  uploadingProgress: string;
  uploadSuccess: string;
  openInArchive: string;
  uploadAnother: string;
  viewerNoUploadTitle: string;
  viewerNoUploadDesc: string;
  optional: string;
  // Trash / Recycle Bin
  trashTitle: string;
  trashSubtitleEmployee: string;
  trashSubtitleAdmin: string;
  trashEmptyTitle: string;
  trashEmptyDesc: string;
  deletedOn: string;
  deletedBy: string;
  restore: string;
  restoring: string;
  permanentDelete: string;
  emptyTrash: string;
  confirmPermanentTitle: string;
  confirmPermanentDesc: string;
  confirmEmptyTrashTitle: string;
  confirmEmptyTrashDesc: string;
  deletePermanently: string;
  deleting: string;
  // Settings
  settingsTitle: string;
  tabAccount: string;
  tabAdmin: string;
  profileDetails: string;
  fullNameLabel: string;
  jobTitleLabel: string;
  roleLabel: string;
  accountStatusLabel: string;
  statusActive: string;
  statusInactive: string;
  preferencesTitle: string;
  languageLabel: string;
  appearanceLabel: string;
  themeLight: string;
  themeDark: string;
  changePasswordTitle: string;
  passwordPolicyHint: string;
  currentPasswordLabel: string;
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  updatePasswordButton: string;
  // First login password modal
  firstLoginTitle: string;
  firstLoginDesc: string;
  tempPasswordLabel: string;
  savePasswordContinue: string;
  // Admin subtabs
  adminUsers: string;
  adminLinking: string;
  adminGemini: string;
  adminStorage: string;
  adminTaxonomy: string;
  adminReindex: string;
  adminAudit: string;
  // Admin Users
  createUserTitle: string;
  createUserButton: string;
  usersListTitle: string;
  tempPasswordHint: string;
  fullNamePlaceholder: string;
  jobTitlePlaceholder: string;
  departmentPlaceholder: string;
  roleAdmin: string;
  roleArchiver: string;
  roleViewer: string;
  deactivate: string;
  activate: string;
  editUserTitle: string;
  resetPasswordOptional: string;
  pendingPwChange: string;
  // Admin Employee Linking
  linkingTitle: string;
  linkingDesc: string;
  createGroupTitle: string;
  editGroupTitle: string;
  groupNameLabel: string;
  groupNamePlaceholder: string;
  selectEmployeesLabel: string;
  selectMinTwoHint: string;
  selectedCount: string;
  createLinkButton: string;
  updateLinkButton: string;
  unlinkButton: string;
  existingGroupsTitle: string;
  noLinkGroups: string;
  searchEmployeesPlaceholder: string;
  // Admin Gemini (Admin only)
  geminiTitle: string;
  geminiDesc: string;
  geminiActiveDb: string;
  geminiActiveFallback: string;
  geminiInactive: string;
  geminiSavedKey: string;
  geminiRemoveKey: string;
  geminiKeyLabel: string;
  geminiKeyUpdateLabel: string;
  geminiEnableLabel: string;
  geminiEnableHint: string;
  saveSettings: string;
  testConnection: string;
  testing: string;
  // Admin Storage / Taxonomy / Reindex / Audit
  storedDocs: string;
  storedSize: string;
  freeSpace: string;
  storageType: string;
  storageLocal: string;
  storageCloud: string;
  diskUsage: string;
  advancedStorageTitle: string;
  masterPasswordLabel: string;
  unlockAdvanced: string;
  backupTitle: string;
  backupDesc: string;
  downloadBackup: string;
  manageFoldersTitle: string;
  addFolder: string;
  activeDepartments: string;
  activeClassifications: string;
  reindexTitle: string;
  reindexDesc: string;
  reindexPending: string;
  reindexAll: string;
  indexedDocsLabel: string;
  pendingDocsLabel: string;
  auditTitle: string;
  auditAction: string;
  auditResource: string;
  auditTime: string;
  noAuditEvents: string;
  // Common notifications
  savedSuccess: string;
  errorGeneric: string;
  passwordMismatch: string;
  passwordPolicyError: string;
  sessionExpired: string;
  networkError: string;
  installApp: string;
  // 3-Pane Workspace & Live Inspector
  quickFolders: string;
  allFiles: string;
  statDocuments: string;
  statFolders: string;
  statLinkedEmployees: string;
  inspectorTitle: string;
  inspectorEmptyTitle: string;
  inspectorEmptyDesc: string;
  openFullPreviewPrint: string;
  matchedExcerpt: string;
  uploadedByLabel: string;
  dateLabel: string;
  sizeLabel: string;
  folderPathLabel: string;
  statusLabel: string;
  deleteAction: string;
  loadingPreview: string;
  previewUnavailable: string;
  openFullPreview: string;
  // Print permissions (Admin-controlled)
  printPermissionLabel: string;
  printAllowed: string;
  printRestricted: string;
  printAdminAlways: string;
  // Recent & Starred shortcuts
  navRecent: string;
  navStarred: string;
  addToStarred: string;
  removeFromStarred: string;
  // Bulk Drag & Drop Upload + Multi-Select Bulk Actions + Drag-to-Folder
  dropFilesHereTitle: string;
  dropFilesHereDesc: string;
  uploadingFilesTitle: string;
  bulkSelectedLabel: string;
  bulkMoveToFolder: string;
  bulkDownloadZip: string;
  bulkDeleteSelected: string;
  bulkClearSelection: string;
  bulkMoveModalTitle: string;
  bulkMoveConfirm: string;
  bulkTrashModalTitle: string;
  bulkTrashModalDesc: string;
  movedToFolderSuccess: string;
  dropOntoFolderHint: string;
  selectAllFiles: string;
  // Standardized Taxonomy Management
  manageDepartmentsTitle: string;
  manageClassificationsTitle: string;
  addDepartmentPlaceholder: string;
  addClassificationPlaceholder: string;
  addItemButton: string;
  selectDepartmentPlaceholder: string;
  selectClassificationPlaceholder: string;
  noTaxonomyItems: string;
};

const ar: TranslationKeys = {
  appName: 'Archive YemanY',
  appShort: 'Archive YemanY',
  navArchive: 'الأرشيف',
  navUpload: 'رفع مستند',
  navTrash: 'سلة المحذوفات',
  navSettings: 'الإعدادات',
  logout: 'تسجيل الخروج',
  statusOnline: 'النظام نشط',
  statusReconnecting: 'جاري إعادة الاتصال...',
  statusOffline: 'انقطاع الاتصال',
  offlineTitle: 'لا يوجد اتصال بالإنترنت',
  serverUnavailableTitle: 'الخدمة غير متاحة حالياً',
  offlineMessage: 'يرجى التحقق من اتصالك بالشبكة ثم إعادة المحاولة.',
  serverUnavailableMessage: 'تعذر الوصول إلى خادم النظام حالياً. يرجى المحاولة بعد قليل.',
  retry: 'إعادة المحاولة',
  signInTitle: 'تسجيل الدخول',
  usernameLabel: 'اسم المستخدم',
  usernamePlaceholder: 'أدخل اسم المستخدم',
  passwordLabel: 'كلمة المرور',
  passwordPlaceholder: 'أدخل كلمة المرور',
  signInButton: 'تسجيل الدخول',
  signingIn: 'جاري التحقق...',
  invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  showPassword: 'إظهار كلمة المرور',
  hidePassword: 'إخفاء كلمة المرور',
  chooseLanguageTitle: 'اختر لغتك المفضلة',
  chooseLanguageSubtitle: 'اختر لغة الواجهة المناسبة لك. سيتم حفظ اختيارك تلقائياً ويمكنك تغييره لاحقاً من الإعدادات.',
  saveAndContinue: 'حفظ والمتابعة',
  searchPlaceholder: 'ابحث باسم الملف أو بأي نص عربي أو إنجليزي داخل الصور والمستندات...',
  searchButton: 'بحث',
  searching: 'جاري البحث...',
  filters: 'فلاتر',
  clear: 'مسح',
  newFolder: 'مجلد جديد',
  uploadDocument: 'رفع مستند',
  rootHome: 'الرئيسية',
  foldersTitle: 'المجلدات',
  filesTitle: 'الملفات',
  itemsCount: 'عنصر',
  subfoldersCount: 'فرعي',
  lastModified: 'آخر تعديل',
  ownerLabel: 'الموظف',
  allEmployees: 'جميع الموظفين',
  allDepartments: 'جميع الأقسام',
  allFileTypes: 'جميع الأنواع',
  allClassifications: 'جميع التصنيفات',
  departmentLabel: 'القسم',
  fileTypeLabel: 'نوع الملف',
  classificationLabel: 'التصنيف',
  keywordLabel: 'كلمة مفتاحية',
  keywordPlaceholder: 'فاتورة، عقد، خطاب...',
  fromDate: 'من تاريخ',
  toDate: 'إلى تاريخ',
  gridView: 'شبكة',
  listView: 'قائمة',
  exportExcel: 'Excel',
  exportPdf: 'PDF',
  emptyArchiveTitle: 'لا توجد ملفات مطابقة',
  emptyArchiveDesc: 'هذا المجلد فارغ حالياً. يمكنك إنشاء مجلد جديد أو رفع مستند.',
  emptySearchDesc: 'جرّب تعديل كلمات البحث أو مسح الفلاتر.',
  folderNamePlaceholder: 'أدخل اسم المجلد الجديد...',
  createFolderInside: 'مجلد جديد داخل',
  saveFolder: 'حفظ',
  creating: 'جاري الإنشاء...',
  cancel: 'إلغاء',
  preview: 'معاينة',
  download: 'تحميل',
  print: 'طباعة',
  edit: 'تعديل ونقل',
  moveToTrash: 'نقل للسلة',
  close: 'إغلاق',
  statusIndexed: 'مفهرس',
  statusProcessing: 'قيد المعالجة',
  statusFailed: 'تعذرت الفهرسة',
  statusPending: 'بانتظار الفهرسة',
  confirmTrashDocTitle: 'نقل الملف إلى سلة المحذوفات',
  confirmTrashDocDesc: 'يمكنك استعادة هذا الملف لاحقاً من سلة المحذوفات.',
  confirmTrashFolderTitle: 'نقل المجلد إلى سلة المحذوفات',
  confirmTrashFolderDesc: 'سيتم نقل المجلد وكافة محتوياته إلى سلة المحذوفات، ويمكن استعادتها لاحقاً.',
  moveToTrashConfirm: 'نقل إلى السلة',
  movingToTrash: 'جاري النقل...',
  editDocTitle: 'تعديل بيانات المستند ونقله',
  fileNameLabel: 'اسم المستند',
  targetFolderLabel: 'المجلد',
  noFolderRoot: 'الرئيسية (بدون مجلد)',
  notesSummaryLabel: 'الملاحظات / الملخص',
  keywordsCommaLabel: 'كلمات مفتاحية (مفصولة بفاصلة)',
  saveChanges: 'حفظ التغييرات',
  saving: 'جاري الحفظ...',
  extractedText: 'النص المستخرج',
  askDocument: 'اسأل المستند',
  secureShare: 'مشاركة آمنة',
  copyText: 'نسخ النص',
  copied: 'تم النسخ',
  noExtractedText: 'لا يوجد نص مستخرج لهذا المستند بعد.',
  askPlaceholder: 'اكتب سؤالك حول محتوى المستند...',
  send: 'إرسال',
  linkPassword: 'كلمة مرور الرابط',
  linkExpiry: 'مدة الصلاحية',
  createLink: 'إنشاء رابط مشاركة',
  hours: 'ساعة',
  days: 'يوم',
  copyLink: 'نسخ الرابط',
  shareHelp: 'شارك الرابط وكلمة المرور عبر قناتين منفصلتين.',
  uploadPageTitle: 'رفع مستند جديد',
  backToArchive: 'العودة إلى الأرشيف',
  fileOrImageLabel: 'الملف أو الصورة',
  dropzoneTitle: 'اسحب الملف وأفلته هنا، أو اضغط للاختيار',
  dropzoneHint: 'PDF, JPG, PNG, WEBP, TIFF · بحد أقصى 40 MB',
  removeFile: 'إزالة الملف',
  uploadSubmit: 'رفع المستند',
  uploadingProgress: 'جاري الرفع...',
  uploadSuccess: 'تم رفع المستند بنجاح',
  openInArchive: 'عرض في الأرشيف',
  uploadAnother: 'رفع ملف آخر',
  viewerNoUploadTitle: 'صلاحية عرض فقط',
  viewerNoUploadDesc: 'حسابك مخصص للعرض فقط ولا يمكنه رفع مستندات جديدة.',
  optional: 'اختياري',
  trashTitle: 'سلة المحذوفات',
  trashSubtitleEmployee: 'يمكنك استعادة الملفات والمجلدات التي قمت بحذفها إلى مكانها الأصلي.',
  trashSubtitleAdmin: 'جميع العناصر المحذوفة في النظام. يمكنك استعادتها أو حذفها نهائياً.',
  trashEmptyTitle: 'سلة المحذوفات فارغة',
  trashEmptyDesc: 'لا توجد ملفات أو مجلدات محذوفة حالياً.',
  deletedOn: 'تاريخ الحذف',
  deletedBy: 'حُذف بواسطة',
  restore: 'استعادة',
  restoring: 'جاري الاستعادة...',
  permanentDelete: 'حذف نهائي',
  emptyTrash: 'إفراغ السلة',
  confirmPermanentTitle: 'تأكيد الحذف النهائي',
  confirmPermanentDesc: 'سيتم حذف هذا العنصر نهائياً من النظام ولا يمكن استعادته أبداً.',
  confirmEmptyTrashTitle: 'إفراغ سلة المحذوفات بالكامل',
  confirmEmptyTrashDesc: 'سيتم حذف جميع الملفات والمجلدات الموجودة في سلة المحذوفات نهائياً دون إمكانية الاستعادة.',
  deletePermanently: 'حذف نهائي',
  deleting: 'جاري الحذف...',
  settingsTitle: 'الإعدادات',
  tabAccount: 'الحساب والتفضيلات',
  tabAdmin: 'إدارة النظام',
  profileDetails: 'بيانات الحساب',
  fullNameLabel: 'الاسم الكامل',
  jobTitleLabel: 'المسمى الوظيفي',
  roleLabel: 'الصلاحية',
  accountStatusLabel: 'حالة الحساب',
  statusActive: 'نشط',
  statusInactive: 'موقوف',
  preferencesTitle: 'اللغة والمظهر',
  languageLabel: 'لغة الواجهة',
  appearanceLabel: 'المظهر',
  themeLight: 'الوضع الفاتح',
  themeDark: 'الوضع الداكن',
  changePasswordTitle: 'تغيير كلمة المرور',
  passwordPolicyHint: '6 أحرف على الأقل تتضمن حرفين ورقماً أو رمزاً (مثال: ab1234).',
  currentPasswordLabel: 'كلمة المرور الحالية',
  newPasswordLabel: 'كلمة المرور الجديدة',
  confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
  updatePasswordButton: 'تحديث كلمة المرور',
  firstLoginTitle: 'تغيير كلمة المرور الأساسية',
  firstLoginDesc: 'يرجى كتابة كلمة مرور جديدة خاصة بك بدلاً من كلمة المرور الأساسية.',
  tempPasswordLabel: 'كلمة المرور المؤقتة',
  savePasswordContinue: 'حفظ والمتابعة',
  adminUsers: 'الموظفون',
  adminLinking: 'ربط بيانات الموظفين',
  adminGemini: 'مفتاح Gemini API',
  adminStorage: 'التخزين والنسخ الاحتياطي',
  adminTaxonomy: 'المجلدات والأقسام',
  adminReindex: 'إعادة الفهرسة',
  adminAudit: 'سجل التدقيق',
  createUserTitle: 'إضافة موظف جديد',
  createUserButton: 'إنشاء الحساب',
  usersListTitle: 'قائمة الموظفين',
  tempPasswordHint: 'سيُطلب من الموظف تغيير كلمة المرور عند أول دخول.',
  fullNamePlaceholder: 'مثال: أحمد علي',
  jobTitlePlaceholder: 'مثال: موظف أرشيف، مدير المالية، سكرتير...',
  departmentPlaceholder: 'مثال: المالية، الموارد البشرية...',
  roleAdmin: 'مدير النظام',
  roleArchiver: 'موظف أرشفة',
  roleViewer: 'عرض فقط',
  deactivate: 'تعطيل',
  activate: 'تفعيل',
  editUserTitle: 'تعديل بيانات الموظف',
  resetPasswordOptional: 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)',
  pendingPwChange: 'بانتظار تغيير كلمة المرور',
  linkingTitle: 'ربط بيانات الموظفين',
  linkingDesc: 'اختر موظفين اثنين أو أكثر لإنشاء مجموعة ربط. يتمكن جميع الأعضاء في نفس المجموعة من رؤية وتصفح والبحث في ملفات ومجلدات بعضهم تلقائياً.',
  createGroupTitle: 'إنشاء مجموعة ربط جديدة',
  editGroupTitle: 'تعديل مجموعة الربط',
  groupNameLabel: 'اسم مجموعة الربط',
  groupNamePlaceholder: 'مثال: فريق المالية، الإدارة العليا...',
  selectEmployeesLabel: 'اختر الموظفين للربط',
  selectMinTwoHint: 'اختر موظفين اثنين على الأقل',
  selectedCount: 'محدد',
  createLinkButton: 'حفظ الربط',
  updateLinkButton: 'تحديث الربط',
  unlinkButton: 'فك الربط',
  existingGroupsTitle: 'مجموعات الربط الحالية',
  noLinkGroups: 'لا توجد مجموعات ربط بعد. يعمل النظام حالياً بالعزل الافتراضي لكل موظف.',
  searchEmployeesPlaceholder: 'ابحث عن موظف بالاسم أو المسمى...',
  geminiTitle: 'إعدادات مفتاح Gemini API',
  geminiDesc: 'يُحفظ المفتاح مشفراً داخل قاعدة البيانات ويعتمد عليه النظام تلقائياً مع بقاء الإعداد الاحتياطي في الخادم مفعّلاً عند الحاجة.',
  geminiActiveDb: 'مفعّل من قاعدة البيانات',
  geminiActiveFallback: 'يعمل بالإعداد الاحتياطي',
  geminiInactive: 'غير مفعّل',
  geminiSavedKey: 'المفتاح المحفوظ حالياً',
  geminiRemoveKey: 'إزالة المفتاح',
  geminiKeyLabel: 'مفتاح Gemini API',
  geminiKeyUpdateLabel: 'تحديث مفتاح Gemini API (اتركه فارغاً للإبقاء على الحالي)',
  geminiEnableLabel: 'تفعيل المفتاح المحفوظ',
  geminiEnableHint: 'عند التعطيل يتم الاعتماد على الإعداد الاحتياطي في الخادم إن وُجد.',
  saveSettings: 'حفظ الإعدادات',
  testConnection: 'اختبار الاتصال',
  testing: 'جاري الاختبار...',
  storedDocs: 'المستندات المحفوظة',
  storedSize: 'المساحة المستخدمة',
  freeSpace: 'المساحة المتاحة',
  storageType: 'نوع التخزين',
  storageLocal: 'محلي',
  storageCloud: 'سحابي',
  diskUsage: 'استهلاك سعة القرص',
  advancedStorageTitle: 'إعدادات التخزين والنسخ الاحتياطي',
  masterPasswordLabel: 'كلمة المرور الرئيسية',
  unlockAdvanced: 'فتح الإعدادات',
  backupTitle: 'نسخة احتياطية مشفرة',
  backupDesc: 'تنزيل نسخة احتياطية كاملة ومشفرة للنظام.',
  downloadBackup: 'تنزيل النسخة الاحتياطية',
  manageFoldersTitle: 'إدارة المجلدات',
  addFolder: 'إضافة مجلد',
  activeDepartments: 'الأقسام النشطة',
  activeClassifications: 'التصنيفات النشطة',
  reindexTitle: 'إعادة فهرسة المستندات',
  reindexDesc: 'إعادة قراءة وفهرسة المستندات غير المفهرسة أو كافة المستندات.',
  reindexPending: 'فهرسة الملفات المعلقة فقط',
  reindexAll: 'إعادة فهرسة جميع الملفات',
  indexedDocsLabel: 'مستندات مفهرسة',
  pendingDocsLabel: 'بانتظار الفهرسة',
  auditTitle: 'سجل التدقيق',
  auditAction: 'الإجراء',
  auditResource: 'العنصر',
  auditTime: 'التاريخ والوقت',
  noAuditEvents: 'لا توجد سجلات بعد.',
  savedSuccess: 'تم الحفظ بنجاح.',
  errorGeneric: 'تعذر إتمام الطلب.',
  passwordMismatch: 'كلمة المرور الجديدة وتأكيدها غير متطابقتين.',
  passwordPolicyError: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل وتتضمن حرفين ورقماً أو رمزاً.',
  sessionExpired: 'انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.',
  networkError: 'تعذر الاتصال بالخادم. يرجى التحقق من الشبكة.',
  installApp: 'تثبيت التطبيق',
  quickFolders: 'المجلدات السريعة',
  allFiles: 'جميع الملفات',
  statDocuments: 'المستندات',
  statFolders: 'المجلدات',
  statLinkedEmployees: 'الموظفون المرتبطون',
  inspectorTitle: 'معاينة المستند',
  inspectorEmptyTitle: 'اختر مستنداً للمعاينة',
  inspectorEmptyDesc: 'انقر على أي ملف في الجدول لعرض معاينته الفورية وتفاصيله الكاملة.',
  openFullPreviewPrint: 'فتح المعاينة الكاملة والطباعة',
  matchedExcerpt: 'الموضع المطابق في المحتوى',
  uploadedByLabel: 'رُفع بواسطة',
  dateLabel: 'التاريخ',
  sizeLabel: 'الحجم',
  folderPathLabel: 'المسار',
  statusLabel: 'الحالة',
  deleteAction: 'حذف',
  loadingPreview: 'جاري تحميل المعاينة...',
  previewUnavailable: 'اضغط على فتح المعاينة الكاملة لعرض هذا الملف',
  openFullPreview: 'فتح المعاينة الكاملة',
  printPermissionLabel: 'صلاحية الطباعة',
  printAllowed: 'الطباعة مسموحة',
  printRestricted: 'الطباعة مقيدة',
  printAdminAlways: 'مفعّلة دائماً للمدير',
  navRecent: 'الأحدث',
  navStarred: 'المفضلة',
  addToStarred: 'إضافة للمفضلة',
  removeFromStarred: 'إزالة من المفضلة',
  dropFilesHereTitle: 'أفلت الملفات هنا للرفع المباشر',
  dropFilesHereDesc: 'يمكنك سحب ملف أو عدة ملفات معاً لرفعها فوراً إلى المجلد الحالي.',
  uploadingFilesTitle: 'جاري رفع الملفات',
  bulkSelectedLabel: 'ملفات محددة',
  bulkMoveToFolder: 'نقل لمجلد',
  bulkDownloadZip: 'تنزيل ZIP',
  bulkDeleteSelected: 'نقل للسلة',
  bulkClearSelection: 'إلغاء التحديد',
  bulkMoveModalTitle: 'نقل الملفات المحددة إلى مجلد',
  bulkMoveConfirm: 'نقل الآن',
  bulkTrashModalTitle: 'نقل الملفات المحددة إلى سلة المحذوفات',
  bulkTrashModalDesc: 'سيتم نقل جميع الملفات المحددة إلى سلة المحذوفات ويمكن استعادتها لاحقاً.',
  movedToFolderSuccess: 'تم نقل الملف إلى المجلد بنجاح.',
  dropOntoFolderHint: 'أفلت هنا لنقل الملف أو الرفع داخل المجلد',
  selectAllFiles: 'تحديد جميع الملفات',
  manageDepartmentsTitle: 'الأقسام المعتمدة',
  manageClassificationsTitle: 'التصنيفات المعتمدة',
  addDepartmentPlaceholder: 'أدخل اسم القسم الجديد...',
  addClassificationPlaceholder: 'أدخل اسم التصنيف الجديد...',
  addItemButton: 'إضافة',
  selectDepartmentPlaceholder: '— اختر القسم —',
  selectClassificationPlaceholder: '— اختر التصنيف —',
  noTaxonomyItems: 'لم تتم إضافة عناصر بعد.',
};

const en: TranslationKeys = {
  appName: 'Archive YemanY',
  appShort: 'Archive YemanY',
  navArchive: 'Archive',
  navUpload: 'Upload Document',
  navTrash: 'Recycle Bin',
  navSettings: 'Settings',
  logout: 'Sign Out',
  statusOnline: 'System Online',
  statusReconnecting: 'Reconnecting...',
  statusOffline: 'Disconnected',
  offlineTitle: 'No Internet Connection',
  serverUnavailableTitle: 'Service Temporarily Unavailable',
  offlineMessage: 'Please check your network connection and try again.',
  serverUnavailableMessage: 'Unable to reach the system server right now. Please try again shortly.',
  retry: 'Retry',
  signInTitle: 'Sign In',
  usernameLabel: 'Username',
  usernamePlaceholder: 'Enter username',
  passwordLabel: 'Password',
  passwordPlaceholder: 'Enter password',
  signInButton: 'Sign In',
  signingIn: 'Signing in...',
  invalidCredentials: 'Incorrect username or password.',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  chooseLanguageTitle: 'Choose Your Preferred Language',
  chooseLanguageSubtitle: 'Choose your preferred interface language. Your choice is saved automatically and can be changed anytime in Settings.',
  saveAndContinue: 'Save & Continue',
  searchPlaceholder: 'Search by file name or any Arabic or English text inside images and documents...',
  searchButton: 'Search',
  searching: 'Searching...',
  filters: 'Filters',
  clear: 'Clear',
  newFolder: 'New Folder',
  uploadDocument: 'Upload Document',
  rootHome: 'Home',
  foldersTitle: 'Folders',
  filesTitle: 'Files',
  itemsCount: 'items',
  subfoldersCount: 'subfolders',
  lastModified: 'Modified',
  ownerLabel: 'Employee',
  allEmployees: 'All Employees',
  allDepartments: 'All Departments',
  allFileTypes: 'All File Types',
  allClassifications: 'All Classifications',
  departmentLabel: 'Department',
  fileTypeLabel: 'File Type',
  classificationLabel: 'Classification',
  keywordLabel: 'Keyword',
  keywordPlaceholder: 'Invoice, Contract, Letter...',
  fromDate: 'From Date',
  toDate: 'To Date',
  gridView: 'Grid',
  listView: 'List',
  exportExcel: 'Excel',
  exportPdf: 'PDF',
  emptyArchiveTitle: 'No matching files',
  emptyArchiveDesc: 'This folder is currently empty. Create a folder or upload a document.',
  emptySearchDesc: 'Try adjusting your search keywords or clearing filters.',
  folderNamePlaceholder: 'Enter new folder name...',
  createFolderInside: 'New folder inside',
  saveFolder: 'Create',
  creating: 'Creating...',
  cancel: 'Cancel',
  preview: 'Preview',
  download: 'Download',
  print: 'Print',
  edit: 'Edit & Move',
  moveToTrash: 'Move to Trash',
  close: 'Close',
  statusIndexed: 'Indexed',
  statusProcessing: 'Processing',
  statusFailed: 'Indexing Failed',
  statusPending: 'Pending',
  confirmTrashDocTitle: 'Move File to Recycle Bin',
  confirmTrashDocDesc: 'You can restore this file later from the Recycle Bin.',
  confirmTrashFolderTitle: 'Move Folder to Recycle Bin',
  confirmTrashFolderDesc: 'This folder and all its contents will be moved to the Recycle Bin and can be restored later.',
  moveToTrashConfirm: 'Move to Trash',
  movingToTrash: 'Moving...',
  editDocTitle: 'Edit & Move Document',
  fileNameLabel: 'File Name',
  targetFolderLabel: 'Folder',
  noFolderRoot: 'Home (No folder)',
  notesSummaryLabel: 'Notes / Summary',
  keywordsCommaLabel: 'Keywords (comma-separated)',
  saveChanges: 'Save Changes',
  saving: 'Saving...',
  extractedText: 'Extracted Text',
  askDocument: 'Ask Document',
  secureShare: 'Secure Share',
  copyText: 'Copy Text',
  copied: 'Copied',
  noExtractedText: 'No extracted text available for this document yet.',
  askPlaceholder: 'Ask a question about this document...',
  send: 'Send',
  linkPassword: 'Link Password',
  linkExpiry: 'Expiry',
  createLink: 'Create Share Link',
  hours: 'hours',
  days: 'days',
  copyLink: 'Copy Link',
  shareHelp: 'Share the link and password through separate channels.',
  uploadPageTitle: 'Upload New Document',
  backToArchive: 'Back to Archive',
  fileOrImageLabel: 'File or Image',
  dropzoneTitle: 'Drag and drop a file here, or click to browse',
  dropzoneHint: 'PDF, JPG, PNG, WEBP, TIFF · Max 40 MB',
  removeFile: 'Remove File',
  uploadSubmit: 'Upload Document',
  uploadingProgress: 'Uploading...',
  uploadSuccess: 'Document uploaded successfully',
  openInArchive: 'Open in Archive',
  uploadAnother: 'Upload Another',
  viewerNoUploadTitle: 'Read-Only Access',
  viewerNoUploadDesc: 'Your account has view-only permissions and cannot upload new documents.',
  optional: 'Optional',
  trashTitle: 'Recycle Bin',
  trashSubtitleEmployee: 'Restore files and folders you deleted back to their original location.',
  trashSubtitleAdmin: 'All deleted items across the system. Restore or permanently remove items.',
  trashEmptyTitle: 'Recycle Bin is Empty',
  trashEmptyDesc: 'There are no deleted files or folders right now.',
  deletedOn: 'Deleted On',
  deletedBy: 'Deleted By',
  restore: 'Restore',
  restoring: 'Restoring...',
  permanentDelete: 'Delete Permanently',
  emptyTrash: 'Empty Bin',
  confirmPermanentTitle: 'Confirm Permanent Deletion',
  confirmPermanentDesc: 'This item will be permanently removed and cannot be recovered.',
  confirmEmptyTrashTitle: 'Empty Entire Recycle Bin',
  confirmEmptyTrashDesc: 'All files and folders in the Recycle Bin will be permanently deleted and cannot be recovered.',
  deletePermanently: 'Delete Permanently',
  deleting: 'Deleting...',
  settingsTitle: 'Settings',
  tabAccount: 'Account & Preferences',
  tabAdmin: 'System Admin',
  profileDetails: 'Account Profile',
  fullNameLabel: 'Full Name',
  jobTitleLabel: 'Job Title',
  roleLabel: 'Access Role',
  accountStatusLabel: 'Account Status',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  preferencesTitle: 'Language & Appearance',
  languageLabel: 'Interface Language',
  appearanceLabel: 'Theme',
  themeLight: 'Light Mode',
  themeDark: 'Dark Mode',
  changePasswordTitle: 'Change Password',
  passwordPolicyHint: 'At least 6 characters including 2 letters and a number or symbol (e.g. ab1234).',
  currentPasswordLabel: 'Current Password',
  newPasswordLabel: 'New Password',
  confirmPasswordLabel: 'Confirm New Password',
  updatePasswordButton: 'Update Password',
  firstLoginTitle: 'Change Initial Password',
  firstLoginDesc: 'Please enter a new personal password to replace the initial password.',
  tempPasswordLabel: 'Temporary Password',
  savePasswordContinue: 'Save & Continue',
  adminUsers: 'Employees',
  adminLinking: 'Employee Data Linking',
  adminGemini: 'Gemini API Key',
  adminStorage: 'Storage & Backup',
  adminTaxonomy: 'Folders & Categories',
  adminReindex: 'Re-indexing',
  adminAudit: 'Audit Log',
  createUserTitle: 'Add New Employee',
  createUserButton: 'Create Account',
  usersListTitle: 'Employees',
  tempPasswordHint: 'The employee will be asked to change their password on first sign-in.',
  fullNamePlaceholder: 'e.g. Sarah Ahmed',
  jobTitlePlaceholder: 'e.g. Archive Officer, Finance Manager, Secretary...',
  departmentPlaceholder: 'e.g. Finance, HR, Legal...',
  roleAdmin: 'Administrator',
  roleArchiver: 'Archiver',
  roleViewer: 'Viewer',
  deactivate: 'Deactivate',
  activate: 'Activate',
  editUserTitle: 'Edit Employee',
  resetPasswordOptional: 'New password (leave empty to keep current)',
  pendingPwChange: 'Password change required',
  linkingTitle: 'Employee Data Linking',
  linkingDesc: 'Select two or more employees to create a link group. Members of the same group automatically view, browse, and search each other’s files and folders.',
  createGroupTitle: 'Create Link Group',
  editGroupTitle: 'Edit Link Group',
  groupNameLabel: 'Group Name',
  groupNamePlaceholder: 'e.g. Finance Team, Executive Office...',
  selectEmployeesLabel: 'Select Employees to Link',
  selectMinTwoHint: 'Select at least 2 employees',
  selectedCount: 'selected',
  createLinkButton: 'Save Link',
  updateLinkButton: 'Update Link',
  unlinkButton: 'Unlink',
  existingGroupsTitle: 'Active Link Groups',
  noLinkGroups: 'No link groups yet. Employees currently only see their own files and folders.',
  searchEmployeesPlaceholder: 'Search employees by name or title...',
  geminiTitle: 'Gemini API Key Settings',
  geminiDesc: 'Stored encrypted in the database and used automatically for text extraction, while keeping the server fallback active when configured.',
  geminiActiveDb: 'Active from Database',
  geminiActiveFallback: 'Using Server Fallback',
  geminiInactive: 'Not Configured',
  geminiSavedKey: 'Saved Key',
  geminiRemoveKey: 'Remove Key',
  geminiKeyLabel: 'Gemini API Key',
  geminiKeyUpdateLabel: 'Update Gemini API Key (leave empty to keep current)',
  geminiEnableLabel: 'Enable Saved Key',
  geminiEnableHint: 'When disabled, the system falls back to the server environment setting if configured.',
  saveSettings: 'Save Settings',
  testConnection: 'Test Connection',
  testing: 'Testing...',
  storedDocs: 'Stored Documents',
  storedSize: 'Storage Used',
  freeSpace: 'Available Space',
  storageType: 'Storage Type',
  storageLocal: 'Local',
  storageCloud: 'Cloud',
  diskUsage: 'Disk Usage',
  advancedStorageTitle: 'Storage & Backup Controls',
  masterPasswordLabel: 'Master Password',
  unlockAdvanced: 'Unlock Settings',
  backupTitle: 'Encrypted Backup',
  backupDesc: 'Download a full encrypted backup archive of the system.',
  downloadBackup: 'Download Backup',
  manageFoldersTitle: 'Manage Folders',
  addFolder: 'Add Folder',
  activeDepartments: 'Active Departments',
  activeClassifications: 'Active Classifications',
  reindexTitle: 'Document Re-indexing',
  reindexDesc: 'Re-index pending documents or all documents in the archive.',
  reindexPending: 'Index Pending Only',
  reindexAll: 'Re-index All Documents',
  indexedDocsLabel: 'Indexed',
  pendingDocsLabel: 'Pending',
  auditTitle: 'Audit Log',
  auditAction: 'Action',
  auditResource: 'Resource',
  auditTime: 'Timestamp',
  noAuditEvents: 'No audit events recorded yet.',
  savedSuccess: 'Saved successfully.',
  errorGeneric: 'Unable to complete the request.',
  passwordMismatch: 'New password and confirmation do not match.',
  passwordPolicyError: 'Password must be at least 6 characters with at least 2 letters and a number or symbol.',
  sessionExpired: 'Session expired. Please sign in again.',
  networkError: 'Unable to connect to the server. Please check your connection.',
  installApp: 'Install App',
  quickFolders: 'Quick Folders',
  allFiles: 'All Files',
  statDocuments: 'Documents',
  statFolders: 'Folders',
  statLinkedEmployees: 'Linked Employees',
  inspectorTitle: 'Document Inspector',
  inspectorEmptyTitle: 'Select a document to preview',
  inspectorEmptyDesc: 'Click any file in the table to view a live preview and full details.',
  openFullPreviewPrint: 'Open Full Preview & Print',
  matchedExcerpt: 'Matched content excerpt',
  uploadedByLabel: 'Uploaded by',
  dateLabel: 'Date',
  sizeLabel: 'Size',
  folderPathLabel: 'Location',
  statusLabel: 'Status',
  deleteAction: 'Delete',
  loadingPreview: 'Loading preview...',
  previewUnavailable: 'Click Open Full Preview to view this file',
  openFullPreview: 'Open Full Preview',
  printPermissionLabel: 'Print Permission',
  printAllowed: 'Printing Allowed',
  printRestricted: 'Printing Restricted',
  printAdminAlways: 'Always enabled for Admin',
  navRecent: 'Recent',
  navStarred: 'Starred',
  addToStarred: 'Add to Starred',
  removeFromStarred: 'Remove from Starred',
  dropFilesHereTitle: 'Drop files here to upload',
  dropFilesHereDesc: 'Drag and drop one or multiple files to upload directly into this folder.',
  uploadingFilesTitle: 'Uploading files',
  bulkSelectedLabel: 'selected',
  bulkMoveToFolder: 'Move to Folder',
  bulkDownloadZip: 'Download ZIP',
  bulkDeleteSelected: 'Move to Trash',
  bulkClearSelection: 'Clear Selection',
  bulkMoveModalTitle: 'Move Selected Files to Folder',
  bulkMoveConfirm: 'Move Files',
  bulkTrashModalTitle: 'Move Selected Files to Recycle Bin',
  bulkTrashModalDesc: 'All selected files will be moved to the Recycle Bin and can be restored later.',
  movedToFolderSuccess: 'Moved file to folder successfully.',
  dropOntoFolderHint: 'Drop here to move or upload into folder',
  selectAllFiles: 'Select all files',
  manageDepartmentsTitle: 'Standardized Departments',
  manageClassificationsTitle: 'Standardized Classifications',
  addDepartmentPlaceholder: 'Enter new department name...',
  addClassificationPlaceholder: 'Enter new classification name...',
  addItemButton: 'Add',
  selectDepartmentPlaceholder: '— Select Department —',
  selectClassificationPlaceholder: '— Select Classification —',
  noTaxonomyItems: 'No items added yet.',
};

const partialLocales: Partial<Record<LocaleCode, Partial<TranslationKeys>>> = {
  fr: {
    appName: 'Archive YemanY',
    navArchive: 'Archive',
    navUpload: 'Téléverser',
    navTrash: 'Corbeille',
    navSettings: 'Paramètres',
    logout: 'Déconnexion',
    statusOnline: 'Système actif',
    statusReconnecting: 'Reconnexion...',
    statusOffline: 'Déconnecté',
    signInTitle: 'Connexion',
    usernameLabel: "Nom d'utilisateur",
    usernamePlaceholder: "Entrez votre nom d'utilisateur",
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Entrez votre mot de passe',
    signInButton: 'Se connecter',
    signingIn: 'Vérification...',
    chooseLanguageTitle: 'Choisissez votre langue',
    chooseLanguageSubtitle: 'Choisissez votre langue préférée. Votre choix est enregistré automatiquement et modifiable dans les paramètres.',
    firstLoginTitle: 'Changer le mot de passe initial',
    firstLoginDesc: 'Veuillez saisir un nouveau mot de passe personnel pour remplacer le mot de passe initial.',
    saveAndContinue: 'Enregistrer et continuer',
    searchPlaceholder: 'Rechercher par nom de fichier ou texte arabe/anglais dans les images et documents...',
    quickFolders: 'Dossiers rapides',
    allFiles: 'Tous les fichiers',
    statDocuments: 'Documents',
    statFolders: 'Dossiers',
    statLinkedEmployees: 'Employés liés',
    inspectorTitle: 'Aperçu du document',
    openFullPreviewPrint: 'Ouvrir en plein écran et imprimer',
    matchedExcerpt: 'Extrait correspondant',
    uploadedByLabel: 'Téléversé par',
    dateLabel: 'Date',
    sizeLabel: 'Taille',
    deleteAction: 'Supprimer',
    searchButton: 'Rechercher',
    filters: 'Filtres',
    clear: 'Effacer',
    newFolder: 'Nouveau dossier',
    uploadDocument: 'Téléverser un document',
    rootHome: 'Accueil',
    foldersTitle: 'Dossiers',
    filesTitle: 'Fichiers',
    preview: 'Aperçu',
    download: 'Télécharger',
    print: 'Imprimer',
    edit: 'Modifier et déplacer',
    moveToTrash: 'Corbeille',
    close: 'Fermer',
    uploadPageTitle: 'Téléverser un nouveau document',
    backToArchive: "Retour à l'archive",
    trashTitle: 'Corbeille',
    restore: 'Restaurer',
    permanentDelete: 'Supprimer définitivement',
    emptyTrash: 'Vider la corbeille',
    settingsTitle: 'Paramètres',
    tabAccount: 'Compte et préférences',
    tabAdmin: 'Administration',
    preferencesTitle: 'Langue et apparence',
    languageLabel: 'Langue',
    appearanceLabel: 'Thème',
    themeLight: 'Mode clair',
    themeDark: 'Mode sombre',
    adminUsers: 'Employés',
    adminLinking: 'Liaison des données',
    saveChanges: 'Enregistrer',
    cancel: 'Annuler',
  },
  es: {
    appName: 'Archive YemanY',
    navArchive: 'Archivo',
    navUpload: 'Subir documento',
    navTrash: 'Papelera',
    navSettings: 'Configuración',
    logout: 'Cerrar sesión',
    statusOnline: 'Sistema activo',
    statusReconnecting: 'Reconectando...',
    statusOffline: 'Desconectado',
    signInTitle: 'Iniciar sesión',
    usernameLabel: 'Usuario',
    usernamePlaceholder: 'Ingrese su usuario',
    passwordLabel: 'Contraseña',
    passwordPlaceholder: 'Ingrese su contraseña',
    signInButton: 'Iniciar sesión',
    signingIn: 'Verificando...',
    chooseLanguageTitle: 'Elija su idioma preferido',
    chooseLanguageSubtitle: 'Elija su idioma preferido. Su elección se guarda automáticamente y puede cambiarla en Configuración.',
    firstLoginTitle: 'Cambiar la contraseña inicial',
    firstLoginDesc: 'Por favor, ingrese una nueva contraseña personal para reemplazar la contraseña inicial.',
    saveAndContinue: 'Guardar y continuar',
    searchPlaceholder: 'Buscar por nombre de archivo o texto en imágenes y documentos...',
    quickFolders: 'Carpetas rápidas',
    allFiles: 'Todos los archivos',
    statDocuments: 'Documentos',
    statFolders: 'Carpetas',
    statLinkedEmployees: 'Empleados vinculados',
    inspectorTitle: 'Vista previa del documento',
    openFullPreviewPrint: 'Abrir vista completa e imprimir',
    matchedExcerpt: 'Fragmento coincidente',
    uploadedByLabel: 'Subido por',
    dateLabel: 'Fecha',
    sizeLabel: 'Tamaño',
    deleteAction: 'Eliminar',
    searchButton: 'Buscar',
    filters: 'Filtros',
    clear: 'Limpiar',
    newFolder: 'Nueva carpeta',
    uploadDocument: 'Subir documento',
    rootHome: 'Inicio',
    foldersTitle: 'Carpetas',
    filesTitle: 'Archivos',
    preview: 'Vista previa',
    download: 'Descargar',
    print: 'Imprimir',
    edit: 'Editar y mover',
    moveToTrash: 'Enviar a papelera',
    close: 'Cerrar',
    uploadPageTitle: 'Subir nuevo documento',
    backToArchive: 'Volver al archivo',
    trashTitle: 'Papelera',
    restore: 'Restaurar',
    permanentDelete: 'Eliminar permanentemente',
    emptyTrash: 'Vaciar papelera',
    settingsTitle: 'Configuración',
    tabAccount: 'Cuenta y preferencias',
    tabAdmin: 'Administración',
    preferencesTitle: 'Idioma y apariencia',
    languageLabel: 'Idioma',
    appearanceLabel: 'Tema',
    themeLight: 'Modo claro',
    themeDark: 'Modo oscuro',
    adminUsers: 'Empleados',
    adminLinking: 'Vinculación de datos',
    saveChanges: 'Guardar cambios',
    cancel: 'Cancelar',
  },
  tr: {
    appName: 'Archive YemanY',
    navArchive: 'Arşiv',
    navUpload: 'Belge Yükle',
    navTrash: 'Geri Dönüşüm',
    navSettings: 'Ayarlar',
    logout: 'Çıkış Yap',
    statusOnline: 'Sistem Aktif',
    statusReconnecting: 'Yeniden bağlanıyor...',
    statusOffline: 'Bağlantı yok',
    signInTitle: 'Giriş Yap',
    usernameLabel: 'Kullanıcı Adı',
    usernamePlaceholder: 'Kullanıcı adını girin',
    passwordLabel: 'Parola',
    passwordPlaceholder: 'Parolayı girin',
    signInButton: 'Giriş Yap',
    signingIn: 'Doğrulanıyor...',
    chooseLanguageTitle: 'Tercih Ettiğiniz Dili Seçin',
    chooseLanguageSubtitle: 'Tercih ettiğiniz dili seçin. Seçiminiz otomatik olarak kaydedilir ve Ayarlar bölümünden değiştirilebilir.',
    firstLoginTitle: 'Başlangıç Parolasını Değiştir',
    firstLoginDesc: 'Lütfen başlangıç parolası yerine kendinize ait yeni bir parola belirleyin.',
    saveAndContinue: 'Kaydet ve Devam Et',
    searchPlaceholder: 'Dosya adı veya görsel ve belgelerin içindeki metinle arayın...',
    quickFolders: 'Hızlı Klasörler',
    allFiles: 'Tüm Dosyalar',
    statDocuments: 'Belgeler',
    statFolders: 'Klasörler',
    statLinkedEmployees: 'Bağlı Çalışanlar',
    inspectorTitle: 'Belge Önizleme',
    openFullPreviewPrint: 'Tam Önizleme ve Yazdır',
    matchedExcerpt: 'Eşleşen içerik bölümü',
    uploadedByLabel: 'Yükleyen',
    dateLabel: 'Tarih',
    sizeLabel: 'Boyut',
    deleteAction: 'Sil',
    searchButton: 'Ara',
    filters: 'Filtreler',
    clear: 'Temizle',
    newFolder: 'Yeni Klasör',
    uploadDocument: 'Belge Yükle',
    rootHome: 'Ana Dizin',
    foldersTitle: 'Klasörler',
    filesTitle: 'Dosyalar',
    preview: 'Önizleme',
    download: 'İndir',
    print: 'Yazdır',
    edit: 'Düzenle ve Taşı',
    moveToTrash: 'Çöpe Taşı',
    close: 'Kapat',
    uploadPageTitle: 'Yeni Belge Yükle',
    backToArchive: 'Arşive Dön',
    trashTitle: 'Geri Dönüşüm Kutusu',
    restore: 'Geri Yükle',
    permanentDelete: 'Kalıcı Olarak Sil',
    emptyTrash: 'Kutuyu Boşalt',
    settingsTitle: 'Ayarlar',
    tabAccount: 'Hesap ve Tercihler',
    tabAdmin: 'Sistem Yönetimi',
    preferencesTitle: 'Dil ve Görünüm',
    languageLabel: 'Dil',
    appearanceLabel: 'Tema',
    themeLight: 'Açık Mod',
    themeDark: 'Koyu Mod',
    adminUsers: 'Çalışanlar',
    adminLinking: 'Veri Bağlama',
    saveChanges: 'Değişiklikleri Kaydet',
    cancel: 'İptal',
  },
  de: {
    appName: 'Archive YemanY',
    navArchive: 'Archiv',
    navUpload: 'Dokument hochladen',
    navTrash: 'Papierkorb',
    navSettings: 'Einstellungen',
    logout: 'Abmelden',
    statusOnline: 'System aktiv',
    statusReconnecting: 'Verbinde neu...',
    statusOffline: 'Getrennt',
    signInTitle: 'Anmelden',
    usernameLabel: 'Benutzername',
    usernamePlaceholder: 'Benutzername eingeben',
    passwordLabel: 'Passwort',
    passwordPlaceholder: 'Passwort eingeben',
    signInButton: 'Anmelden',
    signingIn: 'Anmeldung...',
    chooseLanguageTitle: 'Sprache auswählen',
    chooseLanguageSubtitle: 'Wählen Sie Ihre bevorzugte Sprache. Ihre Auswahl wird automatisch gespeichert und kann in den Einstellungen geändert werden.',
    firstLoginTitle: 'Anfangspasswort ändern',
    firstLoginDesc: 'Bitte geben Sie ein neues persönliches Passwort anstelle des Anfangspassworts ein.',
    saveAndContinue: 'Speichern und fortfahren',
    searchPlaceholder: 'Nach Dateiname oder Text in Bildern und Dokumenten suchen...',
    quickFolders: 'Schnellordner',
    allFiles: 'Alle Dateien',
    statDocuments: 'Dokumente',
    statFolders: 'Ordner',
    statLinkedEmployees: 'Verknüpfte Mitarbeiter',
    inspectorTitle: 'Dokumentvorschau',
    openFullPreviewPrint: 'Vollansicht & Drucken',
    matchedExcerpt: 'Passender Textausschnitt',
    uploadedByLabel: 'Hochgeladen von',
    dateLabel: 'Datum',
    sizeLabel: 'Größe',
    deleteAction: 'Löschen',
    searchButton: 'Suchen',
    filters: 'Filter',
    clear: 'Zurücksetzen',
    newFolder: 'Neuer Ordner',
    uploadDocument: 'Hochladen',
    rootHome: 'Startseite',
    foldersTitle: 'Ordner',
    filesTitle: 'Dateien',
    preview: 'Vorschau',
    download: 'Herunterladen',
    print: 'Drucken',
    edit: 'Bearbeiten & Verschieben',
    moveToTrash: 'In Papierkorb',
    close: 'Schließen',
    uploadPageTitle: 'Neues Dokument hochladen',
    backToArchive: 'Zurück zum Archiv',
    trashTitle: 'Papierkorb',
    restore: 'Wiederherstellen',
    permanentDelete: 'Endgültig löschen',
    emptyTrash: 'Papierkorb leeren',
    settingsTitle: 'Einstellungen',
    tabAccount: 'Konto & Präferenzen',
    tabAdmin: 'Systemverwaltung',
    preferencesTitle: 'Sprache & Design',
    languageLabel: 'Sprache',
    appearanceLabel: 'Erscheinungsbild',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    adminUsers: 'Mitarbeiter',
    adminLinking: 'Datenverknüpfung',
    saveChanges: 'Speichern',
    cancel: 'Abbrechen',
  },
  ru: {
    appName: 'Archive YemanY',
    navArchive: 'Архив',
    navUpload: 'Загрузить',
    navTrash: 'Корзина',
    navSettings: 'Настройки',
    logout: 'Выйти',
    statusOnline: 'Система активна',
    statusReconnecting: 'Переподключение...',
    statusOffline: 'Нет связи',
    signInTitle: 'Вход в систему',
    usernameLabel: 'Имя пользователя',
    usernamePlaceholder: 'Введите имя пользователя',
    passwordLabel: 'Пароль',
    passwordPlaceholder: 'Введите пароль',
    signInButton: 'Войти',
    signingIn: 'Проверка...',
    chooseLanguageTitle: 'Выберите язык интерфейса',
    chooseLanguageSubtitle: 'Выберите удобный язык. Выбор сохраняется автоматически и может быть изменён в настройках.',
    firstLoginTitle: 'Смена начального пароля',
    firstLoginDesc: 'Пожалуйста, введите новый личный пароль вместо начального пароля.',
    saveAndContinue: 'Сохранить и продолжить',
    searchPlaceholder: 'Поиск по имени файла или тексту внутри изображений и документов...',
    quickFolders: 'Быстрые папки',
    allFiles: 'Все файлы',
    statDocuments: 'Документы',
    statFolders: 'Папки',
    statLinkedEmployees: 'Связанные сотрудники',
    inspectorTitle: 'Просмотр документа',
    openFullPreviewPrint: 'Открыть полностью и печать',
    matchedExcerpt: 'Совпавший фрагмент',
    uploadedByLabel: 'Загрузил',
    dateLabel: 'Дата',
    sizeLabel: 'Размер',
    deleteAction: 'Удалить',
    searchButton: 'Поиск',
    filters: 'Фильтры',
    clear: 'Сбросить',
    newFolder: 'Новая папка',
    uploadDocument: 'Загрузить документ',
    rootHome: 'Главная',
    foldersTitle: 'Папки',
    filesTitle: 'Файлы',
    preview: 'Просмотр',
    download: 'Скачать',
    print: 'Печать',
    edit: 'Изменить и переместить',
    moveToTrash: 'В корзину',
    close: 'Закрыть',
    uploadPageTitle: 'Загрузка нового документа',
    backToArchive: 'Вернуться в архив',
    trashTitle: 'Корзина',
    restore: 'Восстановить',
    permanentDelete: 'Удалить навсегда',
    emptyTrash: 'Очистить корзину',
    settingsTitle: 'Настройки',
    tabAccount: 'Аккаунт и тема',
    tabAdmin: 'Управление',
    preferencesTitle: 'Язык и оформление',
    languageLabel: 'Язык',
    appearanceLabel: 'Тема',
    themeLight: 'Светлая',
    themeDark: 'Тёмная',
    adminUsers: 'Сотрудники',
    adminLinking: 'Связь данных',
    saveChanges: 'Сохранить',
    cancel: 'Отмена',
  },
  zh: {
    appName: 'Archive YemanY',
    navArchive: '档案库',
    navUpload: '上传文档',
    navTrash: '回收站',
    navSettings: '设置',
    logout: '退出登录',
    statusOnline: '系统运行正常',
    statusReconnecting: '正在重新连接...',
    statusOffline: '连接断开',
    signInTitle: '登录',
    usernameLabel: '用户名',
    usernamePlaceholder: '请输入用户名',
    passwordLabel: '密码',
    passwordPlaceholder: '请输入密码',
    signInButton: '登录',
    signingIn: '正在验证...',
    chooseLanguageTitle: '选择您的首选语言',
    chooseLanguageSubtitle: '请选择您的首选语言。系统将自动保存您的选择，随时可在设置中更改。',
    firstLoginTitle: '更改初始密码',
    firstLoginDesc: '请设置您自己的新密码以替换初始密码。',
    saveAndContinue: '保存并继续',
    searchPlaceholder: '按文件名或图片和文档中的文本内容搜索...',
    quickFolders: '快捷文件夹',
    allFiles: '全部文件',
    statDocuments: '文档总数',
    statFolders: '文件夹',
    statLinkedEmployees: '关联员工',
    inspectorTitle: '文档实时预览',
    openFullPreviewPrint: '全屏预览与打印',
    matchedExcerpt: '匹配内容片段',
    uploadedByLabel: '上传者',
    dateLabel: '日期',
    sizeLabel: '大小',
    deleteAction: '删除',
    searchButton: '搜索',
    filters: '筛选',
    clear: '清除',
    newFolder: '新建文件夹',
    uploadDocument: '上传文档',
    rootHome: '根目录',
    foldersTitle: '文件夹',
    filesTitle: '文件',
    preview: '预览',
    download: '下载',
    print: '打印',
    edit: '编辑和移动',
    moveToTrash: '移至回收站',
    close: '关闭',
    uploadPageTitle: '上传新文档',
    backToArchive: '返回档案库',
    trashTitle: '回收站',
    restore: '恢复',
    permanentDelete: '永久删除',
    emptyTrash: '清空回收站',
    settingsTitle: '设置',
    tabAccount: '账户与偏好',
    tabAdmin: '系统管理',
    preferencesTitle: '语言与外观',
    languageLabel: '界面语言',
    appearanceLabel: '主题模式',
    themeLight: '浅色模式',
    themeDark: '深色模式',
    adminUsers: '员工管理',
    adminLinking: '员工数据关联',
    saveChanges: '保存更改',
    cancel: '取消',
  },
  ja: {
    appName: 'Archive YemanY',
    navArchive: 'アーカイブ',
    navUpload: 'アップロード',
    navTrash: 'ゴミ箱',
    navSettings: '設定',
    logout: 'ログアウト',
    statusOnline: '稼働中',
    statusReconnecting: '再接続中...',
    statusOffline: '切断',
    signInTitle: 'ログイン',
    usernameLabel: 'ユーザー名',
    usernamePlaceholder: 'ユーザー名を入力',
    passwordLabel: 'パスワード',
    passwordPlaceholder: 'パスワードを入力',
    signInButton: 'ログイン',
    signingIn: '認証中...',
    chooseLanguageTitle: '使用言語を選択',
    chooseLanguageSubtitle: '使用する言語を選択してください。選択は自動的に保存され、設定からいつでも変更できます。',
    firstLoginTitle: '初期パスワードの変更',
    firstLoginDesc: '初期パスワードの代わりに新しい個人用パスワードを入力してください。',
    saveAndContinue: '保存して続行',
    searchPlaceholder: 'ファイル名、または画像や文書内のテキストで検索...',
    quickFolders: 'クイックフォルダ',
    allFiles: 'すべてのファイル',
    statDocuments: '文書数',
    statFolders: 'フォルダ数',
    statLinkedEmployees: '連携メンバー',
    inspectorTitle: '文書プレビュー',
    openFullPreviewPrint: 'フルプレビューと印刷',
    matchedExcerpt: '一致した抜粋',
    uploadedByLabel: 'アップロード者',
    dateLabel: '日付',
    sizeLabel: 'サイズ',
    deleteAction: '削除',
    searchButton: '検索',
    filters: 'フィルター',
    clear: 'クリア',
    newFolder: '新規フォルダ',
    uploadDocument: '文書をアップロード',
    rootHome: 'ホーム',
    foldersTitle: 'フォルダ',
    filesTitle: 'ファイル',
    preview: 'プレビュー',
    download: 'ダウンロード',
    print: '印刷',
    edit: '編集・移動',
    moveToTrash: 'ゴミ箱へ移動',
    close: '閉じる',
    uploadPageTitle: '新しい文書をアップロード',
    backToArchive: 'アーカイブへ戻る',
    trashTitle: 'ゴミ箱',
    restore: '復元',
    permanentDelete: '完全に削除',
    emptyTrash: 'ゴミ箱を空にする',
    settingsTitle: '設定',
    tabAccount: 'アカウントと表示',
    tabAdmin: 'システム管理',
    preferencesTitle: '言語とテーマ',
    languageLabel: '表示言語',
    appearanceLabel: '外観',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    adminUsers: '従業員',
    adminLinking: 'データ連携',
    saveChanges: '保存',
    cancel: 'キャンセル',
  },
  hi: {
    appName: 'Archive YemanY',
    navArchive: 'आर्काइव',
    navUpload: 'दस्तावेज़ अपलोड',
    navTrash: 'रीसायकल बिन',
    navSettings: 'सेटिंग्स',
    logout: 'लॉग आउट',
    statusOnline: 'सिस्टम सक्रिय',
    statusReconnecting: 'पुनः जुड़ रहा है...',
    statusOffline: 'कनेक्शन टूटा',
    signInTitle: 'साइन इन करें',
    usernameLabel: 'उपयोगकर्ता नाम',
    usernamePlaceholder: 'उपयोगकर्ता नाम दर्ज करें',
    passwordLabel: 'पासवर्ड',
    passwordPlaceholder: 'पासवर्ड दर्ज करें',
    signInButton: 'साइन इन',
    signingIn: 'जाँच हो रही है...',
    chooseLanguageTitle: 'अपनी पसंदीदा भाषा चुनें',
    chooseLanguageSubtitle: 'अपनी पसंदीदा भाषा चुनें। आपकी पसंद स्वतः सहेजी जाएगी और सेटिंग्स में कभी भी बदली जा सकती है।',
    firstLoginTitle: 'प्रारंभिक पासवर्ड बदलें',
    firstLoginDesc: 'कृपया प्रारंभिक पासवर्ड के स्थान पर अपना नया निजी पासवर्ड दर्ज करें।',
    saveAndContinue: 'सहेजें और जारी रखें',
    searchPlaceholder: 'फ़ाइल नाम या छवियों और दस्तावेज़ों के भीतर के पाठ से खोजें...',
    quickFolders: 'त्वरित फ़ोल्डर',
    allFiles: 'सभी फ़ाइलें',
    statDocuments: 'दस्तावेज़',
    statFolders: 'फ़ोल्डर',
    statLinkedEmployees: 'जुड़े कर्मचारी',
    inspectorTitle: 'दस्तावेज़ पूर्वावलोकन',
    openFullPreviewPrint: 'पूर्ण पूर्वावलोकन और प्रिंट',
    matchedExcerpt: 'मिलान किया गया अंश',
    uploadedByLabel: 'अपलोडकर्ता',
    dateLabel: 'दिनांक',
    sizeLabel: 'आकार',
    deleteAction: 'हटाएं',
    searchButton: 'खोजें',
    filters: 'फ़िल्टर',
    clear: 'साफ़ करें',
    newFolder: 'नया फ़ोल्डर',
    uploadDocument: 'दस्तावेज़ अपलोड करें',
    rootHome: 'होम',
    foldersTitle: 'फ़ोल्डर',
    filesTitle: 'फ़ाइलें',
    preview: 'पूर्वावलोकन',
    download: 'डाउनलोड',
    print: 'प्रिंट',
    edit: 'संपादित और स्थानांतरित करें',
    moveToTrash: 'बिन में भेजें',
    close: 'बंद करें',
    uploadPageTitle: 'नया दस्तावेज़ अपलोड करें',
    backToArchive: 'आर्काइव पर लौटें',
    trashTitle: 'रीसायकल बिन',
    restore: 'पुनर्स्थापित करें',
    permanentDelete: 'स्थायी रूप से हटाएं',
    emptyTrash: 'बिन खाली करें',
    settingsTitle: 'सेटिंग्स',
    tabAccount: 'खाता और प्राथमिकताएं',
    tabAdmin: 'सिस्टम प्रबंधन',
    preferencesTitle: 'भाषा और थीम',
    languageLabel: 'भाषा',
    appearanceLabel: 'थीम',
    themeLight: 'लाइट मोड',
    themeDark: 'डार्क मोड',
    adminUsers: 'कर्मचारी',
    adminLinking: 'डेटा लिंकिंग',
    saveChanges: 'सहेजें',
    cancel: 'रद्द करें',
  },
  ur: {
    appName: 'Archive YemanY',
    navArchive: 'آرکائیو',
    navUpload: 'دستاویز اپ لوڈ',
    navTrash: 'ری سائیکل بن',
    navSettings: 'ترتیبات',
    logout: 'لاگ آؤٹ',
    statusOnline: 'سسٹم فعال ہے',
    statusReconnecting: 'دوبارہ رابطہ ہو رہا ہے...',
    statusOffline: 'رابطہ منقطع',
    signInTitle: 'سائن ان کریں',
    usernameLabel: 'صارف نام',
    usernamePlaceholder: 'صارف نام درج کریں',
    passwordLabel: 'پاس ورڈ',
    passwordPlaceholder: 'پاس ورڈ درج کریں',
    signInButton: 'سائن ان',
    signingIn: 'تصدیق ہو رہی ہے...',
    chooseLanguageTitle: 'اپنی پسندیدہ زبان منتخب کریں',
    chooseLanguageSubtitle: 'اپنی پسندیدہ زبان منتخب کریں۔ آپ کا انتخاب خودکار طور پر محفوظ ہو جائے گا اور ترتیبات سے بدلا جا سکتا ہے۔',
    firstLoginTitle: 'ابتدائی پاس ورڈ تبدیل کریں',
    firstLoginDesc: 'براہ کرم ابتدائی پاس ورڈ کی بجائے اپنا نیا ذاتی پاس ورڈ درج کریں۔',
    saveAndContinue: 'محفوظ کریں اور جاری رکھیں',
    searchPlaceholder: 'فائل کے نام یا تصاویر اور دستاویزات کے اندر موجود عربی یا انگریزی متن سے تلاش کریں...',
    quickFolders: 'فوری فولڈرز',
    allFiles: 'تمام فائلیں',
    statDocuments: 'دستاویزات',
    statFolders: 'فولڈرز',
    statLinkedEmployees: 'منسلک ملازمین',
    inspectorTitle: 'دستاویز کا پیش منظر',
    openFullPreviewPrint: 'مکمل پیش منظر اور پرنٹ',
    matchedExcerpt: 'مواد میں مماثل حصہ',
    uploadedByLabel: 'اپ لوڈ کنندہ',
    dateLabel: 'تاریخ',
    sizeLabel: 'سائز',
    deleteAction: 'حذف کریں',
    searchButton: 'تلاش',
    filters: 'فلٹرز',
    clear: 'صاف کریں',
    newFolder: 'نیا فولڈر',
    uploadDocument: 'دستاویز اپ لوڈ کریں',
    rootHome: 'ہوم',
    foldersTitle: 'فولڈرز',
    filesTitle: 'فائلیں',
    preview: 'پیش منظر',
    download: 'ڈاؤن لوڈ',
    print: 'پرنٹ',
    edit: 'ترمیم اور منتقلی',
    moveToTrash: 'بن میں منتقل کریں',
    close: 'بند کریں',
    uploadPageTitle: 'نئی دستاویز اپ لوڈ کریں',
    backToArchive: 'آرکائیو پر واپس جائیں',
    trashTitle: 'ری سائیکل بن',
    restore: 'بحال کریں',
    permanentDelete: 'مستقل حذف کریں',
    emptyTrash: 'بن خالی کریں',
    settingsTitle: 'ترتیبات',
    tabAccount: 'اکاؤنٹ اور ترجیحات',
    tabAdmin: 'سسٹم انتظام',
    preferencesTitle: 'زبان اور ظاہری شکل',
    languageLabel: 'زبان',
    appearanceLabel: 'تھیم',
    themeLight: 'لائٹ موڈ',
    themeDark: 'ڈارک موڈ',
    adminUsers: 'ملازمین',
    adminLinking: 'ڈیٹا لنکنگ',
    saveChanges: 'تبدیلیاں محفوظ کریں',
    cancel: 'منسوخ کریں',
  },
};

export function getTranslations(locale: LocaleCode): TranslationKeys {
  if (locale === 'ar') return ar;
  if (locale === 'en') return en;
  return { ...en, ...(partialLocales[locale] || {}) };
}

export function roleDisplayLabel(role: string, t: TranslationKeys): string {
  if (role === 'admin') return t.roleAdmin;
  if (role === 'viewer') return t.roleViewer;
  return t.roleArchiver;
}

export function statusDisplayMeta(status: string | undefined, t: TranslationKeys): { label: string; dotClass: string; textClass: string } {
  if (status === 'completed') {
    return { label: t.statusIndexed, dotClass: 'bg-emerald-500', textClass: 'text-emerald-700 dark:text-emerald-400' };
  }
  if (status === 'processing') {
    return { label: t.statusProcessing, dotClass: 'bg-[#0891B2]', textClass: 'text-[#0E7490] dark:text-[#22D3EE]' };
  }
  if (status === 'failed') {
    return { label: t.statusFailed, dotClass: 'bg-rose-500', textClass: 'text-rose-700 dark:text-rose-400' };
  }
  return { label: t.statusPending, dotClass: 'bg-amber-500', textClass: 'text-amber-700 dark:text-amber-400' };
}
