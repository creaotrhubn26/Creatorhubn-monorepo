import type { ReactElement, ReactNode } from 'react';
import { Alert, Button } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { RR_COLORS } from './tokens';

/**
 * The consistent dark error alert used by every producer panel
 * (`<Alert severity="error" sx={{ bgcolor: 'rgba(239,68,68,0.08)', color: '#fecaca' }}>`),
 * with an optional inline retry button.
 *
 * @example
 * {error ? <ErrorAlert message={error} onRetry={() => void refresh()} /> : null}
 */
export interface ErrorAlertProps {
  /** Error message to display. */
  message: ReactNode;
  /** Optional retry handler — renders a "Prøv igjen" button when provided. */
  onRetry?: () => void;
  /** Optional label override for the retry button. */
  retryLabel?: ReactNode;
  /** Optional test id. */
  testId?: string;
}

export default function ErrorAlert({
  message,
  onRetry,
  retryLabel,
  testId,
}: ErrorAlertProps): ReactElement {
  return (
    <Alert
      severity="error"
      data-testid={testId}
      sx={{
        bgcolor: RR_COLORS.errorBg,
        color: RR_COLORS.errorText,
        '& .MuiAlert-icon': { color: RR_COLORS.negative },
      }}
      action={
        onRetry ? (
          <Button
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
            onClick={onRetry}
            sx={{ textTransform: 'none', fontSize: '0.74rem', color: RR_COLORS.errorText }}
          >
            {retryLabel ?? 'Prøv igjen'}
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}
