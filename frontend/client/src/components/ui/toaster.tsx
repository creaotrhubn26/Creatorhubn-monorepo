import React from 'react';
import {
  Alert,
  Snackbar,
  Typography,
  Box,
} from '@mui/material';
import { useToast, dismissToast } from '@/hooks/use-toast';
import type { Toast } from '@/hooks/use-toast';

function mapVariant(variant?: string): 'success' | 'error' | 'warning' | 'info' {
  switch (variant) {
    case 'success': return 'success';
    case 'destructive': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'info';
  }
}

function ToastItem({ toast: t }: { toast: Toast }) {
  return (
    <Snackbar
      open={t.open}
      onClose={() => dismissToast(t.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      sx={{ position: 'relative', mb: 1 }}
    >
      <Alert
        onClose={() => dismissToast(t.id)}
        severity={mapVariant(t.variant)}
        variant="filled"
        sx={{ width: '100%', minWidth: 280 }}
      >
        {t.title && (
          <Typography variant="subtitle2" fontWeight={600}>
            {t.title}
          </Typography>
        )}
        {t.description && (
          <Typography variant="body2">{t.description}</Typography>
        )}
        {!t.title && !t.description && (
          <Typography variant="body2">Notification</Typography>
        )}
      </Alert>
    </Snackbar>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  if (!toasts.length) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 1,
        pointerEvents: 'none',
        '& > *': { pointerEvents: 'auto' },
      }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </Box>
  );
}

// Re-export for convenience
export { useToast } from '@/hooks/use-toast';