import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import {
  AddTask as AddTaskIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoAwesome as AutoAwesomeIcon,
  MovieFilter as MovieFilterIcon,
  VideoCall as VideoCallIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerMeetingAgendaItem,
  ProducerMeetingAssetRef,
  ProducerMeetingParticipant,
  ProducerPlanningPhase,
  ProducerPlannerMeetingMode,
  ProducerPlannerMeetingType,
  ProducerProjectPlanning,
  RoleRoomGoogleArtifactRef,
} from '../../models/casting';
import { googleWorkspaceApi } from '../../services/castingApiService';
import { castingService } from '../../services/castingService';
import {
  producerWorkflowService,
  type CreateProducerTimelineItemInput,
  type ProducerClientReview,
  type ProducerProjectNotification,
  type ProducerPhase,
  type ProducerTimelineItem,
} from '../../services/producerWorkflowService';
import { useProducerTimeline } from '../../hooks/useProducerTimeline';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import { useProducerNotifications } from '../../hooks/useProducerNotifications';
import { useProjectProductionEstimate } from '../../hooks/useProjectProductionEstimate';
import type {
  ProducerWorkflowEntityOption,
  ProducerWorkflowOwnerOption,
} from '../../utils/producerWorkflow';
import {
  normalizeProducerProjectPlanning,
  PRODUCER_PLANNER_MEETING_MODE_LABELS,
  PRODUCER_PLANNER_MEETING_TYPE_LABELS,
  PRODUCER_PLANNING_PHASE_LABELS,
  PRODUCER_PLANNING_STATUS_LABELS,
} from '../../utils/producerProjectPlanning';
import type { ClientPortalWorkspaceFocus } from '../../utils/clientPortal';
import ProducerMeetingWorkspace from './ProducerMeetingWorkspace';

type PlannerViewMode = 'timeline' | 'calendar' | 'coordination';
type TimelineActionKind = 'milestone' | 'task';
type PlannerAlertSeverity = 'error' | 'warning' | 'info';
type MeetingDraftStep = 0 | 1 | 2 | 3;

interface ProducerPlannerStudioProps {
  project: CastingProject;
  readOnly?: boolean;
  ownerOptions?: ProducerWorkflowOwnerOption[];
  entityOptions?: ProducerWorkflowEntityOption[];
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onOpenSelection?: () => void;
  onOpenTeam?: () => void;
  onOpenShotList?: (focus?: { phase?: ProducerPhase | 'all'; shotListId?: string }) => void;
  onOpenReviews?: (focus?: { focusedPhase?: ProducerPhase; approvalTemplate?: 'storyboard' | 'manuscript' | 'shotlist' }) => void;
  onOpenEconomy?: (focus?: { focusedPhase?: ProducerPhase }) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
}

interface PlannerAlert {
  id: string;
  severity: PlannerAlertSeverity;
  title: string;
  detail: string;
  phase?: ProducerPlanningPhase;
}

interface PlannerPhaseCard {
  phase: ProducerPlanningPhase;
  title: string;
  statusLabel: string;
  progress: number;
  blockers: number;
  approvals: number;
  nextDate?: string;
  summary: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

interface PlannerCalendarEntry {
  id: string;
  type: 'meeting' | 'shoot' | 'deadline' | 'delivery' | 'review';
  title: string;
  detail: string;
  date: string;
  phase: ProducerPlanningPhase;
  roleTags: string[];
}

interface CoordinationRow {
  id: string;
  label: string;
  role: string;
  availability: string;
  assigned: string;
  conflict: string;
  recommendation: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}

interface MeetingDraft {
  type: ProducerPlannerMeetingType;
  phase: ProducerPlanningPhase;
  title: string;
  scheduledAt: string;
  mode: ProducerPlannerMeetingMode;
  locationLabel: string;
  contextSummary: string;
  participantIds: string[];
  assetIds: string[];
  expectations: string;
}

interface TimelineActionDraft {
  kind: TimelineActionKind;
  phase: ProducerPhase;
  title: string;
  description: string;
  ownerUserId: string;
  dueAt: string;
  status: string;
  linkedEntityType: string;
  linkedEntityId: string;
}

const EMPTY_CLIENT_INTAKE: ProducerClientIntake = {
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

const PHASE_ORDER: ProducerPlanningPhase[] = ['preproduction', 'production', 'postproduction'];
const VIEW_OPTIONS: Array<{ value: PlannerViewMode; label: string }> = [
  { value: 'timeline', label: 'Timeline' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'coordination', label: 'Coordination' },
];
const CALENDAR_TYPE_LABELS: Record<PlannerCalendarEntry['type'], string> = {
  meeting: 'Møte',
  shoot: 'Shoot',
  deadline: 'Deadline',
  delivery: 'Leveranse',
  review: 'Godkjenning',
};
const MEETING_STEPS = ['Velg type', 'Foreslå deltakere', 'Tid og kontekst', 'Inviter'];
const ROLE_FILTER_OPTIONS = ['all', 'client', 'producer', 'director', 'dop', 'editor', 'crew'] as const;

const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const createRandomId = (prefix: string): string => (
  globalThis.crypto?.randomUUID?.()
    ? `${prefix}-${globalThis.crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`
);

const normalizeRoleToken = (value?: string | null): string => (
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const roleMatches = (value: string | undefined, patterns: string[]): boolean => {
  const normalized = normalizeRoleToken(value);
  return patterns.some((pattern) => normalized.includes(pattern));
};

const toDisplayDateTime = (value?: string | null): string => {
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

const toDateOnly = (value?: string | null): string => {
  if (!hasText(value)) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};

const getNotificationSeverity = (notification: ProducerProjectNotification): PlannerAlertSeverity => {
  if (notification.event_type === 'client_review_decision') {
    const status = String(notification.metadata?.reviewStatus ?? '').trim().toLowerCase();
    if (status === 'changes_requested' || status === 'rejected') {
      return 'warning';
    }
    return 'info';
  }

  return 'info';
};

const isValidDate = (value?: string | null): boolean => {
  if (!hasText(value)) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
};

const compareDatesAsc = (left?: string | null, right?: string | null): number => {
  const leftTime = Date.parse(left ?? '');
  const rightTime = Date.parse(right ?? '');
  return (Number.isNaN(leftTime) ? Number.MAX_SAFE_INTEGER : leftTime)
    - (Number.isNaN(rightTime) ? Number.MAX_SAFE_INTEGER : rightTime);
};

const getTimelineStatusTone = (status?: string | null): PlannerPhaseCard['tone'] => {
  if (status === 'blocked' || status === 'changes_requested' || status === 'rejected' || status === 'at_risk') {
    return 'danger';
  }
  if (status === 'in_progress' || status === 'review' || status === 'pending') {
    return 'warning';
  }
  if (status === 'completed' || status === 'approved') {
    return 'success';
  }
  return 'neutral';
};

const getToneStyles = (tone: PlannerPhaseCard['tone']) => {
  if (tone === 'danger') {
    return {
      border: 'rgba(248,113,113,0.38)',
      background: 'rgba(127,29,29,0.22)',
      chipBackground: 'rgba(248,113,113,0.16)',
      chipColor: '#fecaca',
    };
  }
  if (tone === 'warning') {
    return {
      border: 'rgba(251,191,36,0.34)',
      background: 'rgba(120,53,15,0.2)',
      chipBackground: 'rgba(251,191,36,0.16)',
      chipColor: '#fde68a',
    };
  }
  if (tone === 'success') {
    return {
      border: 'rgba(74,222,128,0.34)',
      background: 'rgba(20,83,45,0.2)',
      chipBackground: 'rgba(74,222,128,0.16)',
      chipColor: '#bbf7d0',
    };
  }
  return {
    border: 'rgba(148,163,184,0.24)',
    background: 'rgba(15,23,42,0.52)',
    chipBackground: 'rgba(148,163,184,0.16)',
    chipColor: '#cbd5e1',
  };
};

const resolveReviewPhase = (review: ProducerClientReview): ProducerPlanningPhase => {
  const metadata = asRecord(review.metadata);
  const rawPhase = typeof metadata.focusedPhase === 'string'
    ? metadata.focusedPhase
    : typeof metadata.phase === 'string'
      ? metadata.phase
      : '';
  if (rawPhase === 'preproduction' || rawPhase === 'production' || rawPhase === 'postproduction') {
    return rawPhase;
  }

  if (
    review.review_type === 'client_approval'
    || review.review_type === 'change_order'
    || review.target_entity_type === 'project_agreement'
    || review.target_entity_type === 'meeting_decision'
  ) {
    return 'postproduction';
  }

  if (review.review_type === 'shotlist') {
    return 'production';
  }

  return 'preproduction';
};

const getPhaseForTimelineItem = (item: ProducerTimelineItem): ProducerPlanningPhase => (
  item.phase === 'preproduction' || item.phase === 'production' || item.phase === 'postproduction'
    ? item.phase
    : 'preproduction'
);

const getPhaseRange = (
  planning: ProducerProjectPlanning,
  phase: ProducerPlanningPhase,
): { start?: string; end?: string } => {
  const phaseItem = planning.phasePlan.find((item) => item.phase === phase);
  return {
    start: phaseItem?.startDate,
    end: phaseItem?.endDate,
  };
};

const participantAvailabilityTone = (
  availability: ProducerMeetingParticipant['availability'],
): CoordinationRow['tone'] => {
  if (availability === 'unavailable') {
    return 'danger';
  }
  if (availability === 'tentative') {
    return 'warning';
  }
  if (availability === 'available') {
    return 'success';
  }
  return 'neutral';
};

const getMeetingTypeDefaults = (
  meetingType: ProducerPlannerMeetingType,
): {
  context: string;
  expectations: string[];
  agenda: Array<{ title: string; detail: string }>;
} => {
  if (meetingType === 'casting') {
    return {
      context: 'Samle rollebehov, callback-prioritering og neste beslutningspunkter før videre casting.',
      expectations: [
        'Bestem hvilke kandidater eller roller som går videre.',
        'Lås hva som må avklares før neste callback eller klientrunde.',
        'Bekreft hvem som følger opp og når.',
      ],
      agenda: [
        { title: 'Avklar rollebehov', detail: 'Hvilke roller er fortsatt åpne, og hvilke kandidater dekker briefen best?' },
        { title: 'Prioriter callbacks', detail: 'Bestem hvem som skal videre og hvilket materiale som trengs.' },
        { title: 'Lås neste beslutningspunkt', detail: 'Sett dato, ansvar og kriterier for neste runde.' },
      ],
    };
  }
  if (meetingType === 'creative') {
    return {
      context: 'Bruk møtet til å låse idé, budskap og hva som må være klart før produksjonen kan settes.',
      expectations: [
        'Godkjenn kreativ retning og tydelig budskap.',
        'Lås hvilke assets som må oppdateres før produksjon.',
        'Avklar hvem som godkjenner neste steg.',
      ],
      agenda: [
        { title: 'Kreativ retning', detail: 'Gå gjennom idé, hook og hva publikum skal sitte igjen med.' },
        { title: 'Storyboard / manus', detail: 'Avklar hvilke elementer som må justeres før opptak.' },
        { title: 'Brand og referanser', detail: 'Bekreft look, referanser og hva som er utenfor scope.' },
      ],
    };
  }
  if (meetingType === 'delivery') {
    return {
      context: 'Samle siste vurdering av klipp, leveranser og hva som må godkjennes før publisering eller levering.',
      expectations: [
        'Beslutt om leveransen er godkjent eller om endringer kreves.',
        'Bekreft publiserings- eller leveringsvindu.',
        'Lås ansvar for oppfølging, eksport og distribusjon.',
      ],
      agenda: [
        { title: 'Edit review', detail: 'Gå gjennom siste cut og noter nødvendige endringer.' },
        { title: 'Godkjenning og leveranse', detail: 'Bekreft hva som kan sendes, og hva som fortsatt er blokkert.' },
        { title: 'Distribusjon og eierskap', detail: 'Lås hvem som publiserer, følger opp og arkiverer.' },
      ],
    };
  }

  return {
    context: 'Bruk møtet til å koordinere opptak, crew, lokasjon og beslutninger som må tas før teamet går videre.',
    expectations: [
      'Bekreft hvem som må være på sett eller i møtet.',
      'Lås blokkere, approvals og avhengigheter før neste fase.',
      'Avklar hva som må sendes ut i invitasjonen slik at alle møter forberedt.',
    ],
    agenda: [
      { title: 'Shoot readiness', detail: 'Gå gjennom produksjonsdager, lokasjon og hva som blokkerer opptak.' },
      { title: 'Crew og availability', detail: 'Bekreft kjernecrew, ansvar og hvem som mangler i planen.' },
      { title: 'Assets og approvals', detail: 'Avklar hvilke filer, shotlists og godkjenninger som må være med.' },
    ],
  };
};

const PRIMARY_ROLE_PATTERNS: Record<ProducerPlannerMeetingType, Array<{ label: string; patterns: string[]; required?: boolean }>> = {
  casting: [
    { label: 'Produsent', patterns: ['producer', 'produsent'], required: true },
    { label: 'Regissør', patterns: ['director', 'regissor', 'director'], required: true },
    { label: 'Casting', patterns: ['casting'], required: false },
  ],
  production: [
    { label: 'Produsent', patterns: ['producer', 'produsent'], required: true },
    { label: 'Regissør', patterns: ['director', 'regissor'], required: true },
    { label: 'DoP', patterns: ['dop', 'director of photography', 'fotograf'], required: true },
    { label: 'Lyd', patterns: ['sound', 'audio', 'lyd'], required: false },
    { label: '1st AD', patterns: ['1st ad', 'ad', 'assistant director'], required: false },
  ],
  creative: [
    { label: 'Produsent', patterns: ['producer', 'produsent'], required: true },
    { label: 'Regissør', patterns: ['director', 'regissor'], required: true },
    { label: 'DoP', patterns: ['dop', 'director of photography', 'fotograf'], required: false },
    { label: 'Klipp / kreativ', patterns: ['editor', 'creative', 'writer', 'copy'], required: false },
  ],
  delivery: [
    { label: 'Produsent', patterns: ['producer', 'produsent'], required: true },
    { label: 'Editor', patterns: ['editor', 'klipp'], required: true },
    { label: 'Motion / color', patterns: ['color', 'motion', 'grade'], required: false },
  ],
};

const getMeetingDraftTitle = (
  projectName: string,
  meetingType: ProducerPlannerMeetingType,
): string => `${PRODUCER_PLANNER_MEETING_TYPE_LABELS[meetingType]} · ${projectName}`;

const getNearestPhaseForView = (planning: ProducerProjectPlanning): ProducerPlanningPhase => {
  const firstActive = planning.phasePlan.find((item) => item.status === 'in_progress' || item.status === 'review');
  if (firstActive) {
    return firstActive.phase;
  }
  const firstAtRisk = planning.phasePlan.find((item) => item.status === 'at_risk');
  if (firstAtRisk) {
    return firstAtRisk.phase;
  }
  return 'preproduction';
};

export default function ProducerPlannerStudio({
  project,
  readOnly = false,
  ownerOptions = [],
  entityOptions = [],
  onProjectUpdated,
  onOpenSelection,
  onOpenTeam,
  onOpenShotList,
  onOpenReviews,
  onOpenEconomy,
  onOpenMedia,
}: ProducerPlannerStudioProps) {
  const { enqueueSnackbar } = useSnackbar();
  const [viewMode, setViewMode] = useState<PlannerViewMode>('timeline');
  const [selectedPhase, setSelectedPhase] = useState<ProducerPlanningPhase | 'all'>('all');
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<PlannerCalendarEntry['type'] | 'all'>('all');
  const [calendarRoleFilter, setCalendarRoleFilter] = useState<(typeof ROLE_FILTER_OPTIONS)[number]>('all');
  const [coordinationMeetingType, setCoordinationMeetingType] = useState<ProducerPlannerMeetingType>('production');
  const [planningDraft, setPlanningDraft] = useState<ProducerProjectPlanning>(() => normalizeProducerProjectPlanning(project));
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingStep, setMeetingStep] = useState<MeetingDraftStep>(0);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(null);
  const [timelineActionDraft, setTimelineActionDraft] = useState<TimelineActionDraft | null>(null);
  const [clientIntake, setClientIntake] = useState<ProducerClientIntake>(EMPTY_CLIENT_INTAKE);
  const [googleArtifacts, setGoogleArtifacts] = useState<RoleRoomGoogleArtifactRef[]>([]);

  const {
    groupedByPhase,
    items: timelineItems,
    loading: timelineLoading,
    error: timelineError,
    createItem,
  } = useProducerTimeline(project.id);
  const {
    items: reviews,
    summary: reviewSummary,
    loading: reviewsLoading,
    error: reviewsError,
  } = useProducerReviews(project.id);
  const {
    items: notifications,
    loading: notificationsLoading,
    error: notificationsError,
    unreadCount: notificationsUnreadCount,
    markAsRead,
    markAllAsRead,
  } = useProducerNotifications(project.id);
  const {
    project: estimatedProject,
    shotLists,
    productionDays,
    productionEstimate,
    loading: estimateLoading,
    error: estimateError,
  } = useProjectProductionEstimate({
    projectId: project.id,
    initialProject: project,
    initialShotLists: project.shotLists,
    initialProductionDays: project.productionDays,
  });

  const liveProject = estimatedProject ?? project;
  const notificationBaselineReadyRef = useRef(false);
  const seenNotificationStateRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setPlanningDraft(normalizeProducerProjectPlanning(liveProject));
  }, [liveProject]);

  useEffect(() => {
    const nextSnapshot = new Map<string, string>();
    for (const notification of notifications) {
      nextSnapshot.set(notification.id, `${notification.updated_at}:${notification.read ? 'read' : 'unread'}`);
    }

    if (!notificationBaselineReadyRef.current) {
      seenNotificationStateRef.current = nextSnapshot;
      notificationBaselineReadyRef.current = true;
      return;
    }

    for (const notification of notifications) {
      const signature = `${notification.updated_at}:${notification.read ? 'read' : 'unread'}`;
      const previous = seenNotificationStateRef.current.get(notification.id);
      if (!notification.read && previous !== undefined && previous !== signature) {
        enqueueSnackbar(notification.title, { variant: 'info' });
      }
      if (!notification.read && previous === undefined) {
        enqueueSnackbar(notification.title, { variant: 'info' });
      }
    }

    seenNotificationStateRef.current = nextSnapshot;
  }, [enqueueSnackbar, notifications]);

  const phaseInView = selectedPhase === 'all'
    ? getNearestPhaseForView(planningDraft)
    : selectedPhase;

  const refreshGoogleArtifacts = useCallback(async () => {
    try {
      const status = await googleWorkspaceApi.getStatus(project.id);
      setGoogleArtifacts(Array.isArray(status.artifacts) ? status.artifacts : []);
      return status;
    } catch (error) {
      console.warn('[ProducerPlannerStudio] Failed to refresh Google status', error);
      return null;
    }
  }, [project.id]);

  useEffect(() => {
    void refreshGoogleArtifacts();
  }, [refreshGoogleArtifacts]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextIntake = await producerWorkflowService.getClientIntake(project.id);
        if (!cancelled) {
          setClientIntake({
            ...EMPTY_CLIENT_INTAKE,
            ...nextIntake,
          });
        }
      } catch (error) {
        console.warn('[ProducerPlannerStudio] Failed to load client intake', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  const savePlanning = useCallback(async (nextPlanning: ProducerProjectPlanning) => {
    let projectSaved = false;
    try {
      setSavingPlanning(true);
      const projectPayload: CastingProject = {
        ...liveProject,
        producerPlanning: {
          ...nextPlanning,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveProject(projectPayload);
      projectSaved = true;
      const [planningSync, meetingSync] = await Promise.allSettled([
        producerWorkflowService.syncPlanningClientReviews(project.id, nextPlanning),
        producerWorkflowService.syncMeetingWorkspaceWorkflow(project.id, nextPlanning),
      ]);
      if (planningSync.status === 'rejected' || meetingSync.status === 'rejected') {
        enqueueSnackbar('Planneren ble lagret, men deler av review- eller møteflyten må synkroniseres på nytt.', {
          variant: 'warning',
        });
      } else {
        enqueueSnackbar('Planneren er lagret i prosjektet.', { variant: 'success' });
      }
      await onProjectUpdated?.(projectPayload);
      setPlanningDraft(nextPlanning);
    } catch (error) {
      console.error('[ProducerPlannerStudio] Failed to save planning', error);
      enqueueSnackbar(
        projectSaved
          ? 'Planneren ble lagret, men noe av synkroniseringen feilet.'
          : (error instanceof Error ? error.message : 'Kunne ikke lagre planneren.'),
        { variant: 'error' },
      );
    } finally {
      setSavingPlanning(false);
    }
  }, [enqueueSnackbar, liveProject, onProjectUpdated, project.id]);

  const ownerLookup = useMemo(() => new Map(ownerOptions.map((option) => [option.value, option])), [ownerOptions]);

  const phaseCards = useMemo<PlannerPhaseCard[]>(() => {
    return PHASE_ORDER.map((phase) => {
      const phasePlan = planningDraft.phasePlan.find((item) => item.phase === phase);
      const phaseTimeline = groupedByPhase[phase];
      const phaseReviews = reviews.filter((review) => resolveReviewPhase(review) === phase && review.status !== 'approved');
      const completedItems = phaseTimeline.filter((item) => getTimelineStatusTone(item.status) === 'success').length;
      const blockedItems = phaseTimeline.filter((item) => getTimelineStatusTone(item.status) === 'danger').length;
      const deliveryItems = planningDraft.contentCalendar.filter((item) => item.phase === phase);
      const publishedCount = deliveryItems.filter((item) => item.status === 'published').length;
      const totalUnits = Math.max(1, phaseTimeline.length + deliveryItems.length + 1);
      const completedUnits = completedItems
        + (phasePlan?.status === 'completed' ? 1 : 0)
        + publishedCount;
      const progress = Math.min(100, Math.round((completedUnits / totalUnits) * 100));
      const nextDeadline = [
        phasePlan?.endDate,
        ...phaseTimeline.map((item) => item.due_at ?? null),
        ...deliveryItems.map((item) => item.publishAt ?? null),
      ]
        .filter((value): value is string => isValidDate(value))
        .sort(compareDatesAsc)[0];
      const blockers = blockedItems + (phasePlan?.status === 'at_risk' ? 1 : 0);
      const approvals = phaseReviews.filter((review) => review.status === 'pending' || review.status === 'changes_requested').length;
      const tone = blockers > 0 ? 'danger' : approvals > 0 || phasePlan?.status === 'review' || phasePlan?.status === 'in_progress' ? 'warning' : progress >= 75 ? 'success' : 'neutral';

      return {
        phase,
        title: phasePlan?.title?.trim() || PRODUCER_PLANNING_PHASE_LABELS[phase],
        statusLabel: PRODUCER_PLANNING_STATUS_LABELS[phasePlan?.status ?? 'planned'],
        progress,
        blockers,
        approvals,
        nextDate: nextDeadline,
        summary: phasePlan?.objective?.trim()
          || (phase === 'preproduction'
            ? 'Retning, scope og produksjonsrammer må være låst før teamet går videre.'
            : phase === 'production'
              ? 'Opptaksdager, crew og lokasjon må være synkronisert rundt samme plan.'
              : 'Godkjenninger, leveranser og oppfølging må samles i én sluttfase.'),
        tone,
      };
    });
  }, [groupedByPhase, planningDraft, reviews]);

  const plannerAlerts = useMemo<PlannerAlert[]>(() => {
    const alerts: PlannerAlert[] = [];
    const techScoutExists = timelineItems.some((item) => /tech scout|location scout|recce/i.test(item.title));
    const firstProductionDay = [...productionDays]
      .filter((day) => hasText(day.date))
      .sort((left, right) => compareDatesAsc(left.date, right.date))[0];
    const hasDoP = liveProject.crew.some((member) => roleMatches(member.role, ['dop', 'director of photography', 'fotograf']));
    const hasDirector = liveProject.crew.some((member) => roleMatches(member.role, ['director', 'regissor']));
    const hasProducer = liveProject.crew.some((member) => roleMatches(member.role, ['producer', 'produsent']));
    const unscheduledLoad = productionEstimate.productionDayLoads.find((entry) => entry.dayId === 'unscheduled');
    const editReviewExists = timelineItems.some((item) => /edit review|klippgjennomgang|cut review|delivery review/i.test(item.title));

    if (firstProductionDay && !techScoutExists) {
      alerts.push({
        id: 'tech-scout',
        severity: 'warning',
        title: 'Tech scout mangler før opptak',
        detail: `Du har opptaksdager planlagt fra ${toDisplayDateTime(firstProductionDay.date)}, men ingen tydelig tech scout eller recce i planneren.`,
        phase: 'preproduction',
      });
    }

    if (phaseInView === 'production' && !hasDoP) {
      alerts.push({
        id: 'missing-dop',
        severity: 'error',
        title: 'DoP er ikke dekket i produksjonsfasen',
        detail: 'Planneren finner ingen DoP/fotograf i crew. Opptaksmøter og shoot days bør ikke låses før dette er dekket.',
        phase: 'production',
      });
    }

    if (phaseInView === 'production' && (!hasDirector || !hasProducer)) {
      alerts.push({
        id: 'core-crew-gap',
        severity: 'warning',
        title: 'Kjernecrew mangler i koordineringen',
        detail: 'Minst én av rollene produsent eller regissør mangler i crewlisten. Det svekker møteforslag og ansvarsavklaringer.',
        phase: 'production',
      });
    }

    if ((unscheduledLoad?.shotListCount ?? 0) > 0) {
      alerts.push({
        id: 'unscheduled-shotlists',
        severity: 'warning',
        title: 'Shotlists mangler produksjonsplassering',
        detail: `${unscheduledLoad?.shotListCount ?? 0} shotlists står fortsatt uten opptaksdag. Planneren bør låse disse før crew og lokasjon bookes videre.`,
        phase: 'preproduction',
      });
    }

    if (!editReviewExists && planningDraft.contentCalendar.length > 0) {
      alerts.push({
        id: 'edit-review',
        severity: 'info',
        title: 'Edit review er ikke satt opp',
        detail: 'Du har leveranser i planen, men ingen tydelig klippgjennomgang i timeline eller møteflyt.',
        phase: 'postproduction',
      });
    }

    if (reviewSummary.changesRequested > 0) {
      alerts.push({
        id: 'changes-requested',
        severity: 'warning',
        title: 'Klienten venter på oppfølging',
        detail: `${reviewSummary.changesRequested} reviewpunkter har endringer ønsket. Planneren bør samle disse i neste beslutningspunkt.`,
      });
    }

    return alerts;
  }, [liveProject.crew, phaseInView, planningDraft.contentCalendar.length, productionDays, productionEstimate.productionDayLoads, reviewSummary.changesRequested, timelineItems]);

  const recentNotifications = useMemo(
    () => notifications.slice(0, 6),
    [notifications],
  );

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Kunne ikke markere varselet som lest.', {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, markAsRead]);

  const handleOpenNotification = useCallback(async (notification: ProducerProjectNotification) => {
    if (!notification.read) {
      await handleMarkNotificationRead(notification.id);
    }

    if (notification.linked_entity_type === 'client_intake') {
      onOpenMedia?.({ workspace: 'brief' });
      return;
    }

    if (notification.linked_entity_type === 'client_material') {
      onOpenMedia?.({ workspace: 'materials' });
      return;
    }

    if (notification.linked_entity_type === 'client_review') {
      onOpenReviews?.();
      return;
    }
  }, [handleMarkNotificationRead, onOpenMedia, onOpenReviews]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Kunne ikke markere varsler som lest.', {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, markAllAsRead]);

  const contractCount = useMemo(
    () => timelineItems.filter((item) => item.linked_entity_type === 'project_agreement' || hasText(asRecord(item.metadata).agreementId)).length,
    [timelineItems],
  );

  const pendingFollowUps = useMemo(
    () => planningDraft.meetingWorkspace.followUps.filter((item) => item.status !== 'done').length,
    [planningDraft.meetingWorkspace.followUps],
  );

  const adminBackbone = useMemo(() => {
    const totalDeadlines = timelineItems.filter((item) => hasText(item.due_at)).length;
    const deliveryCount = planningDraft.contentCalendar.length;
    return [
      { label: 'Kontrakter', value: contractCount, helper: 'Avtaler og signaturløp i prosjektet.' },
      { label: 'Deadlines', value: totalDeadlines, helper: 'Milepæler med dato i planneren.' },
      { label: 'Leveranser', value: deliveryCount, helper: 'Publiseringer og leveranser i content-kalenderen.' },
      { label: 'Godkjenninger', value: reviewSummary.pending + reviewSummary.changesRequested, helper: 'Punkter som fortsatt venter på beslutning.' },
      { label: 'Oppfølginger', value: pendingFollowUps, helper: 'Beslutninger som fortsatt må følges opp.' },
    ];
  }, [contractCount, pendingFollowUps, planningDraft.contentCalendar.length, reviewSummary.changesRequested, reviewSummary.pending, timelineItems]);

  const buildSuggestedParticipants = useCallback((meetingType: ProducerPlannerMeetingType, phase: ProducerPlanningPhase): ProducerMeetingParticipant[] => {
    const range = getPhaseRange(planningDraft, phase);
    const participants: ProducerMeetingParticipant[] = [];
    const usedIds = new Set<string>();

    const addParticipant = (participant: ProducerMeetingParticipant) => {
      if (usedIds.has(participant.id)) {
        return;
      }
      usedIds.add(participant.id);
      participants.push(participant);
    };

    const clientLabel = liveProject.clientName || clientIntake.contactName || 'Klient';
    const clientNote = liveProject.clientEmail || clientIntake.contactEmail || '';
    if (meetingType !== 'casting' || hasText(clientNote) || hasText(liveProject.clientName)) {
      addParticipant({
        id: 'client-primary',
        label: clientNote ? `${clientLabel} · ${clientNote}` : clientLabel,
        role: 'Klient',
        kind: 'client',
        required: meetingType !== 'casting',
        availability: 'unknown',
        note: 'Deles når møtet krever godkjenning eller kundeinput.',
      });
    }

    PRIMARY_ROLE_PATTERNS[meetingType].forEach((roleBlueprint) => {
      const match = liveProject.crew.find((member) => roleMatches(member.role, roleBlueprint.patterns));
      if (!match) {
        return;
      }

      let availability: ProducerMeetingParticipant['availability'] = 'unknown';
      const availabilityStart = typeof match.availability?.startDate === 'string' ? match.availability.startDate : '';
      const availabilityEnd = typeof match.availability?.endDate === 'string' ? match.availability.endDate : '';
      if (range.start && range.end && availabilityStart && availabilityEnd) {
        availability = (availabilityStart <= range.end && availabilityEnd >= range.start) ? 'available' : 'unavailable';
      } else if (Array.isArray(match.availabilityCells) && range.start && range.end) {
        const unavailableCells = match.availabilityCells.filter((cell) => (
          hasText(cell.date)
          && cell.date >= range.start!
          && cell.date <= range.end!
          && (cell.availability === 'unavailable' || cell.status === 'unavailable')
        ));
        availability = unavailableCells.length > 0 ? 'unavailable' : 'available';
      }

      const assignedCount = productionDays.filter((day) => (day.crew ?? []).includes(match.id)).length;
      addParticipant({
        id: match.id,
        label: match.name,
        role: roleBlueprint.label,
        kind: 'crew',
        required: roleBlueprint.required,
        availability,
        note: assignedCount > 0 ? `${assignedCount} opptaksdager allerede planlagt.` : undefined,
      });
    });

    if (meetingType === 'casting' && liveProject.roles.length > 0) {
      addParticipant({
        id: 'casting-roles',
        label: `${liveProject.roles.length} roller i spill`,
        role: 'Casting scope',
        kind: 'cast',
        required: false,
        availability: 'unknown',
        note: 'Bruk rollenivået når dere prioriterer callbacks og kandidater.',
      });
    }

    return participants;
  }, [planningDraft, liveProject.crew, liveProject.clientEmail, liveProject.clientName, liveProject.roles.length, clientIntake.contactEmail, clientIntake.contactName, productionDays]);

  const buildSuggestedAssets = useCallback((meetingType: ProducerPlannerMeetingType, phase: ProducerPlanningPhase): ProducerMeetingAssetRef[] => {
    const assets: ProducerMeetingAssetRef[] = [];
    const pushAsset = (type: ProducerMeetingAssetRef['type'], label: string, linkedEntityType?: string) => {
      const exactMatch = linkedEntityType
        ? entityOptions.find((option) => option.entityType === linkedEntityType)
        : undefined;
      assets.push({
        id: exactMatch ? `${exactMatch.entityType}:${exactMatch.entityId}` : createRandomId(`asset-${type ?? 'generic'}`),
        label,
        type,
        linkedEntityType: exactMatch?.entityType ?? linkedEntityType,
        linkedEntityId: exactMatch?.entityId,
      });
    };

    pushAsset('brief', 'Prosjektbrief', 'client_intake');
    if (meetingType === 'creative' || phase === 'preproduction') {
      pushAsset('storyboard', 'Storyboard / referanser', 'storyboard');
      pushAsset('manuscript', 'Manus', 'manuscript');
    }
    if (meetingType === 'production' || phase === 'production') {
      pushAsset('shotlist', 'Shotlist og scenegrunnlag', 'shotlist');
      pushAsset('reference', liveProject.locations.length > 0 ? `Lokasjon · ${liveProject.locations[0].name}` : 'Lokasjon og logistikk');
    }
    if (meetingType === 'delivery' || phase === 'postproduction') {
      pushAsset('timeline', 'Edit review og endringslogg', 'meeting_follow_up');
      pushAsset('contract', 'Kontrakter / godkjenninger', 'project_agreement');
    }

    return assets;
  }, [entityOptions, liveProject.locations]);

  const buildMeetingDraft = useCallback((
    meetingType: ProducerPlannerMeetingType,
    phase: ProducerPlanningPhase,
  ): MeetingDraft => {
    const defaults = getMeetingTypeDefaults(meetingType);
    const participants = buildSuggestedParticipants(meetingType, phase);
    const assets = buildSuggestedAssets(meetingType, phase);
    const locationLabel = phase === 'production'
      ? (productionDays[0]?.locationId
        ? liveProject.locations.find((location) => location.id === productionDays[0]?.locationId)?.name ?? 'Sett / lokasjon'
        : liveProject.locations[0]?.name ?? 'Sett / lokasjon')
      : phase === 'postproduction'
        ? 'Review room / digital gjennomgang'
        : 'Kickoff / digital sync';

    return {
      type: meetingType,
      phase,
      title: getMeetingDraftTitle(project.name, meetingType),
      scheduledAt: '',
      mode: phase === 'production' ? 'onsite' : 'digital',
      locationLabel,
      contextSummary: defaults.context,
      participantIds: participants
        .filter((participant) => participant.required)
        .map((participant) => participant.id),
      assetIds: assets.map((asset) => asset.id),
      expectations: defaults.expectations.join('\n'),
    };
  }, [buildSuggestedAssets, buildSuggestedParticipants, liveProject.locations, productionDays, project.name]);

  const suggestedParticipants = useMemo(
    () => buildSuggestedParticipants(coordinationMeetingType, phaseInView),
    [buildSuggestedParticipants, coordinationMeetingType, phaseInView],
  );

  const suggestedAssets = useMemo(
    () => buildSuggestedAssets(coordinationMeetingType, phaseInView),
    [buildSuggestedAssets, coordinationMeetingType, phaseInView],
  );

  const suggestedAgenda = useMemo(
    () => getMeetingTypeDefaults(coordinationMeetingType).agenda,
    [coordinationMeetingType],
  );

  const coordinationRows = useMemo<CoordinationRow[]>(() => {
    return suggestedParticipants.map((participant) => {
      const assigned = participant.kind === 'crew'
        ? `${productionDays.filter((day) => (day.crew ?? []).includes(participant.id)).length} dager`
        : participant.kind === 'client'
          ? `${reviewSummary.pending + reviewSummary.changesRequested} åpne approvals`
          : participant.kind === 'cast'
            ? `${liveProject.roles.length} roller`
            : '—';
      const conflict = participant.availability === 'unavailable'
        ? 'Tilgjengelighet kolliderer med valgt fase'
        : participant.availability === 'tentative'
          ? 'Må bekreftes før møte sendes'
          : 'Ingen tydelig konflikt';
      const recommendation = participant.required
        ? 'Bør være med i første invitasjonsrunde'
        : 'Inviter ved behov eller hold som observatør';
      return {
        id: participant.id,
        label: participant.label,
        role: participant.role ?? 'Deltaker',
        availability: participant.availability === 'available'
          ? 'Tilgjengelig'
          : participant.availability === 'tentative'
            ? 'Usikker'
            : participant.availability === 'unavailable'
              ? 'Utilgjengelig'
              : 'Ikke verifisert',
        assigned,
        conflict,
        recommendation,
        tone: participantAvailabilityTone(participant.availability),
      };
    });
  }, [suggestedParticipants, productionDays, reviewSummary.pending, reviewSummary.changesRequested, liveProject.roles.length]);

  const missingCoreRoles = useMemo(() => (
    PRIMARY_ROLE_PATTERNS[coordinationMeetingType]
      .filter((blueprint) => blueprint.required)
      .filter((blueprint) => !suggestedParticipants.some((participant) => participant.role === blueprint.label))
      .map((blueprint) => blueprint.label)
  ), [coordinationMeetingType, suggestedParticipants]);

  const recommendedMeetingWindow = useMemo(() => {
    const phaseRange = getPhaseRange(planningDraft, phaseInView);
    if (phaseRange.start && phaseRange.end) {
      return `${toDisplayDateTime(`${phaseRange.start}T09:00:00`)} til ${toDisplayDateTime(`${phaseRange.end}T17:00:00`)}`;
    }
    const firstShootDay = [...productionDays]
      .filter((day) => hasText(day.date))
      .sort((left, right) => compareDatesAsc(left.date, right.date))[0];
    if (firstShootDay) {
      return `${toDisplayDateTime(`${firstShootDay.date}T09:00:00`)} som første operative holdepunkt`;
    }
    return 'Ingen fasevindu satt ennå';
  }, [phaseInView, planningDraft, productionDays]);

  const openMeetingDialog = useCallback((meetingType: ProducerPlannerMeetingType = coordinationMeetingType) => {
    setMeetingDraft(buildMeetingDraft(meetingType, phaseInView));
    setMeetingStep(0);
    setMeetingDialogOpen(true);
  }, [buildMeetingDraft, coordinationMeetingType, phaseInView]);

  const closeMeetingDialog = useCallback(() => {
    setMeetingDialogOpen(false);
    setMeetingDraft(null);
    setMeetingStep(0);
  }, []);

  const openTimelineActionDialog = useCallback((kind: TimelineActionKind) => {
    const defaultTitle = kind === 'milestone'
      ? `Ny milepæl · ${PRODUCER_PLANNING_PHASE_LABELS[phaseInView]}`
      : `Oppgave · ${PRODUCER_PLANNING_PHASE_LABELS[phaseInView]}`;
    setTimelineActionDraft({
      kind,
      phase: phaseInView,
      title: defaultTitle,
      description: kind === 'milestone'
        ? 'Beskriv hva som må være sant før denne milepælen kan lukkes.'
        : 'Beskriv hva som skal leveres, hvem som eier det og hva som blokkerer fremdrift.',
      ownerUserId: '',
      dueAt: '',
      status: 'planned',
      linkedEntityType: '',
      linkedEntityId: '',
    });
  }, [phaseInView]);

  const closeTimelineActionDialog = useCallback(() => {
    setTimelineActionDraft(null);
  }, []);

  const timelineUrgentItems = useMemo(
    () => [...timelineItems]
      .sort((left, right) => compareDatesAsc(left.due_at, right.due_at))
      .slice(0, 8),
    [timelineItems],
  );

  const calendarEntries = useMemo<PlannerCalendarEntry[]>(() => {
    const entries: PlannerCalendarEntry[] = [];

    planningDraft.phasePlan.forEach((item) => {
      if (isValidDate(item.endDate)) {
        entries.push({
          id: `phase:${item.phase}`,
          type: 'deadline',
          title: item.title || PRODUCER_PLANNING_PHASE_LABELS[item.phase],
          detail: item.clientCheckpoint || item.objective || 'Fasepunkt i planneren.',
          date: item.endDate!,
          phase: item.phase,
          roleTags: ['producer', 'client'],
        });
      }
    });

    timelineItems.forEach((item) => {
      if (!isValidDate(item.due_at)) {
        return;
      }
      const ownerLabel = item.owner_user_id ? ownerLookup.get(item.owner_user_id)?.label ?? item.owner_user_id : '';
      entries.push({
        id: item.id,
        type: item.linked_entity_type === 'meeting_workspace' ? 'meeting' : 'deadline',
        title: item.title,
        detail: item.description?.trim() || 'Punkt fra produsentens workflow.',
        date: item.due_at!,
        phase: getPhaseForTimelineItem(item),
        roleTags: [
          normalizeRoleToken(ownerLabel),
          item.linked_entity_type === 'project_agreement' ? 'client' : 'crew',
        ].filter(Boolean),
      });
    });

    planningDraft.contentCalendar.forEach((item) => {
      if (!isValidDate(item.publishAt)) {
        return;
      }
      entries.push({
        id: item.id,
        type: 'delivery',
        title: item.title,
        detail: `${item.channel || 'Leveranse'} · ${item.format || 'format ikke satt'}`,
        date: item.publishAt!,
        phase: item.phase,
        roleTags: ['client', 'editor'],
      });
    });

    productionDays.forEach((day) => {
      if (!isValidDate(day.date)) {
        return;
      }
      const locationName = liveProject.locations.find((location) => location.id === day.locationId)?.name ?? 'Lokasjon ikke satt';
      entries.push({
        id: day.id,
        type: 'shoot',
        title: `Shoot day · ${locationName}`,
        detail: `${(day.scenes ?? []).length} scener · ${(day.crew ?? []).length} crew`,
        date: day.date,
        phase: 'production',
        roleTags: ['producer', 'director', 'dop', 'crew'],
      });
    });

    if (isValidDate(planningDraft.meetingWorkspace.scheduledAt)) {
      entries.push({
        id: 'meeting-workspace',
        type: 'meeting',
        title: planningDraft.meetingWorkspace.sessionLabel?.trim() || 'Planlagt møte',
        detail: planningDraft.meetingWorkspace.contextSummary?.trim() || 'Møte opprettet fra planneren.',
        date: planningDraft.meetingWorkspace.scheduledAt!,
        phase: planningDraft.meetingWorkspace.phase ?? phaseInView,
        roleTags: (planningDraft.meetingWorkspace.participants ?? [])
          .map((participant) => normalizeRoleToken(participant.role))
          .filter(Boolean),
      });
    }

    reviews.forEach((review) => {
      if (!isValidDate(review.due_at)) {
        return;
      }
      entries.push({
        id: review.id,
        type: 'review',
        title: review.title,
        detail: review.description?.trim() || 'Klientreview / approval.',
        date: review.due_at!,
        phase: resolveReviewPhase(review),
        roleTags: ['client'],
      });
    });

    return entries
      .filter((entry) => selectedPhase === 'all' || entry.phase === selectedPhase)
      .filter((entry) => calendarTypeFilter === 'all' || entry.type === calendarTypeFilter)
      .filter((entry) => calendarRoleFilter === 'all' || entry.roleTags.some((tag) => tag.includes(calendarRoleFilter)))
      .sort((left, right) => compareDatesAsc(left.date, right.date));
  }, [calendarRoleFilter, calendarTypeFilter, liveProject.locations, ownerLookup, phaseInView, planningDraft, productionDays, reviews, selectedPhase, timelineItems]);

  const handleCreateTimelineItem = useCallback(async () => {
    if (!timelineActionDraft || !timelineActionDraft.title.trim()) {
      return;
    }
    const payload: CreateProducerTimelineItemInput = {
      phase: timelineActionDraft.phase,
      title: timelineActionDraft.title.trim(),
      description: timelineActionDraft.description.trim() || undefined,
      ownerUserId: timelineActionDraft.ownerUserId || undefined,
      dueAt: timelineActionDraft.dueAt || undefined,
      status: timelineActionDraft.status,
      linkedEntityType: timelineActionDraft.linkedEntityType || undefined,
      linkedEntityId: timelineActionDraft.linkedEntityId || undefined,
      metadata: {
        source: 'role-room-planner',
        plannerItemType: timelineActionDraft.kind,
      },
    };
    try {
      await createItem(payload);
      enqueueSnackbar(
        timelineActionDraft.kind === 'milestone' ? 'Ny milepæl er lagt til i planneren.' : 'Ny oppgave er lagt til i planneren.',
        { variant: 'success' },
      );
      closeTimelineActionDialog();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Kunne ikke opprette nytt planner-punkt.', { variant: 'error' });
    }
  }, [closeTimelineActionDialog, createItem, enqueueSnackbar, timelineActionDraft]);

  const handleCreateMeeting = useCallback(async () => {
    if (!meetingDraft) {
      return;
    }

    const selectedParticipants = suggestedParticipants.filter((participant) => meetingDraft.participantIds.includes(participant.id));
    const selectedAssets = suggestedAssets.filter((asset) => meetingDraft.assetIds.includes(asset.id));
    const agendaItems: ProducerMeetingAgendaItem[] = getMeetingTypeDefaults(meetingDraft.type).agenda.map((item) => ({
      id: createRandomId('planner-agenda'),
      title: item.title,
      detail: item.detail,
      phase: meetingDraft.phase,
      sourceType: 'manual',
      completed: false,
    }));
    const expectations = meetingDraft.expectations
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const nextPlanning: ProducerProjectPlanning = {
      ...planningDraft,
      meetingWorkspace: {
        ...planningDraft.meetingWorkspace,
        sessionLabel: meetingDraft.title.trim(),
        meetingType: meetingDraft.type,
        phase: meetingDraft.phase,
        meetingMode: meetingDraft.mode,
        scheduledAt: meetingDraft.scheduledAt,
        locationLabel: meetingDraft.locationLabel.trim(),
        contextSummary: meetingDraft.contextSummary.trim(),
        expectations,
        participants: selectedParticipants,
        assets: selectedAssets,
        agenda: agendaItems,
        status: 'planned',
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };

    try {
      setPlanningDraft(nextPlanning);
      await savePlanning(nextPlanning);
      await createItem({
        phase: meetingDraft.phase,
        title: meetingDraft.title.trim(),
        description: meetingDraft.contextSummary.trim() || `Planlagt ${PRODUCER_PLANNER_MEETING_TYPE_LABELS[meetingDraft.type].toLowerCase()}-møte fra planneren.`,
        dueAt: meetingDraft.scheduledAt || undefined,
        status: 'planned',
        linkedEntityType: 'meeting_workspace',
        linkedEntityId: 'meeting-workspace',
        metadata: {
          source: 'role-room-planner',
          meetingType: meetingDraft.type,
          meetingMode: meetingDraft.mode,
          participantIds: selectedParticipants.map((participant) => participant.id),
          assetIds: selectedAssets.map((asset) => asset.id),
          expectations,
          locationLabel: meetingDraft.locationLabel.trim(),
          contextSummary: meetingDraft.contextSummary.trim(),
        },
      });
      enqueueSnackbar('Møtet er opprettet i planneren og lagt til i timeline.', { variant: 'success' });
      closeMeetingDialog();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Kunne ikke opprette møtet i planneren.', { variant: 'error' });
    }
  }, [closeMeetingDialog, createItem, enqueueSnackbar, meetingDraft, planningDraft, savePlanning, suggestedAssets, suggestedParticipants]);

  const meetingDialogAgenda = useMemo(
    () => getMeetingTypeDefaults(meetingDraft?.type ?? coordinationMeetingType).agenda,
    [coordinationMeetingType, meetingDraft?.type],
  );

  const meetingDialogParticipants = useMemo(
    () => meetingDraft ? buildSuggestedParticipants(meetingDraft.type, meetingDraft.phase) : [],
    [buildSuggestedParticipants, meetingDraft],
  );

  const meetingDialogAssets = useMemo(
    () => meetingDraft ? buildSuggestedAssets(meetingDraft.type, meetingDraft.phase) : [],
    [buildSuggestedAssets, meetingDraft],
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        height: '100%',
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          p: 1.35,
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.94) 0%, rgba(2,6,23,0.86) 100%)',
        }}
      >
        <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.2} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.55 }}>
              <MovieFilterIcon sx={{ color: '#fbbf24' }} />
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                The Role Room Planner
              </Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.9rem', maxWidth: 920, lineHeight: 1.55 }}>
              Planneren samler faseoversikt, møteflyt, deadlines, approvals og koordinering i én operativ produksjonsflate.
              Dette er ikke bare en kalender, men produksjonens administrative backbone.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="planner-phase-filter-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Fase</InputLabel>
              <Select
                labelId="planner-phase-filter-label"
                label="Fase"
                value={selectedPhase}
                onChange={(event) => setSelectedPhase(event.target.value as ProducerPlanningPhase | 'all')}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
              >
                <MenuItem value="all">Alle faser</MenuItem>
                {PHASE_ORDER.map((phase) => (
                  <MenuItem key={phase} value={phase}>{PRODUCER_PLANNING_PHASE_LABELS[phase]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={viewMode}
              onChange={(_, nextValue: PlannerViewMode | null) => {
                if (nextValue) {
                  setViewMode(nextValue);
                }
              }}
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(226,232,240,0.84)',
                  borderColor: 'rgba(148,163,184,0.22)',
                  textTransform: 'none',
                  fontWeight: 700,
                },
                '& .Mui-selected': {
                  bgcolor: 'rgba(59,130,246,0.18) !important',
                  color: '#bfdbfe !important',
                },
              }}
            >
              {VIEW_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
            {!readOnly ? (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<VideoCallIcon />}
                  onClick={() => openMeetingDialog()}
                  sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
                >
                  Create Meeting
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AssignmentTurnedInIcon />}
                  onClick={() => openTimelineActionDialog('milestone')}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Add Milestone
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddTaskIcon />}
                  onClick={() => openTimelineActionDialog('task')}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Assign Task
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Stack>

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ mt: 1.15 }}>
          {phaseCards.map((card) => {
            const styles = getToneStyles(card.tone);
            return (
              <Box
                key={card.phase}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  p: 1.05,
                  borderRadius: 1.65,
                  border: `1px solid ${styles.border}`,
                  background: styles.background,
                }}
              >
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {PRODUCER_PLANNING_PHASE_LABELS[card.phase]}
                    </Typography>
                    <Chip
                      size="small"
                      label={card.statusLabel}
                      sx={{ bgcolor: styles.chipBackground, color: styles.chipColor }}
                    />
                  </Stack>
                  <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' }}>
                    {card.title}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', minHeight: 38 }}>
                    {card.summary}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={card.progress}
                    sx={{
                      height: 8,
                      borderRadius: 999,
                      bgcolor: 'rgba(148,163,184,0.18)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 999,
                        bgcolor: card.tone === 'danger' ? '#f87171' : card.tone === 'warning' ? '#fbbf24' : '#38bdf8',
                      },
                    }}
                  />
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={`${card.progress}% fremdrift`} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
                    <Chip size="small" label={`${card.blockers} blockers`} sx={{ bgcolor: 'rgba(248,113,113,0.16)', color: '#fecaca' }} />
                    <Chip size="small" label={`${card.approvals} approvals`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                  </Stack>
                  <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.76rem' }}>
                    Neste holdepunkt: {card.nextDate ? toDisplayDateTime(`${toDateOnly(card.nextDate)}T09:00:00`) : 'Ikke satt'}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {savingPlanning ? <Alert severity="info">Lagrer planner-data og synkroniserer møteflyt.</Alert> : null}
      {timelineError ? <Alert severity="error">{timelineError}</Alert> : null}
      {reviewsError ? <Alert severity="warning">{reviewsError}</Alert> : null}
      {notificationsError ? <Alert severity="warning">{notificationsError}</Alert> : null}
      {estimateError ? <Alert severity="warning">{estimateError}</Alert> : null}
      {(timelineLoading || reviewsLoading || notificationsLoading || estimateLoading) ? <LinearProgress sx={{ borderRadius: 999 }} /> : null}

      {plannerAlerts.length > 0 ? (
        <Box
          sx={{
            p: 1.1,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.78)',
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.8 }}>
            <AutoAwesomeIcon sx={{ color: '#fbbf24' }} />
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Planner Assistant
            </Typography>
          </Stack>
          <Stack spacing={0.75}>
            {plannerAlerts.map((alert) => (
              <Alert key={alert.id} severity={alert.severity}>
                <Typography sx={{ fontWeight: 700 }}>{alert.title}</Typography>
                <Typography sx={{ fontSize: '0.85rem' }}>{alert.detail}</Typography>
              </Alert>
            ))}
          </Stack>
        </Box>
      ) : null}

      <Box
        sx={{
          p: 1.1,
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'rgba(15,23,42,0.78)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 0.9 }}>
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Varsler
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>
              Produsentvarsler for klientbrief, materiale, kommentarer og godkjenninger.
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Chip
              size="small"
              label={notificationsUnreadCount > 0 ? `${notificationsUnreadCount} uleste` : 'Alt lest'}
              sx={{
                bgcolor: notificationsUnreadCount > 0 ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.16)',
                color: notificationsUnreadCount > 0 ? '#bfdbfe' : '#cbd5e1',
              }}
            />
            {notificationsUnreadCount > 0 ? (
              <Button
                size="small"
                variant="text"
                onClick={() => { void handleMarkAllNotificationsRead(); }}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Marker alle som lest
              </Button>
            ) : null}
          </Stack>
        </Stack>

        {recentNotifications.length === 0 ? (
          <Alert severity="info">Ingen varsler ennå. Når klienten fyller ut brief, kommenterer eller godkjenner, dukker det opp her.</Alert>
        ) : (
          <Stack spacing={0.8}>
            {recentNotifications.map((notification) => (
              <Box
                key={notification.id}
                sx={{
                  p: 0.95,
                  borderRadius: 1.6,
                  border: notification.read
                    ? '1px solid rgba(148,163,184,0.16)'
                    : '1px solid rgba(59,130,246,0.28)',
                  background: notification.read
                    ? 'rgba(2,6,23,0.36)'
                    : 'rgba(15,23,42,0.92)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} justifyContent="space-between">
                  <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        size="small"
                        label={notification.read ? 'Lest' : 'Ny'}
                        sx={{
                          bgcolor: notification.read ? 'rgba(148,163,184,0.16)' : 'rgba(59,130,246,0.18)',
                          color: notification.read ? '#cbd5e1' : '#bfdbfe',
                        }}
                      />
                      <Chip
                        size="small"
                        color={getNotificationSeverity(notification) === 'warning' ? 'warning' : 'info'}
                        label={toDisplayDateTime(notification.updated_at)}
                        variant="outlined"
                      />
                    </Stack>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {notification.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {notification.message || 'Varslet mangler beskrivelse.'}
                    </Typography>
                  </Stack>

                  <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.7} alignItems={{ md: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => { void handleOpenNotification(notification); }}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Åpne
                    </Button>
                    {!notification.read ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => { void handleMarkNotificationRead(notification.id); }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Marker som lest
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {viewMode === 'timeline' ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '1.4fr 0.95fr' },
            gap: 1.25,
            minHeight: 0,
          }}
        >
          <Stack spacing={1.25} sx={{ minWidth: 0 }}>
            <ProducerMeetingWorkspace
              project={liveProject}
              projectId={project.id}
              planning={planningDraft}
              intake={clientIntake}
              reviews={reviews}
              timelineItems={timelineItems}
              googleArtifacts={googleArtifacts}
              readOnly={readOnly}
              saving={savingPlanning}
              onPlanningChange={(updater) => {
                setPlanningDraft((previous) => updater(previous));
              }}
              onSavePlanning={() => savePlanning(planningDraft)}
              onRefreshGoogleAssets={refreshGoogleArtifacts}
            />

            <Box
              sx={{
                p: 1.15,
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(15,23,42,0.72)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    Macro timeline og beslutningspunkter
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                    Her ser du hva som stopper flyten per fase, og hvilke milepæler som må lukkes før produksjonen kan gå videre.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {onOpenSelection ? (
                    <Button size="small" variant="outlined" onClick={onOpenSelection} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      Til utvelgelse
                    </Button>
                  ) : null}
                  {onOpenShotList ? (
                    <Button size="small" variant="outlined" onClick={() => onOpenShotList({ phase: phaseInView })} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      Åpne shotlist
                    </Button>
                  ) : null}
                  {onOpenTeam ? (
                    <Button size="small" variant="outlined" onClick={onOpenTeam} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      Team
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
              <Stack spacing={1}>
                {PHASE_ORDER
                  .filter((phase) => selectedPhase === 'all' || selectedPhase === phase)
                  .map((phase) => {
                    const phaseItems = groupedByPhase[phase];
                    return (
                      <Box
                        key={phase}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.5)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                          <Box>
                            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                              {PRODUCER_PLANNING_PHASE_LABELS[phase]}
                            </Typography>
                            <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem' }}>
                              {(planningDraft.phasePlan.find((item) => item.phase === phase)?.objective || 'Ingen fasebeskrivelse satt ennå.')}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={`${phaseItems.length} timeline-punkt`}
                            sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe', alignSelf: 'flex-start' }}
                          />
                        </Stack>
                        <Stack spacing={0.75}>
                          {phaseItems.length > 0 ? phaseItems.slice(0, 4).map((item) => {
                            const tone = getTimelineStatusTone(item.status);
                            const styles = getToneStyles(tone);
                            return (
                              <Box
                                key={item.id}
                                sx={{
                                  p: 0.9,
                                  borderRadius: 1.25,
                                  border: `1px solid ${styles.border}`,
                                  background: styles.background,
                                }}
                              >
                                <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1}>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                                      {item.title}
                                    </Typography>
                                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.81rem', mt: 0.25 }}>
                                      {item.description?.trim() || 'Ingen beskrivelse lagt inn ennå.'}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" label={item.status} sx={{ bgcolor: styles.chipBackground, color: styles.chipColor }} />
                                    {hasText(item.due_at) ? (
                                      <Chip size="small" label={toDisplayDateTime(item.due_at)} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
                                    ) : null}
                                    {item.owner_user_id ? (
                                      <Chip
                                        size="small"
                                        label={ownerLookup.get(item.owner_user_id)?.label ?? item.owner_user_id}
                                        sx={{ bgcolor: 'rgba(167,139,250,0.16)', color: '#e9d5ff' }}
                                      />
                                    ) : null}
                                  </Stack>
                                </Stack>
                              </Box>
                            );
                          }) : (
                            <Alert severity="info">Ingen timeline-punkter i denne fasen ennå.</Alert>
                          )}
                        </Stack>
                      </Box>
                    );
                  })}
              </Stack>
            </Box>
          </Stack>

          <Stack spacing={1.25}>
            <Box
              sx={{
                p: 1.1,
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(15,23,42,0.72)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 0.9 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Administrativ backbone
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {onOpenReviews ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenReviews({ focusedPhase: phaseInView })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Approvals
                    </Button>
                  ) : null}
                  {onOpenEconomy ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenEconomy({ focusedPhase: phaseInView })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Economy
                    </Button>
                  ) : null}
                  {onOpenMedia ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenMedia({ workspace: 'brief' })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      Brief / media
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
              <Stack spacing={0.8}>
                {adminBackbone.map((item) => (
                  <Box
                    key={item.label}
                    sx={{
                      p: 0.9,
                      borderRadius: 1.25,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background: 'rgba(2,6,23,0.45)',
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>{item.label}</Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem' }}>{item.helper}</Typography>
                      </Box>
                      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.05rem' }}>{item.value}</Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box
              sx={{
                p: 1.1,
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(15,23,42,0.72)',
              }}
            >
              <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.85 }}>
                Neste operative punkter
              </Typography>
              <Stack spacing={0.75}>
                {timelineUrgentItems.length > 0 ? timelineUrgentItems.map((item) => (
                  <Box
                    key={item.id}
                    sx={{
                      p: 0.9,
                      borderRadius: 1.2,
                      border: '1px solid rgba(148,163,184,0.14)',
                      background: 'rgba(2,6,23,0.45)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>{item.title}</Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.25 }}>
                      {hasText(item.due_at) ? `Forfaller ${toDisplayDateTime(item.due_at)}.` : 'Ingen dato satt.'} {item.description?.trim() || ''}
                    </Typography>
                  </Box>
                )) : (
                  <Alert severity="info">Ingen akutte timeline-punkter akkurat nå.</Alert>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
      ) : null}

      {viewMode === 'calendar' ? (
        <Stack spacing={1.25}>
          <Box
            sx={{
              p: 1.1,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.78)',
            }}
          >
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Klassisk kalender, men filtrert på produksjonslogikk
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                  Bruk denne visningen for å se møtepunkter, shoot days, leveranser og approvals i én samlet tidslinje.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="planner-calendar-type-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Type</InputLabel>
                  <Select
                    labelId="planner-calendar-type-label"
                    label="Type"
                    value={calendarTypeFilter}
                    onChange={(event) => setCalendarTypeFilter(event.target.value as PlannerCalendarEntry['type'] | 'all')}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                  >
                    <MenuItem value="all">Alle typer</MenuItem>
                    {Object.entries(CALENDAR_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="planner-calendar-role-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Rolle</InputLabel>
                  <Select
                    labelId="planner-calendar-role-label"
                    label="Rolle"
                    value={calendarRoleFilter}
                    onChange={(event) => setCalendarRoleFilter(event.target.value as (typeof ROLE_FILTER_OPTIONS)[number])}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="client">Klient</MenuItem>
                    <MenuItem value="producer">Produsent</MenuItem>
                    <MenuItem value="director">Regissør</MenuItem>
                    <MenuItem value="dop">DoP</MenuItem>
                    <MenuItem value="editor">Editor</MenuItem>
                    <MenuItem value="crew">Crew</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Stack>

            <Stack spacing={0.8} sx={{ mt: 1 }}>
              {calendarEntries.length > 0 ? calendarEntries.map((entry) => (
                <Box
                  key={entry.id}
                  sx={{
                    p: 0.95,
                    borderRadius: 1.25,
                    border: '1px solid rgba(148,163,184,0.14)',
                    background: 'rgba(2,6,23,0.45)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.35 }}>
                        <Chip size="small" label={CALENDAR_TYPE_LABELS[entry.type]} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                        <Chip size="small" label={PRODUCER_PLANNING_PHASE_LABELS[entry.phase]} sx={{ bgcolor: 'rgba(192,132,252,0.16)', color: '#e9d5ff' }} />
                      </Stack>
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>{entry.title}</Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.25 }}>
                        {entry.detail}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: '#f8fafc', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {toDisplayDateTime(`${toDateOnly(entry.date)}T09:00:00`)}
                    </Typography>
                  </Stack>
                </Box>
              )) : (
                <Alert severity="info">Ingen planner-punkter matcher filtrene akkurat nå.</Alert>
              )}
            </Stack>
          </Box>
        </Stack>
      ) : null}

      {viewMode === 'coordination' ? (
        <Stack spacing={1.25}>
          <Box
            sx={{
              p: 1.1,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.78)',
            }}
          >
            <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1} justifyContent="space-between">
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  Coordination view
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                  Dette er plasseringsmotoren for hvem som må være med, hva som kolliderer og når neste møte realistisk bør skje.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="planner-coordination-type-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Meeting type</InputLabel>
                  <Select
                    labelId="planner-coordination-type-label"
                    label="Meeting type"
                    value={coordinationMeetingType}
                    onChange={(event) => setCoordinationMeetingType(event.target.value as ProducerPlannerMeetingType)}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                  >
                    {Object.entries(PRODUCER_PLANNER_MEETING_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!readOnly ? (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VideoCallIcon />}
                    onClick={() => openMeetingDialog(coordinationMeetingType)}
                    sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
                  >
                    Create Meeting
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} sx={{ mt: 1 }}>
              <Box
                sx={{
                  flex: 1,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(59,130,246,0.24)',
                  background: 'rgba(30,41,59,0.4)',
                }}
              >
                <Typography sx={{ color: '#bfdbfe', fontWeight: 700 }}>Anbefalt møte-vindu</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>{recommendedMeetingWindow}</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  Basert på faseplan, crew availability og nærmeste operative holdepunkt.
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(251,191,36,0.24)',
                  background: 'rgba(120,53,15,0.18)',
                }}
              >
                <Typography sx={{ color: '#fde68a', fontWeight: 700 }}>Manglende roller</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>
                  {missingCoreRoles.length > 0 ? missingCoreRoles.join(', ') : 'Ingen kjerne-hull oppdaget'}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  Dette er de viktigste rollene planneren fortsatt savner for valgt møte-/fasekombinasjon.
                </Typography>
              </Box>
              <Box
                sx={{
                  flex: 1,
                  p: 1,
                  borderRadius: 1.5,
                  border: '1px solid rgba(248,113,113,0.24)',
                  background: 'rgba(127,29,29,0.18)',
                }}
              >
                <Typography sx={{ color: '#fecaca', fontWeight: 700 }}>Blokkere nå</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>{plannerAlerts.length}</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  Assistant-varsler og koordinasjonskonflikter som bør tas i neste beslutningspunkt.
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Box
            sx={{
              p: 1.1,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.78)',
            }}
          >
            <Typography sx={{ color: '#fff', fontWeight: 700, mb: 0.85 }}>
              Hvem må være med
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(191,219,254,0.82)', borderBottomColor: 'rgba(148,163,184,0.16)' }}>Person</TableCell>
                  <TableCell sx={{ color: 'rgba(191,219,254,0.82)', borderBottomColor: 'rgba(148,163,184,0.16)' }}>Availability</TableCell>
                  <TableCell sx={{ color: 'rgba(191,219,254,0.82)', borderBottomColor: 'rgba(148,163,184,0.16)' }}>Assigned</TableCell>
                  <TableCell sx={{ color: 'rgba(191,219,254,0.82)', borderBottomColor: 'rgba(148,163,184,0.16)' }}>Conflict</TableCell>
                  <TableCell sx={{ color: 'rgba(191,219,254,0.82)', borderBottomColor: 'rgba(148,163,184,0.16)' }}>Recommendation</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {coordinationRows.map((row) => {
                  const styles = getToneStyles(row.tone);
                  return (
                    <TableRow key={row.id}>
                      <TableCell sx={{ borderBottomColor: 'rgba(148,163,184,0.1)' }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>{row.label}</Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.78rem' }}>{row.role}</Typography>
                      </TableCell>
                      <TableCell sx={{ color: styles.chipColor, borderBottomColor: 'rgba(148,163,184,0.1)' }}>{row.availability}</TableCell>
                      <TableCell sx={{ color: '#e2e8f0', borderBottomColor: 'rgba(148,163,184,0.1)' }}>{row.assigned}</TableCell>
                      <TableCell sx={{ color: row.tone === 'danger' ? '#fecaca' : 'rgba(226,232,240,0.78)', borderBottomColor: 'rgba(148,163,184,0.1)' }}>{row.conflict}</TableCell>
                      <TableCell sx={{ color: 'rgba(203,213,225,0.82)', borderBottomColor: 'rgba(148,163,184,0.1)' }}>{row.recommendation}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Stack>
      ) : null}

      <Dialog open={meetingDialogOpen} onClose={closeMeetingDialog} fullWidth maxWidth="md">
        <DialogTitle>Opprett smart meeting</DialogTitle>
        <DialogContent dividers>
          <Stepper activeStep={meetingStep} sx={{ mb: 2 }}>
            {MEETING_STEPS.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {meetingDraft ? (
            <Stack spacing={1.25}>
              {meetingStep === 0 ? (
                <>
                  <TextField
                    select
                    label="Meeting type"
                    value={meetingDraft.type}
                    onChange={(event) => {
                      const nextType = event.target.value as ProducerPlannerMeetingType;
                      setMeetingDraft(buildMeetingDraft(nextType, meetingDraft.phase));
                    }}
                    fullWidth
                  >
                    {Object.entries(PRODUCER_PLANNER_MEETING_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Fase"
                    value={meetingDraft.phase}
                    onChange={(event) => {
                      const nextPhase = event.target.value as ProducerPlanningPhase;
                      setMeetingDraft(buildMeetingDraft(meetingDraft.type, nextPhase));
                    }}
                    fullWidth
                  >
                    {PHASE_ORDER.map((phase) => (
                      <MenuItem key={phase} value={phase}>{PRODUCER_PLANNING_PHASE_LABELS[phase]}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Tittel"
                    value={meetingDraft.title}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, title: event.target.value } : previous)}
                    fullWidth
                  />
                </>
              ) : null}

              {meetingStep === 1 ? (
                <>
                  <Alert severity="info">
                    Systemet foreslår hvem som bør delta, hvilke assets som bør ligge ved, og hvilke beslutningspunkter som bør tas i møtet.
                  </Alert>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>Deltakere</Typography>
                    <Stack spacing={0.55}>
                      {meetingDialogParticipants.map((participant) => (
                        <Box key={participant.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={meetingDraft.participantIds.includes(participant.id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setMeetingDraft((previous) => {
                                if (!previous) return previous;
                                return {
                                  ...previous,
                                  participantIds: checked
                                    ? [...previous.participantIds, participant.id]
                                    : previous.participantIds.filter((id) => id !== participant.id),
                                };
                              });
                            }}
                          />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700 }}>{participant.label}</Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                              {participant.role ?? 'Deltaker'} · {participant.note ?? 'Ingen ekstra kommentar'}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>Relevante assets</Typography>
                    <Stack spacing={0.55}>
                      {meetingDialogAssets.map((asset) => (
                        <Box key={asset.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Checkbox
                            checked={meetingDraft.assetIds.includes(asset.id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setMeetingDraft((previous) => {
                                if (!previous) return previous;
                                return {
                                  ...previous,
                                  assetIds: checked
                                    ? [...previous.assetIds, asset.id]
                                    : previous.assetIds.filter((id) => id !== asset.id),
                                };
                              });
                            }}
                          />
                          <Typography>{asset.label}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>Agenda systemet foreslår</Typography>
                    <Stack spacing={0.7}>
                      {meetingDialogAgenda.map((item) => (
                        <Box key={item.title} sx={{ p: 1, borderRadius: 1.25, bgcolor: 'rgba(59,130,246,0.08)' }}>
                          <Typography sx={{ fontWeight: 700 }}>{item.title}</Typography>
                          <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>{item.detail}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </>
              ) : null}

              {meetingStep === 2 ? (
                <>
                  <TextField
                    label="Tidspunkt"
                    type="datetime-local"
                    value={meetingDraft.scheduledAt}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, scheduledAt: event.target.value } : previous)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    select
                    label="Møteform"
                    value={meetingDraft.mode}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, mode: event.target.value as ProducerPlannerMeetingMode } : previous)}
                    fullWidth
                  >
                    {Object.entries(PRODUCER_PLANNER_MEETING_MODE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Lokasjon / digital link"
                    value={meetingDraft.locationLabel}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, locationLabel: event.target.value } : previous)}
                    fullWidth
                  />
                  <TextField
                    label="Kontekst"
                    value={meetingDraft.contextSummary}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, contextSummary: event.target.value } : previous)}
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </>
              ) : null}

              {meetingStep === 3 ? (
                <>
                  <TextField
                    label="Forventninger"
                    value={meetingDraft.expectations}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, expectations: event.target.value } : previous)}
                    multiline
                    minRows={5}
                    helperText="Én forventning per linje. Dette sendes som møtets forventningsgrunnlag."
                    fullWidth
                  />
                  <Alert severity="info">
                    Når du oppretter møtet, blir det skrevet inn i plannerens meeting workspace og lagt til som et ekte timeline-punkt.
                  </Alert>
                </>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMeetingDialog}>Avbryt</Button>
          {meetingStep > 0 ? (
            <Button onClick={() => setMeetingStep((previous) => Math.max(0, (previous - 1) as MeetingDraftStep))}>
              Tilbake
            </Button>
          ) : null}
          {meetingStep < 3 ? (
            <Button
              variant="contained"
              onClick={() => setMeetingStep((previous) => Math.min(3, (previous + 1) as MeetingDraftStep))}
            >
              Neste
            </Button>
          ) : (
            <Button variant="contained" onClick={() => { void handleCreateMeeting(); }}>
              Opprett møte
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(timelineActionDraft)} onClose={closeTimelineActionDialog} fullWidth maxWidth="sm">
        <DialogTitle>{timelineActionDraft?.kind === 'milestone' ? 'Legg til milepæl' : 'Tildel oppgave'}</DialogTitle>
        <DialogContent dividers>
          {timelineActionDraft ? (
            <Stack spacing={1.1}>
              <TextField
                select
                label="Fase"
                value={timelineActionDraft.phase}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, phase: event.target.value as ProducerPhase } : previous)}
                fullWidth
              >
                {PHASE_ORDER.map((phase) => (
                  <MenuItem key={phase} value={phase}>{PRODUCER_PLANNING_PHASE_LABELS[phase]}</MenuItem>
                ))}
              </TextField>
              <TextField
                label="Tittel"
                value={timelineActionDraft.title}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, title: event.target.value } : previous)}
                fullWidth
              />
              <TextField
                label="Beskrivelse"
                value={timelineActionDraft.description}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, description: event.target.value } : previous)}
                multiline
                minRows={3}
                fullWidth
              />
              <TextField
                label="Deadline"
                type="datetime-local"
                value={timelineActionDraft.dueAt}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, dueAt: event.target.value } : previous)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                select
                label="Ansvarlig"
                value={timelineActionDraft.ownerUserId}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, ownerUserId: event.target.value } : previous)}
                fullWidth
              >
                <MenuItem value="">Ingen satt ennå</MenuItem>
                {ownerOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label="Kobling"
                value={timelineActionDraft.linkedEntityId ? `${timelineActionDraft.linkedEntityType}:${timelineActionDraft.linkedEntityId}` : ''}
                onChange={(event) => {
                  const [linkedEntityType = '', linkedEntityId = ''] = String(event.target.value).split(':');
                  setTimelineActionDraft((previous) => previous ? { ...previous, linkedEntityType, linkedEntityId } : previous);
                }}
                fullWidth
              >
                <MenuItem value="">Ingen kobling</MenuItem>
                {entityOptions.map((option) => (
                  <MenuItem key={`${option.entityType}:${option.entityId}`} value={`${option.entityType}:${option.entityId}`}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTimelineActionDialog}>Avbryt</Button>
          <Button variant="contained" onClick={() => { void handleCreateTimelineItem(); }}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
