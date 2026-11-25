'use client';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton({
  compact = false,
  dark = false,
  label = 'تثبيت التطبيق',
  closeLabel = 'حسناً',
  dir = 'rtl',
}: {
  compact?: boolean;
  dark?: boolean;
  label?: string;
  closeLabel?: string;
  dir?: 'rtl' | 'ltr';
}) {
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
            ? 'w-full flex items-center justify-center gap-2 rounded-lg border border-blue-400/25 bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/25 transition-colors'
            : `btn inline-flex items-center gap-2 text-xs ${
                compact
                  ? 'border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 px-3 py-2'
                  : 'btn-primary'
              }`
        }
      >
        <svg
          aria-hidden="true"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>{label}</span>
      </button>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[95] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowIOSGuide(false);
          }}
        >
          <div className="card max-w-md w-full p-6 text-start" dir={dir}>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{label}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              {dir === 'rtl'
                ? 'لتثبيت التطبيق على iPhone أو iPad، اضغط على زر المشاركة في Safari ثم اختر "إضافة إلى الشاشة الرئيسية".'
                : 'To install on iPhone or iPad, tap the Share button in Safari and select "Add to Home Screen".'}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => setShowIOSGuide(false)}
              >
                {closeLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
