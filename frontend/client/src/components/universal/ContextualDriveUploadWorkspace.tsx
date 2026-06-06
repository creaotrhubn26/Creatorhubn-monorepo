// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  AudioFile,
  CheckCircle,
  CloudUpload,
  Description,
  Folder,
  FolderOpen,
  HomeOutlined,
  Image,
  InfoOutlined,
  InsertDriveFile,
  MoreVert,
  NotificationsNone,
  OpenInNew,
  Refresh,
  Search,
  VideoFile,
} from '@mui/icons-material';

type DriveContextSection = {
  id: string;
  label: string;
  description: string;
  category: string;
  recommended: boolean;
  folderId: string | null;
  folderName: string | null;
  scope: string | null;
};

type DriveFolderSummary = {
  id: string;
  name: string;
  webViewLink: string | null;
  modifiedTime?: string | null;
};

type DriveFileItem = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  thumbnailLink: string | null;
};

type DriveContextResponse = {
  customerFolder: DriveFolderSummary | null;
  projectFolder: DriveFolderSummary | null;
  sections: DriveContextSection[];
  recentFolders: DriveFolderSummary[];
  folderStructure: {
    source: string;
    folders: string[];
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
};

type DriveFilesResponse = {
  files: DriveFileItem[];
};

type UploadedDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
};

type UploadResponse = {
  destinationFolder: {
    id: string;
    name: string;
    webViewLink: string | null;
    scope: string | null;
  };
  uploaded: UploadedDriveFile[];
};

type DestinationOption = {
  id: string;
  label: string;
  description: string;
  folderId: string;
  folderName: string;
  scope: string | null;
  category: string;
  recommended: boolean;
  source: 'section' | 'recent';
};

interface ContextualDriveUploadWorkspaceProps {
  userId: string;
  profession: string;
  selectedProject?: any;
  selectedClient?: any;
  projects?: any[];
  onSelectProject?: (project: any | null) => void;
  onSelectClient?: (client: any | null) => void;
}

const formatBytes = (value: number | null | undefined) => {
  if (!value || value <= 0) {
    return 'Ukjent størrelse';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current >= 100 ? current.toFixed(0) : current.toFixed(1)} ${units[unitIndex]}`;
};

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return 'Nettopp';
  }

  try {
    return new Date(value).toLocaleString('no-NO', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
};

const buildDriveFolderUrl = (folderId: string | null | undefined) =>
  folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

const fileKindIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) {
    return <Image fontSize="small" />;
  }
  if (mimeType.startsWith('video/')) {
    return <VideoFile fontSize="small" />;
  }
  if (mimeType.startsWith('audio/')) {
    return <AudioFile fontSize="small" />;
  }
  if (
    mimeType.includes('pdf')
    || mimeType.includes('document')
    || mimeType.includes('spreadsheet')
    || mimeType.includes('presentation')
    || mimeType.startsWith('text/')
  ) {
    return <Description fontSize="small" />;
  }
  return <InsertDriveFile fontSize="small" />;
};

const errorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.replace(/^\d+:\s*/, '').trim();
  }
  return 'Noe gikk galt.';
};

const cardSurfaceSx = {
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.04) 100%)',
  boxShadow: '0 18px 40px rgba(15, 23, 42, 0.07)',
};

const mobileCategoryPalette = [
  {
    bg: 'linear-gradient(180deg, #ff6a4d 0%, #ff5638 100%)',
    accent: '#ffe1d9',
  },
  {
    bg: 'linear-gradient(180deg, #ffd97a 0%, #ffc75a 100%)',
    accent: '#7a4a00',
  },
  {
    bg: 'linear-gradient(180deg, #513248 0%, #2f1d2f 100%)',
    accent: '#f6dfff',
  },
  {
    bg: 'linear-gradient(180deg, #6477ff 0%, #4656d9 100%)',
    accent: '#eef1ff',
  },
] as const;

export default function ContextualDriveUploadWorkspace({
  userId,
  profession,
  selectedProject,
  selectedClient,
  projects = [],
  onSelectProject,
  onSelectClient,
}: ContextualDriveUploadWorkspaceProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mobileOverviewRef = useRef<HTMLDivElement | null>(null);
  const mobileFoldersRef = useRef<HTMLDivElement | null>(null);
  const mobileUploadRef = useRef<HTMLDivElement | null>(null);
  const mobileRecentRef = useRef<HTMLDivElement | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [lastUploadedFiles, setLastUploadedFiles] = useState<UploadedDriveFile[]>([]);
  const [mobileActiveSection, setMobileActiveSection] = useState<'overview' | 'folders' | 'upload' | 'recent'>('overview');

  const contextPayload = useMemo(
    () => ({
      profession,
      projectId: selectedProject?.id || null,
      projectName: selectedProject?.title || selectedProject?.name || selectedProject?.clientName || null,
      customerId: selectedClient?.id || selectedProject?.clientId || null,
      customerName: selectedClient?.name || selectedProject?.clientName || selectedProject?.customerName || null,
      companyName: selectedClient?.company || selectedProject?.company || null,
    }),
    [profession, selectedClient, selectedProject],
  );

  const driveContextQuery = useQuery<DriveContextResponse>({
    queryKey: ['contextual-drive-upload-context', userId, profession, contextPayload.projectId, contextPayload.customerId],
    queryFn: () =>
      apiRequest('/api/google/drive/context', {
        method: 'POST',
        body: contextPayload,
      }),
    retry: false,
    staleTime: 30_000,
  });

  const crmCustomersQuery = useQuery<{ customers?: any[] }>({
    queryKey: ['/api/universal-crm/customers', { profession, limit: 50 }],
    queryFn: () =>
      apiRequest(`/api/universal-crm/customers?profession=${encodeURIComponent(profession)}&limit=50`),
    enabled: Boolean(userId && userId !== 'guest'),
    staleTime: 30_000,
    retry: false,
  });

  const destinationOptions = useMemo<DestinationOption[]>(() => {
    const context = driveContextQuery.data;
    if (!context) {
      return [];
    }

    const seenFolderIds = new Set<string>();
    const options: DestinationOption[] = [];

    context.sections.forEach((section) => {
      if (!section.folderId || seenFolderIds.has(section.folderId)) {
        return;
      }
      seenFolderIds.add(section.folderId);
      options.push({
        id: section.id,
        label: section.label,
        description: section.description,
        folderId: section.folderId,
        folderName: section.folderName || section.label,
        scope: section.scope,
        category: section.category,
        recommended: section.recommended,
        source: 'section',
      });
    });

    context.recentFolders.forEach((folder, index) => {
      if (!folder.id || seenFolderIds.has(folder.id)) {
        return;
      }
      seenFolderIds.add(folder.id);
      options.push({
        id: `recent-${index}`,
        label: folder.name,
        description: 'Sist brukt mappe i Google Drive',
        folderId: folder.id,
        folderName: folder.name,
        scope: 'recent',
        category: 'recent',
        recommended: false,
        source: 'recent',
      });
    });

    return options.sort((left, right) => {
      if (left.recommended !== right.recommended) {
        return left.recommended ? -1 : 1;
      }
      if (left.source !== right.source) {
        return left.source === 'section' ? -1 : 1;
      }
      return left.label.localeCompare(right.label, 'no');
    });
  }, [driveContextQuery.data]);

  useEffect(() => {
    if (destinationOptions.length === 0) {
      setSelectedDestinationId('');
      return;
    }

    const stillExists = destinationOptions.some((option) => option.id === selectedDestinationId);
    if (stillExists) {
      return;
    }

    const defaultDestination =
      destinationOptions.find((option) => option.recommended)
      || destinationOptions.find((option) => option.scope === 'project')
      || destinationOptions.find((option) => option.scope === 'customer')
      || destinationOptions[0];
    setSelectedDestinationId(defaultDestination.id);
  }, [destinationOptions, selectedDestinationId]);

  const selectedDestination = destinationOptions.find((option) => option.id === selectedDestinationId) || null;
  const customerOptions = useMemo(
    () => (Array.isArray(crmCustomersQuery.data?.customers) ? crmCustomersQuery.data?.customers : []),
    [crmCustomersQuery.data],
  );
  const selectedCustomerOption = useMemo(() => {
    if (!selectedClient?.id) {
      return null;
    }
    return customerOptions.find((customer) => customer.id === selectedClient.id) || selectedClient;
  }, [customerOptions, selectedClient]);
  const selectedProjectOption = useMemo(() => {
    if (!selectedProject?.id) {
      return null;
    }
    return (Array.isArray(projects) ? projects : []).find((project) => project.id === selectedProject.id) || selectedProject;
  }, [projects, selectedProject]);
  const hasSelectedClient = Boolean(selectedClient?.name || contextPayload.customerName);
  const hasSelectedProject = Boolean(selectedProject?.id || contextPayload.projectName);
  const customerLabel = contextPayload.customerName || '';
  const projectLabel = contextPayload.projectName || '';
  const activeContextDescription = selectedClient?.name
    ? `Filene knyttes direkte til kunden ${customerLabel}.`
    : selectedProject?.id
      ? `Filene knyttes til prosjektet ${projectLabel}${customerLabel ? ` og kunden ${customerLabel}` : ''}.`
      : null;
  const contextSourceLabel = selectedClient?.name
    ? 'Valgt kunde'
    : selectedProject?.id
      ? 'Kunde via prosjekt'
      : null;
  const recentProjectOptions = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter((project) => project?.id)
        .slice(0, 6),
    [projects],
  );
  const allProjectOptions = useMemo(
    () => (Array.isArray(projects) ? projects : []).filter((project) => project?.id),
    [projects],
  );
  const sharedContextPicker = (
    <Stack spacing={1.25}>
      <Typography variant="caption" sx={{ color: 'rgba(15, 23, 42, 0.52)', fontWeight: 700 }}>
        Velg kunde og prosjekt direkte her
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25}>
        <Autocomplete
          fullWidth
          size="small"
          options={customerOptions}
          loading={crmCustomersQuery.isLoading}
          value={selectedCustomerOption}
          onChange={(_event, nextValue) => onSelectClient?.(nextValue || null)}
          getOptionLabel={(option) => option?.name || option?.company || option?.email || 'Kunde'}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Kunde"
              placeholder="Velg kunde"
              helperText="Denne kunden får hovedkonteksten for opplastingen."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Stack spacing={0.2}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {option?.name || option?.company || 'Kunde'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(15,23,42,0.55)' }}>
                  {[option?.company, option?.email].filter(Boolean).join(' • ') || option?.status || 'CRM-kunde'}
                </Typography>
              </Stack>
            </Box>
          )}
        />

        <Autocomplete
          fullWidth
          size="small"
          options={allProjectOptions}
          value={selectedProjectOption}
          onChange={(_event, nextValue) => onSelectProject?.(nextValue || null)}
          getOptionLabel={(option) => option?.title || option?.name || option?.clientName || 'Prosjekt'}
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Prosjekt"
              placeholder="Velg prosjekt"
              helperText="Prosjektet styrer mappe og leveranseflyt."
            />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Stack spacing={0.2}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {option?.title || option?.name || 'Prosjekt'}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(15,23,42,0.55)' }}>
                  {[option?.clientName, option?.status].filter(Boolean).join(' • ') || option?.eventType || 'Prosjekt'}
                </Typography>
              </Stack>
            </Box>
          )}
        />
      </Stack>
    </Stack>
  );

  const folderFilesQuery = useQuery<DriveFilesResponse>({
    queryKey: ['contextual-drive-upload-files', selectedDestination?.folderId],
    queryFn: () =>
      apiRequest(
        `/api/google/drive/files?folderId=${encodeURIComponent(selectedDestination?.folderId || '')}&pageSize=24`,
      ),
    enabled: Boolean(selectedDestination?.folderId),
    staleTime: 15_000,
    retry: false,
  });

  const uploadMutation = useMutation<UploadResponse, Error, File[]>({
    mutationFn: async (files) => {
      if (!selectedDestination) {
        throw new Error('Velg en målmappe før opplasting.');
      }

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      formData.append('profession', profession);
      formData.append('targetFolderId', selectedDestination.folderId);
      formData.append('targetFolderName', selectedDestination.folderName);
      formData.append('targetScope', selectedDestination.scope || '');
      formData.append('sectionId', selectedDestination.id);
      formData.append('sectionLabel', selectedDestination.label);
      formData.append(
        'folderStructureJson',
        JSON.stringify(driveContextQuery.data?.folderStructure?.folders || []),
      );

      if (contextPayload.customerId) {
        formData.append('customerId', contextPayload.customerId);
      }
      if (contextPayload.customerName) {
        formData.append('customerName', contextPayload.customerName);
      }
      if (contextPayload.companyName) {
        formData.append('companyName', contextPayload.companyName);
      }
      if (contextPayload.projectId) {
        formData.append('projectId', contextPayload.projectId);
      }
      if (contextPayload.projectName) {
        formData.append('projectName', contextPayload.projectName);
      }

      return apiRequest('/api/google/drive/upload-contextual', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (result) => {
      setLastUploadedFiles(result.uploaded);
      setQueuedFiles([]);
      void queryClient.invalidateQueries({
        queryKey: ['contextual-drive-upload-files', selectedDestination?.folderId],
      });
      void queryClient.invalidateQueries({
        queryKey: ['contextual-drive-upload-context', userId, profession, contextPayload.projectId, contextPayload.customerId],
      });
    },
  });

  const handleAddFiles = (incoming: FileList | File[]) => {
    const nextFiles = Array.from(incoming);
    setQueuedFiles((current) => {
      const existingKeys = new Set(current.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      const merged = [...current];
      nextFiles.forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (!existingKeys.has(key)) {
          merged.push(file);
          existingKeys.add(key);
        }
      });
      return merged.slice(0, 24);
    });
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const uploadHint = selectedDestination
    ? `Filene legges i ${selectedDestination.label.toLowerCase()} for ${contextPayload.customerName || contextPayload.projectName || 'gjeldende arbeidsflate'}.`
    : 'Velg en mappe før du laster opp.';

  const destinationFolderUrl = buildDriveFolderUrl(selectedDestination?.folderId);
  const folderFiles = folderFilesQuery.data?.files || [];

  const mobileCategoryCards = useMemo(() => {
    const groups = [
      {
        key: 'documents',
        label: 'Dokumenter',
        files: folderFiles.filter((file) =>
          file.mimeType.includes('pdf')
          || file.mimeType.includes('document')
          || file.mimeType.includes('spreadsheet')
          || file.mimeType.includes('presentation')
          || file.mimeType.startsWith('text/'),
        ),
        icon: <Description sx={{ fontSize: 36 }} />,
      },
      {
        key: 'videos',
        label: 'Video',
        files: folderFiles.filter((file) => file.mimeType.startsWith('video/')),
        icon: <VideoFile sx={{ fontSize: 36 }} />,
      },
      {
        key: 'images',
        label: 'Bilder',
        files: folderFiles.filter((file) => file.mimeType.startsWith('image/')),
        icon: <Image sx={{ fontSize: 36 }} />,
      },
      {
        key: 'audio',
        label: 'Lyd',
        files: folderFiles.filter((file) => file.mimeType.startsWith('audio/')),
        icon: <AudioFile sx={{ fontSize: 36 }} />,
      },
    ];

    return groups
      .filter((group) => group.files.length > 0)
      .map((group, index) => {
        const totalSize = group.files.reduce((sum, file) => sum + (file.size || 0), 0);
        return {
          ...group,
          totalSize,
          palette: mobileCategoryPalette[index % mobileCategoryPalette.length],
        };
      })
      .slice(0, 4);
  }, [folderFiles]);

  const totalFolderSize = useMemo(
    () => folderFiles.reduce((sum, file) => sum + (file.size || 0), 0),
    [folderFiles],
  );

  const mobileStorageRows = useMemo(() => {
    const source = mobileCategoryCards.length > 0
      ? mobileCategoryCards.map((card) => ({
          key: card.key,
          label: card.label,
          bytes: card.totalSize,
          dot: card.palette.bg.includes('#ff6a4d')
            ? '#ff7a63'
            : card.palette.bg.includes('#ffd97a')
              ? '#f4bc47'
              : card.palette.bg.includes('#513248')
                ? '#6d4c83'
                : '#5868e8',
        }))
      : destinationOptions.slice(0, 4).map((option, index) => ({
          key: option.id,
          label: option.label,
          bytes: 0,
          dot: ['#ff7a63', '#f4bc47', '#6d4c83', '#5868e8'][index % 4],
        }));

    const denominator = source.reduce((sum, row) => sum + row.bytes, 0) || 1;
    return source.map((row) => ({
      ...row,
      share: Math.max(8, Math.round((row.bytes / denominator) * 100)),
    }));
  }, [destinationOptions, mobileCategoryCards]);

  const recentFiles = useMemo(
    () => [...folderFiles].sort((left, right) => {
      const leftTime = left.modifiedTime ? new Date(left.modifiedTime).getTime() : 0;
      const rightTime = right.modifiedTime ? new Date(right.modifiedTime).getTime() : 0;
      return rightTime - leftTime;
    }).slice(0, 8),
    [folderFiles],
  );

  const scrollToMobileSection = (section: 'overview' | 'folders' | 'upload' | 'recent') => {
    setMobileActiveSection(section);
    const refMap = {
      overview: mobileOverviewRef,
      folders: mobileFoldersRef,
      upload: mobileUploadRef,
      recent: mobileRecentRef,
    } as const;
    refMap[section].current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  if (isMobile) {
    return (
      <Stack
        spacing={2.25}
        sx={{
          pb: 10,
          px: 0.25,
          background: 'linear-gradient(180deg, rgba(255,248,242,0.88) 0%, rgba(255,255,255,0) 26%)',
        }}
      >
        <Paper
          ref={mobileOverviewRef}
          sx={{
            ...cardSurfaceSx,
            px: 2.25,
            py: 2.5,
            borderRadius: 5.5,
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.04) 100%)',
            '&::after': {
              content: '""',
              position: 'absolute',
              top: -48,
              right: -42,
              width: 148,
              height: 148,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,184,107,0.24) 0%, rgba(255,184,107,0) 72%)',
              pointerEvents: 'none',
            },
          }}
        >
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.45)', fontWeight: 700 }}>
                  Mobile file manager
                </Typography>
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 900,
                    lineHeight: 0.95,
                    color: '#111827',
                    letterSpacing: '-0.04em',
                  mt: 0.5,
                  }}
                >
                  Hello,
                  <br />
                  {customerLabel}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    color: 'rgba(15,23,42,0.58)',
                    maxWidth: 240,
                    mt: 1.1,
                    lineHeight: 1.45,
                  }}
                >
                  Ryddig Google Drive-opplasting knyttet til riktig kunde, prosjekt og mappe.
                </Typography>
              </Box>

              <Stack direction="row" spacing={1}>
                <IconButton sx={{ bgcolor: 'rgba(255,255,255,0.04)', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}>
                  <NotificationsNone />
                </IconButton>
                <IconButton
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}
                  onClick={() => {
                    void driveContextQuery.refetch();
                    void folderFilesQuery.refetch();
                  }}
                >
                  <MoreVert />
                </IconButton>
              </Stack>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip icon={<Folder fontSize="small" />} label={selectedDestination?.label || 'Velg mappe'} />
              <Chip icon={<InfoOutlined fontSize="small" />} label={projectLabel} />
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                borderRadius: 4,
                borderColor: 'rgba(255,255,255,0.10)',
                bgcolor: 'rgba(255,255,255,0.04)',
                p: 1.5,
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#111827' }}>
                    Hvem gjelder dette?
                  </Typography>
                  {contextSourceLabel && <Chip size="small" label={contextSourceLabel} />}
                </Stack>
                {activeContextDescription && (
                  <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.58)', lineHeight: 1.45 }}>
                    {activeContextDescription}
                  </Typography>
                )}
                {sharedContextPicker}
                {recentProjectOptions.length > 0 && !selectedProject?.id && (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {recentProjectOptions.slice(0, 3).map((project) => (
                      <Button
                        key={project.id}
                        size="small"
                        variant="outlined"
                        onClick={() => onSelectProject?.(project)}
                        sx={{ borderRadius: 999, textTransform: 'none' }}
                      >
                        {project.title || project.name || project.clientName || 'Prosjekt'}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>
          </Stack>
        </Paper>

        <Box
          sx={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: 'minmax(170px, 1fr)',
            gap: 1.5,
            overflowX: 'auto',
            pb: 0.5,
            pr: 0.5,
            scrollSnapType: 'x proximity',
          }}
        >
          {(mobileCategoryCards.length > 0 ? mobileCategoryCards : destinationOptions.slice(0, 4).map((option, index) => ({
            key: option.id,
            label: option.label,
            files: [],
            totalSize: 0,
            icon: <FolderOpen sx={{ fontSize: 36 }} />,
            palette: mobileCategoryPalette[index % mobileCategoryPalette.length],
          }))).map((card) => (
            <Paper
              key={card.key}
              sx={{
                minHeight: 178,
                p: 2,
                borderRadius: 4.5,
                color: '#fff',
                background: card.palette.bg,
                position: 'relative',
                overflow: 'hidden',
                scrollSnapAlign: 'start',
                boxShadow: '0 18px 36px rgba(15,23,42,0.14)',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  right: -22,
                  top: -18,
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                },
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 900, color: card.palette.accent }}>
                {card.label}
              </Typography>
              <Typography variant="body2" sx={{ color: card.palette.accent, opacity: 0.9 }}>
                {card.files.length > 0 ? formatBytes(card.totalSize) : 'Klar for filer'}
              </Typography>
              <Box sx={{ position: 'absolute', right: 16, bottom: 14, opacity: 0.92 }}>
                {card.icon}
              </Box>
            </Paper>
          ))}
        </Box>

        <Paper
          sx={{
            ...cardSurfaceSx,
            p: 2.25,
            borderRadius: 4,
          }}
        >
          <Stack spacing={1.6}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                  Overview
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.48)', mt: 0.5 }}>
                  Aktiv plass i {selectedDestination?.label || 'valgt mappe'}
                </Typography>
              </Box>
              <Chip size="small" label={selectedDestination?.label || 'Velg mappe'} />
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827' }}>
                  {formatBytes(totalFolderSize)}
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(15,23,42,0.58)' }}>
                  Innhold nå i {selectedDestination?.label || 'valgt mappe'}
                </Typography>
              </Box>
              <Avatar
                sx={{
                  width: 74,
                  height: 74,
                  bgcolor: 'rgba(255, 106, 77, 0.08)',
                  color: '#ff5b3d',
                  border: '6px solid rgba(255, 91, 61, 0.14)',
                  fontWeight: 900,
                }}
              >
                {folderFiles.length}
              </Avatar>
            </Stack>
          </Stack>
          <Stack spacing={1.25} sx={{ mt: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: mobileStorageRows.map((row) => `minmax(${row.share}%, 1fr)`).join(' '),
                gap: 0.75,
                width: '100%',
              }}
            >
              {mobileStorageRows.map((row) => (
                <Box
                  key={row.key}
                  sx={{
                    height: 12,
                    borderRadius: 999,
                    background: row.dot,
                    minWidth: 12,
                  }}
                />
              ))}
            </Box>
            <Stack spacing={1}>
              {mobileStorageRows.map((row) => (
                <Stack key={row.key} direction="row" justifyContent="space-between" alignItems="center">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.dot }} />
                    <Typography variant="body1" sx={{ color: '#111827', fontWeight: 500 }}>
                      {row.label}
                    </Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.55)' }}>
                    {row.bytes > 0 ? formatBytes(row.bytes) : 'Klar'}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          ref={mobileUploadRef}
          sx={{
            borderRadius: 5.5,
            p: 2.25,
            color: '#fff',
            background: 'linear-gradient(135deg, #ffb25d 0%, #f99a4a 100%)',
            boxShadow: '0 20px 40px rgba(249, 154, 74, 0.32)',
            position: 'relative',
            overflow: 'hidden',
            '&::after': {
              content: '""',
              position: 'absolute',
              right: -12,
              bottom: -8,
              width: 124,
              height: 124,
              borderRadius: '28px',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 100%)',
              transform: 'rotate(-14deg)',
            },
          }}
        >
          <Stack spacing={1.5}>
            <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
              Last opp til
              <br />
              {selectedDestination?.label || 'Drive'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.86)' }}>
              {uploadHint}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                variant="contained"
                onClick={openFilePicker}
                startIcon={<CloudUpload />}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.04)',
                  color: '#f97316',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#fff7ef', boxShadow: 'none' },
                }}
              >
                Velg filer
              </Button>
              {destinationFolderUrl && (
                <Button
                  variant="text"
                  href={destinationFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: '#fff' }}
                  endIcon={<OpenInNew fontSize="small" />}
                >
                  Åpne mappe
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          ref={mobileRecentRef}
          sx={{
            ...cardSurfaceSx,
            p: 2.25,
            borderRadius: 4.5,
          }}
        >
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h5" sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
                Recent Files
              </Typography>
              <Button size="small" onClick={() => void folderFilesQuery.refetch()}>
                See All
              </Button>
            </Stack>

            {folderFilesQuery.isLoading && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Henter filer...
                </Typography>
              </Stack>
            )}

            {folderFilesQuery.isError && (
              <Alert severity="warning">{errorMessage(folderFilesQuery.error)}</Alert>
            )}

            {!folderFilesQuery.isLoading && !folderFilesQuery.isError && recentFiles.map((file) => (
              <Stack
                key={file.id}
                direction="row"
                spacing={1.25}
                alignItems="center"
                justifyContent="space-between"
                sx={{ py: 0.75 }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
                  <Avatar
                    variant="rounded"
                    src={file.thumbnailLink || undefined}
                    sx={{
                      width: 58,
                      height: 58,
                      bgcolor: 'rgba(255, 168, 94, 0.18)',
                      color: '#f97316',
                      borderRadius: 3,
                    }}
                  >
                    {fileKindIcon(file.mimeType)}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body1" noWrap sx={{ fontWeight: 700, color: '#111827' }}>
                      {file.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(15,23,42,0.5)' }}>
                      {formatBytes(file.size)} • {formatTimestamp(file.modifiedTime)}
                    </Typography>
                  </Box>
                </Stack>

                <IconButton
                  size="small"
                  href={file.webViewLink || undefined}
                  target={file.webViewLink ? '_blank' : undefined}
                  rel={file.webViewLink ? 'noreferrer' : undefined}
                >
                  <MoreVert fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            {!folderFilesQuery.isLoading && !folderFilesQuery.isError && recentFiles.length === 0 && (
              <Alert severity="info">Ingen filer ennå. Start med første opplasting.</Alert>
            )}
          </Stack>
        </Paper>

        <Paper
          ref={mobileFoldersRef}
          sx={{
            ...cardSurfaceSx,
            p: 2,
            borderRadius: 4.5,
          }}
        >
          <Stack spacing={1.25}>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#111827', lineHeight: 1 }}>
              Mapper
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 1,
              }}
            >
              {destinationOptions.slice(0, 6).map((option) => (
                <Button
                  key={option.id}
                  variant={option.id === selectedDestinationId ? 'contained' : 'outlined'}
                  onClick={() => setSelectedDestinationId(option.id)}
                  sx={{
                    minHeight: 84,
                    borderRadius: 3,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 1.5,
                    py: 1.25,
                    ...(option.id === selectedDestinationId
                      ? {
                          bgcolor: '#ff5b3d',
                          '&:hover': { bgcolor: '#ff5638' },
                        }
                      : {
                          borderColor: 'rgba(255,255,255,0.10)',
                          color: '#0f172a',
                        }),
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
                    <Avatar
                      sx={{
                        width: 34,
                        height: 34,
                        bgcolor: option.id === selectedDestinationId ? 'rgba(255,255,255,0.18)' : 'rgba(249, 115, 22, 0.12)',
                        color: option.id === selectedDestinationId ? '#fff' : '#f97316',
                        fontSize: 18,
                      }}
                    >
                      <FolderOpen sx={{ fontSize: 18 }} />
                    </Avatar>
                    <Stack alignItems="flex-start" spacing={0.15} sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                      {option.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: option.id === selectedDestinationId ? 'rgba(255,255,255,0.8)' : 'rgba(15,23,42,0.5)',
                      }}
                      noWrap
                    >
                      {option.folderName}
                    </Typography>
                    </Stack>
                  </Stack>
                </Button>
              ))}
            </Box>
          </Stack>
        </Paper>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files?.length) {
              handleAddFiles(event.target.files);
              event.target.value = '';
            }
          }}
        />

        {queuedFiles.length > 0 && (
          <Paper
            sx={{
              ...cardSurfaceSx,
              p: 2,
              borderRadius: 4.5,
            }}
          >
            <Stack spacing={1.25}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Klar for opplasting
                </Typography>
                <Chip size="small" label={`${queuedFiles.length} filer`} />
              </Stack>

              {queuedFiles.map((file) => (
                <Stack
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  direction="row"
                  spacing={1.25}
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{
                    p: 1.25,
                    borderRadius: 3,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
                    <Box sx={{ color: '#475569' }}>{fileKindIcon(file.type)}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                        {file.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatBytes(file.size)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() =>
                      setQueuedFiles((current) =>
                        current.filter(
                          (entry) =>
                            `${entry.name}-${entry.size}-${entry.lastModified}`
                            !== `${file.name}-${file.size}-${file.lastModified}`,
                        ),
                      )
                    }
                  >
                    Fjern
                  </Button>
                </Stack>
              ))}

              <Button
                variant="contained"
                size="large"
                startIcon={<CloudUpload />}
                disabled={uploadMutation.isPending || !selectedDestination}
                onClick={() => uploadMutation.mutate(queuedFiles)}
                sx={{ borderRadius: 3, minHeight: 52, bgcolor: '#ff5b3d', '&:hover': { bgcolor: '#ff5638' } }}
              >
                {uploadMutation.isPending ? 'Laster opp...' : `Last opp til ${selectedDestination?.label || 'mappe'}`}
              </Button>

              {uploadMutation.isPending && <LinearProgress />}
              {uploadMutation.isError && <Alert severity="error">{errorMessage(uploadMutation.error)}</Alert>}
              {lastUploadedFiles.length > 0 && !uploadMutation.isPending && (
                <Alert severity="success">{lastUploadedFiles.length} filer ble lastet opp.</Alert>
              )}
            </Stack>
          </Paper>
        )}

        <Paper
          sx={{
            position: 'sticky',
            bottom: 12,
            zIndex: 4,
            mx: 0.5,
            px: 1,
            py: 0.75,
            borderRadius: 999,
            bgcolor: 'rgba(15, 23, 42, 0.94)',
            color: '#fff',
            boxShadow: '0 20px 44px rgba(15, 23, 42, 0.32)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Stack direction="row" justifyContent="space-around" alignItems="center">
            {[
              { id: 'overview' as const, label: 'Hjem', icon: <HomeOutlined fontSize="small" /> },
              { id: 'folders' as const, label: 'Mapper', icon: <FolderOpen fontSize="small" /> },
              { id: 'upload' as const, label: 'Last opp', icon: <CloudUpload fontSize="small" /> },
              { id: 'recent' as const, label: 'Filer', icon: <Search fontSize="small" /> },
            ].map((item) => {
              const active = mobileActiveSection === item.id;
              return (
                <Button
                  key={item.id}
                  onClick={() => scrollToMobileSection(item.id)}
                  startIcon={item.icon}
                  sx={{
                    minWidth: 0,
                    px: 1.5,
                    py: 0.85,
                    borderRadius: 999,
                    color: active ? '#111827' : 'rgba(255,255,255,0.86)',
                    bgcolor: active ? '#fff' : 'transparent',
                    '&:hover': {
                      bgcolor: active ? '#fff' : 'rgba(255,255,255,0.08)',
                    },
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'none' }}>
                    {item.label}
                  </Typography>
                </Button>
              );
            })}
          </Stack>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ ...cardSurfaceSx, p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Prosjektbasert filopplasting
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(15, 23, 42, 0.68)', mt: 0.75 }}>
                Last opp direkte til riktig kundemappe i Google Drive, med prosjektkontekst og mappestruktur fra CreatorHub.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {hasSelectedClient && (
                <Chip icon={<Folder fontSize="small" />} label={customerLabel} />
              )}
              {hasSelectedProject && (
                <Chip icon={<InfoOutlined fontSize="small" />} label={projectLabel} />
              )}
              {(hasSelectedClient || hasSelectedProject) && (
                <Chip
                  icon={<CheckCircle fontSize="small" />}
                  color={driveContextQuery.data?.customerContext?.folderReady ? 'success' : 'default'}
                  label={driveContextQuery.data?.customerContext?.folderReady ? 'Kundemappe klar' : 'Klargjør kundemappe'}
                />
              )}
            </Stack>
          </Stack>

          <Paper
            variant="outlined"
            sx={{
              borderRadius: 3.5,
              borderColor: 'rgba(255,255,255,0.10)',
              bgcolor: 'rgba(255,255,255,0.04)',
              p: 2,
            }}
          >
            <Stack spacing={1.25}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    1. Hvem gjelder opplastingen?
                  </Typography>
                  {activeContextDescription && (
                    <Typography variant="body2" sx={{ color: 'rgba(15, 23, 42, 0.62)', mt: 0.4 }}>
                      {activeContextDescription}
                    </Typography>
                  )}
                </Box>
                {contextSourceLabel && <Chip size="small" label={contextSourceLabel} />}
              </Stack>

              {(hasSelectedClient || hasSelectedProject) && (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {hasSelectedClient && (
                    <Chip
                      color="primary"
                      label={`Kunde: ${customerLabel}`}
                    />
                  )}
                  {hasSelectedProject && (
                    <Chip
                      color="warning"
                      label={`Prosjekt: ${projectLabel}`}
                    />
                  )}
                </Stack>
              )}

              {sharedContextPicker}

              {recentProjectOptions.length > 0 && (
                <Stack spacing={0.75}>
                  <Typography variant="caption" sx={{ color: 'rgba(15, 23, 42, 0.52)', fontWeight: 700 }}>
                    Hurtigvalg fra dashboardet
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {recentProjectOptions.map((project) => {
                      const isActive = project.id === selectedProject?.id;
                      return (
                        <Button
                          key={project.id}
                          size="small"
                          variant={isActive ? 'contained' : 'outlined'}
                          onClick={() => onSelectProject?.(project)}
                          sx={{ borderRadius: 999, textTransform: 'none' }}
                        >
                          {project.title || project.name || project.clientName || 'Prosjekt'}
                        </Button>
                      );
                    })}
                  </Stack>
                </Stack>
              )}
            </Stack>
          </Paper>

          {driveContextQuery.isLoading && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={20} />
              <Typography variant="body2" color="text.secondary">
                Klargjør Google Drive-kontekst...
              </Typography>
            </Stack>
          )}

          {driveContextQuery.isError && (
            <Alert
              severity="warning"
              action={
                <Button color="inherit" size="small" onClick={() => void driveContextQuery.refetch()}>
                  Prøv igjen
                </Button>
              }
            >
              {errorMessage(driveContextQuery.error)}
            </Alert>
          )}
        </Stack>
      </Paper>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
          gap: 3,
          alignItems: 'start',
        }}
      >
        <Paper sx={{ ...cardSurfaceSx, p: 2, position: 'sticky', top: 24 }}>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Målmappe
              </Typography>
              <Button
                size="small"
                startIcon={<Refresh fontSize="small" />}
                onClick={() => {
                  void driveContextQuery.refetch();
                  void folderFilesQuery.refetch();
                }}
              >
                Oppdater
              </Button>
            </Stack>

            <Typography variant="body2" sx={{ color: 'rgba(15, 23, 42, 0.64)' }}>
              Hold deg til én mappe per opplasting. Det reduserer rot og gjør det lett å finne filer igjen senere.
            </Typography>

            <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {destinationOptions.map((option) => (
                <ListItemButton
                  key={option.id}
                  selected={option.id === selectedDestinationId}
                  onClick={() => setSelectedDestinationId(option.id)}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.10)',
                    alignItems: 'flex-start',
                    px: 1.5,
                    py: 1.25,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(249, 115, 22, 0.10)',
                      borderColor: 'rgba(249, 115, 22, 0.35)',
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: option.recommended ? '#f97316' : '#475569', mt: 0.25 }}>
                    <FolderOpen fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {option.label}
                        </Typography>
                        {option.recommended && <Chip size="small" color="warning" label="Anbefalt" />}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.25 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(15, 23, 42, 0.64)' }}>
                          {option.description}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(15, 23, 42, 0.45)' }}>
                          {option.folderName}
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItemButton>
              ))}
            </List>

            <Divider />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Aktiv mappestruktur
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {(driveContextQuery.data?.folderStructure?.folders || []).slice(0, 8).map((folder) => (
                <Chip key={folder} size="small" variant="outlined" label={folder} />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Stack spacing={3}>
          <Paper sx={{ ...cardSurfaceSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Last opp til {selectedDestination?.label || 'valgt mappe'}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(15, 23, 42, 0.64)', mt: 0.5 }}>
                    {uploadHint}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  {destinationFolderUrl && (
                    <Button
                      variant="outlined"
                      startIcon={<OpenInNew />}
                      href={destinationFolderUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Åpne mappe
                    </Button>
                  )}
                  <Button variant="contained" startIcon={<CloudUpload />} onClick={openFilePicker}>
                    Velg filer
                  </Button>
                </Stack>
              </Stack>

              <Box
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openFilePicker();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) {
                    setDragging(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (event.dataTransfer.files?.length) {
                    handleAddFiles(event.dataTransfer.files);
                  }
                }}
                sx={{
                  borderRadius: 4,
                  border: dragging ? '2px solid rgba(249, 115, 22, 0.75)' : '2px dashed rgba(15, 23, 42, 0.12)',
                  bgcolor: dragging ? 'rgba(249, 115, 22, 0.08)' : 'rgba(255,255,255,0.04)',
                  p: { xs: 3, md: 4 },
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 160ms ease',
                }}
              >
                <CloudUpload sx={{ fontSize: 42, color: '#f97316', mb: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                  Dra filer hit, eller klikk for å velge
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(15, 23, 42, 0.64)', mt: 1 }}>
                  Filer går rett til valgt Google Drive-mappe og blir liggende i samme kundestruktur som resten av prosjektet.
                </Typography>
              </Box>

              <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  if (event.target.files?.length) {
                    handleAddFiles(event.target.files);
                    event.target.value = '';
                  }
                }}
              />

              {queuedFiles.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: 'rgba(255,255,255,0.10)',
                    bgcolor: 'rgba(255,255,255,0.04)',
                    p: 1.5,
                  }}
                >
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Klar for opplasting
                      </Typography>
                      <Chip size="small" label={`${queuedFiles.length} filer`} />
                    </Stack>

                    {queuedFiles.map((file) => (
                      <Stack
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{
                          px: 1.25,
                          py: 1,
                          borderRadius: 2.5,
                          bgcolor: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                      >
                        <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
                          <Box sx={{ color: '#475569' }}>{fileKindIcon(file.type)}</Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                              {file.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatBytes(file.size)}
                            </Typography>
                          </Box>
                        </Stack>

                        <Button
                          size="small"
                          color="inherit"
                          onClick={() =>
                            setQueuedFiles((current) =>
                              current.filter(
                                (entry) =>
                                  `${entry.name}-${entry.size}-${entry.lastModified}`
                                  !== `${file.name}-${file.size}-${file.lastModified}`,
                              ),
                            )
                          }
                        >
                          Fjern
                        </Button>
                      </Stack>
                    ))}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<CloudUpload />}
                        disabled={uploadMutation.isPending || !selectedDestination}
                        onClick={() => uploadMutation.mutate(queuedFiles)}
                      >
                        {uploadMutation.isPending ? 'Laster opp...' : `Last opp til ${selectedDestination?.label || 'mappe'}`}
                      </Button>
                      <Button
                        variant="text"
                        color="inherit"
                        disabled={uploadMutation.isPending}
                        onClick={() => setQueuedFiles([])}
                      >
                        Tøm liste
                      </Button>
                    </Stack>

                    {uploadMutation.isPending && <LinearProgress />}
                    {uploadMutation.isError && (
                      <Alert severity="error">{errorMessage(uploadMutation.error)}</Alert>
                    )}
                    {lastUploadedFiles.length > 0 && !uploadMutation.isPending && (
                      <Alert severity="success">
                        {lastUploadedFiles.length} filer ble lastet opp til {selectedDestination?.label.toLowerCase()}.
                      </Alert>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Paper>

          <Paper sx={{ ...cardSurfaceSx, p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Innhold i valgt mappe
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(15, 23, 42, 0.64)', mt: 0.5 }}>
                    Du ser alltid samme mappe som opplastingen går til. Ingen skjulte sideeffekter.
                  </Typography>
                </Box>
                <Chip
                  icon={<Folder fontSize="small" />}
                  label={selectedDestination?.folderName || 'Ingen mappe valgt'}
                />
              </Stack>

              {folderFilesQuery.isLoading && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <CircularProgress size={20} />
                  <Typography variant="body2" color="text.secondary">
                    Henter filer...
                  </Typography>
                </Stack>
              )}

              {folderFilesQuery.isError && (
                <Alert severity="warning">{errorMessage(folderFilesQuery.error)}</Alert>
              )}

              {!folderFilesQuery.isLoading && !folderFilesQuery.isError && (
                <Stack spacing={1}>
                  {(folderFilesQuery.data?.files || []).slice(0, 18).map((file) => (
                    <Stack
                      key={file.id}
                      direction={{ xs: 'column', sm: 'row' }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      sx={{
                        px: 1.5,
                        py: 1.25,
                        borderRadius: 3,
                        border: '1px solid rgba(255,255,255,0.10)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                      }}
                    >
                      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
                        <Box sx={{ color: '#475569' }}>{fileKindIcon(file.mimeType)}</Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatBytes(file.size)} • {formatTimestamp(file.modifiedTime)}
                          </Typography>
                        </Box>
                      </Stack>

                      {file.webViewLink && (
                        <Button
                          size="small"
                          endIcon={<OpenInNew fontSize="small" />}
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Åpne
                        </Button>
                      )}
                    </Stack>
                  ))}

                  {!folderFilesQuery.data?.files?.length && (
                    <Alert severity="info">
                      Det ligger ingen filer i denne mappen ennå. Start med å laste opp første leveranse, brief eller referanse.
                    </Alert>
                  )}
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Stack>
  );
}
