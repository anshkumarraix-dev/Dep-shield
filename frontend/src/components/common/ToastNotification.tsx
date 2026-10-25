'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

interface ToastNotificationProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastNotification({ toasts, onDismiss }: ToastNotificationProps) {
  useEffect(() => {
    if (toasts.length === 0) return;

    const timer = setTimeout(() => {
      onDismiss(toasts[0].id);
    }, 4500);

    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-20 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 ${
              isSuccess
                ? 'border-emerald-500/40 bg-[#010101]/95 text-emerald-300'
                : isError
                ? 'border-rose-500/40 bg-[#010101]/95 text-rose-300'
                : 'border-[#3C3C42]/80 bg-[#010101]/95 text-[#EFEFF0]'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : isError ? (
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-[#EFEFF0] shrink-0 mt-0.5" />
            )}

            <div className="flex-1 space-y-0.5">
              <h4 className="text-xs font-bold text-[#EFEFF0] tracking-tight">
                {toast.title}
              </h4>
              <p className="text-[11px] text-[#BDBDC1] leading-snug">
                {toast.message}
              </p>
            </div>

            <button
              onClick={() => onDismiss(toast.id)}
              type="button"
              aria-label="Dismiss notification"
              className="rounded p-1 text-[#7D7E84] hover:text-[#EFEFF0] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
