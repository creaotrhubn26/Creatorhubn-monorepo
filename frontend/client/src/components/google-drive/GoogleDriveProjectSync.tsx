import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { lightroomIntegrationService } from '@/services/lightroomIntegrationService';
import { useTheming } from '../../utils/theming-helper';
import {
  Alert,
  Box,
  Button,
  Card as MuiCard,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudDone,
  CloudUpload,
  Folder,
  FolderOpen,
  Google as GoogleIcon,
  Refresh,
  Schedule,
  Sync,
  Warning,
} from '@mui/icons-material';

type ProjectLike = {
  id?: string | null;
  title?: string | null;
  name?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  company?: string | null;
  customerId?: string | null;
  clientId?: string | null;
};

interface GoogleDriveProjectSyncProps {
  userId: string;
  profession: string;
  projectId?: string;
  showWorkspaceReconnectAction?: boolean;
  onFileUpload?: (file: unknown) => void;
  onFileDownload?: (file: unknown) => void;
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  selectedProject?: ProjectLike | null;
  onProjectSelect?: (project: Record<string, unknown>) => void;
}

interface GoogleDriveStatusResponse {
  connected: boolean;
  status: string;
  message?: string;
  syncEnabled?: boolean;
  accountEmail?: string | null;
  lastSync?: string | null;
}

interface DriveSection {
  id: string;
  label: string;
  description: string;
  category: string;
  recommended: boolean;
  folderId: string | null;
  folderName: string | null;
  query: string | null;
  scope: string | null;
}

interface DriveFolder {
  id: string;
  name: string;
  webViewLink: string | null;
  modifiedTime: string | null;
}

interface DriveContextResponse {
  customerFolder?: {
    id: string;
    name: string;
    webViewLink: string | null;
  } | null;
  projectFolder?: {
    id: string;
    name: string;
    webViewLink: string | null;
  } | null;
  sections: DriveSection[];
  recentFolders: DriveFolder[];
  folderStructure: {
    source: string;
    folders: string[];
    quoteFolderName: string;
    contractFolderName: string;
    primaryFolderId: string | null;
    primaryFolderName: string | null;
    primaryScope: string | null;
  };
  customerContext: {
    customerId: string | null;
    customerName: string | null;
    companyName: string | null;
    projectId: string | null;
    folderId: string | null;
    folderName: string | null;
    folderReady: boolean;
  };
}

interface DriveFilesResponse {
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number | null;
    modifiedTime: string | null;
    webViewLink: string | null;
    webContentLink: string | null;
  }>;
}

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return 'Ikke tilgjengelig';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Ikke tilgjengelig';
  return parsed.toLocaleString('no-NO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFileSize = (value: number | null): string => {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return 'Ukjent størrelse';
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export const GoogleDriveProjectSync: React.FC<GoogleDriveProjectSyncProps> = ({
  userId,
  profession,
  projectId,
  showWorkspaceReconnectAction = true,
  onProjectUpdate,
  selectedProject,
}) => {
  const queryClient = useQueryClient();
  const theming = useTheming(profession);
  const [autoSyncEnabled, setAutoSyncEnabled] = React.useState(true);

  const normalizedProjectId =
    readNonEmptyString(projectId)
    || readNonEmptyString(selectedProject?.id)
    || null;
  const projectName =
    readNonEmptyString(selectedProject?.title)
    || readNonEmptyString(selectedProject?.projectName)
    || readNonEmptyString(selectedProject?.name)
    || 'Prosjekt';
  const customerName =
    readNonEmptyString(selectedProject?.clientName)
    || readNonEmptyString(selectedProject?.customerName)
    || null;
  const companyName =
    readNonEmptyString(selectedProject?.companyName)
    || readNonEmptyString(selectedProject?.company)
    || null;
  const customerId =
    readNonEmptyString(selectedProject?.customerId)
    || readNonEmptyString(selectedProject?.clientId)
    || null;

  const driveStatusQuery = useQuery<GoogleDriveStatusResponse>({
    queryKey: ['file-management-google-drive-status', userId],
    queryFn: async () => apiRequest(`/api/file-management/google-drive/status?userId=${encodeURIComponent(userId)}`),
  });

  const driveContextQuery = useQuery<DriveContextResponse>({
    queryKey: [
      'google-drive-context',
      userId,
      normalizedProjectId,
      customerId,
      customerName,
      companyName,
      projectName,
    ],
    queryFn: async () => {
      const search = new URLSearchParams({
        userId,
        profession,
      });
      if (normalizedProjectId) search.set('projectId', normalizedProjectId);
      if (projectName) search.set('projectName', projectName);
      if (customerId) search.set('customerId', customerId);
      if (customerName) search.set('customerName', customerName);
      if (companyName) search.set('companyName', companyName);
      return apiRequest(`/api/google/drive/context?${search.toString()}`);
    },
    enabled: driveStatusQuery.data?.connected === true,
  });

  const primaryFolderId = driveContextQuery.data?.folderStructure.primaryFolderId ?? null;
  const primaryFolderName = driveContextQuery.data?.folderStructure.primaryFolderName ?? null;

  const driveFilesQuery = useQuery<DriveFilesResponse>({
    queryKey: ['google-drive-files', userId, primaryFolderId],
    queryFn: async () => {
      const search = new URLSearchParams({
        userId,
        folderId: primaryFolderId ?? '',
        pageSize: '8',
      });
      return apiRequest(`/api/google/drive/files?${search.toString()}`);
    },
    enabled: driveStatusQuery.data?.connected === true && Boolean(primaryFolderId),
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/google/drive/context', {
        method: 'POST',
        body: {
          userId,
          profession,
          projectId: normalizedProjectId,
          projectName,
          customerId,
          customerName,
          companyName,
        },
      });
    },
    onSuccess: (payload: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['google-drive-context', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['file-management-google-drive-status', userId] });

      if (
        onProjectUpdate
        && payload
        && typeof payload === 'object'
        && normalizedProjectId
      ) {
        const data = payload as DriveContextResponse;
        onProjectUpdate({
          id: normalizedProjectId,
          driveFolderId: data.folderStructure?.primaryFolderId ?? null,
          driveFolderName: data.folderStructure?.primaryFolderName ?? null,
          driveCustomerFolderId: data.customerContext?.folderId ?? null,
          driveCustomerFolderName: data.customerContext?.folderName ?? null,
        });
      }
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => lightroomIntegrationService.startGoogleWorkspaceReconnect(),
  });

  const handleOpenFolder = (webViewLink: string | null | undefined) => {
    if (webViewLink) {
      window.open(webViewLink, '_blank', 'noopener,noreferrer');
    }
  };

  const status = driveStatusQuery.data;
  const statusLoading = driveStatusQuery.isLoading;
  const context = driveContextQuery.data;
  const files = driveFilesQuery.data?.files ?? [];
  const sections = context?.sections ?? [];
  const recentFolders = context?.recentFolders ?? [];
  const folderReady = Boolean(context?.folderStructure.primaryFolderId);

  return (
    <MuiCard elevation={2}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sync color="primary" />
              Prosjekt Synkronisering
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hold valgt prosjekt koblet til riktig Google Drive-mappe og tilgjengelige undermapper.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <FormControlLabel
              control={
                <Switch
                  checked={autoSyncEnabled}
                  onChange={(event) => setAutoSyncEnabled(event.target.checked)}
                  size="small"
                />
              }
              label="Auto-sync"
            />
            <Tooltip title="Oppdater synkstatus">
              <IconButton
                size="small"
                onClick={() => {
                  void queryClient.invalidateQueries({ queryKey: ['file-management-google-drive-status', userId] });
                  void queryClient.invalidateQueries({ queryKey: ['google-drive-context', userId] });
                  void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
                }}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              size="small"
              startIcon={<CloudUpload />}
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || reconnectMutation.isPending}
              sx={theming.getThemedButtonSx()}
            >
              {refreshMutation.isPending ? 'Forbereder…' : 'Forbered Drive-mapper'}
            </Button>
          </Stack>
        </Stack>

        {statusLoading && (
          <Box sx={{ py: 2 }}>
            <LinearProgress />
          </Box>
        )}

        {!statusLoading && !status?.connected && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
          >
            {showWorkspaceReconnectAction
              ? (status?.message || 'Google-økten er ikke aktiv for denne brukeren ennå.')
              : 'Prosjekt Synkronisering bruker samme Google-SSO som resten av arbeidsflaten. Følg Google-statusen i brukerfeltet for å aktivere prosjektmapper og synk.'}
          </Alert>
        )}

        {status?.connected && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip label="Google Drive koblet" color="success" variant="filled" />
            {status.accountEmail && <Chip label={status.accountEmail} variant="outlined" />}
            {status.syncEnabled === false && <Chip label="Sync er slått av" color="warning" variant="outlined" />}
            {primaryFolderName && <Chip label={`Aktiv mappe: ${primaryFolderName}`} variant="outlined" />}
          </Stack>
        )}

        {refreshMutation.isError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {refreshMutation.error instanceof Error
              ? refreshMutation.error.message
              : 'Kunne ikke forberede Google Drive-mapper.'}
          </Alert>
        )}

        {driveContextQuery.isError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {driveContextQuery.error instanceof Error
              ? driveContextQuery.error.message
              : 'Kunne ikke hente Google Drive-kontekst.'}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(25, 118, 210, 0.06)' }}>
            <Typography variant="caption" color="text.secondary">
              Valgt prosjekt
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {projectName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {customerName || companyName || 'Ingen kunde valgt'}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Synkstatus
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {folderReady ? 'Mappe klar' : 'Mangler mappe'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {status?.lastSync ? `Sist sjekket ${formatDateTime(status.lastSync)}` : 'Ingen synk registrert ennå'}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Mappegrunnlag
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {context?.folderStructure.source || 'Ikke klar'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {context?.folderStructure.folders?.length ?? 0} strukturelementer tilgjengelig
            </Typography>
          </Box>
        </Box>

        {status?.connected && (
          <>
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Mappe- og seksjonsstatus
                </Typography>
                {context?.projectFolder?.webViewLink && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FolderOpen />}
                    onClick={() => handleOpenFolder(context.projectFolder?.webViewLink)}
                  >
                    Åpne prosjektmappe
                  </Button>
                )}
              </Stack>

              <List dense>
                {sections.slice(0, 8).map((section) => (
                  <ListItem
                    key={section.id}
                    divider
                    secondaryAction={
                      section.folderId && section.folderName ? (
                        <Chip
                          label={section.scope || 'Drive'}
                          size="small"
                          color={section.recommended ? 'success' : 'default'}
                          variant={section.recommended ? 'filled' : 'outlined'}
                        />
                      ) : (
                        <Chip label="Ikke opprettet ennå" size="small" color="warning" variant="outlined" />
                      )
                    }
                  >
                    <ListItemIcon>
                      {section.folderId ? <CheckCircle color="success" /> : <Warning color="warning" />}
                    </ListItemIcon>
                    <ListItemText
                      primary={section.label}
                      secondary={section.folderName || section.description}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Nylige mapper
              </Typography>
              {driveContextQuery.isLoading ? (
                <CircularProgress size={20} />
              ) : recentFolders.length > 0 ? (
                <Stack spacing={1.25}>
                  {recentFolders.map((folder) => (
                    <Box
                      key={folder.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid rgba(0,0,0,0.08)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {folder.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Oppdatert {formatDateTime(folder.modifiedTime)}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={() => handleOpenFolder(folder.webViewLink)}>
                        Åpne
                      </Button>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">Ingen nylige Drive-mapper funnet ennå.</Alert>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
                Filer i aktiv mappe
              </Typography>
              {driveFilesQuery.isLoading ? (
                <CircularProgress size={20} />
              ) : files.length > 0 ? (
                <List dense>
                  {files.map((file) => (
                    <ListItem
                      key={file.id}
                      divider
                      secondaryAction={
                        <Stack direction="row" spacing={1}>
                          {file.webViewLink && (
                            <Button
                              size="small"
                              onClick={() => handleOpenFolder(file.webViewLink)}
                            >
                              Åpne
                            </Button>
                          )}
                        </Stack>
                      }
                    >
                      <ListItemIcon>
                        <Folder color={file.mimeType.includes('folder') ? 'primary' : 'inherit'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${formatFileSize(file.size)} • ${formatDateTime(file.modifiedTime)}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">
                  {primaryFolderId
                    ? 'Ingen filer funnet i den aktive mappen ennå.'
                    : 'Velg eller forbered en prosjektmappe for å se filer her.'}
                </Alert>
              )}
            </Box>
          </>
        )}

        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloudDone />}
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || !status?.connected}
          >
            Oppdater mappegrunnlag
          </Button>
          {context?.customerFolder?.webViewLink && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<FolderOpen />}
              onClick={() => handleOpenFolder(context.customerFolder?.webViewLink)}
            >
              Åpne kundemappe
            </Button>
          )}
          {status?.lastSync && (
            <Chip
              icon={<Schedule />}
              label={`Sist synk: ${formatDateTime(status.lastSync)}`}
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </MuiCard>
  );
};

export default GoogleDriveProjectSync;
