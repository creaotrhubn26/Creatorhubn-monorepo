import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];
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
  Drawer,
  FormControl,
  IconButton,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  AddTask as AddTaskIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  AutoAwesome as AutoAwesomeIcon,
  MoreHoriz as MoreHorizIcon,
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
import { CollapsibleSection } from '../CollapsibleSection';

type PlannerViewMode = 'timeline' | 'calendar' | 'coordination';
type TimelineActionKind = 'milestone' | 'task';
type PlannerAlertSeverity = 'error' | 'warning' | 'info';
type MeetingDraftStep = 0 | 1 | 2 | 3;
type ProducerPlannerAudience = 'production_team' | 'content_producer';
type ProducerInboxFilter = 'all' | 'follow_up' | 'workspace' | 'approval' | 'delivery';
type ProducerInboxCategory = 'workspace' | 'approval' | 'delivery' | 'other';

interface ProducerPlannerStudioProps {
  project: CastingProject;
  readOnly?: boolean;
  audience?: ProducerPlannerAudience;
  ownerOptions?: ProducerWorkflowOwnerOption[];
  entityOptions?: ProducerWorkflowEntityOption[];
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onOpenSelection?: () => void;
  onOpenTeam?: () => void;
  onOpenShotList?: (focus?: { phase?: ProducerPhase | 'all'; shotListId?: string }) => void;
  onOpenReviews?: (focus?: { focusedPhase?: ProducerPhase; approvalTemplate?: 'storyboard' | 'manuscript' | 'shotlist' }) => void;
  onOpenEconomy?: (focus?: { focusedPhase?: ProducerPhase }) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
  resumeCard?: {
    title: string;
    detail: string;
    actionLabel: string;
  } | null;
  onResumeWorkspace?: () => void;
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

interface ProducerInboxItem {
  id: string;
  source: 'notification' | 'approval';
  category: ProducerInboxCategory;
  projectId: string;
  projectName: string;
  clientLabel?: string;
  type: string;
  title: string;
  detail: string;
  statusLabel: string;
  actionLabel: string;
  tone: 'info' | 'warning' | 'error' | 'success';
  updatedAt: string;
  dueAt?: string;
  assignedToLabel?: string;
  mentionLabels: string[];
  resolved: boolean;
  archived: boolean;
  unread: boolean;
  needsFollowUp: boolean;
  notification?: ProducerProjectNotification;
  review?: ProducerClientReview;
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
const buildVIEW_OPTIONS = (t: TFn): Array<{ value: PlannerViewMode; label: string }> => ([
  { value: 'timeline', label: t('plannerStudio.s237') },
  { value: 'calendar', label: t('plannerStudio.s116') },
  { value: 'coordination', label: t('plannerStudio.s130') },
]);
const buildCALENDAR_TYPE_LABELS = (t: TFn): Record<PlannerCalendarEntry['type'], string> => ({
  meeting: t('plannerStudio.s178'),
  shoot: 'Shoot',
  deadline: 'Deadline',
  delivery: t('plannerStudio.s148'),
  review: t('plannerStudio.s073'),
});
const buildMEETING_STEPS = (t: TFn) => [t('plannerStudio.s254'), t('plannerStudio.s066'), t('plannerStudio.s236'), t('plannerStudio.s114')];
const ROLE_FILTER_OPTIONS = ['all', 'client', 'producer', 'director', 'dop', 'editor', 'crew'] as const;
const buildPRODUCER_INBOX_FILTER_LABELS = (t: TFn): Record<ProducerInboxFilter, string> => ({
  all: t('plannerStudio.s008'),
  follow_up: t('plannerStudio.s239'),
  workspace: t('plannerStudio.s209'),
  approval: t('plannerStudio.s073'),
  delivery: t('plannerStudio.s150'),
});
const buildPRODUCER_INBOX_CATEGORY_LABELS = (t: TFn): Record<ProducerInboxCategory, string> => ({
  workspace: t('plannerStudio.s209'),
  approval: t('plannerStudio.s073'),
  delivery: t('plannerStudio.s150'),
  other: t('plannerStudio.s003'),
});

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

const toDisplayDateTime = (t: TFn, value?: string | null): string => {
  if (!hasText(value)) {
    return t('plannerStudio.s086');
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

const getNotificationInboxCategory = (notification: ProducerProjectNotification): ProducerInboxCategory => {
  const linkedEntityType = String(notification.linked_entity_type ?? '').trim().toLowerCase();
  const eventType = String(notification.event_type ?? '').trim().toLowerCase();
  const title = `${notification.title ?? ''} ${notification.message ?? ''}`.toLowerCase();

  if (linkedEntityType === 'client_intake' || linkedEntityType === 'client_material') {
    return 'workspace';
  }

  if (linkedEntityType === 'client_review' || eventType.includes('review')) {
    return 'approval';
  }

  if (
    linkedEntityType.includes('delivery')
    || linkedEntityType.includes('export')
    || eventType.includes('delivery')
    || eventType.includes('export')
    || /levering|eksport/.test(title)
  ) {
    return 'delivery';
  }

  return 'other';
};

const getNotificationActionLabel = (t: TFn, category: ProducerInboxCategory): string => {
  switch (category) {
    case 'workspace':
      return t('plannerStudio.s261');
    case 'approval':
      return t('plannerStudio.s259');
    case 'delivery':
      return t('plannerStudio.s260');
    default:
      return t('plannerStudio.s258');
  }
};

const getLatestNotification = (items: ProducerProjectNotification[]): ProducerProjectNotification | undefined => (
  [...items].sort((left, right) => compareDatesAsc(right.updated_at, left.updated_at))[0]
);

const getReviewStatusLabel = (t: TFn, status?: string | null): string => {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();
  if (normalizedStatus === 'pending') {
    return t('plannerStudio.s255');
  }
  if (normalizedStatus === 'changes_requested') {
    return t('plannerStudio.s060');
  }
  if (normalizedStatus === 'rejected') {
    return t('plannerStudio.s023');
  }
  if (normalizedStatus === 'approved') {
    return t('plannerStudio.s078');
  }
  return normalizedStatus || t('plannerStudio.s246');
};

const getReviewStatusTone = (status?: string | null): 'info' | 'warning' | 'error' | 'success' => {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();
  if (normalizedStatus === 'changes_requested') {
    return 'warning';
  }
  if (normalizedStatus === 'rejected') {
    return 'error';
  }
  if (normalizedStatus === 'approved') {
    return 'success';
  }
  return 'info';
};

const getReviewTypeLabel = (t: TFn, review: ProducerClientReview): string => {
  const normalizedReviewType = String(review.review_type ?? '').trim().toLowerCase();
  const normalizedTargetEntityType = String(review.target_entity_type ?? '').trim().toLowerCase();

  if (normalizedReviewType === 'storyboard') return 'Storyboard';
  if (normalizedReviewType === 'manuscript') return t('plannerStudio.s167');
  if (normalizedReviewType === 'shotlist') return t('plannerStudio.s224');
  if (normalizedReviewType === 'client_intake_request') return t('plannerStudio.s040');
  if (normalizedReviewType === 'client_material_request') return t('plannerStudio.s171');
  if (normalizedReviewType === 'content_delivery' || normalizedTargetEntityType === 'content_calendar') return t('plannerStudio.s150');
  if (normalizedReviewType === 'budget_package' || normalizedTargetEntityType === 'economy') return t('plannerStudio.s266');
  if (normalizedReviewType === 'account_access' || normalizedTargetEntityType === 'account_access') return t('plannerStudio.s127');
  if (normalizedReviewType === 'change_order') return t('plannerStudio.s061');
  if (normalizedReviewType === 'client_approval') return t('plannerStudio.s122');
  if (normalizedTargetEntityType === 'project_agreement') return t('plannerStudio.s021');

  return review.review_type || t('plannerStudio.s073');
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
  t: TFn,
  meetingType: ProducerPlannerMeetingType,
): {
  context: string;
  expectations: string[];
  agenda: Array<{ title: string; detail: string }>;
} => {
  if (meetingType === 'casting') {
    return {
      context: t('plannerStudio.s219'),
      expectations: [
        t('plannerStudio.s037'),
        t('plannerStudio.s158'),
        t('plannerStudio.s026'),
      ],
      agenda: [
        { title: t('plannerStudio.s020'), detail: t('plannerStudio.s085') },
        { title: t('plannerStudio.s204'), detail: t('plannerStudio.s036') },
        { title: t('plannerStudio.s161'), detail: t('plannerStudio.s223') },
      ],
    };
  }
  if (meetingType === 'creative') {
    return {
      context: t('plannerStudio.s044'),
      expectations: [
        t('plannerStudio.s072'),
        t('plannerStudio.s160'),
        t('plannerStudio.s017'),
      ],
      agenda: [
        { title: t('plannerStudio.s132'), detail: t('plannerStudio.s079') },
        { title: t('plannerStudio.s229'), detail: t('plannerStudio.s018') },
        { title: t('plannerStudio.s039'), detail: t('plannerStudio.s029') },
      ],
    };
  }
  if (meetingType === 'delivery') {
    return {
      context: t('plannerStudio.s220'),
      expectations: [
        t('plannerStudio.s035'),
        t('plannerStudio.s030'),
        t('plannerStudio.s156'),
      ],
      agenda: [
        { title: 'Edit review', detail: t('plannerStudio.s081') },
        { title: t('plannerStudio.s074'), detail: t('plannerStudio.s025') },
        { title: t('plannerStudio.s055'), detail: t('plannerStudio.s159') },
      ],
    };
  }

  return {
    context: t('plannerStudio.s043'),
    expectations: [
      t('plannerStudio.s027'),
      t('plannerStudio.s157'),
      t('plannerStudio.s016'),
    ],
    agenda: [
      { title: 'Shoot readiness', detail: t('plannerStudio.s080') },
      { title: t('plannerStudio.s047'), detail: t('plannerStudio.s028') },
      { title: t('plannerStudio.s013'), detail: t('plannerStudio.s019') },
    ],
  };
};

const buildPRIMARY_ROLE_PATTERNS = (t: TFn): Record<ProducerPlannerMeetingType, Array<{ label: string; patterns: string[]; required?: boolean }>> => ({
  casting: [
    { label: t('plannerStudio.s205'), patterns: ['producer', 'produsent'], required: true },
    { label: t('plannerStudio.s213'), patterns: ['director', 'regissor', 'director'], required: true },
    { label: 'Casting', patterns: ['casting'], required: false },
  ],
  production: [
    { label: t('plannerStudio.s205'), patterns: ['producer', 'produsent'], required: true },
    { label: t('plannerStudio.s213'), patterns: ['director', 'regissor'], required: true },
    { label: 'DoP', patterns: ['dop', 'director of photography', 'fotograf'], required: true },
    { label: t('plannerStudio.s155'), patterns: ['sound', 'audio', 'lyd'], required: false },
    { label: '1st AD', patterns: ['1st ad', 'ad', 'assistant director'], required: false },
  ],
  creative: [
    { label: t('plannerStudio.s205'), patterns: ['producer', 'produsent'], required: true },
    { label: t('plannerStudio.s213'), patterns: ['director', 'regissor'], required: true },
    { label: 'DoP', patterns: ['dop', 'director of photography', 'fotograf'], required: false },
    { label: t('plannerStudio.s124'), patterns: ['editor', 'creative', 'writer', 'copy'], required: false },
  ],
  delivery: [
    { label: t('plannerStudio.s205'), patterns: ['producer', 'produsent'], required: true },
    { label: 'Editor', patterns: ['editor', 'klipp'], required: true },
    { label: 'Motion / color', patterns: ['color', 'motion', 'grade'], required: false },
  ],
});

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
  audience = 'production_team',
  ownerOptions = [],
  entityOptions = [],
  onProjectUpdated,
  onOpenSelection,
  onOpenTeam,
  onOpenShotList,
  onOpenReviews,
  onOpenEconomy,
  onOpenMedia,
  resumeCard = null,
  onResumeWorkspace,
}: ProducerPlannerStudioProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useT();
  const VIEW_OPTIONS = useMemo(() => buildVIEW_OPTIONS(t), [t]);
  const CALENDAR_TYPE_LABELS = useMemo(() => buildCALENDAR_TYPE_LABELS(t), [t]);
  const MEETING_STEPS = useMemo(() => buildMEETING_STEPS(t), [t]);
  const PRODUCER_INBOX_FILTER_LABELS = useMemo(() => buildPRODUCER_INBOX_FILTER_LABELS(t), [t]);
  const PRODUCER_INBOX_CATEGORY_LABELS = useMemo(() => buildPRODUCER_INBOX_CATEGORY_LABELS(t), [t]);
  const PRIMARY_ROLE_PATTERNS = useMemo(() => buildPRIMARY_ROLE_PATTERNS(t), [t]);
  const theme = useTheme();
  const isMobilePlanner = useMediaQuery(theme.breakpoints.down('sm'));
  const [viewMode, setViewMode] = useState<PlannerViewMode>('timeline');
  const [selectedPhase, setSelectedPhase] = useState<ProducerPlanningPhase | 'all'>('all');
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<PlannerCalendarEntry['type'] | 'all'>('all');
  const [calendarRoleFilter, setCalendarRoleFilter] = useState<(typeof ROLE_FILTER_OPTIONS)[number]>('all');
  const [coordinationMeetingType, setCoordinationMeetingType] = useState<ProducerPlannerMeetingType>('production');
  const [inboxFilter, setInboxFilter] = useState<ProducerInboxFilter>('all');
  const [inboxClientFilter, setInboxClientFilter] = useState('all');
  const [inboxTypeFilter, setInboxTypeFilter] = useState('all');
  const [inboxStatusFilter, setInboxStatusFilter] = useState<'all' | 'open' | 'resolved' | 'unread'>('open');
  const [inboxSearch, setInboxSearch] = useState('');
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [planningDraft, setPlanningDraft] = useState<ProducerProjectPlanning>(() => normalizeProducerProjectPlanning(project));
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [meetingStep, setMeetingStep] = useState<MeetingDraftStep>(0);
  const [meetingDraft, setMeetingDraft] = useState<MeetingDraft | null>(null);
  const [timelineActionDraft, setTimelineActionDraft] = useState<TimelineActionDraft | null>(null);
  const [clientIntake, setClientIntake] = useState<ProducerClientIntake>(EMPTY_CLIENT_INTAKE);
  const [googleArtifacts, setGoogleArtifacts] = useState<RoleRoomGoogleArtifactRef[]>([]);
  const isContentProducerPlanner = audience === 'content_producer';
  const useMobileContentProducerPlanner = isContentProducerPlanner && isMobilePlanner;
  const safeProject = useMemo<CastingProject>(() => ({
    ...project,
    crew: Array.isArray(project.crew) ? project.crew : [],
    roles: Array.isArray(project.roles) ? project.roles : [],
    locations: Array.isArray(project.locations) ? project.locations : [],
    shotLists: Array.isArray(project.shotLists) ? project.shotLists : [],
    productionDays: Array.isArray(project.productionDays) ? project.productionDays : [],
  }), [project]);

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
    updateNotification,
    archiveNotification,
    resolveNotification,
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
    initialProject: safeProject,
    initialShotLists: safeProject.shotLists,
    initialProductionDays: safeProject.productionDays,
  });

  const liveProject = useMemo<CastingProject>(() => {
    const source = estimatedProject ?? safeProject;
    return {
      ...source,
      crew: Array.isArray(source.crew) ? source.crew : [],
      roles: Array.isArray(source.roles) ? source.roles : [],
      locations: Array.isArray(source.locations) ? source.locations : [],
      shotLists: Array.isArray(source.shotLists) ? source.shotLists : safeProject.shotLists,
      productionDays: Array.isArray(source.productionDays) ? source.productionDays : safeProject.productionDays,
    };
  }, [estimatedProject, safeProject]);
  const notificationBaselineReadyRef = useRef(false);
  const seenNotificationStateRef = useRef<Map<string, string>>(new Map());
  const availableViewOptions = useMemo(
    () => (isContentProducerPlanner ? VIEW_OPTIONS.filter((option) => option.value !== 'coordination') : VIEW_OPTIONS),
    [isContentProducerPlanner],
  );
  const meetingTypeEntries = useMemo(
    () => Object.entries(PRODUCER_PLANNER_MEETING_TYPE_LABELS).filter(([value]) => (
      !isContentProducerPlanner || value === 'creative' || value === 'delivery'
    )),
    [isContentProducerPlanner],
  );

  useEffect(() => {
    setPlanningDraft(normalizeProducerProjectPlanning(liveProject));
  }, [liveProject]);

  useEffect(() => {
    if (isContentProducerPlanner && viewMode === 'coordination') {
      setViewMode('timeline');
    }
  }, [isContentProducerPlanner, viewMode]);

  useEffect(() => {
    if (isContentProducerPlanner && !['creative', 'delivery'].includes(coordinationMeetingType)) {
      setCoordinationMeetingType('creative');
    }
  }, [coordinationMeetingType, isContentProducerPlanner]);

  useEffect(() => {
    notificationBaselineReadyRef.current = false;
    seenNotificationStateRef.current = new Map();
    setInboxFilter('all');
    setInboxClientFilter('all');
    setInboxTypeFilter('all');
    setInboxStatusFilter('open');
    setInboxSearch('');
  }, [project.id]);

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
        enqueueSnackbar(t('plannerStudio.s198'), {
          variant: 'warning',
        });
      } else {
        enqueueSnackbar(t('plannerStudio.s200'), { variant: 'success' });
      }
      await onProjectUpdated?.(projectPayload);
      setPlanningDraft(nextPlanning);
    } catch (error) {
      console.error('[ProducerPlannerStudio] Failed to save planning', error);
      enqueueSnackbar(
        projectSaved
          ? t('plannerStudio.s199')
          : (error instanceof Error ? error.message : t('plannerStudio.s134')),
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
            ? t('plannerStudio.s215')
            : phase === 'production'
              ? t('plannerStudio.s196')
              : t('plannerStudio.s077')),
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

    if (!isContentProducerPlanner && firstProductionDay && !techScoutExists) {
      alerts.push({
        id: 'tech-scout',
        severity: 'warning',
        title: t('plannerStudio.s235'),
        detail: t('plannerStudio.t002', { v0: toDisplayDateTime(t, firstProductionDay.date) }),
        phase: 'preproduction',
      });
    }

    if (!isContentProducerPlanner && phaseInView === 'production' && !hasDoP) {
      alerts.push({
        id: 'missing-dop',
        severity: 'error',
        title: t('plannerStudio.s056'),
        detail: t('plannerStudio.s201'),
        phase: 'production',
      });
    }

    if (!isContentProducerPlanner && phaseInView === 'production' && (!hasDirector || !hasProducer)) {
      alerts.push({
        id: 'core-crew-gap',
        severity: 'warning',
        title: t('plannerStudio.s118'),
        detail: t('plannerStudio.s175'),
        phase: 'production',
      });
    }

    if (!isContentProducerPlanner && (unscheduledLoad?.shotListCount ?? 0) > 0) {
      alerts.push({
        id: 'unscheduled-shotlists',
        severity: 'warning',
        title: t('plannerStudio.s226'),
        detail: t('plannerStudio.t018', { v0: unscheduledLoad?.shotListCount ?? 0 }),
        phase: 'preproduction',
      });
    }

    if (!editReviewExists && planningDraft.contentCalendar.length > 0) {
      alerts.push({
        id: 'edit-review',
        severity: 'info',
        title: t('plannerStudio.s058'),
        detail: t('plannerStudio.s057'),
        phase: 'postproduction',
      });
    }

    if (isContentProducerPlanner && planningDraft.contentCalendar.length === 0) {
      alerts.push({
        id: 'missing-deliveries',
        severity: 'info',
        title: t('plannerStudio.s098'),
        detail: t('plannerStudio.s144'),
      });
    }

    if (isContentProducerPlanner && reviewSummary.pending > 0) {
      alerts.push({
        id: 'pending-approvals',
        severity: 'info',
        title: t('plannerStudio.s076'),
        detail: t('plannerStudio.t014', { v0: reviewSummary.pending }),
      });
    }

    if (reviewSummary.changesRequested > 0) {
      alerts.push({
        id: 'changes-requested',
        severity: 'warning',
        title: t('plannerStudio.s121'),
        detail: t('plannerStudio.t013', { v0: reviewSummary.changesRequested }),
      });
    }

    return alerts;
  }, [isContentProducerPlanner, liveProject.crew, phaseInView, planningDraft.contentCalendar.length, productionDays, productionEstimate.productionDayLoads, reviewSummary.changesRequested, reviewSummary.pending, timelineItems]);

  const recentNotifications = useMemo(
    () => notifications.slice(0, 6),
    [notifications],
  );

  const outstandingClientApprovals = useMemo(() => (
    reviews
      .filter((review) => {
        const normalizedStatus = String(review.status ?? '').trim().toLowerCase();
        return normalizedStatus === 'pending'
          || normalizedStatus === 'changes_requested'
          || normalizedStatus === 'rejected';
      })
      .sort((left, right) => {
        const leftPriority = left.status === 'changes_requested' ? 0 : left.status === 'rejected' ? 1 : 2;
        const rightPriority = right.status === 'changes_requested' ? 0 : right.status === 'rejected' ? 1 : 2;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return compareDatesAsc(left.due_at ?? left.requested_at ?? left.updated_at, right.due_at ?? right.requested_at ?? right.updated_at);
      })
  ), [reviews]);

  const contentProducerInboxItems = useMemo<ProducerInboxItem[]>(() => {
    const reviewNotificationMap = new Map<string, ProducerProjectNotification[]>();
    for (const notification of notifications) {
      if (String(notification.linked_entity_type ?? '').trim().toLowerCase() !== 'client_review') {
        continue;
      }
      const linkedEntityId = String(notification.linked_entity_id ?? '').trim();
      if (!linkedEntityId) {
        continue;
      }
      const existing = reviewNotificationMap.get(linkedEntityId) ?? [];
      existing.push(notification);
      reviewNotificationMap.set(linkedEntityId, existing);
    }

    const approvalItems = outstandingClientApprovals.map((review) => {
      const normalizedStatus = String(review.status ?? '').trim().toLowerCase();
      const tone = getReviewStatusTone(review.status);
      const relatedNotifications = reviewNotificationMap.get(review.id) ?? [];
      const latestRelatedNotification = getLatestNotification(relatedNotifications);
      const hasUnreadRelatedNotification = relatedNotifications.some((notification) => !notification.read);
      return {
        id: `approval:${review.id}`,
        source: 'approval' as const,
        category: 'approval' as const,
        projectId: project.id,
        projectName: project.name,
        clientLabel: clientIntake.contactName || clientIntake.contactEmail || undefined,
        type: 'approval',
        title: review.title || getReviewTypeLabel(t, review),
        detail: latestRelatedNotification?.message?.trim()
          || review.description?.trim()
          || t('plannerStudio.s051'),
        statusLabel: getReviewStatusLabel(t, review.status),
        actionLabel: t('plannerStudio.s259'),
        tone,
        updatedAt: latestRelatedNotification?.updated_at ?? review.updated_at,
        dueAt: review.due_at ?? undefined,
        assignedToLabel: latestRelatedNotification?.assigned_to_label ?? undefined,
        mentionLabels: [
          ...(latestRelatedNotification?.mention_user_ids ?? []),
          ...(latestRelatedNotification?.mention_emails ?? []),
        ],
        resolved: false,
        archived: false,
        unread: hasUnreadRelatedNotification,
        needsFollowUp: hasUnreadRelatedNotification
          || normalizedStatus === 'pending'
          || normalizedStatus === 'changes_requested'
          || normalizedStatus === 'rejected',
        review,
      } satisfies ProducerInboxItem;
    });

    const notificationItems = notifications
      .filter((notification) => {
        if (String(notification.linked_entity_type ?? '').trim().toLowerCase() !== 'client_review') {
          return true;
        }
        const linkedEntityId = String(notification.linked_entity_id ?? '').trim();
        if (!linkedEntityId) {
          return true;
        }
        return !outstandingClientApprovals.some((review) => review.id === linkedEntityId);
      })
      .map((notification) => {
      const category = getNotificationInboxCategory(notification);
      const severity = getNotificationSeverity(notification);
      const resolved = Boolean(notification.resolved_at);
      const archived = Boolean(notification.archived_at);
      const assignedToLabel = notification.assigned_to_label || notification.assigned_to_user_id || undefined;
      const mentionLabels = [
        ...(notification.mention_user_ids ?? []),
        ...(notification.mention_emails ?? []),
      ];
      return {
        id: `notification:${notification.id}`,
        source: 'notification' as const,
        category,
        projectId: notification.project_id || project.id,
        projectName: project.name,
        clientLabel: notification.client_name || notification.client_email || undefined,
        type: notification.inbox_type || category,
        title: notification.title,
        detail: notification.message?.trim() || t('plannerStudio.s253'),
        statusLabel: resolved ? t('plannerStudio.s163') : notification.read ? t('plannerStudio.s147') : t('plannerStudio.s186'),
        actionLabel: getNotificationActionLabel(t, category),
        tone: resolved ? 'success' : severity === 'warning' ? 'warning' : 'info',
        updatedAt: notification.updated_at,
        dueAt: notification.due_at ?? undefined,
        assignedToLabel,
        mentionLabels,
        resolved,
        archived,
        unread: !notification.read,
        needsFollowUp: !resolved && !archived && (!notification.read || category === 'approval'),
        notification,
      } satisfies ProducerInboxItem;
      });

    return [...approvalItems, ...notificationItems].sort((left, right) => {
      const getPriority = (item: ProducerInboxItem): number => {
        if (item.source === 'approval' && item.review) {
          const status = String(item.review.status ?? '').trim().toLowerCase();
          if (status === 'changes_requested') return 0;
          if (status === 'rejected') return 1;
          if (status === 'pending') return 2;
        }
        if (item.unread && item.category === 'approval') return 3;
        if (item.unread) return 4;
        if (item.category === 'delivery') return 5;
        return 6;
      };
      const leftPriority = getPriority(left);
      const rightPriority = getPriority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return compareDatesAsc(right.updatedAt, left.updatedAt);
    });
  }, [clientIntake.contactEmail, clientIntake.contactName, notifications, outstandingClientApprovals, project.id, project.name]);

  const filteredContentProducerInboxItems = useMemo(() => {
    const normalizedSearch = inboxSearch.trim().toLowerCase();
    return contentProducerInboxItems.filter((item) => {
      if (inboxFilter === 'all') {
        // Continue with secondary filters below.
      } else if (inboxFilter === 'follow_up') {
        if (!item.needsFollowUp) return false;
      } else if (inboxFilter === 'workspace') {
        if (item.category !== 'workspace') return false;
      } else if (inboxFilter === 'approval') {
        if (item.category !== 'approval') return false;
      } else if (inboxFilter === 'delivery') {
        if (item.category !== 'delivery') return false;
      }

      if (inboxClientFilter !== 'all' && (item.clientLabel ?? t('plannerStudio.s249')) !== inboxClientFilter) {
        return false;
      }
      if (inboxTypeFilter !== 'all' && item.type !== inboxTypeFilter) {
        return false;
      }
      if (inboxStatusFilter === 'open' && item.resolved) {
        return false;
      }
      if (inboxStatusFilter === 'resolved' && !item.resolved) {
        return false;
      }
      if (inboxStatusFilter === 'unread' && !item.unread) {
        return false;
      }
      if (normalizedSearch) {
        const haystack = [
          item.projectName,
          item.clientLabel,
          item.type,
          item.title,
          item.detail,
          item.statusLabel,
          item.assignedToLabel,
          ...item.mentionLabels,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return !item.archived;
    });
  }, [
    contentProducerInboxItems,
    inboxClientFilter,
    inboxFilter,
    inboxSearch,
    inboxStatusFilter,
    inboxTypeFilter,
  ]);

  const inboxClientOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const item of contentProducerInboxItems) {
      labels.add(item.clientLabel ?? t('plannerStudio.s249'));
    }
    return Array.from(labels).sort((left, right) => left.localeCompare(right, 'nb-NO'));
  }, [contentProducerInboxItems]);

  const inboxTypeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const item of contentProducerInboxItems) {
      labels.add(item.type);
    }
    return Array.from(labels).sort((left, right) => left.localeCompare(right, 'nb-NO'));
  }, [contentProducerInboxItems]);

  const contentProducerInboxSummary = useMemo(() => ({
    followUp: contentProducerInboxItems.filter((item) => item.needsFollowUp).length,
    unread: contentProducerInboxItems.filter((item) => item.unread).length,
    workspace: contentProducerInboxItems.filter((item) => item.category === 'workspace').length,
    approval: contentProducerInboxItems.filter((item) => item.category === 'approval').length,
    delivery: contentProducerInboxItems.filter((item) => item.category === 'delivery').length,
  }), [contentProducerInboxItems]);

  const handleMarkNotificationRead = useCallback(async (notificationId: string) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s135'), {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, markAsRead]);

  const handleResolveNotification = useCallback(async (notificationId: string, resolved: boolean) => {
    try {
      await resolveNotification(notificationId, resolved);
      enqueueSnackbar(resolved ? t('plannerStudio.s111') : t('plannerStudio.s112'), {
        variant: resolved ? 'success' : 'info',
      });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s137'), {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, resolveNotification]);

  const handleArchiveNotification = useCallback(async (notificationId: string) => {
    try {
      await archiveNotification(notificationId, true);
      enqueueSnackbar(t('plannerStudio.s110'), { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s133'), {
        variant: 'error',
      });
    }
  }, [archiveNotification, enqueueSnackbar]);

  const handleAssignNotification = useCallback(async (notificationId: string, assignedToLabel: string) => {
    try {
      const selectedOwner = ownerOptions.find((owner) => owner.label === assignedToLabel);
      await updateNotification(notificationId, {
        assignedToUserId: selectedOwner?.value ?? null,
        assignedToLabel: assignedToLabel.trim() || null,
      });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s141'), {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, ownerOptions, updateNotification]);

  const handleSetNotificationDueDate = useCallback(async (notificationId: string, dueDate: string) => {
    try {
      await updateNotification(notificationId, {
        dueAt: dueDate ? `${dueDate}T23:59:59.999Z` : null,
      });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s140'), {
        variant: 'error',
      });
    }
  }, [enqueueSnackbar, updateNotification]);

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

    const category = getNotificationInboxCategory(notification);
    if (category === 'delivery') {
      onOpenMedia?.({ workspace: 'delivery' });
    }
  }, [handleMarkNotificationRead, onOpenMedia, onOpenReviews]);

  const handleOpenInboxItem = useCallback(async (item: ProducerInboxItem) => {
    if (item.source === 'notification' && item.notification) {
      await handleOpenNotification(item.notification);
      return;
    }

    if (item.source === 'approval' && item.review) {
      const approvalTemplate = item.review.review_type === 'storyboard'
        || item.review.review_type === 'manuscript'
        || item.review.review_type === 'shotlist'
        ? item.review.review_type
        : undefined;
      onOpenReviews?.({
        focusedPhase: resolveReviewPhase(item.review),
        approvalTemplate,
      });
    }
  }, [handleOpenNotification, onOpenReviews]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s136'), {
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
      { label: t('plannerStudio.s128'), value: contractCount, helper: t('plannerStudio.s022') },
      { label: 'Deadlines', value: totalDeadlines, helper: t('plannerStudio.s174') },
      { label: t('plannerStudio.s149'), value: deliveryCount, helper: t('plannerStudio.s210') },
      { label: t('plannerStudio.s075'), value: reviewSummary.pending + reviewSummary.changesRequested, helper: t('plannerStudio.s212') },
      { label: t('plannerStudio.s192'), value: pendingFollowUps, helper: t('plannerStudio.s034') },
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

    const clientLabel = liveProject.clientName || clientIntake.contactName || t('plannerStudio.s120');
    const clientNote = liveProject.clientEmail || clientIntake.contactEmail || '';
    if (meetingType !== 'casting' || hasText(clientNote) || hasText(liveProject.clientName)) {
      addParticipant({
        id: 'client-primary',
        label: clientNote ? `${clientLabel} · ${clientNote}` : clientLabel,
        role: t('plannerStudio.s120'),
        kind: 'client',
        required: meetingType !== 'casting',
        availability: 'unknown',
        note: t('plannerStudio.s048'),
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
        note: assignedCount > 0 ? t('plannerStudio.t012', { v0: assignedCount }) : undefined,
      });
    });

    if (meetingType === 'casting' && liveProject.roles.length > 0) {
      addParticipant({
        id: 'casting-roles',
        label: t('plannerStudio.t016', { v0: liveProject.roles.length }),
        role: 'Casting scope',
        kind: 'cast',
        required: false,
        availability: 'unknown',
        note: t('plannerStudio.s045'),
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

    pushAsset('brief', t('plannerStudio.s208'), 'client_intake');
    if (meetingType === 'creative' || phase === 'preproduction') {
      pushAsset('storyboard', t('plannerStudio.s230'), 'storyboard');
      pushAsset('manuscript', t('plannerStudio.s167'), 'manuscript');
    }
    if (meetingType === 'production' || phase === 'production') {
      pushAsset('shotlist', t('plannerStudio.s225'), 'shotlist');
      pushAsset('reference', liveProject.locations.length > 0 ? `Lokasjon · ${liveProject.locations[0].name}` : t('plannerStudio.s153'));
    }
    if (meetingType === 'delivery' || phase === 'postproduction') {
      pushAsset('timeline', t('plannerStudio.s059'), 'meeting_follow_up');
      pushAsset('contract', t('plannerStudio.s129'), 'project_agreement');
    }

    return assets;
  }, [entityOptions, liveProject.locations]);

  const buildMeetingDraft = useCallback((
    meetingType: ProducerPlannerMeetingType,
    phase: ProducerPlanningPhase,
  ): MeetingDraft => {
    const defaults = getMeetingTypeDefaults(t, meetingType);
    const participants = buildSuggestedParticipants(meetingType, phase);
    const assets = buildSuggestedAssets(meetingType, phase);
    const locationLabel = phase === 'production'
      ? (productionDays[0]?.locationId
        ? liveProject.locations.find((location) => location.id === productionDays[0]?.locationId)?.name ?? t('plannerStudio.s222')
        : liveProject.locations[0]?.name ?? t('plannerStudio.s222'))
      : phase === 'postproduction'
        ? t('plannerStudio.s216')
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
    () => getMeetingTypeDefaults(t, coordinationMeetingType).agenda,
    [coordinationMeetingType],
  );

  const coordinationRows = useMemo<CoordinationRow[]>(() => {
    return suggestedParticipants.map((participant) => {
      const assigned = participant.kind === 'crew'
        ? t('plannerStudio.t009', { v0: productionDays.filter((day) => (day.crew ?? []).includes(participant.id)).length })
        : participant.kind === 'client'
          ? t('plannerStudio.t024', { v0: reviewSummary.pending + reviewSummary.changesRequested })
          : participant.kind === 'cast'
            ? t('plannerStudio.t015', { v0: liveProject.roles.length })
            : '—';
      const conflict = participant.availability === 'unavailable'
        ? t('plannerStudio.s244')
        : participant.availability === 'tentative'
          ? t('plannerStudio.s177')
          : t('plannerStudio.s103');
      const recommendation = participant.required
        ? t('plannerStudio.s046')
        : t('plannerStudio.s115');
      return {
        id: participant.id,
        label: participant.label,
        role: participant.role ?? t('plannerStudio.s049'),
        availability: participant.availability === 'available'
          ? t('plannerStudio.s243')
          : participant.availability === 'tentative'
            ? t('plannerStudio.s248')
            : participant.availability === 'unavailable'
              ? t('plannerStudio.s251')
              : t('plannerStudio.s087'),
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
      return t('plannerStudio.t021', { v0: toDisplayDateTime(t, `${phaseRange.start}T09:00:00`), v1: toDisplayDateTime(t, `${phaseRange.end}T17:00:00`) });
    }
    const firstShootDay = [...productionDays]
      .filter((day) => hasText(day.date))
      .sort((left, right) => compareDatesAsc(left.date, right.date))[0];
    if (firstShootDay) {
      return t('plannerStudio.t019', { v0: toDisplayDateTime(t, `${firstShootDay.date}T09:00:00`) });
    }
    return t('plannerStudio.s095');
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
      ? t('plannerStudio.t005', { v0: PRODUCER_PLANNING_PHASE_LABELS[phaseInView] })
      : t('plannerStudio.t006', { v0: PRODUCER_PLANNING_PHASE_LABELS[phaseInView] });
    setTimelineActionDraft({
      kind,
      phase: phaseInView,
      title: defaultTitle,
      description: kind === 'milestone'
        ? t('plannerStudio.s031')
        : t('plannerStudio.s032'),
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
  const mobilePlannerFeedItems = useMemo(
    () => timelineUrgentItems.slice(0, 4),
    [timelineUrgentItems],
  );

  const calendarEntries = useMemo<PlannerCalendarEntry[]>(() => {
    const entries: PlannerCalendarEntry[] = [];

    planningDraft.phasePlan.forEach((item) => {
      if (isValidDate(item.endDate)) {
        entries.push({
          id: `phase:${item.phase}`,
          type: 'deadline',
          title: item.title || PRODUCER_PLANNING_PHASE_LABELS[item.phase],
          detail: item.clientCheckpoint || item.objective || t('plannerStudio.s064'),
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
        detail: item.description?.trim() || t('plannerStudio.s211'),
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
        detail: `${item.channel || t('plannerStudio.s148')} · ${item.format || t('plannerStudio.s257')}`,
        date: item.publishAt!,
        phase: item.phase,
        roleTags: ['client', 'editor'],
      });
    });

    if (!isContentProducerPlanner) {
      productionDays.forEach((day) => {
        if (!isValidDate(day.date)) {
          return;
        }
        const locationName = liveProject.locations.find((location) => location.id === day.locationId)?.name ?? t('plannerStudio.s152');
        entries.push({
          id: day.id,
          type: 'shoot',
          title: `Shoot day · ${locationName}`,
          detail: t('plannerStudio.t017', { v0: (day.scenes ?? []).length, v1: (day.crew ?? []).length }),
          date: day.date ?? '',
          phase: 'production',
          roleTags: ['producer', 'director', 'dop', 'crew'],
        });
      });
    }

    if (isValidDate(planningDraft.meetingWorkspace.scheduledAt)) {
      entries.push({
        id: 'meeting-workspace',
        type: 'meeting',
        title: planningDraft.meetingWorkspace.sessionLabel?.trim() || t('plannerStudio.s197'),
        detail: planningDraft.meetingWorkspace.contextSummary?.trim() || t('plannerStudio.s179'),
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
        detail: review.description?.trim() || t('plannerStudio.s123'),
        date: review.due_at!,
        phase: resolveReviewPhase(review),
        roleTags: ['client'],
      });
    });

    return entries
      .filter((entry) => selectedPhase === 'all' || entry.phase === selectedPhase)
      .filter((entry) => calendarTypeFilter === 'all' || entry.type === calendarTypeFilter)
      .filter((entry) => isContentProducerPlanner || calendarRoleFilter === 'all' || entry.roleTags.some((tag) => tag.includes(calendarRoleFilter)))
      .sort((left, right) => compareDatesAsc(left.date, right.date));
  }, [calendarRoleFilter, calendarTypeFilter, isContentProducerPlanner, liveProject.locations, ownerLookup, phaseInView, planningDraft, productionDays, reviews, selectedPhase, timelineItems]);

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
        timelineActionDraft.kind === 'milestone' ? t('plannerStudio.s188') : t('plannerStudio.s189'),
        { variant: 'success' },
      );
      closeTimelineActionDialog();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s139'), { variant: 'error' });
    }
  }, [closeTimelineActionDialog, createItem, enqueueSnackbar, timelineActionDraft]);

  const handleCreateMeeting = useCallback(async () => {
    if (!meetingDraft) {
      return;
    }

    const selectedParticipants = suggestedParticipants.filter((participant) => meetingDraft.participantIds.includes(participant.id));
    const selectedAssets = suggestedAssets.filter((asset) => meetingDraft.assetIds.includes(asset.id));
    const agendaItems: ProducerMeetingAgendaItem[] = getMeetingTypeDefaults(t, meetingDraft.type).agenda.map((item) => ({
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
        description: meetingDraft.contextSummary.trim() || t('plannerStudio.t007', { v0: PRODUCER_PLANNER_MEETING_TYPE_LABELS[meetingDraft.type].toLowerCase() }),
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
      enqueueSnackbar(t('plannerStudio.s181'), { variant: 'success' });
      closeMeetingDialog();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : t('plannerStudio.s138'), { variant: 'error' });
    }
  }, [closeMeetingDialog, createItem, enqueueSnackbar, meetingDraft, planningDraft, savePlanning, suggestedAssets, suggestedParticipants]);

  const meetingDialogAgenda = useMemo(
    () => getMeetingTypeDefaults(t, meetingDraft?.type ?? coordinationMeetingType).agenda,
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
              {isContentProducerPlanner
                ? t('plannerStudio.s202')
                : t('plannerStudio.s203')}
            </Typography>
          </Box>

          {useMobileContentProducerPlanner ? (
            <Stack spacing={0.9}>
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={contentProducerInboxSummary.followUp > 0 ? t('plannerStudio.t010', { v0: contentProducerInboxSummary.followUp }) : t('plannerStudio.s217')}
                  sx={{
                    bgcolor: contentProducerInboxSummary.followUp > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.16)',
                    color: contentProducerInboxSummary.followUp > 0 ? '#fde68a' : '#bbf7d0',
                  }}
                />
                <Chip
                  size="small"
                  label={notificationsUnreadCount > 0 ? t('plannerStudio.t011', { v0: notificationsUnreadCount }) : t('plannerStudio.s099')}
                  sx={{
                    bgcolor: notificationsUnreadCount > 0 ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.16)',
                    color: notificationsUnreadCount > 0 ? '#bfdbfe' : '#cbd5e1',
                  }}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 0.8,
                }}
              >
                {!readOnly ? (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<VideoCallIcon />}
                    onClick={() => openMeetingDialog('creative')}
                    sx={{ minHeight: 44, bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s070')}
                  </Button>
                ) : null}
                {onOpenMedia ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onOpenMedia({ workspace: 'brief' })}
                    sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s209')}
                  </Button>
                ) : null}
                {onOpenReviews ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onOpenReviews({ focusedPhase: phaseInView })}
                    sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s073')}
                  </Button>
                ) : null}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MoreHorizIcon />}
                  onClick={() => setMobileActionsOpen(true)}
                  sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                >
                  
                  {t('plannerStudio.s172')}
                </Button>
              </Box>
            </Stack>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="planner-phase-filter-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>{t('plannerStudio.s063')}</InputLabel>
                <Select
                  labelId="planner-phase-filter-label"
                  label={t('plannerStudio.s063')}
                  value={selectedPhase}
                  onChange={(event) => setSelectedPhase(event.target.value as ProducerPlanningPhase | 'all')}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                >
                  <MenuItem value="all">{t('plannerStudio.s005')}</MenuItem>
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
                {availableViewOptions.map((option) => (
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
                    {isContentProducerPlanner ? t('plannerStudio.s193') : t('plannerStudio.s194')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AssignmentTurnedInIcon />}
                    onClick={() => openTimelineActionDialog('milestone')}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s145')}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddTaskIcon />}
                    onClick={() => openTimelineActionDialog('task')}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    {isContentProducerPlanner ? t('plannerStudio.s146') : t('plannerStudio.s242')}
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          )}
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
                  <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.82rem', minHeight: useMobileContentProducerPlanner ? 'auto' : 38 }}>
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
                    <Chip size="small" label={t('plannerStudio.t025', { v0: card.progress })} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
                    <Chip size="small" label={`${card.blockers} blockers`} sx={{ bgcolor: 'rgba(248,113,113,0.16)', color: '#fecaca' }} />
                    {!useMobileContentProducerPlanner ? (
                      <Chip size="small" label={`${card.approvals} approvals`} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                    ) : null}
                  </Stack>
                  <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.76rem' }}>
                    
                    {t('plannerStudio.s184')} {card.nextDate ? toDisplayDateTime(t, `${toDateOnly(card.nextDate)}T09:00:00`) : t('plannerStudio.s086')}
                  </Typography>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {savingPlanning ? <Alert severity="info">{t('plannerStudio.s143')}</Alert> : null}
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

      {isContentProducerPlanner ? (
        <Box
          sx={{
            p: 1.1,
            borderRadius: 2,
            border: '1px solid rgba(148,163,184,0.18)',
            background: 'rgba(15,23,42,0.78)',
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 0.95 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                
                {t('plannerStudio.s109')}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>
                
                {t('plannerStudio.s062')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
              <Chip
                size="small"
                label={contentProducerInboxSummary.followUp > 0 ? t('plannerStudio.t020', { v0: contentProducerInboxSummary.followUp }) : t('plannerStudio.s107')}
                sx={{
                  bgcolor: contentProducerInboxSummary.followUp > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.16)',
                  color: contentProducerInboxSummary.followUp > 0 ? '#fde68a' : '#bbf7d0',
                }}
              />
              <Chip
                size="small"
                label={contentProducerInboxSummary.unread > 0 ? `${contentProducerInboxSummary.unread} uleste` : t('plannerStudio.s009')}
                sx={{
                  bgcolor: contentProducerInboxSummary.unread > 0 ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.16)',
                  color: contentProducerInboxSummary.unread > 0 ? '#bfdbfe' : '#cbd5e1',
                }}
              />
              {notificationsUnreadCount > 0 ? (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => { void handleMarkAllNotificationsRead(); }}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  
                  {t('plannerStudio.s170')}
                </Button>
              ) : null}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {(Object.keys(PRODUCER_INBOX_FILTER_LABELS) as ProducerInboxFilter[]).map((filterKey) => {
              const count = filterKey === 'all'
                ? contentProducerInboxItems.length
                : filterKey === 'follow_up'
                  ? contentProducerInboxSummary.followUp
                  : filterKey === 'workspace'
                    ? contentProducerInboxSummary.workspace
                    : filterKey === 'approval'
                      ? contentProducerInboxSummary.approval
                      : contentProducerInboxSummary.delivery;
              return (
                <Chip
                  key={filterKey}
                  clickable
                  color={inboxFilter === filterKey ? 'primary' : 'default'}
                  label={`${PRODUCER_INBOX_FILTER_LABELS[filterKey]} · ${count}`}
                  onClick={() => setInboxFilter(filterKey)}
                  sx={{
                    bgcolor: inboxFilter === filterKey ? 'rgba(59,130,246,0.18)' : 'rgba(148,163,184,0.12)',
                    color: inboxFilter === filterKey ? '#bfdbfe' : '#cbd5e1',
                    border: inboxFilter === filterKey ? '1px solid rgba(96,165,250,0.32)' : '1px solid rgba(148,163,184,0.14)',
                    fontWeight: 700,
                  }}
                />
              );
            })}
          </Stack>

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={0.8}
            sx={{
              mb: 1,
              '& .MuiInputBase-root': {
                color: '#e5edf7',
                bgcolor: 'rgba(2,6,23,0.46)',
              },
              '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
            }}
          >
            <TextField
              size="small"
              label={t('plannerStudio.s232')}
              value={inboxSearch}
              onChange={(event) => setInboxSearch(event.target.value)}
              placeholder={t('plannerStudio.s233')}
              sx={{ minWidth: { md: 260 }, flex: 1 }}
            />
            <TextField
              select
              size="small"
              label={t('plannerStudio.s207')}
              value={project.id}
              sx={{ minWidth: { md: 190 } }}
              disabled
            >
              <MenuItem value={project.id}>{project.name}</MenuItem>
            </TextField>
            <TextField
              select
              size="small"
              label={t('plannerStudio.s120')}
              value={inboxClientFilter}
              onChange={(event) => setInboxClientFilter(event.target.value)}
              sx={{ minWidth: { md: 170 } }}
            >
              <MenuItem value="all">{t('plannerStudio.s006')}</MenuItem>
              {inboxClientOptions.map((clientLabel) => (
                <MenuItem key={clientLabel} value={clientLabel}>{clientLabel}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Type"
              value={inboxTypeFilter}
              onChange={(event) => setInboxTypeFilter(event.target.value)}
              sx={{ minWidth: { md: 150 } }}
            >
              <MenuItem value="all">{t('plannerStudio.s007')}</MenuItem>
              {inboxTypeOptions.map((typeLabel) => (
                <MenuItem key={typeLabel} value={typeLabel}>{typeLabel}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label={t('plannerStudio.s228')}
              value={inboxStatusFilter}
              onChange={(event) => setInboxStatusFilter(event.target.value as typeof inboxStatusFilter)}
              sx={{ minWidth: { md: 140 } }}
            >
              <MenuItem value="open">{t('plannerStudio.s258')}</MenuItem>
              <MenuItem value="unread">{t('plannerStudio.s247')}</MenuItem>
              <MenuItem value="resolved">{t('plannerStudio.s164')}</MenuItem>
              <MenuItem value="all">{t('plannerStudio.s004')}</MenuItem>
            </TextField>
          </Stack>

          {filteredContentProducerInboxItems.length === 0 ? (
            <Alert severity="success">
              
              {t('plannerStudio.s113')}
            </Alert>
          ) : (
            <Stack spacing={0.8} sx={{ maxHeight: { xs: 'none', lg: 460 }, overflowY: { lg: 'auto' }, pr: { lg: 0.4 } }}>
              {filteredContentProducerInboxItems.map((item) => (
                <Box
                  key={item.id}
                  sx={{
                    p: 0.95,
                    borderRadius: 1.6,
                    border: item.needsFollowUp
                      ? '1px solid rgba(245,158,11,0.28)'
                      : item.unread
                        ? '1px solid rgba(59,130,246,0.28)'
                        : '1px solid rgba(148,163,184,0.16)',
                    background: item.needsFollowUp
                      ? 'rgba(30,41,59,0.92)'
                      : item.unread
                        ? 'rgba(15,23,42,0.92)'
                        : 'rgba(2,6,23,0.36)',
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} justifyContent="space-between">
                    <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={PRODUCER_INBOX_CATEGORY_LABELS[item.category]}
                          sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                        />
                        <Chip
                          size="small"
                          label={item.statusLabel}
                          color={item.tone === 'warning' ? 'warning' : item.tone === 'error' ? 'error' : item.tone === 'success' ? 'success' : 'info'}
                          variant={item.tone === 'info' ? 'outlined' : 'filled'}
                        />
                        <Chip
                          size="small"
                          label={item.projectName}
                          sx={{ bgcolor: 'rgba(14,165,233,0.12)', color: '#bae6fd' }}
                        />
                        {hasText(item.clientLabel) ? (
                          <Chip
                            size="small"
                            label={t('plannerStudio.t004', { v0: item.clientLabel })}
                            sx={{ bgcolor: 'rgba(16,185,129,0.12)', color: '#bbf7d0' }}
                          />
                        ) : null}
                        {hasText(item.assignedToLabel) ? (
                          <Chip
                            size="small"
                            label={t('plannerStudio.t001', { v0: item.assignedToLabel })}
                            sx={{ bgcolor: 'rgba(168,85,247,0.12)', color: '#e9d5ff' }}
                          />
                        ) : null}
                        <Chip
                          size="small"
                          label={toDisplayDateTime(t, item.updatedAt)}
                          sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }}
                        />
                        {hasText(item.dueAt) ? (
                          <Chip
                            size="small"
                            label={t('plannerStudio.t003', { v0: toDisplayDateTime(t, item.dueAt) })}
                            sx={{ bgcolor: 'rgba(244,63,94,0.14)', color: '#fecdd3' }}
                          />
                        ) : null}
                        {item.mentionLabels.slice(0, 3).map((mention) => (
                          <Chip
                            key={mention}
                            size="small"
                            label={`@${mention}`}
                            sx={{ bgcolor: 'rgba(251,191,36,0.12)', color: '#fde68a' }}
                          />
                        ))}
                      </Stack>
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                        {item.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        {item.detail}
                      </Typography>
                    </Stack>

                    <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.7} alignItems={{ md: 'flex-end' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => { void handleOpenInboxItem(item); }}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        {item.actionLabel}
                      </Button>
                      {item.source === 'notification' && item.notification ? (
                        <Stack
                          direction={{ xs: 'column', sm: 'row', md: 'column' }}
                          spacing={0.6}
                          sx={{
                            minWidth: { xs: '100%', sm: 220, md: 190 },
                            '& .MuiInputBase-root': {
                              color: '#e5edf7',
                              bgcolor: 'rgba(2,6,23,0.5)',
                            },
                            '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.7)' },
                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.24)' },
                          }}
                        >
                          <TextField
                            select
                            size="small"
                            label={t('plannerStudio.s011')}
                            value={item.assignedToLabel ?? ''}
                            onChange={(event) => {
                              void handleAssignNotification(item.notification!.id, event.target.value);
                            }}
                          >
                            <MenuItem value="">{t('plannerStudio.s089')}</MenuItem>
                            {ownerOptions.map((owner) => (
                              <MenuItem key={owner.value} value={owner.label}>{owner.label}</MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            size="small"
                            label={t('plannerStudio.s069')}
                            type="date"
                            value={item.dueAt ? item.dueAt.slice(0, 10) : ''}
                            onChange={(event) => {
                              void handleSetNotificationDueDate(item.notification!.id, event.target.value);
                            }}
                            InputLabelProps={{ shrink: true }}
                          />
                          <Stack direction="row" spacing={0.6}>
                            <Button
                              size="small"
                              variant={item.resolved ? 'outlined' : 'contained'}
                              color={item.resolved ? 'inherit' : 'success'}
                              onClick={() => {
                                void handleResolveNotification(item.notification!.id, !item.resolved);
                              }}
                              sx={{ flex: 1, textTransform: 'none', fontWeight: 700 }}
                            >
                              {item.resolved ? t('plannerStudio.s071') : t('plannerStudio.s162')}
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              color="inherit"
                              onClick={() => { void handleArchiveNotification(item.notification!.id); }}
                              sx={{ flex: 1, textTransform: 'none', fontWeight: 700 }}
                            >
                              
                              {t('plannerStudio.s012')}
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                      {item.source === 'notification' && item.notification && !item.notification.read ? (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => { void handleMarkNotificationRead(item.notification!.id); }}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          
                          {t('plannerStudio.s169')}
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      ) : (
        <>
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
                  
                  {t('plannerStudio.s250')}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>
                  
                  {t('plannerStudio.s083')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Chip
                  size="small"
                  label={outstandingClientApprovals.length > 0 ? t('plannerStudio.t023', { v0: outstandingClientApprovals.length }) : t('plannerStudio.s106')}
                  sx={{
                    bgcolor: outstandingClientApprovals.length > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(34,197,94,0.16)',
                    color: outstandingClientApprovals.length > 0 ? '#fde68a' : '#bbf7d0',
                  }}
                />
                {outstandingClientApprovals.length > 0 && onOpenReviews ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onOpenReviews({ focusedPhase: phaseInView })}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s259')}
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            {outstandingClientApprovals.length === 0 ? (
              <Alert severity="success">{t('plannerStudio.s104')}</Alert>
            ) : (
              <Stack spacing={0.85}>
                {outstandingClientApprovals.slice(0, 5).map((review) => {
                  const statusTone = getReviewStatusTone(review.status);
                  const phase = resolveReviewPhase(review);
                  const approvalTemplate = review.review_type === 'storyboard' || review.review_type === 'manuscript' || review.review_type === 'shotlist'
                    ? review.review_type
                    : undefined;
                  return (
                    <Box
                      key={review.id}
                      sx={{
                        p: 0.95,
                        borderRadius: 1.6,
                        border: '1px solid rgba(148,163,184,0.16)',
                        background: 'rgba(2,6,23,0.42)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.9} justifyContent="space-between">
                        <Stack spacing={0.45} sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              color={statusTone}
                              label={getReviewStatusLabel(t, review.status)}
                              variant={statusTone === 'info' ? 'outlined' : 'filled'}
                            />
                            <Chip
                              size="small"
                              label={getReviewTypeLabel(t, review)}
                              sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                            />
                            <Chip
                              size="small"
                              label={PRODUCER_PLANNING_PHASE_LABELS[phase]}
                              sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }}
                            />
                            {hasText(review.due_at) ? (
                              <Chip
                                size="small"
                                label={t('plannerStudio.t003', { v0: toDisplayDateTime(t, review.due_at) })}
                                sx={{ bgcolor: 'rgba(244,63,94,0.14)', color: '#fecdd3' }}
                              />
                            ) : null}
                          </Stack>
                          <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                            {review.title || getReviewTypeLabel(t, review)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                            {review.description?.trim() || t('plannerStudio.s051')}
                          </Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.78)', fontSize: '0.76rem' }}>
                            
                            {t('plannerStudio.s227')} {toDisplayDateTime(t, review.updated_at)}
                          </Typography>
                        </Stack>

                        {onOpenReviews ? (
                          <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.7} alignItems={{ md: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenReviews({ focusedPhase: phase, approvalTemplate })}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              
                              {t('plannerStudio.s258')}
                            </Button>
                          </Stack>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
                {outstandingClientApprovals.length > 5 ? (
                  <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem' }}>
                    + {outstandingClientApprovals.length - 5}  {t('plannerStudio.s256')}
                  </Typography>
                ) : null}
              </Stack>
            )}
          </Box>

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
                  
                  {t('plannerStudio.s252')}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.85rem' }}>
                  
                  {t('plannerStudio.s206')}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.8} alignItems="center">
                <Chip
                  size="small"
                  label={notificationsUnreadCount > 0 ? `${notificationsUnreadCount} uleste` : t('plannerStudio.s009')}
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
                    
                    {t('plannerStudio.s168')}
                  </Button>
                ) : null}
              </Stack>
            </Stack>

            {recentNotifications.length === 0 ? (
              <Alert severity="info">{t('plannerStudio.s105')}</Alert>
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
                            label={notification.read ? t('plannerStudio.s147') : t('plannerStudio.s186')}
                            sx={{
                              bgcolor: notification.read ? 'rgba(148,163,184,0.16)' : 'rgba(59,130,246,0.18)',
                              color: notification.read ? '#cbd5e1' : '#bfdbfe',
                            }}
                          />
                          <Chip
                            size="small"
                            color={getNotificationSeverity(notification) === 'warning' ? 'warning' : 'info'}
                            label={toDisplayDateTime(t, notification.updated_at)}
                            variant="outlined"
                          />
                        </Stack>
                        <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                          {notification.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                          {notification.message || t('plannerStudio.s253')}
                        </Typography>
                      </Stack>

                      <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.7} alignItems={{ md: 'flex-end' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleOpenNotification(notification); }}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          
                          {t('plannerStudio.s258')}
                        </Button>
                        {!notification.read ? (
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => { void handleMarkNotificationRead(notification.id); }}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            
                            {t('plannerStudio.s169')}
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </>
      )}

      {viewMode === 'timeline' ? (
        useMobileContentProducerPlanner ? (
          <Stack spacing={1.1}>
            <Box
              sx={{
                p: 1.1,
                borderRadius: 2,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(15,23,42,0.78)',
              }}
            >
              <Stack spacing={0.95}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                    
                    {t('plannerStudio.s176')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.82rem', mt: 0.28 }}>
                    
                    {t('plannerStudio.s052')}
                  </Typography>
                </Box>
                {resumeCard && onResumeWorkspace ? (
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1.8,
                      border: '1px solid rgba(37,99,235,0.3)',
                      background: 'linear-gradient(135deg, rgba(30,64,175,0.24) 0%, rgba(15,23,42,0.92) 100%)',
                    }}
                  >
                    <Stack spacing={0.8}>
                      <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          label={t('plannerStudio.s067')}
                          sx={{
                            bgcolor: 'rgba(59,130,246,0.16)',
                            color: '#bfdbfe',
                            border: '1px solid rgba(96,165,250,0.34)',
                            fontWeight: 700,
                          }}
                        />
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>
                          {resumeCard.title}
                        </Typography>
                      </Stack>
                      <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.82rem', lineHeight: 1.45 }}>
                        {resumeCard.detail}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={onResumeWorkspace}
                        sx={{
                          minHeight: 48,
                          borderRadius: 1.6,
                          bgcolor: '#2563eb',
                          textTransform: 'none',
                          fontWeight: 700,
                        }}
                      >
                        {resumeCard.actionLabel}
                      </Button>
                    </Stack>
                  </Box>
                ) : null}
                <Stack spacing={0.75}>
                  {mobilePlannerFeedItems.length > 0 ? mobilePlannerFeedItems.map((item) => {
                    const tone = getTimelineStatusTone(item.status);
                    const styles = getToneStyles(tone);
                    return (
                      <Box
                        key={item.id}
                        sx={{
                          p: 0.95,
                          borderRadius: 1.5,
                          border: `1px solid ${styles.border}`,
                          background: styles.background,
                        }}
                      >
                        <Stack spacing={0.55}>
                          <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={PRODUCER_PLANNING_PHASE_LABELS[getPhaseForTimelineItem(item)]} sx={{ bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }} />
                            <Chip size="small" label={item.status} sx={{ bgcolor: styles.chipBackground, color: styles.chipColor }} />
                            {hasText(item.due_at) ? (
                              <Chip size="small" label={toDisplayDateTime(t, item.due_at)} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
                            ) : null}
                          </Stack>
                          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>
                            {item.title}
                          </Typography>
                          <Typography sx={{ color: 'rgba(226,232,240,0.74)', fontSize: '0.8rem', lineHeight: 1.45 }}>
                            {item.description?.trim() || t('plannerStudio.s092')}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  }) : (
                    <Alert severity="success">{t('plannerStudio.s108')}</Alert>
                  )}
                </Stack>

                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                  {onOpenMedia ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenMedia({ workspace: 'brief' })}
                      sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s263')}
                    </Button>
                  ) : null}
                  {onOpenReviews ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenReviews({ focusedPhase: phaseInView })}
                      sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s262')}
                    </Button>
                  ) : null}
                  {!readOnly ? (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => openMeetingDialog('creative')}
                      sx={{ minHeight: 44, bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s187')}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Box>
          </Stack>
        ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', xl: '1.4fr 0.95fr' },
            gap: 1.25,
            minHeight: 0,
          }}
        >
          <Stack spacing={1.25} sx={{ minWidth: 0 }}>
            <CollapsibleSection
              title={t('plannerStudio.s178')}
              defaultOpen={false}
              summary={t('plannerStudio.t008', { v0: (planningDraft.meetingWorkspace.agenda ?? []).length, v1: (planningDraft.meetingWorkspace.decisions ?? []).length, v2: (planningDraft.meetingWorkspace.followUps ?? []).filter((followUp) => followUp.status !== 'done').length })}
            >
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
                onRefreshGoogleAssets={async () => {
                  await refreshGoogleArtifacts();
                }}
              />
            </CollapsibleSection>

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
                    
                    {t('plannerStudio.s165')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.84rem', mt: 0.35 }}>
                    
                    {t('plannerStudio.s082')}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {onOpenSelection ? (
                    <Button size="small" variant="outlined" onClick={onOpenSelection} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      
                      {t('plannerStudio.s240')}
                    </Button>
                  ) : null}
                  {onOpenShotList ? (
                    <Button size="small" variant="outlined" onClick={() => onOpenShotList({ phase: phaseInView })} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      
                      {t('plannerStudio.s264')}
                    </Button>
                  ) : null}
                  {onOpenTeam ? (
                    <Button size="small" variant="outlined" onClick={onOpenTeam} sx={{ textTransform: 'none', fontWeight: 700 }}>
                      
                      {t('plannerStudio.s234')}
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
                              {(planningDraft.phasePlan.find((item) => item.phase === phase)?.objective || t('plannerStudio.s094'))}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={t('plannerStudio.t022', { v0: phaseItems.length })}
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
                                      {item.description?.trim() || t('plannerStudio.s090')}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" label={item.status} sx={{ bgcolor: styles.chipBackground, color: styles.chipColor }} />
                                    {hasText(item.due_at) ? (
                                      <Chip size="small" label={toDisplayDateTime(t, item.due_at)} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
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
                            <Alert severity="info">{t('plannerStudio.s102')}</Alert>
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
                  
                  {t('plannerStudio.s001')}
                </Typography>
                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                  {onOpenReviews ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenReviews({ focusedPhase: phaseInView })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s073')}
                    </Button>
                  ) : null}
                  {onOpenEconomy ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenEconomy({ focusedPhase: phaseInView })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s266')}
                    </Button>
                  ) : null}
                  {onOpenMedia ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenMedia({ workspace: 'brief' })}
                      sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                      
                      {t('plannerStudio.s209')}
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
                
                {t('plannerStudio.s185')}
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
                      {hasText(item.due_at) ? `Forfaller ${toDisplayDateTime(t, item.due_at)}.` : t('plannerStudio.s091')} {item.description?.trim() || ''}
                    </Typography>
                  </Box>
                )) : (
                  <Alert severity="info">{t('plannerStudio.s088')}</Alert>
                )}
              </Stack>
            </Box>
          </Stack>
        </Box>
        )
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
                  {isContentProducerPlanner ? t('plannerStudio.s117') : t('plannerStudio.s119')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                  {isContentProducerPlanner
                    ? t('plannerStudio.s041')
                    : t('plannerStudio.s042')}
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
                    <MenuItem value="all">{t('plannerStudio.s007')}</MenuItem>
                    {Object.entries(CALENDAR_TYPE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {!isContentProducerPlanner ? (
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel id="planner-calendar-role-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>{t('plannerStudio.s218')}</InputLabel>
                    <Select
                      labelId="planner-calendar-role-label"
                      label={t('plannerStudio.s218')}
                      value={calendarRoleFilter}
                      onChange={(event) => setCalendarRoleFilter(event.target.value as (typeof ROLE_FILTER_OPTIONS)[number])}
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                    >
                      <MenuItem value="all">{t('plannerStudio.s004')}</MenuItem>
                      <MenuItem value="client">{t('plannerStudio.s120')}</MenuItem>
                      <MenuItem value="producer">{t('plannerStudio.s205')}</MenuItem>
                      <MenuItem value="director">{t('plannerStudio.s213')}</MenuItem>
                      <MenuItem value="dop">DoP</MenuItem>
                      <MenuItem value="editor">Editor</MenuItem>
                      <MenuItem value="crew">Crew</MenuItem>
                    </Select>
                  </FormControl>
                ) : null}
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
                      {toDisplayDateTime(t, `${toDateOnly(entry.date)}T09:00:00`)}
                    </Typography>
                  </Stack>
                </Box>
              )) : (
                <Alert severity="info">{t('plannerStudio.s100')}</Alert>
              )}
            </Stack>
          </Box>
        </Stack>
      ) : null}

      {viewMode === 'coordination' && !isContentProducerPlanner ? (
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
                  
                  {t('plannerStudio.s131')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                  
                  {t('plannerStudio.s054')}
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel id="planner-coordination-type-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>{t('plannerStudio.s182')}</InputLabel>
                  <Select
                    labelId="planner-coordination-type-label"
                    label={t('plannerStudio.s182')}
                    value={coordinationMeetingType}
                    onChange={(event) => setCoordinationMeetingType(event.target.value as ProducerPlannerMeetingType)}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
                  >
                    {meetingTypeEntries.map(([value, label]) => (
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
                    {isContentProducerPlanner ? t('plannerStudio.s193') : t('plannerStudio.s194')}
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
                <Typography sx={{ color: '#bfdbfe', fontWeight: 700 }}>{t('plannerStudio.s010')}</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>{recommendedMeetingWindow}</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  
                  {t('plannerStudio.s024')}
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
                <Typography sx={{ color: '#fde68a', fontWeight: 700 }}>{t('plannerStudio.s166')}</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>
                  {missingCoreRoles.length > 0 ? missingCoreRoles.join(', ') : t('plannerStudio.s096')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  
                  {t('plannerStudio.s053')}
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
                <Typography sx={{ color: '#fecaca', fontWeight: 700 }}>{t('plannerStudio.s038')}</Typography>
                <Typography sx={{ color: '#fff', fontWeight: 700, mt: 0.35 }}>{plannerAlerts.length}</Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.8rem', mt: 0.25 }}>
                  
                  {t('plannerStudio.s014')}
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
              
              {t('plannerStudio.s084')}
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

      {useMobileContentProducerPlanner ? (
        <Drawer
          anchor="bottom"
          open={mobileActionsOpen}
          onClose={() => setMobileActionsOpen(false)}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              border: '1px solid rgba(148,163,184,0.18)',
              borderBottom: 'none',
              background: 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%)',
              p: 1.4,
            },
          }}
        >
          <Stack spacing={1.1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                  
                  {t('plannerStudio.s065')}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.8rem' }}>
                  
                  {t('plannerStudio.s221')}
                </Typography>
              </Box>
              <IconButton onClick={() => setMobileActionsOpen(false)} aria-label={t('plannerStudio.s154')} sx={{ color: '#cbd5e1' }}>
                <MoreHorizIcon />
              </IconButton>
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel id="planner-mobile-phase-filter-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>{t('plannerStudio.s063')}</InputLabel>
              <Select
                labelId="planner-mobile-phase-filter-label"
                label={t('plannerStudio.s063')}
                value={selectedPhase}
                onChange={(event) => setSelectedPhase(event.target.value as ProducerPlanningPhase | 'all')}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' } }}
              >
                <MenuItem value="all">{t('plannerStudio.s005')}</MenuItem>
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
                  setMobileActionsOpen(false);
                }
              }}
              sx={{
                alignSelf: 'stretch',
                '& .MuiToggleButton-root': {
                  flex: 1,
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
              {availableViewOptions.map((option) => (
                <ToggleButton key={option.value} value={option.value}>{option.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>

            {!readOnly ? (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 0.8,
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AssignmentTurnedInIcon />}
                  onClick={() => {
                    setMobileActionsOpen(false);
                    openTimelineActionDialog('milestone');
                  }}
                  sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                >
                  
                  {t('plannerStudio.s173')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddTaskIcon />}
                  onClick={() => {
                    setMobileActionsOpen(false);
                    openTimelineActionDialog('task');
                  }}
                  sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                >
                  
                  {t('plannerStudio.s191')}
                </Button>
                {onOpenMedia ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setMobileActionsOpen(false);
                      onOpenMedia({ workspace: 'delivery' });
                    }}
                    sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s150')}
                  </Button>
                ) : null}
                {onOpenEconomy ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setMobileActionsOpen(false);
                      onOpenEconomy({ focusedPhase: phaseInView });
                    }}
                    sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }}
                  >
                    
                    {t('plannerStudio.s266')}
                  </Button>
                ) : null}
              </Box>
            ) : null}
          </Stack>
        </Drawer>
      ) : null}

      <Dialog open={meetingDialogOpen} onClose={closeMeetingDialog} fullWidth maxWidth="md">
        <DialogTitle>{t('plannerStudio.s195')}</DialogTitle>
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
                    label={t('plannerStudio.s182')}
                    value={meetingDraft.type}
                    onChange={(event) => {
                      const nextType = event.target.value as ProducerPlannerMeetingType;
                      setMeetingDraft(buildMeetingDraft(nextType, meetingDraft.phase));
                    }}
                    fullWidth
                  >
                    {meetingTypeEntries.map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label={t('plannerStudio.s063')}
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
                    label={t('plannerStudio.s245')}
                    value={meetingDraft.title}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, title: event.target.value } : previous)}
                    fullWidth
                  />
                </>
              ) : null}

              {meetingStep === 1 ? (
                <>
                  <Alert severity="info">
                    
                    {t('plannerStudio.s231')}
                  </Alert>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>{t('plannerStudio.s050')}</Typography>
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
                              {participant.role ?? t('plannerStudio.s049')} · {participant.note ?? t('plannerStudio.s093')}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>{t('plannerStudio.s214')}</Typography>
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
                    <Typography sx={{ fontWeight: 700, mb: 0.6 }}>{t('plannerStudio.s002')}</Typography>
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
                    label={t('plannerStudio.s238')}
                    type="datetime-local"
                    value={meetingDraft.scheduledAt}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, scheduledAt: event.target.value } : previous)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    select
                    label={t('plannerStudio.s180')}
                    value={meetingDraft.mode}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, mode: event.target.value as ProducerPlannerMeetingMode } : previous)}
                    fullWidth
                  >
                    {Object.entries(PRODUCER_PLANNER_MEETING_MODE_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label={t('plannerStudio.s151')}
                    value={meetingDraft.locationLabel}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, locationLabel: event.target.value } : previous)}
                    fullWidth
                  />
                  <TextField
                    label={t('plannerStudio.s126')}
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
                    label={t('plannerStudio.s068')}
                    value={meetingDraft.expectations}
                    onChange={(event) => setMeetingDraft((previous) => previous ? { ...previous, expectations: event.target.value } : previous)}
                    multiline
                    minRows={5}
                    helperText={t('plannerStudio.s265')}
                    fullWidth
                  />
                  <Alert severity="info">
                    
                    {t('plannerStudio.s190')}
                  </Alert>
                </>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMeetingDialog}>{t('plannerStudio.s015')}</Button>
          {meetingStep > 0 ? (
            <Button onClick={() => setMeetingStep((previous) => Math.max(0, previous - 1) as MeetingDraftStep)}>
              
              {t('plannerStudio.s241')}
            </Button>
          ) : null}
          {meetingStep < 3 ? (
            <Button
              variant="contained"
              onClick={() => setMeetingStep((previous) => Math.min(3, previous + 1) as MeetingDraftStep)}
            >
              
              {t('plannerStudio.s183')}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => { void handleCreateMeeting(); }}>
              
              {t('plannerStudio.s194')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(timelineActionDraft)} onClose={closeTimelineActionDialog} fullWidth maxWidth="sm">
        <DialogTitle>{timelineActionDraft?.kind === 'milestone' ? t('plannerStudio.s145') : t('plannerStudio.s242')}</DialogTitle>
        <DialogContent dividers>
          {timelineActionDraft ? (
            <Stack spacing={1.1}>
              <TextField
                select
                label={t('plannerStudio.s063')}
                value={timelineActionDraft.phase}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, phase: event.target.value as ProducerPhase } : previous)}
                fullWidth
              >
                {PHASE_ORDER.map((phase) => (
                  <MenuItem key={phase} value={phase}>{PRODUCER_PLANNING_PHASE_LABELS[phase]}</MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('plannerStudio.s245')}
                value={timelineActionDraft.title}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, title: event.target.value } : previous)}
                fullWidth
              />
              <TextField
                label={t('plannerStudio.s033')}
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
                label={t('plannerStudio.s011')}
                value={timelineActionDraft.ownerUserId}
                onChange={(event) => setTimelineActionDraft((previous) => previous ? { ...previous, ownerUserId: event.target.value } : previous)}
                fullWidth
              >
                <MenuItem value="">{t('plannerStudio.s101')}</MenuItem>
                {ownerOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={t('plannerStudio.s125')}
                value={timelineActionDraft.linkedEntityId ? `${timelineActionDraft.linkedEntityType}:${timelineActionDraft.linkedEntityId}` : ''}
                onChange={(event) => {
                  const [linkedEntityType = '', linkedEntityId = ''] = String(event.target.value).split(':');
                  setTimelineActionDraft((previous) => previous ? { ...previous, linkedEntityType, linkedEntityId } : previous);
                }}
                fullWidth
              >
                <MenuItem value="">{t('plannerStudio.s097')}</MenuItem>
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
          <Button onClick={closeTimelineActionDialog}>{t('plannerStudio.s015')}</Button>
          <Button variant="contained" onClick={() => { void handleCreateTimelineItem(); }}>
            
            {t('plannerStudio.s142')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
