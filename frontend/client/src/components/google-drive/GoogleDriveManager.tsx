import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card as MuiCard,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
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
  Link as LinkIcon,
  Refresh,
  Search,
  Share,
  Storage,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import { lightroomIntegrationService } from '@/services/lightroomIntegrationService';
import { useEnhancedMasterIntegration } from '@/integration/EnhancedMasterIntegrationProvider';
import { useTheming } from '../../utils/theming-helper';

type SupportedProfession =
  | 'photographer'
  | 'videographer'
  | 'music_producer'
  | 'vendor'
  | 'enterprise';

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
  status?: string | null;
};

type ProjectRecord = ProjectLike & {
  id: string;
  title?: string | null;
};

interface GoogleDriveManagerProps {
  userId: string;
  profession: SupportedProfession;
  showWorkspaceReconnectAction?: boolean;
  onFileUpload?: (file: unknown) => void;
  onFileDownload?: (file: unknown) => void;
  onProjectUpdate?: (project: Record<string, unknown>) => void;
  selectedProject?: ProjectLike | null;
  projects?: ProjectLike[];
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

interface DriveFolderSummary {
  id: string;
  name: string;
  webViewLink: string | null;
  modifiedTime: string | null;
}

interface DriveContextResponse {
  customerFolder?: DriveFolderSummary | null;
  projectFolder?: DriveFolderSummary | null;
  sections: DriveSection[];
  recentFolders: DriveFolderSummary[];
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

interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
}

interface DriveFilesResponse {
  files: DriveFileRecord[];
}

interface ContextualUploadResponse {
  success: boolean;
  destinationFolder?: {
    id: string;
    name: string;
    webViewLink: string | null;
    scope: string | null;
  } | null;
  uploaded: DriveFileRecord[];
}

const readNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return 'Ikke tilgjengelig';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Ikke tilgjengelig';
  }
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
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const buildProjectLabel = (project: ProjectLike | null | undefined): string => {
  return (
    readNonEmptyString(project?.title)
    || readNonEmptyString(project?.projectName)
    || readNonEmptyString(project?.name)
    || 'Velg prosjekt'
  );
};

const buildCustomerLabel = (project: ProjectLike | null | undefined): string => {
  return (
    readNonEmptyString(project?.clientName)
    || readNonEmptyString(project?.customerName)
    || readNonEmptyString(project?.companyName)
    || readNonEmptyString(project?.company)
    || 'Ingen kunde valgt'
  );
};

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  userId,
  profession,
  showWorkspaceReconnectAction = true,
  onFileUpload,
  onFileDownload,
  onProjectUpdate,
  selectedProject,
  projects: providedProjects,
  onProjectSelect,
}) => {
  const queryClient = useQueryClient();
  const theming = useTheming(profession);
  const { communication, componentRegistry, dataFlow } = useEnhancedMasterIntegration();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    readNonEmptyString(selectedProject?.id) || '',
  );
  const [selectedSectionId, setSelectedSectionId] = React.useState<string>('all-drive');
  const [searchTerm, setSearchTerm] = React.useState('');

  const normalizedSelectedProjectId = readNonEmptyString(selectedProject?.id);

  React.useEffect(() => {
    if (normalizedSelectedProjectId && normalizedSelectedProjectId !== selectedProjectId) {
      setSelectedProjectId(normalizedSelectedProjectId);
    }
  }, [normalizedSelectedProjectId, selectedProjectId]);

  const projectsQuery = useQuery<ProjectRecord[]>({
    queryKey: ['dashboard-projects', profession, userId],
    queryFn: async () => {
      const response = await apiRequest(`/api/projects?profession=${encodeURIComponent(profession)}&userId=${encodeURIComponent(userId)}`);
      return Array.isArray(response) ? response as ProjectRecord[] : [];
    },
    enabled: Boolean(userId) && userId !== 'guest',
  });

  const projects = React.useMemo<ProjectRecord[]>(
    () => {
      const normalizedProvidedProjects = Array.isArray(providedProjects)
        ? providedProjects
          .filter((project): project is ProjectRecord => typeof project?.id === 'string' && project.id.trim().length > 0)
          .map((project) => ({
            ...project,
            id: project.id.trim(),
          }))
        : [];

      if (normalizedProvidedProjects.length > 0) {
        return normalizedProvidedProjects;
      }

      return Array.isArray(projectsQuery.data) ? projectsQuery.data : [];
    },
    [providedProjects, projectsQuery.data],
  );

  const activeProject = React.useMemo(() => {
    if (normalizedSelectedProjectId) {
      return selectedProject ?? projects.find((project) => project.id === normalizedSelectedProjectId) ?? null;
    }
    if (selectedProjectId) {
      return projects.find((project) => project.id === selectedProjectId) ?? null;
    }
    return selectedProject ?? null;
  }, [normalizedSelectedProjectId, projects, selectedProject, selectedProjectId]);

  const activeProjectId = readNonEmptyString(activeProject?.id) || null;
  const resolvedProjectName =
    readNonEmptyString(activeProject?.title)
    || readNonEmptyString(activeProject?.projectName)
    || readNonEmptyString(activeProject?.name)
    || null;
  const projectName = resolvedProjectName || 'Velg prosjekt';
  const customerName =
    readNonEmptyString(activeProject?.clientName)
    || readNonEmptyString(activeProject?.customerName)
    || null;
  const companyName =
    readNonEmptyString(activeProject?.companyName)
    || readNonEmptyString(activeProject?.company)
    || null;
  const customerId =
    readNonEmptyString(activeProject?.customerId)
    || readNonEmptyString(activeProject?.clientId)
    || null;

  const driveStatusQuery = useQuery<GoogleDriveStatusResponse>({
    queryKey: ['file-management-google-drive-status', userId],
    queryFn: async () => apiRequest(`/api/file-management/google-drive/status?userId=${encodeURIComponent(userId)}`),
  });

  const driveContextQuery = useQuery<DriveContextResponse>({
    queryKey: [
      'google-drive-context',
      userId,
      profession,
      activeProjectId,
      customerId,
      customerName,
      companyName,
      resolvedProjectName,
    ],
    queryFn: async () => {
      const search = new URLSearchParams({
        userId,
        profession,
      });
      if (activeProjectId) search.set('projectId', activeProjectId);
      if (resolvedProjectName) search.set('projectName', resolvedProjectName);
      if (customerId) search.set('customerId', customerId);
      if (customerName) search.set('customerName', customerName);
      if (companyName) search.set('companyName', companyName);
      return apiRequest(`/api/google/drive/context?${search.toString()}`);
    },
    enabled: driveStatusQuery.data?.connected === true,
  });

  const sections = driveContextQuery.data?.sections ?? [];

  React.useEffect(() => {
    if (sections.length === 0) {
      setSelectedSectionId('all-drive');
      return;
    }

    const hasSelected = sections.some((section) => section.id === selectedSectionId);
    if (!hasSelected) {
      const recommended =
        sections.find((section) => section.recommended && section.folderId)
        || sections.find((section) => section.folderId)
        || sections[0];
      setSelectedSectionId(recommended?.id || 'all-drive');
    }
  }, [sections, selectedSectionId]);

  const selectedSection = React.useMemo(
    () => sections.find((section) => section.id === selectedSectionId) ?? null,
    [sections, selectedSectionId],
  );

  const primaryFolderId = selectedSection?.folderId || driveContextQuery.data?.folderStructure.primaryFolderId || null;
  const primaryFolderName = selectedSection?.folderName || driveContextQuery.data?.folderStructure.primaryFolderName || null;

  const driveFilesQuery = useQuery<DriveFilesResponse>({
    queryKey: ['google-drive-files', userId, primaryFolderId, searchTerm],
    queryFn: async () => {
      const search = new URLSearchParams({
        userId,
        pageSize: '18',
      });
      if (primaryFolderId) {
        search.set('folderId', primaryFolderId);
      }
      const normalizedSearch = searchTerm.trim();
      if (normalizedSearch) {
        search.set('search', normalizedSearch);
      }
      return apiRequest(`/api/google/drive/files?${search.toString()}`);
    },
    enabled: driveStatusQuery.data?.connected === true,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/google/drive/context', {
        method: 'POST',
        body: {
          userId,
          profession,
          projectId: activeProjectId,
          projectName: resolvedProjectName,
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
        && activeProjectId
      ) {
        const data = payload as DriveContextResponse;
        onProjectUpdate({
          id: activeProjectId,
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

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      formData.append('userId', userId);
      formData.append('profession', profession);
      if (activeProjectId) {
        formData.append('projectId', activeProjectId);
      }
      if (resolvedProjectName) {
        formData.append('projectName', resolvedProjectName);
      }
      if (customerId) {
        formData.append('customerId', customerId);
      }
      if (customerName) {
        formData.append('customerName', customerName);
      }
      if (companyName) {
        formData.append('companyName', companyName);
      }
      if (selectedSection?.id) {
        formData.append('sectionId', selectedSection.id);
      }
      if (selectedSection?.label) {
        formData.append('sectionLabel', selectedSection.label);
      }
      if (selectedSection?.folderId) {
        formData.append('targetFolderId', selectedSection.folderId);
      }
      if (selectedSection?.folderName) {
        formData.append('targetFolderName', selectedSection.folderName);
      }
      if (selectedSection?.scope) {
        formData.append('targetScope', selectedSection.scope);
      }
      return apiRequest('/api/google/drive/upload-contextual', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (payload: unknown) => {
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-context', userId] });

      const response = payload as ContextualUploadResponse;
      if (Array.isArray(response?.uploaded)) {
        response.uploaded.forEach((file) => onFileUpload?.(file));
      }
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return apiRequest(`/api/google/drive/files/${encodeURIComponent(fileId)}/share`, {
        method: 'POST',
        body: {
          userId,
          shareMode: 'link',
          ensureAccessible: true,
        },
      });
    },
  });

  React.useEffect(() => {
    componentRegistry.registerComponent({
      id: 'GoogleDriveManager',
      name: 'Google Drive Manager',
      type: 'widget',
      category: 'integrations',
      profession,
      version: '2.0.0',
      capabilities: ['google-drive', 'file-management', 'project-sync', 'file-upload'],
      dependencies: [],
      events: ['google-drive:init-oauth', 'google-drive:create-folder', 'google-drive:save-file'],
      dataKeys: ['drive-status', 'drive-context', 'drive-files'],
      props: ['userId', 'profession', 'selectedProject'],
    });

    const driveStatusNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleDriveManager',
      dataKey: 'drive-status',
    });
    const driveContextNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleDriveManager',
      dataKey: 'drive-context',
    });
    const driveFilesNodeId = dataFlow.registerNode({
      type: 'source',
      componentId: 'GoogleDriveManager',
      dataKey: 'drive-files',
    });

    void dataFlow.syncData('drive-status', driveStatusQuery.data ?? null);
    void dataFlow.syncData('drive-context', driveContextQuery.data ?? null);
    void dataFlow.syncData('drive-files', driveFilesQuery.data?.files ?? []);

    const unsubscribe = communication.onMessage((message: Record<string, unknown>) => {
      if (message.type === 'google-drive:init-oauth') {
        reconnectMutation.mutate();
      }

      if (message.type === 'google-drive:create-folder') {
        refreshMutation.mutate();
      }

      if (message.type === 'google-drive:save-file' && message.data && typeof message.data === 'object') {
        const payload = message.data as Record<string, unknown>;
        const rawBlob = payload.fileBlob;
        const fileName = readNonEmptyString(payload.fileName) || `creatorhub-${Date.now()}.bin`;
        if (rawBlob instanceof Blob) {
          const file = rawBlob instanceof File
            ? rawBlob
            : new File([rawBlob], fileName, { type: rawBlob.type || 'application/octet-stream' });
          uploadMutation.mutate([file]);
        }
      }
    });

    return () => {
      componentRegistry.unregisterComponent('GoogleDriveManager');
      dataFlow.unregisterNode(driveStatusNodeId);
      dataFlow.unregisterNode(driveContextNodeId);
      dataFlow.unregisterNode(driveFilesNodeId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [
    communication,
    componentRegistry,
    dataFlow,
    driveContextQuery.data,
    driveFilesQuery.data?.files,
    driveStatusQuery.data,
    profession,
    reconnectMutation,
    refreshMutation,
    uploadMutation,
  ]);

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((entry) => entry.id === projectId);
    if (project && onProjectSelect) {
      onProjectSelect(project);
    }
  };

  const handleOpenLink = (url: string | null | undefined) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleUploadSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
    event.target.value = '';
  };

  const files = Array.isArray(driveFilesQuery.data?.files) ? driveFilesQuery.data.files : [];
  const recentFolders = driveContextQuery.data?.recentFolders ?? [];
  const workspaceConnected = driveStatusQuery.data?.connected === true;
  const sectionCount = sections.length;

  return (
    <MuiCard elevation={0} sx={{ borderRadius: 3, border: '1px solid rgba(15, 23, 42, 0.08)' }}>
      <CardContent sx={theming.getThemedCardSx()}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
          sx={{ mb: 2.5 }}
        >
          <Box>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
              <Storage color="primary" />
              Creatorhub Filsystem
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Arbeid direkte i Creatorhub Filsystem med valgt prosjektkontekst, filvisning, deling og mappeoppdatering.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Tooltip title="Oppdater status og mapper">
              <span>
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
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudDone />}
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || !workspaceConnected}
            >
              {refreshMutation.isPending ? 'Oppdaterer…' : 'Oppdater Drive-kontekst'}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<CloudUpload />}
              onClick={() => fileInputRef.current?.click()}
              disabled={!workspaceConnected || uploadMutation.isPending}
              sx={theming.getThemedButtonSx()}
            >
              {uploadMutation.isPending ? 'Laster opp…' : 'Last opp til Drive'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              onChange={handleUploadSelection}
            />
          </Stack>
        </Stack>

        {driveStatusQuery.isLoading && (
          <Box sx={{ py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!driveStatusQuery.isLoading && !workspaceConnected && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              showWorkspaceReconnectAction ? (
                <Button
                  size="small"
                  startIcon={<GoogleIcon />}
                  onClick={() => reconnectMutation.mutate()}
                  disabled={reconnectMutation.isPending}
                >
                  {reconnectMutation.isPending ? 'Starter…' : 'Koble Google Workspace'}
                </Button>
              ) : undefined
            }
          >
            {showWorkspaceReconnectAction
              ? (driveStatusQuery.data?.message || 'Google Drive er ikke koblet til denne brukeren ennå.')
              : 'Creatorhub Filsystem bruker samme Google Workspace-kobling som øverst i denne fanen. Koble Workspace én gang der for å aktivere filhåndtering, opplasting og deling.'}
          </Alert>
        )}

        {workspaceConnected && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip label="Tilkoblet Google Drive" color="success" />
            {driveStatusQuery.data?.accountEmail && (
              <Chip label={driveStatusQuery.data.accountEmail} variant="outlined" />
            )}
            {driveStatusQuery.data?.lastSync && (
              <Chip label={`Sist synk: ${formatDateTime(driveStatusQuery.data.lastSync)}`} variant="outlined" />
            )}
            <Chip label={`${sectionCount} tilgjengelige seksjoner`} variant="outlined" />
          </Stack>
        )}

        {(refreshMutation.isError || uploadMutation.isError || shareMutation.isError || driveContextQuery.isError) && (
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {refreshMutation.isError && (
              <Alert severity="error">
                {refreshMutation.error instanceof Error
                  ? refreshMutation.error.message
                  : 'Kunne ikke oppdatere Drive-kontekst.'}
              </Alert>
            )}
            {uploadMutation.isError && (
              <Alert severity="error">
                {uploadMutation.error instanceof Error
                  ? uploadMutation.error.message
                  : 'Kunne ikke laste opp filene til Google Drive.'}
              </Alert>
            )}
            {shareMutation.isError && (
              <Alert severity="error">
                {shareMutation.error instanceof Error
                  ? shareMutation.error.message
                  : 'Kunne ikke dele Drive-filen.'}
              </Alert>
            )}
            {driveContextQuery.isError && (
              <Alert severity="warning">
                {driveContextQuery.error instanceof Error
                  ? driveContextQuery.error.message
                  : 'Kunne ikke hente Drive-kontekst.'}
              </Alert>
            )}
          </Stack>
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
              Aktivt prosjekt
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {projectName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {buildCustomerLabel(activeProject)}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Mappegrunnlag
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {primaryFolderName || 'Ikke valgt'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {driveContextQuery.data?.folderStructure.source || 'Ingen Drive-kontekst ennå'}
            </Typography>
          </Box>
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.08)' }}>
            <Typography variant="caption" color="text.secondary">
              Filer i visning
            </Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {files.length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {searchTerm.trim() ? `Filtrert på "${searchTerm.trim()}"` : 'Nyeste elementer fra aktiv mappe'}
            </Typography>
          </Box>
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            select
            fullWidth
            label="Prosjekt"
            value={activeProjectId || ''}
            onChange={(event) => handleProjectChange(event.target.value)}
            helperText="Velg prosjekt for å knytte riktig kundemappe og undermapper."
          >
            <MenuItem value="">Ingen prosjektkontekst</MenuItem>
            {projects.map((project) => (
              <MenuItem key={project.id} value={project.id}>
                {buildProjectLabel(project)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Søk i aktiv visning"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
            helperText="Søk i filer i aktiv mappe eller hele Drive når ingen mappe er valgt."
          />
        </Stack>

        {workspaceConnected && (
          <>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Drive-seksjoner
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 3 }}>
              {sections.map((section) => (
                <Chip
                  key={section.id}
                  label={section.label}
                  color={section.id === selectedSectionId ? 'primary' : section.recommended ? 'success' : 'default'}
                  variant={section.id === selectedSectionId ? 'filled' : 'outlined'}
                  onClick={() => setSelectedSectionId(section.id)}
                />
              ))}
            </Stack>
          </>
        )}

        {selectedSection && (
          <Box
            sx={{
              mb: 3,
              p: 2,
              borderRadius: 2,
              border: '1px solid rgba(15, 23, 42, 0.08)',
              bgcolor: 'rgba(248, 250, 252, 0.9)',
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedSection.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedSection.folderName || selectedSection.description}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedSection.folderId && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<FolderOpen />}
                    onClick={() => {
                      const recentMatch = recentFolders.find((folder) => folder.id === selectedSection.folderId);
                      handleOpenLink(recentMatch?.webViewLink || driveContextQuery.data?.projectFolder?.webViewLink || null);
                    }}
                  >
                    Åpne mappe
                  </Button>
                )}
                {driveContextQuery.data?.customerFolder?.webViewLink && (
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<LinkIcon />}
                    onClick={() => handleOpenLink(driveContextQuery.data?.customerFolder?.webViewLink)}
                  >
                    Kundemappe
                  </Button>
                )}
              </Stack>
            </Stack>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.7fr) minmax(320px, 0.9fr)' },
            gap: 2.5,
          }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Filer i aktiv visning
            </Typography>

            {driveFilesQuery.isLoading ? (
              <CircularProgress size={24} />
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
                            onClick={() => {
                              onFileDownload?.(file);
                              handleOpenLink(file.webViewLink);
                            }}
                          >
                            Åpne
                          </Button>
                        )}
                        <Tooltip title="Lag delbar lenke">
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => shareMutation.mutate(file.id)}
                              disabled={shareMutation.isPending}
                            >
                              <Share fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Stack>
                    }
                  >
                    <ListItemIcon>
                      {file.mimeType.includes('folder')
                        ? <Folder color="primary" />
                        : <CheckCircle color="success" />}
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
                  ? 'Ingen filer funnet i aktiv mappe ennå.'
                  : 'Koble prosjekt eller oppdater Drive-konteksten for å se filer her.'}
              </Alert>
            )}
          </Box>

          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Nylige mapper
            </Typography>

            {driveContextQuery.isLoading ? (
              <CircularProgress size={24} />
            ) : recentFolders.length > 0 ? (
              <Stack spacing={1.25}>
                {recentFolders.map((folder) => (
                  <Box
                    key={folder.id}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid rgba(15, 23, 42, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {folder.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Oppdatert {formatDateTime(folder.modifiedTime)}
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => handleOpenLink(folder.webViewLink)}>
                      Åpne
                    </Button>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">Ingen nylige Drive-mapper funnet ennå.</Alert>
            )}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Tilgjengelig nå
            </Typography>
            <Stack spacing={1.25}>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(25, 118, 210, 0.06)' }}>
                <Typography variant="caption" color="text.secondary">
                  Prosjektmappe
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {driveContextQuery.data?.projectFolder?.name || 'Ikke funnet ennå'}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                <Typography variant="caption" color="text.secondary">
                  Kundemappe
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {driveContextQuery.data?.customerFolder?.name || 'Ikke knyttet ennå'}
                </Typography>
              </Box>
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(255, 152, 0, 0.08)' }}>
                <Typography variant="caption" color="text.secondary">
                  Uploadmål
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {selectedSection?.folderName || primaryFolderName || 'Velg seksjon eller oppdater konteksten'}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </MuiCard>
  );
};

export default GoogleDriveManager;
