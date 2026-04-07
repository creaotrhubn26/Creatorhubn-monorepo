import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, alpha, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, Grid2, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, TextField, Typography, useTheme } from '@mui/material';
import { AddPhotoAlternate, CloudUpload, OpenInNew, PlaylistPlay, Refresh, Save, VideoLibrary, YouTube as YouTubeIcon } from '@mui/icons-material';
import { apiRequest, getAuthHeader, queryClient } from '@/lib/queryClient';
import { normalizeRequestUrl } from '@/lib/normalizeRequestUrl';
import { useAuth } from '@/hooks/useAuth';
import RoleRoomBrandMark from '../role-room/components/shared/RoleRoomBrandMark';

export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  status: 'private' | 'unlisted' | 'public';
  viewCount: number;
  likeCount: number;
  publishedAt: string | null;
  duration?: string | null;
  url: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  status: 'private' | 'unlisted' | 'public';
  url: string;
}

type ProjectOption = {
  id: string;
  title?: string;
  name?: string;
  clientName?: string;
};

export interface YouTubePublishingSuggestion {
  sourceLabel?: string;
  summary?: string;
  title?: string;
  description?: string;
  tags?: string[];
  playlistTitle?: string;
  chips?: string[];
  nextSteps?: string[];
}

interface YouTubeIntegrationProps {
  projectId?: string | null;
  userId?: string | null;
  projects?: ProjectOption[];
  selectedProjectId?: string | null;
  onProjectChange?: (projectId: string | null) => void;
  onVideoUploaded?: (video: YouTubeVideo) => void;
  onPlaylistCreated?: (playlist: YouTubePlaylist) => void;
  compact?: boolean;
  createShowcaseOnUpload?: boolean;
  brandVariant?: 'creatorhub' | 'role-room';
  publishingSuggestion?: YouTubePublishingSuggestion | null;
}

type UploadFormState = {
  title: string;
  description: string;
  tagsText: string;
  status: 'private' | 'unlisted' | 'public';
  categoryId: string;
  playlistId: string;
  file: File | null;
};

type EditFormState = {
  title: string;
  description: string;
  tagsText: string;
  status: 'private' | 'unlisted' | 'public';
  categoryId: string;
  playlistId: string;
};

const YOUTUBE_CATEGORIES = [
  { value: '1', label: 'Film & Animation' },
  { value: '2', label: 'Autos & Vehicles' },
  { value: '10', label: 'Music' },
  { value: '15', label: 'Pets & Animals' },
  { value: '17', label: 'Sports' },
  { value: '19', label: 'Travel & Events' },
  { value: '20', label: 'Gaming' },
  { value: '22', label: 'People & Blogs' },
  { value: '23', label: 'Comedy' },
  { value: '24', label: 'Entertainment' },
  { value: '25', label: 'News & Politics' },
  { value: '26', label: 'Howto & Style' },
  { value: '27', label: 'Education' },
  { value: '28', label: 'Science & Technology' },
] as const;

function buildApiUrl(path: string) {
  const normalizedUrl = normalizeRequestUrl(path);
  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (normalizedUrl.startsWith('http')) {
    return normalizedUrl;
  }

  return isDevelopment || !apiBaseUrl ? normalizedUrl : `${apiBaseUrl}${normalizedUrl}`;
}

function defaultUploadForm(projectLabel?: string | null): UploadFormState {
  return {
    title: projectLabel ? `${projectLabel} | Ny publisering` : '',
    description: '',
    tagsText: '',
    status: 'private',
    categoryId: '22',
    playlistId: '',
    file: null,
  };
}

function tagsToArray(tagsText: string) {
  return tagsText
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupeSuggestionTags(values: string[] | undefined) {
  const deduped = new Set<string>();
  const tags: string[] = [];
  for (const value of values ?? []) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLocaleLowerCase('no-NO');
    if (deduped.has(key)) {
      continue;
    }
    deduped.add(key);
    tags.push(normalized);
    if (tags.length >= 10) {
      break;
    }
  }
  return tags;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('no-NO', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatPublishedAt(value: string | null | undefined) {
  if (!value) {
    return 'Ikke publisert enda';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Ikke publisert enda';
  }

  return date.toLocaleDateString('no-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function readStoredCreatorHubUserId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedUserRaw = window.localStorage.getItem('creatorhub_auth_user');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) as Record<string, unknown> : null;
    return (
      (typeof storedUser?.id === 'string' && storedUser.id.trim() ? storedUser.id.trim() : null)
      || (typeof storedUser?.userId === 'string' && storedUser.userId.trim() ? storedUser.userId.trim() : null)
      || (window.localStorage.getItem('userId')?.trim() || null)
    );
  } catch {
    return null;
  }
}

function hasStoredCreatorHubToken(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return Boolean(
      window.localStorage.getItem('creatorhub_auth_token')?.trim()
      || window.localStorage.getItem('token')?.trim(),
    );
  } catch {
    return false;
  }
}

export const YouTubeIntegration: React.FC<YouTubeIntegrationProps> = ({
  projectId,
  userId: userIdProp,
  projects,
  selectedProjectId,
  onProjectChange,
  onVideoUploaded,
  onPlaylistCreated,
  compact = false,
  createShowcaseOnUpload = true,
  brandVariant = 'creatorhub',
  publishingSuggestion = null,
}) => {
  const theme = useTheme();
  const { user } = useAuth();
  const [storedUserId, setStoredUserId] = React.useState<string | null>(() => readStoredCreatorHubUserId());
  const [hasSessionToken, setHasSessionToken] = React.useState<boolean>(() => hasStoredCreatorHubToken());
  const resolvedUserId = userIdProp || user?.id || storedUserId || null;
  const effectiveProjectId = selectedProjectId ?? projectId ?? null;
  const projectOptions = projects ?? [];

  React.useEffect(() => {
    const syncStoredAuth = () => {
      setStoredUserId(readStoredCreatorHubUserId());
      setHasSessionToken(hasStoredCreatorHubToken());
    };

    syncStoredAuth();
    window.addEventListener('auth-changed', syncStoredAuth);
    window.addEventListener('storage', syncStoredAuth);
    return () => {
      window.removeEventListener('auth-changed', syncStoredAuth);
      window.removeEventListener('storage', syncStoredAuth);
    };
  }, []);

  const selectedProject = useMemo(
    () => projectOptions.find((entry) => entry.id === effectiveProjectId) ?? null,
    [projectOptions, effectiveProjectId],
  );

  const selectedProjectLabel = selectedProject?.title || selectedProject?.name || null;
  const isRoleRoomVariant = brandVariant === 'role-room';
  const workspaceLabel = isRoleRoomVariant ? 'The Role Room' : 'CreatorHub';

  const brandStyles = useMemo(() => {
    if (isRoleRoomVariant) {
      return {
        heroBackground: `linear-gradient(135deg, ${alpha('#0f172a', 0.96)} 0%, ${alpha('#111c3a', 0.94)} 48%, ${alpha('#1e1b4b', 0.9)} 100%)`,
        heroBorder: 'rgba(56,189,248,0.28)',
        heroInset: 'inset 0 1px 0 rgba(186,230,253,0.08)',
        sectionBackground: `linear-gradient(180deg, ${alpha('#0b1120', 0.92)} 0%, ${alpha('#111827', 0.9)} 100%)`,
        sectionBorder: 'rgba(56,189,248,0.22)',
        iconBackground: 'linear-gradient(135deg, rgba(8,15,31,0.92) 0%, rgba(30,41,59,0.92) 100%)',
        iconColor: '#ff4d4f',
        iconBorder: 'rgba(125,211,252,0.45)',
        primaryText: 'rgba(241,245,249,0.98)',
        secondaryText: 'rgba(186,230,253,0.78)',
        tertiaryText: 'rgba(148,163,184,0.9)',
        chipBorder: 'rgba(125,211,252,0.28)',
        chipBackground: 'rgba(15,23,42,0.56)',
        chipText: 'rgba(224,242,254,0.94)',
      };
    }

    return {
      heroBackground: `linear-gradient(180deg, ${alpha(theme.palette.error.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
      heroBorder: alpha(theme.palette.divider, 0.8),
      heroInset: 'none',
      sectionBackground: theme.palette.background.paper,
      sectionBorder: alpha(theme.palette.divider, 0.8),
      iconBackground: alpha('#ff0000', 0.1),
      iconColor: '#ff0000',
      iconBorder: 'transparent',
      primaryText: theme.palette.text.primary,
      secondaryText: theme.palette.text.secondary,
      tertiaryText: theme.palette.text.secondary,
      chipBorder: alpha(theme.palette.divider, 0.8),
      chipBackground: 'transparent',
      chipText: theme.palette.text.primary,
    };
  }, [isRoleRoomVariant, theme.palette.background.paper, theme.palette.divider, theme.palette.error.main, theme.palette.text.primary, theme.palette.text.secondary]);

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(() => defaultUploadForm(selectedProjectLabel));
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [playlistForm, setPlaylistForm] = useState({
    title: selectedProjectLabel ? `${selectedProjectLabel} | YouTube playlist` : '',
    description: '',
    status: 'private' as 'private' | 'unlisted' | 'public',
  });
  const [editingVideo, setEditingVideo] = useState<YouTubeVideo | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    title: '',
    description: '',
    tagsText: '',
    status: 'private',
    categoryId: '22',
    playlistId: '',
  });

  const suggestionTags = useMemo(
    () => dedupeSuggestionTags(publishingSuggestion?.tags),
    [publishingSuggestion?.tags],
  );
  const suggestionChips = useMemo(
    () => dedupeSuggestionTags(publishingSuggestion?.chips),
    [publishingSuggestion?.chips],
  );

  React.useEffect(() => {
    setUploadForm((current) => {
      if (current.file || current.title.trim().length > 0) {
        return current;
      }
      return defaultUploadForm(selectedProjectLabel);
    });

    setPlaylistForm((current) => {
      if (current.title.trim().length > 0) {
        return current;
      }
      return {
        ...current,
        title: selectedProjectLabel ? `${selectedProjectLabel} | YouTube playlist` : '',
      };
    });
  }, [selectedProjectLabel]);

  const applyPublishingSuggestion = React.useCallback(() => {
    if (!publishingSuggestion) {
      return;
    }

    setUploadForm((current) => ({
      ...current,
      title: publishingSuggestion.title?.trim() || current.title,
      description: publishingSuggestion.description?.trim() || current.description,
      tagsText: suggestionTags.length > 0 ? suggestionTags.join(', ') : current.tagsText,
    }));

    setPlaylistForm((current) => ({
      ...current,
      title: publishingSuggestion.playlistTitle?.trim() || current.title,
      description: publishingSuggestion.summary?.trim() || current.description,
    }));
  }, [publishingSuggestion, suggestionTags]);

  const statusQuery = useQuery({
    queryKey: ['/api/youtube/status', { userId: resolvedUserId }],
    queryFn: () => apiRequest('/api/youtube/status', {
      method: 'GET',
      headers: resolvedUserId ? { 'x-user-id': resolvedUserId } : {},
    }),
    enabled: Boolean(resolvedUserId || hasSessionToken),
  });

  const statusData = statusQuery.data as {
    connected?: boolean;
    configured?: boolean;
    needsReconnect?: boolean;
    channelTitle?: string | null;
    missingScopes?: string[];
  } | undefined;
  const youtubeConnected = Boolean(statusData?.connected);
  const missingScopes = statusData?.missingScopes ?? [];
  const youtubeNeedsReconnect = Boolean(statusData?.needsReconnect);
  const needsYouTubeChannelSetup = Boolean(
    resolvedUserId
    && statusData?.configured
    && !youtubeConnected
    && !youtubeNeedsReconnect
    && missingScopes.length === 0,
  );
  const connectionSummaryLabel = youtubeConnected
    ? statusData?.channelTitle || 'Connected'
    : youtubeNeedsReconnect
      ? 'Reconnect required'
      : needsYouTubeChannelSetup
        ? 'Channel setup required'
        : 'Not connected';

  const videosQuery = useQuery({
    queryKey: ['/api/youtube/videos', { userId: resolvedUserId, projectId: effectiveProjectId }],
    queryFn: () => apiRequest(`/api/youtube/videos${effectiveProjectId ? `?projectId=${encodeURIComponent(effectiveProjectId)}` : ''}`, {
      method: 'GET',
      headers: resolvedUserId ? { 'x-user-id': resolvedUserId } : {},
    }),
    enabled: Boolean((resolvedUserId || hasSessionToken) && youtubeConnected),
  });

  const playlistsQuery = useQuery({
    queryKey: ['/api/youtube/playlists', { userId: resolvedUserId }],
    queryFn: () => apiRequest('/api/youtube/playlists', {
      method: 'GET',
      headers: resolvedUserId ? { 'x-user-id': resolvedUserId } : {},
    }),
    enabled: Boolean((resolvedUserId || hasSessionToken) && youtubeConnected),
  });

  const createPlaylistMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedUserId) {
        throw new Error('Mangler bruker for å opprette spilleliste.');
      }

      return apiRequest('/api/youtube/playlists', {
        method: 'POST',
        headers: { 'x-user-id': resolvedUserId },
        body: {
          ...playlistForm,
          userId: resolvedUserId,
        },
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/youtube/playlists'] });
      setPlaylistDialogOpen(false);
      setPlaylistForm({
        title: selectedProjectLabel ? `${selectedProjectLabel} | YouTube playlist` : '',
        description: '',
        status: 'private',
      });
      if (result?.playlist) {
        onPlaylistCreated?.(result.playlist as YouTubePlaylist);
      }
    },
  });

  const updateVideoMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedUserId || !editingVideo) {
        throw new Error('Mangler bruker eller video.');
      }

      return apiRequest(`/api/youtube/videos/${editingVideo.id}`, {
        method: 'PATCH',
        headers: { 'x-user-id': resolvedUserId },
        body: {
          ...editForm,
          tags: tagsToArray(editForm.tagsText),
          userId: resolvedUserId,
          projectId: effectiveProjectId,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/youtube/videos'] });
      setEditingVideo(null);
    },
  });

  const uploadThumbnailMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedUserId || !editingVideo) {
        throw new Error('Mangler bruker eller video.');
      }

      const formData = new FormData();
      formData.append('thumbnail', file);
      formData.append('userId', resolvedUserId);

      return apiRequest(`/api/youtube/videos/${editingVideo.id}/thumbnail`, {
        method: 'POST',
        headers: { 'x-user-id': resolvedUserId },
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/youtube/videos'] });
    },
  });

  const connectToGoogleWorkspace = async () => {
    if (!resolvedUserId && !hasSessionToken) {
      return;
    }

    const result = await apiRequest('/api/role-room/google/oauth/start', {
      method: 'POST',
      body: {
        mode: 'link',
        ...(resolvedUserId ? { targetConnectionUserId: resolvedUserId } : {}),
        returnPath: window.location.pathname + window.location.search,
        browserOrigin: window.location.origin,
      },
    });

    if (result?.authorizationUrl) {
      window.location.href = result.authorizationUrl;
    }
  };

  const uploadVideo = async () => {
    if (!resolvedUserId || !uploadForm.file) {
      setUploadError('Velg en videofil før publisering.');
      return;
    }

    setUploadError(null);
    setUploadProgress(0);

    const authHeaders = await getAuthHeader();
    const payload = new FormData();
    payload.append('video', uploadForm.file);
    payload.append('userId', resolvedUserId);
    payload.append('createShowcase', String(createShowcaseOnUpload));

    if (effectiveProjectId) {
      payload.append('projectId', effectiveProjectId);
    }

    payload.append('metadata', JSON.stringify({
      title: uploadForm.title,
      description: uploadForm.description,
      tags: tagsToArray(uploadForm.tagsText),
      status: uploadForm.status,
      categoryId: uploadForm.categoryId,
      playlistId: uploadForm.playlistId || undefined,
      projectId: effectiveProjectId || undefined,
      createShowcase: createShowcaseOnUpload,
    }));

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', buildApiUrl('/api/youtube/upload'));

      Object.entries(authHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.setRequestHeader('x-user-id', resolvedUserId);

      xhr.upload.addEventListener('progress', (event) => {
        if (!event.lengthComputable) {
          return;
        }
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      });

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText || '{}');
          const video = response.video as YouTubeVideo | undefined;
          if (video) {
            onVideoUploaded?.(video);
          }
          queryClient.invalidateQueries({ queryKey: ['/api/youtube/videos'] });
          setUploadForm(defaultUploadForm(selectedProjectLabel));
          setUploadProgress(0);
          resolve();
          return;
        }

        try {
          const errorPayload = JSON.parse(xhr.responseText || '{}');
          reject(new Error(errorPayload.error || 'Opplasting feilet.'));
        } catch {
          reject(new Error('Opplasting feilet.'));
        }
      };

      xhr.onerror = () => reject(new Error('Nettverksfeil under opplasting.'));
      xhr.send(payload);
    }).catch((error) => {
      setUploadProgress(0);
      setUploadError(error instanceof Error ? error.message : 'Opplasting feilet.');
      throw error;
    });
  };

  const openEditDialog = (video: YouTubeVideo) => {
    setEditingVideo(video);
    setEditForm({
      title: video.title,
      description: video.description,
      tagsText: '',
      status: video.status,
      categoryId: '22',
      playlistId: '',
    });
  };

  const videos = ((videosQuery.data as { videos?: YouTubeVideo[] } | undefined)?.videos ?? []);
  const playlists = ((playlistsQuery.data as { playlists?: YouTubePlaylist[] } | undefined)?.playlists ?? []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 2 : 3 }}>
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${brandStyles.heroBorder}`,
          background: brandStyles.heroBackground,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: brandStyles.heroInset,
        }}
      >
        <Box sx={{ p: compact ? 2.5 : 3 }}>
          <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} justifyContent="space-between">
                <Box sx={{ maxWidth: 720 }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: brandStyles.iconBackground,
                      color: brandStyles.iconColor,
                      border: `1px solid ${brandStyles.iconBorder}`,
                      boxShadow: isRoleRoomVariant ? '0 18px 42px rgba(8,15,31,0.28)' : 'none',
                    }}
                  >
                    <YouTubeIcon />
                  </Box>
                  <Box>
                    {isRoleRoomVariant && (
                      <RoleRoomBrandMark
                        appearance="badge"
                        size={20}
                        sx={{ mb: 0.9, width: 'fit-content' }}
                      />
                    )}
                    <Typography variant={compact ? 'h6' : 'h5'} sx={{ fontWeight: 700, color: brandStyles.primaryText }}>
                      Publisering
                    </Typography>
                    <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                      {isRoleRoomVariant
                        ? 'Planlegg, publiser og finjuster YouTube-innhold uten å forlate The Role Room.'
                        : 'Last opp, oppdater metadata, sett thumbnail og organiser videoer uten å forlate CreatorHub.'}
                    </Typography>
                  </Box>
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {selectedProjectLabel && (
                    <Chip
                      size="small"
                      label={`Prosjekt: ${selectedProjectLabel}`}
                      sx={{
                        border: `1px solid ${brandStyles.chipBorder}`,
                        bgcolor: brandStyles.chipBackground,
                        color: brandStyles.chipText,
                      }}
                    />
                  )}
                  {statusData?.channelTitle && (
                    <Chip
                      size="small"
                      color="success"
                      label={`Kanal: ${statusData.channelTitle}`}
                      sx={isRoleRoomVariant ? { color: brandStyles.chipText } : undefined}
                    />
                  )}
                  {statusData?.needsReconnect && (
                    <Chip
                      size="small"
                      color="warning"
                      label="Må kobles til på nytt"
                      sx={isRoleRoomVariant ? { color: brandStyles.chipText } : undefined}
                    />
                  )}
                </Stack>
                </Box>

                <Stack spacing={1.25} sx={{ width: { xs: '100%', lg: 320 } }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      border: `1px solid ${brandStyles.chipBorder}`,
                      bgcolor: brandStyles.chipBackground,
                    }}
                  >
                    <Typography variant="caption" sx={{ display: 'block', color: brandStyles.secondaryText, letterSpacing: 0.3 }}>
                      Connection state
                    </Typography>
                    <Typography variant="subtitle1" sx={{ mt: 0.35, fontWeight: 700, color: brandStyles.primaryText }}>
                      {connectionSummaryLabel}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.6, color: brandStyles.secondaryText }}>
                      {effectiveProjectId
                        ? `Koblet mot prosjektkontekst for ${selectedProjectLabel || 'valgt prosjekt'}.`
                        : 'Viser siste publiseringer på tvers av hele kanalen.'}
                    </Typography>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
                    {projectOptions.length > 0 && (
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel id="youtube-project-label">Prosjekt</InputLabel>
                        <Select
                          labelId="youtube-project-label"
                          label="Prosjekt"
                          value={effectiveProjectId ?? ''}
                          onChange={(event) => onProjectChange?.(event.target.value ? String(event.target.value) : null)}
                        >
                          <MenuItem value="">Alle publiseringer</MenuItem>
                          {projectOptions.map((project) => (
                            <MenuItem key={project.id} value={project.id}>
                              {project.title || project.name || project.id}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    <Button
                      variant="outlined"
                      startIcon={<Refresh />}
                      onClick={() => {
                        statusQuery.refetch();
                        videosQuery.refetch();
                        playlistsQuery.refetch();
                      }}
                    >
                      Oppdater
                    </Button>
                  </Stack>
                </Stack>
              </Stack>

            {!resolvedUserId && (
              <Alert severity="warning">
                Innlogging mangler. Publiseringsfanen trenger en aktiv {workspaceLabel}-bruker for å koble mot Google Workspace.
              </Alert>
            )}

            {resolvedUserId && !statusData?.connected && (
              <Alert
                severity={youtubeNeedsReconnect || needsYouTubeChannelSetup ? 'warning' : 'info'}
                action={(
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    {needsYouTubeChannelSetup ? (
                      <>
                        <Button color="inherit" size="small" href="https://www.youtube.com/create_channel" target="_blank" rel="noreferrer">
                          Opprett kanal
                        </Button>
                        <Button color="inherit" size="small" href="https://studio.youtube.com/" target="_blank" rel="noreferrer">
                          Åpne Studio
                        </Button>
                      </>
                    ) : (
                      <Button color="inherit" size="small" onClick={connectToGoogleWorkspace}>
                        {youtubeNeedsReconnect ? 'Forny Google-SSO' : 'Fortsett med Google-SSO'}
                      </Button>
                    )}
                  </Stack>
                )}
                sx={{ borderRadius: 3 }}
              >
                {youtubeNeedsReconnect
                  ? 'Google-økten er aktiv, men uten nødvendige YouTube-rettigheter. Forny Google-SSO for publisering.'
                  : needsYouTubeChannelSetup
                    ? 'Google-kontoen er koblet til riktig, men YouTube-kanalen er ikke aktivert ennå. Opprett kanalen én gang, så blir publiseringsflyten komplett.'
                    : `YouTube-publisering i ${workspaceLabel} følger samme Google-SSO som resten av plattformen.`}
              </Alert>
            )}

            {statusQuery.isFetching && <LinearProgress />}
          </Stack>
        </Box>
      </Paper>

      {resolvedUserId && statusData?.connected && (
        <Grid2 container spacing={compact ? 2 : 3}>
          <Grid2 size={{ xs: 12, lg: 5 }}>
            <Stack spacing={compact ? 2 : 3}>
              <Paper
                elevation={0}
                sx={{
                  border: `1px solid ${brandStyles.sectionBorder}`,
                  borderRadius: 4,
                  p: compact ? 2.5 : 3,
                  background: brandStyles.sectionBackground,
                }}
              >
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: brandStyles.primaryText }}>
                      Ny publisering
                    </Typography>
                    <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                      Bygg utkastet her. Opplastingen går direkte til YouTube-kanalen din med riktig prosjektkontekst.
                    </Typography>
                  </Box>

                  {publishingSuggestion && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.6,
                        borderRadius: 3,
                        border: `1px solid ${brandStyles.chipBorder}`,
                        bgcolor: brandStyles.chipBackground,
                      }}
                    >
                      <Stack spacing={1.1}>
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: 'flex-start', sm: 'center' }}
                        >
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: brandStyles.primaryText }}>
                              {publishingSuggestion.sourceLabel || 'Strategiforslag'}
                            </Typography>
                            <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                              {publishingSuggestion.summary || 'Bruk prosjektgrunnlaget til å fylle ut YouTube-utkastet raskere.'}
                            </Typography>
                          </Box>
                          <Button size="small" variant="outlined" onClick={applyPublishingSuggestion}>
                            Bruk utkastet
                          </Button>
                        </Stack>

                        {suggestionChips.length > 0 && (
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            {suggestionChips.map((chip) => (
                              <Chip
                                key={chip}
                                size="small"
                                label={chip}
                                sx={{
                                  border: `1px solid ${brandStyles.chipBorder}`,
                                  bgcolor: brandStyles.chipBackground,
                                  color: brandStyles.chipText,
                                }}
                              />
                            ))}
                          </Stack>
                        )}

                        {publishingSuggestion.nextSteps && publishingSuggestion.nextSteps.length > 0 && (
                          <Typography variant="caption" sx={{ color: brandStyles.secondaryText, lineHeight: 1.5 }}>
                            Neste steg: {publishingSuggestion.nextSteps.slice(0, 3).join(' · ')}
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  )}

                  <TextField
                    label="Tittel"
                    value={uploadForm.title}
                    onChange={(event) => setUploadForm((current) => ({ ...current, title: event.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Beskrivelse"
                    value={uploadForm.description}
                    onChange={(event) => setUploadForm((current) => ({ ...current, description: event.target.value }))}
                    fullWidth
                    multiline
                    minRows={5}
                  />
                  <TextField
                    label="Tags"
                    value={uploadForm.tagsText}
                    onChange={(event) => setUploadForm((current) => ({ ...current, tagsText: event.target.value }))}
                    helperText="Kommaseparerte tags"
                    fullWidth
                  />

                  <Grid2 container spacing={1.5}>
                    <Grid2 size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="youtube-status-label">Synlighet</InputLabel>
                        <Select
                          labelId="youtube-status-label"
                          label="Synlighet"
                          value={uploadForm.status}
                          onChange={(event) => setUploadForm((current) => ({
                            ...current,
                            status: event.target.value as UploadFormState['status'],
                          }))}
                        >
                          <MenuItem value="private">Privat</MenuItem>
                          <MenuItem value="unlisted">Skjult lenke</MenuItem>
                          <MenuItem value="public">Offentlig</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid2>
                    <Grid2 size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel id="youtube-category-label">Kategori</InputLabel>
                        <Select
                          labelId="youtube-category-label"
                          label="Kategori"
                          value={uploadForm.categoryId}
                          onChange={(event) => setUploadForm((current) => ({ ...current, categoryId: String(event.target.value) }))}
                        >
                          {YOUTUBE_CATEGORIES.map((category) => (
                            <MenuItem key={category.value} value={category.value}>
                              {category.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid2>
                  </Grid2>

                  <FormControl fullWidth>
                    <InputLabel id="youtube-playlist-select-label">Spilleliste</InputLabel>
                    <Select
                      labelId="youtube-playlist-select-label"
                      label="Spilleliste"
                      value={uploadForm.playlistId}
                      onChange={(event) => setUploadForm((current) => ({ ...current, playlistId: String(event.target.value) }))}
                    >
                      <MenuItem value="">Ingen spilleliste</MenuItem>
                      {playlists.map((playlist) => (
                        <MenuItem key={playlist.id} value={playlist.id}>
                          {playlist.title}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUpload />}
                      sx={{ justifyContent: 'flex-start' }}
                    >
                      {uploadForm.file ? 'Bytt videofil' : 'Velg videofil'}
                      <input
                        hidden
                        accept="video/*"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setUploadForm((current) => ({ ...current, file }));
                        }}
                      />
                    </Button>
                    <Button
                      variant="contained"
                      onClick={uploadVideo}
                      disabled={!uploadForm.file || uploadProgress > 0}
                      startIcon={<YouTubeIcon />}
                      sx={{
                        bgcolor: '#ff0000',
                        '&:hover': { bgcolor: '#d60000' },
                      }}
                    >
                      Publiser til YouTube
                    </Button>
                  </Stack>

                  {uploadForm.file && (
                    <Typography variant="body2" sx={{ color: brandStyles.tertiaryText }}>
                      Fil valgt: {uploadForm.file.name}
                    </Typography>
                  )}

                  {uploadProgress > 0 && (
                    <Box>
                      <LinearProgress variant="determinate" value={uploadProgress} />
                      <Typography variant="caption" color="text.secondary">
                        {uploadProgress}% lastet opp
                      </Typography>
                    </Box>
                  )}

                  {uploadError && (
                    <Alert severity="error">
                      {uploadError}
                    </Alert>
                  )}
                </Stack>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  border: `1px solid ${brandStyles.sectionBorder}`,
                  borderRadius: 4,
                  p: compact ? 2.5 : 3,
                  background: brandStyles.sectionBackground,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: brandStyles.primaryText }}>
                      Spillelister
                    </Typography>
                    <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                      Organiser publiseringene dine i tydelige serier og prosjektpakker.
                    </Typography>
                  </Box>
                  <Button startIcon={<PlaylistPlay />} onClick={() => setPlaylistDialogOpen(true)}>
                    Ny spilleliste
                  </Button>
                </Stack>

                <Stack divider={<Divider flexItem />} spacing={0}>
                  {playlists.length === 0 && (
                    <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                      Ingen spillelister ennå.
                    </Typography>
                  )}
                  {playlists.map((playlist) => (
                    <Stack key={playlist.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: brandStyles.primaryText }}>
                          {playlist.title}
                        </Typography>
                        <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                          {playlist.itemCount} videoer · {playlist.status}
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        href={playlist.url}
                        target="_blank"
                        rel="noreferrer"
                        endIcon={<OpenInNew fontSize="small" />}
                      >
                        Åpne
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Grid2>

          <Grid2 size={{ xs: 12, lg: 7 }}>
            <Paper
              elevation={0}
              sx={{
                border: `1px solid ${brandStyles.sectionBorder}`,
                borderRadius: 4,
                p: compact ? 2.5 : 3,
                background: brandStyles.sectionBackground,
              }}
            >
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, color: brandStyles.primaryText }}>
                    Video-bibliotek
                  </Typography>
                  <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                    {effectiveProjectId
                      ? 'Viser YouTube-innhold som allerede er koblet til valgt prosjekt.'
                      : 'Viser siste videoer fra den tilkoblede YouTube-kanalen.'}
                  </Typography>
                </Box>

                {videosQuery.isFetching && <LinearProgress />}

                <Stack divider={<Divider flexItem />} spacing={0}>
                  {videos.length === 0 && !videosQuery.isFetching && (
                    <Box sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                        Ingen videoer å vise ennå.
                      </Typography>
                    </Box>
                  )}

                  {videos.map((video) => (
                    <Stack
                      key={video.id}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={2}
                      sx={{ py: 2, alignItems: { xs: 'flex-start', md: 'center' } }}
                    >
                      <Box
                        sx={{
                          width: { xs: '100%', md: 220 },
                          aspectRatio: '16 / 9',
                          borderRadius: 2.5,
                          overflow: 'hidden',
                          bgcolor: alpha(theme.palette.common.black, 0.06),
                          flexShrink: 0,
                          backgroundImage: video.thumbnailUrl ? `url(${video.thumbnailUrl})` : 'none',
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {!video.thumbnailUrl && <VideoLibrary sx={{ fontSize: 36, color: isRoleRoomVariant ? brandStyles.secondaryText : 'text.secondary' }} />}
                      </Box>

                      <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: brandStyles.primaryText }}>
                            {video.title}
                          </Typography>
                          <Chip
                            size="small"
                            color={video.status === 'public' ? 'success' : video.status === 'unlisted' ? 'warning' : 'default'}
                            label={video.status}
                            sx={isRoleRoomVariant ? { color: brandStyles.chipText } : undefined}
                          />
                        </Stack>
                        <Typography variant="body2" sx={{ color: brandStyles.secondaryText }}>
                          {video.description || 'Ingen beskrivelse lagt inn ennå.'}
                        </Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" variant="outlined" label={`${formatCompactNumber(video.viewCount)} visninger`} sx={isRoleRoomVariant ? { color: brandStyles.chipText, borderColor: brandStyles.chipBorder, bgcolor: brandStyles.chipBackground } : undefined} />
                          <Chip size="small" variant="outlined" label={`${formatCompactNumber(video.likeCount)} likes`} sx={isRoleRoomVariant ? { color: brandStyles.chipText, borderColor: brandStyles.chipBorder, bgcolor: brandStyles.chipBackground } : undefined} />
                          <Chip size="small" variant="outlined" label={formatPublishedAt(video.publishedAt)} sx={isRoleRoomVariant ? { color: brandStyles.chipText, borderColor: brandStyles.chipBorder, bgcolor: brandStyles.chipBackground } : undefined} />
                        </Stack>
                      </Stack>

                      <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} alignItems={{ xs: 'center', md: 'flex-end' }}>
                        <Button size="small" variant="outlined" onClick={() => openEditDialog(video)}>
                          Rediger
                        </Button>
                        <Button
                          size="small"
                          endIcon={<OpenInNew fontSize="small" />}
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Åpne
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Grid2>
        </Grid2>
      )}

      <Dialog
        open={playlistDialogOpen}
        onClose={() => setPlaylistDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Ny YouTube-spilleliste</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tittel"
              value={playlistForm.title}
              onChange={(event) => setPlaylistForm((current) => ({ ...current, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={playlistForm.description}
              onChange={(event) => setPlaylistForm((current) => ({ ...current, description: event.target.value }))}
              fullWidth
              multiline
              minRows={4}
            />
            <FormControl fullWidth>
              <InputLabel id="youtube-playlist-status-label">Synlighet</InputLabel>
              <Select
                labelId="youtube-playlist-status-label"
                label="Synlighet"
                value={playlistForm.status}
                onChange={(event) => setPlaylistForm((current) => ({
                  ...current,
                  status: event.target.value as typeof current.status,
                }))}
              >
                <MenuItem value="private">Privat</MenuItem>
                <MenuItem value="unlisted">Skjult lenke</MenuItem>
                <MenuItem value="public">Offentlig</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlaylistDialogOpen(false)}>Avbryt</Button>
          <Button
            variant="contained"
            onClick={() => createPlaylistMutation.mutate()}
            disabled={!playlistForm.title.trim() || createPlaylistMutation.isPending}
          >
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingVideo)}
        onClose={() => setEditingVideo(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Rediger video</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Tittel"
              value={editForm.title}
              onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Beskrivelse"
              value={editForm.description}
              onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))}
              fullWidth
              multiline
              minRows={5}
            />
            <TextField
              label="Tags"
              value={editForm.tagsText}
              onChange={(event) => setEditForm((current) => ({ ...current, tagsText: event.target.value }))}
              helperText="Kommaseparerte tags"
              fullWidth
            />
            <Grid2 container spacing={1.5}>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="youtube-edit-status-label">Synlighet</InputLabel>
                  <Select
                    labelId="youtube-edit-status-label"
                    label="Synlighet"
                    value={editForm.status}
                    onChange={(event) => setEditForm((current) => ({
                      ...current,
                      status: event.target.value as EditFormState['status'],
                    }))}
                  >
                    <MenuItem value="private">Privat</MenuItem>
                    <MenuItem value="unlisted">Skjult lenke</MenuItem>
                    <MenuItem value="public">Offentlig</MenuItem>
                  </Select>
                </FormControl>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="youtube-edit-category-label">Kategori</InputLabel>
                  <Select
                    labelId="youtube-edit-category-label"
                    label="Kategori"
                    value={editForm.categoryId}
                    onChange={(event) => setEditForm((current) => ({ ...current, categoryId: String(event.target.value) }))}
                  >
                    {YOUTUBE_CATEGORIES.map((category) => (
                      <MenuItem key={category.value} value={category.value}>
                        {category.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth>
                  <InputLabel id="youtube-edit-playlist-label">Legg i spilleliste</InputLabel>
                  <Select
                    labelId="youtube-edit-playlist-label"
                    label="Legg i spilleliste"
                    value={editForm.playlistId}
                    onChange={(event) => setEditForm((current) => ({ ...current, playlistId: String(event.target.value) }))}
                  >
                    <MenuItem value="">Ingen endring</MenuItem>
                    {playlists.map((playlist) => (
                      <MenuItem key={playlist.id} value={playlist.id}>
                        {playlist.title}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid2>
            </Grid2>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button component="label" variant="outlined" startIcon={<AddPhotoAlternate />}>
                Bytt thumbnail
                <input
                  hidden
                  accept="image/*"
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      uploadThumbnailMutation.mutate(file);
                    }
                    event.currentTarget.value = '';
                  }}
                />
              </Button>
              {editingVideo?.url && (
                <Button
                  variant="text"
                  href={editingVideo.url}
                  target="_blank"
                  rel="noreferrer"
                  endIcon={<OpenInNew fontSize="small" />}
                >
                  Åpne i YouTube
                </Button>
              )}
            </Stack>

            {uploadThumbnailMutation.isPending && <LinearProgress />}
            {updateVideoMutation.isError && (
              <Alert severity="error">
                {(updateVideoMutation.error as Error).message}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingVideo(null)}>Lukk</Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={() => updateVideoMutation.mutate()}
            disabled={updateVideoMutation.isPending}
          >
            Lagre endringer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
