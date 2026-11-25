'use client';
import React from 'react';
import { AppIcon } from '../BrandMark';
import type { ToastItem } from './types';

export default function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (!toasts.length) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 end-5 z-[110] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2.5rem)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const styles =
          toast.type === 'ok'
            ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/70 text-slate-900 dark:text-slate-100'
            : toast.type === 'err'
            ? 'bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-800/70 text-slate-900 dark:text-slate-100'
            : 'bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-800/70 text-slate-900 dark:text-slate-100';

        const iconColor =
          toast.type === 'ok'
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
            : toast.type === 'err'
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
            : 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400';

        return (
          <div
            key={toast.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-center gap-3 rounded-xl border px-3.5 py-3 shadow-lg shadow-slate-900/10 dark:shadow-black/40 ${styles}`}
          >
            <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
              <AppIcon name={toast.type === 'ok' ? 'check' : toast.type === 'err' ? 'x' : 'archive'} size={15} />
            </span>
            <p className="text-xs sm:text-sm font-medium flex-1 leading-snug">{toast.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
              aria-label="Close"
            >
              <AppIcon name="x" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
