/**
 * Enhanced Toast Container Component
 * 
 * Toast notification system with design system styling
 */

import React, { useEffect } from 'react';
import { Snackbar, Alert, IconButton } from '@mui/material';
import type { AlertColor } from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import { colors, spacing, borderRadius, shadows, transitions } from '../../styles/designTokens';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  persistent?: boolean;
}

export interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  removeToast,
  position = 'top-right',
}) => {
  const getPosition = () => {
    switch (position) {
      case 'top-right':
        return { vertical: 'top' as const, horizontal: 'right' as const };
      case 'top-left':
        return { vertical: 'top' as const, horizontal: 'left' as const };
      case 'bottom-right':
        return { vertical: 'bottom' as const, horizontal: 'right' as const };
      case 'bottom-left':
        return { vertical: 'bottom' as const, horizontal: 'left' as const };
      case 'top-center':
        return { vertical: 'top' as const, horizontal: 'center' as const };
      case 'bottom-center':
        return { vertical: 'bottom' as const, horizontal: 'center' as const };
      default:
        return { vertical: 'top' as const, horizontal: 'right' as const };
    }
  };

  const getSeverity = (type: Toast['type']): AlertColor => {
    return type;
  };

  const getColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      case 'warning':
        return colors.warning;
      case 'info':
        return colors.info;
      default:
        return colors.primary;
    }
  };

  return (
    <>
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.persistent ? null : (toast.duration || 5000)}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={getPosition()}
          sx={{
            '& .MuiSnackbarContent-root': {
              backgroundColor: colors.background.panel,
              border: `1px solid ${colors.border.default}`,
              borderRadius: borderRadius.md,
              boxShadow: shadows.lg,
              color: colors.text.primary,
              minWidth: 300,
              maxWidth: 500,
            },
          }}
        >
          <Alert
            severity={getSeverity(toast.type)}
            onClose={() => removeToast(toast.id)}
            sx={{
              width: '100%',
              backgroundColor: colors.background.panel,
              color: colors.text.primary,
              border: `1px solid ${getColor(toast.type)}`,
              borderRadius: borderRadius.md,
              '& .MuiAlert-icon': {
                color: getColor(toast.type),
              },
              '& .MuiAlert-message': {
                color: colors.text.primary,
              },
              '& .MuiAlert-action': {
                paddingTop: 0,
              },
            }}
            action={
              <IconButton
                size="small"
                onClick={() => removeToast(toast.id)}
                sx={{
                  color: colors.text.secondary,
                  '&:hover': {
                    color: colors.text.primary,
                    backgroundColor: colors.background.elevated,
                  },
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};


