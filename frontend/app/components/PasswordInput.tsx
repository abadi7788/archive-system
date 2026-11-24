'use client';
import React, { useState } from 'react';

export function validateFlexiblePassword(password: string): string | null {
  if (!password || password.length < 6) {
    return 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل (مثال: ab1234).';
  }
  const letters = (password.match(/[A-Za-z\u00C0-\u024F\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const nonLetters = password.length - letters;
  if (letters < 2 || nonLetters < 1) {
    return 'يجب أن تحتوي كلمة المرور على حرفين على الأقل وأرقام أو رموز (مثال: ab1234).';
  }
  return null;
}

export function EyeIcon({ off = false }: { off?: boolean }) {
  if (off) {
    return (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  variant?: 'field' | 'login';
  wrapperClassName?: string;
  showLabel?: string;
  hideLabel?: string;
};

export default function PasswordInput({
  variant = 'field',
  className = '',
  wrapperClassName = '',
  showLabel = 'إظهار',
  hideLabel = 'إخفاء',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  if (variant === 'login') {
    return (
      <div className={`login-input-wrap ${wrapperClassName}`}>
        <span aria-hidden="true" className="shrink-0 select-none">❖</span>
        <input
          {...props}
          type={visible ? 'text' : 'password'}
          className={`flex-1 min-w-0 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          title={visible ? hideLabel : showLabel}
          className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition-colors"
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center ${wrapperClassName}`}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`field field-icon-end ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        title={visible ? hideLabel : showLabel}
        className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-sky-700 hover:bg-slate-100 transition-colors"
      >
        <EyeIcon off={visible} />
      </button>
    </div>
  );
}
