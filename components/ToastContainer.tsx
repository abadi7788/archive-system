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
            ? 'bg-white/95 dark:bg-[#0E1525]/95 border-emerald-200/80 dark:border-emerald-800/70 text-slate-900 dark:text-slate-100'
            : toast.type === 'err'
            ? 'bg-white/95 dark:bg-[#0E1525]/95 border-rose-200/80 dark:border-rose-800/70 text-slate-900 dark:text-slate-100'
            : 'bg-white/95 dark:bg-[#0E1525]/95 border-blue-200/80 dark:border-blue-800/70 text-slate-900 dark:text-slate-100';

        const iconColor =
          toast.type === 'ok'
            ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/15 dark:bg-emerald-950/60 dark:text-emerald-400'
            : toast.type === 'err'
            ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/15 dark:bg-rose-950/60 dark:text-rose-400'
            : 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/15 dark:bg-blue-950/60 dark:text-blue-400';

        return (
          <div
            key={toast.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-center gap-3 rounded-2xl border backdrop-blur-xl px-4 py-3 shadow-xl shadow-slate-950/10 dark:shadow-black/50 ${styles}`}
          >
            <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
              <AppIcon name={toast.type === 'ok' ? 'check' : toast.type === 'err' ? 'x' : 'archive'} size={15} />
            </span>
            <p className="text-xs sm:text-sm font-medium flex-1 leading-snug">{toast.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0"
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
