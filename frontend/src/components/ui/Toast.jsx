import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

const toastStore = create((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Date.now() + Math.random();
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 5000);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  }))
}));

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
};

const colors = {
  success: 'bg-emerald-500/90 backdrop-blur-sm border-emerald-400/30',
  error: 'bg-red-500/90 backdrop-blur-sm border-red-400/30',
  warning: 'bg-amber-500/90 backdrop-blur-sm border-amber-400/30',
  info: 'bg-[var(--primary)]/90 backdrop-blur-sm border-[var(--primary)]/30'
};

export function ToastContainer() {
  const { toasts, removeToast } = toastStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = icons[toast.type] || Info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-white shadow-lg border',
                colors[toast.type] || colors.info
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-2 rounded-lg p-1 hover:bg-white/20 transition-colors flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export const toast = {
  success: (message) => toastStore.getState().addToast({ type: 'success', message }),
  error: (message) => toastStore.getState().addToast({ type: 'error', message }),
  warning: (message) => toastStore.getState().addToast({ type: 'warning', message }),
  info: (message) => toastStore.getState().addToast({ type: 'info', message })
};
