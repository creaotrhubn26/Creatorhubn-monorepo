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
  FolderOpen as FolderOpenIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import type { RoleRoomCommercialBillingAccount } from '../services/castingApiService';

type WorkspaceAccountTeamMember = {
  name: string;
  roleLabel?: string | null;
};

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
  currentUser: {
    name: string;
    email: string;
    roleLabel?: string | null;
    professionLabel?: string | null;
    workspaceLabel?: string | null;
  };
  currentProject?: {
    name: string;
    clientName?: string | null;
    workflowLabel?: string | null;
    teamMembers: WorkspaceAccountTeamMember[];
  } | null;
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

function getInitials(value?: string | null) {
  const normalized = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  return normalized || 'RR';
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
  currentUser,
  currentProject,
}) => {
  const paymentTimestamp = formatDateTime(account?.paymentTimestamp);
  const paymentFailedAt = formatDateTime(account?.paymentFailedAt);
  const nextPaymentAttemptAt = formatDateTime(account?.nextPaymentAttemptAt);
  const canManageBilling = Boolean(account?.canManageBilling);
  const canRetryPayment = Boolean(account?.canManageBilling && account?.canRetryPayment);
  const currentUserInitials = getInitials(currentUser.name || currentUser.email);

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
          <PersonIcon sx={{ color: '#7dd3fc' }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Konto, abonnement og team
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.64)', fontSize: '0.84rem' }}>
              Oversikt over hvem som er innlogget, aktivt prosjekt og workspace-abonnementet.
            </Typography>
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid rgba(125,211,252,0.18)',
              background: 'linear-gradient(135deg, rgba(14,116,144,0.16) 0%, rgba(15,23,42,0.92) 100%)',
            }}
          >
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(125,211,252,0.14)',
                border: '1px solid rgba(125,211,252,0.3)',
                color: '#e0f2fe',
                fontSize: '1rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}
            >
              {currentUserInitials}
            </Box>

            <Stack spacing={0.7} sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#f8fafc' }}>
                {currentUser.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem' }}>
                {currentUser.email}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {currentUser.workspaceLabel ? (
                  <Chip
                    size="small"
                    label={currentUser.workspaceLabel}
                    sx={{
                      bgcolor: 'rgba(34,211,238,0.12)',
                      color: '#67e8f9',
                      border: '1px solid rgba(34,211,238,0.24)',
                    }}
                  />
                ) : null}
                {currentUser.roleLabel ? (
                  <Chip
                    size="small"
                    label={currentUser.roleLabel}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.88)',
                    }}
                  />
                ) : null}
                {currentUser.professionLabel ? (
                  <Chip
                    size="small"
                    label={currentUser.professionLabel}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.68)',
                    }}
                  />
                ) : null}
              </Stack>
            </Stack>
          </Stack>

          {currentProject ? (
            <Stack
              spacing={1.2}
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid rgba(148,163,184,0.12)',
                background: 'rgba(255,255,255,0.025)',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <FolderOpenIcon sx={{ color: '#a5f3fc', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  Aktivt prosjekt
                </Typography>
              </Stack>
              <Typography sx={{ fontWeight: 700, color: '#f8fafc' }}>
                {currentProject.name}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.84rem' }}>
                {[currentProject.clientName, currentProject.workflowLabel].filter(Boolean).join(' • ') || 'Ingen ekstra prosjektinfo tilgjengelig ennå.'}
              </Typography>

              {currentProject.teamMembers.length > 0 ? (
                <Stack spacing={0.85} sx={{ pt: 0.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Aktivt prosjektteam
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {currentProject.teamMembers.map((member) => (
                      <Chip
                        key={`${member.name}-${member.roleLabel || 'team'}`}
                        label={member.roleLabel ? `${member.name} · ${member.roleLabel}` : member.name}
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.04)',
                          color: 'rgba(255,255,255,0.86)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

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

        {!loading && !error && !account ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Abonnementsinformasjon blir tilgjengelig når denne workspacen er koblet til en kommersiell konto.
          </Alert>
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
