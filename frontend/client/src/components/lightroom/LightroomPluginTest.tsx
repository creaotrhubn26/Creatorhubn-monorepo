import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudDownload,
  CloudSync,
  ContentCopy,
  DriveFolderUpload,
  ErrorOutline,
  Link as LinkIcon,
  PhotoLibrary,
  Refresh,
  Science,
  Security,
} from '@mui/icons-material';
import {
  lightroomIntegrationService,
  type LightroomExportResult,
  type LightroomIntegrationStatus,
  type LightroomTokenResponse,
} from '@/services/lightroomIntegrationService';

const installSteps = [
  'Last ned installasjonspakken fra CreatorHub.',
  'Pakk ut zip-filen og åpne Lightroom Classic.',
  'Gå til File > Plug-in Manager > Add og velg mappen CreatorHubNorge.lrplugin.',
  'Eksporter via File > Export > CreatorHub Norge for å lagre filer i Google Drive og publisere til showcase.',
];

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Ikke kjørt ennå';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('no-NO');
}

function statusTone(status: string): 'success' | 'warning' | 'error' | 'info' {
  if (status === 'synced' || status === 'success') {
    return 'success';
  }
  if (status === 'error') {
    return 'error';
  }
  if (status === 'idle') {
    return 'info';
  }
  return 'warning';
}

function IntegrationSummary({
  status,
  latestSmokeResult,
}: {
  status: LightroomIntegrationStatus;
  latestSmokeResult: LightroomExportResult | null;
}) {
  const latestRun = status.recentRuns[0];

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Security color={status.workspaceConnected ? 'success' : 'warning'} />
              <Typography variant="h6">Google Workspace</Typography>
            </Stack>
            <Alert severity={status.workspaceConnected ? 'success' : 'warning'}>
              {status.workspaceConnected
                ? `Koblet til ${status.googleEmail || 'Google Workspace'}`
                : status.workspaceError || 'Koble Google Workspace før Lightroom-pluginen brukes.'}
            </Alert>
            {status.workspaceWarning ? (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                {status.workspaceWarning}
              </Alert>
            ) : null}
            {status.driveRootFolderName ? (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Siste Drive-rot
                </Typography>
                <Typography variant="subtitle2">{status.driveRootFolderName}</Typography>
              </Box>
            ) : null}
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <PhotoLibrary color={status.connected ? 'success' : 'disabled'} />
              <Typography variant="h6">Pluginstatus</Typography>
            </Stack>
            <Stack spacing={1}>
              <Chip
                label={status.connected ? `v${status.pluginVersion} aktiv` : 'Ikke konfigurert'}
                color={status.connected ? 'success' : 'default'}
                variant={status.connected ? 'filled' : 'outlined'}
              />
              <Chip
                label={`Token: ${status.tokenPreview || 'mangler'}`}
                color={status.tokenPreview ? 'info' : 'default'}
                variant="outlined"
              />
              <Chip
                label={`Sync: ${status.syncStatus}`}
                color={statusTone(status.syncStatus)}
                variant="outlined"
              />
            </Stack>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Siste synk
              </Typography>
              <Typography variant="subtitle2">{formatDateTime(status.lastSyncAt)}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <Science color={latestSmokeResult ? 'success' : 'info'} />
              <Typography variant="h6">E2E-test</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Siste kjøring
            </Typography>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {formatDateTime(latestRun?.createdAt || null)}
            </Typography>
            {latestSmokeResult ? (
              <Alert severity="success">
                Drive-fil {latestSmokeResult.driveFileId.slice(0, 8)}… og showcase-element{' '}
                {latestSmokeResult.showcaseItemId.slice(0, 8)}… ble opprettet.
              </Alert>
            ) : (
              <Alert severity={latestRun?.status === 'error' ? 'error' : 'info'}>
                {latestRun?.status === 'error'
                  ? 'Forrige test feilet. Kjør smoke-test på nytt etter at Drive er koblet.'
                  : 'Ingen browser-basert smoke-test kjørt ennå.'}
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

const LightroomPluginTest: React.FC = () => {
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'info' });
  const [latestToken, setLatestToken] = React.useState<LightroomTokenResponse | null>(null);
  const [latestSmokeResult, setLatestSmokeResult] = React.useState<LightroomExportResult | null>(null);

  const statusQuery = useQuery({
    queryKey: ['lightroom-integration-status'],
    queryFn: () => lightroomIntegrationService.getStatus(),
  });

  const refreshStatus = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['lightroom-integration-status'] });
  }, [queryClient]);

  const tokenMutation = useMutation({
    mutationFn: () => lightroomIntegrationService.rotateToken(),
    onSuccess: async (result) => {
      setLatestToken(result);
      try {
        await navigator.clipboard.writeText(result.token);
        setSnackbar({
          open: true,
          message: 'Nytt Lightroom-token generert og kopiert til utklippstavlen.',
          severity: 'success',
        });
      } catch {
        setSnackbar({
          open: true,
          message: 'Nytt Lightroom-token generert.',
          severity: 'success',
        });
      }
      await refreshStatus();
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke generere nytt token.',
        severity: 'error',
      });
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      await lightroomIntegrationService.downloadPluginPackage(false);
    },
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: 'Installasjonspakken lastes ned.',
        severity: 'success',
      });
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke laste ned pluginpakken.',
        severity: 'error',
      });
    },
  });

  const smokeMutation = useMutation({
    mutationFn: () => lightroomIntegrationService.runSmokeExport(),
    onSuccess: async (result) => {
      setLatestSmokeResult(result);
      setSnackbar({
        open: true,
        message: 'Smoke-test fullført. Filen er lagret i Google Drive og publisert til showcase.',
        severity: 'success',
      });
      await refreshStatus();
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Smoke-test feilet.',
        severity: 'error',
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: () => lightroomIntegrationService.startGoogleWorkspaceReconnect(),
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Kunne ikke starte Google Workspace-tilkoblingen.',
        severity: 'error',
      });
    },
  });

  const copyToken = React.useCallback(async () => {
    if (!latestToken?.token) {
      setSnackbar({
        open: true,
        message: 'Generer et nytt token først.',
        severity: 'info',
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(latestToken.token);
      setSnackbar({
        open: true,
        message: 'Token kopiert til utklippstavlen.',
        severity: 'success',
      });
    } catch {
      setSnackbar({
        open: true,
        message: 'Kunne ikke kopiere token automatisk.',
        severity: 'error',
      });
    }
  }, [latestToken]);

  if (statusQuery.isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
        <CircularProgress size={24} />
        <Typography>Henter Lightroom-integrasjonsstatus…</Typography>
      </Box>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {statusQuery.error instanceof Error
          ? statusQuery.error.message
          : 'Kunne ikke hente Lightroom-integrasjonen.'}
      </Alert>
    );
  }

  const status = statusQuery.data;

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Lightroom Plugin
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Faktisk status for Lightroom, Google Drive og showcase-publisering. Denne flaten kjører mot live backend-ruter, ikke simulert data.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={() => void refreshStatus()}
            disabled={statusQuery.isFetching}
          >
            Oppdater status
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudDownload />}
            onClick={() => downloadMutation.mutate()}
            disabled={downloadMutation.isPending}
          >
            {downloadMutation.isPending ? 'Forbereder…' : 'Last ned installasjonspakke'}
          </Button>
        </Stack>
      </Stack>

      <IntegrationSummary status={status} latestSmokeResult={latestSmokeResult} />

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} lg={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Drift og testing
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Security />}
                  onClick={() => tokenMutation.mutate()}
                  disabled={tokenMutation.isPending}
                >
                  {tokenMutation.isPending ? 'Genererer…' : 'Roter plugin-token'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ContentCopy />}
                  onClick={() => void copyToken()}
                >
                  Kopier siste token
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Science />}
                  onClick={() => smokeMutation.mutate()}
                  disabled={smokeMutation.isPending || !status.workspaceConnected}
                >
                  {smokeMutation.isPending ? 'Tester…' : 'Kjør E2E smoke-test'}
                </Button>
                {!status.workspaceConnected ? (
                  <Button
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => reconnectMutation.mutate()}
                    disabled={reconnectMutation.isPending}
                  >
                    {reconnectMutation.isPending ? 'Starter…' : 'Koble Google Workspace'}
                  </Button>
                ) : null}
                {status.driveRootFolderUrl ? (
                  <Button
                    component="a"
                    href={status.driveRootFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                    startIcon={<DriveFolderUpload />}
                  >
                    Åpne Drive-mappe
                  </Button>
                ) : null}
              </Stack>

              {!status.workspaceConnected ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Lightroom-pluginen er klar til nedlasting, men eksport til Google Drive vil feile til Google Workspace er koblet til for denne brukeren.
                </Alert>
              ) : status.workspaceWarning ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {status.workspaceWarning}
                </Alert>
              ) : null}

              {latestToken ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Nytt token: <strong>{latestToken.token}</strong>
                </Alert>
              ) : null}

              {latestSmokeResult ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Smoke-testen opprettet Drive-fil{' '}
                  <strong>{latestSmokeResult.driveFileId}</strong> i{' '}
                  <strong>{latestSmokeResult.driveFolderName}</strong> og showcase-element{' '}
                  <strong>{latestSmokeResult.showcaseItemId}</strong>.
                </Alert>
              ) : null}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Installasjonsflyt
              </Typography>
              <List dense disablePadding>
                {installSteps.map((step, index) => (
                  <ListItem key={step} disableGutters>
                    <ListItemText
                      primary={`${index + 1}. ${step}`}
                      secondary={index === 0 ? 'Pakken inneholder en ekte CreatorHubNorge.lrplugin-mappe med brukerbundet token.' : undefined}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Nylige kjøringer
              </Typography>
              {status.recentRuns.length === 0 ? (
                <Alert severity="info">Ingen Lightroom-kjøringer registrert ennå.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {status.recentRuns.map((run) => (
                    <Box
                      key={run.id}
                      sx={{
                        p: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                        {run.status === 'success' ? (
                          <CheckCircle color="success" fontSize="small" />
                        ) : run.status === 'error' ? (
                          <ErrorOutline color="error" fontSize="small" />
                        ) : (
                          <CloudSync color="info" fontSize="small" />
                        )}
                        <Typography variant="subtitle2">{formatDateTime(run.createdAt)}</Typography>
                      </Stack>
                      <Typography variant="body2" color="text.secondary">
                        Status: {run.status}
                      </Typography>
                      {run.metadata.title ? (
                        <Typography variant="body2">Tittel: {String(run.metadata.title)}</Typography>
                      ) : null}
                      {run.metadata.driveFolderName ? (
                        <Typography variant="body2">
                          Drive-mappe: {String(run.metadata.driveFolderName)}
                        </Typography>
                      ) : null}
                      {run.driveFileId ? (
                        <Typography variant="body2">Drive-fil: {run.driveFileId}</Typography>
                      ) : null}
                      {run.showcaseItemId ? (
                        <Typography variant="body2">Showcase: {run.showcaseItemId}</Typography>
                      ) : null}
                    </Box>
                  ))}
                </Stack>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Teknisk status
              </Typography>
              <Stack spacing={1}>
                <Chip
                  icon={<LinkIcon />}
                  label={`API: ${status.apiBaseUrl}`}
                  variant="outlined"
                />
                <Chip
                  label={`Scopes: ${status.storedScopes.length > 0 ? status.storedScopes.length : 0}`}
                  variant="outlined"
                />
                <Chip
                  label={`Drive-rot: ${status.driveRootFolderName || 'Ikke opprettet ennå'}`}
                  variant="outlined"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LightroomPluginTest;
