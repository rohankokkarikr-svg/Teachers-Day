import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ToastMessage, ToastType } from '../../types';
import { generateId } from '../../lib/utils';

// Toast store - simple pub/sub pattern
type ToastListener = (toasts: ToastMessage[]) => void;
let toasts: ToastMessage[] = [];
const listeners: Set<ToastListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function showToast(
  type: ToastType,
  title: string,
  message?: string,
  duration = 4000
) {
  const toast: ToastMessage = {
    id: generateId(),
    type,
    title,
    message,
    duration,
  };
  toasts = [...toasts, toast];
  notifyListeners();

  if (duration > 0) {
    setTimeout(() => {
      dismissToast(toast.id);
    }, duration);
  }
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notifyListeners();
}

// Convenience exports
export const toast = {
  success: (title: string, message?: string) => showToast('success', title, message),
  error: (title: string, message?: string) => showToast('error', title, message, 6000),
  warning: (title: string, message?: string) => showToast('warning', title, message),
  info: (title: string, message?: string) => showToast('info', title, message),
};

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error: <AlertCircle size={18} className="text-rose-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info: <Info size={18} className="text-primary-400" />,
};

const borderMap: Record<ToastType, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  warning: 'border-l-amber-500',
  info: 'border-l-primary-500',
};

export default function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener: ToastListener = (newToasts) => setCurrentToasts(newToasts);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const handleDismiss = useCallback((id: string) => {
    dismissToast(id);
  }, []);

  return (
    <div
      className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {currentToasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`glass-card border-l-4 ${borderMap[t.type]} p-4 pointer-events-auto`}
            role="alert"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{iconMap[t.type]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-surface-400 mt-0.5">{t.message}</p>
                )}
              </div>
              <button
                onClick={() => handleDismiss(t.id)}
                className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
