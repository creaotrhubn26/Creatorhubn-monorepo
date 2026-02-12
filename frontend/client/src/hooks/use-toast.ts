import { useState, useCallback, useEffect } from 'react';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info';
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: string;
  open: boolean;
}

// Global toast state — shared across all useToast() consumers
let toasts: Toast[] = [];
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((fn) => fn());
}

let toastCounter = 0;

export const toast = (options: ToastOptions) => {
  const id = `toast-${++toastCounter}-${Date.now()}`;
  const newToast: Toast = { ...options, id, open: true };
  toasts = [...toasts, newToast];
  notify();

  // Auto-dismiss after duration
  const duration = options.duration ?? 4000;
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
};

export function dismissToast(id: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, open: false } : t));
  notify();
  // Clean up closed toasts after animation
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 300);
}

export function useToast() {
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    listeners.add(forceUpdate);
    return () => {
      listeners.delete(forceUpdate);
    };
  }, [forceUpdate]);

  return {
    toast,
    toasts,
    dismiss: dismissToast,
  };
}

