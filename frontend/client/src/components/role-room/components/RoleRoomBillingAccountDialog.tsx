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
  Tab,
  Tabs,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Business as BusinessIcon,
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CloudDoneOutlined as CloudDoneOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  FolderOpen as FolderOpenIcon,
  InstallMobileOutlined as InstallMobileOutlinedIcon,
  LinkOffOutlined as LinkOffOutlinedIcon,
  NotificationsActiveOutlined as NotificationsActiveOutlinedIcon,
  NotificationsOffOutlined as NotificationsOffOutlinedIcon,
  Person as PersonIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  SmsOutlined as SmsOutlinedIcon,
  WhatsApp as WhatsAppIcon,
  SupervisorAccount as SupervisorAccountIcon,
} from '@mui/icons-material';

import {
  googleWorkspaceApi,
  type RoleRoomCommercialBillingAccount,
  type RoleRoomGoogleStatusResponse,
} from '../services/castingApiService';
import { castingService, type RoleRoomProjectSnapshot, type RoleRoomProjectSyncMeta, type RoleRoomQueuedProjectChange } from '../services/castingService';
import WorkspaceWhatsAppSettings from './WorkspaceWhatsAppSettings';
import type { CastingProject } from '../models/casting';
import { useRoleRoomPwa } from '../hooks/useRoleRoomPwa';
import { getRoleRoomReturnPath } from '../utils/runtime';

type WorkspaceAccountTeamMember = {
  name: string;
  roleLabel?: string | null;
};

type RoleRoomAdminPreviewMode = 'admin' | 'production_team' | 'content_producer' | 'client';

const ROLE_ROOM_PREVIEW_MODE_LABELS: Record<RoleRoomAdminPreviewMode, string> = {
  admin: 'Administrator',
  production_team: 'Produksjon',
  content_producer: 'Innhold',
  client: 'Klient',
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
  onProjectUpdated?: (project: CastingProject | null) => void | Promise<void>;
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
  onProjectUpdated,
}) => {
  const [tabValue, setTabValue] = useState(0);
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
  const [syncMeta, setSyncMeta] = useState<RoleRoomProjectSyncMeta | null>(null);
  const [queuedChanges, setQueuedChanges] = useState<RoleRoomQueuedProjectChange[]>([]);
  const [snapshots, setSnapshots] = useState<RoleRoomProjectSnapshot[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncActionPending, setSyncActionPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const {
    canInstall,
    disablePush,
    enablePush,
    error: pwaError,
    installHint,
    installPwa,
    isBusy: pwaBusy,
    isInstalled: pwaInstalled,
    isSupported: pwaSupported,
    notificationPermission,
    pushEnabled,
    pushLastError,
    sendTestPush,
    statusMessage: pwaStatusMessage,
    supportsPush,
  } = useRoleRoomPwa(currentProject?.id, open);

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

  const loadSyncState = useCallback(async () => {
    if (!open || !currentProject?.id) {
      setSyncMeta(null);
      setQueuedChanges([]);
      setSnapshots([]);
      return;
    }
    setSyncLoading(true);
    setSyncError(null);
    try {
      const [nextMeta, nextQueue, nextSnapshots] = await Promise.all([
        castingService.getProjectSyncMeta(currentProject.id),
        castingService.getQueuedProjectChanges(currentProject.id),
        castingService.getProjectSnapshots(currentProject.id),
      ]);
      setSyncMeta(nextMeta);
      setQueuedChanges(nextQueue);
      setSnapshots(nextSnapshots);
    } catch (stateError) {
      setSyncError(stateError instanceof Error ? stateError.message : 'Kunne ikke hente prosjektets sync-status.');
    } finally {
      setSyncLoading(false);
    }
  }, [currentProject?.id, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadGoogleStatus();
  }, [loadGoogleStatus, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadSyncState();
  }, [loadSyncState, open]);

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

  const handleSyncQueuedChanges = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }
    setSyncActionPending(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const result = await castingService.syncQueuedProjectChanges(currentProject.id);
      if (result.failed.length > 0) {
        throw new Error(result.failed[0]?.error ?? 'Kunne ikke synkronisere lokale endringer.');
      }
      setSyncNotice(result.synced.length > 0 ? 'Lokale endringer er synkronisert med serveren.' : 'Ingen lokale endringer lå i kø.');
      await loadSyncState();
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Kunne ikke synkronisere lokale endringer.');
    } finally {
      setSyncActionPending(false);
    }
  }, [currentProject?.id, loadSyncState]);

  const handleResyncFromServer = useCallback(async () => {
    if (!currentProject?.id) {
      return;
    }
    setSyncActionPending(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const project = await castingService.resyncProjectFromServer(currentProject.id);
      if (!project) {
        throw new Error('Fant ikke prosjektet på serveren.');
      }
      await onProjectUpdated?.(project);
      await loadSyncState();
      setSyncNotice('Prosjektet er hentet på nytt fra serveren uten hard refresh.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Kunne ikke hente prosjektet på nytt fra serveren.');
    } finally {
      setSyncActionPending(false);
    }
  }, [currentProject?.id, loadSyncState, onProjectUpdated]);

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!currentProject?.id) {
      return;
    }
    setSyncActionPending(true);
    setSyncError(null);
    setSyncNotice(null);
    try {
      const restoredProject = await castingService.restoreProjectSnapshot(currentProject.id, snapshotId);
      await onProjectUpdated?.(restoredProject);
      await loadSyncState();
      setSyncNotice('Nylige endringer er gjenopprettet i prosjektet.');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Kunne ikke gjenopprette prosjektendringen.');
    } finally {
      setSyncActionPending(false);
    }
  }, [currentProject?.id, loadSyncState, onProjectUpdated]);

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
        <Tabs
          value={tabValue}
          onChange={(_, value) => setTabValue(value)}
          sx={{
            mb: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, color: 'rgba(255,255,255,0.72)' },
            '& .Mui-selected': { color: '#f8fafc' },
            '& .MuiTabs-indicator': { bgcolor: '#7dd3fc' },
          }}
        >
          <Tab label="Oversikt" />
          <Tab label="Sync og gjenoppretting" />
        </Tabs>

        {tabValue === 1 ? (
          <Stack spacing={2}>
            {!currentProject ? (
              <Alert severity="info">
                Velg et prosjekt først for å se resync, nylige endringer og lokale endringer som venter på synk.
              </Alert>
            ) : null}

            {syncNotice ? (
              <Alert severity="success">{syncNotice}</Alert>
            ) : null}

            {syncError ? (
              <Alert severity="error">{syncError}</Alert>
            ) : null}

            {syncLoading ? (
              <Box sx={{ py: 4, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: '#7dd3fc' }} />
              </Box>
            ) : null}

            {!syncLoading && currentProject ? (
              <>
                <Stack
                  spacing={1.2}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid rgba(125,211,252,0.16)',
                    background: 'linear-gradient(135deg, rgba(9,22,34,0.5) 0%, rgba(15,23,42,0.92) 100%)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                    <Box>
                      <Typography sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        Resync uten refresh
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.84rem' }}>
                        Hent prosjektet på nytt fra serveren, synk lokale endringer som lå i kø, eller gjenopprett et nylig endringspunkt.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={syncMeta?.lastSyncedAt ? `Sist synket ${formatDateTime(syncMeta.lastSyncedAt)}` : 'Ikke synket ennå'}
                        sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                      />
                      <Chip
                        size="small"
                        label={queuedChanges.length > 0 ? `${queuedChanges.length} lokale endring${queuedChanges.length === 1 ? '' : 'er'} i kø` : 'Ingen lokale endringer i kø'}
                        sx={{
                          bgcolor: queuedChanges.length > 0 ? 'rgba(251,191,36,0.16)' : 'rgba(16,185,129,0.16)',
                          color: queuedChanges.length > 0 ? '#fde68a' : '#86efac',
                        }}
                      />
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
                    <Button
                      variant="contained"
                      startIcon={<CloudSyncOutlinedIcon />}
                      onClick={() => {
                        void handleSyncQueuedChanges();
                      }}
                      disabled={syncActionPending || !currentProject || queuedChanges.length === 0}
                      sx={{
                        bgcolor: '#7dd3fc',
                        color: '#082f49',
                        fontWeight: 800,
                        '&:hover': { bgcolor: '#bae6fd' },
                      }}
                    >
                      Synk lokale endringer
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        void handleResyncFromServer();
                      }}
                      disabled={syncActionPending || !currentProject || queuedChanges.length > 0}
                      sx={{ borderColor: 'rgba(125,211,252,0.34)', color: '#bae6fd' }}
                    >
                      Resync fra server
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<RefreshIcon />}
                      onClick={() => {
                        void loadSyncState();
                      }}
                      disabled={syncActionPending || !currentProject}
                      sx={{ color: 'rgba(255,255,255,0.78)' }}
                    >
                      Oppdater oversikten
                    </Button>
                  </Stack>

                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {syncMeta?.lastLocalSaveAt ? (
                      <Chip
                        size="small"
                        label={`Sist lagret lokalt ${formatDateTime(syncMeta.lastLocalSaveAt)}`}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.78)' }}
                      />
                    ) : null}
                    {syncMeta?.lastResyncedAt ? (
                      <Chip
                        size="small"
                        label={`Resync ${formatDateTime(syncMeta.lastResyncedAt)}`}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.78)' }}
                      />
                    ) : null}
                    {syncMeta?.lastRestoreAt ? (
                      <Chip
                        size="small"
                        label={`Sist gjenopprettet ${formatDateTime(syncMeta.lastRestoreAt)}`}
                        sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.78)' }}
                      />
                    ) : null}
                  </Stack>
                </Stack>

                <Stack
                  spacing={1.2}
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    border: '1px solid rgba(246,195,88,0.16)',
                    background: 'rgba(255,255,255,0.025)',
                  }}
                >
                  <Typography sx={{ fontWeight: 700, color: '#f8fafc' }}>
                    Nylige endringspunkter
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.84rem' }}>
                    Gjenopprett et nylig lagret punkt hvis noe ble feil. Dette lager en ny versjon av prosjektet, uten hard refresh.
                  </Typography>
                  {snapshots.length === 0 ? (
                    <Alert severity="info">Ingen nylige endringspunkter er lagret ennå.</Alert>
                  ) : (
                    <Stack spacing={1}>
                      {snapshots.slice(0, 8).map((snapshot) => (
                        <Box
                          key={snapshot.id}
                          sx={{
                            p: 1.2,
                            borderRadius: 2,
                            border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)',
                          }}
                        >
                          <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ sm: 'center' }}
                          >
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                {snapshot.label}
                              </Typography>
                              <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.82rem' }}>
                                {formatDateTime(snapshot.createdAt) ?? 'Ukjent tidspunkt'}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => {
                                void handleRestoreSnapshot(snapshot.id);
                              }}
                              disabled={syncActionPending}
                              sx={{ textTransform: 'none', fontWeight: 700, borderColor: 'rgba(246,195,88,0.34)', color: '#f6c358' }}
                            >
                              Gjenopprett
                            </Button>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </>
            ) : null}
          </Stack>
        ) : null}

        {tabValue === 0 ? (
          <>
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
                    Se løsningen slik ulike roller opplever den. Dette endrer bare visningen for din adminøkt.
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
                      <InputLabel id="role-room-preview-mode-label">Åpne som</InputLabel>
                      <Select
                        labelId="role-room-preview-mode-label"
                        label="Åpne som"
                        value={adminPreview.selectedMode}
                        disabled={actionPending}
                        onChange={(event) => {
                          const nextMode = event.target.value as RoleRoomAdminPreviewMode;
                          void adminPreview.onSelectMode(nextMode);
                        }}
                      >
                        <MenuItem value="admin">{ROLE_ROOM_PREVIEW_MODE_LABELS.admin}</MenuItem>
                        <MenuItem value="production_team">{ROLE_ROOM_PREVIEW_MODE_LABELS.production_team}</MenuItem>
                        <MenuItem value="content_producer">{ROLE_ROOM_PREVIEW_MODE_LABELS.content_producer}</MenuItem>
                        <MenuItem value="client">{ROLE_ROOM_PREVIEW_MODE_LABELS.client}</MenuItem>
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

          <Stack
            spacing={1.2}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: '1px solid rgba(125,211,252,0.16)',
              background: 'linear-gradient(135deg, rgba(9,22,34,0.5) 0%, rgba(15,23,42,0.92) 100%)',
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <InstallMobileOutlinedIcon sx={{ color: '#7dd3fc', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  Mobilapp og varsler
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={pwaInstalled ? 'App installert' : 'App ikke installert'}
                  sx={{
                    bgcolor: pwaInstalled ? 'rgba(16,185,129,0.16)' : 'rgba(148,163,184,0.12)',
                    color: pwaInstalled ? '#86efac' : '#cbd5e1',
                    border: `1px solid ${pwaInstalled ? 'rgba(16,185,129,0.28)' : 'rgba(148,163,184,0.24)'}`,
                  }}
                />
                <Chip
                  size="small"
                  icon={pushEnabled ? <NotificationsActiveOutlinedIcon sx={{ fontSize: 16 }} /> : <NotificationsOffOutlinedIcon sx={{ fontSize: 16 }} />}
                  label={pushEnabled ? 'Mobilvarsler på' : 'Mobilvarsler av'}
                  sx={{
                    bgcolor: pushEnabled ? 'rgba(59,130,246,0.16)' : 'rgba(148,163,184,0.12)',
                    color: pushEnabled ? '#bfdbfe' : '#cbd5e1',
                    border: `1px solid ${pushEnabled ? 'rgba(59,130,246,0.28)' : 'rgba(148,163,184,0.24)'}`,
                  }}
                />
              </Stack>
            </Stack>

            <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: '0.84rem' }}>
              Installer The Role Room på mobilen og få varsler når klienten sender brief, materiale eller godkjenning i dette prosjektet.
            </Typography>

            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={
                  notificationPermission === 'granted'
                    ? 'Varsler tillatt'
                    : notificationPermission === 'denied'
                      ? 'Varsler blokkert'
                      : notificationPermission === 'default'
                        ? 'Varsler ikke tillatt ennå'
                        : 'Varsler støttes ikke'
                }
                sx={{
                  bgcolor: notificationPermission === 'granted'
                    ? 'rgba(16,185,129,0.16)'
                    : 'rgba(255,255,255,0.05)',
                  color: notificationPermission === 'granted' ? '#86efac' : 'rgba(255,255,255,0.76)',
                }}
              />
              {currentProject ? (
                <Chip
                  size="small"
                  label={`Prosjekt: ${currentProject.name}`}
                  sx={{
                    bgcolor: 'rgba(125,211,252,0.12)',
                    color: '#bae6fd',
                    border: '1px solid rgba(125,211,252,0.24)',
                  }}
                />
              ) : null}
            </Stack>

            {pwaStatusMessage ? (
              <Alert severity="success">
                {pwaStatusMessage}
              </Alert>
            ) : null}

            {pushLastError ? (
              <Alert severity="warning">
                Sist registrerte push-feil: {pushLastError}
              </Alert>
            ) : null}

            {pwaError ? (
              <Alert severity="error">
                {pwaError}
              </Alert>
            ) : null}

            {!pwaSupported ? (
              <Alert severity="info">
                {installHint}
              </Alert>
            ) : null}

            {pwaSupported && !currentProject ? (
              <Alert severity="info">
                Velg et aktivt prosjekt først. Installering av appen fungerer uten prosjekt, men mobilvarsler knyttes til prosjektet du står i.
              </Alert>
            ) : null}

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Button
                variant={pwaInstalled ? 'outlined' : 'contained'}
                startIcon={<InstallMobileOutlinedIcon />}
                onClick={() => {
                  void installPwa();
                }}
                disabled={pwaBusy || (!canInstall && pwaInstalled)}
                sx={pwaInstalled
                  ? { borderColor: 'rgba(125,211,252,0.34)', color: '#bae6fd' }
                  : {
                      bgcolor: '#7dd3fc',
                      color: '#082f49',
                      fontWeight: 800,
                      '&:hover': { bgcolor: '#bae6fd' },
                    }}
              >
                {pwaInstalled ? 'App installert' : 'Installer app'}
              </Button>

              {pushEnabled ? (
                <Button
                  variant="outlined"
                  startIcon={<NotificationsOffOutlinedIcon />}
                  onClick={() => {
                    void disablePush();
                  }}
                  disabled={pwaBusy || !currentProject}
                  sx={{ borderColor: 'rgba(248,113,113,0.36)', color: '#fca5a5' }}
                >
                  Skru av mobilvarsler
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<NotificationsActiveOutlinedIcon />}
                  onClick={() => {
                    void enablePush();
                  }}
                  disabled={pwaBusy || !supportsPush || !currentProject}
                  sx={{
                    bgcolor: '#f6c358',
                    color: '#171410',
                    fontWeight: 800,
                    '&:hover': { bgcolor: '#efb93e' },
                    '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.38)' },
                  }}
                >
                  Aktiver mobilvarsler
                </Button>
              )}

              <Button
                variant="text"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  void sendTestPush();
                }}
                disabled={pwaBusy || !pushEnabled || !currentProject}
                sx={{ color: 'rgba(255,255,255,0.78)' }}
              >
                Send testvarsel
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

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <SmsOutlinedIcon sx={{ color: '#7dd3fc', fontSize: 18 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  Forbruk denne måneden
                </Typography>
              </Stack>

              <Box
                sx={{
                  p: 1.6,
                  borderRadius: 2,
                  border: '1px solid rgba(125,211,252,0.18)',
                  background: 'rgba(125,211,252,0.06)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.4}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Stack spacing={0.4}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                      Audition-SMS · {account.smsUsage?.billingPeriod ?? '—'}
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {(account.smsUsage?.smsCount ?? 0).toLocaleString('nb-NO')} SMS sendt
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
                      {formatMoney(account.smsUsage?.unitPriceNokExVat ?? 0)} per SMS eks. mva.
                      {account.smsUsage?.vatRate ? ` (+ ${Math.round((account.smsUsage.vatRate ?? 0) * 100)}% mva.)` : ''}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.3} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)' }}>
                      Tillegg på neste faktura
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {formatMoney(account.smsUsage?.totalNokExVat ?? 0)} eks. mva.
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                      {formatMoney(account.smsUsage?.totalNokInclVat ?? 0)} inkl. mva.
                    </Typography>
                  </Stack>
                </Stack>
                <Typography sx={{ mt: 1, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                  Branded SMS via The Role Room (Twilio). E-post-påminnelser er inkludert i abonnementet. Kandidater kan slå av SMS i Talent Portal.
                </Typography>
              </Box>

              <Box
                sx={{
                  p: 1.6,
                  borderRadius: 2,
                  border: '1px solid rgba(34,197,94,0.18)',
                  background: 'rgba(34,197,94,0.06)',
                }}
              >
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  spacing={1.4}
                  justifyContent="space-between"
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                >
                  <Stack spacing={0.4}>
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <WhatsAppIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                      <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
                        Audition-WhatsApp · {account.whatsappUsage?.billingPeriod ?? '—'}
                      </Typography>
                    </Stack>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem' }}>
                      {(account.whatsappUsage?.whatsappCount ?? 0).toLocaleString('nb-NO')} meldinger sendt
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
                      {formatMoney(account.whatsappUsage?.unitPriceNokExVat ?? 0)} per melding eks. mva.
                      {account.whatsappUsage?.vatRate ? ` (+ ${Math.round((account.whatsappUsage.vatRate ?? 0) * 100)}% mva.)` : ''}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.3} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.62)' }}>
                      Tillegg på neste faktura
                    </Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
                      {formatMoney(account.whatsappUsage?.totalNokExVat ?? 0)} eks. mva.
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                      {formatMoney(account.whatsappUsage?.totalNokInclVat ?? 0)} inkl. mva.
                    </Typography>
                  </Stack>
                </Stack>
                <Typography sx={{ mt: 1, fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                  WhatsApp via Meta Cloud API. Bedriften kobler eget WhatsApp Business-nummer i innstillinger; kandidaten ser bedriftens display-navn som avsender.
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <WorkspaceWhatsAppSettings
              orgKey={
                account.teamLead?.email
                  || account.currentUser?.email
                  || null
              }
            />
          </Stack>
        ) : null}

        {!loading && !error && !account ? (
          <Alert severity="info" sx={{ mt: 1 }}>
            Abonnementsinformasjon blir tilgjengelig når denne workspacen er koblet til en kommersiell konto.
          </Alert>
        ) : null}
          </>
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
