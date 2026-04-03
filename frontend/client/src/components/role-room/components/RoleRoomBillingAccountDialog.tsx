import type { FC } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CreditCard as CreditCardIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import type { RoleRoomCommercialBillingAccount } from '../services/castingApiService';

type RoleRoomBillingAccountDialogProps = {
  open: boolean;
  onClose: () => void;
  account: RoleRoomCommercialBillingAccount | null;
  loading: boolean;
  error: string | null;
  actionPending?: boolean;
  onRefresh: () => void | Promise<void>;
  onManageBilling: () => void | Promise<void>;
  onRetryPayment: () => void | Promise<void>;
};

const moneyFormatter = new Intl.NumberFormat('nb-NO', {
  style: 'currency',
  currency: 'NOK',
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat('nb-NO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function formatMoney(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Ikke tilgjengelig';
  }
  return moneyFormatter.format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateFormatter.format(date);
}

function getStatusTone(status?: RoleRoomCommercialBillingAccount['paymentStatus']) {
  switch (status) {
    case 'active':
      return 'success' as const;
    case 'payment_failed':
      return 'warning' as const;
    default:
      return 'info' as const;
  }
}

const RoleRoomBillingAccountDialog: FC<RoleRoomBillingAccountDialogProps> = ({
  open,
  onClose,
  account,
  loading,
  error,
  actionPending = false,
  onRefresh,
  onManageBilling,
  onRetryPayment,
}) => {
  const paymentTimestamp = formatDateTime(account?.paymentTimestamp);
  const paymentFailedAt = formatDateTime(account?.paymentFailedAt);
  const nextPaymentAttemptAt = formatDateTime(account?.nextPaymentAttemptAt);
  const canManageBilling = Boolean(account?.canManageBilling);
  const canRetryPayment = Boolean(account?.canManageBilling && account?.canRetryPayment);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: '1px solid rgba(246,195,88,0.18)',
          background:
            'linear-gradient(180deg, rgba(16,14,20,0.98) 0%, rgba(10,8,15,0.98) 100%)',
          color: '#f8fafc',
        },
      }}
    >
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <CreditCardIcon sx={{ color: '#f6c358' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Abonnement og team
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.84rem' }}>
              Kun teamleder kan oppdatere betalingsinformasjon.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {loading ? (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: '#f6c358' }} />
          </Box>
        ) : null}

        {!loading && error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {!loading && account ? (
          <Stack spacing={2}>
            <Alert severity={getStatusTone(account.paymentStatus)}>
              {account.paymentMessage}
            </Alert>

            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1.5}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <Stack spacing={0.5} sx={{ flex: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <BusinessIcon sx={{ color: '#f6c358', fontSize: 18 }} />
                  <Typography sx={{ fontWeight: 700 }}>
                    {account.companyName || 'The Role Room'}
                  </Typography>
                </Stack>
                <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.88rem' }}>
                  {account.planName || 'Abonnement'}
                  {account.organizationNumber ? ` · Org.nr. ${account.organizationNumber}` : ''}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem' }}>
                  {formatMoney(account.monthlyTotalExVat)} / mnd eks. mva.
                </Typography>
              </Stack>

              <Stack spacing={0.75} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                <Chip
                  label={account.paymentStatusLabel}
                  color={getStatusTone(account.paymentStatus)}
                  variant={account.paymentStatus === 'active' ? 'filled' : 'outlined'}
                />
                {paymentTimestamp ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.78rem' }}>
                    Sist betalt: {paymentTimestamp}
                  </Typography>
                ) : null}
                {paymentFailedAt ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.78rem' }}>
                    Betaling feilet: {paymentFailedAt}
                  </Typography>
                ) : null}
                {nextPaymentAttemptAt ? (
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.78rem' }}>
                    Neste Stripe-forsøk: {nextPaymentAttemptAt}
                  </Typography>
                ) : null}
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {canManageBilling ? (
                <Button
                  variant="contained"
                  onClick={onManageBilling}
                  disabled={actionPending}
                  sx={{
                    bgcolor: '#f6c358',
                    color: '#171410',
                    fontWeight: 800,
                    '&:hover': { bgcolor: '#efb93e' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.38)' },
                  }}
                >
                  Oppdater betalingsinformasjon
                </Button>
              ) : null}
              {canRetryPayment ? (
                <Button
                  variant="outlined"
                  onClick={onRetryPayment}
                  disabled={actionPending}
                  sx={{ borderColor: 'rgba(246,195,88,0.34)', color: '#f6c358' }}
                >
                  Prøv betalingen på nytt
                </Button>
              ) : null}
              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  void onRefresh();
                }}
                disabled={actionPending}
                sx={{ color: 'rgba(255,255,255,0.78)' }}
              >
                Oppdater status
              </Button>
            </Stack>

            {!canManageBilling && account.managementLockedReason ? (
              <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem' }}>
                {account.managementLockedReason}
              </Typography>
            ) : null}

            {account.paymentFailureMessage ? (
              <Alert severity="warning">
                {account.paymentFailureMessage}
              </Alert>
            ) : null}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <PeopleIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  Teamet ditt
                </Typography>
              </Stack>

              <Stack spacing={1}>
                {account.members.map((member) => (
                  <Box
                    key={member.email}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                    >
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography sx={{ fontWeight: 700 }}>
                            {member.name}
                          </Typography>
                          {member.isLeader ? (
                            <Chip
                              size="small"
                              icon={<SupervisorAccountIcon />}
                              label="Teamleder"
                              sx={{ bgcolor: 'rgba(246,195,88,0.14)', color: '#f6c358' }}
                            />
                          ) : null}
                          {member.activationApproved ? (
                            <Chip size="small" color="success" label="Godkjent" />
                          ) : member.activationPendingApproval ? (
                            <Chip size="small" color="warning" label="Venter godkjenning" />
                          ) : (
                            <Chip size="small" variant="outlined" label="Venter aktivering" />
                          )}
                        </Stack>
                        <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.86rem' }}>
                          {member.email}
                          {member.roleLabel ? ` · ${member.roleLabel}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.25 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.78)' }}>
          Lukk
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RoleRoomBillingAccountDialog;
