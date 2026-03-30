import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Menu, MenuItem, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import {
  CalendarMonthOutlined as CalendarMonthOutlinedIcon,
  CloudSyncOutlined as CloudSyncOutlinedIcon,
  HubOutlined as HubOutlinedIcon,
  LaunchOutlined as LaunchOutlinedIcon,
  MoreHorizOutlined as MoreHorizOutlinedIcon,
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

const renderActionIcon = (action: 'drive-sync' | 'calendar-sync' | 'meet-session') => {
  if (action === 'calendar-sync') {
    return <CalendarMonthOutlinedIcon />;
  }
  if (action === 'meet-session') {
    return <VideoCallOutlinedIcon />;
  }
  return <CloudSyncOutlinedIcon />;
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

const EMPTY_SHOT_LISTS: NonNullable<CastingProject['shotLists']> = [];
const EMPTY_PRODUCTION_DAYS: NonNullable<CastingProject['productionDays']> = [];

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectFiles } = useProject();
  const [status, setStatus] = useState<RoleRoomGoogleStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [autoBootstrapFailed, setAutoBootstrapFailed] = useState(false);
  const [intake, setIntake] = useState<ProducerClientIntake>(EMPTY_INTAKE);
  const [materials, setMaterials] = useState<ProducerClientMaterial[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFileRecord[]>([]);
  const [overflowAnchorEl, setOverflowAnchorEl] = useState<HTMLElement | null>(null);
  const lastAutoSyncedCalendarSignatureRef = useRef<string | null>(null);
  const autoBindingRequestKeyRef = useRef<string | null>(null);
  const statusRequestRef = useRef(0);
  const projectDataRequestRef = useRef(0);

  const planning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const { items: reviewItems } = useProducerReviews(projectId);
  const { productionEstimate } = useProjectProductionEstimate({
    projectId,
    initialProject: project,
    initialShotLists: project.shotLists ?? EMPTY_SHOT_LISTS,
    initialProductionDays: project.productionDays ?? EMPTY_PRODUCTION_DAYS,
  });

  const loadStatus = useCallback(async () => {
    const requestId = ++statusRequestRef.current;
    setLoading(true);
    try {
      const nextStatus = await googleWorkspaceApi.getStatus(projectId);
      if (requestId !== statusRequestRef.current) {
        return;
      }
      setStatus(nextStatus);
    } catch (error) {
      if (requestId !== statusRequestRef.current) {
        return;
      }
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke hente Google Workspace-status.',
        { variant: 'error' },
      );
    } finally {
      if (requestId === statusRequestRef.current) {
        setLoading(false);
      }
    }
  }, [enqueueSnackbar, projectId]);

  const loadProjectData = useCallback(async () => {
    const requestId = ++projectDataRequestRef.current;
    setLoadingProjectData(true);
    try {
      const [nextIntake, nextMaterials, nextProjectFiles] = await Promise.all([
        producerWorkflowService.getClientIntake(projectId),
        producerWorkflowService.getClientMaterials(projectId),
        getProjectFiles(projectId),
      ]);
      if (requestId !== projectDataRequestRef.current) {
        return;
      }
      setIntake(nextIntake);
      setMaterials(nextMaterials);
      setProjectFiles(normalizeProjectFileRecords(nextProjectFiles));
    } catch (error) {
      if (requestId !== projectDataRequestRef.current) {
        return;
      }
      console.error('[RoleRoomGoogleContextBar] Failed to load project data', error);
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke hente prosjektgrunnlaget for Google Workspace.',
        { variant: 'error' },
      );
    } finally {
      if (requestId === projectDataRequestRef.current) {
        setLoadingProjectData(false);
      }
    }
  }, [enqueueSnackbar, getProjectFiles, projectId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    void loadProjectData();
  }, [loadProjectData]);

  useEffect(() => () => {
    statusRequestRef.current += 1;
    projectDataRequestRef.current += 1;
  }, []);

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
        error instanceof Error ? error.message : 'Kunne ikke starte Google-aktiveringen.',
        { variant: 'error' },
      );
      setActionKey(null);
    }
  }, [enqueueSnackbar, projectId]);

  const handleCreateBinding = useCallback(async () => {
    try {
      setActionKey('binding');
      await googleWorkspaceApi.ensureProjectBindingReady(projectId, binding);
      enqueueSnackbar('Google Workspace er klart for prosjektet.', { variant: 'success' });
      await refreshAll();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke sette opp Google Workspace for prosjektet.',
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

  const connectionState = connection?.state ?? status?.state ?? 'disconnected';
  const driveIsReady = hasText(binding?.driveRootFolderId);
  const calendarIsReady = hasText(binding?.calendarId);
  const projectIsBound = driveIsReady || calendarIsReady;
  const projectIsFullyReady = driveIsReady && calendarIsReady;

  useEffect(() => {
    if (!canManage || !status?.configured || connectionState !== 'connected' || projectIsFullyReady) {
      return;
    }

    if (actionKey && actionKey !== 'binding') {
      return;
    }

    const requestKey = `${projectId}:${connection?.googleSubject ?? connection?.googleEmail ?? connectionState}:${driveIsReady ? 'drive' : 'no-drive'}:${calendarIsReady ? 'calendar' : 'no-calendar'}`;
    if (autoBindingRequestKeyRef.current === requestKey) {
      return;
    }
    autoBindingRequestKeyRef.current = requestKey;

    let cancelled = false;
    setActionKey('binding');

    void googleWorkspaceApi.ensureProjectBindingReady(projectId, binding)
      .then((response) => {
        if (cancelled || !response) {
          return;
        }
        setStatus((previous) => (
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
        console.warn('[RoleRoomGoogleContextBar] Automatic Google Workspace bootstrap failed', error);
        setAutoBootstrapFailed(true);
        enqueueSnackbar('Google Workspace er aktivert, men prosjektet kunne ikke fullføre automatisk oppsett ennå.', {
          variant: 'warning',
        });
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
    canManage,
    connection?.googleEmail,
    connection?.googleSubject,
    connectionState,
    driveIsReady,
    enqueueSnackbar,
    projectId,
    projectIsFullyReady,
    status?.configured,
  ]);

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

  const connectionTone = useMemo(() => {
    if (!status) {
      return {
        background: 'rgba(148,163,184,0.12)',
        border: 'rgba(148,163,184,0.22)',
        color: '#e2e8f0',
        label: 'Henter status',
      };
    }

    if (!status?.configured) {
      return {
        background: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.28)',
        color: '#fde68a',
        label: 'Server ikke klar',
      };
    }

    if (connectionState !== 'connected') {
      return {
        background: 'rgba(59,130,246,0.12)',
        border: 'rgba(59,130,246,0.28)',
        color: '#bfdbfe',
        label: CONNECTION_STATE_LABELS[connectionState] ?? connectionState,
      };
    }

    if (!projectIsBound) {
      return {
        background: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.28)',
        color: '#fde68a',
        label: autoBootstrapFailed ? 'Oppsett feilet' : 'Setter opp arbeidsflate',
      };
    }

    return {
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.26)',
      color: '#bbf7d0',
      label: 'Koblet',
    };
  }, [autoBootstrapFailed, connectionState, projectIsBound, status?.configured]);

  const summaryTokens = useMemo(() => [
    `${artifacts.length} artefakter`,
    `${materials.length} materiale`,
    `${reviewItems.length} reviews`,
  ], [artifacts.length, materials.length, reviewItems.length]);

  const workspaceStateTokens = useMemo(() => [
    `Drive ${hasText(binding?.driveRootFolderId) ? 'klar' : connectionState === 'connected' ? (actionKey === 'binding' ? 'settes opp' : 'mangler') : 'ikke koblet'}`,
    `Kalender ${hasText(binding?.calendarId) ? 'klar' : connectionState === 'connected' ? (actionKey === 'binding' ? 'settes opp' : 'mangler') : 'ikke koblet'}`,
    `Meet ${recentMeetUrl ? 'klar' : connectionState === 'connected' ? 'klar ved behov' : 'ikke koblet'}`,
  ], [actionKey, binding?.calendarId, binding?.driveRootFolderId, connectionState, recentMeetUrl]);

  const compactDescription = useMemo(() => {
    if (status?.configured && connectionState === 'connected' && projectIsBound) {
      return `${projectName} er koblet til samme Workspace-grunnlag som resten av Role Room.`;
    }
    return isMobile
      ? `${projectName} bruker samme Google-lag som resten av workspacet.`
      : `${projectName} bruker samme Google-lag på tvers av fanene. Denne flaten peker inn i riktig workspace-side og samme Drive-/kalendergrunnlag.`;
  }, [connectionState, isMobile, projectIsBound, projectName, status?.configured]);

  const statusStripText = useMemo(() => {
    if (!status) {
      return 'Henter Google Workspace-status for prosjektet.';
    }
    if (!status.configured) {
      const missingCount = status.missing?.length ?? 0;
      return `Google Workspace er ikke konfigurert på serveren ennå.${missingCount > 0 ? ` Mangler ${missingCount} miljøvariabler.` : ''}`;
    }
    if (connectionState !== 'connected') {
      return 'Aktiver Google én gang for å bruke samme Drive-, kalender- og Meet-lag videre på tvers av workspacet.';
    }
    if (!projectIsFullyReady && actionKey === 'binding') {
      return 'Setter opp Drive og kalender automatisk for prosjektet.';
    }
    if (!projectIsFullyReady && autoBootstrapFailed) {
      return 'Google Workspace er aktivert, men automatisk prosjektoppsett feilet. Bruk retry hvis Drive eller kalender fortsatt mangler.';
    }
    if (!projectIsBound) {
      return 'Prosjektet settes opp automatisk ved første Google-bruk.';
    }
    return quickActionSummary;
  }, [actionKey, autoBootstrapFailed, connectionState, projectIsBound, projectIsFullyReady, quickActionSummary, status]);

  const primaryButtonConfig = useMemo(() => {
    if (!canManage) {
      return null;
    }

    if (connectionState !== 'connected') {
      return {
        key: 'connect',
        label: actionKey === 'connect' ? 'Aktiverer...' : 'Aktiver Google',
        icon: <HubOutlinedIcon />,
        onClick: () => {
          void handleConnect();
        },
        disabled: !status?.configured || actionKey === 'connect',
      };
    }

    if (!projectIsBound && autoBootstrapFailed) {
      return {
        key: 'binding',
        label: actionKey === 'binding' ? 'Setter opp...' : 'Prøv oppsett igjen',
        icon: <CloudSyncOutlinedIcon />,
        onClick: () => {
          void handleCreateBinding();
        },
        disabled: actionKey === 'binding',
      };
    }

    if (!projectIsBound) {
      return null;
    }

    return {
      key: primaryAction,
      label: actionKey === primaryAction ? 'Jobber...' : ACTION_LABELS[primaryAction],
      icon: renderActionIcon(primaryAction),
      onClick: () => {
        void handleContextAction(primaryAction);
      },
      disabled: actionKey === primaryAction || loadingProjectData,
    };
  }, [
    actionKey,
    canManage,
    connectionState,
    handleConnect,
    handleContextAction,
    handleCreateBinding,
    loadingProjectData,
    primaryAction,
    projectIsBound,
    autoBootstrapFailed,
    status?.configured,
  ]);

  const secondaryButtonConfig = useMemo(() => {
    if (!canManage || connectionState !== 'connected' || !projectIsBound || !secondaryAction || secondaryAction === primaryAction) {
      return null;
    }

    return {
      key: secondaryAction,
      label: actionKey === secondaryAction ? 'Jobber...' : ACTION_LABELS[secondaryAction],
      icon: renderActionIcon(secondaryAction),
      onClick: () => {
        void handleContextAction(secondaryAction);
      },
      disabled: actionKey === secondaryAction || loadingProjectData,
    };
  }, [
    actionKey,
    canManage,
    connectionState,
    handleContextAction,
    loadingProjectData,
    primaryAction,
    projectIsBound,
    secondaryAction,
  ]);

  const supportLinks = useMemo(() => {
    const links: Array<{ key: string; label: string; href: string }> = [];
    if (driveUrl) {
      links.push({ key: 'drive', label: 'Åpne Drive', href: driveUrl });
    }
    if (calendarUrl) {
      links.push({ key: 'calendar', label: 'Åpne kalender', href: calendarUrl });
    }
    if (recentMeetUrl) {
      links.push({ key: 'meet', label: 'Åpne siste Meet', href: recentMeetUrl });
    }
    return links;
  }, [calendarUrl, driveUrl, recentMeetUrl]);

  const overflowOpen = Boolean(overflowAnchorEl);

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
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} justifyContent="space-between">
        <Stack spacing={0.8} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Stack direction="row" spacing={0.9} alignItems="center">
              <HubOutlinedIcon sx={{ color: '#93c5fd', fontSize: 18 }} />
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Google Workspace · {contextLabel}
              </Typography>
            </Stack>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1.05,
                py: 0.38,
                borderRadius: 999,
                border: `1px solid ${connectionTone.border}`,
                bgcolor: connectionTone.background,
              }}
            >
              <Typography sx={{ color: connectionTone.color, fontSize: '0.73rem', fontWeight: 700 }}>
                {connectionTone.label}
              </Typography>
            </Box>
          </Stack>

          {!isMobile ? (
            <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.82rem', maxWidth: 1180 }}>
              {compactDescription}
            </Typography>
          ) : null}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75} useFlexGap flexWrap="wrap" alignItems={{ xs: 'flex-start', md: 'center' }}>
            {!isMobile ? (
              <Stack direction="row" spacing={0.55} useFlexGap flexWrap="wrap">
                {summaryTokens.map((token) => (
                  <Box
                    key={token}
                    sx={{
                      px: 0.95,
                      py: 0.38,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.12)',
                      border: '1px solid rgba(148,163,184,0.22)',
                    }}
                  >
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.72rem', fontWeight: 600 }}>
                      {token}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            ) : null}
            <Typography sx={{ color: 'rgba(191,219,254,0.9)', fontSize: '0.76rem' }}>
              {workspaceStateTokens.join(' · ')}
            </Typography>
          </Stack>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={0.8}
          useFlexGap
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
          sx={{ flexShrink: 0 }}
        >
          {primaryButtonConfig ? (
            <Button
              size="small"
              variant="contained"
              startIcon={primaryButtonConfig.icon}
              onClick={primaryButtonConfig.onClick}
              disabled={primaryButtonConfig.disabled}
              sx={{ textTransform: 'none', fontWeight: 700, minWidth: 152, minHeight: 44 }}
            >
              {primaryButtonConfig.label}
            </Button>
          ) : null}
          {secondaryButtonConfig ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={secondaryButtonConfig.icon}
              onClick={secondaryButtonConfig.onClick}
              disabled={secondaryButtonConfig.disabled}
              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
            >
              {secondaryButtonConfig.label}
            </Button>
          ) : null}
          <Button
            size="small"
            variant="outlined"
            startIcon={<MoreHorizOutlinedIcon />}
            onClick={(event) => {
              setOverflowAnchorEl(event.currentTarget);
            }}
            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
          >
            Flere
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', lg: 'row' },
          alignItems: { xs: 'flex-start', lg: 'center' },
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          py: 0.95,
          borderRadius: 2.5,
          border: status?.configured ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(245,158,11,0.28)',
          bgcolor: status?.configured ? 'rgba(15,23,42,0.54)' : 'rgba(120,53,15,0.22)',
        }}
      >
        <Stack direction="row" spacing={0.9} alignItems="center">
          <CloudSyncOutlinedIcon
            sx={{
              fontSize: 18,
              color: status?.configured ? '#93c5fd' : '#fbbf24',
            }}
          />
          <Typography sx={{ color: status?.configured ? '#eff6ff' : '#fef3c7', fontSize: '0.82rem', fontWeight: 600 }}>
            {statusStripText}
          </Typography>
        </Stack>
        {!isMobile ? (
          <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.76rem' }}>
            {workspaceStateTokens.join(' · ')}
          </Typography>
        ) : null}
      </Box>

      <Menu
        anchorEl={overflowAnchorEl}
        open={overflowOpen}
        onClose={() => setOverflowAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 0.6,
            minWidth: 210,
            borderRadius: 2,
            bgcolor: 'rgba(15,23,42,0.96)',
            border: '1px solid rgba(148,163,184,0.18)',
            color: '#e2e8f0',
            backdropFilter: 'blur(12px)',
          },
        }}
      >
        <MenuItem
          onClick={() => {
            setOverflowAnchorEl(null);
            onOpenWorkspace(workspaceFocus);
          }}
          sx={{ gap: 1, fontSize: '0.88rem' }}
        >
          <LaunchOutlinedIcon sx={{ fontSize: 17 }} />
          Åpne workspace
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOverflowAnchorEl(null);
            void refreshAll();
          }}
          disabled={loading || loadingProjectData}
          sx={{ gap: 1, fontSize: '0.88rem' }}
        >
          <RefreshOutlinedIcon sx={{ fontSize: 17 }} />
          Oppdater
        </MenuItem>
        {supportLinks.map((link) => (
          <MenuItem
            key={link.key}
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              setOverflowAnchorEl(null);
            }}
            sx={{ gap: 1, fontSize: '0.88rem' }}
          >
            <LaunchOutlinedIcon sx={{ fontSize: 17 }} />
            {link.label}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
