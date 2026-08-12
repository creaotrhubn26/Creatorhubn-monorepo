import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CloudDoneOutlined as CloudDoneOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  HubOutlined as HubOutlinedIcon,
  LaunchOutlined as LaunchOutlinedIcon,
  LinkOffOutlined as LinkOffOutlinedIcon,
  PersonAddAlt1Outlined as PersonAddAlt1OutlinedIcon,
  PersonSearchOutlined as PersonSearchOutlinedIcon,
  VideoCallOutlined as VideoCallOutlinedIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerProjectPlanning,
  ProducerWorkspaceSurfaceKey,
  RoleRoomGoogleArtifactRef,
  RoleRoomGoogleConnection,
  RoleRoomGooglePersonContact,
  RoleRoomGoogleProjectBinding,
  ShotList,
} from '../../models/casting';
import {
  googleWorkspaceApi,
  type RoleRoomGoogleStatusResponse,
} from '../../services/castingApiService';
import { useProjectProductionEstimate } from '../../hooks/useProjectProductionEstimate';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import {
  buildProducerGoogleCalendarEvents,
  buildProducerGoogleGeneratedArtifacts,
  buildProducerGoogleMeetSession,
  collectRoleRoomGoogleProjectFileIds,
  getProducerWorkspaceSurfaceForGoogleFolder,
} from '../../utils/producerGoogleWorkspace';
import type { ProjectFileRecord } from '../../utils/projectFiles';
import { getRoleRoomReturnPath } from '../../utils/runtime';
import { describeProducerError, isTransientProducerError } from '../../utils/producerErrorMessage';
import RoleRoomGoogleCollaborationWorkspace from './RoleRoomGoogleCollaborationWorkspace';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

interface ProducerGoogleWorkspacePanelProps {
  project: CastingProject;
  projectId: string;
  projectName: string;
  planning: ProducerProjectPlanning;
  intake: ProducerClientIntake;
  materials: ProducerClientMaterial[];
  shotLists: ShotList[];
  projectFiles: ProjectFileRecord[];
  readOnly?: boolean;
  isClientReviewerMode?: boolean;
  onOpenWorkspace: (surface: ProducerWorkspaceSurfaceKey, options?: { artifactId?: string }) => void;
  onGoogleContactImported?: (contact: RoleRoomGooglePersonContact) => Promise<void>;
}

const buildCONNECTION_STATE_LABELS = (t: TFn): Record<string, string> => ({
  disconnected: t('googleWs.s011'),
  connected: t('googleWs.s018'),
  expired: t('googleWs.s038'),
  error: t('googleWs.s006'),
});

const buildFOLDER_LABELS = (t: TFn): Record<string, string> => ({
  brief: t('googleWs.s002'),
  materials: t('googleWs.s025'),
  brand: t('googleWs.s026'),
  delivery: t('googleWs.s023'),
  approvals: t('googleWs.s007'),
  meetings: t('googleWs.s027'),
});

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const formatDateTime = (t: TFn, value?: string | null): string => {
  if (!hasText(value)) {
    return t('googleWs.s013');
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

const getReturnPath = (): string => {
  if (typeof window === 'undefined') {
    return getRoleRoomReturnPath(null);
  }
  return getRoleRoomReturnPath(window.location);
};

const sortArtifacts = (artifacts: RoleRoomGoogleArtifactRef[]): RoleRoomGoogleArtifactRef[] => (
  [...artifacts].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || left.createdAt || '');
    const rightTime = Date.parse(right.updatedAt || right.createdAt || '');
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  })
);

const EMPTY_PRODUCTION_DAYS: NonNullable<CastingProject['productionDays']> = [];

export default function ProducerGoogleWorkspacePanel({
  project,
  projectId,
  projectName,
  planning,
  intake,
  materials,
  shotLists,
  projectFiles,
  readOnly = false,
  isClientReviewerMode = false,
  onOpenWorkspace,
  onGoogleContactImported,
}: ProducerGoogleWorkspacePanelProps) {
  const { t } = useT();
  const FOLDER_LABELS = useMemo(() => buildFOLDER_LABELS(t), [t]);
  const { enqueueSnackbar } = useSnackbar();
  const [googleStatus, setGoogleStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [autoBootstrapFailed, setAutoBootstrapFailed] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleResults, setPeopleResults] = useState<RoleRoomGooglePersonContact[]>([]);
  const autoBindingRequestKeyRef = useRef<string | null>(null);
  const statusRequestRef = useRef(0);
  const peopleRequestRef = useRef(0);

  const canManageGoogleWorkspace = !readOnly && !isClientReviewerMode;
  const { items: reviewItems } = useProducerReviews(projectId);
  const { productionEstimate } = useProjectProductionEstimate({
    projectId,
    initialProject: project,
    initialShotLists: shotLists,
    initialProductionDays: project.productionDays ?? EMPTY_PRODUCTION_DAYS,
  });

  const loadGoogleStatus = useCallback(async () => {
    const requestId = ++statusRequestRef.current;
    setLoadingStatus(true);
    setLocalError(null);
    try {
      const status = await googleWorkspaceApi.getStatus(projectId);
      if (requestId !== statusRequestRef.current) {
        return;
      }
      setGoogleStatus(status);
    } catch (statusError) {
      if (requestId !== statusRequestRef.current) {
        return;
      }
      console.error('[ProducerGoogleWorkspacePanel] Failed to load Workspace state', statusError);
      setLocalError(statusError instanceof Error ? statusError.message : t('googleWs.s020'));
    } finally {
      if (requestId === statusRequestRef.current) {
        setLoadingStatus(false);
      }
    }
  }, [projectId]);

  useEffect(() => {
    void loadGoogleStatus();
  }, [loadGoogleStatus]);

  useEffect(() => () => {
    statusRequestRef.current += 1;
    peopleRequestRef.current += 1;
  }, []);

  const connection: RoleRoomGoogleConnection | null = googleStatus?.connection ?? null;
  const binding: RoleRoomGoogleProjectBinding | null = googleStatus?.projectBinding ?? null;
  const artifacts = googleStatus?.artifacts ?? [];
  const driveIsReady = hasText(binding?.driveRootFolderId);
  const calendarIsReady = hasText(binding?.calendarId);
  const projectWorkspaceReady = driveIsReady && calendarIsReady;

  const recentArtifacts = useMemo(
    () => sortArtifacts(artifacts).slice(0, 6),
    [artifacts],
  );

  const projectFileIds = useMemo(
    () => collectRoleRoomGoogleProjectFileIds(projectFiles, materials),
    [materials, projectFiles],
  );

  const generatedArtifacts = useMemo(
    () => buildProducerGoogleGeneratedArtifacts({
      project,
      planning,
      intake,
      materials,
      reviews: reviewItems,
      estimate: productionEstimate,
    }),
    [intake, materials, planning, project, productionEstimate, reviewItems],
  );

  const calendarEvents = useMemo(
    () => buildProducerGoogleCalendarEvents({
      project,
      planning,
      intake,
      reviews: reviewItems,
    }),
    [intake, planning, project, reviewItems],
  );

  const meetSession = useMemo(
    () => buildProducerGoogleMeetSession({
      project,
      planning,
      intake,
      reviews: reviewItems,
    }),
    [intake, planning, project, reviewItems],
  );

  const folderEntries = useMemo(
    () => Object.entries(binding?.folderLayout ?? {}).filter(([, folderId]) => hasText(folderId)),
    [binding?.folderLayout],
  );

  useEffect(() => {
    if (!canManageGoogleWorkspace || !googleStatus?.configured || connection?.state !== 'connected' || projectWorkspaceReady) {
      return;
    }

    if (actionKey && actionKey !== 'binding') {
      return;
    }

    const requestKey = `${projectId}:${connection?.googleSubject ?? connection?.googleEmail ?? connection?.state ?? 'connected'}:${driveIsReady ? 'drive' : 'no-drive'}:${calendarIsReady ? 'calendar' : 'no-calendar'}`;
    if (autoBindingRequestKeyRef.current === requestKey) {
      return;
    }
    autoBindingRequestKeyRef.current = requestKey;

    let cancelled = false;
    setActionKey('binding');

    void googleWorkspaceApi.provisionProjectWorkspace(projectId, binding?.contactsContext ?? {})
      .then((response) => {
        if (cancelled || !response) {
          return;
        }
        setGoogleStatus((previous) => (
          previous
            ? {
                ...previous,
                projectBinding: response.binding,
                artifacts: response.artifacts,
              }
            : previous
        ));
        setAutoBootstrapFailed(false);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.warn('[ProducerGoogleWorkspacePanel] Automatic Google Workspace bootstrap failed', error);
        setAutoBootstrapFailed(true);
        // Skill offline/midlertidig fra ekte feil — ellers tror Stig at oppsettet
        // er ødelagt når backend bare er utilgjengelig akkurat nå.
        setLocalError(
          isTransientProducerError(error)
            ? t('googleWs.s016')
            : describeProducerError(error, t('googleWs.s042')),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setActionKey((current) => (current === 'binding' ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    actionKey,
    binding,
    calendarIsReady,
    canManageGoogleWorkspace,
    connection?.googleEmail,
    connection?.googleSubject,
    connection?.state,
    driveIsReady,
    googleStatus?.configured,
    projectId,
    projectWorkspaceReady,
  ]);

  const runAction = useCallback(async (
    nextActionKey: string,
    action: () => Promise<void>,
    successMessage: string,
  ) => {
    setActionKey(nextActionKey);
    setLocalError(null);
    try {
      await action();
      enqueueSnackbar(successMessage, { variant: 'success' });
      await loadGoogleStatus();
    } catch (actionError) {
      console.error(`[ProducerGoogleWorkspacePanel] ${nextActionKey} failed`, actionError);
      const message = actionError instanceof Error ? actionError.message : 'Google Workspace-handlingen feilet.';
      setLocalError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setActionKey(null);
    }
  }, [enqueueSnackbar, loadGoogleStatus]);

  const handleStartGoogleLink = useCallback(async () => {
    try {
      setActionKey('connect');
      const response = await googleWorkspaceApi.startOauth({
        mode: 'link',
        projectId,
        returnPath: getReturnPath(),
        email: project.clientEmail ?? intake.contactEmail ?? undefined,
      });
      if (!hasText(response.authorizationUrl)) {
        throw new Error(t('googleWs.s024'));
      }
      window.location.assign(response.authorizationUrl);
    } catch (linkError) {
      console.error('[ProducerGoogleWorkspacePanel] Failed to start Google Workspace link', linkError);
      const message = linkError instanceof Error ? linkError.message : t('googleWs.s021');
      setLocalError(message);
      enqueueSnackbar(message, { variant: 'error' });
      setActionKey(null);
    }
  }, [enqueueSnackbar, intake.contactEmail, project.clientEmail, projectId]);

  const handleCreateBinding = useCallback(async () => {
    await runAction(
      'binding',
        async () => {
        await googleWorkspaceApi.provisionProjectWorkspace(projectId, binding?.contactsContext ?? {});
      },
      t('googleWs.s008'),
    );
  }, [binding, projectId, runAction]);

  const handleDisconnect = useCallback(async () => {
    await runAction(
      'disconnect',
      async () => {
        await googleWorkspaceApi.unlink();
      },
      t('googleWs.s009'),
    );
  }, [runAction]);

  const handleDriveSync = useCallback(async () => {
    await runAction(
      'drive-sync',
      async () => {
        if (projectFileIds.length === 0 && generatedArtifacts.length === 0) {
          throw new Error(t('googleWs.s004'));
        }
        await googleWorkspaceApi.syncDrive(projectId, {
          fileIds: projectFileIds,
          generatedArtifacts,
        });
      },
      t('googleWs.s040'),
    );
  }, [generatedArtifacts, projectFileIds, projectId, runAction]);

  const handleCalendarSync = useCallback(async () => {
    await runAction(
      'calendar-sync',
      async () => {
        if (calendarEvents.length === 0) {
          throw new Error(t('googleWs.s005'));
        }
        await googleWorkspaceApi.syncCalendar(projectId, {
          events: calendarEvents,
          calendarId: binding?.calendarId ?? undefined,
        });
      },
      t('googleWs.s029'),
    );
  }, [binding?.calendarId, calendarEvents, projectId, runAction]);

  const handleCreateMeetSession = useCallback(async () => {
    await runAction(
      'meet-session',
      async () => {
        const response = await googleWorkspaceApi.createMeetSession(projectId, meetSession);
        const meetUrl = typeof response.event?.meetUrl === 'string' ? response.event.meetUrl : '';
        if (meetUrl) {
          window.open(meetUrl, '_blank', 'noopener,noreferrer');
        }
      },
      t('googleWs.s017'),
    );
  }, [meetSession, projectId, runAction]);

  const handleSearchPeople = useCallback(async () => {
    if (!peopleQuery.trim()) {
      peopleRequestRef.current += 1;
      setPeopleResults([]);
      setPeopleLoading(false);
      return;
    }

    const requestId = ++peopleRequestRef.current;
    setPeopleLoading(true);
    setLocalError(null);
    try {
      const response = await googleWorkspaceApi.searchPeople(projectId, peopleQuery.trim());
      if (requestId !== peopleRequestRef.current) {
        return;
      }
      setPeopleResults(response.contacts);
      if (canManageGoogleWorkspace) {
        await googleWorkspaceApi.saveProjectBinding(projectId, {
          contactsContext: {
            ...(binding?.contactsContext ?? {}),
            ...response.contactsContext,
          },
          createDriveLayout: false,
          createCalendar: false,
        });
      }
    } catch (searchError) {
      if (requestId !== peopleRequestRef.current) {
        return;
      }
      console.error('[ProducerGoogleWorkspacePanel] Failed to search Google contacts', searchError);
      const message = searchError instanceof Error ? searchError.message : t('googleWs.s022');
      setLocalError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      if (requestId === peopleRequestRef.current) {
        setPeopleLoading(false);
      }
    }
  }, [binding?.contactsContext, canManageGoogleWorkspace, enqueueSnackbar, peopleQuery, projectId]);

  const handleImportContact = useCallback(async (contact: RoleRoomGooglePersonContact) => {
    if (!onGoogleContactImported) {
      return;
    }
    await runAction(
      `import-contact:${contact.resourceName ?? contact.email ?? contact.name ?? 'contact'}`,
      async () => {
        await onGoogleContactImported(contact);
        await googleWorkspaceApi.saveProjectBinding(projectId, {
          contactsContext: {
            ...(binding?.contactsContext ?? {}),
            importedContact: {
              resourceName: contact.resourceName ?? null,
              name: contact.name ?? null,
              email: contact.email ?? null,
              phone: contact.phone ?? null,
              organization: contact.organization ?? null,
              importedAt: new Date().toISOString(),
            },
          },
          createDriveLayout: false,
          createCalendar: false,
        });
      },
      t('googleWs.p00', { v0: contact.name ?? contact.email ?? t('googleWs.s019') }),
    );
  }, [binding?.contactsContext, onGoogleContactImported, projectId, runAction]);

  const googleWorkspaceVisible = Boolean(
    googleStatus?.configured && connection?.state === 'connected' && projectWorkspaceReady,
  );

  if (!googleWorkspaceVisible) {
    return null;
  }

  return (
    <Box
      sx={{
        p: { xs: 1.25, md: 1.5 },
        borderRadius: 2,
        border: '1px solid rgba(59,130,246,0.24)',
        background: 'linear-gradient(145deg, rgba(15,23,42,0.88) 0%, rgba(17,24,39,0.74) 100%)',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1} justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.45 }}>
              <HubOutlinedIcon sx={{ color: '#93c5fd' }} />
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                {t('googleWs.s041')}
              </Typography>
            </Stack>
              <Typography sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.9rem', maxWidth: 980 }}>
              {t('googleWs.s031')}
              </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`Drive ${artifacts.filter((artifact) => artifact.artifactType === 'drive_file').length}`} />
            <Chip size="small" label={`Kalender ${artifacts.filter((artifact) => artifact.artifactType === 'calendar_event').length}`} />
            <Chip size="small" label={`Planhendelser ${calendarEvents.length}`} />
          </Stack>
        </Stack>

        {localError ? <Alert severity="error">{localError}</Alert> : null}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: canManageGoogleWorkspace ? 'minmax(0, 1.15fr) minmax(0, 0.95fr)' : '1fr' },
            gap: 1.1,
          }}
        >
          <Box
            sx={{
              p: 1.15,
              borderRadius: 1.75,
              border: '1px solid rgba(148,163,184,0.16)',
              bgcolor: 'rgba(15,23,42,0.54)',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  {t('googleWs.s000')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                  {t('googleWs.s030')}
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} flexWrap="wrap" useFlexGap>
                {canManageGoogleWorkspace ? (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<CloudSyncOutlinedIcon />}
                      onClick={() => {
                        void handleDriveSync();
                      }}
                      disabled={actionKey === 'drive-sync'}
                    >
                      {actionKey === 'drive-sync' ? 'Synker...' : t('googleWs.s033')}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CalendarMonthOutlinedIcon />}
                      onClick={() => {
                        void handleCalendarSync();
                      }}
                      disabled={actionKey === 'calendar-sync'}
                    >
                      {actionKey === 'calendar-sync' ? 'Synker...' : t('googleWs.s032')}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<VideoCallOutlinedIcon />}
                      onClick={() => {
                        void handleCreateMeetSession();
                      }}
                      disabled={actionKey === 'meet-session'}
                    >
                      {actionKey === 'meet-session' ? 'Oppretter...' : t('googleWs.s028')}
                    </Button>
                  </>
                ) : null}
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                  gap: 0.85,
                }}
              >
                <Box sx={{ p: 1, borderRadius: 1.35, bgcolor: 'rgba(2,6,23,0.52)', border: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Drive-rot
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 600, mt: 0.35 }}>
                    {binding?.driveRootFolderId || t('googleWs.s012')}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 1.35, bgcolor: 'rgba(2,6,23,0.52)', border: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Kalender
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 600, mt: 0.35 }}>
                    {binding?.calendarId || t('googleWs.s012')}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 1.35, bgcolor: 'rgba(2,6,23,0.52)', border: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Siste Drive-sync
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 600, mt: 0.35 }}>
                    {formatDateTime(t, binding?.lastDriveSyncAt)}
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: 1.35, bgcolor: 'rgba(2,6,23,0.52)', border: '1px solid rgba(148,163,184,0.12)' }}>
                  <Typography sx={{ color: 'rgba(148,163,184,0.74)', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Siste kalendersync
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 600, mt: 0.35 }}>
                    {formatDateTime(t, binding?.lastCalendarSyncAt)}
                  </Typography>
                </Box>
              </Box>

              {folderEntries.length > 0 ? (
                <>
                  <Divider sx={{ borderColor: 'rgba(148,163,184,0.14)' }} />
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {folderEntries.map(([folderKey, folderId]) => (
                      <Chip
                        key={folderKey}
                        size="small"
                        label={`${FOLDER_LABELS[folderKey] ?? folderKey} · ${String(folderId).slice(0, 16)}`}
                        onClick={() => onOpenWorkspace(getProducerWorkspaceSurfaceForGoogleFolder(folderKey))}
                        sx={{ bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}
                      />
                    ))}
                  </Stack>
                </>
              ) : null}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.15,
              borderRadius: 1.75,
              border: '1px solid rgba(148,163,184,0.16)',
              bgcolor: 'rgba(15,23,42,0.54)',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Delte artefakter
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                  {t('googleWs.s039')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`${projectFileIds.length} prosjektfiler`} />
                <Chip size="small" label={`${generatedArtifacts.length} genererte artefakter`} />
                <Chip size="small" label={`${calendarEvents.length} planhendelser`} />
              </Stack>
              {recentArtifacts.length > 0 ? (
                <Stack spacing={0.75}>
                  {recentArtifacts.map((artifact) => (
                    <Box
                      key={artifact.id}
                      sx={{
                        p: 0.95,
                        borderRadius: 1.25,
                        border: '1px solid rgba(148,163,184,0.12)',
                        bgcolor: 'rgba(2,6,23,0.48)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                            <Chip
                              size="small"
                              label={FOLDER_LABELS[artifact.folderKey ?? 'brief'] ?? artifact.folderKey ?? t('googleWs.s001')}
                              sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                            />
                            <Typography sx={{ color: '#fff', fontWeight: 600 }} noWrap>
                              {artifact.sourceLabel || artifact.localEntityId}
                            </Typography>
                          </Stack>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                            {artifact.localEntityType} {t('googleWs.s043')} {formatDateTime(t, artifact.updatedAt ?? artifact.createdAt)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={0.35} alignItems="center">
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => onOpenWorkspace(
                              getProducerWorkspaceSurfaceForGoogleFolder(artifact.folderKey),
                              { artifactId: artifact.localEntityId || artifact.id },
                            )}
                          >
                            {t('googleWs.s045')}
                          </Button>
                          {hasText(artifact.webViewUrl) ? (
                            <Tooltip title={t('googleWs.s044')}>
                              <IconButton
                                size="small"
                                component="a"
                                href={artifact.webViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <LaunchOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Alert severity="info">
                  {t('googleWs.s015')}
                </Alert>
              )}
            </Stack>
          </Box>
        </Box>

        {canManageGoogleWorkspace ? (
          <Box
            sx={{
              p: 1.15,
              borderRadius: 1.75,
              border: '1px solid rgba(148,163,184,0.16)',
              bgcolor: 'rgba(15,23,42,0.54)',
            }}
          >
            <Stack spacing={1}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  {t('googleWs.s010')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.35 }}>
                  {t('googleWs.s003')}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                <TextField
                  value={peopleQuery}
                  onChange={(event) => setPeopleQuery(event.target.value)}
                  placeholder={t('googleWs.s036')}
                  size="small"
                  fullWidth
                />
                <Button
                  variant="outlined"
                  startIcon={<PersonSearchOutlinedIcon />}
                  onClick={() => {
                    void handleSearchPeople();
                  }}
                  disabled={!connection || peopleLoading}
                >
                  {peopleLoading ? t('googleWs.s037') : t('googleWs.s035')}
                </Button>
              </Stack>
              {peopleResults.length > 0 ? (
                <Stack spacing={0.75}>
                  {peopleResults.map((contact, contactIndex) => (
                    <Box
                      key={contact.resourceName ?? contact.email ?? contact.name ?? `contact-${contactIndex}`}
                      sx={{
                        p: 0.95,
                        borderRadius: 1.25,
                        border: '1px solid rgba(148,163,184,0.12)',
                        bgcolor: 'rgba(2,6,23,0.48)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} justifyContent="space-between">
                        <Box>
                          <Typography sx={{ color: '#fff', fontWeight: 600 }}>
                            {contact.name ?? contact.email ?? 'Kontakt'}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>
                            {[contact.email, contact.phone, contact.organization].filter(hasText).join(' · ')}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PersonAddAlt1OutlinedIcon />}
                          onClick={() => {
                            void handleImportContact(contact);
                          }}
                        >
                          {t('googleWs.s014')}
                        </Button>
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.8rem' }}>
                  {t('googleWs.s034')}
                </Typography>
              )}
            </Stack>
          </Box>
        ) : null}

        <RoleRoomGoogleCollaborationWorkspace
          projectId={projectId}
          projectName={projectName}
          binding={binding}
          connected={connection?.state === 'connected'}
          canManageGoogleWorkspace={canManageGoogleWorkspace}
          onRefreshStatus={loadGoogleStatus}
        />
      </Stack>
    </Box>
  );
}
