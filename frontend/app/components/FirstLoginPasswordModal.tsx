'use client';
import { FormEvent, useState } from 'react';
import BrandMark from '../BrandMark';
import PasswordInput, { validateFlexiblePassword } from './PasswordInput';
import type { User } from './types';

export default function FirstLoginPasswordModal({
  user,
  onSubmit,
  onLogout,
}: {
  user: User;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const policyErr = validateFlexiblePassword(newPassword);
    if (policyErr) {
      setError(policyErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقتين.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(currentPassword, newPassword);
    } catch (err: any) {
      setError(err?.message || 'تعذر تحديث كلمة المرور. يرجى التحقق من كلمة المرور المؤقتة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="first-login-title"
      dir="rtl"
      className="fixed inset-0 z-[90] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <form onSubmit={handleSubmit} className="card max-w-md w-full p-7 shadow-2xl">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <BrandMark size={44} compact />
          <div>
            <span className="text-[11px] font-bold text-sky-700">تأمين الحساب عند أول دخول</span>
            <h2 id="first-login-title" className="text-lg font-extrabold text-slate-900">
              تعيين كلمة مرور جديدة
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600 leading-7">
          مرحباً <b className="text-slate-900">{user.username}</b>، تم إنشاء حسابك بكلمة مرور مؤقتة.
          يرجى تعيين كلمة مرور شخصية جديدة قبل الدخول إلى الأرشيف.
        </p>

        <div className="mt-4 rounded-xl bg-sky-50/80 border border-sky-100 p-3 text-xs text-sky-900 leading-6">
          متطلبات كلمة المرور المرنة: 6 أحرف على الأقل وتحتوي على حرفين وأرقام أو رموز (مثال: <span dir="ltr" className="font-mono font-bold">ab1234</span>).
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-xs font-bold text-slate-700">
            كلمة المرور المؤقتة (الحالية)
            <PasswordInput
              wrapperClassName="mt-1.5"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="أدخل كلمة المرور المؤقتة"
              autoComplete="current-password"
              required
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            كلمة المرور الجديدة
            <PasswordInput
              wrapperClassName="mt-1.5"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="مثال: ab1234"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            تأكيد كلمة المرور الجديدة
            <PasswordInput
              wrapperClassName="mt-1.5"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="أعد كتابة كلمة المرور الجديدة"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={onLogout} className="btn btn-muted text-xs">
            تسجيل الخروج
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary flex-1 text-sm">
            {busy ? 'جاري الحفظ...' : 'حفظ كلمة المرور والدخول للأرشيف'}
          </button>
        </div>
      </form>
    </div>
  );
}
