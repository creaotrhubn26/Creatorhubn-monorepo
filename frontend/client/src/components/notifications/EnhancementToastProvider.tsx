// ZERO TOAST COMPLIANCE:
// Uses first-party Material UI feedback surfaces only (no external toast libs).
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  IconButton,
  Stack,
} from '@mui/material';
import { Close as CloseIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
  persistent?: boolean;
}

interface ToastContextType {
  showToast: (message: Omit<ToastMessage, 'id'>) => string;
  hideToast: (id: string) => void;
  showJobSuccess: (filename: string, downloadUrl?: string) => void;
  showJobError: (filename: string, error: string) => void;
  showJobStarted: (filename: string) => void;
  showNetworkError: (operation: string) => void;
  showValidationError: (field: string, reason: string) => void;
}

const DEFAULT_DURATION_MS = 5000;
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within an EnhancementToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: React.ReactNode;
  maxToasts?: number;
}

export const EnhancementToastProvider: React.FC<ToastProviderProps> = ({
  children,
  maxToasts = 3,
}) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Record<string, number>>({});
  const theming = useTheming('photographer');

  const clearToastTimer = useCallback((id: string) => {
    const timer = timersRef.current[id];
    if (timer !== undefined) {
      window.clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const hideToast = useCallback(
    (id: string) => {
      clearToastTimer(id);
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    },
    [clearToastTimer],
  );

  const generateId = useCallback(() => {
    const randomPart = Math.random().toString(36).slice(2, 10);
    return `enh-toast-${Date.now()}-${randomPart}`;
  }, []);

  const showToast = useCallback(
    (message: Omit<ToastMessage, 'id'>): string => {
      const id = generateId();
      const toast: ToastMessage = { id, ...message };

      setToasts((prev) => [toast, ...prev].slice(0, Math.max(1, maxToasts)));

      if (!toast.persistent) {
        const duration = toast.duration ?? DEFAULT_DURATION_MS;
        timersRef.current[id] = window.setTimeout(() => {
          hideToast(id);
        }, Math.max(500, duration));
      }

      return id;
    },
    [generateId, hideToast, maxToasts],
  );

  const showJobSuccess = useCallback(
    (filename: string, downloadUrl?: string) => {
      showToast({
        type: 'success',
        title: 'Forbedring fullfort',
        message: `${filename} er forbedret og klar for nedlasting.`,
        action: downloadUrl
          ? {
              label: 'Last ned',
              onClick: () => window.open(downloadUrl, '_blank', 'noopener,noreferrer'),
            }
          : undefined,
        duration: 7000,
      });
    },
    [showToast],
  );

  const showJobError = useCallback(
    (filename: string, error: string) => {
      showToast({
        type: 'error',
        title: 'Forbedring mislyktes',
        message: `Kunne ikke forbedre ${filename}: ${error}`,
        persistent: true,
      });
    },
    [showToast],
  );

  const showJobStarted = useCallback(
    (filename: string) => {
      showToast({
        type: 'info',
        title: 'Forbedring startet',
        message: `Prosesserer ${filename}...`,
        duration: 3500,
      });
    },
    [showToast],
  );

  const showNetworkError = useCallback(
    (operation: string) => {
      showToast({
        type: 'error',
        title: 'Nettverksfeil',
        message: `Kunne ikke utfore ${operation}. Sjekk internettforbindelsen.`,
        action: {
          label: 'Prove igjen',
          onClick: () => window.location.reload(),
        },
        persistent: true,
      });
    },
    [showToast],
  );

  const showValidationError = useCallback(
    (field: string, reason: string) => {
      showToast({
        type: 'warning',
        title: 'Ugyldig input',
        message: `${field}: ${reason}`,
        duration: 5000,
      });
    },
    [showToast],
  );

  useEffect(() => {
    return () => {
      Object.keys(timersRef.current).forEach((id) => clearToastTimer(id));
    };
  }, [clearToastTimer]);

  const contextValue = useMemo<ToastContextType>(
    () => ({
      showToast,
      hideToast,
      showJobSuccess,
      showJobError,
      showJobStarted,
      showNetworkError,
      showValidationError,
    }),
    [
      showToast,
      hideToast,
      showJobSuccess,
      showJobError,
      showJobStarted,
      showNetworkError,
      showValidationError,
    ],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: (theme) => theme.zIndex.snackbar,
          pointerEvents: 'none',
          maxWidth: 440,
        }}
      >
        <Stack spacing={1.5}>
          {toasts.map((toast) => (
            <Alert
              key={toast.id}
              severity={toast.type}
              variant="filled"
              sx={{
                pointerEvents: 'auto',
                alignItems: 'flex-start',
                boxShadow: 4,
                border: `1px solid ${theming.colors.accent}`,
              }}
              action={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {toast.action ? (
                    <Button
                      color="inherit"
                      size="small"
                      startIcon={<DownloadIcon fontSize="small" />}
                      onClick={toast.action.onClick}
                    >
                      {toast.action.label}
                    </Button>
                  ) : null}
                  <IconButton
                    size="small"
                    color="inherit"
                    aria-label="Lukk melding"
                    onClick={() => hideToast(toast.id)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              {toast.title ? <AlertTitle>{toast.title}</AlertTitle> : null}
              {toast.message}
            </Alert>
          ))}
        </Stack>
      </Box>
    </ToastContext.Provider>
  );
};

