import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  HubOutlined as HubOutlinedIcon,
  LaunchOutlined as LaunchOutlinedIcon,
  RefreshOutlined as RefreshOutlinedIcon,
  VideoCallOutlined as VideoCallOutlinedIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useProject } from '../../../../contexts/ProjectContext';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerClientMaterial,
} from '../../models/casting';
import { useProjectProductionEstimate } from '../../hooks/useProjectProductionEstimate';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import {
  googleWorkspaceApi,
  type RoleRoomGoogleStatusResponse,
} from '../../services/castingApiService';
import { producerWorkflowService } from '../../services/producerWorkflowService';
import type { ClientPortalWorkspaceFocus } from '../../utils/clientPortal';
import {
  buildProducerGoogleCalendarEvents,
  buildProducerGoogleGeneratedArtifacts,
  buildProducerGoogleMeetSession,
  collectRoleRoomGoogleProjectFileIds,
} from '../../utils/producerGoogleWorkspace';
import { normalizeProducerProjectPlanning } from '../../utils/producerProjectPlanning';
import { normalizeProjectFileRecords, type ProjectFileRecord } from '../../utils/projectFiles';

interface RoleRoomGoogleContextBarProps {
  project: CastingProject;
  projectId: string;
  projectName: string;
  contextLabel: string;
  workspaceFocus: ClientPortalWorkspaceFocus;
  primaryAction: 'drive-sync' | 'calendar-sync' | 'meet-session';
  secondaryAction?: 'drive-sync' | 'calendar-sync' | 'meet-session';
  canManage?: boolean;
  onOpenWorkspace: (focus: ClientPortalWorkspaceFocus) => void;
}

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const CONNECTION_STATE_LABELS: Record<string, string> = {
  disconnected: 'Ikke koblet',
  connected: 'Koblet',
  expired: 'Utløpt',
  error: 'Feil',
};

const ACTION_LABELS: Record<'drive-sync' | 'calendar-sync' | 'meet-session', string> = {
  'drive-sync': 'Synk Drive',
  'calendar-sync': 'Synk kalender',
  'meet-session': 'Opprett Meet',
};

const EMPTY_INTAKE: ProducerClientIntake = {
  projectGoal: '',
  deliverables: '',
  targetAudience: '',
  keyMessage: '',
  timingConstraints: '',
  brandNotes: '',
  materialOverview: '',
  referenceLinks: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  additionalNotes: '',
};

const getReturnPath = (): string => {
  if (typeof window === 'undefined') {
    return '/casting.html';
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const buildDriveFolderUrl = (folderId?: string | null): string => (
  hasText(folderId) ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId.trim())}` : ''
);

const buildCalendarUrl = (calendarId?: string | null): string => (
  hasText(calendarId) ? `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(calendarId.trim())}` : ''
);

export default function RoleRoomGoogleContextBar({
  project,
  projectId,
  projectName,
  contextLabel,
  workspaceFocus,
  primaryAction,
  secondaryAction,
  canManage = false,
  onOpenWorkspace,
}: RoleRoomGoogleContextBarProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectFiles } = useProject();
  const [status, setStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [intake, setIntake] = useState<ProducerClientIntake>(EMPTY_INTAKE);
  const [materials, setMaterials] = useState<ProducerClientMaterial[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
  const lastAutoSyncedCalendarSignatureRef = useRef<string | null>(null);

  const planning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const { items: reviewItems } = useProducerReviews(projectId);
  const { productionEstimate } = useProjectProductionEstimate({
    projectId,
    initialProject: project,
    initialShotLists: project.shotLists ?? [],
    initialProductionDays: project.productionDays ?? [],
  });

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const nextStatus = await googleWorkspaceApi.getStatus(projectId);
      setStatus(nextStatus);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke hente Google Workspace-status.',
        { variant: 'error' },
      );
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, projectId]);

  const loadProjectData = useCallback(async () => {
    setLoadingProjectData(true);
    try {
      const [nextIntake, nextMaterials, nextProjectFiles] = await Promise.all([
        producerWorkflowService.getClientIntake(projectId),
        producerWorkflowService.getClientMaterials(projectId),
        getProjectFiles(projectId),
      ]);
      setIntake(nextIntake);
      setMaterials(nextMaterials);
      setProjectFiles(normalizeProjectFileRecords(nextProjectFiles));
    } catch (error) {
      console.error('[RoleRoomGoogleContextBar] Failed to load project data', error);
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke hente prosjektgrunnlaget for Google Workspace.',
        { variant: 'error' },
      );
    } finally {
      setLoadingProjectData(false);
    }
  }, [enqueueSnackbar, getProjectFiles, projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadProjectData();
  }, [loadProjectData]);

  const connection = status?.connection ?? null;
  const binding = status?.projectBinding ?? null;
  const artifacts = status?.artifacts ?? [];
  const recentMeetUrl = useMemo(() => (
    artifacts.find((artifact) => hasText(artifact.meetUrl))?.meetUrl ?? ''
  ), [artifacts]);
  const driveUrl = buildDriveFolderUrl(binding?.driveRootFolderId);
  const calendarUrl = buildCalendarUrl(binding?.calendarId);
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
    [intake, materials, planning, productionEstimate, project, reviewItems],
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
  const calendarEventsSignature = useMemo(
    () => JSON.stringify(calendarEvents.map((event) => ({
      entityType: event.entityType,
      entityId: event.entityId,
      title: event.title,
      start: event.start,
      end: event.end,
      phase: event.phase ?? null,
      includeMeet: event.includeMeet ?? false,
      allDay: event.allDay ?? false,
      location: event.location ?? null,
      attendeeEmails: (event.attendees ?? []).map((attendee) => attendee.email).sort(),
    }))),
    [calendarEvents],
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

  const refreshAll = useCallback(async () => {
    await Promise.all([loadStatus(), loadProjectData()]);
  }, [loadProjectData, loadStatus]);

  const handleConnect = useCallback(async () => {
    try {
      setActionKey('connect');
      const response = await googleWorkspaceApi.startOauth({
        mode: 'link',
        projectId,
        returnPath: getReturnPath(),
      });
      if (!hasText(response.authorizationUrl)) {
        throw new Error('Mangler autorisasjonslenke fra Google Workspace.');
      }
      window.location.assign(response.authorizationUrl);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke starte Google Workspace-koblingen.',
        { variant: 'error' },
      );
      setActionKey(null);
    }
  }, [enqueueSnackbar, projectId]);

  const handleCreateBinding = useCallback(async () => {
    try {
      setActionKey('binding');
      await googleWorkspaceApi.saveProjectBinding(projectId, {
        contactsContext: binding?.contactsContext ?? {},
        meetCreationEnabled: binding?.meetCreationEnabled ?? true,
        auditSignatureStorageEnabled: binding?.auditSignatureStorageEnabled ?? true,
        createDriveLayout: !hasText(binding?.driveRootFolderId),
        createCalendar: !hasText(binding?.calendarId),
      });
      enqueueSnackbar('Google Workspace er klargjort for prosjektet.', { variant: 'success' });
      await refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke klargjøre Google Workspace for prosjektet.',
        { variant: 'error' },
      );
    } finally {
      setActionKey(null);
    }
  }, [
    binding?.auditSignatureStorageEnabled,
    binding?.calendarId,
    binding?.contactsContext,
    binding?.driveRootFolderId,
    binding?.meetCreationEnabled,
    enqueueSnackbar,
    projectId,
    refreshAll,
  ]);

  const handleDriveSync = useCallback(async () => {
    if (projectFileIds.length === 0 && generatedArtifacts.length === 0) {
      enqueueSnackbar('Fant ingen filer eller genererte artefakter å synkronisere.', { variant: 'warning' });
      return;
    }

    try {
      setActionKey('drive-sync');
      await googleWorkspaceApi.syncDrive(projectId, {
        fileIds: projectFileIds,
        generatedArtifacts,
      });
      enqueueSnackbar('Workspace-filer og artefakter er synket til Google Drive.', { variant: 'success' });
      await refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke synkronisere prosjektet til Google Drive.',
        { variant: 'error' },
      );
    } finally {
      setActionKey(null);
    }
  }, [enqueueSnackbar, generatedArtifacts, projectFileIds, projectId, refreshAll]);

  const handleCalendarSync = useCallback(async () => {
    if (calendarEvents.length === 0) {
      enqueueSnackbar('Fant ingen planhendelser å synkronisere til kalenderen.', { variant: 'warning' });
      return;
    }

    try {
      setActionKey('calendar-sync');
      await googleWorkspaceApi.syncCalendar(projectId, {
        events: calendarEvents,
        calendarId: binding?.calendarId ?? undefined,
      });
      lastAutoSyncedCalendarSignatureRef.current = calendarEventsSignature;
      enqueueSnackbar('Plan og milepæler er synket til Google Kalender.', { variant: 'success' });
      await refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke synkronisere kalenderhendelser.',
        { variant: 'error' },
      );
    } finally {
      setActionKey(null);
    }
  }, [binding?.calendarId, calendarEvents, calendarEventsSignature, enqueueSnackbar, projectId, refreshAll]);

  const handleMeetSession = useCallback(async () => {
    try {
      setActionKey('meet-session');
      const response = await googleWorkspaceApi.createMeetSession(projectId, meetSession);
      const meetUrl = typeof response.event?.meetUrl === 'string' ? response.event.meetUrl.trim() : '';
      enqueueSnackbar('Klientsync med Google Meet er opprettet.', { variant: 'success' });
      await refreshAll();
      if (meetUrl) {
        window.open(meetUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke opprette Google Meet-sesjon.',
        { variant: 'error' },
      );
    } finally {
      setActionKey(null);
    }
  }, [enqueueSnackbar, meetSession, projectId, refreshAll]);

  useEffect(() => {
    lastAutoSyncedCalendarSignatureRef.current = null;
  }, [projectId]);

  useEffect(() => {
    const shouldAutoSyncCalendar = canManage
      && connection?.state === 'connected'
      && ['Tidslinje', 'Klientsamarbeid'].includes(contextLabel)
      && calendarEvents.length > 0
      && !loading
      && !loadingProjectData
      && !actionKey;

    if (!shouldAutoSyncCalendar) {
      return undefined;
    }

    if (lastAutoSyncedCalendarSignatureRef.current === calendarEventsSignature) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setActionKey('calendar-sync');
          await googleWorkspaceApi.syncCalendar(projectId, {
            events: calendarEvents,
            calendarId: binding?.calendarId ?? undefined,
          });
          lastAutoSyncedCalendarSignatureRef.current = calendarEventsSignature;
          await refreshAll();
        } catch (error) {
          enqueueSnackbar(
            error instanceof Error ? error.message : 'Kunne ikke automatisk synkronisere kalenderhendelser.',
            { variant: 'error' },
          );
        } finally {
          setActionKey(null);
        }
      })();
    }, 1200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    actionKey,
    binding?.calendarId,
    calendarEvents,
    calendarEvents.length,
    calendarEventsSignature,
    canManage,
    connection?.state,
    contextLabel,
    enqueueSnackbar,
    loading,
    loadingProjectData,
    projectId,
    refreshAll,
  ]);

  const handleContextAction = useCallback(async (nextAction: 'drive-sync' | 'calendar-sync' | 'meet-session') => {
    if (!connection && canManage) {
      await handleConnect();
      return;
    }

    if (connection && !binding?.driveRootFolderId && !binding?.calendarId && canManage) {
      await handleCreateBinding();
      return;
    }

    if (nextAction === 'calendar-sync') {
      await handleCalendarSync();
      return;
    }

    if (nextAction === 'meet-session') {
      await handleMeetSession();
      return;
    }

    await handleDriveSync();
  }, [
    binding?.calendarId,
    binding?.driveRootFolderId,
    canManage,
    connection,
    handleCalendarSync,
    handleConnect,
    handleCreateBinding,
    handleDriveSync,
    handleMeetSession,
  ]);

  const quickActions = useMemo(() => {
    const requested = [primaryAction, secondaryAction].filter(
      (value): value is 'drive-sync' | 'calendar-sync' | 'meet-session' => Boolean(value),
    );
    return Array.from(new Set(requested));
  }, [primaryAction, secondaryAction]);

  const quickActionSummary = useMemo(() => {
    if (primaryAction === 'calendar-sync') {
      return `${calendarEvents.length} planhendelser er klare for Google Kalender.`;
    }
    if (primaryAction === 'meet-session') {
      return reviewItems.length > 0
        ? `${reviewItems.filter((item) => item.status !== 'approved').length} åpne reviews kan brukes i neste klientsync.`
        : 'Meet-flyten bruker samme review- og planstatus som resten av Role Room.';
    }
    return `${generatedArtifacts.length} genererte artefakter og ${projectFileIds.length} prosjektfiler kan synkes til Drive.`;
  }, [calendarEvents.length, generatedArtifacts.length, primaryAction, projectFileIds.length, reviewItems]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        px: { xs: 1.5, md: 2.5 },
        py: 1.1,
        borderBottom: '1px solid rgba(148,163,184,0.14)',
        background: 'linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(17,24,39,0.88) 100%)',
      }}
    >
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.3 }}>
            <HubOutlinedIcon sx={{ color: '#93c5fd', fontSize: 18 }} />
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Google Workspace · {contextLabel}
            </Typography>
          </Stack>
          <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem' }}>
            {projectName} bruker samme Google-lag på tvers av fanene. Denne fanen peker inn i riktig workspace-side og samme Drive-/kalendergrunnlag.
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            size="small"
            label={connection ? CONNECTION_STATE_LABELS[connection.state] ?? connection.state : 'Ikke koblet'}
            sx={{
              bgcolor: connection?.state === 'connected' ? 'rgba(34,197,94,0.16)' : 'rgba(148,163,184,0.12)',
              color: connection?.state === 'connected' ? '#bbf7d0' : '#e2e8f0',
            }}
          />
          <Chip size="small" label={`Artefakter ${artifacts.length}`} />
          <Chip size="small" label={`Materiale ${materials.length}`} />
          <Chip size="small" label={`Reviews ${reviewItems.length}`} />
          <Chip size="small" label={binding?.calendarId ? 'Kalender aktiv' : 'Kalender ikke klargjort'} />
          <Button
            size="small"
            variant="outlined"
            startIcon={<LaunchOutlinedIcon />}
            onClick={() => onOpenWorkspace(workspaceFocus)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Åpne workspace
          </Button>
          {canManage && connection && quickActions.map((nextAction) => (
            <Button
              key={nextAction}
              size="small"
              variant={nextAction === primaryAction ? 'contained' : 'outlined'}
              startIcon={
                nextAction === 'calendar-sync'
                  ? <CalendarMonthOutlinedIcon />
                  : nextAction === 'meet-session'
                    ? <VideoCallOutlinedIcon />
                    : <CloudSyncOutlinedIcon />
              }
              onClick={() => {
                void handleContextAction(nextAction);
              }}
              disabled={actionKey === nextAction || loadingProjectData}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {actionKey === nextAction ? 'Jobber...' : ACTION_LABELS[nextAction]}
            </Button>
          ))}
          {canManage && !connection ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<HubOutlinedIcon />}
              onClick={() => {
                void handleConnect();
              }}
              disabled={!status?.configured || actionKey === 'connect'}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {actionKey === 'connect' ? 'Kobler...' : 'Koble Google'}
            </Button>
          ) : null}
          {canManage && connection && !binding?.driveRootFolderId && !binding?.calendarId ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<CloudSyncOutlinedIcon />}
              onClick={() => {
                void handleCreateBinding();
              }}
              disabled={actionKey === 'binding'}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {actionKey === 'binding' ? 'Klargjør...' : 'Klargjør prosjekt'}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="text"
            startIcon={<RefreshOutlinedIcon />}
            onClick={() => {
              void refreshAll();
            }}
            disabled={loading || loadingProjectData}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Oppdater
          </Button>
        </Stack>
      </Stack>

      {!status?.configured ? (
        <Alert severity="warning">
          Google Workspace er ikke konfigurert på serveren ennå.
        </Alert>
      ) : null}
      {status?.configured ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(15,23,42,0.44)', color: '#dbeafe' }}>
          {quickActionSummary}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
        {driveUrl ? (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<LaunchOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Åpne Drive
          </Button>
        ) : null}
        {calendarUrl ? (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<LaunchOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Åpne kalender
          </Button>
        ) : null}
        {recentMeetUrl ? (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={recentMeetUrl}
            target="_blank"
            rel="noopener noreferrer"
            startIcon={<LaunchOutlinedIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Åpne siste Meet
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
