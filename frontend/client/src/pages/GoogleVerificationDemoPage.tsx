// @ts-nocheck
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

type StageDefinition = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  actions: Array<{
    key: ActionKey;
    title: string;
    description: string;
    buttonLabel: string;
    icon: React.ReactNode;
    onRun: () => void;
  }>;
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

function formatActionStatusLabel(status: ActionStatus) {
  switch (status) {
    case 'running':
      return 'Kjører';
    case 'success':
      return 'Ferdig';
    case 'error':
      return 'Feil';
    default:
      return 'Klar';
  }
}

function getStageProgress(actions: Record<ActionKey, ActionState>, keys: ActionKey[]) {
  const actionableKeys = keys.filter((key) => key !== 'refresh-overview');
  const completed = actionableKeys.filter((key) => actions[key].status === 'success').length;
  const failed = actionableKeys.filter((key) => actions[key].status === 'error').length;
  const running = actionableKeys.filter((key) => actions[key].status === 'running').length;
  return {
    completed,
    failed,
    running,
    total: actionableKeys.length,
  };
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

function OverviewMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning';
}) {
  const tones = {
    default: {
      border: alpha('#ffffff', 0.12),
      background: alpha('#ffffff', 0.06),
      label: alpha('#f8fafc', 0.64),
      value: '#ffffff',
    },
    success: {
      border: alpha('#34d399', 0.26),
      background: alpha('#34d399', 0.12),
      label: alpha('#d1fae5', 0.82),
      value: '#ecfdf5',
    },
    warning: {
      border: alpha('#fbbf24', 0.26),
      background: alpha('#fbbf24', 0.12),
      label: alpha('#fde68a', 0.88),
      value: '#fffbeb',
    },
  } as const;

  const colors = tones[tone];

  return (
    <Box
      sx={{
        minWidth: 0,
        px: 1.6,
        py: 1.4,
        borderRadius: 3,
        border: `1px solid ${colors.border}`,
        bgcolor: colors.background,
      }}
    >
      <Typography variant="caption" sx={{ display: 'block', color: colors.label, letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ color: colors.value, fontWeight: 700, mt: 0.35 }}>
        {value}
      </Typography>
    </Box>
  );
}

function StageSection({
  eyebrow,
  title,
  description,
  accent,
  completed,
  total,
  failed,
  children,
}: React.PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
  accent: string;
  completed: number;
  total: number;
  failed: number;
}>) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.25, md: 2.75 },
        borderRadius: 4,
        border: `1px solid ${alpha('#0f172a', 0.08)}`,
        bgcolor: '#ffffff',
      }}
    >
      <Stack spacing={2.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
          <Box sx={{ maxWidth: 680 }}>
            <Typography variant="overline" sx={{ color: alpha(accent, 0.84), letterSpacing: 1.2 }}>
              {eyebrow}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.08, color: '#0f172a' }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.8, color: alpha('#0f172a', 0.68) }}>
              {description}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="flex-start" flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={`${completed}/${total} fullført`}
              sx={{
                bgcolor: alpha(accent, 0.1),
                color: accent,
                fontWeight: 700,
              }}
            />
            {failed > 0 && (
              <Chip
                size="small"
                color="error"
                label={`${failed} trenger oppfølging`}
                sx={{ fontWeight: 700 }}
              />
            )}
          </Stack>
        </Stack>

        <Box
          sx={{
            height: 3,
            borderRadius: 999,
            bgcolor: alpha(accent, 0.08),
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              width: `${total === 0 ? 0 : (completed / total) * 100}%`,
              height: '100%',
              borderRadius: 999,
              bgcolor: accent,
              transition: 'width 220ms ease',
            }}
          />
        </Box>

        <Stack spacing={1.5}>
          {children}
        </Stack>
      </Stack>
    </Paper>
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

  const statusLabel = formatActionStatusLabel(state.status);

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 3.5,
        border: `1px solid ${alpha('#0f172a', 0.08)}`,
        bgcolor: state.status === 'success'
          ? alpha('#10b981', 0.03)
          : state.status === 'error'
            ? alpha('#ef4444', 0.035)
            : alpha('#f8fafc', 0.82),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(creatorHubTheme.palette.primary.main, 0.08),
                color: creatorHubTheme.palette.primary.main,
              }}
            >
              {icon}
            </Box>
          <Box
            sx={{ minWidth: 0 }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          </Stack>

          <Chip
            size="small"
            label={statusLabel}
            color={
              state.status === 'success'
                ? 'success'
                : state.status === 'error'
                  ? 'error'
                  : state.status === 'running'
                    ? 'warning'
                    : 'default'
            }
            sx={{ fontWeight: 700, alignSelf: { xs: 'flex-start', sm: 'center' } }}
          />
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
          {state.status === 'idle' && (
            <Typography variant="caption" sx={{ color: alpha('#0f172a', 0.58) }}>
              Kjør handlingen direkte fra CreatorHub under opptaket.
            </Typography>
          )}
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

        {state.payload != null && (
          <Box
            component="details"
            sx={{
              mt: 0.25,
              borderRadius: 2.5,
              border: `1px solid ${alpha('#0f172a', 0.08)}`,
              bgcolor: alpha('#f8fafc', 0.74),
              px: 1.5,
              py: 1.25,
              '& > summary': {
                cursor: 'pointer',
                listStyle: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                color: '#0f172a',
              },
              '& > summary::-webkit-details-marker': {
                display: 'none',
              },
            }}
          >
            <Box component="summary">Vis raw response</Box>
            <PreviewJson value={state.payload} />
          </Box>
        )}
      </Stack>
    </Box>
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

  const sessionEmail = typeof (overview.publicSession as { body?: { email?: unknown } } | null)?.body?.email === 'string'
    ? (overview.publicSession as { body: { email: string } }).body.email
    : resolvedEmail;
  const driveConnected = typeof (overview.driveStatus as { body?: { connected?: unknown } } | null)?.body?.connected === 'boolean'
    ? Boolean((overview.driveStatus as { body: { connected: boolean } }).body.connected)
    : null;
  const youtubeConnected = typeof (overview.youtubeStatus as { connected?: unknown } | null)?.connected === 'boolean'
    ? Boolean((overview.youtubeStatus as { connected: boolean }).connected)
    : null;
  const youtubeNeedsReconnect = typeof (overview.youtubeStatus as { needsReconnect?: unknown } | null)?.needsReconnect === 'boolean'
    ? Boolean((overview.youtubeStatus as { needsReconnect: boolean }).needsReconnect)
    : false;
  const youtubeChannelTitle = typeof (overview.youtubeStatus as { channelTitle?: unknown } | null)?.channelTitle === 'string'
    ? (overview.youtubeStatus as { channelTitle: string }).channelTitle
    : null;
  const workspaceStorageTotal = typeof (overview.workspaceStorage as { totalStorageGB?: unknown } | null)?.totalStorageGB === 'number'
    ? (overview.workspaceStorage as { totalStorageGB: number }).totalStorageGB
    : null;
  const verificationSections: StageDefinition[] = [
    {
      id: 'workspace',
      eyebrow: 'Stage 1',
      title: 'Workspace foundations',
      description: 'Start with the scopes that establish storage, documents and scheduling. These are the cleanest proof points in the video.',
      accent: '#f59e0b',
      actions: [
        {
          key: 'load-drive-files',
          title: 'Google Drive',
          description: 'Les filoversikt og bekreft at CreatorHub kan hente innhold direkte fra Drive.',
          buttonLabel: 'Load Drive Files',
          icon: <DriveFolderUpload />,
          onRun: () => { void handleLoadDriveFiles(); },
        },
        {
          key: 'upload-drive-file',
          title: 'Drive Write',
          description: 'Skriv en ren demo-fil til Drive uten å åpne desktop-filvelger.',
          buttonLabel: 'Upload Drive Demo File',
          icon: <DriveFolderUpload />,
          onRun: () => { void handleUploadDriveDemoFile(); },
        },
        {
          key: 'create-docs-contract',
          title: 'Google Docs',
          description: 'Opprett kontrakt i CreatorHub og klargjør dokumentet for signatur i Docs/Drive.',
          buttonLabel: 'Create Docs Demo Contract',
          icon: <Description />,
          onRun: () => { void handleCreateDocsContract(); },
        },
        {
          key: 'create-meet',
          title: 'Calendar / Meet',
          description: 'Opprett en kort kalenderhendelse med Meet-lenke direkte fra CreatorHub.',
          buttonLabel: 'Create Google Meet Demo',
          icon: <CalendarMonth />,
          onRun: () => { void handleCreateMeet(); },
        },
      ],
    },
    {
      id: 'communication',
      eyebrow: 'Stage 2',
      title: 'Communication and coordination',
      description: 'Demonstrer at CreatorHub ikke bare leser data, men også lager utkast, kontakter, tasks og chat handlinger i Google Workspace.',
      accent: '#0ea5e9',
      actions: [
        {
          key: 'load-gmail-threads',
          title: 'Gmail Inbox',
          description: 'Les Gmail-tråder fra CreatorHub som en del av den virkelige kommunikasjonsoverflaten.',
          buttonLabel: 'Load Gmail Threads',
          icon: <Email />,
          onRun: () => { void handleLoadGmailThreads(); },
        },
        {
          key: 'create-gmail-draft',
          title: 'Gmail Drafts',
          description: 'Opprett et Gmail-utkast for å vise compose-scope og faktisk draft-støtte.',
          buttonLabel: 'Create Gmail Draft',
          icon: <Email />,
          onRun: () => { void handleCreateGmailDraft(); },
        },
        {
          key: 'search-contacts',
          title: 'Google Contacts',
          description: 'Søk i den tilkoblede kontaktlisten fra CreatorHub.',
          buttonLabel: 'Search Contacts',
          icon: <Contacts />,
          onRun: () => { void handleSearchContacts(); },
        },
        {
          key: 'create-contact',
          title: 'Contacts Write',
          description: 'Opprett en ny kontakt med CreatorHub-data som bevis på write-tilgang.',
          buttonLabel: 'Create Contact',
          icon: <Contacts />,
          onRun: () => { void handleCreateContact(); },
        },
        {
          key: 'load-task-lists',
          title: 'Google Tasks',
          description: 'Les oppgavelister og gjør klar task-flyten.',
          buttonLabel: 'Load Task Lists',
          icon: <TaskAlt />,
          onRun: () => { void handleLoadTaskLists(); },
        },
        {
          key: 'create-task',
          title: 'Tasks Write',
          description: 'Opprett en ny oppgave direkte fra CreatorHub.',
          buttonLabel: 'Create Task',
          icon: <TaskAlt />,
          onRun: () => { void handleCreateTask(); },
        },
        {
          key: 'load-chat-spaces',
          title: 'Google Chat Spaces',
          description: 'Les eksisterende rom og hent konteksten for videre chat-handlinger.',
          buttonLabel: 'Load Chat Spaces',
          icon: <Chat />,
          onRun: () => { void handleLoadChatSpaces(); },
        },
        {
          key: 'create-chat-space',
          title: 'Chat Write',
          description: 'Opprett et nytt Google Chat-space fra CreatorHub.',
          buttonLabel: 'Create Chat Space',
          icon: <Chat />,
          onRun: () => { void handleCreateChatSpace(); },
        },
        {
          key: 'send-chat-message',
          title: 'Chat Send Message',
          description: 'Send en melding til det opprettede rommet.',
          buttonLabel: 'Send Chat Message',
          icon: <Chat />,
          onRun: () => { void handleSendChatMessage(); },
        },
        {
          key: 'load-chat-messages',
          title: 'Chat Read Messages',
          description: 'Les meldingene tilbake fra samme rom for å vise round-trip.',
          buttonLabel: 'Load Chat Messages',
          icon: <Chat />,
          onRun: () => { void handleLoadChatMessages(); },
        },
      ],
    },
    {
      id: 'publishing',
      eyebrow: 'Stage 3',
      title: 'YouTube publishing',
      description: 'Vis publiseringsløpet i samme grensesnitt: spilleliste, opplasting, metadata og thumbnail. Denne delen krever aktiv YouTube-kanal.',
      accent: '#ef4444',
      actions: [
        {
          key: 'create-youtube-playlist',
          title: 'YouTube Playlist',
          description: 'Opprett privat spilleliste for verifikasjonsopptakene.',
          buttonLabel: 'Create YouTube Playlist',
          icon: <PlayCircleOutline />,
          onRun: () => { void handleCreateYouTubePlaylist(); },
        },
        {
          key: 'upload-youtube-video',
          title: 'YouTube Upload',
          description: 'Last opp privat demo-video uten desktop-filvelger.',
          buttonLabel: 'Upload YouTube Demo Video',
          icon: <VideoLibrary />,
          onRun: () => { void handleUploadYouTubeVideo(); },
        },
        {
          key: 'update-youtube-video',
          title: 'YouTube Metadata',
          description: 'Oppdater tittel, beskrivelse og tags på den nylig opplastede videoen.',
          buttonLabel: 'Update YouTube Metadata',
          icon: <VideoLibrary />,
          onRun: () => { void handleUpdateYouTubeVideo(); },
        },
        {
          key: 'upload-youtube-thumbnail',
          title: 'YouTube Thumbnail',
          description: 'Last opp ny thumbnail på den samme videoen fra CreatorHub.',
          buttonLabel: 'Upload YouTube Thumbnail',
          icon: <VideoLibrary />,
          onRun: () => { void handleUploadYouTubeThumbnail(); },
        },
      ],
    },
  ];
  const overallActionKeys = verificationSections.flatMap((section) => section.actions.map((action) => action.key));
  const overallProgress = getStageProgress(actions, overallActionKeys);
  const sessionConnected = typeof resolvedUserId === 'string' && resolvedUserId.length > 0;

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

                <Stack spacing={1.2} sx={{ width: { xs: '100%', md: 360 } }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 3,
                      border: `1px solid ${alpha('#ffffff', 0.12)}`,
                      bgcolor: alpha('#ffffff', 0.05),
                    }}
                  >
                    <Typography variant="caption" sx={{ color: alpha('#f8fafc', 0.64), letterSpacing: 0.3 }}>
                      Ready for review
                    </Typography>
                    <Typography variant="subtitle1" sx={{ mt: 0.35, fontWeight: 700, color: '#ffffff' }}>
                      {overallProgress.completed}/{overallProgress.total} actions passed in this browser profile
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.6, color: alpha('#f8fafc', 0.72) }}>
                      Hold the recording inside this page and run the stages top to bottom for the cleanest verification video.
                    </Typography>
                  </Box>
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

              <Box
                sx={{
                  display: 'grid',
                  gap: 1.25,
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                }}
              >
                <OverviewMetric
                  label="Session"
                  value={sessionConnected ? sessionEmail : 'Ingen aktiv bruker'}
                  tone={sessionConnected ? 'success' : 'warning'}
                />
                <OverviewMetric
                  label="Drive"
                  value={driveConnected === null ? 'Ikke lastet' : driveConnected ? 'Connected' : 'Disconnected'}
                  tone={driveConnected ? 'success' : 'warning'}
                />
                <OverviewMetric
                  label="YouTube"
                  value={youtubeConnected === null ? 'Ikke lastet' : youtubeConnected ? (youtubeChannelTitle || 'Connected') : youtubeNeedsReconnect ? 'Reconnect required' : 'Channel setup required'}
                  tone={youtubeConnected ? 'success' : 'warning'}
                />
                <OverviewMetric
                  label="Workspace storage"
                  value={workspaceStorageTotal === null ? 'Ikke lastet' : `${workspaceStorageTotal} GB`}
                />
              </Box>
            </Stack>
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.55fr) minmax(320px, 0.75fr)' },
              alignItems: 'start',
            }}
          >
            <Stack spacing={3}>
              {verificationSections.map((section) => {
                const progress = getStageProgress(actions, section.actions.map((action) => action.key));
                return (
                  <StageSection
                    key={section.id}
                    eyebrow={section.eyebrow}
                    title={section.title}
                    description={section.description}
                    accent={section.accent}
                    completed={progress.completed}
                    total={progress.total}
                    failed={progress.failed}
                  >
                    {section.actions.map((action) => (
                      <ActionCard
                        key={action.key}
                        icon={action.icon}
                        title={action.title}
                        description={action.description}
                        buttonLabel={action.buttonLabel}
                        actionKey={action.key}
                        state={actions[action.key]}
                        onRun={action.onRun}
                      />
                    ))}
                    {section.id === 'workspace' && artifacts.googleDocUrl && (
                      <Alert severity="success" variant="outlined" sx={{ borderRadius: 3 }}>
                        Dokumentet er klart i Google Docs:{' '}
                        <Link href={artifacts.googleDocUrl} target="_blank" rel="noreferrer" underline="hover">
                          Åpne dokument
                        </Link>
                      </Alert>
                    )}
                    {section.id === 'publishing' && artifacts.youtubeVideoUrl && (
                      <Alert severity="success" variant="outlined" sx={{ borderRadius: 3 }}>
                        Demo-video er tilgjengelig her:{' '}
                        <Link href={artifacts.youtubeVideoUrl} target="_blank" rel="noreferrer" underline="hover">
                          {artifacts.youtubeVideoUrl}
                        </Link>
                      </Alert>
                    )}
                  </StageSection>
                );
              })}
            </Stack>

            <Stack spacing={3}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 4,
                  border: `1px solid ${alpha('#0f172a', 0.08)}`,
                  bgcolor: '#ffffff',
                }}
              >
                <Stack spacing={1.5}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Recording checklist
                  </Typography>
                  <Typography variant="body2" sx={{ color: alpha('#0f172a', 0.68) }}>
                    Hold the recording inside the browser, keep the URL visible during OAuth, and run the stages in order.
                  </Typography>
                  <Stack spacing={1}>
                    <Alert severity={sessionConnected ? 'success' : 'warning'} variant="outlined" sx={{ borderRadius: 2.5 }}>
                      {sessionConnected
                        ? 'CreatorHub-session er aktiv og peker til riktig bruker.'
                        : 'Ingen aktiv CreatorHub-session er funnet i denne browser-profilen.'}
                    </Alert>
                    <Alert severity={driveConnected ? 'success' : 'warning'} variant="outlined" sx={{ borderRadius: 2.5 }}>
                      {driveConnected
                        ? 'Drive-tilkoblingen er klar for lesing og skriving.'
                        : 'Drive er ikke koblet opp i denne sesjonen ennå.'}
                    </Alert>
                    <Alert severity={youtubeConnected ? 'success' : 'warning'} variant="outlined" sx={{ borderRadius: 2.5 }}>
                      {youtubeConnected
                        ? `YouTube er klar${youtubeChannelTitle ? ` på kanalen ${youtubeChannelTitle}` : ''}.`
                        : youtubeNeedsReconnect
                          ? 'YouTube-scope finnes, men Google-SSO må fornyes.'
                          : 'YouTube-publisering krever at den tilkoblede Google-kontoen har en aktiv YouTube-kanal.'}
                    </Alert>
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
                <Stack spacing={1.5}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Raw diagnostics
                  </Typography>
                  <Typography variant="body2" sx={{ color: alpha('#0f172a', 0.68) }}>
                    This stays available for debugging, but it is visually secondary so the recording stays clean.
                  </Typography>
                  <Box
                    component="details"
                    sx={{
                      borderRadius: 3,
                      border: `1px solid ${alpha('#0f172a', 0.08)}`,
                      bgcolor: alpha('#f8fafc', 0.82),
                      px: 1.5,
                      py: 1.25,
                      '& > summary': {
                        cursor: 'pointer',
                        listStyle: 'none',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: '#0f172a',
                      },
                      '& > summary::-webkit-details-marker': {
                        display: 'none',
                      },
                    }}
                  >
                    <Box component="summary">Vis live overview payload</Box>
                    <PreviewJson value={overview} />
                  </Box>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
