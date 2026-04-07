/**
 * Google Workspace Storage Information Component
 * Viser en reell lagringsoversikt koblet til Google Drive når Workspace er aktiv.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { lightroomIntegrationService } from '@/services/lightroomIntegrationService';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  CloudQueue,
  FolderOpen,
  Google as GoogleIcon,
  Refresh,
  Storage,
  Warning,
} from '@mui/icons-material';

interface GoogleWorkspaceStorageData {
  totalStorageGB: number;
  usedStorageGB: number;
  availableStorageGB: number;
  usagePercentage: number;
  storageQuotaType: 'personal' | 'business' | 'enterprise';
  driveUsageGB: number;
  photosUsageGB: number;
  gmailUsageGB: number;
  lastUpdated: string;
  googleDriveConnected?: boolean;
  driveSyncEnabled?: boolean;
  driveConnectionStatus?: string;
  driveAccountEmail?: string | null;
  lastDriveSyncAt?: string | null;
  dataSource?: 'live-drive' | 'database-estimate';
  workspaceWarning?: string | null;
}

interface GoogleWorkspaceStorageInfoProps {
  userId: string;
  compact?: boolean;
  showDetailsButton?: boolean;
  profession?: string;
  onMeetingCreate?: (meeting: unknown) => void;
  onProjectUpdate?: (project: unknown) => void;
  onWorklogCreate?: (worklog: unknown) => void;
  onFileUpload?: (file: unknown) => void;
  onFileDownload?: (file: unknown) => void;
  selectedProject?: unknown;
  onProjectSelect?: (project: unknown) => void;
}

export const GoogleWorkspaceStorageInfo: React.FC<GoogleWorkspaceStorageInfoProps> = ({
  userId,
  compact = false,
  showDetailsButton = true,
  profession = 'photographer',
}) => {
  const theme = useTheme();
  const theming = useTheming(profession);
  const { communication, dataFlow, componentRegistry, auth } = useEnhancedMasterIntegration();
  const [showDetails, setShowDetails] = useState(false);
  const [workspaceAction, setWorkspaceAction] = useState<'reconnect' | null>(null);
  const [workspaceActionError, setWorkspaceActionError] = useState<string | null>(null);
  const normalizedUserId = String(userId || 'guest').trim().replace(/,+$/, '') || 'guest';

  const { data: storageData, isLoading, error, refetch } = useQuery<GoogleWorkspaceStorageData>({
    queryKey: ['/api/google-workspace/storage', normalizedUserId],
    queryFn: async () => {
      const headers = await auth.getAuthHeader();
      return apiRequest(`/api/google-workspace/storage/${normalizedUserId}`, { headers });
    },
    refetchInterval: 5 * 60 * 1000,
  });

  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'GoogleWorkspaceStorageInfo',
      name: 'Google Workspace Storage Info',
      type: 'universal',
      category: 'google-service',
      capabilities: [
        'storage-monitoring',
        'quota-management',
        'usage-tracking',
        'workspace-integration',
      ],
      dependencies: [],
      props: [],
      events: [],
      dataKeys: ['storage-data', 'usage-stats', 'quota-info', 'workspace-status'],
    });

    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'storage-data',
    });
    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'usage-stats',
    });
    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'quota-info',
    });
    dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleWorkspaceStorageInfo',
      dataKey: 'workspace-status',
    });

    const unsubscribeRefresh = communication.onMessageType(
      'google-workspace: refresh-storage',
      () => {
        void refetch();
      },
    );

    const unsubscribeWarning = communication.onMessageType(
      'google-workspace: storage-warning',
      (payload: unknown) => {
        if (payload) {
          console.log('Storage warning received:', payload);
        }
      },
    );

    return () => {
      componentRegistry.unregisterComponent('GoogleWorkspaceStorageInfo');
      dataFlow.unregisterNode('storage-data');
      dataFlow.unregisterNode('usage-stats');
      dataFlow.unregisterNode('quota-info');
      dataFlow.unregisterNode('workspace-status');
      unsubscribeRefresh();
      unsubscribeWarning();
    };
  }, [communication, componentRegistry, dataFlow, refetch]);

  const formatStorageSize = (sizeGB: number): string => {
    if (!Number.isFinite(sizeGB) || sizeGB <= 0) {
      return '0 GB';
    }
    if (sizeGB < 1) {
      return `${Math.round(sizeGB * 1024)} MB`;
    }
    return `${sizeGB.toFixed(1)} GB`;
  };

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return 'Ikke tilgjengelig';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Ikke tilgjengelig';
    return parsed.toLocaleString('no-NO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const safePercentage = (value: number | undefined): number => {
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value ?? 0));
  };

  const getStorageStatusColor = (percentage: number) => {
    if (percentage < 50) return theme.palette.success.main;
    if (percentage < 80) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const getStorageStatusText = (percentage: number): string => {
    if (percentage < 50) return 'God lagringsplass';
    if (percentage < 80) return 'Moderat bruk';
    if (percentage < 95) return 'Høy bruk - vurder opprydding';
    return 'Kritisk - lagring nesten full';
  };

  const handleWorkspaceReconnect = async () => {
    try {
      setWorkspaceAction('reconnect');
      setWorkspaceActionError(null);
      await lightroomIntegrationService.startGoogleWorkspaceReconnect();
    } catch (reconnectError) {
      setWorkspaceActionError(
        reconnectError instanceof Error
          ? reconnectError.message
          : 'Kunne ikke starte Google-SSO.',
      );
    } finally {
      setWorkspaceAction(null);
    }
  };

  if (isLoading) {
    return (
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <GoogleIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Google Workspace Lagring
            </Typography>
          </Stack>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Henter lagringsinformasjon fra Google Drive...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    if (compact) {
      return (
        <Card
          sx={{
            mb: 2,
            borderLeft: `4px solid ${theme.palette.warning.main}`,
            background: alpha(theme.palette.warning.main, 0.05),
            ...theming.getThemedCardSx(),
          }}
        >
          <CardContent sx={{ p: 2, ...theming.getThemedCardSx() }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Warning sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
                <Typography variant="body2" color="text.secondary">
                  Google Workspace utilgjengelig
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Prøv igjen">
                  <IconButton size="small" onClick={() => void refetch()}>
                    <Refresh sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Google-SSO styres fra brukerfeltet, så denne modulen trenger ikke en egen reconnect-knapp.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Alert
            severity="warning"
            action={
              <Button size="small" onClick={() => void refetch()}>
                Prøv igjen
              </Button>
            }
          >
            Google Workspace lagringsinformasjon er ikke tilgjengelig akkurat nå. Hvis økten må fornyes, gjør du det i brukerfeltet.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!storageData) {
    return (
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Alert
            severity="info"
            action={
              <Button size="small" onClick={() => void refetch()}>
                Oppdater
              </Button>
            }
          >
            Ingen Google Workspace-lagringsdata tilgjengelig ennå.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const data = storageData;
  const driveConnected = Boolean(data.googleDriveConnected);
  const driveSyncEnabled = Boolean(data.driveSyncEnabled);
  const liveDriveData = data.dataSource === 'live-drive';
  const driveStatusLabel = driveConnected ? 'Google Drive koblet' : 'Google Drive ikke koblet';
  const quotaSourceLabel = liveDriveData ? 'Live fra Google Drive' : 'Estimert fra CreatorHub-data';

  if (compact) {
    return (
      <Card
        sx={{
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          ...theming.getThemedCardSx(),
        }}
      >
        <CardContent sx={{ p: 2, ...theming.getThemedCardSx() }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Stack spacing={0.75}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <GoogleIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="body2" fontWeight="600">
                  Google Workspace Lagring
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                <Chip
                  label={driveStatusLabel}
                  size="small"
                  color={driveConnected ? 'success' : 'warning'}
                  variant={driveConnected ? 'filled' : 'outlined'}
                />
                <Chip label={quotaSourceLabel} size="small" variant="outlined" />
              </Stack>
            </Stack>
            <Chip
              label={`${formatStorageSize(data.usedStorageGB)} / ${formatStorageSize(data.totalStorageGB)}`}
              size="small"
              sx={{
                backgroundColor: alpha(getStorageStatusColor(data.usagePercentage), 0.1),
                color: getStorageStatusColor(data.usagePercentage),
                fontWeight: 600,
              }}
            />
          </Stack>

          <LinearProgress
            variant="determinate"
            value={safePercentage(data.usagePercentage)}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.grey[300], 0.3),
              '& .MuiLinearProgress-bar': {
                backgroundColor: getStorageStatusColor(data.usagePercentage),
                borderRadius: 3,
              },
            }}
          />

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {getStorageStatusText(data.usagePercentage)}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              {!driveConnected && (
                <Button
                  size="small"
                  onClick={handleWorkspaceReconnect}
                  disabled={workspaceAction === 'reconnect'}
                  sx={{ fontSize: '0.7rem', minWidth: 'auto', p: 0.5 }}
                >
                  {workspaceAction === 'reconnect' ? 'Starter…' : 'Forny SSO'}
                </Button>
              )}
              {showDetailsButton && (
                <Button
                  size="small"
                  onClick={() => setShowDetails(true)}
                  sx={{ fontSize: '0.7rem', minWidth: 'auto', p: 0.5 }}
                >
                  Detaljer
                </Button>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card sx={{ mb: 2, ...theming.getThemedCardSx() }}>
        <CardContent sx={theming.getThemedCardSx()}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            spacing={2}
            sx={{ mb: 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <GoogleIcon sx={{ color: theme.palette.primary.main, fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight="600" sx={{ color: theming.colors.primary }}>
                  Google Workspace Lagring
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Direkte koblet til Google Drive når Workspace er aktiv
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Tooltip title="Oppdater lagringsinformasjon">
                <IconButton onClick={() => void refetch()} size="small">
                  <Refresh />
                </IconButton>
              </Tooltip>
              {driveConnected ? (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => window.open('https://drive.google.com/settings/storage', '_blank')}
                  startIcon={<FolderOpen />}
                >
                  Administrer i Google Drive
                </Button>
              ) : null}
              {showDetailsButton && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowDetails(true)}
                >
                  Detaljer
                </Button>
              )}
            </Stack>
            {!driveConnected ? (
              <Typography variant="caption" color="text.secondary">
                Google-SSO fornyes i brukerfeltet og gjelder deretter for hele arbeidsflaten.
              </Typography>
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip
              label={driveStatusLabel}
              color={driveConnected ? 'success' : 'warning'}
              variant={driveConnected ? 'filled' : 'outlined'}
            />
            <Chip label={quotaSourceLabel} variant="outlined" />
            {data.driveAccountEmail && <Chip label={data.driveAccountEmail} variant="outlined" />}
            {driveConnected && !driveSyncEnabled && (
              <Chip label="Sync er slått av" color="warning" variant="outlined" />
            )}
          </Stack>

          {workspaceActionError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {workspaceActionError}
            </Alert>
          )}

          {data.workspaceWarning && (
            <Alert severity={driveConnected ? 'info' : 'warning'} sx={{ mb: 2 }}>
              {data.workspaceWarning}
            </Alert>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Box sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body1" fontWeight="600">
                    Total lagring
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight="600"
                    sx={{ color: getStorageStatusColor(data.usagePercentage) }}
                  >
                    {formatStorageSize(data.usedStorageGB)} / {formatStorageSize(data.totalStorageGB)}
                  </Typography>
                </Stack>

                <LinearProgress
                  variant="determinate"
                  value={safePercentage(data.usagePercentage)}
                  sx={{
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: alpha(theme.palette.grey[300], 0.3),
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: getStorageStatusColor(data.usagePercentage),
                      borderRadius: 6,
                    },
                  }}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {safePercentage(data.usagePercentage).toFixed(1)}% brukt
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatStorageSize(data.availableStorageGB)} ledig
                  </Typography>
                </Stack>
              </Box>

              <Alert severity={!driveConnected || data.usagePercentage > 80 ? 'warning' : 'info'} sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Status:</strong> {getStorageStatusText(data.usagePercentage)}
                  {driveConnected && data.lastDriveSyncAt && (
                    <> • Sist synkronisert {formatDateTime(data.lastDriveSyncAt)}</>
                  )}
                  {!driveConnected && (
                    <> • Forny Google-SSO for å hente live Drive-kvote og riktig lagringsstatus.</>
                  )}
                  {data.usagePercentage > 90 && (
                    <> - Vi anbefaler å rydde opp i gamle filer eller oppgradere lagringen.</>
                  )}
                </Typography>
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="body1" fontWeight="600" sx={{ mb: 2 }}>
                Fordeling
              </Typography>

              <Stack spacing={2}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <FolderOpen sx={{ fontSize: 16, color: theme.palette.info.main }} />
                      <Typography variant="body2">Google Drive</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.driveUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={safePercentage(((data.driveUsageGB || 0) / (data.totalStorageGB || 1)) * 100)}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.info.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.info.main,
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Storage sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                      <Typography variant="body2">Google Photos</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.photosUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={safePercentage(((data.photosUsageGB || 0) / (data.totalStorageGB || 1)) * 100)}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.warning.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.warning.main,
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CloudQueue sx={{ fontSize: 16, color: theme.palette.secondary.main }} />
                      <Typography variant="body2">Gmail</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight="600">
                      {formatStorageSize(data.gmailUsageGB)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={safePercentage(((data.gmailUsageGB || 0) / (data.totalStorageGB || 1)) * 100)}
                    sx={{
                      height: 4,
                      mt: 0.5,
                      backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: theme.palette.secondary.main,
                      },
                    }}
                  />
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onClose={() => setShowDetails(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <GoogleIcon color="primary" />
            <Typography variant="h6" sx={{ color: theming.colors.primary }}>
              Google Workspace Lagring - Detaljer
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Konto informasjon
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Konto type:
                  </Typography>
                  <Chip
                    label={
                      data.storageQuotaType === 'enterprise'
                        ? 'Enterprise'
                        : data.storageQuotaType === 'business'
                          ? 'Business'
                          : 'Personal'
                    }
                    size="small"
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Google Drive:
                  </Typography>
                  <Typography variant="body2">
                    {driveStatusLabel}
                    {data.driveAccountEmail ? ` (${data.driveAccountEmail})` : ''}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Datakilde:
                  </Typography>
                  <Typography variant="body2">{quotaSourceLabel}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Sist oppdatert:
                  </Typography>
                  <Typography variant="body2">{formatDateTime(data.lastUpdated)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Siste Drive-sync:
                  </Typography>
                  <Typography variant="body2">{formatDateTime(data.lastDriveSyncAt)}</Typography>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: theming.colors.primary }}>
                Anbefalinger for {profession}
              </Typography>
              <Stack spacing={2}>
                {data.usagePercentage > 80 && (
                  <Alert severity="warning">
                    <Typography variant="body2">
                      <strong>Høy lagringsbruk:</strong> Vurder å:
                      <br />• slette gamle prosjektfiler som ikke lenger trengs
                      <br />• arkivere fullførte prosjekter til ekstern lagring
                      <br />• oppgradere til større Google Workspace-plan
                    </Typography>
                  </Alert>
                )}

                {!driveConnected && (
                  <Alert severity="info">
                    <Typography variant="body2">
                      <strong>Aktiver Google-SSO:</strong> Da henter CreatorHub live Drive-kvote og lagrer
                      publiseringer, backup og plugin-filer i riktig Google Drive-struktur.
                    </Typography>
                  </Alert>
                )}

                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Tips for {profession}er:</strong>
                    <br />• bruk Google Drive som primær lagringskilde for prosjekter og showcase
                    <br />• organiser prosjektfiler i strukturerte mapper
                    <br />• aktiver automatisk backup fra CreatorHub der det er tilgjengelig
                  </Typography>
                </Alert>
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Lukk</Button>
          <Button variant="contained" sx={theming.getThemedButtonSx()} onClick={() => void refetch()}>
            Oppdater data
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default GoogleWorkspaceStorageInfo;
