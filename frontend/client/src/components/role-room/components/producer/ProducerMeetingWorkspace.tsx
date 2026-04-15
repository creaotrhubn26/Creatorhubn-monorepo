// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AddOutlined as AddOutlinedIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  DeleteOutline as DeleteOutlineIcon,
  LaunchOutlined as LaunchOutlinedIcon,
  SaveOutlined as SaveOutlinedIcon,
  VideoCallOutlined as VideoCallOutlinedIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerMeetingAgendaItem,
  ProducerMeetingDecisionItem,
  ProducerMeetingFollowUpItem,
  ProducerMeetingWorkspace,
  ProducerPlanningPhase,
  ProducerProjectPlanning,
  RoleRoomGoogleArtifactRef,
} from '../../models/casting';
import { googleWorkspaceApi } from '../../services/castingApiService';
import type { ProducerClientReview, ProducerTimelineItem } from '../../services/producerWorkflowService';
import {
  getProducerReviewStatusLabel,
  getProducerTimelineStatusLabel,
} from '../../utils/producerWorkflow';
import {
  buildProducerGoogleMeetSession,
} from '../../utils/producerGoogleWorkspace';
import {
  PRODUCER_PLANNER_MEETING_MODE_LABELS,
  PRODUCER_PLANNER_MEETING_TYPE_LABELS,
  PRODUCER_MEETING_WORKSPACE_STATUS_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
} from '../../utils/producerProjectPlanning';

interface ProducerMeetingWorkspaceProps {
  project: CastingProject;
  projectId: string;
  planning: ProducerProjectPlanning;
  intake: ProducerClientIntake;
  reviews: ProducerClientReview[];
  timelineItems: ProducerTimelineItem[];
  googleArtifacts: RoleRoomGoogleArtifactRef[];
  focusedArtifactId?: string | null;
  readOnly?: boolean;
  isClientReviewerMode?: boolean;
  saving?: boolean;
  onPlanningChange: (updater: (previous: ProducerProjectPlanning) => ProducerProjectPlanning) => void;
  onSavePlanning: () => Promise<void>;
  onRefreshGoogleAssets: () => Promise<void>;
}

interface MeetingSuggestion {
  id: string;
  title: string;
  detail: string;
  phase?: ProducerPlanningPhase;
  sourceType: ProducerMeetingAgendaItem['sourceType'];
  linkedEntityType?: string;
  linkedEntityId?: string;
}

const MEETING_STATUS_TONES: Record<ProducerMeetingWorkspace['status'], { background: string; color: string }> = {
  planned: { background: 'rgba(59,130,246,0.14)', color: '#bfdbfe' },
  lobby: { background: 'rgba(251,191,36,0.14)', color: '#fde68a' },
  live: { background: 'rgba(248,113,113,0.16)', color: '#fecaca' },
  follow_up: { background: 'rgba(34,197,94,0.16)', color: '#bbf7d0' },
};

const DECISION_STATUS_LABELS: Record<NonNullable<ProducerMeetingDecisionItem['status']>, string> = {
  open: 'Åpen',
  done: 'Lukket',
};

const FOLLOW_UP_STATUS_LABELS: Record<NonNullable<ProducerMeetingFollowUpItem['status']>, string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  done: 'Ferdig',
};

const MEETING_VISIBILITY_LABELS = {
  internal: 'Internt',
  client: 'Deles med klient',
} as const;

const MEETING_SOURCE_LABELS: Record<NonNullable<ProducerMeetingAgendaItem['sourceType']>, string> = {
  manual: 'Manuelt',
  client_review: 'Review',
  timeline: 'Tidslinje',
  framework: 'Retning',
};

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const formatDateTime = (value?: string | null): string => {
  if (!hasText(value)) {
    return 'Ikke satt';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.trim();
  }
  return new Intl.DateTimeFormat('nb-NO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const createMeetingItemId = (prefix: string): string => (
  globalThis.crypto?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
);

const resolveFocusedMeetingArtifact = (
  artifactId?: string | null,
): { type: 'agenda' | 'decision' | 'follow_up'; id: string } | null => {
  if (!hasText(artifactId)) {
    return null;
  }
  if (artifactId.startsWith('meeting-agenda:')) {
    return {
      type: 'agenda',
      id: artifactId.slice('meeting-agenda:'.length).trim(),
    };
  }
  if (artifactId.startsWith('meeting-decision:')) {
    return {
      type: 'decision',
      id: artifactId.slice('meeting-decision:'.length).trim(),
    };
  }
  if (artifactId.startsWith('meeting-follow-up:')) {
    return {
      type: 'follow_up',
      id: artifactId.slice('meeting-follow-up:'.length).trim(),
    };
  }
  return artifactId === 'meeting-workspace'
    ? { type: 'agenda', id: '' }
    : null;
};

const sortSuggestions = (left: MeetingSuggestion, right: MeetingSuggestion): number => {
  const sourceOrder: Record<NonNullable<MeetingSuggestion['sourceType']>, number> = {
    client_review: 0,
    timeline: 1,
    framework: 2,
    manual: 3,
  };
  if (sourceOrder[left.sourceType ?? 'manual'] !== sourceOrder[right.sourceType ?? 'manual']) {
    return sourceOrder[left.sourceType ?? 'manual'] - sourceOrder[right.sourceType ?? 'manual'];
  }
  return left.title.localeCompare(right.title, 'nb-NO');
};

const sortItemsByDate = <T extends { due_at?: string | null; requested_at?: string | null; dueAt?: string | null }>(
  values: T[],
  getFallback: (value: T) => string | null | undefined,
): T[] => (
  [...values].sort((left, right) => {
    const leftValue = left.due_at ?? left.dueAt ?? left.requested_at ?? getFallback(left);
    const rightValue = right.due_at ?? right.dueAt ?? right.requested_at ?? getFallback(right);
    const leftTime = Date.parse(leftValue ?? '');
    const rightTime = Date.parse(rightValue ?? '');
    return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime)
      - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
  })
);

export default function ProducerMeetingWorkspace({
  project,
  projectId,
  planning,
  intake,
  reviews,
  timelineItems,
  googleArtifacts,
  focusedArtifactId = null,
  readOnly = false,
  isClientReviewerMode = false,
  saving = false,
  onPlanningChange,
  onSavePlanning,
  onRefreshGoogleAssets,
}: ProducerMeetingWorkspaceProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [highlightedItemKey, setHighlightedItemKey] = useState<string | null>(null);
  const meetingWorkspace = planning.meetingWorkspace;
  const canEdit = !readOnly;
  const agendaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const decisionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const followUpRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const latestMeetArtifact = useMemo(() => (
    [...googleArtifacts]
      .filter((artifact) => hasText(artifact.meetUrl))
      .sort((left, right) => {
        const leftTime = Date.parse(left.updatedAt ?? left.createdAt ?? '');
        const rightTime = Date.parse(right.updatedAt ?? right.createdAt ?? '');
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      })[0] ?? null
  ), [googleArtifacts]);

  const decisionReviewsByMeetingItemId = useMemo(() => {
    const lookup = new Map<string, ProducerClientReview>();
    reviews.forEach((review) => {
      const metadata = review.metadata ?? {};
      const meetingItemType = typeof metadata.meetingItemType === 'string' ? metadata.meetingItemType.trim() : '';
      const meetingItemId = typeof metadata.meetingItemId === 'string' ? metadata.meetingItemId.trim() : '';
      if (review.review_type === 'meeting_decision' && meetingItemType === 'decision' && meetingItemId) {
        lookup.set(meetingItemId, review);
      }
    });
    return lookup;
  }, [reviews]);

  const timelineByMeetingKey = useMemo(() => {
    const lookup = new Map<string, ProducerTimelineItem>();
    timelineItems.forEach((item) => {
      const metadata = item.metadata ?? {};
      const meetingItemType = typeof metadata.meetingItemType === 'string' ? metadata.meetingItemType.trim() : '';
      const meetingItemId = typeof metadata.meetingItemId === 'string' ? metadata.meetingItemId.trim() : '';
      if ((meetingItemType === 'decision' || meetingItemType === 'follow_up') && meetingItemId) {
        lookup.set(`${meetingItemType}:${meetingItemId}`, item);
      }
    });
    return lookup;
  }, [timelineItems]);

  const agendaSuggestions = useMemo(() => {
    const reviewSuggestions: MeetingSuggestion[] = sortItemsByDate(
      reviews.filter((review) => review.status !== 'approved'),
      () => null,
    )
      .slice(0, 4)
      .map((review) => ({
        id: `review:${review.id}`,
        title: review.title,
        detail: review.description?.trim() || `Klientreview · ${review.review_type}`,
        phase: 'preproduction',
        sourceType: 'client_review',
        linkedEntityType: 'client_review',
        linkedEntityId: review.id,
      }));

    const timelineSuggestions: MeetingSuggestion[] = sortItemsByDate(
      timelineItems.filter((item) => item.status !== 'completed'),
      (item) => item.created_at,
    )
      .slice(0, 4)
      .map((item) => ({
        id: `timeline:${item.id}`,
        title: item.title,
        detail: item.description?.trim() || 'Operativt punkt fra prosjektets tidslinje.',
        phase: item.phase,
        sourceType: 'timeline',
        linkedEntityType: item.linked_entity_type ?? 'timeline_item',
        linkedEntityId: item.linked_entity_id ?? item.id,
      }));

    const frameworkSuggestions: MeetingSuggestion[] = (planning.activationPlan.framework ?? [])
      .filter((step) => hasText(step.focus) || hasText(step.output))
      .slice(0, 2)
      .map((step) => ({
        id: `framework:${step.key}`,
        title: step.output?.trim() || step.focus?.trim() || 'Retningspunkt',
        detail: step.notes?.trim() || step.focus?.trim() || 'Punkt fra retning og aktivering.',
        phase: step.key === 'execution' || step.key === 'evaluation' ? 'postproduction' : 'preproduction',
        sourceType: 'framework',
        linkedEntityType: 'producer_framework',
        linkedEntityId: step.key,
      }));

    return [...reviewSuggestions, ...timelineSuggestions, ...frameworkSuggestions].sort(sortSuggestions);
  }, [planning.activationPlan.framework, reviews, timelineItems]);

  const missingSuggestions = useMemo(() => {
    const existingKeys = new Set(
      meetingWorkspace.agenda.map((item) => `${item.linkedEntityType ?? 'manual'}:${item.linkedEntityId ?? item.title.trim().toLowerCase()}`),
    );
    return agendaSuggestions.filter((item) => !existingKeys.has(`${item.linkedEntityType ?? 'manual'}:${item.linkedEntityId ?? item.title.trim().toLowerCase()}`));
  }, [agendaSuggestions, meetingWorkspace.agenda]);

  const activeMeetUrl = hasText(meetingWorkspace.activeMeetUrl)
    ? meetingWorkspace.activeMeetUrl.trim()
    : latestMeetArtifact?.meetUrl?.trim() ?? '';
  const agendaReadyCount = useMemo(
    () => meetingWorkspace.agenda.filter((item) => hasText(item.title)).length,
    [meetingWorkspace.agenda],
  );
  const loggedDecisionCount = useMemo(
    () => meetingWorkspace.decisions.filter((item) => hasText(item.title)).length,
    [meetingWorkspace.decisions],
  );
  const loggedFollowUpCount = useMemo(
    () => meetingWorkspace.followUps.filter((item) => hasText(item.title)).length,
    [meetingWorkspace.followUps],
  );
  const openFollowUpCount = useMemo(
    () => meetingWorkspace.followUps.filter((item) => item.status !== 'done').length,
    [meetingWorkspace.followUps],
  );
  const meetingReadyCount = useMemo(
    () => [
      agendaReadyCount > 0 ? 'agenda' : '',
      hasText(activeMeetUrl) ? 'meet' : '',
      hasText(meetingWorkspace.liveNotes) ? 'notes' : '',
      loggedDecisionCount > 0 ? 'decisions' : '',
      loggedFollowUpCount > 0 ? 'followups' : '',
    ].filter(Boolean).length,
    [activeMeetUrl, agendaReadyCount, loggedDecisionCount, loggedFollowUpCount, meetingWorkspace.liveNotes],
  );
  const meetingMissingItems = useMemo(() => {
    const items: Array<{ id: string; label: string }> = [];
    if (agendaReadyCount === 0) {
      items.push({ id: 'meeting-agenda', label: 'Agenda mangler' });
    }
    if (!hasText(activeMeetUrl)) {
      items.push({ id: 'meeting-link', label: 'Meet-lenke er ikke opprettet ennå' });
    }
    if (!hasText(meetingWorkspace.liveNotes)) {
      items.push({ id: 'meeting-notes', label: 'Live-notater mangler' });
    }
    if (loggedDecisionCount === 0) {
      items.push({ id: 'meeting-decisions', label: 'Beslutninger er ikke loggført ennå' });
    }
    if (loggedFollowUpCount === 0) {
      items.push({ id: 'meeting-followups', label: 'Oppfølging mangler' });
    }
    return items;
  }, [activeMeetUrl, agendaReadyCount, loggedDecisionCount, loggedFollowUpCount, meetingWorkspace.liveNotes]);
  const meetingSummary = useMemo(() => {
    if (meetingMissingItems.length > 0) {
      return '';
    }
    return [
      `${agendaReadyCount} agenda`,
      `${loggedDecisionCount} beslutninger`,
      `${openFollowUpCount} åpne oppfølginger`,
      hasText(activeMeetUrl) ? 'Meet er koblet til' : '',
    ].filter(Boolean).join(' · ');
  }, [activeMeetUrl, agendaReadyCount, loggedDecisionCount, meetingMissingItems.length, openFollowUpCount]);
  const participantCount = meetingWorkspace.participants?.length ?? 0;
  const assetCount = meetingWorkspace.assets?.length ?? 0;

  const updateMeetingWorkspace = useCallback((
    updater: (workspace: ProducerMeetingWorkspace) => ProducerMeetingWorkspace,
  ) => {
    onPlanningChange((previous) => ({
      ...previous,
      meetingWorkspace: {
        ...updater(previous.meetingWorkspace),
        updatedAt: new Date().toISOString(),
      },
    }));
  }, [onPlanningChange]);

  const appendAgendaSuggestion = useCallback((suggestion: MeetingSuggestion) => {
    updateMeetingWorkspace((previous) => ({
      ...previous,
      agenda: [
        ...previous.agenda,
        {
          id: createMeetingItemId('agenda'),
          title: suggestion.title,
          detail: suggestion.detail,
          phase: suggestion.phase,
          sourceType: suggestion.sourceType,
          linkedEntityType: suggestion.linkedEntityType,
          linkedEntityId: suggestion.linkedEntityId,
          completed: false,
        },
      ],
    }));
  }, [updateMeetingWorkspace]);

  const handleImportSuggestedAgenda = useCallback(() => {
    if (missingSuggestions.length === 0) {
      return;
    }
    updateMeetingWorkspace((previous) => ({
      ...previous,
      agenda: [
        ...previous.agenda,
        ...missingSuggestions.map((suggestion) => ({
          id: createMeetingItemId('agenda'),
          title: suggestion.title,
          detail: suggestion.detail,
          phase: suggestion.phase,
          sourceType: suggestion.sourceType,
          linkedEntityType: suggestion.linkedEntityType,
          linkedEntityId: suggestion.linkedEntityId,
          completed: false,
        })),
      ],
    }));
  }, [missingSuggestions, updateMeetingWorkspace]);

  const handleCreateMeetSession = useCallback(async () => {
    try {
      setActionKey('meet-session');
      const response = await googleWorkspaceApi.createMeetSession(
        projectId,
        buildProducerGoogleMeetSession({
          project,
          planning,
          intake,
          reviews,
        }),
      );
      const meetUrl = typeof response.event?.meetUrl === 'string' ? response.event.meetUrl.trim() : '';
      const calendarEventId = typeof response.event?.calendarEventId === 'string' ? response.event.calendarEventId.trim() : '';
      const artifactId = typeof response.event?.id === 'string' ? response.event.id.trim() : '';

      updateMeetingWorkspace((previous) => ({
        ...previous,
        status: meetUrl ? 'lobby' : previous.status,
        activeMeetUrl: meetUrl || previous.activeMeetUrl,
        activeMeetArtifactId: artifactId || previous.activeMeetArtifactId,
        activeMeetCalendarEventId: calendarEventId || previous.activeMeetCalendarEventId,
      }));
      await onRefreshGoogleAssets();
      enqueueSnackbar('Google Meet er opprettet for møteflaten.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke opprette Google Meet fra møteflaten.',
        { variant: 'error' },
      );
    } finally {
      setActionKey(null);
    }
  }, [enqueueSnackbar, intake, onRefreshGoogleAssets, planning, project, projectId, reviews, updateMeetingWorkspace]);

  const handleOpenMeet = useCallback(() => {
    if (!activeMeetUrl) {
      return;
    }
    updateMeetingWorkspace((previous) => ({
      ...previous,
      status: previous.status === 'follow_up' ? previous.status : 'live',
      activeMeetUrl,
    }));
    window.open(activeMeetUrl, '_blank', 'noopener,noreferrer');
  }, [activeMeetUrl, updateMeetingWorkspace]);

  const handleSave = useCallback(async () => {
    try {
      await onSavePlanning();
      enqueueSnackbar('Møteflaten er lagret i prosjektet.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : 'Kunne ikke lagre møteflaten.',
        { variant: 'error' },
      );
    }
  }, [enqueueSnackbar, onSavePlanning]);

  useEffect(() => {
    const focusedArtifact = resolveFocusedMeetingArtifact(focusedArtifactId);
    if (!focusedArtifact) {
      return undefined;
    }

    const highlightKey = `${focusedArtifact.type}:${focusedArtifact.id}`;
    setHighlightedItemKey(highlightKey);

    const target = focusedArtifact.type === 'agenda'
      ? agendaRefs.current[focusedArtifact.id]
      : focusedArtifact.type === 'decision'
        ? decisionRefs.current[focusedArtifact.id]
        : followUpRefs.current[focusedArtifact.id];

    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedItemKey((current) => (current === highlightKey ? null : current));
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [focusedArtifactId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          p: { xs: 1.25, md: 1.5 },
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.18)',
          bgcolor: 'rgba(15,23,42,0.55)',
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.42rem', lineHeight: 1.05 }}>
              Styr møtet
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem', mt: 0.3, lineHeight: 1.5, maxWidth: 620 }}>
              {isClientReviewerMode
                ? 'Bruk denne flaten til å samle agenda, beslutninger og oppfølging rundt samme klientsync.'
                : 'Fyll inn det som må være klart før, under og etter møtet i samme prosjektflyt.'}
            </Typography>
            <Typography sx={{ color: 'rgba(191,219,254,0.68)', fontSize: '0.78rem', mt: 0.45, lineHeight: 1.45 }}>
              {`${PRODUCER_MEETING_WORKSPACE_STATUS_LABELS[meetingWorkspace.status]} · ${agendaReadyCount} agenda · ${openFollowUpCount} åpne oppfølginger`}
            </Typography>
          </Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={0.65}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            sx={{
              minWidth: { lg: 320 },
              px: 0.8,
              py: 0.7,
              borderRadius: 1.5,
              border: '1px solid rgba(96,165,250,0.08)',
              bgcolor: 'rgba(15,23,42,0.28)',
            }}
          >
            <Typography sx={{ color: 'rgba(191,219,254,0.56)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Fremdrift
            </Typography>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
              {`${meetingReadyCount}/5 klare`}
            </Typography>
            <Box
              sx={{
                width: { xs: '100%', sm: 108 },
                height: 5,
                borderRadius: 999,
                bgcolor: 'rgba(148,163,184,0.18)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${(meetingReadyCount / 5) * 100}%`,
                  height: '100%',
                  borderRadius: 999,
                  bgcolor: '#38bdf8',
                }}
              />
            </Box>
            <Typography sx={{ color: 'rgba(203,213,225,0.66)', fontSize: '0.74rem', lineHeight: 1.4 }}>
              {meetingMissingItems.length > 0
                ? `Fyll ut ${meetingMissingItems[0]?.label.toLowerCase()} før du går videre.`
                : 'Møtet er klart til å kjøres og følges opp.'}
            </Typography>
          </Stack>
        </Stack>

        {(meetingWorkspace.meetingType || meetingWorkspace.scheduledAt || meetingWorkspace.locationLabel || participantCount > 0 || assetCount > 0 || hasText(meetingWorkspace.contextSummary)) ? (
          <Box
            sx={{
              mt: 1.05,
              px: 0.8,
              py: 0.72,
              borderRadius: 1.5,
              border: '1px solid rgba(96,165,250,0.12)',
              bgcolor: 'rgba(15,23,42,0.22)',
            }}
          >
            <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
              {meetingWorkspace.meetingType ? (
                <Chip
                  size="small"
                  label={PRODUCER_PLANNER_MEETING_TYPE_LABELS[meetingWorkspace.meetingType]}
                  sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                />
              ) : null}
              {meetingWorkspace.phase ? (
                <Chip
                  size="small"
                  label={PRODUCER_PLANNING_PHASE_LABELS[meetingWorkspace.phase]}
                  sx={{ bgcolor: 'rgba(167,139,250,0.16)', color: '#e9d5ff' }}
                />
              ) : null}
              {meetingWorkspace.meetingMode ? (
                <Chip
                  size="small"
                  label={PRODUCER_PLANNER_MEETING_MODE_LABELS[meetingWorkspace.meetingMode]}
                  sx={{ bgcolor: 'rgba(34,197,94,0.16)', color: '#bbf7d0' }}
                />
              ) : null}
              {hasText(meetingWorkspace.scheduledAt) ? (
                <Chip
                  size="small"
                  label={formatDateTime(meetingWorkspace.scheduledAt)}
                  sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
                />
              ) : null}
              {hasText(meetingWorkspace.locationLabel) ? (
                <Chip
                  size="small"
                  label={meetingWorkspace.locationLabel}
                  sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }}
                />
              ) : null}
              {participantCount > 0 ? (
                <Chip
                  size="small"
                  label={`${participantCount} deltakere`}
                  sx={{ bgcolor: 'rgba(14,165,233,0.16)', color: '#bae6fd' }}
                />
              ) : null}
              {assetCount > 0 ? (
                <Chip
                  size="small"
                  label={`${assetCount} assets`}
                  sx={{ bgcolor: 'rgba(192,132,252,0.16)', color: '#f3e8ff' }}
                />
              ) : null}
            </Stack>
            {hasText(meetingWorkspace.contextSummary) ? (
              <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.82rem', mt: 0.7, lineHeight: 1.45 }}>
                {meetingWorkspace.contextSummary}
              </Typography>
            ) : null}
            {(meetingWorkspace.expectations?.length ?? 0) > 0 ? (
              <Typography sx={{ color: 'rgba(191,219,254,0.78)', fontSize: '0.78rem', mt: 0.45, lineHeight: 1.45 }}>
                {`Forventninger: ${(meetingWorkspace.expectations ?? []).join(' · ')}`}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {meetingMissingItems.length > 0 ? (
          <Box
            sx={{
              mt: 1.05,
              px: 0.8,
              py: meetingMissingItems.length <= 2 ? 0.58 : 0.72,
              borderRadius: 1.5,
              border: '1px solid rgba(96,165,250,0.1)',
              bgcolor: 'rgba(15,23,42,0.22)',
            }}
          >
            <Typography sx={{ color: 'rgba(191,219,254,0.7)', fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.35, mb: 0.32 }}>
              Dette mangler i møtet
            </Typography>
            <Stack spacing={0.18}>
              {meetingMissingItems.map((item) => (
                <Typography key={item.id} sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.4 }}>
                  • {item.label}
                </Typography>
              ))}
            </Stack>
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0.55}
            sx={{
              mt: 1.05,
              px: 0.8,
              py: 0.68,
              borderRadius: 1.5,
              border: '1px solid rgba(34,197,94,0.12)',
              bgcolor: 'rgba(15,23,42,0.22)',
            }}
          >
            <Typography
              sx={{
                color: '#86efac',
                fontSize: '0.66rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                lineHeight: 1.3,
              }}
            >
              Klart
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.79rem', lineHeight: 1.45 }}>
              {meetingSummary}
            </Typography>
          </Stack>
        )}

        <Box
          sx={{
            mt: 1.15,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: 'repeat(2, minmax(0, 1fr))' },
            gap: 1,
          }}
        >
          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.14)',
              bgcolor: 'rgba(2,6,23,0.4)',
            }}
          >
            <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Gjør dette nå
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>
              {meetingWorkspace.sessionLabel?.trim() || `Klientsync · ${project.name}`}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', mt: 0.35 }}>
              {activeMeetUrl ? 'Meet er koblet til denne møteflaten.' : 'Opprett Meet når agendaen er klar.'}
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.85 }}>
              {canEdit ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VideoCallOutlinedIcon />}
                  onClick={() => {
                    void handleCreateMeetSession();
                  }}
                  disabled={actionKey === 'meet-session'}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {actionKey === 'meet-session' ? 'Oppretter...' : 'Opprett Meet'}
                </Button>
              ) : null}
              {activeMeetUrl ? (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<LaunchOutlinedIcon />}
                  onClick={handleOpenMeet}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
                >
                  Åpne Meet
                </Button>
              ) : null}
              {(['planned', 'lobby', 'live', 'follow_up'] as const).map((status) => (
                <Button
                  key={status}
                  size="small"
                  variant={meetingWorkspace.status === status ? 'contained' : 'outlined'}
                  onClick={() => updateMeetingWorkspace((previous) => ({ ...previous, status }))}
                  disabled={!canEdit}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    ...(meetingWorkspace.status === status ? {
                      bgcolor: MEETING_STATUS_TONES[status].background,
                      color: MEETING_STATUS_TONES[status].color,
                    } : {}),
                  }}
                >
                  {PRODUCER_MEETING_WORKSPACE_STATUS_LABELS[status]}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1,
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.14)',
              bgcolor: 'rgba(2,6,23,0.4)',
            }}
          >
            <Typography sx={{ color: 'rgba(148,163,184,0.72)', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Trekk inn fra prosjektet
            </Typography>
            <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>
              {missingSuggestions.length > 0 ? `${missingSuggestions.length} forslag klare` : 'Agendaen er dekket'}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', mt: 0.35 }}>
              Hent inn reviews, tidslinje og retning før møtet, så beslutninger og oppfølging får samme utgangspunkt.
            </Typography>
            {canEdit && missingSuggestions.length > 0 ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={handleImportSuggestedAgenda}
                sx={{ mt: 0.85, textTransform: 'none', fontWeight: 700 }}
              >
                Legg inn forslag
              </Button>
            ) : null}
          </Box>
        </Box>
      </Box>

      {missingSuggestions.length > 0 ? (
        <Box
          sx={{
            p: 1.15,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            bgcolor: 'rgba(15,23,42,0.55)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Legg inn neste møtepunkter
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                Punkter fra tidslinje, reviews og retning som bør tas i samme møte.
              </Typography>
            </Box>
          </Stack>
          <Stack spacing={0.8}>
            {missingSuggestions.slice(0, 6).map((suggestion) => (
              <Box
                key={suggestion.id}
                sx={{
                  p: 0.95,
                  borderRadius: 1.35,
                  border: '1px solid rgba(148,163,184,0.14)',
                  bgcolor: 'rgba(2,6,23,0.45)',
                }}
              >
                <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.4 }}>
                      <Chip
                        size="small"
                        label={MEETING_SOURCE_LABELS[suggestion.sourceType ?? 'manual']}
                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                      />
                      {suggestion.phase ? (
                        <Chip
                          size="small"
                          label={PRODUCER_PLANNING_PHASE_LABELS[suggestion.phase]}
                          sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                        />
                      ) : null}
                    </Stack>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {suggestion.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.25 }}>
                      {suggestion.detail}
                    </Typography>
                  </Box>
                  {canEdit ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddOutlinedIcon />}
                      onClick={() => appendAgendaSuggestion(suggestion)}
                      sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                    >
                      Legg til
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', xl: '1.1fr 1fr' },
          gap: 1.25,
        }}
      >
        <Box
          sx={{
            p: 1.15,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            bgcolor: 'rgba(15,23,42,0.55)',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                Bygg agenda og noter
              </Typography>
              <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                Samle det som skal tas i møtet og skriv notatene mens dere snakker.
              </Typography>
            </Box>
            {canEdit ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AddOutlinedIcon />}
                onClick={() => updateMeetingWorkspace((previous) => ({
                  ...previous,
                  agenda: [
                    ...previous.agenda,
                    {
                      id: createMeetingItemId('agenda'),
                      title: '',
                      detail: '',
                      sourceType: 'manual',
                      completed: false,
                    },
                  ],
                }))}
                sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
              >
                Nytt agendapunkt
              </Button>
            ) : null}
          </Stack>
          <Stack spacing={0.9}>
            {meetingWorkspace.agenda.length > 0 ? meetingWorkspace.agenda.map((item) => {
              const isHighlighted = highlightedItemKey === `agenda:${item.id}` || (highlightedItemKey === 'agenda:' && meetingWorkspace.agenda[0]?.id === item.id);
              return (
              <Box
                key={item.id}
                ref={(node) => { agendaRefs.current[item.id] = node; }}
                sx={{
                  p: 1,
                  borderRadius: 1.35,
                  border: isHighlighted ? '1px solid rgba(251,191,36,0.48)' : '1px solid rgba(148,163,184,0.14)',
                  bgcolor: isHighlighted ? 'rgba(120,53,15,0.2)' : 'rgba(2,6,23,0.45)',
                }}
              >
                <Stack spacing={0.75}>
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={0.75} justifyContent="space-between">
                    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={MEETING_SOURCE_LABELS[item.sourceType ?? 'manual']}
                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                      />
                      {item.phase ? (
                        <Chip
                          size="small"
                          label={PRODUCER_PLANNING_PHASE_LABELS[item.phase]}
                          sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                        />
                      ) : null}
                      <Chip
                        size="small"
                        label={item.completed ? 'Ferdig' : 'Åpen'}
                        sx={{
                          bgcolor: item.completed ? 'rgba(34,197,94,0.14)' : 'rgba(251,191,36,0.14)',
                          color: item.completed ? '#bbf7d0' : '#fde68a',
                        }}
                      />
                    </Stack>
                    {canEdit ? (
                      <Stack direction="row" spacing={0.5}>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<CheckCircleOutlineIcon />}
                          onClick={() => updateMeetingWorkspace((previous) => ({
                            ...previous,
                            agenda: previous.agenda.map((entry) => (
                              entry.id === item.id ? { ...entry, completed: !entry.completed } : entry
                            )),
                          }))}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          {item.completed ? 'Gjenåpne' : 'Marker ferdig'}
                        </Button>
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => updateMeetingWorkspace((previous) => ({
                            ...previous,
                            agenda: previous.agenda.filter((entry) => entry.id !== item.id),
                          }))}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Slett
                        </Button>
                      </Stack>
                    ) : null}
                  </Stack>
                  <TextField
                    label="Agendatittel"
                    value={item.title}
                    onChange={(event) => updateMeetingWorkspace((previous) => ({
                      ...previous,
                      agenda: previous.agenda.map((entry) => (
                        entry.id === item.id ? { ...entry, title: event.target.value } : entry
                      )),
                    }))}
                    fullWidth
                    disabled={!canEdit}
                  />
                  <TextField
                    label="Detalj"
                    value={item.detail ?? ''}
                    onChange={(event) => updateMeetingWorkspace((previous) => ({
                      ...previous,
                      agenda: previous.agenda.map((entry) => (
                        entry.id === item.id ? { ...entry, detail: event.target.value } : entry
                      )),
                    }))}
                    fullWidth
                    multiline
                    minRows={2}
                    disabled={!canEdit}
                  />
                </Stack>
              </Box>
            ); }) : (
              <Alert severity="info">
                Agendaen er tom. Legg inn foreslåtte punkter eller opprett egne.
              </Alert>
            )}

            <TextField
              label="Live-notater"
              value={meetingWorkspace.liveNotes ?? ''}
              onChange={(event) => updateMeetingWorkspace((previous) => ({
                ...previous,
                liveNotes: event.target.value,
              }))}
              fullWidth
              multiline
              minRows={6}
              disabled={!canEdit}
            />
          </Stack>
        </Box>

        <Stack spacing={1.25}>
          <Box
            sx={{
              p: 1.15,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              bgcolor: 'rgba(15,23,42,0.55)',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Loggfør beslutninger
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                  Det som ble bestemt i møtet og skal videreføres i prosjektet.
                </Typography>
              </Box>
              {canEdit ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => updateMeetingWorkspace((previous) => ({
                    ...previous,
                    decisions: [
                      ...previous.decisions,
                      { id: createMeetingItemId('decision'), title: '', phase: 'preproduction', status: 'open', clientVisible: false },
                    ],
                  }))}
                  sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                >
                  Ny beslutning
                </Button>
              ) : null}
            </Stack>
            <Stack spacing={0.8}>
              {meetingWorkspace.decisions.length > 0 ? meetingWorkspace.decisions.map((item) => {
                const syncedReview = decisionReviewsByMeetingItemId.get(item.id);
                const syncedTimelineItem = timelineByMeetingKey.get(`decision:${item.id}`);
                const isHighlighted = highlightedItemKey === `decision:${item.id}`;
                return (
                <Box
                  key={item.id}
                  ref={(node) => { decisionRefs.current[item.id] = node; }}
                  sx={{
                    p: 0.95,
                    borderRadius: 1.35,
                    border: isHighlighted ? '1px solid rgba(251,191,36,0.48)' : '1px solid rgba(148,163,184,0.14)',
                    bgcolor: isHighlighted ? 'rgba(120,53,15,0.2)' : 'rgba(2,6,23,0.45)',
                  }}
                >
                  <Stack spacing={0.75}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={0.75}>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={DECISION_STATUS_LABELS[item.status ?? 'open']}
                          sx={{
                            alignSelf: 'flex-start',
                            bgcolor: item.status === 'done' ? 'rgba(34,197,94,0.14)' : 'rgba(59,130,246,0.14)',
                            color: item.status === 'done' ? '#bbf7d0' : '#bfdbfe',
                          }}
                        />
                        {item.phase ? (
                          <Chip
                            size="small"
                            label={PRODUCER_PLANNING_PHASE_LABELS[item.phase]}
                            sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff' }}
                          />
                        ) : null}
                        <Chip
                          size="small"
                          label={item.clientVisible ? MEETING_VISIBILITY_LABELS.client : MEETING_VISIBILITY_LABELS.internal}
                          sx={{
                            bgcolor: item.clientVisible ? 'rgba(56,189,248,0.16)' : 'rgba(148,163,184,0.14)',
                            color: item.clientVisible ? '#bfdbfe' : '#cbd5e1',
                          }}
                        />
                        {syncedReview ? (
                          <Chip
                            size="small"
                            label={`Klientsamarbeid · ${getProducerReviewStatusLabel(syncedReview.status)}`}
                            sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#bfdbfe' }}
                          />
                        ) : null}
                        {syncedTimelineItem ? (
                          <Chip
                            size="small"
                            label={`Tidslinje · ${getProducerTimelineStatusLabel(syncedTimelineItem.status)}`}
                            sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                          />
                        ) : null}
                      </Stack>
                      {canEdit ? (
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => updateMeetingWorkspace((previous) => ({
                            ...previous,
                            decisions: previous.decisions.filter((entry) => entry.id !== item.id),
                          }))}
                          sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                        >
                          Slett
                        </Button>
                      ) : null}
                    </Stack>
                    <TextField
                      label="Beslutning"
                      value={item.title}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        decisions: previous.decisions.map((entry) => (
                          entry.id === item.id ? { ...entry, title: event.target.value } : entry
                        )),
                      }))}
                      fullWidth
                      disabled={!canEdit}
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                      <TextField
                        select
                        label="Fase"
                        SelectProps={{ native: true }}
                        value={item.phase ?? 'preproduction'}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          decisions: previous.decisions.map((entry) => (
                            entry.id === item.id ? {
                              ...entry,
                              phase: event.target.value === 'production'
                                ? 'production'
                                : event.target.value === 'postproduction'
                                  ? 'postproduction'
                                  : 'preproduction',
                            } : entry
                          )),
                        }))}
                        disabled={!canEdit}
                        fullWidth
                      >
                        <option value="preproduction">Pre-produksjon</option>
                        <option value="production">Produksjon</option>
                        <option value="postproduction">Post-produksjon</option>
                      </TextField>
                      <TextField
                        label="Ansvarlig"
                        value={item.owner ?? ''}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          decisions: previous.decisions.map((entry) => (
                            entry.id === item.id ? { ...entry, owner: event.target.value } : entry
                          )),
                        }))}
                        fullWidth
                        disabled={!canEdit}
                      />
                      <TextField
                        label="Frist"
                        type="datetime-local"
                        value={item.dueAt ?? ''}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          decisions: previous.decisions.map((entry) => (
                            entry.id === item.id ? { ...entry, dueAt: event.target.value } : entry
                          )),
                        }))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        disabled={!canEdit}
                      />
                    </Stack>
                    <TextField
                      select
                      label="Synlighet"
                      SelectProps={{ native: true }}
                      value={item.clientVisible ? 'client' : 'internal'}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        decisions: previous.decisions.map((entry) => (
                          entry.id === item.id ? {
                            ...entry,
                            clientVisible: event.target.value === 'client',
                          } : entry
                        )),
                      }))}
                      disabled={!canEdit}
                    >
                      <option value="internal">Intern beslutning</option>
                      <option value="client">Klientsynlig beslutning</option>
                    </TextField>
                    <TextField
                      select
                      label="Status"
                      SelectProps={{ native: true }}
                      value={item.status ?? 'open'}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        decisions: previous.decisions.map((entry) => (
                          entry.id === item.id ? { ...entry, status: event.target.value === 'done' ? 'done' : 'open' } : entry
                        )),
                      }))}
                      disabled={!canEdit}
                    >
                      <option value="open">Åpen</option>
                      <option value="done">Lukket</option>
                    </TextField>
                    <TextField
                      label="Notat"
                      value={item.notes ?? ''}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        decisions: previous.decisions.map((entry) => (
                          entry.id === item.id ? { ...entry, notes: event.target.value } : entry
                        )),
                      }))}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={!canEdit}
                    />
                  </Stack>
                </Box>
              ); }) : (
                <Alert severity="info">Ingen beslutninger er loggført ennå.</Alert>
              )}
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.15,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              bgcolor: 'rgba(15,23,42,0.55)',
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Fordel oppfølging
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                  Det som må gjøres etter møtet, med ansvar og frister.
                </Typography>
              </Box>
              {canEdit ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddOutlinedIcon />}
                  onClick={() => updateMeetingWorkspace((previous) => ({
                    ...previous,
                    followUps: [
                      ...previous.followUps,
                      { id: createMeetingItemId('follow-up'), title: '', phase: 'preproduction', status: 'planned' },
                    ],
                  }))}
                  sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                >
                  Ny oppfølging
                </Button>
              ) : null}
            </Stack>
            <Stack spacing={0.8}>
              {meetingWorkspace.followUps.length > 0 ? meetingWorkspace.followUps.map((item) => {
                const syncedTimelineItem = timelineByMeetingKey.get(`follow_up:${item.id}`);
                const isHighlighted = highlightedItemKey === `follow_up:${item.id}`;
                return (
                <Box
                  key={item.id}
                  ref={(node) => { followUpRefs.current[item.id] = node; }}
                  sx={{
                    p: 0.95,
                    borderRadius: 1.35,
                    border: isHighlighted ? '1px solid rgba(251,191,36,0.48)' : '1px solid rgba(148,163,184,0.14)',
                    bgcolor: isHighlighted ? 'rgba(120,53,15,0.2)' : 'rgba(2,6,23,0.45)',
                  }}
                >
                  <Stack spacing={0.75}>
                    <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={0.75}>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={FOLLOW_UP_STATUS_LABELS[item.status ?? 'planned']}
                          sx={{
                            alignSelf: 'flex-start',
                            bgcolor: item.status === 'done'
                              ? 'rgba(34,197,94,0.14)'
                              : item.status === 'in_progress'
                                ? 'rgba(251,191,36,0.14)'
                                : 'rgba(59,130,246,0.14)',
                            color: item.status === 'done'
                              ? '#bbf7d0'
                              : item.status === 'in_progress'
                                ? '#fde68a'
                                : '#bfdbfe',
                          }}
                        />
                        {item.phase ? (
                          <Chip
                            size="small"
                            label={PRODUCER_PLANNING_PHASE_LABELS[item.phase]}
                            sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#e9d5ff' }}
                          />
                        ) : null}
                        {syncedTimelineItem ? (
                          <Chip
                            size="small"
                            label={`Tidslinje · ${getProducerTimelineStatusLabel(syncedTimelineItem.status)}`}
                            sx={{ bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                          />
                        ) : null}
                      </Stack>
                      {canEdit ? (
                        <Button
                          size="small"
                          color="inherit"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() => updateMeetingWorkspace((previous) => ({
                            ...previous,
                            followUps: previous.followUps.filter((entry) => entry.id !== item.id),
                          }))}
                          sx={{ textTransform: 'none', fontWeight: 700, alignSelf: 'flex-start' }}
                        >
                          Slett
                        </Button>
                      ) : null}
                    </Stack>
                    <TextField
                      label="Oppgave"
                      value={item.title}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        followUps: previous.followUps.map((entry) => (
                          entry.id === item.id ? { ...entry, title: event.target.value } : entry
                        )),
                      }))}
                      fullWidth
                      disabled={!canEdit}
                    />
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.75}>
                      <TextField
                        select
                        label="Fase"
                        SelectProps={{ native: true }}
                        value={item.phase ?? 'preproduction'}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          followUps: previous.followUps.map((entry) => (
                            entry.id === item.id ? {
                              ...entry,
                              phase: event.target.value === 'production'
                                ? 'production'
                                : event.target.value === 'postproduction'
                                  ? 'postproduction'
                                  : 'preproduction',
                            } : entry
                          )),
                        }))}
                        disabled={!canEdit}
                        fullWidth
                      >
                        <option value="preproduction">Pre-produksjon</option>
                        <option value="production">Produksjon</option>
                        <option value="postproduction">Post-produksjon</option>
                      </TextField>
                      <TextField
                        label="Ansvarlig"
                        value={item.owner ?? ''}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          followUps: previous.followUps.map((entry) => (
                            entry.id === item.id ? { ...entry, owner: event.target.value } : entry
                          )),
                        }))}
                        fullWidth
                        disabled={!canEdit}
                      />
                      <TextField
                        label="Frist"
                        type="datetime-local"
                        value={item.dueAt ?? ''}
                        onChange={(event) => updateMeetingWorkspace((previous) => ({
                          ...previous,
                          followUps: previous.followUps.map((entry) => (
                            entry.id === item.id ? { ...entry, dueAt: event.target.value } : entry
                          )),
                        }))}
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        disabled={!canEdit}
                      />
                    </Stack>
                    <TextField
                      select
                      label="Status"
                      SelectProps={{ native: true }}
                      value={item.status ?? 'planned'}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        followUps: previous.followUps.map((entry) => (
                          entry.id === item.id ? {
                            ...entry,
                            status: event.target.value === 'done'
                              ? 'done'
                              : event.target.value === 'in_progress'
                                ? 'in_progress'
                                : 'planned',
                          } : entry
                        )),
                      }))}
                      disabled={!canEdit}
                    >
                      <option value="planned">Planlagt</option>
                      <option value="in_progress">Pågår</option>
                      <option value="done">Ferdig</option>
                    </TextField>
                    <TextField
                      label="Notat"
                      value={item.notes ?? ''}
                      onChange={(event) => updateMeetingWorkspace((previous) => ({
                        ...previous,
                        followUps: previous.followUps.map((entry) => (
                          entry.id === item.id ? { ...entry, notes: event.target.value } : entry
                        )),
                      }))}
                      fullWidth
                      multiline
                      minRows={2}
                      disabled={!canEdit}
                    />
                  </Stack>
                </Box>
              ); }) : (
                <Alert severity="info">Ingen oppfølgingspunkter er lagt inn ennå.</Alert>
              )}
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.25} alignItems={{ md: 'center' }}>
        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem' }}>
          {activeMeetUrl
            ? `Siste Meet-lenke er tilgjengelig. Oppdatert ${formatDateTime(latestMeetArtifact?.updatedAt ?? latestMeetArtifact?.createdAt)}.`
            : 'Opprett en Meet-sesjon når agendaen er klar, og hold resten av møtet i samme arbeidsflate.'} Lagring synker beslutninger og oppfølging til klientsamarbeid og tidslinje.
        </Typography>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          onClick={() => {
            void handleSave();
          }}
          disabled={!canEdit || saving}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#f97316', '&:hover': { bgcolor: '#ea580c' } }}
        >
          {saving ? 'Lagrer møteflate...' : 'Lagre møteflate'}
        </Button>
      </Stack>
    </Box>
  );
}
