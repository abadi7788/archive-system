'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import BrandMark from '../BrandMark';

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
      // If first automatic poll fails, briefly show reconnecting and retry once quickly before declaring offline.
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
  dark = false,
  onClick,
}: {
  status: ConnectionState;
  dark?: boolean;
  onClick?: () => void;
}) {
  const config =
    status === 'online'
      ? {
          label: 'النظام نشط',
          dot: 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]',
          lightWrap: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-800',
          darkWrap: 'border-emerald-400/25 bg-emerald-500/15 text-emerald-200',
        }
      : status === 'reconnecting'
      ? {
          label: 'جاري إعادة الاتصال...',
          dot: 'bg-amber-400 animate-pulse shadow-[0_0_0_4px_rgba(251,191,36,0.2)]',
          lightWrap: 'border-amber-200 bg-amber-50 text-amber-800',
          darkWrap: 'border-amber-400/30 bg-amber-500/15 text-amber-200',
        }
      : {
          label: 'انقطاع الاتصال',
          dot: 'bg-rose-500 shadow-[0_0_0_4px_rgba(244,63,94,0.2)]',
          lightWrap: 'border-rose-200 bg-rose-50 text-rose-800',
          darkWrap: 'border-rose-400/30 bg-rose-500/15 text-rose-200',
        };

  return (
    <button
      type="button"
      onClick={onClick}
      title="فحص حالة الاتصال بالسيرفر"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
        dark ? config.darkWrap : config.lightWrap
      }`}
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
  onRetry,
}: {
  status: ConnectionState;
  reason: DisconnectReason;
  checking: boolean;
  onRetry: () => void;
}) {
  if (status === 'online') return null;

  const isNetworkOffline =
    reason === 'network_offline' || (typeof navigator !== 'undefined' && !navigator.onLine);

  const title = isNetworkOffline ? 'لا يوجد اتصال بالإنترنت' : 'السيرفر غير متاح حالياً';
  const message = isNetworkOffline
    ? 'لا يوجد اتصال بالإنترنت: يبدو أن الإنترنت منقطع لديك حالياً. يرجى التحقق من اتصالك بالشبكة ثم المحاولة مجدداً.'
    : 'السيرفر غير متاح حالياً: تعذّر الوصول إلى سيرفر الأرشفة (قد يكون السيرفر قيد الصيانة أو في وضع السكون). يرجى المحاولة مجدداً بعد دقائق، وإذا استمرت المشكلة يرجى إبلاغ قسم الـ IT لحلها.';

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="system-status-title"
      dir="rtl"
      className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="card max-w-lg w-full p-7 sm:p-8 text-center border-slate-200/90 shadow-2xl">
        <div className="mx-auto mb-5 flex justify-center">
          <div className="relative">
            <BrandMark size={64} />
            <span
              className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full border-2 border-white ${
                status === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
              }`}
            />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold mb-4 border bg-slate-50 text-slate-700 border-slate-200">
          <span
            className={`w-2 h-2 rounded-full ${
              status === 'reconnecting' ? 'bg-amber-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span>{status === 'reconnecting' ? 'جاري إعادة الاتصال...' : 'انقطاع الاتصال'}</span>
        </div>

        <h2 id="system-status-title" className="text-xl font-extrabold text-slate-900">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{message}</p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onRetry}
            disabled={checking}
            className="btn btn-primary w-full sm:w-auto min-w-[170px] inline-flex items-center justify-center gap-2"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={checking ? 'animate-spin' : ''}
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
            <span>{checking ? 'جاري إعادة الاتصال...' : 'إعادة المحاولة'}</span>
          </button>
        </div>

        <p className="mt-5 text-[11px] text-slate-400">
          يتم فحص حالة نظام الأرشفة الإلكتروني تلقائياً كل 30 ثانية.
        </p>
      </div>
    </div>
  );
}
