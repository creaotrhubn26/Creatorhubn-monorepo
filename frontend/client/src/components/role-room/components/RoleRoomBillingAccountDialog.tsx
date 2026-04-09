import { type FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CloudDoneOutlined as CloudDoneOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  FolderOpen as FolderOpenIcon,
  LinkOffOutlined as LinkOffOutlinedIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import {
  googleWorkspaceApi,
  type RoleRoomCommercialBillingAccount,
  type RoleRoomGoogleStatusResponse,
} from '../services/castingApiService';
import { getRoleRoomReturnPath } from '../utils/runtime';

type WorkspaceAccountTeamMember = {
  name: string;
  roleLabel?: string | null;
};

type RoleRoomAdminPreviewMode = 'admin' | 'production_team' | 'content_producer' | 'client';

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
    id: string;
    name: string;
    clientName?: string | null;
    workflowLabel?: string | null;
    teamMembers: WorkspaceAccountTeamMember[];
  } | null;
  adminPreview?: {
    enabled: boolean;
    selectedMode: RoleRoomAdminPreviewMode;
    clientPortalAvailable: boolean;
    onSelectMode: (mode: RoleRoomAdminPreviewMode) => void | Promise<void>;
    onOpenClientPortal: () => void | Promise<void>;
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

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getGoogleStatusTone(status?: RoleRoomGoogleStatusResponse['state']) {
  switch (status) {
    case 'connected':
      return 'success' as const;
    case 'expired':
      return 'warning' as const;
    case 'error':
      return 'error' as const;
    default:
      return 'info' as const;
  }
}

function getGoogleStatusLabel(status?: RoleRoomGoogleStatusResponse['state']) {
  switch (status) {
    case 'connected':
      return 'Aktiv';
    case 'expired':
      return 'Utløpt';
    case 'error':
      return 'Krever oppfølging';
    default:
      return 'Ikke koblet';
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
  currentUser,
  currentProject,
  adminPreview = null,
}) => {
  const paymentTimestamp = formatDateTime(account?.paymentTimestamp);
  const paymentFailedAt = formatDateTime(account?.paymentFailedAt);
  const nextPaymentAttemptAt = formatDateTime(account?.nextPaymentAttemptAt);
  const canManageBilling = Boolean(account?.canManageBilling);
  const canRetryPayment = Boolean(account?.canManageBilling && account?.canRetryPayment);
  const currentUserInitials = getInitials(currentUser.name || currentUser.email);
  const [googleStatus, setGoogleStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [googleStatusLoading, setGoogleStatusLoading] = useState(false);
  const [googleStatusError, setGoogleStatusError] = useState<string | null>(null);
  const [googleActionPending, setGoogleActionPending] = useState(false);

  const loadGoogleStatus = useCallback(async () => {
    if (!open) {
      return;
    }
    setGoogleStatusLoading(true);
    setGoogleStatusError(null);
    try {
      const status = await googleWorkspaceApi.getStatus(currentProject?.id);
      setGoogleStatus(status);
    } catch (statusError) {
      const message = statusError instanceof Error
        ? statusError.message
        : 'Kunne ikke hente Google Workspace-status.';
      setGoogleStatusError(message);
    } finally {
      setGoogleStatusLoading(false);
    }
  }, [currentProject?.id, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadGoogleStatus();
  }, [loadGoogleStatus, open]);

  const googleConnection = googleStatus?.connection ?? null;
  const googleBinding = googleStatus?.projectBinding ?? null;
  const googleIsConnected = googleStatus?.state === 'connected';
  const googleDriveReady = hasText(googleBinding?.driveRootFolderId);
  const googleCalendarReady = hasText(googleBinding?.calendarId);
  const googleNeedsProjectSetup = Boolean(
    currentProject?.id && googleIsConnected && (!googleDriveReady || !googleCalendarReady),
  );
  const googleStatusSeverity = getGoogleStatusTone(googleStatus?.state);
  const googleStatusLabel = getGoogleStatusLabel(googleStatus?.state);
  const googleHelperText = useMemo(() => {
    if (!googleStatus?.configured) {
      return 'Google Workspace er ikke ferdig konfigurert for denne installasjonen ennå.';
    }
    if (googleStatus.state === 'connected') {
      return 'Når du logger inn med Google i The Role Room, brukes koblingen automatisk. Du trenger bare å fornye den hvis den er utløpt eller prosjektintegrasjonen må repareres.';
    }
    if (googleStatus.state === 'expired') {
      return 'Google-koblingen er utløpt. Forny den her inne i kontoprofilen for å få møter, signering og Drive tilbake.';
    }
    if (googleStatus.state === 'error') {
      return googleConnection?.lastError || 'Google Workspace svarte med en feil. Prøv å fornye koblingen.';
    }
    return 'Google vises nå bare her inne i kontoprofilen. Koble den til her hvis prosjektet trenger Drive, Kalender eller signering.';
  }, [googleConnection?.lastError, googleStatus]);

  const handleConnectGoogle = useCallback(async () => {
    setGoogleActionPending(true);
    setGoogleStatusError(null);
    try {
      const response = await googleWorkspaceApi.startOauth({
        mode: 'link',
        projectId: currentProject?.id ?? undefined,
        browserOrigin: typeof window !== 'undefined' ? window.location.origin : undefined,
        returnPath: typeof window !== 'undefined'
          ? getRoleRoomReturnPath(window.location)
          : getRoleRoomReturnPath(null),
        email: currentUser.email || undefined,
      });
      window.location.assign(response.authorizationUrl);
    } catch (connectError) {
      const message = connectError instanceof Error
        ? connectError.message
        : 'Kunne ikke starte Google Workspace-koblingen.';
      setGoogleStatusError(message);
    } finally {
      setGoogleActionPending(false);
    }
  }, [currentProject?.id, currentUser.email]);

  const handlePrepareProjectBinding = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }
    setGoogleActionPending(true);
    setGoogleStatusError(null);
    try {
      await googleWorkspaceApi.ensureProjectBindingReady(currentProject.id, googleBinding);
      await loadGoogleStatus();
    } catch (bindingError) {
      const message = bindingError instanceof Error
        ? bindingError.message
        : 'Kunne ikke klargjøre prosjektet for Google Workspace.';
      setGoogleStatusError(message);
    } finally {
      setGoogleActionPending(false);
    }
  }, [currentProject?.id, googleBinding, loadGoogleStatus]);

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
              Oversikt over hvem som er innlogget, aktivt prosjekt, Google Workspace og workspace-abonnementet.
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
              {adminPreview?.enabled ? (
                <Stack spacing={0.9} sx={{ pt: 1 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.76rem' }}>
                    Test klientflaten uten å miste adminrettighetene. Dette bytter bare visningsmodus.
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                    <FormControl
                      size="small"
                      sx={{
                        minWidth: { xs: '100%', sm: 240 },
                        '& .MuiOutlinedInput-root': {
                          color: '#f8fafc',
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.04)',
                        },
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(255,255,255,0.14)',
                        },
                        '& .MuiInputLabel-root': {
                          color: 'rgba(255,255,255,0.58)',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'rgba(255,255,255,0.72)',
                        },
                      }}
                    >
                      <InputLabel id="role-room-preview-mode-label">Vis som</InputLabel>
                      <Select
                        labelId="role-room-preview-mode-label"
                        label="Vis som"
                        value={adminPreview.selectedMode}
                        disabled={actionPending}
                        onChange={(event) => {
                          const nextMode = event.target.value as RoleRoomAdminPreviewMode;
                          void adminPreview.onSelectMode(nextMode);
                        }}
                      >
                        <MenuItem value="admin">Admin view</MenuItem>
                        <MenuItem value="production_team">Produksjonsteam view</MenuItem>
                        <MenuItem value="content_producer">Innholdsprodusent view</MenuItem>
                        <MenuItem value="client">Klient view</MenuItem>
                      </Select>
                    </FormControl>
                    {currentProject && adminPreview.clientPortalAvailable ? (
                      <Button
                        size="small"
                        variant={adminPreview.selectedMode === 'client' ? 'contained' : 'outlined'}
                        startIcon={adminPreview.selectedMode === 'client' ? <PersonIcon /> : <SupervisorAccountIcon />}
                        disabled={actionPending}
                        onClick={() => {
                          void adminPreview.onOpenClientPortal();
                        }}
                        sx={{
                          alignSelf: 'flex-start',
                          fontWeight: 700,
                          ...(adminPreview.selectedMode === 'client'
                            ? {
                                bgcolor: '#38bdf8',
                                color: '#082f49',
                                '&:hover': { bgcolor: '#7dd3fc' },
                              }
                            : {
                                borderColor: 'rgba(168,85,247,0.36)',
                                color: '#e9d5ff',
                              }),
                        }}
                      >
                        Åpne klientportal
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ) : null}
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

          <Stack
            spacing={1.2}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid rgba(246,195,88,0.16)',
              background: 'linear-gradient(135deg, rgba(40,28,12,0.48) 0%, rgba(15,23,42,0.92) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <CloudSyncOutlinedIcon sx={{ color: '#f6c358', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  Google Workspace
                </Typography>
              </Stack>
              <Chip
                size="small"
                color={googleStatusSeverity}
                variant={googleIsConnected ? 'filled' : 'outlined'}
                label={googleStatusLoading ? 'Oppdaterer…' : googleStatusLabel}
              />
            </Stack>

            <Typography sx={{ fontWeight: 700, color: '#f8fafc' }}>
              {googleConnection?.googleEmail || googleConnection?.roleRoomEmail || 'Ingen aktiv Google-kobling ennå'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.84rem' }}>
              {googleHelperText}
            </Typography>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {googleIsConnected ? (
                <Chip
                  size="small"
                  icon={<CloudDoneOutlinedIcon sx={{ fontSize: 16 }} />}
                  label="Google-login aktiv"
                  sx={{
                    bgcolor: 'rgba(16,185,129,0.16)',
                    color: '#86efac',
                    border: '1px solid rgba(16,185,129,0.28)',
                  }}
                />
              ) : (
                <Chip
                  size="small"
                  icon={<LinkOffOutlinedIcon sx={{ fontSize: 16 }} />}
                  label="Ingen Google-kobling"
                  sx={{
                    bgcolor: 'rgba(148,163,184,0.12)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.24)',
                  }}
                />
              )}
              {currentProject ? (
                <Chip
                  size="small"
                  icon={<CalendarMonthOutlinedIcon sx={{ fontSize: 16 }} />}
                  label={googleCalendarReady ? 'Kalender klar' : 'Kalender ikke klargjort'}
                  sx={{
                    bgcolor: googleCalendarReady ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.12)',
                    color: googleCalendarReady ? '#bfdbfe' : '#cbd5e1',
                    border: `1px solid ${googleCalendarReady ? 'rgba(59,130,246,0.28)' : 'rgba(148,163,184,0.24)'}`,
                  }}
                />
              ) : null}
              {currentProject ? (
                <Chip
                  size="small"
                  icon={<FolderOpenIcon sx={{ fontSize: 16 }} />}
                  label={googleDriveReady ? 'Drive klar' : 'Drive ikke klargjort'}
                  sx={{
                    bgcolor: googleDriveReady ? 'rgba(125,211,252,0.16)' : 'rgba(148,163,184,0.12)',
                    color: googleDriveReady ? '#bae6fd' : '#cbd5e1',
                    border: `1px solid ${googleDriveReady ? 'rgba(125,211,252,0.28)' : 'rgba(148,163,184,0.24)'}`,
                  }}
                />
              ) : null}
              {googleConnection?.lastUsedAt ? (
                <Chip
                  size="small"
                  label={`Sist brukt ${formatDateTime(googleConnection.lastUsedAt)}`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.72)',
                  }}
                />
              ) : null}
            </Stack>

            {googleStatusError ? (
              <Alert severity="error">
                {googleStatusError}
              </Alert>
            ) : null}

            {!googleStatusLoading && !googleStatus?.configured ? (
              <Alert severity="warning">
                Google Workspace mangler konfigurasjon for denne installasjonen.
                {googleStatus?.missing?.length ? ` Mangler: ${googleStatus.missing.join(', ')}.` : ''}
              </Alert>
            ) : null}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              {!googleIsConnected ? (
                <Button
                  variant="contained"
                  onClick={() => {
                    void handleConnectGoogle();
                  }}
                  disabled={googleStatusLoading || googleActionPending || !googleStatus?.configured}
                  sx={{
                    bgcolor: '#f6c358',
                    color: '#171410',
                    fontWeight: 800,
                    '&:hover': { bgcolor: '#efb93e' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.38)' },
                  }}
                >
                  {googleStatus?.state === 'expired' || googleStatus?.state === 'error'
                    ? 'Forny Google'
                    : 'Koble til Google'}
                </Button>
              ) : null}

              {googleNeedsProjectSetup ? (
                <Button
                  variant="outlined"
                  onClick={() => {
                    void handlePrepareProjectBinding();
                  }}
                  disabled={googleStatusLoading || googleActionPending}
                  sx={{ borderColor: 'rgba(125,211,252,0.34)', color: '#bae6fd' }}
                >
                  Klargjør prosjekt
                </Button>
              ) : null}

              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  void loadGoogleStatus();
                }}
                disabled={googleStatusLoading || googleActionPending}
                sx={{ color: 'rgba(255,255,255,0.78)' }}
              >
                Oppdater Google-status
              </Button>
            </Stack>
          </Stack>
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
