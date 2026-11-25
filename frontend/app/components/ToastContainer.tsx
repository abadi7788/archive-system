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
      className="fixed bottom-4 end-4 z-[110] flex flex-col gap-2.5 max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const styles =
          toast.type === 'ok'
            ? 'bg-white/95 dark:bg-[#0F2137]/95 border-emerald-200/90 dark:border-emerald-800/70 text-[#0F2137] dark:text-slate-100'
            : toast.type === 'err'
            ? 'bg-white/95 dark:bg-[#0F2137]/95 border-rose-200/90 dark:border-rose-800/70 text-[#0F2137] dark:text-slate-100'
            : 'bg-white/95 dark:bg-[#0F2137]/95 border-brand-200/90 dark:border-brand-700/70 text-[#0F2137] dark:text-slate-100';

        const iconColor =
          toast.type === 'ok'
            ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 dark:bg-emerald-950/60 dark:text-emerald-400'
            : toast.type === 'err'
            ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/20 dark:bg-rose-950/60 dark:text-rose-400'
            : 'bg-brand-50 text-[#0E7490] ring-1 ring-[#0891B2]/20 dark:bg-brand-950/60 dark:text-[#22D3EE]';

        return (
          <div
            key={toast.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-center gap-3 rounded-2xl border backdrop-blur-xl px-4 py-3 shadow-xl shadow-[#0F2137]/12 dark:shadow-black/50 ${styles}`}
          >
            <span className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
              <AppIcon name={toast.type === 'ok' ? 'check' : toast.type === 'err' ? 'x' : 'archive'} size={15} />
            </span>
            <p className="text-xs font-semibold leading-relaxed flex-1 break-words">{toast.text}</p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-[#0F2137] dark:hover:text-slate-200 transition-colors shrink-0"
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
