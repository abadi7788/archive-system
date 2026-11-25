'use client';
import React, { useState } from 'react';

export function validateFlexiblePassword(password: string, errorMessage?: string): string | null {
  if (!password || password.length < 6) {
    return errorMessage || 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل وتتضمن حرفين ورقماً أو رمزاً.';
  }
  const letters = (password.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const nonLetters = password.length - letters;
  if (letters < 2 || nonLetters < 1) {
    return errorMessage || 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل وتتضمن حرفين ورقماً أو رمزاً.';
  }
  return null;
}

export function EyeIcon({ off = false }: { off?: boolean }) {
  if (off) {
    return (
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  wrapperClassName?: string;
  showLabel?: string;
  hideLabel?: string;
  startIcon?: React.ReactNode;
};

export default function PasswordInput({
  className = '',
  wrapperClassName = '',
  showLabel = 'Show password',
  hideLabel = 'Hide password',
  startIcon,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative flex items-center ${wrapperClassName}`}>
      {startIcon && (
        <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
          {startIcon}
        </span>
      )}
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`field field-icon-end ${startIcon ? 'field-icon-start' : ''} ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        className="absolute end-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-[#0E7490] dark:text-slate-500 dark:hover:text-[#22D3EE] hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
