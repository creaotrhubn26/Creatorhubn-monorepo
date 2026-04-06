import * as React from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Link,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CalendarMonth,
  Chat,
  Contacts,
  Description,
  DriveFolderUpload,
  Email,
  PlayCircleOutline,
  Refresh,
  TaskAlt,
  VideoLibrary,
} from '@mui/icons-material';
import { creatorHubTheme } from '@/theme/creatorHubTheme';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

type ActionStatus = 'idle' | 'running' | 'success' | 'error';

type ActionKey =
  | 'refresh-overview'
  | 'load-drive-files'
  | 'upload-drive-file'
  | 'create-docs-contract'
  | 'create-meet'
  | 'load-gmail-threads'
  | 'create-gmail-draft'
  | 'search-contacts'
  | 'create-contact'
  | 'load-task-lists'
  | 'create-task'
  | 'load-chat-spaces'
  | 'create-chat-space'
  | 'load-chat-messages'
  | 'send-chat-message'
  | 'create-youtube-playlist'
  | 'upload-youtube-video'
  | 'update-youtube-video'
  | 'upload-youtube-thumbnail';

type ActionState = {
  status: ActionStatus;
  message: string;
  payload?: unknown;
};

type DemoArtifacts = {
  contractId: string | null;
  googleDocUrl: string | null;
  taskListId: string | null;
  chatSpaceName: string | null;
  youtubePlaylistId: string | null;
  youtubeVideoId: string | null;
  youtubeVideoUrl: string | null;
};

type OverviewState = {
  publicSession: unknown;
  driveStatus: unknown;
  youtubeStatus: unknown;
  workspaceStorage: unknown;
};

const ACTION_KEYS: ActionKey[] = [
  'refresh-overview',
  'load-drive-files',
  'upload-drive-file',
  'create-docs-contract',
  'create-meet',
  'load-gmail-threads',
  'create-gmail-draft',
  'search-contacts',
  'create-contact',
  'load-task-lists',
  'create-task',
  'load-chat-spaces',
  'create-chat-space',
  'load-chat-messages',
  'send-chat-message',
  'create-youtube-playlist',
  'upload-youtube-video',
  'update-youtube-video',
  'upload-youtube-thumbnail',
];

const initialActionStates = ACTION_KEYS.reduce<Record<ActionKey, ActionState>>((acc, key) => {
  acc[key] = { status: 'idle', message: 'Ikke kjørt ennå.' };
  return acc;
}, {} as Record<ActionKey, ActionState>);

const initialOverviewState: OverviewState = {
  publicSession: null,
  driveStatus: null,
  youtubeStatus: null,
  workspaceStorage: null,
};

function readStoredValue(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const value = window.localStorage.getItem(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStoredUserId() {
  const rawUser = readStoredValue('creatorhub_auth_user');
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as Record<string, unknown>;
      if (typeof parsed.id === 'string' && parsed.id.trim()) return parsed.id.trim();
      if (typeof parsed.userId === 'string' && parsed.userId.trim()) return parsed.userId.trim();
    } catch {
      // ignore storage parse errors
    }
  }

  return readStoredValue('userId');
}

function readStoredUserEmail() {
  const rawUser = readStoredValue('creatorhub_auth_user');
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as Record<string, unknown>;
      if (typeof parsed.email === 'string' && parsed.email.trim()) return parsed.email.trim().toLowerCase();
      if (typeof parsed.userEmail === 'string' && parsed.userEmail.trim()) return parsed.userEmail.trim().toLowerCase();
    } catch {
      // ignore storage parse errors
    }
  }

  return readStoredValue('userEmail')?.toLowerCase() ?? null;
}

function createTimestampLabel() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function stringifyPayload(payload: unknown) {
  if (payload == null) {
    return '';
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
}

function PreviewJson({ value }: { value: unknown }) {
  if (value == null) {
    return null;
  }

  return (
    <Box
      component="pre"
      sx={{
        mt: 1.5,
        p: 1.5,
        borderRadius: 2,
        border: `1px solid ${alpha('#0f172a', 0.08)}`,
        bgcolor: alpha('#0f172a', 0.03),
        color: '#0f172a',
        fontSize: '0.74rem',
        lineHeight: 1.55,
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {stringifyPayload(value)}
    </Box>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonLabel,
  actionKey,
  state,
  onRun,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  actionKey: ActionKey;
  state: ActionState;
  onRun: () => void;
}) {
  const isRunning = state.status === 'running';
  const alertSeverity = state.status === 'success'
    ? 'success'
    : state.status === 'error'
      ? 'error'
      : 'info';

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: `1px solid ${alpha('#0f172a', 0.08)}`,
        bgcolor: '#ffffff',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(creatorHubTheme.palette.primary.main, 0.08),
              color: creatorHubTheme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Button
            variant="contained"
            onClick={onRun}
            disabled={isRunning}
            data-testid={`action-${actionKey}`}
            sx={{ alignSelf: 'flex-start' }}
          >
            {isRunning ? 'Kjører…' : buttonLabel}
          </Button>
          <Chip
            size="small"
            label={state.status.toUpperCase()}
            color={
              state.status === 'success'
                ? 'success'
                : state.status === 'error'
                  ? 'error'
                  : state.status === 'running'
                    ? 'warning'
                    : 'default'
            }
          />
        </Stack>

        <Alert
          severity={alertSeverity}
          variant="outlined"
          data-testid={`result-${actionKey}`}
          data-status={state.status}
          sx={{ borderRadius: 2 }}
        >
          {state.message}
        </Alert>

        <PreviewJson value={state.payload} />
      </Stack>
    </Paper>
  );
}

export default function GoogleVerificationDemoPage() {
  const { user } = useAuth();
  const resolvedUserId = user?.id || readStoredUserId();
  const resolvedEmail = (user?.email || readStoredUserEmail() || 'daniel@creatorhubn.com').toLowerCase();

  const [overview, setOverview] = React.useState<OverviewState>(initialOverviewState);
  const [overviewLoading, setOverviewLoading] = React.useState(false);
  const [actions, setActions] = React.useState<Record<ActionKey, ActionState>>(initialActionStates);
  const [artifacts, setArtifacts] = React.useState<DemoArtifacts>({
    contractId: null,
    googleDocUrl: null,
    taskListId: null,
    chatSpaceName: null,
    youtubePlaylistId: null,
    youtubeVideoId: null,
    youtubeVideoUrl: null,
  });

  const setActionState = React.useCallback((key: ActionKey, next: ActionState) => {
    setActions((current) => ({
      ...current,
      [key]: next,
    }));
  }, []);

  const runAction = React.useCallback(async <T,>(
    key: ActionKey,
    handler: () => Promise<T>,
    successMessage: (value: T) => string,
  ) => {
    setActionState(key, { status: 'running', message: 'Kjører handlingen…' });
    try {
      const value = await handler();
      setActionState(key, {
        status: 'success',
        message: successMessage(value),
        payload: value,
      });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'En ukjent feil oppstod.';
      setActionState(key, {
        status: 'error',
        message,
      });
      throw error;
    }
  }, [setActionState]);

  const refreshOverview = React.useCallback(async () => {
    setOverviewLoading(true);
    try {
      const [publicSession, driveStatus, youtubeStatus, workspaceStorage] = await Promise.all([
        apiRequest('/api/auth/public-session'),
        apiRequest('/api/file-management/google-drive/status'),
        apiRequest('/api/youtube/status'),
        resolvedUserId
          ? apiRequest(`/api/google-workspace/storage/${encodeURIComponent(resolvedUserId)}`)
          : Promise.resolve(null),
      ]);

      const nextOverview = {
        publicSession,
        driveStatus,
        youtubeStatus,
        workspaceStorage,
      };
      setOverview(nextOverview);
      return nextOverview;
    } finally {
      setOverviewLoading(false);
    }
  }, [resolvedUserId]);

  React.useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    (window as typeof window & { __creatorhubGoogleVerificationDemoState?: unknown }).__creatorhubGoogleVerificationDemoState = {
      overview,
      actions,
      artifacts,
      userId: resolvedUserId,
      email: resolvedEmail,
    };
  }, [actions, artifacts, overview, resolvedEmail, resolvedUserId]);

  const handleRefreshOverview = React.useCallback(async () => {
    await runAction(
      'refresh-overview',
      async () => refreshOverview(),
      () => 'Status for session, Drive, Workspace og YouTube er oppdatert.',
    );
  }, [refreshOverview, runAction]);

  const handleLoadDriveFiles = React.useCallback(async () => {
    await runAction(
      'load-drive-files',
      async () => apiRequest('/api/google/drive/files?pageSize=6'),
      (value) => {
        const fileCount = Array.isArray((value as { files?: unknown[] }).files)
          ? (value as { files: unknown[] }).files.length
          : 0;
        return `Drive-liste hentet. ${fileCount} filer ble lastet.`;
      },
    );
  }, [runAction]);

  const handleUploadDriveDemoFile = React.useCallback(async () => {
    await runAction(
      'upload-drive-file',
      async () => {
        const formData = new FormData();
        const timestamp = createTimestampLabel();
        const file = new File(
          [
            [
              'CreatorHub Google Verification Demo',
              `Generated at: ${new Date().toISOString()}`,
              `User: ${resolvedEmail}`,
              'This file proves Drive write access from inside CreatorHub.',
            ].join('\n'),
          ],
          `creatorhub-google-verification-${timestamp}.txt`,
          { type: 'text/plain' },
        );

        formData.append('files', file);
        formData.append('targetFolderName', 'CreatorHub Google Verification');
        formData.append('targetScope', 'global');
        formData.append('projectName', 'CreatorHub Google Verification');
        formData.append('companyName', 'CreatorHub Norge');
        formData.append('sectionLabel', 'Google verification demo');

        return apiRequest('/api/google/drive/upload-contextual', {
          method: 'POST',
          body: formData,
        });
      },
      (value) => {
        const firstFile = Array.isArray((value as { uploaded?: Array<{ name?: string }> }).uploaded)
          ? (value as { uploaded: Array<{ name?: string }> }).uploaded[0]
          : null;
        return `Drive-demo fil lastet opp${firstFile?.name ? `: ${firstFile.name}` : '.'}`;
      },
    );
  }, [resolvedEmail, runAction]);

  const handleCreateDocsContract = React.useCallback(async () => {
    await runAction(
      'create-docs-contract',
      async () => {
        const timestamp = createTimestampLabel();
        const created = await apiRequest('/api/contracts', {
          method: 'POST',
          body: {
            title: `CreatorHub Google Verification ${timestamp}`,
            contractTitle: `CreatorHub Google Verification ${timestamp}`,
            customerType: 'business',
            organizationName: 'CreatorHub Norge',
            profession: 'photographer',
            projectType: 'verification_demo',
            projectDescription: 'Contract used to demonstrate Google Docs and Google Drive from inside CreatorHub.',
            totalAmount: 1,
            content: 'Google verification demo contract generated from CreatorHub.',
          },
        });

        const contractId = typeof (created as { contractId?: unknown }).contractId === 'string'
          ? (created as { contractId: string }).contractId
          : null;
        if (!contractId) {
          throw new Error('Kontrakt ble opprettet uten contractId.');
        }

        const prepared = await apiRequest(`/api/contracts/${encodeURIComponent(contractId)}/google-signature/prepare`, {
          method: 'POST',
        });
        const googleDocUrl = typeof (prepared as { contract?: { googleDocUrl?: unknown } }).contract?.googleDocUrl === 'string'
          ? (prepared as { contract: { googleDocUrl: string } }).contract.googleDocUrl
          : null;

        setArtifacts((current) => ({
          ...current,
          contractId,
          googleDocUrl,
        }));

        return {
          contractId,
          googleDocUrl,
          prepared,
        };
      },
      (value) => {
        const docUrl = (value as { googleDocUrl?: string | null }).googleDocUrl;
        return docUrl
          ? 'Google Docs-kontrakt ble opprettet og klargjort for signatur.'
          : 'Kontrakt ble opprettet, men Docs-lenken mangler i svaret.';
      },
    );
  }, [runAction]);

  const handleCreateMeet = React.useCallback(async () => {
    await runAction(
      'create-meet',
      async () => apiRequest('/api/google-meet/create', {
        method: 'POST',
        body: {
          userId: resolvedUserId,
          title: 'CreatorHub Google Verification Demo',
          description: 'Short Google Meet demo created inside CreatorHub for OAuth verification.',
          participants: [resolvedEmail],
          type: 'verification_demo',
          projectName: 'CreatorHub Google Verification',
          clientName: 'CreatorHub Norge',
          clientEmail: resolvedEmail,
        },
      }),
      () => 'Google Meet-demo ble opprettet med kalenderhendelse og møtelenke.',
    );
  }, [resolvedEmail, resolvedUserId, runAction]);

  const handleLoadGmailThreads = React.useCallback(async () => {
    await runAction(
      'load-gmail-threads',
      async () => apiRequest('/api/communication/email/threads?limit=5'),
      (value) => {
        const count = Array.isArray((value as { threads?: unknown[] }).threads)
          ? (value as { threads: unknown[] }).threads.length
          : 0;
        return `Gmail-tråder hentet. ${count} tråder ble lest.`;
      },
    );
  }, [runAction]);

  const handleCreateGmailDraft = React.useCallback(async () => {
    await runAction(
      'create-gmail-draft',
      async () => apiRequest('/api/communication/email/drafts', {
        method: 'POST',
        body: {
          to: resolvedEmail,
          subject: `CreatorHub Google verification draft ${createTimestampLabel()}`,
          message: 'This draft was created inside CreatorHub to demonstrate Gmail compose scope usage.',
        },
      }),
      () => 'Gmail-utkast ble opprettet i den tilkoblede Google Workspace-kontoen.',
    );
  }, [resolvedEmail, runAction]);

  const handleSearchContacts = React.useCallback(async () => {
    await runAction(
      'search-contacts',
      async () => apiRequest('/api/google/people/search-contacts?q=daniel'),
      (value) => {
        const count = Array.isArray(value) ? value.length : 0;
        return `Kontakt-søk fullført. ${count} treff ble hentet fra Google Contacts.`;
      },
    );
  }, [runAction]);

  const handleCreateContact = React.useCallback(async () => {
    await runAction(
      'create-contact',
      async () => {
        const stamp = createTimestampLabel();
        return apiRequest('/api/google/people/create-contact', {
          method: 'POST',
          body: {
            name: `CreatorHub Verification ${stamp}`,
            firstName: 'CreatorHub',
            lastName: `Verification ${stamp}`,
            email: `google-verification+${stamp}@creatorhubn.com`,
            companyName: 'CreatorHub Norge',
            notes: 'Created inside CreatorHub for Google OAuth verification.',
          },
        });
      },
      () => 'Ny Google Contact ble opprettet fra CreatorHub.',
    );
  }, [runAction]);

  const handleLoadTaskLists = React.useCallback(async () => {
    await runAction(
      'load-task-lists',
      async () => {
        const lists = await apiRequest('/api/google-tasks/lists');
        const firstListId = Array.isArray(lists) && typeof lists[0]?.id === 'string' ? lists[0].id : null;
        setArtifacts((current) => ({
          ...current,
          taskListId: firstListId || current.taskListId,
        }));
        return lists;
      },
      (value) => {
        const count = Array.isArray(value) ? value.length : 0;
        return `Google Tasks-lister hentet. ${count} lister ble lest.`;
      },
    );
  }, [runAction]);

  const handleCreateTask = React.useCallback(async () => {
    await runAction(
      'create-task',
      async () => apiRequest('/api/google-tasks/tasks', {
        method: 'POST',
        body: {
          title: `CreatorHub verification follow-up ${createTimestampLabel()}`,
          notes: 'Task created inside CreatorHub during Google OAuth verification demo.',
        },
      }),
      () => 'Google Task ble opprettet fra CreatorHub.',
    );
  }, [runAction]);

  const handleLoadChatSpaces = React.useCallback(async () => {
    await runAction(
      'load-chat-spaces',
      async () => {
        const spacesResponse = await apiRequest('/api/google/chat/spaces');
        const firstSpace = Array.isArray((spacesResponse as { spaces?: Array<{ name?: string }> }).spaces)
          ? (spacesResponse as { spaces: Array<{ name?: string }> }).spaces[0]
          : null;
        if (typeof firstSpace?.name === 'string' && firstSpace.name.trim()) {
          setArtifacts((current) => ({
            ...current,
            chatSpaceName: firstSpace.name.trim(),
          }));
        }
        return spacesResponse;
      },
      (value) => {
        const count = Array.isArray((value as { spaces?: unknown[] }).spaces)
          ? (value as { spaces: unknown[] }).spaces.length
          : 0;
        return `Google Chat-rom hentet. ${count} spaces ble lest.`;
      },
    );
  }, [runAction]);

  const handleCreateChatSpace = React.useCallback(async () => {
    await runAction(
      'create-chat-space',
      async () => {
        const response = await apiRequest('/api/google/chat/create-space', {
          method: 'POST',
          body: {
            displayName: `CreatorHub Verification ${createTimestampLabel()}`,
            description: 'Google Chat space created inside CreatorHub for OAuth verification.',
            spaceType: 'SPACE',
          },
        });

        const spaceName = typeof (response as { space?: { name?: unknown } }).space?.name === 'string'
          ? (response as { space: { name: string } }).space.name
          : null;
        if (spaceName) {
          setArtifacts((current) => ({
            ...current,
            chatSpaceName: spaceName,
          }));
        }
        return response;
      },
      () => 'Google Chat-space ble opprettet fra CreatorHub.',
    );
  }, [runAction]);

  const handleLoadChatMessages = React.useCallback(async () => {
    await runAction(
      'load-chat-messages',
      async () => {
        const fallbackSpace = artifacts.chatSpaceName;
        if (!fallbackSpace) {
          throw new Error('Ingen Google Chat-space er valgt ennå. Last inn eller opprett et space først.');
        }
        return apiRequest(`/api/google/chat/messages?space=${encodeURIComponent(fallbackSpace)}`);
      },
      (value) => {
        const count = Array.isArray((value as { messages?: unknown[] }).messages)
          ? (value as { messages: unknown[] }).messages.length
          : 0;
        return `Google Chat-meldinger hentet. ${count} meldinger ble lest.`;
      },
    );
  }, [artifacts.chatSpaceName, runAction]);

  const handleSendChatMessage = React.useCallback(async () => {
    await runAction(
      'send-chat-message',
      async () => {
        const fallbackSpace = artifacts.chatSpaceName;
        if (!fallbackSpace) {
          throw new Error('Ingen Google Chat-space er valgt ennå. Last inn eller opprett et space først.');
        }

        return apiRequest('/api/google/chat/send', {
          method: 'POST',
          body: {
            space: fallbackSpace,
            message: `CreatorHub verification message sent at ${new Date().toISOString()}.`,
          },
        });
      },
      () => 'Google Chat-melding ble sendt fra CreatorHub.',
    );
  }, [artifacts.chatSpaceName, runAction]);

  const handleCreateYouTubePlaylist = React.useCallback(async () => {
    await runAction(
      'create-youtube-playlist',
      async () => {
        const response = await apiRequest('/api/youtube/playlists', {
          method: 'POST',
          body: {
            title: `CreatorHub Verification ${createTimestampLabel()}`,
            description: 'Private playlist created inside CreatorHub for Google verification assets.',
            status: 'private',
          },
        });

        const playlistId = typeof (response as { playlist?: { id?: unknown } }).playlist?.id === 'string'
          ? (response as { playlist: { id: string } }).playlist.id
          : null;
        if (playlistId) {
          setArtifacts((current) => ({
            ...current,
            youtubePlaylistId: playlistId,
          }));
        }
        return response;
      },
      () => 'Privat YouTube-spilleliste ble opprettet fra CreatorHub.',
    );
  }, [runAction]);

  const handleUploadYouTubeVideo = React.useCallback(async () => {
    await runAction(
      'upload-youtube-video',
      async () => {
        const assetResponse = await fetch('/google-verification-assets/creatorhub-google-verification.mp4');
        if (!assetResponse.ok) {
          throw new Error('Kunne ikke hente demo-videoasset for YouTube-opplasting.');
        }

        const assetBlob = await assetResponse.blob();
        const formData = new FormData();
        formData.append(
          'video',
          new File([assetBlob], 'creatorhub-google-verification.mp4', { type: 'video/mp4' }),
        );
        formData.append('createShowcase', 'false');
        formData.append('metadata', JSON.stringify({
          title: `CreatorHub Google Verification ${createTimestampLabel()}`,
          description: 'Private verification upload created inside CreatorHub.',
          tags: ['creatorhub', 'google verification', 'private demo'],
          status: 'private',
          categoryId: '22',
          playlistId: artifacts.youtubePlaylistId || undefined,
        }));

        const response = await apiRequest('/api/youtube/upload', {
          method: 'POST',
          body: formData,
        });

        const video = (response as { video?: { id?: string; url?: string } }).video;
        if (typeof video?.id === 'string') {
          setArtifacts((current) => ({
            ...current,
            youtubeVideoId: video.id,
            youtubeVideoUrl: typeof video.url === 'string' ? video.url : current.youtubeVideoUrl,
          }));
        }

        return response;
      },
      () => 'Privat YouTube-demo video ble lastet opp fra CreatorHub.',
    );
  }, [artifacts.youtubePlaylistId, runAction]);

  const handleUpdateYouTubeVideo = React.useCallback(async () => {
    await runAction(
      'update-youtube-video',
      async () => {
        if (!artifacts.youtubeVideoId) {
          throw new Error('Ingen YouTube-video er lastet opp ennå.');
        }

        return apiRequest(`/api/youtube/videos/${encodeURIComponent(artifacts.youtubeVideoId)}`, {
          method: 'PATCH',
          body: {
            title: `CreatorHub Google Verification Updated ${createTimestampLabel()}`,
            description: 'Metadata updated inside CreatorHub to demonstrate YouTube management.',
            status: 'private',
            categoryId: '22',
            tags: ['creatorhub', 'verification', 'metadata update'],
            playlistId: artifacts.youtubePlaylistId || undefined,
          },
        });
      },
      () => 'YouTube-metadata ble oppdatert fra CreatorHub.',
    );
  }, [artifacts.youtubePlaylistId, artifacts.youtubeVideoId, runAction]);

  const handleUploadYouTubeThumbnail = React.useCallback(async () => {
    await runAction(
      'upload-youtube-thumbnail',
      async () => {
        if (!artifacts.youtubeVideoId) {
          throw new Error('Ingen YouTube-video er lastet opp ennå.');
        }

        const assetResponse = await fetch('/google-verification-assets/creatorhub-google-verification-thumbnail.png');
        if (!assetResponse.ok) {
          throw new Error('Kunne ikke hente demo-thumbnailasset for YouTube.');
        }

        const assetBlob = await assetResponse.blob();
        const formData = new FormData();
        formData.append(
          'thumbnail',
          new File([assetBlob], 'creatorhub-google-verification-thumbnail.png', { type: 'image/png' }),
        );

        return apiRequest(`/api/youtube/videos/${encodeURIComponent(artifacts.youtubeVideoId)}/thumbnail`, {
          method: 'POST',
          body: formData,
        });
      },
      () => 'YouTube-thumbnail ble oppdatert fra CreatorHub.',
    );
  }, [artifacts.youtubeVideoId, runAction]);

  const sessionEmail = typeof (overview.publicSession as { body?: { email?: unknown } }).body?.email === 'string'
    ? (overview.publicSession as { body: { email: string } }).body.email
    : resolvedEmail;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 6 },
        background: `linear-gradient(180deg, ${alpha('#f59e0b', 0.08)} 0%, ${alpha('#fff7ed', 0.96)} 40%, #ffffff 100%)`,
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              border: `1px solid ${alpha('#0f172a', 0.08)}`,
              background: `linear-gradient(135deg, ${alpha('#0f172a', 0.96)} 0%, ${alpha('#1f2937', 0.96)} 55%, ${alpha('#111827', 0.98)} 100%)`,
              color: 'common.white',
            }}
          >
            <Stack spacing={2.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                <Box sx={{ maxWidth: 760 }}>
                  <Typography variant="overline" sx={{ color: alpha('#f8fafc', 0.72), letterSpacing: 1.8 }}>
                    CreatorHub Internal
                  </Typography>
                  <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1.05 }}>
                    Google Verification Demo
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1.5, color: alpha('#f8fafc', 0.78), maxWidth: 680 }}>
                    Denne siden er laget for å demonstrere end-to-end bruk av Google Workspace- og YouTube-scope-ene direkte i CreatorHub.
                    Alt her kjøres i nettleseren, slik at demo-videoen til Google blir ryddig, konsistent og submission-klar.
                  </Typography>
                </Box>

                <Stack spacing={1.25} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Chip
                    label={`Session: ${sessionEmail}`}
                    sx={{ bgcolor: alpha('#ffffff', 0.08), color: '#ffffff' }}
                  />
                  <Chip
                    label={resolvedUserId ? `User ID: ${resolvedUserId}` : 'Ingen bruker funnet'}
                    sx={{ bgcolor: alpha('#ffffff', 0.08), color: '#ffffff' }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<Refresh />}
                    onClick={() => { void handleRefreshOverview(); }}
                    data-testid="action-refresh-overview"
                    sx={{
                      bgcolor: '#f59e0b',
                      color: '#111827',
                      '&:hover': { bgcolor: '#fbbf24' },
                    }}
                  >
                    {overviewLoading ? 'Oppdaterer…' : 'Oppdater oversikt'}
                  </Button>
                </Stack>
              </Stack>

              <Divider sx={{ borderColor: alpha('#ffffff', 0.12) }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                <Chip label={`Drive: ${typeof (overview.driveStatus as { body?: { connected?: unknown } }).body?.connected === 'boolean' ? ((overview.driveStatus as { body: { connected: boolean } }).body.connected ? 'connected' : 'disconnected') : 'ukjent'}`} sx={{ bgcolor: alpha('#ffffff', 0.08), color: '#ffffff' }} />
                <Chip label={`YouTube: ${typeof (overview.youtubeStatus as { connected?: unknown }).connected === 'boolean' ? ((overview.youtubeStatus as { connected: boolean }).connected ? 'connected' : 'not connected') : 'ukjent'}`} sx={{ bgcolor: alpha('#ffffff', 0.08), color: '#ffffff' }} />
                <Chip label={`Workspace storage: ${typeof (overview.workspaceStorage as { totalStorageGB?: unknown }).totalStorageGB === 'number' ? `${(overview.workspaceStorage as { totalStorageGB: number }).totalStorageGB} GB` : 'ikke lastet'}`} sx={{ bgcolor: alpha('#ffffff', 0.08), color: '#ffffff' }} />
              </Stack>
            </Stack>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 4,
              border: `1px solid ${alpha('#0f172a', 0.08)}`,
              bgcolor: '#ffffff',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Live Overview
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Denne blokken viser hva den aktuelle browser-sesjonen faktisk ser etter login og Google Workspace-link.
            </Typography>
            <PreviewJson value={overview} />
          </Paper>

          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} alignItems="flex-start">
            <Box sx={{ flex: 1, display: 'grid', gap: 3 }}>
              <ActionCard
                icon={<DriveFolderUpload />}
                title="Google Drive"
                description="Les filoversikt og skriv en demo-fil til Google Drive fra CreatorHub."
                buttonLabel="Load Drive Files"
                actionKey="load-drive-files"
                state={actions['load-drive-files']}
                onRun={() => { void handleLoadDriveFiles(); }}
              />
              <ActionCard
                icon={<DriveFolderUpload />}
                title="Drive Write"
                description="Opprett en ny demo-fil via CreatorHub sin Drive-opplasting."
                buttonLabel="Upload Drive Demo File"
                actionKey="upload-drive-file"
                state={actions['upload-drive-file']}
                onRun={() => { void handleUploadDriveDemoFile(); }}
              />
              <ActionCard
                icon={<Description />}
                title="Google Docs"
                description="Opprett en CreatorHub-kontrakt og klargjør den som Google-signaturdokument i Docs/Drive."
                buttonLabel="Create Docs Demo Contract"
                actionKey="create-docs-contract"
                state={actions['create-docs-contract']}
                onRun={() => { void handleCreateDocsContract(); }}
              />
              {artifacts.googleDocUrl && (
                <Link href={artifacts.googleDocUrl} target="_blank" rel="noreferrer" underline="hover">
                  Åpne opprettet Google Docs-dokument
                </Link>
              )}
              <ActionCard
                icon={<CalendarMonth />}
                title="Google Calendar / Meet"
                description="Opprett en kort demo-hendelse med Meet-lenke fra CreatorHub."
                buttonLabel="Create Google Meet Demo"
                actionKey="create-meet"
                state={actions['create-meet']}
                onRun={() => { void handleCreateMeet(); }}
              />
              <ActionCard
                icon={<Email />}
                title="Gmail Inbox"
                description="Les Gmail-tråder fra CreatorHub og opprett en kladd i den tilkoblede kontoen."
                buttonLabel="Load Gmail Threads"
                actionKey="load-gmail-threads"
                state={actions['load-gmail-threads']}
                onRun={() => { void handleLoadGmailThreads(); }}
              />
              <ActionCard
                icon={<Email />}
                title="Gmail Drafts"
                description="Opprett et Gmail-utkast fra CreatorHub for å demonstrere compose scope."
                buttonLabel="Create Gmail Draft"
                actionKey="create-gmail-draft"
                state={actions['create-gmail-draft']}
                onRun={() => { void handleCreateGmailDraft(); }}
              />
            </Box>

            <Box sx={{ flex: 1, display: 'grid', gap: 3 }}>
              <ActionCard
                icon={<Contacts />}
                title="Google Contacts"
                description="Søk i eksisterende kontakter og opprett en ny kontakt fra CreatorHub."
                buttonLabel="Search Contacts"
                actionKey="search-contacts"
                state={actions['search-contacts']}
                onRun={() => { void handleSearchContacts(); }}
              />
              <ActionCard
                icon={<Contacts />}
                title="Contacts Write"
                description="Opprett en ny Google Contact med CreatorHub-data."
                buttonLabel="Create Contact"
                actionKey="create-contact"
                state={actions['create-contact']}
                onRun={() => { void handleCreateContact(); }}
              />
              <ActionCard
                icon={<TaskAlt />}
                title="Google Tasks"
                description="Les oppgavelister og opprett en ny oppgave direkte i Google Tasks."
                buttonLabel="Load Task Lists"
                actionKey="load-task-lists"
                state={actions['load-task-lists']}
                onRun={() => { void handleLoadTaskLists(); }}
              />
              <ActionCard
                icon={<TaskAlt />}
                title="Tasks Write"
                description="Opprett en ny Google Task fra CreatorHub."
                buttonLabel="Create Task"
                actionKey="create-task"
                state={actions['create-task']}
                onRun={() => { void handleCreateTask(); }}
              />
              <ActionCard
                icon={<Chat />}
                title="Google Chat Spaces"
                description="Les spaces, opprett et nytt rom og vis meldinger fra CreatorHub."
                buttonLabel="Load Chat Spaces"
                actionKey="load-chat-spaces"
                state={actions['load-chat-spaces']}
                onRun={() => { void handleLoadChatSpaces(); }}
              />
              <ActionCard
                icon={<Chat />}
                title="Chat Write"
                description="Opprett nytt Google Chat-space og send melding i samme space."
                buttonLabel="Create Chat Space"
                actionKey="create-chat-space"
                state={actions['create-chat-space']}
                onRun={() => { void handleCreateChatSpace(); }}
              />
              <ActionCard
                icon={<Chat />}
                title="Chat Read Messages"
                description="Les meldinger fra det valgte Google Chat-rommet."
                buttonLabel="Load Chat Messages"
                actionKey="load-chat-messages"
                state={actions['load-chat-messages']}
                onRun={() => { void handleLoadChatMessages(); }}
              />
              <ActionCard
                icon={<Chat />}
                title="Chat Send Message"
                description="Send en Google Chat-melding fra CreatorHub i det opprettede rommet."
                buttonLabel="Send Chat Message"
                actionKey="send-chat-message"
                state={actions['send-chat-message']}
                onRun={() => { void handleSendChatMessage(); }}
              />
            </Box>

            <Box sx={{ flex: 1, display: 'grid', gap: 3 }}>
              <ActionCard
                icon={<PlayCircleOutline />}
                title="YouTube Playlist"
                description="Opprett en privat spilleliste for verifikasjonsopptakene."
                buttonLabel="Create YouTube Playlist"
                actionKey="create-youtube-playlist"
                state={actions['create-youtube-playlist']}
                onRun={() => { void handleCreateYouTubePlaylist(); }}
              />
              <ActionCard
                icon={<VideoLibrary />}
                title="YouTube Upload"
                description="Last opp en privat demo-video fra CreatorHub uten desktop-filvelger."
                buttonLabel="Upload YouTube Demo Video"
                actionKey="upload-youtube-video"
                state={actions['upload-youtube-video']}
                onRun={() => { void handleUploadYouTubeVideo(); }}
              />
              <ActionCard
                icon={<VideoLibrary />}
                title="YouTube Metadata"
                description="Oppdater tittel, beskrivelse og tags på den nylig opplastede videoen."
                buttonLabel="Update YouTube Metadata"
                actionKey="update-youtube-video"
                state={actions['update-youtube-video']}
                onRun={() => { void handleUpdateYouTubeVideo(); }}
              />
              <ActionCard
                icon={<VideoLibrary />}
                title="YouTube Thumbnail"
                description="Last opp ny thumbnail på den samme videoen fra CreatorHub."
                buttonLabel="Upload YouTube Thumbnail"
                actionKey="upload-youtube-thumbnail"
                state={actions['upload-youtube-thumbnail']}
                onRun={() => { void handleUploadYouTubeThumbnail(); }}
              />

              {artifacts.youtubeVideoUrl && (
                <Alert severity="success" variant="outlined" sx={{ borderRadius: 2 }}>
                  Demo-video er tilgjengelig her:{' '}
                  <Link href={artifacts.youtubeVideoUrl} target="_blank" rel="noreferrer" underline="hover">
                    {artifacts.youtubeVideoUrl}
                  </Link>
                </Alert>
              )}
            </Box>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
