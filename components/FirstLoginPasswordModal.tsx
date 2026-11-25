'use client';
import { FormEvent, useState } from 'react';
import BrandMark from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';
import PasswordInput, { validateFlexiblePassword } from './PasswordInput';
import type { User } from './types';

export default function FirstLoginPasswordModal({
  user,
  t,
  dir,
  onSubmit,
  onLogout,
}: {
  user: User;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onSubmit: (newPassword: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const policyErr = validateFlexiblePassword(newPassword, t.passwordPolicyError);
    if (policyErr) {
      setError(policyErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(newPassword);
    } catch (err: any) {
      setError(err?.message || t.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-title"
      dir={dir}
      className="min-h-[100svh] auth-canvas flex items-center justify-center p-4 sm:p-8 transition-colors"
    >
      <form onSubmit={handleSubmit} className="card-elevated max-w-md w-full overflow-hidden">
        <div className="px-6 sm:px-8 pt-7 pb-5 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center gap-3.5">
          <BrandMark size={44} compact />
          <div className="min-w-0">
            <h1
              id="first-login-title"
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white"
            >
              {t.firstLoginTitle}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" dir="auto">
              {user.full_name?.trim() || user.username}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 pt-5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-relaxed">
            {t.firstLoginDesc}
          </p>

          <p className="mt-3.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/80 px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.passwordPolicyHint}
          </p>

          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.newPasswordLabel}
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                minLength={6}
                required
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.confirmPasswordLabel}
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                minLength={6}
                required
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-200/90 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          <div className="mt-6 pt-5 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-3">
            <button type="button" onClick={onLogout} className="btn btn-muted text-xs">
              {t.logout}
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary flex-1 text-xs py-2.5">
              {busy ? t.saving : t.savePasswordContinue}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
