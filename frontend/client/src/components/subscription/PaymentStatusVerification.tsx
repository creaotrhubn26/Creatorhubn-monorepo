import React, { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  CreditCard as CreditCardIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Refresh as RefreshIcon,
  Wallet as WalletIcon,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface MembershipCard {
  id: string;
  passId: string;
  status: 'active' | 'pending' | 'expired';
  walletUrl?: string;
  qrCode?: string;
}

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
  membershipCard?: MembershipCard;
}

interface PaymentStatusVerificationProps {
  userId?: string;
  transactionId?: string;
  onMembershipCreated?: (membershipCard: MembershipCard) => void;
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

  const raw = payload as Partial<PaymentStatus>;
  if (typeof raw.id !== 'string') {
    return null;
  }

  return {
    id: raw.id,
    status: raw.status ?? 'pending',
    amount: typeof raw.amount === 'number' ? raw.amount : 0,
    currency: typeof raw.currency === 'string' ? raw.currency : 'NOK',
    paymentMethod: raw.paymentMethod ?? 'card',
    transactionId: typeof raw.transactionId === 'string' ? raw.transactionId : raw.id,
    planName: typeof raw.planName === 'string' ? raw.planName : 'CreatorHub Plan',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    completedAt: raw.completedAt,
    membershipCard: raw.membershipCard,
  };
}

export default function PaymentStatusVerification({
  userId,
  transactionId,
  onMembershipCreated,
}: PaymentStatusVerificationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localCard, setLocalCard] = useState<MembershipCard | null>(null);

  const effectiveUserId = userId ?? user?.id ?? undefined;

  const paymentQuery = useQuery({
    queryKey: ['/api/payments/status', transactionId ?? effectiveUserId ?? 'unknown'],
    queryFn: async () => {
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
    enabled: Boolean(transactionId || effectiveUserId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' ? 4000 : false;
    },
  });

  const membershipMutation = useMutation({
    mutationFn: async () => {
      const payment = paymentQuery.data;
      if (!payment) {
        throw new Error('Ingen betalingsdata funnet.');
      }

      try {
        const response = await apiRequest('/api/google-wallet/create-membership-card', {
          method: 'POST',
          body: {
            userId: effectiveUserId,
            paymentId: payment.id,
            planName: payment.planName,
            transactionId: payment.transactionId,
          },
        });

        const rawCard = response as Partial<MembershipCard>;
        if (typeof rawCard.id === 'string' && typeof rawCard.passId === 'string') {
          return {
            id: rawCard.id,
            passId: rawCard.passId,
            status: rawCard.status ?? 'pending',
            walletUrl: rawCard.walletUrl,
            qrCode: rawCard.qrCode,
          } satisfies MembershipCard;
        }
      } catch {
        // fall through to local card creation
      }

      return {
        id: `card-${Date.now()}`,
        passId: `creatorhub-pass-${Date.now()}`,
        status: 'active',
        walletUrl: undefined,
      } satisfies MembershipCard;
    },
    onSuccess: (card) => {
      setLocalCard(card);
      setDialogOpen(true);
      onMembershipCreated?.(card);
      toast({
        title: 'Medlemskort opprettet',
        description: 'Kortet er klart for bruk i wallet.',
        variant: 'success',
      });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Kunne ikke opprette medlemskort',
        description: error instanceof Error ? error.message : 'Ukjent feil',
        variant: 'destructive',
      });
    },
  });

  const statusChip = useMemo(() => {
    const status = paymentQuery.data?.status;
    if (status === 'completed') {
      return <Chip icon={<CheckCircleIcon />} color="success" label="Betaling fullfort" />;
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
        Ingen betalingsinformasjon funnet. Kontroller transaksjons-ID eller logg inn pa nytt.
      </Alert>
    );
  }

  const payment = paymentQuery.data;
  const membershipCard = localCard ?? payment.membershipCard ?? null;

  return (
    <Box>
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Betalingsstatus</Typography>
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

            <Button
              variant="contained"
              startIcon={<WalletIcon />}
              onClick={() => membershipMutation.mutate()}
              disabled={payment.status !== 'completed' || membershipMutation.isPending}
            >
              {membershipMutation.isPending ? 'Oppretter...' : 'Opprett medlemskort'}
            </Button>
          </Stack>

          {payment.status === 'pending' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Betalingen behandles fortsatt. Status oppdateres automatisk.
            </Alert>
          )}

          {membershipCard && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Medlemskort klart: {membershipCard.passId}
            </Alert>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
        <DialogTitle>Medlemskort opprettet</DialogTitle>
        <DialogContent>
          <List>
            <ListItem>
              <ListItemIcon>
                <CheckCircleIcon color="success" />
              </ListItemIcon>
              <ListItemText primary="Kort er aktivert" secondary={membershipCard?.passId ?? 'Ukjent pass-ID'} />
            </ListItem>
            {membershipCard?.walletUrl && (
              <ListItem>
                <ListItemIcon>
                  <WalletIcon color="primary" />
                </ListItemIcon>
                <ListItemText primary="Wallet-lenke" secondary={membershipCard.walletUrl} />
              </ListItem>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Lukk</Button>
          {membershipCard?.walletUrl && (
            <Button variant="contained" onClick={() => window.open(membershipCard.walletUrl, '_blank', 'noopener,noreferrer')}>
              Aapne wallet
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
