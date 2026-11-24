'use client';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) {
      setIsInstalled(true);
      return;
    }

    const ua = window.navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
    setIsIOS(iosDevice);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSGuide(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (isInstalled || (!deferredPrompt && !isIOS)) {
    return null;
  }

  async function handleInstall() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    if (isIOS) {
      setShowIOSGuide(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={
          dark
            ? 'w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/30 bg-sky-500/15 px-3 py-2.5 text-xs font-bold text-sky-100 hover:bg-sky-500/25 transition-colors'
            : `btn inline-flex items-center gap-2 text-xs ${
                compact
                  ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 px-3 py-2'
                  : 'btn-primary'
              }`
        }
      >
        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>تثبيت التطبيق</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowIOSGuide(false);
          }}
        >
          <div className="card max-w-md w-full p-6 text-right" dir="rtl">
            <h3 className="text-base font-extrabold text-slate-900">تثبيت تطبيق نظام الأرشفة الإلكتروني</h3>
            <p className="text-sm text-slate-600 mt-2 leading-7">
              لتثبيت التطبيق على جهاز iPhone أو iPad، اضغط على زر <b>المشاركة</b> في متصفح Safari ثم اختر{' '}
              <b>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</b>.
            </p>
            <div className="mt-5 flex justify-end">
              <button type="button" className="btn btn-primary text-xs" onClick={() => setShowIOSGuide(false)}>
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
