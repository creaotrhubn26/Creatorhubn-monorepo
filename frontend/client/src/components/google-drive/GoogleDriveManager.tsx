// @ts-nocheck
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
  Drawer,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  CloudDone,
  CloudUpload,
  DeleteOutline,
  DownloadOutlined,
  EditOutlined,
  Folder,
  FolderOpen,
  Google as GoogleIcon,
  InfoOutlined,
  LaunchOutlined as LaunchOutlinedIcon,
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
  isFolder?: boolean;
  size: number | null;
  createdTime?: string | null;
  modifiedTime: string | null;
  description?: string | null;
  iconLink?: string | null;
  thumbnailLink?: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  version?: number | null;
  fileExtension?: string | null;
  parents?: string[];
  shared?: boolean;
  trashed?: boolean;
  owner?: {
    displayName: string;
    emailAddress?: string | null;
    photoLink?: string | null;
  } | null;
  owners?: Array<{
    displayName: string;
    emailAddress?: string | null;
    photoLink?: string | null;
  }>;
  permissions?: Array<{
    id: string;
    type: string;
    emailAddress?: string | null;
    domain?: string | null;
    role: string;
    allowFileDiscovery?: boolean;
    deleted?: boolean;
    pendingOwner?: boolean;
    label?: string;
  }>;
  capabilities?: {
    canEdit: boolean;
    canDownload: boolean;
    canDelete: boolean;
    canRename: boolean;
    canShare: boolean;
  };
  exportFormat?: {
    mimeType: string;
    extension: string;
  } | null;
}

interface DriveFilesResponse {
  files: DriveFileRecord[];
}

interface DriveFileDetailsResponse {
  file: DriveFileRecord;
}

interface DriveFileActivityRecord {
  id: string;
  action: string;
  actors: string[];
  targets: string[];
  timestamp: string | null;
}

interface DriveFileActivityResponse {
  activities: DriveFileActivityRecord[];
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

const buildApiHref = (path: string): string => {
  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  return isDevelopment || !apiBaseUrl ? path : `${apiBaseUrl}${path}`;
};

const formatMimeTypeLabel = (mimeType: string): string => {
  if (mimeType === 'application/vnd.google-apps.folder') {
    return 'Mappe';
  }
  if (mimeType.startsWith('image/')) {
    return 'Bilde';
  }
  if (mimeType.startsWith('video/')) {
    return 'Video';
  }
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }
  if (mimeType.includes('document')) {
    return 'Dokument';
  }
  if (mimeType.includes('spreadsheet')) {
    return 'Regneark';
  }
  return 'Fil';
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
  const [selectedFileId, setSelectedFileId] = React.useState<string | null>(null);
  const [shareMode, setShareMode] = React.useState<'link' | 'recipient' | 'domain'>('link');
  const [shareRole, setShareRole] = React.useState<'reader' | 'commenter' | 'writer'>('reader');
  const [shareTarget, setShareTarget] = React.useState('');
  const [fileNameDraft, setFileNameDraft] = React.useState('');
  const [fileDescriptionDraft, setFileDescriptionDraft] = React.useState('');

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

  const selectedFileDetailsQuery = useQuery<DriveFileDetailsResponse>({
    queryKey: ['google-drive-file-details', userId, selectedFileId],
    queryFn: async () => apiRequest(`/api/google/drive/files/${encodeURIComponent(selectedFileId || '')}/details?userId=${encodeURIComponent(userId)}`),
    enabled: driveStatusQuery.data?.connected === true && Boolean(selectedFileId),
  });

  const selectedFileActivityQuery = useQuery<DriveFileActivityResponse>({
    queryKey: ['google-drive-file-activity', userId, selectedFileId],
    queryFn: async () => apiRequest(`/api/google/drive/files/${encodeURIComponent(selectedFileId || '')}/activity?userId=${encodeURIComponent(userId)}&pageSize=16`),
    enabled: driveStatusQuery.data?.connected === true && Boolean(selectedFileId),
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
    mutationFn: async (payload: {
      fileId: string;
      shareMode: 'link' | 'recipient' | 'domain';
      role: 'reader' | 'commenter' | 'writer';
      recipientEmail?: string;
      domain?: string;
    }) => {
      return apiRequest(`/api/google/drive/files/${encodeURIComponent(payload.fileId)}/share`, {
        method: 'POST',
        body: {
          userId,
          shareMode: payload.shareMode,
          role: payload.role,
          ensureAccessible: true,
          recipientEmail: payload.recipientEmail,
          domain: payload.domain,
        },
      });
    },
    onSuccess: (_payload, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-file-details', userId, variables.fileId] });
    },
  });

  const updateFileMutation = useMutation({
    mutationFn: async (payload: { fileId: string; name?: string; description?: string }) => (
      apiRequest(`/api/google/drive/files/${encodeURIComponent(payload.fileId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: payload,
      })
    ),
    onSuccess: (_payload, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-file-details', userId, variables.fileId] });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => (
      apiRequest(`/api/google/drive/files/${encodeURIComponent(fileId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
    ),
    onSuccess: (_payload, fileId) => {
      if (selectedFileId === fileId) {
        setSelectedFileId(null);
      }
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-file-details', userId, fileId] });
    },
  });

  const revokePermissionMutation = useMutation({
    mutationFn: async (payload: { fileId: string; permissionId: string }) => (
      apiRequest(`/api/google/drive/files/${encodeURIComponent(payload.fileId)}/permissions/${encodeURIComponent(payload.permissionId)}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
    ),
    onSuccess: (_payload, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['google-drive-files', userId] });
      void queryClient.invalidateQueries({ queryKey: ['google-drive-file-details', userId, variables.fileId] });
    },
  });

  React.useEffect(() => {
    const selectedFile = selectedFileDetailsQuery.data?.file;
    if (!selectedFile) {
      return;
    }
    setFileNameDraft(selectedFile.name);
    setFileDescriptionDraft(selectedFile.description || '');
  }, [selectedFileDetailsQuery.data?.file]);

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

  const handleDownloadFile = (file: DriveFileRecord) => {
    onFileDownload?.(file);
    const href = buildApiHref(
      `/api/google/drive/files/${encodeURIComponent(file.id)}/download?userId=${encodeURIComponent(userId)}`,
    );
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const handleOpenFileDetails = (fileId: string) => {
    setSelectedFileId(fileId);
  };

  const handleUploadSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) {
      uploadMutation.mutate(files);
    }
    event.target.value = '';
  };

  const handleSubmitShare = () => {
    if (!selectedFileId) {
      return;
    }
    if ((shareMode === 'recipient' || shareMode === 'domain') && !shareTarget.trim()) {
      return;
    }
    shareMutation.mutate({
      fileId: selectedFileId,
      shareMode,
      role: shareRole,
      recipientEmail: shareMode === 'recipient' ? shareTarget.trim() : undefined,
      domain: shareMode === 'domain' ? shareTarget.trim() : undefined,
    });
  };

  const handleSaveFileMetadata = () => {
    if (!selectedFileId || !fileNameDraft.trim()) {
      return;
    }
    updateFileMutation.mutate({
      fileId: selectedFileId,
      name: fileNameDraft.trim(),
      description: fileDescriptionDraft.trim(),
    });
  };

  const handleDeleteFile = (fileId: string) => {
    if (!window.confirm('Vil du flytte denne filen til papirkurven i Google Drive?')) {
      return;
    }
    deleteFileMutation.mutate(fileId);
  };

  const files = Array.isArray(driveFilesQuery.data?.files) ? driveFilesQuery.data.files : [];
  const recentFolders = driveContextQuery.data?.recentFolders ?? [];
  const workspaceConnected = driveStatusQuery.data?.connected === true;
  const sectionCount = sections.length;
  const selectedFile = selectedFileDetailsQuery.data?.file ?? null;
  const selectedFilePermissions = selectedFile?.permissions ?? [];
  const fileActivities = selectedFileActivityQuery.data?.activities ?? [];

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
          >
            {showWorkspaceReconnectAction
              ? (driveStatusQuery.data?.message || 'Google-økten er ikke aktiv for denne brukeren ennå.')
              : 'CreatorHub Filsystem bruker samme Google-SSO som resten av arbeidsflaten. Forny økten i brukerfeltet for å aktivere filhåndtering, opplasting og deling.'}
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

        {(refreshMutation.isError
          || uploadMutation.isError
          || shareMutation.isError
          || updateFileMutation.isError
          || deleteFileMutation.isError
          || revokePermissionMutation.isError
          || driveContextQuery.isError
          || selectedFileDetailsQuery.isError
          || selectedFileActivityQuery.isError) && (
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
            {updateFileMutation.isError && (
              <Alert severity="error">
                {updateFileMutation.error instanceof Error
                  ? updateFileMutation.error.message
                  : 'Kunne ikke oppdatere filmetadata.'}
              </Alert>
            )}
            {deleteFileMutation.isError && (
              <Alert severity="error">
                {deleteFileMutation.error instanceof Error
                  ? deleteFileMutation.error.message
                  : 'Kunne ikke slette filen.'}
              </Alert>
            )}
            {revokePermissionMutation.isError && (
              <Alert severity="error">
                {revokePermissionMutation.error instanceof Error
                  ? revokePermissionMutation.error.message
                  : 'Kunne ikke fjerne delingen.'}
              </Alert>
            )}
            {driveContextQuery.isError && (
              <Alert severity="warning">
                {driveContextQuery.error instanceof Error
                  ? driveContextQuery.error.message
                  : 'Kunne ikke hente Drive-kontekst.'}
              </Alert>
            )}
            {selectedFileDetailsQuery.isError && (
              <Alert severity="warning">
                {selectedFileDetailsQuery.error instanceof Error
                  ? selectedFileDetailsQuery.error.message
                  : 'Kunne ikke hente filmetadata.'}
              </Alert>
            )}
            {selectedFileActivityQuery.isError && (
              <Alert severity="warning">
                {selectedFileActivityQuery.error instanceof Error
                  ? selectedFileActivityQuery.error.message
                  : 'Kunne ikke hente filaktivitet.'}
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
              <TableContainer
                sx={{
                  borderRadius: 2,
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  bgcolor: 'rgba(255,255,255,0.9)',
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fil</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Eier</TableCell>
                      <TableCell>Størrelse</TableCell>
                      <TableCell>Oppdatert</TableCell>
                      <TableCell>Tilgang</TableCell>
                      <TableCell align="right">Handlinger</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {files.map((file) => (
                      <TableRow
                        key={file.id}
                        hover
                        selected={selectedFileId === file.id}
                        sx={{ cursor: 'pointer' }}
                        onClick={() => handleOpenFileDetails(file.id)}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            {file.isFolder
                              ? <Folder color="primary" fontSize="small" />
                              : <CheckCircle color="success" fontSize="small" />}
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {file.name}
                              </Typography>
                              {file.description ? (
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {file.description}
                                </Typography>
                              ) : null}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{formatMimeTypeLabel(file.mimeType)}</TableCell>
                        <TableCell>{file.owner?.displayName || 'Ukjent'}</TableCell>
                        <TableCell>{file.isFolder ? 'Mappe' : formatFileSize(file.size)}</TableCell>
                        <TableCell>{formatDateTime(file.modifiedTime)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={file.shared ? `${file.permissions?.length || 0} delinger` : 'Privat'}
                            color={file.shared ? 'success' : 'default'}
                            variant={file.shared ? 'filled' : 'outlined'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            {file.webViewLink ? (
                              <Tooltip title="Åpne i Drive">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenLink(file.webViewLink);
                                    }}
                                  >
                                    <LaunchOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                            <Tooltip title="Last ned">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDownloadFile(file);
                                  }}
                                  disabled={file.capabilities?.canDownload === false}
                                >
                                  <DownloadOutlined fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Lag delbar lenke">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    shareMutation.mutate({
                                      fileId: file.id,
                                      shareMode: 'link',
                                      role: 'reader',
                                    });
                                  }}
                                  disabled={shareMutation.isPending || file.capabilities?.canShare === false}
                                >
                                  <Share fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Detaljer">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenFileDetails(file.id);
                                  }}
                                >
                                  <InfoOutlined fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Flytt til papirkurv">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteFile(file.id);
                                  }}
                                  disabled={deleteFileMutation.isPending || file.capabilities?.canDelete === false}
                                >
                                  <DeleteOutline fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
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

        <Drawer
          anchor="right"
          open={Boolean(selectedFileId)}
          onClose={() => setSelectedFileId(null)}
          PaperProps={{
            sx: {
              width: { xs: '100%', sm: 440 },
              p: 2,
            },
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="overline" color="text.secondary">
                  Filinnsikt
                </Typography>
                <Typography variant="h6" fontWeight={800} noWrap>
                  {selectedFile?.name || 'Velg en fil'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedFile ? formatMimeTypeLabel(selectedFile.mimeType) : 'Metadata, deling og aktivitet'}
                </Typography>
              </Box>
              <Button size="small" onClick={() => setSelectedFileId(null)}>
                Lukk
              </Button>
            </Stack>

            {selectedFileDetailsQuery.isLoading ? (
              <CircularProgress size={24} />
            ) : selectedFile ? (
              <>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip label={selectedFile.owner?.displayName || 'Ukjent eier'} variant="outlined" />
                  <Chip label={selectedFile.shared ? 'Delt' : 'Privat'} color={selectedFile.shared ? 'success' : 'default'} />
                  <Chip label={selectedFile.isFolder ? 'Mappe' : formatFileSize(selectedFile.size)} variant="outlined" />
                </Stack>

                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(15, 23, 42, 0.04)' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Metadata og oppdatering
                  </Typography>
                  <Stack spacing={1.25}>
                    <TextField
                      label="Filnavn"
                      value={fileNameDraft}
                      onChange={(event) => setFileNameDraft(event.target.value)}
                      size="small"
                    />
                    <TextField
                      label="Beskrivelse"
                      value={fileDescriptionDraft}
                      onChange={(event) => setFileDescriptionDraft(event.target.value)}
                      size="small"
                      multiline
                      minRows={2}
                    />
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<EditOutlined />}
                        onClick={handleSaveFileMetadata}
                        disabled={updateFileMutation.isPending || !fileNameDraft.trim()}
                        sx={theming.getThemedButtonSx()}
                      >
                        {updateFileMutation.isPending ? 'Lagrer…' : 'Oppdater fil'}
                      </Button>
                      {selectedFile.webViewLink ? (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<LaunchOutlinedIcon />}
                          onClick={() => handleOpenLink(selectedFile.webViewLink)}
                        >
                          Åpne i Drive
                        </Button>
                      ) : null}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      Sist endret {formatDateTime(selectedFile.modifiedTime)} · opprettet {formatDateTime(selectedFile.createdTime)}
                    </Typography>
                  </Stack>
                </Box>

                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(25, 118, 210, 0.06)' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Deling og tillatelser
                  </Typography>
                  <Stack spacing={1.25}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        select
                        size="small"
                        label="Delingsmodus"
                        value={shareMode}
                        onChange={(event) => setShareMode(event.target.value as 'link' | 'recipient' | 'domain')}
                        sx={{ minWidth: 130 }}
                      >
                        <MenuItem value="link">Lenke</MenuItem>
                        <MenuItem value="recipient">E-post</MenuItem>
                        <MenuItem value="domain">Domene</MenuItem>
                      </TextField>
                      <TextField
                        select
                        size="small"
                        label="Rolle"
                        value={shareRole}
                        onChange={(event) => setShareRole(event.target.value as 'reader' | 'commenter' | 'writer')}
                        sx={{ minWidth: 140 }}
                      >
                        <MenuItem value="reader">Reader</MenuItem>
                        <MenuItem value="commenter">Commenter</MenuItem>
                        <MenuItem value="writer">Writer</MenuItem>
                      </TextField>
                    </Stack>
                    {shareMode !== 'link' ? (
                      <TextField
                        size="small"
                        label={shareMode === 'recipient' ? 'Mottaker e-post' : 'Domene'}
                        placeholder={shareMode === 'recipient' ? 'kunde@firma.no' : 'creatorhubn.com'}
                        value={shareTarget}
                        onChange={(event) => setShareTarget(event.target.value)}
                      />
                    ) : null}
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Share />}
                      onClick={handleSubmitShare}
                      disabled={shareMutation.isPending || (shareMode !== 'link' && !shareTarget.trim())}
                    >
                      {shareMutation.isPending ? 'Oppdaterer deling…' : 'Del filen'}
                    </Button>

                    <Stack spacing={1}>
                      {selectedFilePermissions.length > 0 ? selectedFilePermissions.map((permission) => (
                        <Box
                          key={permission.id}
                          sx={{
                            p: 1.25,
                            borderRadius: 1.5,
                            border: '1px solid rgba(15, 23, 42, 0.08)',
                            bgcolor: '#fff',
                          }}
                        >
                          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={700} noWrap>
                                {permission.label || permission.emailAddress || permission.domain || permission.type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {permission.role} · {permission.type}
                              </Typography>
                            </Box>
                            {permission.type !== 'owner' ? (
                              <Button
                                size="small"
                                color="inherit"
                                onClick={() => revokePermissionMutation.mutate({ fileId: selectedFile.id, permissionId: permission.id })}
                                disabled={revokePermissionMutation.isPending}
                              >
                                Fjern
                              </Button>
                            ) : null}
                          </Stack>
                        </Box>
                      )) : (
                        <Alert severity="info">Ingen ekstra delinger registrert ennå.</Alert>
                      )}
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(76, 175, 80, 0.08)' }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Aktivitet i Drive
                  </Typography>
                  {selectedFileActivityQuery.isLoading ? (
                    <CircularProgress size={20} />
                  ) : fileActivities.length > 0 ? (
                    <Stack spacing={1}>
                      {fileActivities.map((activity) => (
                        <Box
                          key={activity.id}
                          sx={{
                            p: 1.25,
                            borderRadius: 1.5,
                            border: '1px solid rgba(15, 23, 42, 0.08)',
                            bgcolor: '#fff',
                          }}
                        >
                          <Typography variant="body2" fontWeight={700}>
                            {activity.action}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(activity.actors.length > 0 ? activity.actors.join(', ') : 'Ukjent aktør')}
                            {' · '}
                            {formatDateTime(activity.timestamp)}
                          </Typography>
                          {activity.targets.length > 0 ? (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Gjelder: {activity.targets.join(', ')}
                            </Typography>
                          ) : null}
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">Ingen nylig Drive-aktivitet tilgjengelig for dette elementet.</Alert>
                  )}
                </Box>

                <Button
                  variant="text"
                  color="error"
                  startIcon={<DeleteOutline />}
                  onClick={() => handleDeleteFile(selectedFile.id)}
                  disabled={deleteFileMutation.isPending || selectedFile.capabilities?.canDelete === false}
                >
                  Flytt til papirkurv
                </Button>
              </>
            ) : (
              <Alert severity="info">Velg en fil fra listen for å se metadata, deling og aktivitet.</Alert>
            )}
          </Stack>
        </Drawer>
      </CardContent>
    </MuiCard>
  );
};

export default GoogleDriveManager;
