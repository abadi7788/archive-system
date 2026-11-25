'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import BrandMark from '../../BrandMark';
import PasswordInput from '../../components/PasswordInput';
import type { LocaleCode } from '../../components/types';
import { LANGUAGES, getDirection, getTranslations } from '../../lib/i18n';

const SHARED_COPY: Record<
  LocaleCode,
  {
    title: string;
    subtitle: string;
    password: string;
    open: string;
    wrong: string;
    summary: string;
    text: string;
    close: string;
    locked: string;
  }
> = {
  ar: {
    title: 'مستند مشترك آمن',
    subtitle: 'أدخل كلمة مرور المشاركة لعرض المستند.',
    password: 'كلمة مرور المشاركة',
    open: 'فتح المستند',
    wrong: 'الرابط أو كلمة المرور غير صالحة.',
    summary: 'الملخص',
    text: 'النص المستخرج',
    close: 'لا توجد معاينة متاحة',
    locked: 'تم قفل الرابط مؤقتاً بسبب محاولات متكررة. يُرجى المحاولة لاحقاً.',
  },
  en: {
    title: 'Secure Shared Document',
    subtitle: 'Enter the share password to view this document.',
    password: 'Share Password',
    open: 'Open Document',
    wrong: 'Invalid share link or password.',
    summary: 'Summary',
    text: 'Extracted Text',
    close: 'Preview unavailable',
    locked: 'This link is temporarily locked. Please try again later.',
  },
  fr: {
    title: 'Document partagé sécurisé',
    subtitle: 'Saisissez le mot de passe pour consulter ce document.',
    password: 'Mot de passe de partage',
    open: 'Ouvrir le document',
    wrong: 'Lien ou mot de passe invalide.',
    summary: 'Résumé',
    text: 'Texte extrait',
    close: 'Aperçu indisponible',
    locked: 'Lien temporairement verrouillé. Réessayez plus tard.',
  },
  es: {
    title: 'Documento compartido seguro',
    subtitle: 'Introduce la contraseña de acceso para ver el documento.',
    password: 'Contraseña de acceso',
    open: 'Abrir documento',
    wrong: 'Enlace o contraseña no válidos.',
    summary: 'Resumen',
    text: 'Texto extraído',
    close: 'Vista previa no disponible',
    locked: 'Enlace bloqueado temporalmente. Inténtalo más tarde.',
  },
  tr: {
    title: 'Güvenli Paylaşılan Belge',
    subtitle: 'Belgeyi görüntülemek için paylaşım parolasını girin.',
    password: 'Paylaşım parolası',
    open: 'Belgeyi aç',
    wrong: 'Bağlantı veya parola geçersiz.',
    summary: 'Özet',
    text: 'Çıkarılan metin',
    close: 'Önizleme kullanılamıyor',
    locked: 'Bağlantı geçici olarak kilitlendi. Daha sonra deneyin.',
  },
  de: {
    title: 'Sicher geteiltes Dokument',
    subtitle: 'Geben Sie das Freigabe-Passwort ein, um das Dokument anzuzeigen.',
    password: 'Freigabe-Passwort',
    open: 'Dokument öffnen',
    wrong: 'Ungültiger Link oder falsches Passwort.',
    summary: 'Zusammenfassung',
    text: 'Extrahierter Text',
    close: 'Vorschau nicht verfügbar',
    locked: 'Der Link ist vorübergehend gesperrt. Versuchen Sie es später.',
  },
  ru: {
    title: 'Защищённый общий документ',
    subtitle: 'Введите пароль доступа для просмотра документа.',
    password: 'Пароль доступа',
    open: 'Открыть документ',
    wrong: 'Неверная ссылка или пароль.',
    summary: 'Краткое описание',
    text: 'Распознанный текст',
    close: 'Предпросмотр недоступен',
    locked: 'Ссылка временно заблокирована. Попробуйте позже.',
  },
  zh: {
    title: '安全共享文档',
    subtitle: '请输入分享密码以查看此文档。',
    password: '分享密码',
    open: '打开文档',
    wrong: '链接或密码无效。',
    summary: '摘要',
    text: '识别文本',
    close: '无法预览',
    locked: '链接已暂时锁定，请稍后重试。',
  },
  ja: {
    title: '安全な共有文書',
    subtitle: '閲覧するには共有パスワードを入力してください。',
    password: '共有パスワード',
    open: '文書を開く',
    wrong: 'リンクまたはパスワードが無効です。',
    summary: '概要',
    text: '抽出テキスト',
    close: 'プレビューを利用できません',
    locked: 'リンクは一時的にロックされています。後でもう一度お試しください。',
  },
  hi: {
    title: 'सुरक्षित साझा दस्तावेज़',
    subtitle: 'दस्तावेज़ देखने के लिए शेयर पासवर्ड दर्ज करें।',
    password: 'शेयर पासवर्ड',
    open: 'दस्तावेज़ खोलें',
    wrong: 'लिंक या पासवर्ड अमान्य है।',
    summary: 'सारांश',
    text: 'निकाला गया पाठ',
    close: 'पूर्वावलोकन उपलब्ध नहीं',
    locked: 'लिंक अस्थायी रूप से लॉक है। बाद में प्रयास करें।',
  },
  ur: {
    title: 'محفوظ شیئر کردہ دستاویز',
    subtitle: 'دستاویز دیکھنے کے لیے شیئر پاس ورڈ درج کریں۔',
    password: 'شیئر پاس ورڈ',
    open: 'دستاویز کھولیں',
    wrong: 'لنک یا پاس ورڈ درست نہیں۔',
    summary: 'خلاصہ',
    text: 'نکالا گیا متن',
    close: 'پیش منظر دستیاب نہیں',
    locked: 'لنک عارضی طور پر لاک ہے۔ کچھ دیر بعد کوشش کریں۔',
  },
};

export default function SharedDocument() {
  const params = useParams<{ token?: string }>();
  const [token, setToken] = useState('');
  const [lang, setLang] = useState<LocaleCode>('ar');
  const [password, setPassword] = useState('');
  const [doc, setDoc] = useState<any>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const copy = SHARED_COPY[lang] || SHARED_COPY.ar;
  const appT = getTranslations(lang);
  const dir = getDirection(lang);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    let candidate = params.token || hash;
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      // ignore decode errors
    }
    setToken(candidate);
    if (hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [params.token]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError(copy.wrong);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const base = `/api/v1/shared/${encodeURIComponent(token)}`;
      const body = JSON.stringify({ password });
      const headers = {
        'Content-Type': 'application/json',
        'Accept-Language': lang,
      };
      const a = await fetch(`${base}/details`, {
        method: 'POST',
        headers,
        body,
        cache: 'no-store',
      });
      if (!a.ok) {
        setError(a.status === 429 ? copy.locked : copy.wrong);
        return;
      }
      const d = await a.json();
      const f = await fetch(`${base}/file`, {
        method: 'POST',
        headers,
        body,
        cache: 'no-store',
      });
      if (!f.ok) {
        setError(f.status === 429 ? copy.locked : copy.wrong);
        return;
      }
      const blob = await f.blob();
      setUrl(URL.createObjectURL(blob));
      setDoc(d);
      setPassword('');
    } catch {
      setError(copy.wrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="min-h-[100svh] auth-canvas p-4 sm:p-8 transition-colors"
      dir={dir}
    >
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size={38} compact />
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white truncate">
              {appT.appName}
            </span>
          </div>
          <select
            aria-label={appT.languageLabel}
            className="field w-40 py-2 text-xs"
            value={lang}
            onChange={(e) => setLang(e.target.value as LocaleCode)}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
        </header>

        {!doc ? (
          <form
            onSubmit={submit}
            className="card-elevated max-w-md mx-auto p-7 sm:p-8 mt-14"
          >
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{copy.title}</h1>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {copy.subtitle}
            </p>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mt-6 mb-1.5">
              {copy.password}
            </label>
            <PasswordInput
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              showLabel={appT.showPassword}
              hideLabel={appT.hidePassword}
              required
            />
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary w-full mt-5 py-2.5 text-sm"
              disabled={busy || !token}
            >
              {busy ? '…' : copy.open}
            </button>
          </form>
        ) : (
          <section className="card-elevated overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {doc.file_name}
              </h1>
            </div>
            <div className="grid lg:grid-cols-[1.45fr_1fr] min-h-[75vh]">
              <div className="bg-slate-100/90 dark:bg-slate-950/80 p-3 sm:p-4">
                {doc.mime_type === 'application/pdf' ? (
                  <iframe
                    src={url}
                    title={doc.file_name}
                    className="w-full h-[75vh] bg-white rounded-xl border border-slate-200 dark:border-slate-800"
                  />
                ) : (
                  <img
                    src={url}
                    alt={doc.file_name}
                    referrerPolicy="no-referrer"
                    className="w-full h-[75vh] object-contain rounded-xl bg-white dark:bg-slate-900"
                  />
                )}
              </div>
              <aside className="p-5 sm:p-6 border-t lg:border-t-0 lg:border-s border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {copy.summary}
                </h2>
                <p className="text-sm text-slate-800 dark:text-slate-200 mt-2 leading-relaxed">
                  {doc.summary || '—'}
                </p>
                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-6">
                  {copy.text}
                </h2>
                <pre
                  className="mt-2 whitespace-pre-wrap select-text max-h-[56vh] overflow-auto text-sm leading-7 text-slate-700 dark:text-slate-200 font-sans"
                  dir="auto"
                >
                  {doc.extracted_text || copy.close}
                </pre>
              </aside>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
