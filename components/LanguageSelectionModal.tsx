'use client';
import React, { useState } from 'react';
import BrandMark, { AppIcon } from '../BrandMark';
import { LANGUAGES, getDirection, getTranslations } from '../lib/i18n';
import type { LocaleCode } from './types';

export default function LanguageSelectionModal({
  currentLocale,
  variant = 'page',
  onSelect,
}: {
  currentLocale: LocaleCode;
  variant?: 'page' | 'modal';
  onSelect: (locale: LocaleCode) => Promise<void> | void;
}) {
  const [selected, setSelected] = useState<LocaleCode>(currentLocale);
  const [saving, setSaving] = useState(false);

  const previewT = getTranslations(selected);
  const previewDir = getDirection(selected);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onSelect(selected);
    } finally {
      setSaving(false);
    }
  }

  const wrapperClass =
    variant === 'page'
      ? 'min-h-[100svh] auth-canvas flex items-center justify-center p-4 sm:p-8 transition-colors'
      : 'fixed inset-0 z-[95] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4';

  return (
    <div
      role={variant === 'modal' ? 'dialog' : 'main'}
      aria-modal={variant === 'modal' ? 'true' : undefined}
      aria-labelledby="lang-select-title"
      dir={previewDir}
      className={wrapperClass}
    >
      <div className="card-elevated w-full max-w-2xl overflow-hidden">
        {/* Top Executive Header */}
        <div className="px-6 sm:px-9 pt-7 sm:pt-8 pb-6 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center gap-4">
          <BrandMark size={48} />
          <div className="min-w-0">
            <h1
              id="lang-select-title"
              className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {previewT.chooseLanguageTitle}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {previewT.chooseLanguageSubtitle}
            </p>
          </div>
        </div>

        {/* Language Grid */}
        <div className="p-6 sm:p-9 pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {LANGUAGES.map((lang) => {
              const active = selected === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelected(lang.code)}
                  className={`group flex items-center justify-between gap-2.5 rounded-xl border px-4 py-3.5 text-start transition-all duration-150 ${
                    active
                      ? 'border-blue-600 bg-blue-50/80 text-blue-700 ring-1 ring-blue-600/25 dark:bg-blue-950/45 dark:border-blue-500 dark:text-blue-100'
                      : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900/70 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{lang.nativeName}</span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {lang.englishName}
                    </span>
                  </div>
                  <span
                    className={`w-5 h-5 rounded-full grid place-items-center shrink-0 transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 dark:border-slate-700 text-transparent group-hover:border-slate-400'
                    }`}
                  >
                    <AppIcon name="check" size={11} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 pt-5 border-t border-slate-200/70 dark:border-slate-800/80 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirm}
              className="btn btn-primary px-7 py-2.5 text-sm"
            >
              {saving ? previewT.saving : previewT.saveAndContinue}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
