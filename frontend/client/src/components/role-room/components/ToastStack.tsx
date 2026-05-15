import { createContext, useContext, useState, useCallback, useEffect, useRef, type FC, type ReactNode } from "react";
import { Alert, IconButton, Box } from "@mui/material";
import type { AlertColor } from "@mui/material/Alert";
import { Close as CloseIcon } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

// Default auto-dismiss varighet pr severity. `null` = persistent.
// success/info dempes raskt så de ikke blokkerer UI, mens error/warning
// står lenger fordi de krever lesing.
const DEFAULT_DURATION_MS: Record<AlertColor, number | null> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: 10000,
};

export interface Toast {
  id: string;
  message: string;
  severity?: AlertColor;
  duration?: number | null;
  action?: ReactNode;
  onClose?: () => void;
}

interface ToastContextType {
  /** Show a toast and return its generated id so callers kan lukke det programmatisk. */
  showToast: (toast: Omit<Toast, 'id'>) => string;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastProvider: FC<ToastProviderProps> = ({
  children,
  maxToasts = 5,
  position = 'bottom-right',
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Timer-håndtak pr toast så vi kan pause/resume ved hover.
  const dismissTimersRef = useRef<Map<string, {
    timeoutId: ReturnType<typeof setTimeout> | null;
    remainingMs: number;
    pausedAt: number | null;
    startedAt: number;
    onClose?: () => void;
  }>>(new Map());

  const removeToast = useCallback((id: string) => {
    const handle = dismissTimersRef.current.get(id);
    if (handle?.timeoutId !== null && handle?.timeoutId !== undefined) {
      clearTimeout(handle.timeoutId);
    }
    dismissTimersRef.current.delete(id);
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const scheduleDismiss = useCallback((id: string, durationMs: number, onClose?: () => void) => {
    const startedAt = Date.now();
    const timeoutId = setTimeout(() => {
      onClose?.();
      removeToast(id);
    }, durationMs);
    dismissTimersRef.current.set(id, {
      timeoutId,
      remainingMs: durationMs,
      pausedAt: null,
      startedAt,
      onClose,
    });
  }, [removeToast]);

  const pauseDismiss = useCallback((id: string) => {
    const handle = dismissTimersRef.current.get(id);
    if (!handle || handle.timeoutId === null || handle.pausedAt !== null) {
      return;
    }
    clearTimeout(handle.timeoutId);
    const elapsed = Date.now() - handle.startedAt;
    handle.remainingMs = Math.max(0, handle.remainingMs - elapsed);
    handle.timeoutId = null;
    handle.pausedAt = Date.now();
  }, []);

  const resumeDismiss = useCallback((id: string) => {
    const handle = dismissTimersRef.current.get(id);
    if (!handle || handle.timeoutId !== null || handle.pausedAt === null) {
      return;
    }
    handle.pausedAt = null;
    handle.startedAt = Date.now();
    if (handle.remainingMs <= 0) {
      handle.onClose?.();
      removeToast(id);
      return;
    }
    handle.timeoutId = setTimeout(() => {
      handle.onClose?.();
      removeToast(id);
    }, handle.remainingMs);
  }, [removeToast]);

  useEffect(() => {
    const timers = dismissTimersRef.current;
    return () => {
      timers.forEach((handle) => {
        if (handle.timeoutId !== null) {
          clearTimeout(handle.timeoutId);
        }
      });
      timers.clear();
    };
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const severity = toast.severity ?? 'info';
      const resolvedDuration = toast.duration === undefined
        ? DEFAULT_DURATION_MS[severity]
        : toast.duration;
      const newToast: Toast = {
        id,
        severity,
        ...toast,
        duration: resolvedDuration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      if (typeof newToast.duration === 'number' && newToast.duration > 0) {
        scheduleDismiss(id, newToast.duration, newToast.onClose);
      }

      return id;
    },
    [maxToasts, scheduleDismiss]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'success', duration });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'error', duration });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'warning', duration });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'info', duration });
    },
    [showToast]
  );

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 200000,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 1,
      pointerEvents: 'none',
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: 16, right: 16, alignItems: 'flex-end' };
      case 'top-left':
        return { ...baseStyles, top: 16, left: 16, alignItems: 'flex-start' };
      case 'bottom-right':
        return { ...baseStyles, bottom: 16, right: 16, alignItems: 'flex-end' };
      case 'bottom-left':
        return { ...baseStyles, bottom: 16, left: 16, alignItems: 'flex-start' };
      case 'top-center':
        return { ...baseStyles, top: 16, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
      case 'bottom-center':
        return { ...baseStyles, bottom: 16, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
      default:
        return { ...baseStyles, bottom: 16, right: 16, alignItems: 'flex-end' };
    }
  };

  const getAnimationVariants = () => {
    const isRight = position.includes('right');
    const isLeft = position.includes('left');
    const isTop = position.includes('top');
    
    return {
      initial: {
        opacity: 0,
        x: isRight ? 100 : isLeft ? -100 : 0,
        y: isTop ? -20 : 20,
        scale: 0.9,
      },
      animate: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        transition: {
          type: 'spring' as const,
          stiffness: 400,
          damping: 25,
          mass: 0.8,
        },
      },
      exit: {
        opacity: 0,
        x: isRight ? 100 : isLeft ? -100 : 0,
        scale: 0.9,
        transition: {
          duration: 0.25,
          ease: 'easeOut' as const,
        },
      },
    };
  };

  const handleClose = useCallback((toast: Toast) => {
    toast.onClose?.();
    removeToast(toast.id);
  }, [removeToast]);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeToast,
      }}
    >
      {children}
      <Box sx={getPositionStyles()}>
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              variants={getAnimationVariants()}
              initial="initial"
              animate="animate"
              exit="exit"
              onMouseEnter={() => pauseDismiss(toast.id)}
              onMouseLeave={() => resumeDismiss(toast.id)}
              onFocus={() => pauseDismiss(toast.id)}
              onBlur={() => resumeDismiss(toast.id)}
              style={{
                pointerEvents: 'auto',
                maxWidth: 'min(calc(100vw - 32px), 500px)',
                width: '100%',
              }}
            >
              <Alert
                severity={toast.severity}
                onClose={() => handleClose(toast)}
                action={
                  toast.action || (
                    <IconButton
                      size="small"
                      aria-label="close"
                      color="inherit"
                      onClick={() => handleClose(toast)}
                      sx={{
                        '&:hover': {
                          bgcolor: 'rgba(0, 0, 0, 0.1)',
                        },
                      }}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )
                }
                sx={{
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                  borderRadius: 2,
                  '& .MuiAlert-message': {
                    wordBreak: 'break-word',
                  },
                  '@media (min-width: 768px) and (max-width: 1024px), (pointer: coarse)': {
                    fontSize: '16px',
                    '& .MuiAlert-icon': {
                      fontSize: '24px',
                    },
                  },
                }}
              >
                {toast.message}
              </Alert>
            </motion.div>
          ))}
        </AnimatePresence>
      </Box>
    </ToastContext.Provider>
  );
};
