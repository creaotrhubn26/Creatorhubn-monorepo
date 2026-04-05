import React, { useMemo } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CreditCard as CreditCardIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface PaymentStatus {
  id: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  amount: number;
  currency: string;
  paymentMethod: 'google-pay' | 'card' | 'stripe' | 'vipps';
  transactionId: string;
  planName: string;
  createdAt: string;
  completedAt?: string;
}

interface PaymentStatusVerificationProps {
  userId?: string;
  transactionId?: string;
  sessionId?: string;
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function normalizeStatus(payload: unknown): PaymentStatus | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const raw = payload as Partial<PaymentStatus> & {
    sessionId?: string;
    paymentCompleted?: boolean;
    paymentStatus?: string;
    completedAt?: string;
  };
  const resolvedId =
    typeof raw.id === 'string'
      ? raw.id
      : typeof raw.sessionId === 'string'
        ? raw.sessionId
        : null;
  if (!resolvedId) {
    return null;
  }

  const resolvedStatus =
    raw.status ??
    (raw.paymentCompleted || raw.paymentStatus === 'paid' ? 'completed' : 'pending');

  return {
    id: resolvedId,
    status: resolvedStatus,
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    currency: typeof raw.currency === 'string' ? raw.currency : 'NOK',
    paymentMethod: raw.paymentMethod ?? (raw.sessionId ? 'stripe' : 'card'),
    transactionId:
      typeof raw.transactionId === 'string' ? raw.transactionId : resolvedId,
    planName: typeof raw.planName === 'string' ? raw.planName : 'CreatorHub Plan',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : undefined,
  };
}

export default function PaymentStatusVerification({
  userId,
  transactionId,
  sessionId,
}: PaymentStatusVerificationProps) {
  const { user } = useAuth();
  const effectiveUserId = userId ?? user?.id ?? undefined;

  const paymentQuery = useQuery({
    queryKey: ['/api/payments/status', sessionId ?? transactionId ?? effectiveUserId ?? 'unknown'],
    queryFn: async () => {
      if (sessionId) {
        try {
          return normalizeStatus(
            await apiRequest(
              `/api/platform/billing/session-status?sessionId=${encodeURIComponent(sessionId)}`,
            ),
          );
        } catch {
          return null;
        }
      }

      if (transactionId) {
        try {
          return normalizeStatus(await apiRequest(`/api/payments/status/${encodeURIComponent(transactionId)}`));
        } catch {
          return null;
        }
      }

      if (effectiveUserId) {
        try {
          return normalizeStatus(await apiRequest(`/api/payments/status/user/${encodeURIComponent(effectiveUserId)}`));
        } catch {
          return null;
        }
      }

      return null;
    },
    enabled: Boolean(sessionId || transactionId || effectiveUserId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? 4000 : false;
    },
  });

  const statusChip = useMemo(() => {
    const status = paymentQuery.data?.status;
    if (status === 'completed') {
      return <Chip icon={<CheckCircleIcon />} color="success" label="Betaling fullført" />;
    }
    if (status === 'failed') {
      return <Chip icon={<ErrorIcon />} color="error" label="Betaling feilet" />;
    }
    if (status === 'refunded') {
      return <Chip icon={<ErrorIcon />} color="warning" label="Refundert" />;
    }
    return <Chip icon={<PendingIcon />} color="info" label="Venter" />;
  }, [paymentQuery.data?.status]);

  if (paymentQuery.isLoading) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress sx={{ mb: 1 }} />
          <Typography>Henter betalingsstatus...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!paymentQuery.data) {
    return (
      <Alert severity="warning">
        Ingen betalingsinformasjon funnet. Kontroller transaksjons-ID eller logg inn på nytt.
      </Alert>
    );
  }

  const payment = paymentQuery.data;

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Abonnementsoversikt</Typography>
              <Typography variant="body2" color="text.secondary">
                Transaksjon: {payment.transactionId}
              </Typography>
            </Box>
            {statusChip}
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Plan</Typography>
                <Typography variant="body1" fontWeight={700}>
                  {payment.planName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatMoney(payment.amount, payment.currency)}
                </Typography>
              </Paper>
            </Grid>

            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Betalingsmetode</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar sx={{ width: 28, height: 28 }}>
                    <CreditCardIcon fontSize="small" />
                  </Avatar>
                  <Typography variant="body1">{payment.paymentMethod}</Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2">Registrert</Typography>
                <Typography variant="body1" fontWeight={700}>
                  {new Date(payment.createdAt).toLocaleString('nb-NO')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {payment.completedAt
                    ? `Bekreftet ${new Date(payment.completedAt).toLocaleString('nb-NO')}`
                    : 'Venter på bekreftet betaling'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => paymentQuery.refetch()}
              disabled={paymentQuery.isRefetching}
            >
              {paymentQuery.isRefetching ? 'Oppdaterer...' : 'Oppdater status'}
            </Button>
          </Stack>

          {payment.status === 'pending' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Betalingen behandles fortsatt. Status oppdateres automatisk.
            </Alert>
          )}

          {payment.status === 'completed' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Abonnementet ditt er aktivt. Her ser du betalingsstatus og detaljer for kjøpet.
            </Alert>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
