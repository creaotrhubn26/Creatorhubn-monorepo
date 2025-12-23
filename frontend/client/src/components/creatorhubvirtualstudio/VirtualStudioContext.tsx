/**
 * Virtual Studio Context Provider
 * Provides toast notifications and shared state for Virtual Studio components
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Box, Alert, IconButton, Button, LinearProgress } from '@mui/material';
import { Close, CheckCircle, Error, Warning, Info } from '@mui/icons-material';

// Toast types
export interface ToastAction {
  label: string;
  action: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  actions?: ToastAction[];
  showProgress?: boolean;
}

export interface VirtualStudioState {
  toasts: Toast[];
}

export type VirtualStudioAction =
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'CLEAR_TOASTS' };

// Initial state
const initialState: VirtualStudioState = {
  toasts: [],
};

// Reducer
function virtualStudioReducer(
  state: VirtualStudioState,
  action: VirtualStudioAction,
): VirtualStudioState {
  switch (action.type) {
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, action.payload],
      };

    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.payload),
      };

    case 'CLEAR_TOASTS':
      return {
        ...state,
        toasts: [],
      };

    default:
      return state;
  }
}

// Context
interface VirtualStudioContextType {
  state: VirtualStudioState;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

const VirtualStudioContext = createContext<VirtualStudioContextType | undefined>(undefined);

// Provider props
interface VirtualStudioProviderProps {
  children: React.ReactNode;
}

// Provider component
export function VirtualStudioProvider({ children }: VirtualStudioProviderProps) {
  const [state, dispatch] = useReducer(virtualStudioReducer, initialState);

  // Add toast
  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const duration = toast.duration ?? 3000;

    const newToast: Toast = {
      ...toast,
      id,
      duration,
    };

    dispatch({ type: 'ADD_TOAST', payload: newToast });

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
      }, duration);
    }
  }, []);

  // Remove toast
  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  // Clear all toasts
  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  return (
    <VirtualStudioContext.Provider value={{ state, addToast, removeToast, clearToasts }}>
      {children}
      <ToastContainer toasts={state.toasts} removeToast={removeToast} />
    </VirtualStudioContext.Provider>
  );
}

// Hook to use Virtual Studio context
export function useVirtualStudio() {
  const context = useContext(VirtualStudioContext);
  if (!context) {
    throw new Error('useVirtualStudio must be used within VirtualStudioProvider');
  }
  return context;
}

// Toast Container Component - Using enhanced ToastContainer from design system
import { ToastContainer as EnhancedToastContainer } from './src/ui/components/ToastContainer';

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <EnhancedToastContainer 
      toasts={toasts.map(t => ({
        id: t.id,
        message: t.message,
        type: t.type,
        duration: t.duration,
        persistent: !t.duration || t.duration === 0,
      }))} 
      removeToast={removeToast}
      position="top-right"
    />
  );
}

// Toast Item Component
interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast.showProgress && toast.duration && toast.duration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - 100 / (toast.duration! / 50);
          return newProgress <= 0 ? 0 : newProgress;
        });
      }, 50);

      return () => clearInterval(interval);
    }
  }, [toast.duration, toast.showProgress]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle />;
      case 'error':
        return <Error />;
      case 'warning':
        return <Warning />;
      case 'info':
        return <Info />;
      default:
        return null;
    }
  };

  return (
    <Alert
      severity={toast.type}
      icon={getIcon()}
      sx={{
        position: 'relative',
        animation: 'slideIn 0.3s ease-out', '@keyframes slideIn': {
          from: { transform: 'translateX(100%)',
            opacity: 0,
          },
          to: {
            transform: 'translateX(0)',
            opacity: 1,
          },
        },
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        borderRadius: 2}}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {toast.actions?.map((action, index) => (
            <Button
              key={index}
              size="small"
              onClick={() => {
                action.action();
                onClose();
              }}
              sx={{ color: 'inherit' }}
            >
              {action.label}
            </Button>
          ))}
          <IconButton size="small" aria-label="close" color="inherit" onClick={onClose}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      }
    >
      {toast.message}
      {toast.showProgress && toast.duration && toast.duration > 0 && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8}}
        />
      )}
    </Alert>
  );
}
