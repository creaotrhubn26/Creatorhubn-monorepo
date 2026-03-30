import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBack,
  AudioFile,
  ChatBubbleOutline,
  Close,
  Description,
  Folder,
  FolderSharedOutlined,
  HistoryOutlined,
  ImageOutlined,
  InsertDriveFile,
  Movie,
  ReceiptLongOutlined,
  Search,
  WorkspacesOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

export interface GoogleDriveAttachmentFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  webContentLink: string | null;
  thumbnailLink: string | null;
  iconLink: string | null;
  parents?: string[];
  contextLabel?: string | null;
  accessState?: 'private' | 'recipient' | 'domain' | 'link';
}

interface GoogleDriveAttachmentPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: GoogleDriveAttachmentFile[]) => void | Promise<void>;
  allowMultiple?: boolean;
  onlyImages?: boolean;
  zIndex?: number;
  conversationId?: string | null;
  conversationName?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  companyName?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  recipientEmail?: string | null;
  profession?: string | null;
  activeChannel?: 'internal-chat' | 'google-chat' | 'email';
}

interface GoogleDriveFilesResponse {
  files?: GoogleDriveAttachmentFile[];
  nextPageToken?: string | null;
}

interface GoogleDriveContextSection {
  id: string;
  label: string;
  description: string;
  category: string;
  recommended?: boolean;
  folderId?: string | null;
  folderName?: string | null;
  query?: string | null;
  scope?: string | null;
}

interface GoogleDriveContextResponse {
  sections?: GoogleDriveContextSection[];
  customerFolder?: {
    id: string;
    name: string;
    webViewLink?: string | null;
    folderStructure?: string[];
    status?: 'ready';
    source?: string | null;
  } | null;
  recentFolders?: Array<{
    id: string;
    name: string;
    webViewLink?: string | null;
    modifiedTime?: string | null;
  }>;
  folderStructure?: {
    source?: string;
    folders?: string[];
    quoteFolderName?: string;
    contractFolderName?: string;
    primaryFolderId?: string | null;
    primaryFolderName?: string | null;
    primaryScope?: string | null;
  };
  customerContext?: {
    customerId?: string | null;
    customerName?: string | null;
    companyName?: string | null;
    projectId?: string | null;
    folderId?: string | null;
    folderName?: string | null;
    folderReady?: boolean;
  };
}

interface UserKvResponse {
  success?: boolean;
  data?: Record<string, unknown>;
}

const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

const DEFAULT_DRIVE_STRUCTURE = [
  'RAW - Originale bilder',
  'Bearbeidede bilder',
  'Leveranse til klient',
  'Kontrakter og dokumenter',
  'Kommunikasjon',
  'Timeline og notater',
  'Backup og sikkerhetskopier',
  'Referansebilder og inspirasjon',
];

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) {
    return 'Ukjent størrelse';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getMimeSummaryLabel(file: GoogleDriveAttachmentFile): string {
  if (file.mimeType === DRIVE_FOLDER_MIME) {
    return 'Mappe';
  }
  if (file.mimeType.startsWith('image/')) {
    return 'Bilde';
  }
  if (file.mimeType.startsWith('video/')) {
    return 'Video';
  }
  if (file.mimeType.startsWith('audio/')) {
    return 'Lyd';
  }
  if (file.mimeType.includes('pdf')) {
    return 'PDF';
  }
  if (file.mimeType.includes('document') || file.mimeType.includes('word')) {
    return 'Dokument';
  }
  return 'Fil';
}

function getFileIcon(file: GoogleDriveAttachmentFile) {
  if (file.mimeType === DRIVE_FOLDER_MIME) {
    return <Folder sx={{ color: '#f59e0b' }} />;
  }
  if (file.mimeType.startsWith('image/')) {
    return <ImageOutlined sx={{ color: '#2563eb' }} />;
  }
  if (file.mimeType.startsWith('video/')) {
    return <Movie sx={{ color: '#7c3aed' }} />;
  }
  if (file.mimeType.startsWith('audio/')) {
    return <AudioFile sx={{ color: '#059669' }} />;
  }
  if (file.mimeType.includes('pdf') || file.mimeType.includes('document') || file.mimeType.includes('word')) {
    return <Description sx={{ color: '#ea580c' }} />;
  }
  return <InsertDriveFile sx={{ color: '#64748b' }} />;
}

function getSectionIcon(section: GoogleDriveContextSection) {
  switch (section.category) {
    case 'project':
      return <WorkspacesOutlined sx={{ fontSize: 18 }} />;
    case 'communication':
      return <ChatBubbleOutline sx={{ fontSize: 18 }} />;
    case 'quote':
    case 'contract':
      return <ReceiptLongOutlined sx={{ fontSize: 18 }} />;
    case 'recent':
      return <HistoryOutlined sx={{ fontSize: 18 }} />;
    default:
      return <FolderSharedOutlined sx={{ fontSize: 18 }} />;
  }
}

function getStringArrayFromUnknown(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[>/|,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function extractFolderStructureFromValue(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return getStringArrayFromUnknown(value);
  }

  const record = value as Record<string, unknown>;
  return [
    ...getStringArrayFromUnknown(record.customStructure),
    ...getStringArrayFromUnknown(record.folders),
    ...getStringArrayFromUnknown(record.folderStructure),
  ].filter(Boolean);
}

function detectUserFolderStructure(userKvData: Record<string, unknown>): string[] {
  const explicitKeys = [
    'folderStructure',
    'folder_structure',
    'folderStructureSettings',
    'dashboardFolderStructure',
    'googleDriveFolderStructure',
    'fileManagementFolderStructure',
  ];

  for (const key of explicitKeys) {
    const candidate = extractFolderStructureFromValue(userKvData[key]);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  for (const [key, value] of Object.entries(userKvData)) {
    if (!/folder|drive|backup/i.test(key)) {
      continue;
    }
    const candidate = extractFolderStructureFromValue(value);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return DEFAULT_DRIVE_STRUCTURE;
}

function detectArchiveFolderName(userKvData: Record<string, unknown>, documentType: 'quote' | 'contract'): string | null {
  const candidateKeys = documentType === 'quote'
    ? ['documentArchiveConfig_quote', 'quoteArchiveConfig']
    : ['documentArchiveConfig_contract', 'contractArchiveConfig'];

  for (const key of candidateKeys) {
    const value = userKvData[key];
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.baseFolderName === 'string' && record.baseFolderName.trim()) {
        return record.baseFolderName.trim();
      }
    }
  }

  return null;
}

function buildFallbackSections(projectName?: string | null): GoogleDriveContextSection[] {
  return [
    ...(projectName
      ? [{
          id: 'project-root',
          label: 'Prosjektmappe',
          description: projectName,
          category: 'project',
          recommended: true,
        }]
      : []),
    {
      id: 'recent',
      label: 'Sist brukt',
      description: 'Nylig oppdaterte filer og mapper',
      category: 'recent',
      recommended: true,
    },
    {
      id: 'all-drive',
      label: 'Hele Drive',
      description: 'Sok i hele Google Drive',
      category: 'root',
    },
  ];
}

function pickInitialSectionId(sections: GoogleDriveContextSection[]): string {
  return (
    sections.find((section) => section.id === 'customer-root' && section.folderId)?.id
    || sections.find((section) => section.id === 'communication' && section.folderId)?.id
    || sections.find((section) => section.id === 'project-root' && section.folderId)?.id
    || sections.find((section) => section.recommended)?.id
    || sections[0]?.id
    || 'all-drive'
  );
}

export default function GoogleDriveAttachmentPicker({
  open,
  onClose,
  onSelect,
  allowMultiple = true,
  onlyImages = false,
  zIndex,
  conversationId,
  conversationName,
  customerId,
  customerName,
  companyName,
  projectId,
  projectName,
  recipientEmail,
  profession,
  activeChannel = 'internal-chat',
}: GoogleDriveAttachmentPickerProps) {
  const [files, setFiles] = useState<GoogleDriveAttachmentFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contextSections, setContextSections] = useState<GoogleDriveContextSection[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string>('recent');
  const [recentFolders, setRecentFolders] = useState<Array<{ id: string; name: string; modifiedTime?: string | null }>>([]);
  const [folderStructure, setFolderStructure] = useState<string[]>(DEFAULT_DRIVE_STRUCTURE);
  const [resolvedCustomerLabel, setResolvedCustomerLabel] = useState<string | null>(null);
  const [resolvedCustomerFolderName, setResolvedCustomerFolderName] = useState<string | null>(null);

  const activeSection = useMemo(
    () => contextSections.find((section) => section.id === activeSectionId) ?? null,
    [activeSectionId, contextSections],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadContext = async () => {
      setContextLoading(true);
      setError(null);

      try {
        const kvResponse = await apiRequest('/api/user/kv') as UserKvResponse | Record<string, unknown>;
        const userKvData =
          kvResponse && typeof kvResponse === 'object' && 'data' in kvResponse
            ? ((kvResponse as UserKvResponse).data || {})
            : (kvResponse as Record<string, unknown>);
        const customStructure = detectUserFolderStructure(userKvData || {});
        const quoteFolderName = detectArchiveFolderName(userKvData || {}, 'quote');
        const contractFolderName = detectArchiveFolderName(userKvData || {}, 'contract');

        const contextResponse = await apiRequest('/api/google/drive/context', {
          method: 'POST',
          body: {
            conversationId,
            conversationName,
            customerId,
            customerName,
            companyName,
            projectId,
            projectName,
            recipientEmail,
            profession,
            activeChannel,
            customStructure,
            quoteFolderName,
            contractFolderName,
          },
        }) as GoogleDriveContextResponse;

        if (cancelled) {
          return;
        }

        const sections = Array.isArray(contextResponse.sections) && contextResponse.sections.length > 0
          ? contextResponse.sections
          : buildFallbackSections(projectName);

        setContextSections(sections);
        setActiveSectionId(pickInitialSectionId(sections));
        setCurrentFolderId(null);
        setFolderPath([]);
        setSelectedIds(new Set());
        setRecentFolders(Array.isArray(contextResponse.recentFolders) ? contextResponse.recentFolders : []);
        setFolderStructure(
          Array.isArray(contextResponse.folderStructure?.folders) && contextResponse.folderStructure.folders.length > 0
            ? contextResponse.folderStructure.folders
            : customStructure,
        );
        setResolvedCustomerLabel(
          contextResponse.customerContext?.companyName
          || contextResponse.customerContext?.customerName
          || companyName
          || customerName
          || null,
        );
        setResolvedCustomerFolderName(
          contextResponse.customerContext?.folderName
          || contextResponse.customerFolder?.name
          || null,
        );
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message = loadError instanceof Error
          ? loadError.message
          : 'Kunne ikke hente mappekontekst fra Google Drive';
        setError(message);
        const fallbackSections = buildFallbackSections(projectName);
        setContextSections(fallbackSections);
        setActiveSectionId(pickInitialSectionId(fallbackSections));
        setRecentFolders([]);
        setFolderStructure(DEFAULT_DRIVE_STRUCTURE);
        setResolvedCustomerFolderName(null);
      } finally {
        if (!cancelled) {
          setContextLoading(false);
        }
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [
    activeChannel,
    companyName,
    conversationId,
    conversationName,
    customerId,
    customerName,
    open,
    profession,
    projectId,
    projectName,
    recipientEmail,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const loadFiles = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiRequest('/api/google-drive/files', {
          method: 'POST',
          body: {
            folderId: currentFolderId || activeSection?.folderId || undefined,
            search: searchQuery.trim() || undefined,
            onlyImages,
            query: currentFolderId ? undefined : activeSection?.query || undefined,
          },
        }) as GoogleDriveFilesResponse;

        if (cancelled) {
          return;
        }

        setFiles(Array.isArray(data.files) ? data.files : []);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        const message = loadError instanceof Error
          ? loadError.message
          : 'Kunne ikke hente filer fra Google Drive';
        setError(message);
        setFiles([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFiles();

    return () => {
      cancelled = true;
    };
  }, [activeSection?.folderId, activeSection?.query, currentFolderId, onlyImages, open, searchQuery]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return files;
    }

    const normalizedSearch = searchQuery.trim().toLowerCase();
    return files.filter((file) => file.name.toLowerCase().includes(normalizedSearch));
  }, [files, searchQuery]);

  const toggleSelection = (fileId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(fileId)) {
        next.delete(fileId);
        return next;
      }

      if (!allowMultiple) {
        next.clear();
      }

      next.add(fileId);
      return next;
    });
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    setCurrentFolderId(null);
    setFolderPath([]);
    setError(null);
    onClose();
  };

  const handleSelectCurrent = async () => {
    const contextLabel = folderPath[folderPath.length - 1]?.name || activeSection?.label || null;
    const selectedFiles = filteredFiles
      .filter((file) => selectedIds.has(file.id) && file.mimeType !== DRIVE_FOLDER_MIME)
      .map((file) => ({
        ...file,
        contextLabel,
      }));

    setSubmitting(true);
    try {
      await Promise.resolve(onSelect(selectedFiles));
      handleClose();
    } catch (selectError) {
      const message = selectError instanceof Error
        ? selectError.message
        : 'Kunne ikke legge ved valgte filer';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFolder = (file: GoogleDriveAttachmentFile) => {
    setCurrentFolderId(file.id);
    setFolderPath((previous) => [...previous, { id: file.id, name: file.name }]);
    setSelectedIds(new Set());
  };

  const handleBreadcrumbBack = (index: number) => {
    if (index < 0) {
      setCurrentFolderId(activeSection?.folderId || null);
      setFolderPath(
        activeSection?.folderId
          ? [{ id: activeSection.folderId, name: activeSection.folderName || activeSection.label }]
          : [],
      );
      setSelectedIds(new Set());
      return;
    }

    const nextPath = folderPath.slice(0, index + 1);
    setFolderPath(nextPath);
    setCurrentFolderId(nextPath[nextPath.length - 1]?.id ?? activeSection?.folderId ?? null);
    setSelectedIds(new Set());
  };

  const handleSelectSection = (section: GoogleDriveContextSection) => {
    setActiveSectionId(section.id);
    setCurrentFolderId(section.folderId || null);
    setFolderPath(
      section.folderId
        ? [{ id: section.folderId, name: section.folderName || section.label }]
        : [],
    );
    setSelectedIds(new Set());
    setSearchQuery('');
  };

  const summaryLabel = resolvedCustomerLabel
    ? `Kundemappe: ${resolvedCustomerLabel}`
    : projectName
      ? `Prosjekt: ${projectName}`
      : 'Brukerens mappestruktur';

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : handleClose}
      maxWidth="md"
      fullWidth
      sx={{ zIndex }}
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ px: 2.2, py: 1.8, borderBottom: '1px solid rgba(226,232,240,0.8)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Velg fra Google Drive
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {onlyImages
                ? 'Start i riktig kunde- eller prosjektmappe og velg bilder direkte til chatten.'
                : 'Koble vedlegg til riktig kunde, prosjekt eller dokumentmappe uten a forlate dashboardet.'}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small" disabled={submitting}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ px: 2.2, py: 1.8 }}>
        <Box sx={{ display: 'grid', gap: 1.2 }}>
          <TextField
            fullWidth
            placeholder={onlyImages ? 'Sok etter bilder i valgt mappe' : 'Sok etter filer i valgt mappe'}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <Box
            sx={{
              display: 'grid',
              gap: 1,
              p: 1.2,
              borderRadius: 3,
              border: '1px solid rgba(226,232,240,0.85)',
              bgcolor: 'rgba(248,250,252,0.92)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: '#0f172a' }}>
                  {summaryLabel}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {resolvedCustomerFolderName
                    ? `${resolvedCustomerFolderName} er knyttet til kunden og bruker ${folderStructure.length} undermapper`
                    : folderStructure.length > 0
                      ? `${folderStructure.length} strukturmapper tilgjengelig for denne flyten`
                      : 'Bruker standard CreatorHub-struktur'}
                </Typography>
              </Box>
              {activeChannel === 'google-chat' && (
                <Chip
                  size="small"
                  label="Google Chat"
                  sx={{ height: 24, fontWeight: 700, bgcolor: 'rgba(66,133,244,0.1)', color: '#1d4ed8' }}
                />
              )}
              {activeChannel === 'email' && (
                <Chip
                  size="small"
                  label="Gmail"
                  sx={{ height: 24, fontWeight: 700, bgcolor: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}
                />
              )}
              {resolvedCustomerFolderName && (
                <Chip
                  size="small"
                  label="Kundemappe klar"
                  sx={{ height: 24, fontWeight: 700, bgcolor: 'rgba(22,163,74,0.12)', color: '#166534' }}
                />
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.9, overflowX: 'auto', pb: 0.15 }}>
              {contextLoading ? (
                <Box sx={{ py: 0.8, px: 0.4, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Henter kundemappert kontekst...
                  </Typography>
                </Box>
              ) : contextSections.map((section) => {
                const selected = section.id === activeSectionId;
                return (
                  <Button
                    key={section.id}
                    onClick={() => handleSelectSection(section)}
                    variant={selected ? 'contained' : 'outlined'}
                    startIcon={getSectionIcon(section)}
                    sx={{
                      minWidth: 168,
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      textTransform: 'none',
                      borderRadius: 3,
                      px: 1.25,
                      py: 1.1,
                      flexShrink: 0,
                      bgcolor: selected ? '#2563eb' : 'rgba(255,255,255,0.88)',
                      color: selected ? 'white' : '#0f172a',
                      borderColor: selected ? '#2563eb' : 'rgba(203,213,225,0.9)',
                    }}
                  >
                    <Box sx={{ textAlign: 'left', minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                        {section.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          mt: 0.2,
                          color: selected ? 'rgba(255,255,255,0.82)' : 'text.secondary',
                          whiteSpace: 'normal',
                          lineHeight: 1.35,
                        }}
                      >
                        {section.description}
                      </Typography>
                    </Box>
                  </Button>
                );
              })}
            </Box>

            {recentFolders.length > 0 && activeSectionId !== 'recent' && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.7 }}>
                {recentFolders.slice(0, 4).map((folder) => (
                  <Chip
                    key={folder.id}
                    icon={<HistoryOutlined sx={{ fontSize: 15 }} />}
                    label={folder.name}
                    onClick={() => {
                      setActiveSectionId('recent');
                      setCurrentFolderId(folder.id);
                      setFolderPath([{ id: folder.id, name: folder.name }]);
                    }}
                    sx={{
                      height: 28,
                      bgcolor: 'rgba(255,255,255,0.92)',
                      border: '1px solid rgba(226,232,240,0.9)',
                      fontWeight: 700,
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Chip
              label={activeSection?.label || 'Drive'}
              icon={<Folder />}
              onClick={() => handleBreadcrumbBack(-1)}
              variant="filled"
              sx={{ fontWeight: 700 }}
            />
            {folderPath.map((folder, index) => (
              <Chip
                key={folder.id}
                label={folder.name}
                icon={<ArrowBack sx={{ fontSize: 16 }} />}
                onClick={() => handleBreadcrumbBack(index)}
                variant={index === folderPath.length - 1 ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box
            sx={{
              minHeight: 380,
              maxHeight: 520,
              borderRadius: 3,
              border: '1px solid rgba(226,232,240,0.9)',
              bgcolor: '#f8fafc',
              overflow: 'auto',
            }}
          >
            {loading ? (
              <Box sx={{ minHeight: 380, display: 'grid', placeItems: 'center' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress size={26} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Henter filer fra {activeSection?.label?.toLowerCase() || 'Google Drive'}...
                  </Typography>
                </Box>
              </Box>
            ) : filteredFiles.length > 0 ? (
              <List disablePadding>
                {filteredFiles.map((file) => {
                  const isFolder = file.mimeType === DRIVE_FOLDER_MIME;
                  const selected = selectedIds.has(file.id);

                  return (
                    <ListItemButton
                      key={file.id}
                      onClick={() => {
                        if (isFolder) {
                          handleOpenFolder(file);
                          return;
                        }
                        toggleSelection(file.id);
                      }}
                      sx={{
                        py: 1.25,
                        px: 1.3,
                        borderBottom: '1px solid rgba(226,232,240,0.7)',
                        '&:last-of-type': {
                          borderBottom: 'none',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {isFolder ? (
                          getFileIcon(file)
                        ) : (
                          <Checkbox
                            edge="start"
                            checked={selected}
                            tabIndex={-1}
                            disableRipple
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelection(file.id);
                            }}
                          />
                        )}
                      </ListItemIcon>
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          border: '1px solid rgba(226,232,240,0.9)',
                          bgcolor: 'white',
                          display: 'grid',
                          placeItems: 'center',
                          overflow: 'hidden',
                          flexShrink: 0,
                          mr: 1.1,
                        }}
                      >
                        {file.thumbnailLink ? (
                          <Box
                            component="img"
                            src={file.thumbnailLink}
                            alt=""
                            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          getFileIcon(file)
                        )}
                      </Box>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                            {file.name}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap', mt: 0.35 }}>
                            <Typography variant="caption" color="text.secondary">
                              {getMimeSummaryLabel(file)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatBytes(file.size)}
                            </Typography>
                            {activeSection?.label && (
                              <Typography variant="caption" color="text.secondary">
                                Fra {activeSection.label.toLowerCase()}
                              </Typography>
                            )}
                            {file.modifiedTime && (
                              <Typography variant="caption" color="text.secondary">
                                Oppdatert {new Date(file.modifiedTime).toLocaleDateString('nb-NO')}
                              </Typography>
                            )}
                          </Box>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            ) : (
              <Box sx={{ minHeight: 380, display: 'grid', placeItems: 'center', px: 3, textAlign: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Ingen filer funnet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Prov et annet sok eller bytt til en annen kundemappe.
                  </Typography>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2.2, py: 1.5, borderTop: '1px solid rgba(226,232,240,0.8)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {selectedIds.size > 0
              ? `${selectedIds.size} valgt`
              : onlyImages
                ? 'Velg ett eller flere bilder'
                : 'Velg filer som skal legges i meldingen'}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button onClick={handleClose} color="inherit" disabled={submitting}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              onClick={handleSelectCurrent}
              disabled={selectedIds.size === 0 || submitting}
              sx={{
                borderRadius: 999,
                px: 2.2,
                bgcolor: '#2563eb',
                '&:hover': {
                  bgcolor: '#1d4ed8',
                },
              }}
            >
              {submitting ? 'Legger til...' : 'Legg til i melding'}
            </Button>
          </Box>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
