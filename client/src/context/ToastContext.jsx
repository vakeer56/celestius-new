import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const queuePersistentToast = (message, type = 'error', duration = 12000) => {
  try {
    const existing = JSON.parse(sessionStorage.getItem('celestius_toast_queue') || '[]');
    existing.push({
      id: 'persisted_' + Date.now() + Math.random().toString(36).substring(2, 6),
      message,
      type,
      duration,
      created: Date.now(),
    });
    sessionStorage.setItem('celestius_toast_queue', JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to queue persistent toast:', err);
  }
};

// Individual Toast Item with ultra-clean modern design and fluid spring physics
const ToastItem = ({ toast, onRemove }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const timerRef = React.useRef(null);
  const startTimeRef = React.useRef(Date.now());
  const remainingRef = React.useRef(toast.duration || 6000);

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 260);
  }, [onRemove, toast.id]);

  const startTimer = useCallback(() => {
    if (toast.duration <= 0) return;
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, remainingRef.current);
  }, [toast.duration, handleDismiss]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isHovered) {
      startTimer();
    } else {
      // Pause countdown and preserve remaining time silently on hover
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(remainingRef.current - elapsed, 2000);
      clearTimer();
    }

    return () => clearTimer();
  }, [isHovered, startTimer, clearTimer]);

  // Clean, refined modern aesthetics (Completely free of any cyber/gaming/sci-fi theme)
  let theme = {
    iconBg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    icon: <AlertCircle className="w-4 h-4" strokeWidth={2.2} />,
    progressBar: 'bg-rose-500/40'
  };

  if (toast.type === 'success') {
    theme = {
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      icon: <CheckCircle2 className="w-4 h-4" strokeWidth={2.2} />,
      progressBar: 'bg-emerald-500/40'
    };
  } else if (toast.type === 'warning') {
    theme = {
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      icon: <AlertTriangle className="w-4 h-4" strokeWidth={2.2} />,
      progressBar: 'bg-amber-400/40'
    };
  } else if (toast.type === 'info') {
    theme = {
      iconBg: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      icon: <Info className="w-4 h-4" strokeWidth={2.2} />,
      progressBar: 'bg-sky-400/40'
    };
  }

  return (
    <div
      role="alert"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        animation: isExiting
          ? 'toastBounceOut 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          : 'toastBounceIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-[#121316]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[0_16px_36px_rgba(0,0,0,0.55),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] px-4 py-3.5 flex items-center gap-3.5 select-text group/toast w-full transition-shadow duration-200 hover:shadow-[0_20px_44px_rgba(0,0,0,0.65)]"
    >
      {/* Subtle top edge gloss */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

      {/* Gentle entrance gleam sweep */}
      <div
        className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -translate-x-full"
        style={{
          animation: 'toastShineSweep 0.8s ease-out 0.1s 1'
        }}
      />

      {/* Clean circular icon pill */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme.iconBg} transition-transform duration-200 group-hover/toast:scale-105`}>
        {theme.icon}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-sans font-medium text-zinc-100 leading-snug tracking-[-0.01em] break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-3.5 h-3.5" strokeWidth={2.2} />
      </button>

      {/* Micro hairline progress indicator */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 inset-x-0 h-[1.5px] bg-white/[0.04] overflow-hidden">
          <div
            className={`h-full ${theme.progressBar} transition-all`}
            style={{
              animation: `toastProgress ${toast.duration}ms linear forwards`,
              animationPlayState: isHovered ? 'paused' : 'running'
            }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'error', duration = 6000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    return id;
  }, []);

  // Load any persistent queued toasts on mount (e.g. across OAuth redirects)
  useEffect(() => {
    try {
      const queued = JSON.parse(sessionStorage.getItem('celestius_toast_queue') || '[]');
      if (queued.length > 0) {
        sessionStorage.removeItem('celestius_toast_queue');
        queued.forEach((item) => {
          showToast(item.message, item.type, item.duration || 8000);
        });
      }
    } catch {
      // ignore JSON parse error
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Keyframes: Fluid Spring Entrance, Exit & Progress */}
      <style>{`
        @keyframes toastBounceIn {
          0% {
            opacity: 0;
            transform: translateY(-28px) scale(0.92);
            filter: blur(8px);
          }
          60% {
            opacity: 1;
            transform: translateY(3px) scale(1.02);
            filter: blur(0px);
          }
          80% {
            transform: translateY(-1px) scale(0.995);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
        }
        @keyframes toastBounceOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0px);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(0.94);
            filter: blur(6px);
          }
        }
        @keyframes toastShineSweep {
          0% { transform: translateX(-100%); opacity: 0; }
          30% { opacity: 0.15; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {/* Toast Render Overlay */}
      <div className="fixed top-5 right-5 sm:top-6 sm:right-6 z-[99999] flex flex-col gap-2.5 pointer-events-none max-w-sm sm:max-w-md w-full px-4 sm:px-0">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
