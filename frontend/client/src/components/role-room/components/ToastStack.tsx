import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FC, ReactNode } from 'react';
import {
  Alert,
  AlertColor,
  IconButton,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

export interface Toast {
  id: string;
  message: string;
  severity?: AlertColor;
  duration?: number | null;
  action?: ReactNode;
  onClose?: () => void;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, 'id'>) => void;
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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const newToast: Toast = {
        id,
        duration: null,  // Default to persistent (no auto-dismiss)
        severity: 'info',
        ...toast,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Only set timeout if duration is explicitly specified and > 0
      if (typeof newToast.duration === 'number' && newToast.duration > 0) {
        setTimeout(() => {
          removeToast(id);
          newToast.onClose?.();
        }, newToast.duration);
      }
    },
    [maxToasts, removeToast]
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'success', duration: duration ?? null });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'error', duration: duration ?? null });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'warning', duration: duration ?? null });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      showToast({ message, severity: 'info', duration: duration ?? null });
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
