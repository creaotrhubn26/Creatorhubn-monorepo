// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined,
  DeleteOutline,
  DownloadOutlined,
  FolderOutlined,
  InfoOutlined,
  LaunchOutlined,
  RefreshOutlined,
  SendOutlined,
  ShareOutlined,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { apiRequest } from '@/lib/queryClient';
import type { RoleRoomGoogleProjectBinding } from '../../models/casting';
import {
  googleWorkspaceApi,
  type RoleRoomGoogleCalendarEventSummary,
  type RoleRoomGoogleCalendarShareRule,
  type RoleRoomGoogleCalendarSummary,
} from '../../services/castingApiService';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

type DrivePermissionRecord = {
  id: string;
  type: string;
  emailAddress?: string | null;
  domain?: string | null;
  role: string;
  label?: string;
};

type DriveFileRecord = {
  id: string;
  name: string;
  mimeType: string;
  description?: string | null;
  isFolder?: boolean;
  size: number | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  owner?: {
    displayName: string;
    emailAddress?: string | null;
  } | null;
  permissions?: DrivePermissionRecord[];
};

type DriveFileDetailsResponse = {
  file: DriveFileRecord;
};

type DriveActivityRecord = {
  id: string;
  action: string;
  actors: string[];
  targets: string[];
  timestamp: string | null;
};

type GoogleChatSpace = {
  name: string;
  displayName?: string;
  spaceType?: string;
  spaceUri?: string | null;
  spaceDetails?: {
    description?: string;
  } | null;
};

type GoogleChatMessage = {
  id: string;
  senderId?: string;
  content: string;
  timestamp?: string | null;
  sender?: {
    displayName?: string;
    name?: string;
  } | null;
};

interface RoleRoomGoogleCollaborationWorkspaceProps {
  projectId: string;
  projectName: string;
  binding: RoleRoomGoogleProjectBinding | null;
  connected: boolean;
  canManageGoogleWorkspace: boolean;
  onRefreshStatus?: () => Promise<void>;
}

const panelSx = {
  p: 1.15,
  borderRadius: 1.75,
  border: '1px solid rgba(148,163,184,0.16)',
  bgcolor: 'rgba(15,23,42,0.54)',
};

const formatDateTime = (t: TFn, value?: string | null): string => {
  if (!value) {
    return t('googleCollab.s024');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

const formatFileSize = (t: TFn, value: number | null): string => {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return t('googleCollab.s076');
  }
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const buildApiHref = (path: string): string => {
  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  return isDevelopment || !apiBaseUrl ? path : `${apiBaseUrl}${path}`;
};

export default function RoleRoomGoogleCollaborationWorkspace({
  projectId,
  projectName,
  binding,
  connected,
  canManageGoogleWorkspace,
  onRefreshStatus,
}: RoleRoomGoogleCollaborationWorkspaceProps) {
  const { t } = useT();
  const { enqueueSnackbar } = useSnackbar();
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileRecord[]>([]);
  const [selectedDriveFileId, setSelectedDriveFileId] = useState<string | null>(null);
  const [selectedDriveFile, setSelectedDriveFile] = useState<DriveFileRecord | null>(null);
  const [driveActivity, setDriveActivity] = useState<DriveActivityRecord[]>([]);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveShareMode, setDriveShareMode] = useState<'link' | 'recipient' | 'domain'>('link');
  const [driveShareRole, setDriveShareRole] = useState<'reader' | 'commenter' | 'writer'>('reader');
  const [driveShareTarget, setDriveShareTarget] = useState('');
  const [driveNameDraft, setDriveNameDraft] = useState('');
  const [driveDescriptionDraft, setDriveDescriptionDraft] = useState('');
  const [driveBusyKey, setDriveBusyKey] = useState<string | null>(null);

  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [availableCalendars, setAvailableCalendars] = useState<RoleRoomGoogleCalendarSummary[]>([]);
  const [projectCalendar, setProjectCalendar] = useState<RoleRoomGoogleCalendarSummary | null>(null);
  const [calendarShares, setCalendarShares] = useState<RoleRoomGoogleCalendarShareRule[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<RoleRoomGoogleCalendarEventSummary[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarShareMode, setCalendarShareMode] = useState<'user' | 'domain'>('user');
  const [calendarShareRole, setCalendarShareRole] = useState<'reader' | 'writer'>('reader');
  const [calendarShareTarget, setCalendarShareTarget] = useState('');
  const [calendarBusyKey, setCalendarBusyKey] = useState<string | null>(null);

  const [loadingChat, setLoadingChat] = useState(false);
  const [chatSpaces, setChatSpaces] = useState<GoogleChatSpace[]>([]);
  const [selectedChatSpace, setSelectedChatSpace] = useState('');
  const [chatMessages, setChatMessages] = useState<GoogleChatMessage[]>([]);
  const [chatMessageDraft, setChatMessageDraft] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatBusyKey, setChatBusyKey] = useState<string | null>(null);

  const driveRootFolderId = binding?.driveRootFolderId || null;
  const calendarId = binding?.calendarId || null;

  const loadDriveFiles = useCallback(async () => {
    if (!connected || !driveRootFolderId) {
      setDriveFiles([]);
      return;
    }
    setLoadingDrive(true);
    setDriveError(null);
    try {
      const response = await apiRequest<{ files: DriveFileRecord[] }>(
        `/api/google/drive/files?folderId=${encodeURIComponent(driveRootFolderId)}&pageSize=24`,
      );
      setDriveFiles(Array.isArray(response.files) ? response.files : []);
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : t('googleCollab.s041'));
    } finally {
      setLoadingDrive(false);
    }
  }, [connected, driveRootFolderId]);

  const loadSelectedDriveFile = useCallback(async (fileId: string) => {
    setDriveBusyKey(`drive-details:${fileId}`);
    setDriveError(null);
    try {
      const [detailsResponse, activityResponse] = await Promise.all([
        apiRequest<DriveFileDetailsResponse>(`/api/google/drive/files/${encodeURIComponent(fileId)}/details`),
        apiRequest<{ activities: DriveActivityRecord[] }>(`/api/google/drive/files/${encodeURIComponent(fileId)}/activity?pageSize=12`),
      ]);
      setSelectedDriveFile(detailsResponse.file);
      setDriveActivity(Array.isArray(activityResponse.activities) ? activityResponse.activities : []);
      setDriveNameDraft(detailsResponse.file.name || '');
      setDriveDescriptionDraft(detailsResponse.file.description || '');
      setSelectedDriveFileId(fileId);
    } catch (error) {
      setDriveError(error instanceof Error ? error.message : t('googleCollab.s037'));
    } finally {
      setDriveBusyKey(null);
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    if (!connected) {
      setAvailableCalendars([]);
      setProjectCalendar(null);
      setCalendarShares([]);
      setCalendarEvents([]);
      return;
    }
    setLoadingCalendars(true);
    setCalendarError(null);
    try {
      const [calendarsResponse, projectCalendarResponse] = await Promise.all([
        googleWorkspaceApi.listCalendars(projectId),
        googleWorkspaceApi.getProjectCalendar(projectId, calendarId || undefined),
      ]);
      setAvailableCalendars(calendarsResponse.calendars || []);
      setProjectCalendar(projectCalendarResponse.calendar || null);
      setCalendarShares(projectCalendarResponse.shares || []);
      setCalendarEvents(projectCalendarResponse.events || []);
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : t('googleCollab.s040'));
    } finally {
      setLoadingCalendars(false);
    }
  }, [calendarId, connected, projectId]);

  const loadChat = useCallback(async () => {
    if (!connected) {
      setChatSpaces([]);
      setChatMessages([]);
      return;
    }
    setLoadingChat(true);
    setChatError(null);
    try {
      const spacesResponse = await apiRequest<{ spaces: GoogleChatSpace[] }>('/api/google/chat/spaces');
      const spaces = Array.isArray(spacesResponse.spaces) ? spacesResponse.spaces : [];
      setChatSpaces(spaces);
      if (spaces.length > 0) {
        const fallbackSpace = selectedChatSpace && spaces.some((space) => space.name === selectedChatSpace)
          ? selectedChatSpace
          : spaces[0].name;
        setSelectedChatSpace(fallbackSpace);
      } else {
        setSelectedChatSpace('');
        setChatMessages([]);
      }
    } catch (error) {
      setChatError(error instanceof Error ? error.message : t('googleCollab.s039'));
    } finally {
      setLoadingChat(false);
    }
  }, [connected, selectedChatSpace]);

  const loadChatMessages = useCallback(async (space: string) => {
    if (!space) {
      setChatMessages([]);
      return;
    }
    setChatBusyKey(`chat-messages:${space}`);
    setChatError(null);
    try {
      const response = await apiRequest<{ messages: GoogleChatMessage[] }>(`/api/google/chat/messages?space=${encodeURIComponent(space)}`);
      setChatMessages(Array.isArray(response.messages) ? response.messages : []);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : t('googleCollab.s038'));
    } finally {
      setChatBusyKey(null);
    }
  }, []);

  useEffect(() => {
    void loadDriveFiles();
  }, [loadDriveFiles]);

  useEffect(() => {
    if (!selectedDriveFileId) {
      setSelectedDriveFile(null);
      setDriveActivity([]);
      return;
    }
    void loadSelectedDriveFile(selectedDriveFileId);
  }, [loadSelectedDriveFile, selectedDriveFileId]);

  useEffect(() => {
    void loadCalendars();
  }, [loadCalendars]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  useEffect(() => {
    if (!selectedChatSpace) {
      setChatMessages([]);
      return;
    }
    void loadChatMessages(selectedChatSpace);
  }, [loadChatMessages, selectedChatSpace]);

  const selectedSpaceRecord = useMemo(
    () => chatSpaces.find((space) => space.name === selectedChatSpace) ?? null,
    [chatSpaces, selectedChatSpace],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadDriveFiles(),
      loadCalendars(),
      loadChat(),
      onRefreshStatus?.(),
    ]);
  }, [loadCalendars, loadChat, loadDriveFiles, onRefreshStatus]);

  const handleDriveShare = useCallback(async () => {
    if (!selectedDriveFileId) {
      return;
    }
    if (driveShareMode !== 'link' && !driveShareTarget.trim()) {
      return;
    }
    setDriveBusyKey('drive-share');
    setDriveError(null);
    try {
      await apiRequest(`/api/google/drive/files/${encodeURIComponent(selectedDriveFileId)}/share`, {
        method: 'POST',
        body: {
          shareMode: driveShareMode,
          role: driveShareRole,
          ensureAccessible: true,
          recipientEmail: driveShareMode === 'recipient' ? driveShareTarget.trim() : undefined,
          domain: driveShareMode === 'domain' ? driveShareTarget.trim() : undefined,
        },
      });
      enqueueSnackbar(t('googleCollab.s008'), { variant: 'success' });
      setDriveShareTarget('');
      await loadSelectedDriveFile(selectedDriveFileId);
      await loadDriveFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s042');
      setDriveError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setDriveBusyKey(null);
    }
  }, [driveShareMode, driveShareRole, driveShareTarget, enqueueSnackbar, loadDriveFiles, loadSelectedDriveFile, selectedDriveFileId]);

  const handleDrivePermissionDelete = useCallback(async (permissionId: string) => {
    if (!selectedDriveFileId) {
      return;
    }
    setDriveBusyKey(`drive-permission:${permissionId}`);
    setDriveError(null);
    try {
      await apiRequest(`/api/google/drive/files/${encodeURIComponent(selectedDriveFileId)}/permissions/${encodeURIComponent(permissionId)}`, {
        method: 'DELETE',
      });
      enqueueSnackbar(t('googleCollab.s011'), { variant: 'success' });
      await loadSelectedDriveFile(selectedDriveFileId);
      await loadDriveFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s035');
      setDriveError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setDriveBusyKey(null);
    }
  }, [enqueueSnackbar, loadDriveFiles, loadSelectedDriveFile, selectedDriveFileId]);

  const handleDriveMetadataSave = useCallback(async () => {
    if (!selectedDriveFileId || !driveNameDraft.trim()) {
      return;
    }
    setDriveBusyKey('drive-update');
    setDriveError(null);
    try {
      await apiRequest(`/api/google/drive/files/${encodeURIComponent(selectedDriveFileId)}`, {
        method: 'PATCH',
        body: {
          name: driveNameDraft.trim(),
          description: driveDescriptionDraft.trim(),
        },
      });
      enqueueSnackbar(t('googleCollab.s010'), { variant: 'success' });
      await loadSelectedDriveFile(selectedDriveFileId);
      await loadDriveFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s043');
      setDriveError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setDriveBusyKey(null);
    }
  }, [driveDescriptionDraft, driveNameDraft, enqueueSnackbar, loadDriveFiles, loadSelectedDriveFile, selectedDriveFileId]);

  const handleDriveDelete = useCallback(async (fileId: string) => {
    if (!window.confirm(t('googleCollab.s077'))) {
      return;
    }
    setDriveBusyKey(`drive-delete:${fileId}`);
    setDriveError(null);
    try {
      await apiRequest(`/api/google/drive/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
      });
      enqueueSnackbar(t('googleCollab.s009'), { variant: 'success' });
      if (selectedDriveFileId === fileId) {
        setSelectedDriveFileId(null);
      }
      await loadDriveFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s046');
      setDriveError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setDriveBusyKey(null);
    }
  }, [enqueueSnackbar, loadDriveFiles, selectedDriveFileId]);

  const handleCalendarShare = useCallback(async () => {
    if (!calendarShareTarget.trim()) {
      return;
    }
    setCalendarBusyKey('calendar-share');
    setCalendarError(null);
    try {
      await googleWorkspaceApi.shareProjectCalendar(projectId, {
        scopeType: calendarShareMode,
        role: calendarShareRole,
        email: calendarShareMode === 'user' ? calendarShareTarget.trim() : undefined,
        domain: calendarShareMode === 'domain' ? calendarShareTarget.trim() : undefined,
        calendarId: calendarId || undefined,
      });
      enqueueSnackbar(t('googleCollab.s067'), { variant: 'success' });
      setCalendarShareTarget('');
      await loadCalendars();
      await onRefreshStatus?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s034');
      setCalendarError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setCalendarBusyKey(null);
    }
  }, [calendarId, calendarShareMode, calendarShareRole, calendarShareTarget, enqueueSnackbar, loadCalendars, onRefreshStatus, projectId]);

  const handleCalendarShareDelete = useCallback(async (ruleId: string) => {
    setCalendarBusyKey(`calendar-delete:${ruleId}`);
    setCalendarError(null);
    try {
      await googleWorkspaceApi.removeProjectCalendarShare(projectId, ruleId, calendarId || undefined);
      enqueueSnackbar(t('googleCollab.s032'), { variant: 'success' });
      await loadCalendars();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s036');
      setCalendarError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setCalendarBusyKey(null);
    }
  }, [calendarId, enqueueSnackbar, loadCalendars, projectId]);

  const handleCreateChatSpace = useCallback(async () => {
    setChatBusyKey('chat-create-space');
    setChatError(null);
    try {
      const response = await apiRequest<{ space?: GoogleChatSpace }>('/api/google/chat/create-space', {
        method: 'POST',
        body: {
          displayName: `Role Room · ${projectName}`,
          description: t('googleCollab.p00', { v0: projectName }),
          threaded: true,
        },
      });
      enqueueSnackbar(t('googleCollab.s023'), { variant: 'success' });
      await loadChat();
      if (response.space?.name) {
        setSelectedChatSpace(response.space.name);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s044');
      setChatError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setChatBusyKey(null);
    }
  }, [enqueueSnackbar, loadChat, projectName]);

  const handleSendChatMessage = useCallback(async () => {
    if (!selectedChatSpace || !chatMessageDraft.trim()) {
      return;
    }
    setChatBusyKey('chat-send');
    setChatError(null);
    try {
      await apiRequest('/api/google/chat/send', {
        method: 'POST',
        body: {
          space: selectedChatSpace,
          message: chatMessageDraft.trim(),
        },
      });
      enqueueSnackbar(t('googleCollab.s019'), { variant: 'success' });
      setChatMessageDraft('');
      await loadChatMessages(selectedChatSpace);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s045');
      setChatError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setChatBusyKey(null);
    }
  }, [chatMessageDraft, enqueueSnackbar, loadChatMessages, selectedChatSpace]);

  const handleDeleteChatMessage = useCallback(async (messageId: string) => {
    if (!window.confirm(t('googleCollab.s078'))) {
      return;
    }
    setChatBusyKey(`chat-delete:${messageId}`);
    setChatError(null);
    try {
      await apiRequest(`/api/google/chat/messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE',
      });
      enqueueSnackbar(t('googleCollab.s020'), { variant: 'success' });
      if (selectedChatSpace) {
        await loadChatMessages(selectedChatSpace);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t('googleCollab.s047');
      setChatError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setChatBusyKey(null);
    }
  }, [enqueueSnackbar, loadChatMessages, selectedChatSpace]);

  return (
    <Stack spacing={1.1}>
      <Box sx={panelSx}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                {t('googleCollab.s063')}
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                {t('googleCollab.s052')}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { void loadDriveFiles(); }} aria-label={t('googleCollab.s058')} sx={{ color: '#cbd5e1' }}>
              <RefreshOutlined fontSize="small" />
            </IconButton>
          </Stack>

          {driveError ? <Alert severity="error">{driveError}</Alert> : null}
          {!connected ? (
            <Alert severity="info">{t('googleCollab.s064')}</Alert>
          ) : !driveRootFolderId ? (
            <Alert severity="warning">{t('googleCollab.s065')}</Alert>
          ) : loadingDrive ? (
            <CircularProgress size={22} />
          ) : (
            <Stack spacing={0.75}>
              {driveFiles.length > 0 ? driveFiles.map((file) => (
                <Box
                  key={file.id}
                  sx={{
                    p: 0.95,
                    borderRadius: 1.25,
                    border: selectedDriveFileId === file.id
                      ? '1px solid rgba(96,165,250,0.48)'
                      : '1px solid rgba(148,163,184,0.12)',
                    bgcolor: selectedDriveFileId === file.id ? 'rgba(30,41,59,0.92)' : 'rgba(2,6,23,0.48)',
                  }}
                >
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.8} justifyContent="space-between">
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 0.35 }}>
                        <FolderOutlined sx={{ color: file.isFolder ? '#93c5fd' : '#f8fafc', fontSize: 18 }} />
                        <Typography sx={{ color: '#fff', fontWeight: 700 }} noWrap>
                          {file.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={file.isFolder ? t('googleCollab.s054') : formatFileSize(t, file.size)}
                          sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                        />
                      </Stack>
                      <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                        {file.owner?.displayName || t('googleCollab.s075')} {t('googleCollab.s079')} {formatDateTime(t, file.modifiedTime)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.35} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="text" onClick={() => setSelectedDriveFileId(file.id)}>
                        {t('googleCollab.s005')}
                      </Button>
                      {file.webViewLink ? (
                        <IconButton size="small" component="a" href={file.webViewLink} target="_blank" rel="noreferrer" aria-label={t('googleCollab.s081')} sx={{ color: '#cbd5e1' }}>
                          <LaunchOutlined fontSize="small" />
                        </IconButton>
                      ) : null}
                      <IconButton
                        size="small"
                        onClick={() => window.open(buildApiHref(`/api/google/drive/files/${encodeURIComponent(file.id)}/download`), '_blank', 'noopener,noreferrer')}
                        aria-label={t('googleCollab.s049')}
                        sx={{ color: '#cbd5e1' }}
                      >
                        <DownloadOutlined fontSize="small" />
                      </IconButton>
                      {canManageGoogleWorkspace ? (
                        <IconButton size="small" onClick={() => handleDriveDelete(file.id)} aria-label={t('googleCollab.s071')} sx={{ color: '#fca5a5' }}>
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              )) : (
                <Alert severity="info">{t('googleCollab.s026')}</Alert>
              )}
            </Stack>
          )}

          {selectedDriveFile ? (
            <>
              <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
              <Stack spacing={1}>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  {t('googleCollab.s013')}
                </Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                  <TextField
                    fullWidth
                    size="small"
                    label={t('googleCollab.s014')}
                    value={driveNameDraft}
                    onChange={(event) => setDriveNameDraft(event.target.value)}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label={t('googleCollab.s000')}
                    value={driveDescriptionDraft}
                    onChange={(event) => setDriveDescriptionDraft(event.target.value)}
                  />
                </Stack>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<InfoOutlined />}
                    onClick={() => { void handleDriveMetadataSave(); }}
                    disabled={driveBusyKey === 'drive-update' || !canManageGoogleWorkspace}
                  >
                    {driveBusyKey === 'drive-update' ? t('googleCollab.s048') : t('googleCollab.s061')}
                  </Button>
                  <TextField
                    select
                    size="small"
                    label={t('googleCollab.s004')}
                    value={driveShareMode}
                    onChange={(event) => setDriveShareMode(event.target.value as 'link' | 'recipient' | 'domain')}
                    sx={{ minWidth: 130 }}
                  >
                    <MenuItem value="link">{t('googleCollab.s050')}</MenuItem>
                    <MenuItem value="recipient">{t('googleCollab.s012')}</MenuItem>
                    <MenuItem value="domain">{t('googleCollab.s006')}</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label={t('googleCollab.s068')}
                    value={driveShareRole}
                    onChange={(event) => setDriveShareRole(event.target.value as 'reader' | 'commenter' | 'writer')}
                    sx={{ minWidth: 130 }}
                  >
                    <MenuItem value="reader">Reader</MenuItem>
                    <MenuItem value="commenter">Commenter</MenuItem>
                    <MenuItem value="writer">Writer</MenuItem>
                  </TextField>
                  {driveShareMode !== 'link' ? (
                    <TextField
                      size="small"
                      label={driveShareMode === 'recipient' ? t('googleCollab.s012') : t('googleCollab.s006')}
                      value={driveShareTarget}
                      onChange={(event) => setDriveShareTarget(event.target.value)}
                    />
                  ) : null}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ShareOutlined />}
                    onClick={() => { void handleDriveShare(); }}
                    disabled={driveBusyKey === 'drive-share' || !canManageGoogleWorkspace || (driveShareMode !== 'link' && !driveShareTarget.trim())}
                  >
                    {driveBusyKey === 'drive-share' ? t('googleCollab.s003') : t('googleCollab.s001')}
                  </Button>
                </Stack>
                <Stack spacing={0.75}>
                  {(selectedDriveFile.permissions || []).map((permission) => (
                    <Box
                      key={permission.id}
                      sx={{
                        p: 0.85,
                        borderRadius: 1.25,
                        border: '1px solid rgba(148,163,184,0.12)',
                        bgcolor: 'rgba(2,6,23,0.44)',
                      }}
                    >
                      <Stack direction="row" spacing={0.75} justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                            {permission.label || permission.emailAddress || permission.domain || permission.type}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                            {permission.role} · {permission.type}
                          </Typography>
                        </Box>
                        {canManageGoogleWorkspace ? (
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => { void handleDrivePermissionDelete(permission.id); }}
                            disabled={driveBusyKey === `drive-permission:${permission.id}`}
                          >
                            {t('googleCollab.s015')}
                          </Button>
                        ) : null}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                    {t('googleCollab.s007')}
                  </Typography>
                  {driveActivity.length > 0 ? (
                    <Stack spacing={0.75}>
                      {driveActivity.map((activity) => (
                        <Box
                          key={activity.id}
                          sx={{
                            p: 0.85,
                            borderRadius: 1.25,
                            border: '1px solid rgba(148,163,184,0.12)',
                            bgcolor: 'rgba(2,6,23,0.44)',
                          }}
                        >
                          <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                            {activity.action}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                            {(activity.actors.length > 0 ? activity.actors.join(', ') : t('googleCollab.s074'))} · {formatDateTime(t, activity.timestamp)}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem' }}>
                      {t('googleCollab.s028')}
                    </Typography>
                  )}
                </Box>
              </Stack>
            </>
          ) : null}
        </Stack>
      </Box>

      <Box sx={panelSx}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                {t('googleCollab.s030')}
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                {t('googleCollab.s051')}
              </Typography>
            </Box>
            <IconButton size="small" onClick={() => { void loadCalendars(); }} aria-label={t('googleCollab.s060')} sx={{ color: '#cbd5e1' }}>
              <RefreshOutlined fontSize="small" />
            </IconButton>
          </Stack>

          {calendarError ? <Alert severity="error">{calendarError}</Alert> : null}
          {loadingCalendars ? (
            <CircularProgress size={22} />
          ) : !connected ? (
            <Alert severity="info">{t('googleCollab.s031')}</Alert>
          ) : (
            <>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {availableCalendars.slice(0, 8).map((calendar) => (
                  <Chip
                    key={calendar.id}
                    size="small"
                    label={calendar.summary}
                    sx={{
                      bgcolor: calendar.id === calendarId ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.12)',
                      color: calendar.id === calendarId ? '#bfdbfe' : '#e2e8f0',
                    }}
                  />
                ))}
              </Stack>
              <Box sx={{ p: 0.95, borderRadius: 1.25, border: '1px solid rgba(148,163,184,0.12)', bgcolor: 'rgba(2,6,23,0.48)' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} justifyContent="space-between">
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {projectCalendar?.summary || t('googleCollab.s066')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.25 }}>
                      {projectCalendar?.description || t('googleCollab.s056')}
                    </Typography>
                  </Box>
                  {projectCalendar?.id ? (
                    <Chip size="small" icon={<CalendarMonthOutlined sx={{ fontSize: 14 }} />} label={projectCalendar.id} />
                  ) : null}
                </Stack>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                <TextField
                  select
                  size="small"
                  label={t('googleCollab.s004')}
                  value={calendarShareMode}
                  onChange={(event) => setCalendarShareMode(event.target.value as 'user' | 'domain')}
                  sx={{ minWidth: 130 }}
                >
                  <MenuItem value="user">{t('googleCollab.s012')}</MenuItem>
                  <MenuItem value="domain">{t('googleCollab.s006')}</MenuItem>
                </TextField>
                <TextField
                  select
                  size="small"
                  label={t('googleCollab.s068')}
                  value={calendarShareRole}
                  onChange={(event) => setCalendarShareRole(event.target.value as 'reader' | 'writer')}
                  sx={{ minWidth: 130 }}
                >
                  <MenuItem value="reader">Reader</MenuItem>
                  <MenuItem value="writer">Writer</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  size="small"
                  label={calendarShareMode === 'user' ? t('googleCollab.s012') : t('googleCollab.s006')}
                  value={calendarShareTarget}
                  onChange={(event) => setCalendarShareTarget(event.target.value)}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ShareOutlined />}
                  onClick={() => { void handleCalendarShare(); }}
                  disabled={calendarBusyKey === 'calendar-share' || !canManageGoogleWorkspace || !calendarShareTarget.trim()}
                >
                  {calendarBusyKey === 'calendar-share' ? t('googleCollab.s003') : t('googleCollab.s002')}
                </Button>
              </Stack>
              <Stack spacing={0.75}>
                {calendarShares.length > 0 ? calendarShares.map((share) => (
                  <Box
                    key={share.id}
                    sx={{
                      p: 0.85,
                      borderRadius: 1.25,
                      border: '1px solid rgba(148,163,184,0.12)',
                      bgcolor: 'rgba(2,6,23,0.44)',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                          {share.label}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                          {share.role} · {share.scopeType}
                        </Typography>
                      </Box>
                      {canManageGoogleWorkspace ? (
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => { void handleCalendarShareDelete(share.id); }}
                          disabled={calendarBusyKey === `calendar-delete:${share.id}`}
                        >
                          {t('googleCollab.s015')}
                        </Button>
                      ) : null}
                    </Stack>
                  </Box>
                )) : (
                  <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem' }}>
                    {t('googleCollab.s025')}
                  </Typography>
                )}
              </Stack>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.75 }}>
                  {t('googleCollab.s033')}
                </Typography>
                {calendarEvents.length > 0 ? (
                  <Stack spacing={0.75}>
                    {calendarEvents.map((event) => (
                      <Box
                        key={event.id}
                        sx={{
                          p: 0.85,
                          borderRadius: 1.25,
                          border: '1px solid rgba(148,163,184,0.12)',
                          bgcolor: 'rgba(2,6,23,0.44)',
                        }}
                      >
                        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                          {event.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.78rem' }}>
                          {formatDateTime(t, event.start)} {event.location ? `· ${event.location}` : ''}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem' }}>
                    {t('googleCollab.s029')}
                  </Typography>
                )}
              </Box>
            </>
          )}
        </Stack>
      </Box>

      <Box sx={panelSx}>
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                {t('googleCollab.s018')}
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                {t('googleCollab.s053')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.4}>
              <IconButton size="small" onClick={() => { void loadChat(); }} aria-label={t('googleCollab.s057')} sx={{ color: '#cbd5e1' }}>
                <RefreshOutlined fontSize="small" />
              </IconButton>
              {canManageGoogleWorkspace ? (
                <IconButton size="small" onClick={() => { void handleCreateChatSpace(); }} aria-label={t('googleCollab.s062')} sx={{ color: '#cbd5e1' }}>
                  <SendOutlined fontSize="small" />
                </IconButton>
              ) : null}
            </Stack>
          </Stack>

          {chatError ? <Alert severity="error">{chatError}</Alert> : null}
          {loadingChat ? (
            <CircularProgress size={22} />
          ) : !connected ? (
            <Alert severity="info">{t('googleCollab.s016')}</Alert>
          ) : (
            <>
              <TextField
                select
                size="small"
                fullWidth
                label={t('googleCollab.s021')}
                value={selectedChatSpace}
                onChange={(event) => setSelectedChatSpace(event.target.value)}
              >
                {chatSpaces.map((space) => (
                  <MenuItem key={space.name} value={space.name}>
                    {space.displayName || space.name}
                  </MenuItem>
                ))}
              </TextField>
              {selectedSpaceRecord ? (
                <Stack direction="row" spacing={0.75} alignItems="center" justifyContent="space-between">
                  <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                    {selectedSpaceRecord.spaceDetails?.description || t('googleCollab.s022')}
                  </Typography>
                  {selectedSpaceRecord.spaceUri ? (
                    <IconButton size="small" component="a" href={selectedSpaceRecord.spaceUri} target="_blank" rel="noreferrer" aria-label={t('googleCollab.s080')} sx={{ color: '#cbd5e1' }}>
                      <LaunchOutlined fontSize="small" />
                    </IconButton>
                  ) : null}
                </Stack>
              ) : null}
              <Stack spacing={0.75}>
                {chatMessages.length > 0 ? chatMessages.map((message) => (
                  <Box
                    key={message.id}
                    sx={{
                      p: 0.85,
                      borderRadius: 1.25,
                      border: '1px solid rgba(148,163,184,0.12)',
                      bgcolor: 'rgba(2,6,23,0.44)',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.84rem' }}>
                          {message.sender?.displayName || message.sender?.name || message.senderId || t('googleCollab.s017')}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.86)', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                          {message.content || t('googleCollab.s073')}
                        </Typography>
                        <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.76rem', mt: 0.3 }}>
                          {formatDateTime(t, message.timestamp)}
                        </Typography>
                      </Box>
                      {canManageGoogleWorkspace ? (
                        <IconButton
                          size="small"
                          onClick={() => { void handleDeleteChatMessage(message.id); }}
                          disabled={chatBusyKey === `chat-delete:${message.id}`}
                          aria-label={t('googleCollab.s072')}
                          sx={{ color: '#fca5a5' }}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      ) : null}
                    </Stack>
                  </Box>
                )) : (
                  <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem' }}>
                    {t('googleCollab.s027')}
                  </Typography>
                )}
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                <TextField
                  fullWidth
                  size="small"
                  label={t('googleCollab.s055')}
                  value={chatMessageDraft}
                  onChange={(event) => setChatMessageDraft(event.target.value)}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<SendOutlined />}
                  onClick={() => { void handleSendChatMessage(); }}
                  disabled={chatBusyKey === 'chat-send' || !chatMessageDraft.trim()}
                >
                  {chatBusyKey === 'chat-send' ? t('googleCollab.s070') : t('googleCollab.s069')}
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </Box>

      <Button variant="text" size="small" onClick={() => { void refreshAll(); }} startIcon={<RefreshOutlined />}>
        {t('googleCollab.s059')}
      </Button>
    </Stack>
  );
}
