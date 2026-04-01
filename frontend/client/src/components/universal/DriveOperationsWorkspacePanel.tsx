import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useTheming } from '../../utils/theming-helper';
import ContextualDriveUploadWorkspace from './ContextualDriveUploadWorkspace';
import GoogleDriveManager from '../google-drive/GoogleDriveManager';
import GoogleDriveProjectSync from '../google-drive/GoogleDriveProjectSync';
import GoogleWorkspaceStorageInfo from './GoogleWorkspaceStorageInfo';
import {
  Alert,
  alpha,
  Box,
  ButtonBase,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CloudDone,
  CloudUpload,
  FolderOpen,
  Refresh,
  Settings as SettingsIcon,
  Sync,
} from '@mui/icons-material';

type DashboardProject = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  clientName?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  projectName?: string | null;
};

type DashboardClient = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

type WorkspaceDriveStatus = {
  connected: boolean;
  status: string;
  accountEmail?: string | null;
  lastSync?: string | null;
  syncEnabled?: boolean;
  message?: string | null;
};

type WorkspaceBackupStatus = {
  available: boolean;
  lastBackup: string | null;
  driveWebViewLink: string | null;
  fileName: string | null;
};

type WorkspaceMode = 'upload' | 'files' | 'sync' | 'storage';

interface DriveOperationsWorkspacePanelProps {
  userId: string;
  profession: string;
  selectedProject?: DashboardProject | null;
  selectedClient?: DashboardClient | null;
  projects?: DashboardProject[];
  onSelectProject?: (project: DashboardProject | null) => void;
  onSelectClient?: (client: DashboardClient | null) => void;
  onProjectUpdate?: (project: DashboardProject) => void;
}

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'Ikke registrert ennå';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Ikke registrert ennå';
  }

  return parsed.toLocaleString('no-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function DriveOperationsWorkspacePanel({
  userId,
  profession,
  selectedProject,
  selectedClient,
  projects = [],
  onSelectProject,
  onSelectClient,
  onProjectUpdate,
}: DriveOperationsWorkspacePanelProps) {
  const theming = useTheming(profession);
  const queryClient = useQueryClient();
  const [activeMode, setActiveMode] = React.useState<WorkspaceMode>('upload');

  const driveStatusQuery = useQuery<WorkspaceDriveStatus>({
    queryKey: ['file-management-google-drive-status', userId],
    queryFn: () => apiRequest(`/api/file-management/google-drive/status?userId=${encodeURIComponent(userId)}`),
    staleTime: 30_000,
  });

  const backupStatusQuery = useQuery<WorkspaceBackupStatus>({
    queryKey: ['universal-settings-workspace-backup-status', userId],
    queryFn: () => apiRequest(`/api/backup/status?userId=${encodeURIComponent(userId)}`),
    staleTime: 15_000,
  });

  const connected = driveStatusQuery.data?.connected === true;
  const projectLabel =
    selectedProject?.title
    || selectedProject?.projectName
    || selectedProject?.name
    || 'Ingen prosjektkontekst valgt';
  const clientLabel =
    selectedProject?.clientName
    || selectedProject?.customerName
    || selectedProject?.companyName
    || selectedClient?.name
    || 'Ingen kunde valgt';

  const workspaceModes: Array<{
    id: WorkspaceMode;
    label: string;
    description: string;
    badge: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'upload',
      label: 'Filsystem',
      description: 'Kontekststyrt opplasting direkte til riktig kundemappe i Drive.',
      badge: selectedProject?.id ? 'Prosjektklart' : 'Velg kontekst',
      icon: <CloudUpload fontSize="small" />,
    },
    {
      id: 'files',
      label: 'Creatorhub Filsystem',
      description: 'Se, del og oppdater filer i aktiv Drive-kontekst uten å gå via innstillinger.',
      badge: connected ? 'Tilkoblet' : 'Koble Workspace',
      icon: <FolderOpen fontSize="small" />,
    },
    {
      id: 'sync',
      label: 'Prosjekt Synk',
      description: 'Hold prosjektmappe, kundekontekst og mappestruktur synkronisert.',
      badge: selectedProject?.id ? 'Aktivt prosjekt' : 'Ingen prosjekt valgt',
      icon: <Sync fontSize="small" />,
    },
    {
      id: 'storage',
      label: 'Lagring & Backup',
      description: 'Kvote, backup-status og samme Workspace-binding som resten av Drive-sporet.',
      badge: backupStatusQuery.data?.available ? 'Backup finnes' : 'Ingen backup',
      icon: <CloudDone fontSize="small" />,
    },
  ];

  const handleRefresh = () => {
    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ['file-management-google-drive-status', userId] }),
      queryClient.invalidateQueries({ queryKey: ['google-drive-context', userId] }),
      queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] }),
      queryClient.invalidateQueries({ queryKey: ['universal-settings-workspace-backup-status', userId] }),
      queryClient.invalidateQueries({ queryKey: ['/api/google-workspace/storage', userId] }),
    ]);
  };

  const renderModeHeader = (title: string, description: string) => (
    <Box sx={{ mb: 2.5 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, color: theming.colors.primary, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
        {description}
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, height: 'calc(100vh - 200px)', overflow: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.25, md: 3 },
          mb: 3,
          borderRadius: 4,
          border: `1px solid ${alpha(theming.colors.primary, 0.12)}`,
          background: `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.08)} 0%, rgba(255,255,255,0.98) 54%, ${alpha('#0f172a', 0.03)} 100%)`,
          boxShadow: `0 24px 54px ${alpha('#0f172a', 0.08)}`,
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          spacing={2}
        >
          <Box sx={{ maxWidth: 860 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, color: theming.colors.primary, mb: 0.75 }}>
              Creatorhub Filsystem
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  bgcolor: connected ? 'success.main' : 'warning.main',
                  boxShadow: connected
                    ? '0 0 0 6px rgba(34, 197, 94, 0.12)'
                    : '0 0 0 6px rgba(245, 158, 11, 0.14)',
                }}
              />
              <Typography variant="body2" sx={{ fontWeight: 700, color: connected ? 'success.dark' : 'warning.dark' }}>
                {connected ? 'Tilkoblet Google Drive' : 'Google Workspace ikke koblet'}
              </Typography>
            </Stack>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              Dette er den operative arbeidsflaten for filopplasting, Google Drive-filer, prosjekt-synk og backup.
              Samme Google Workspace-kobling brukes på tvers av hele flyten, så du skal ikke måtte koble til flere steder.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
            >
              Oppdater arbeidsflate
            </Button>
            <Button
              variant="contained"
              startIcon={<SettingsIcon />}
              onClick={() => setActiveMode('storage')}
              sx={theming.getThemedButtonSx()}
            >
              Åpne Lagring & Backup
            </Button>
          </Stack>
        </Stack>

        {(driveStatusQuery.isLoading || backupStatusQuery.isLoading) && (
          <LinearProgress sx={{ mt: 2.5, borderRadius: 999 }} />
        )}

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2.5, mb: 2 }}>
          <Chip
            label={connected ? 'Google Workspace koblet' : 'Google Workspace ikke koblet'}
            color={connected ? 'success' : 'warning'}
          />
          {driveStatusQuery.data?.accountEmail && (
            <Chip label={driveStatusQuery.data.accountEmail} variant="outlined" />
          )}
          <Chip label={`Prosjekt: ${projectLabel}`} variant="outlined" />
          <Chip label={`Kunde: ${clientLabel}`} variant="outlined" />
          <Chip
            label={
              backupStatusQuery.data?.available
                ? `Siste backup ${formatDateTime(backupStatusQuery.data.lastBackup)}`
                : 'Ingen backup registrert'
            }
            variant="outlined"
          />
        </Stack>

        <Alert severity={connected ? 'info' : 'warning'}>
          {connected
            ? 'Drive, prosjektmapper og opplasting bruker samme Google Workspace-konto. Du trenger ikke koble til flere steder.'
            : 'Google Workspace må kobles til én gang for å aktivere opplasting til Drive, prosjekt-synk og backup.'}
        </Alert>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5,
          mb: 3,
        }}
      >
        {workspaceModes.map((mode) => {
          const selected = activeMode === mode.id;
          return (
            <ButtonBase
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              sx={{
                textAlign: 'left',
                borderRadius: 4,
                overflow: 'hidden',
                border: `1px solid ${selected ? alpha(theming.colors.primary, 0.24) : 'rgba(15, 23, 42, 0.08)'}`,
                background: selected
                  ? `linear-gradient(135deg, ${alpha(theming.colors.primary, 0.1)} 0%, rgba(255,255,255,0.98) 100%)`
                  : 'rgba(255,255,255,0.96)',
                boxShadow: selected
                  ? `0 22px 52px ${alpha(theming.colors.primary, 0.12)}`
                  : `0 16px 36px ${alpha('#0f172a', 0.05)}`,
              }}
            >
              <Box sx={{ p: 2.25, width: '100%' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: selected ? alpha(theming.colors.primary, 0.14) : 'rgba(15, 23, 42, 0.06)',
                      color: selected ? theming.colors.primary : 'text.secondary',
                    }}
                  >
                    {mode.icon}
                  </Box>
                  <Chip
                    size="small"
                    label={mode.badge}
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                  />
                </Stack>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a', mt: 2, mb: 0.75 }}>
                  {mode.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {mode.description}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2.25 },
          borderRadius: 4,
          border: '1px solid rgba(15, 23, 42, 0.08)',
          backgroundColor: 'rgba(255,255,255,0.97)',
          boxShadow: `0 20px 44px ${alpha('#0f172a', 0.07)}`,
        }}
      >
        {activeMode === 'upload' && (
          <Box sx={{ minWidth: 0 }}>
            {renderModeHeader(
              'Filsystem',
              'Last opp direkte til riktig Drive-mappe med kunde- og prosjektkontekst, uten å miste oversikten over hvor filene havner.',
            )}
            <ContextualDriveUploadWorkspace
              userId={userId}
              profession={profession}
              selectedProject={selectedProject}
              selectedClient={selectedClient}
              projects={projects}
              onSelectProject={onSelectProject}
              onSelectClient={onSelectClient}
            />
          </Box>
        )}

        {activeMode === 'files' && (
          <Box sx={{ minWidth: 0 }}>
            {renderModeHeader(
              'Creatorhub Filsystem',
              'Se aktive kundemapper, søk i filer, del lenker og oppdater Drive-konteksten fra samme arbeidsflate som opplastingen.',
            )}
            <GoogleDriveManager
              userId={userId}
              profession={profession}
              selectedProject={selectedProject}
              projects={projects}
              onProjectSelect={onSelectProject}
              onProjectUpdate={onProjectUpdate}
              showWorkspaceReconnectAction={false}
            />
          </Box>
        )}

        {activeMode === 'sync' && (
          <Box sx={{ minWidth: 0 }}>
            {renderModeHeader(
              'Prosjekt Synk',
              'Knyt prosjekt, kunde og Drive-struktur sammen slik at opplastinger, mapper og leveranser går til riktig sted automatisk.',
            )}
            <GoogleDriveProjectSync
              userId={userId}
              profession={profession}
              projectId={selectedProject?.id || undefined}
              selectedProject={selectedProject}
              onProjectSelect={onSelectProject}
              onProjectUpdate={onProjectUpdate}
              showWorkspaceReconnectAction={false}
            />
          </Box>
        )}

        {activeMode === 'storage' && (
          <Stack spacing={2.5}>
            {renderModeHeader(
              'Lagring & Backup',
              'Kvote, backup og Drive-lagring bruker samme Google Workspace-konto. Dette er den operative oversikten for lagringsstatus uten å forlate filarbeidsflaten.',
            )}

            <Alert severity={connected ? 'info' : 'warning'}>
              {connected
                ? `Samme konto brukes på tvers av opplasting, Drive-filer, prosjekt-synk og backup${driveStatusQuery.data?.accountEmail ? `: ${driveStatusQuery.data.accountEmail}` : ''}.`
                : 'Koble Google Workspace én gang for å aktivere lagring, backup og filarbeidsflyt.'}
            </Alert>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              <Box sx={{ p: 2.25, borderRadius: 3, bgcolor: alpha(theming.colors.primary, 0.08) }}>
                <Typography variant="caption" color="text.secondary">
                  Workspace
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.4 }}>
                  {connected ? 'Klar for Drive' : 'Må kobles til'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                  {driveStatusQuery.data?.message || 'Samme kobling brukes for Drive, synk og backup.'}
                </Typography>
              </Box>

              <Box sx={{ p: 2.25, borderRadius: 3, bgcolor: 'rgba(15, 118, 110, 0.08)' }}>
                <Typography variant="caption" color="text.secondary">
                  Siste backup
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.4 }}>
                  {backupStatusQuery.data?.available ? 'Lagret i Google Drive' : 'Ingen backup ennå'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                  {backupStatusQuery.data?.lastBackup
                    ? `Sist kjørt ${formatDateTime(backupStatusQuery.data.lastBackup)}`
                    : 'Kjør backup når Workspace er koblet og klar.'}
                </Typography>
              </Box>

              <Box sx={{ p: 2.25, borderRadius: 3, bgcolor: 'rgba(245, 158, 11, 0.1)' }}>
                <Typography variant="caption" color="text.secondary">
                  Aktiv kontekst
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mt: 0.4 }}>
                  {projectLabel}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
                  {clientLabel}
                </Typography>
              </Box>
            </Box>

            <Paper
              elevation={0}
              sx={{
                p: 2.25,
                borderRadius: 3,
                border: '1px solid rgba(15, 23, 42, 0.08)',
                backgroundColor: 'rgba(255,255,255,0.92)',
              }}
            >
              <GoogleWorkspaceStorageInfo
                userId={userId}
                profession={profession}
                compact={false}
                showDetailsButton={false}
              />
            </Paper>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                startIcon={<FolderOpen />}
                disabled={!backupStatusQuery.data?.driveWebViewLink}
                onClick={() => {
                  if (backupStatusQuery.data?.driveWebViewLink) {
                    window.open(backupStatusQuery.data.driveWebViewLink, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                Åpne siste backup
              </Button>
              <Button
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => setActiveMode('storage')}
              >
                Gå til Lagring & Backup
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
