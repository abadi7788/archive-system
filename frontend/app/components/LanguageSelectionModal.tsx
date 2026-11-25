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
      ? 'min-h-[100svh] bg-[#F1F5F9] dark:bg-[#0B1120] flex items-center justify-center p-4 sm:p-6 transition-colors'
      : 'fixed inset-0 z-[95] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4';

  return (
    <div
      role={variant === 'modal' ? 'dialog' : 'main'}
      aria-modal={variant === 'modal' ? 'true' : undefined}
      aria-labelledby="lang-select-title"
      dir={previewDir}
      className={wrapperClass}
    >
      <div className="card w-full max-w-xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-200/80 dark:border-slate-800">
          <BrandMark size={44} />
          <div className="min-w-0">
            <h1 id="lang-select-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {previewT.chooseLanguageTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {previewT.chooseLanguageSubtitle}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {LANGUAGES.map((lang) => {
            const active = selected === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => setSelected(lang.code)}
                className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-start transition-colors ${
                  active
                    ? 'border-blue-600 bg-blue-50/90 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <span className="block text-sm font-semibold truncate">{lang.nativeName}</span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {lang.englishName}
                  </span>
                </div>
                {active && (
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white grid place-items-center shrink-0">
                    <AppIcon name="check" size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="btn btn-primary px-6 py-2.5 text-sm"
          >
            {saving ? previewT.saving : previewT.saveAndContinue}
          </button>
        </div>
      </div>
    </div>
  );
}
