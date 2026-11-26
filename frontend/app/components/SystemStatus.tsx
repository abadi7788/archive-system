'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import BrandMark from '../BrandMark';
import type { TranslationKeys } from '../lib/i18n';

export type ConnectionState = 'online' | 'reconnecting' | 'offline';
export type DisconnectReason = 'network_offline' | 'server_unreachable' | null;

const HEALTH_URL = '/api/v1/health';
const POLL_INTERVAL_MS = 30000;
const HEALTH_TIMEOUT_MS = 8000;

export function useSystemHealth() {
  const [status, setStatus] = useState<ConnectionState>('online');
  const [reason, setReason] = useState<DisconnectReason>(null);
  const [checking, setChecking] = useState(false);
  const mountedRef = useRef(true);

  const checkHealth = useCallback(async (isManualRetry = false) => {
    if (typeof window === 'undefined') return true;
    if (!navigator.onLine) {
      if (mountedRef.current) {
        setStatus('offline');
        setReason('network_offline');
        setChecking(false);
      }
      return false;
    }

    if (mountedRef.current) {
      setChecking(true);
      if (isManualRetry) {
        setStatus('reconnecting');
      }
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    try {
      const response = await fetch(HEALTH_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      if (response.ok) {
        if (mountedRef.current) {
          setStatus('online');
          setReason(null);
          setChecking(false);
        }
        return true;
      }
      throw new Error(`HTTP ${response.status}`);
    } catch {
      window.clearTimeout(timer);
      if (!mountedRef.current) return false;
      if (!navigator.onLine) {
        setStatus('offline');
        setReason('network_offline');
        setChecking(false);
        return false;
      }
      if (!isManualRetry) {
        setStatus('reconnecting');
        const retryController = new AbortController();
        const retryTimer = window.setTimeout(() => retryController.abort(), 5000);
        try {
          const retryRes = await fetch(HEALTH_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: retryController.signal,
          });
          window.clearTimeout(retryTimer);
          if (retryRes.ok) {
            if (mountedRef.current) {
              setStatus('online');
              setReason(null);
              setChecking(false);
            }
            return true;
          }
        } catch {
          window.clearTimeout(retryTimer);
        }
      }
      if (mountedRef.current) {
        setStatus('offline');
        setReason(navigator.onLine ? 'server_unreachable' : 'network_offline');
        setChecking(false);
      }
      return false;
    }
  }, []);

  const reportConnectionFailure = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.onLine) {
      setStatus('offline');
      setReason('network_offline');
    } else {
      setStatus('offline');
      setReason('server_unreachable');
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    checkHealth(false);

    const interval = window.setInterval(() => {
      checkHealth(false);
    }, POLL_INTERVAL_MS);

    const handleOffline = () => {
      setStatus('offline');
      setReason('network_offline');
    };
    const handleOnline = () => {
      setStatus('reconnecting');
      checkHealth(true);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkHealth]);

  return {
    status,
    reason,
    checking,
    retry: () => checkHealth(true),
    reportConnectionFailure,
  };
}

export function SystemStatusPill({
  status,
  t,
  onClick,
}: {
  status: ConnectionState;
  t: TranslationKeys;
  onClick?: () => void;
}) {
  const config =
    status === 'online'
      ? {
          label: t.statusOnline,
          dot: 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.16)]',
          wrap: 'border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/70',
        }
      : status === 'reconnecting'
      ? {
          label: t.statusReconnecting,
          dot: 'bg-amber-500 animate-pulse shadow-[0_0_0_3px_rgba(245,158,11,0.18)]',
          wrap: 'border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100/70',
        }
      : {
          label: t.statusOffline,
          dot: 'bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]',
          wrap: 'border-rose-200/80 dark:border-rose-800/60 bg-rose-50/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100/70',
        };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${config.wrap}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <span>{config.label}</span>
    </button>
  );
}

export function SystemStatusOverlay({
  status,
  reason,
  checking,
  t,
  dir,
  onRetry,
}: {
  status: ConnectionState;
  reason: DisconnectReason;
  checking: boolean;
  t: TranslationKeys;
  dir: 'rtl' | 'ltr';
  onRetry: () => void;
}) {
  if (status === 'online') return null;

  const isNetworkOffline =
    reason === 'network_offline' || (typeof navigator !== 'undefined' && !navigator.onLine);

  const title = isNetworkOffline ? t.offlineTitle : t.serverUnavailableTitle;
  const message = isNetworkOffline ? t.offlineMessage : t.serverUnavailableMessage;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="system-status-title"
      dir={dir}
      className="fixed inset-0 z-[100] bg-[#091524]/70 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="card-elevated max-w-md w-full p-7 sm:p-8 text-center">
        <div className="mx-auto mb-5 flex justify-center">
          <div className="p-2.5 rounded-2xl bg-brand-50 dark:bg-[#132942] ring-1 ring-[#0891B2]/20">
            <BrandMark size={52} />
          </div>
        </div>

        <h2 id="system-status-title" className="text-lg font-bold text-[#0F2137] dark:text-white">
          {title}
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={onRetry}
            disabled={checking}
            className="btn btn-primary min-w-[170px]"
          >
            {checking ? t.statusReconnecting : t.retry}
          </button>
        </div>
      </div>
    </div>
  );
}
