'use client';
import { FormEvent, useState } from 'react';
import BrandMark, { AppIcon } from '../BrandMark';
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
        <div className="vault-showcase px-6 sm:px-8 py-6 flex items-center gap-3.5 text-white border-b border-white/10">
          <BrandMark size={44} compact />
          <div className="min-w-0">
            <h1
              id="first-login-title"
              className="text-base sm:text-lg font-bold tracking-tight text-white"
            >
              {t.firstLoginTitle}
            </h1>
            <p className="text-xs text-slate-300 truncate mt-0.5" dir="auto">
              {user.full_name?.trim() || user.username}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 pt-6">
          <p className="text-sm font-medium text-[#0F2137] dark:text-slate-200 leading-relaxed">
            {t.firstLoginDesc}
          </p>

          <div className="mt-3.5 rounded-xl bg-brand-50/75 dark:bg-[#132942] border border-brand-200/80 dark:border-[#0891B2]/30 px-3.5 py-2.5 flex items-start gap-2.5 text-xs text-[#155E75] dark:text-cyan-200 leading-relaxed">
            <AppIcon name="shield" size={15} className="mt-0.5 shrink-0 text-[#0E7490] dark:text-[#22D3EE]" />
            <span>{t.passwordPolicyHint}</span>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.newPasswordLabel}
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                startIcon={<AppIcon name="lock" size={16} />}
                minLength={6}
                required
              />
            </label>

            <label className="block text-xs font-semibold text-[#0F2137] dark:text-slate-300">
              {t.confirmPasswordLabel}
              <PasswordInput
                wrapperClassName="mt-1.5"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                startIcon={<AppIcon name="lock" size={16} />}
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

          <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
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
