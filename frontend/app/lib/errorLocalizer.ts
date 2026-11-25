import type { LocaleCode } from '../components/types';
import type { TranslationKeys } from './i18n';

type ErrorCatalog = {
  methodNotAllowed: string;
  notFound: string;
  forbidden: string;
  unauthorized: string;
  serverError: string;
  serviceUnavailable: string;
  tooManyRequests: string;
  validationError: string;
  fileTooLarge: string;
  unsupportedFileType: string;
  invalidCredentials: string;
  accountDisabled: string;
  currentPasswordWrong: string;
  newPasswordMustDiffer: string;
  passwordPolicy: string;
  masterPasswordWrong: string;
  stepUpExpired: string;
  usernameExists: string;
  cannotDisableSelf: string;
  minTwoEmployees: string;
  itemAlreadyExists: string;
  folderNotFound: string;
  documentNotFound: string;
  viewerNoWrite: string;
  folderOwnParent: string;
  folderIntoSubfolder: string;
  docTextNotReady: string;
  aiUnavailable: string;
  aiRateLimited: string;
  shareInvalidOrExpired: string;
  shareLocked: string;
  sharePasswordWrong: string;
  geminiKeyInvalid: string;
  geminiKeyMissing: string;
  geminiTestFailed: string;
  storageUnavailable: string;
  backupTooLarge: string;
  backupFailed: string;
  noDocsSelected: string;
  nameRequired: string;
  conflict: string;
  badRequest: string;
};

const AR_ERRORS: ErrorCatalog = {
  methodNotAllowed: 'هذا الإجراء غير متاح على الخادم حالياً. يُرجى تحديث الصفحة أو التأكد من تحديث الخادم.',
  notFound: 'العنصر المطلوب غير موجود أو تم نقله.',
  forbidden: 'ليست لديك الصلاحية اللازمة لتنفيذ هذا الإجراء.',
  unauthorized: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  serverError: 'حدث خطأ غير متوقع في الخادم. يُرجى المحاولة مجدداً.',
  serviceUnavailable: 'الخدمة غير متوفرة مؤقتاً. يُرجى المحاولة بعد قليل.',
  tooManyRequests: 'تم تجاوز عدد المحاولات المسموح به. يُرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
  validationError: 'يُرجى التحقق من صحة البيانات المدخلة والمحاولة مرة أخرى.',
  fileTooLarge: 'حجم الملف غير صالح أو يتجاوز الحد الأقصى المسموح به (40 ميجابايت).',
  unsupportedFileType: 'نوع الملف غير مدعوم. يُسمح فقط بملفات PDF والصور (JPG، PNG، WEBP، TIFF).',
  invalidCredentials: 'اسم المستخدم أو كلمة المرور غير صحيحة.',
  accountDisabled: 'هذا الحساب معطّل حالياً. يُرجى التواصل مع مدير النظام.',
  currentPasswordWrong: 'كلمة المرور الحالية غير صحيحة.',
  newPasswordMustDiffer: 'يجب أن تختلف كلمة المرور الجديدة عن كلمة المرور الحالية.',
  passwordPolicy: 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل وتحتوي على حرف ورقم.',
  masterPasswordWrong: 'كلمة المرور الرئيسية غير صحيحة.',
  stepUpExpired: 'انتهت صلاحية جلسة التحقق المتقدمة. يُرجى إعادة إدخال كلمة المرور الرئيسية.',
  usernameExists: 'اسم المستخدم مسجّل مسبقاً، يُرجى اختيار اسم آخر.',
  cannotDisableSelf: 'لا يمكنك تعطيل حسابك الشخصي الحالي.',
  minTwoEmployees: 'يُرجى اختيار موظفين اثنين على الأقل للربط.',
  itemAlreadyExists: 'هذا العنصر موجود مسبقاً.',
  folderNotFound: 'المجلد المطلوب غير موجود.',
  documentNotFound: 'المستند المطلوب غير موجود أو لا تملك صلاحية الوصول إليه.',
  viewerNoWrite: 'حسابك بصلاحية العرض فقط ولا يمكنه الرفع أو التعديل أو الحذف.',
  folderOwnParent: 'لا يمكن وضع المجلد داخل نفسه.',
  folderIntoSubfolder: 'لا يمكن نقل المجلد داخل أحد مجلداته الفرعية.',
  docTextNotReady: 'فهرسة محتوى هذا المستند لا تزال قيد المعالجة. يُرجى المحاولة بعد لحظات.',
  aiUnavailable: 'خدمة الاستعلام الذكي غير متوفرة حالياً. يُرجى التحقق من الإعدادات أو المحاولة لاحقاً.',
  aiRateLimited: 'تم الوصول للحد المؤقت لطلبات الخدمة. يُرجى المحاولة بعد لحظات.',
  shareInvalidOrExpired: 'رابط المشاركة غير صالح أو انتهت صلاحيته.',
  shareLocked: 'تم قفل رابط المشاركة مؤقتاً بسبب محاولات متكررة. يُرجى المحاولة لاحقاً.',
  sharePasswordWrong: 'كلمة مرور المشاركة غير صحيحة.',
  geminiKeyInvalid: 'صيغة مفتاح الربط غير صالحة. يُرجى التأكد من نسخه بشكل كامل.',
  geminiKeyMissing: 'يُرجى إدخال مفتاح الربط أولاً قبل الحفظ.',
  geminiTestFailed: 'تعذر الاتصال بالخدمة باستخدام هذا المفتاح. يُرجى التحقق من صحته.',
  storageUnavailable: 'تعذر الوصول إلى وحدة تخزين المستندات مؤقتاً. يُرجى المحاولة لاحقاً.',
  backupTooLarge: 'حجم الأرشيف يتجاوز الحد الأقصى للنسخ الاحتياطي المباشر (2 جيجابايت).',
  backupFailed: 'تعذر إنشاء النسخة الاحتياطية في الوقت الحالي.',
  noDocsSelected: 'لا توجد مستندات محددة متاحة لهذه العملية.',
  nameRequired: 'يُرجى إدخال الاسم المطلوب.',
  conflict: 'تعارض في البيانات: هذا السجل موجود مسبقاً.',
  badRequest: 'تعذر تنفيذ الطلب. يُرجى مراجعة المدخلات والمحاولة مرة أخرى.',
};

const EN_ERRORS: ErrorCatalog = {
  methodNotAllowed: 'This action is not available on the server right now. Please refresh or ensure the server is up to date.',
  notFound: 'The requested item was not found or has been moved.',
  forbidden: 'You do not have permission to perform this action.',
  unauthorized: 'Incorrect username or password.',
  serverError: 'An unexpected server error occurred. Please try again.',
  serviceUnavailable: 'The service is temporarily unavailable. Please try again shortly.',
  tooManyRequests: 'Too many attempts. Please wait a moment and try again.',
  validationError: 'Please review the entered details and try again.',
  fileTooLarge: 'The file is empty or exceeds the maximum allowed size (40 MB).',
  unsupportedFileType: 'Unsupported file format. Only PDF and images (JPG, PNG, WEBP, TIFF) are accepted.',
  invalidCredentials: 'Incorrect username or password.',
  accountDisabled: 'This account is currently disabled. Please contact your system administrator.',
  currentPasswordWrong: 'The current password is incorrect.',
  newPasswordMustDiffer: 'The new password must be different from your current password.',
  passwordPolicy: 'Password must be at least 6 characters and include at least one letter and one number.',
  masterPasswordWrong: 'The master password is incorrect.',
  stepUpExpired: 'Advanced verification session expired. Please enter the master password again.',
  usernameExists: 'This username is already taken. Please choose another.',
  cannotDisableSelf: 'You cannot disable your own active account.',
  minTwoEmployees: 'Please select at least two employees to link.',
  itemAlreadyExists: 'This item already exists.',
  folderNotFound: 'The requested folder was not found.',
  documentNotFound: 'The requested document was not found or is not accessible.',
  viewerNoWrite: 'Viewer accounts have read-only access and cannot upload, edit, or delete files.',
  folderOwnParent: 'A folder cannot be placed inside itself.',
  folderIntoSubfolder: 'A folder cannot be moved inside one of its own subfolders.',
  docTextNotReady: 'Document indexing is still in progress. Please try again in a moment.',
  aiUnavailable: 'Document assistant service is temporarily unavailable. Please try again later.',
  aiRateLimited: 'The service is temporarily busy. Please try again in a moment.',
  shareInvalidOrExpired: 'This share link is invalid or has expired.',
  shareLocked: 'This share link is temporarily locked. Please try again later.',
  sharePasswordWrong: 'Incorrect share password.',
  geminiKeyInvalid: 'Invalid API key format. Please verify that you copied the full key.',
  geminiKeyMissing: 'Please enter an API key before saving.',
  geminiTestFailed: 'Could not connect with this API key. Please check the key and try again.',
  storageUnavailable: 'Document storage is temporarily unavailable. Please try again shortly.',
  backupTooLarge: 'Archive size exceeds the 2 GB interactive backup limit.',
  backupFailed: 'Backup could not be created right now.',
  noDocsSelected: 'No accessible documents were selected for this action.',
  nameRequired: 'Please enter a valid name.',
  conflict: 'Conflict: this record already exists.',
  badRequest: 'Could not process the request. Please review your input and try again.',
};

function getCatalog(locale: LocaleCode): ErrorCatalog {
  return locale === 'ar' ? AR_ERRORS : EN_ERRORS;
}

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;
const LATIN_CHAR_RE = /[A-Za-z]/;

/**
 * Translates any backend error message, validation detail, or HTTP status code
 * cleanly into the user's currently active UI language so English server errors
 * (e.g. "Method Not Allowed", "Invalid username or password") never leak into Arabic
 * and Arabic server strings never leak into English.
 */
export function localizeApiError(
  rawDetail: string | null | undefined,
  status: number | undefined,
  locale: LocaleCode,
  t?: TranslationKeys
): string {
  const cat = getCatalog(locale);
  const raw = (rawDetail || '').trim();
  const lower = raw.toLowerCase();

  // 1. Exact & semantic pattern matching (language-agnostic)
  if (lower.includes('method not allowed')) return cat.methodNotAllowed;

  // Authentication & credentials
  if (
    lower.includes('not authenticated') ||
    lower.includes('could not validate credentials') ||
    lower.includes('token expired')
  ) {
    return t?.sessionExpired || (locale === 'ar' ? 'انتهت الجلسة أو يلزم تسجيل الدخول مجدداً.' : 'Session expired or authentication required. Please sign in again.');
  }
  if (
    lower.includes('invalid username') ||
    lower.includes('invalid credentials') ||
    lower.includes('incorrect username') ||
    lower.includes('wrong password')
  ) {
    return t?.invalidCredentials || cat.invalidCredentials;
  }
  if (lower.includes('disabled') || lower.includes('inactive') || lower.includes('معطل')) {
    return cat.accountDisabled;
  }
  if (
    lower.includes('كلمة المرور الحالية غير صحيحة') ||
    lower.includes('current password is incorrect') ||
    lower.includes('invalid current password')
  ) {
    return cat.currentPasswordWrong;
  }
  if (
    lower.includes('يجب أن تختلف كلمة المرور الجديدة') ||
    lower.includes('must differ') ||
    lower.includes('different from')
  ) {
    return cat.newPasswordMustDiffer;
  }
  if (
    lower.includes('at least 6') ||
    lower.includes('at least one letter') ||
    lower.includes('letter and one number') ||
    lower.includes('password must')
  ) {
    return t?.passwordPolicyError || cat.passwordPolicy;
  }
  if (lower.includes('master password is incorrect')) return cat.masterPasswordWrong;
  if (lower.includes('master-password challenge expired') || lower.includes('step-up')) {
    return cat.stepUpExpired;
  }

  // Users, groups & taxonomy
  if (lower.includes('username already exists')) return cat.usernameExists;
  if (lower.includes('cannot disable your own')) return cat.cannotDisableSelf;
  if (lower.includes('at least two employees')) return cat.minTwoEmployees;
  if (lower.includes('item already exists') || lower.includes('already exists')) {
    return cat.itemAlreadyExists;
  }
  if (lower.includes('name cannot be empty') || lower.includes('file_name cannot be empty')) {
    return cat.nameRequired;
  }

  // Upload & files
  if (
    lower.includes('exceeds the 40') ||
    lower.includes('file is empty') ||
    lower.includes('payload too large') ||
    lower.includes('entity too large')
  ) {
    return cat.fileTooLarge;
  }
  if (
    lower.includes('only pdf') ||
    lower.includes('unsupported media') ||
    lower.includes('unsupported file')
  ) {
    return cat.unsupportedFileType;
  }
  if (lower.includes('viewer accounts cannot') || lower.includes('viewer cannot')) {
    return cat.viewerNoWrite;
  }
  if (lower.includes('own parent')) return cat.folderOwnParent;
  if (lower.includes('own subfolder')) return cat.folderIntoSubfolder;
  if (lower.includes('folder not found')) return cat.folderNotFound;
  if (lower.includes('document not found')) return cat.documentNotFound;
  if (lower.includes('no accessible documents')) return cat.noDocsSelected;

  // Document chat & share links
  if (lower.includes('text indexing is not ready')) return cat.docTextNotReady;
  if (lower.includes('rate limited')) return cat.aiRateLimited;
  if (lower.includes('query service is temporarily unavailable')) return cat.aiUnavailable;
  if (lower.includes('share link is invalid') || lower.includes('expired')) {
    return cat.shareInvalidOrExpired;
  }
  if (lower.includes('temporarily locked')) return cat.shareLocked;
  if (lower.includes('incorrect share password')) return cat.sharePasswordWrong;

  // Gemini settings & storage/backup
  if (lower.includes('صيغة مفتاح gemini') || lower.includes('invalid gemini') || lower.includes('api key')) {
    if (lower.includes('يرجى إدخال') || lower.includes('missing')) return cat.geminiKeyMissing;
    return cat.geminiKeyInvalid;
  }
  if (lower.includes('storage is temporarily unavailable') || lower.includes('storage is unavailable') || lower.includes('read from storage')) {
    return cat.storageUnavailable;
  }
  if (lower.includes('2 gib') || lower.includes('2 gb')) return cat.backupTooLarge;
  if (lower.includes('backup could not') || lower.includes('database backup failed')) {
    return cat.backupFailed;
  }

  // 2. Fallback strictly by HTTP status code (never leak raw English HTTP reason phrases)
  if (status === 405) return cat.methodNotAllowed;
  if (status === 413) return cat.fileTooLarge;
  if (status === 415) return cat.unsupportedFileType;
  if (status === 401) return t?.invalidCredentials || cat.unauthorized;
  if (status === 403) return cat.forbidden;
  if (status === 404) return cat.notFound;
  if (status === 409) return cat.conflict;
  if (status === 422) return cat.validationError;
  if (status === 429) return cat.tooManyRequests;
  if (status === 502 || status === 503 || status === 504) return cat.serviceUnavailable;
  if (status && status >= 500) return cat.serverError;
  if (status === 400) return cat.badRequest;

  // 3. Language-purity guard: never pass through mismatched-script raw backend text
  if (raw) {
    if (locale === 'ar' && ARABIC_CHAR_RE.test(raw)) return raw;
    if (locale === 'en' && !ARABIC_CHAR_RE.test(raw) && LATIN_CHAR_RE.test(raw)) return raw;
  }

  return t?.errorGeneric || cat.serverError;
}

/**
 * Localizes non-error informational / status messages returned by admin backend endpoints
 * (e.g., Gemini key test results, storage health test, reindex messages).
 */
export function localizeServerMessage(
  rawMessage: string | null | undefined,
  ok: boolean,
  locale: LocaleCode,
  t?: TranslationKeys
): string {
  const raw = (rawMessage || '').trim();
  const isAr = locale === 'ar';

  if (!raw) {
    return ok ? (t?.savedSuccess || (isAr ? 'تم الحفظ بنجاح.' : 'Saved successfully.')) : (t?.errorGeneric || (isAr ? 'تعذر إتمام العملية.' : 'Could not complete the operation.'));
  }

  // If the server message already matches the active UI script, return it cleanly
  if (isAr && ARABIC_CHAR_RE.test(raw) && !raw.toLowerCase().includes('method not allowed')) {
    return raw;
  }
  if (!isAr && !ARABIC_CHAR_RE.test(raw)) {
    return raw;
  }

  // Otherwise translate cleanly so Arabic UI never displays English and English UI never displays Arabic
  if (!ok) {
    return localizeApiError(raw, undefined, locale, t);
  }
  return t?.savedSuccess || (isAr ? 'تمت العملية بنجاح.' : 'Operation completed successfully.');
}
