import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForward as ArrowForwardIcon,
  FactCheck as FactCheckIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { CastingProject, CrewMember } from '../models/casting';
import { castingService } from '../services/castingService';
import {
  projectAgreementsApi,
  type ProjectAgreement,
} from '../services/castingApiService';
import { useProducerEconomy } from '../hooks/useProducerEconomy';
import { useProjectProductionEstimate } from '../hooks/useProjectProductionEstimate';
import { useProducerReviews } from '../hooks/useProducerReviews';
import { useProducerTimeline } from '../hooks/useProducerTimeline';
import settingsService from '../services/settingsService';
import SplitSheetEditor from './split-sheets/SplitSheetEditor';
import {
  formatProducerTimestamp,
  getProducerReviewStatusLabel,
  getProducerReviewTypeLabel,
  getProducerTimelineStatusLabel,
  makeProducerPackageEntityId,
} from '../utils/producerWorkflow';
import {
  getProducerOperationalReviews,
  producerWorkflowService,
  type ProducerClientReview,
  type ProducerPhase,
  type ProducerTimelineItem,
} from '../services/producerWorkflowService';
import {
  emitProducerWorkflowFocusEvent,
  onProducerWorkflowFocusEvent,
  type ProducerWorkflowApprovalTemplate,
  type ProducerWorkflowFocusPayload,
} from '../services/producerWorkflowFocusEvents';
import { onProjectAgreementEvent } from '../services/projectAgreementEvents';
import { shouldUseRoleRoomLocalFallback } from '../utils/runtime';
import {
  buildProducerDeliveryManifest,
  getProducerWorkspaceLocationForSurface,
  getProducerStrategySnapshot,
  normalizeProducerProjectPlanning,
} from '../utils/producerProjectPlanning';
import {
  getAgreementSignatureLabel,
  getAgreementSignatureTone,
  getAgreementWorkspaceArtifactId,
  PROJECT_AGREEMENT_STATUS_LABELS,
} from '../utils/projectAgreements';
import type { ClientPortalWorkspaceFocus } from '../utils/clientPortal';
import {
  ROLE_DISPLAY_NAMES,
  type ContributorRole,
  type SplitSheet,
  type SplitSheetContributor,
  type SplitSheetStatus,
} from './split-sheets/types';
import ProjectAgreementsPanel from './ProjectAgreementsPanel';
import ProducerEconomyPanel from './producer/ProducerEconomyPanel';

interface ProjectEconomyHubProps {
  project: CastingProject;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
  readOnly?: boolean;
  canSendBudgetReview?: boolean;
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onOpenTeam?: () => void;
  onOpenReviews?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenTimeline?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenDeliverableSource?: (target: ProducerWorkflowApprovalTemplate) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
}

interface NormalizedCrewMember {
  id: string;
  name: string;
  role: string;
  department?: string;
  rate: number;
}

interface NormalizedTravelCost {
  crewMemberId: string;
  crewMemberName: string;
  department?: string;
  travelDayCount: number;
  totalCost: number;
}

type EconomyWorkspaceView = 'overview' | 'budget' | 'approvals';
type EconomyFocusPhase = ProducerPhase | 'all';
type SplitSheetContributorDraft = Omit<SplitSheetContributor, 'id' | 'split_sheet_id' | 'created_at' | 'updated_at'>;
type ApprovalWorkQueueLane = 'budget' | 'deliverable' | 'agreement';
type ApprovalComposerMode = 'deliverable' | 'budget' | 'milestone';
const LOCAL_PROJECT_AGREEMENTS_NAMESPACE = 'role-room-project-agreements';

interface ApprovalWorkQueueItem {
  review: ProducerClientReview;
  lane: ApprovalWorkQueueLane;
  laneLabel: string;
  focusedPhase: EconomyFocusPhase;
  agreementId?: string;
  approvalTemplate?: ProducerWorkflowApprovalTemplate;
  isStatusDriver: boolean;
}

const DELIVERABLE_APPROVAL_TEMPLATES: Array<{
  key: ProducerWorkflowApprovalTemplate;
  reviewType: ProducerWorkflowApprovalTemplate;
  title: string;
  description: string;
}> = [
  {
    key: 'storyboard',
    reviewType: 'storyboard',
    title: 'Storyboard',
    description: 'Visuell retning, sceneoppbygging og kundens forventede uttrykk.',
  },
  {
    key: 'manuscript',
    reviewType: 'manuscript',
    title: 'Manus',
    description: 'Budskap, struktur og ordlyd før opptak og leveranse.',
  },
  {
    key: 'shotlist',
    reviewType: 'shotlist',
    title: 'Shotlist',
    description: 'Opptaksrekkefølge, prioriterte bilder og praktisk gjennomføring.',
  },
];

const PHASE_LABELS: Record<ProducerPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};

const DELIVERABLE_APPROVAL_TYPE_SET = new Set<ProducerWorkflowApprovalTemplate>([
  'storyboard',
  'manuscript',
  'shotlist',
]);

const PROJECT_WORKFLOW_STATUS_LABELS: Record<NonNullable<CastingProject['producerWorkflowStatus']>, string> = {
  planning: 'Planlegging',
  awaiting_client: 'Venter på klient',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
};

const SPLIT_SHEET_STATUS_LABELS: Record<SplitSheetStatus, string> = {
  draft: 'Kladde',
  pending_signatures: 'Venter signaturer',
  completed: 'Fullført',
  archived: 'Arkivert',
};

const CONTRIBUTOR_ROLE_KEYS = new Set<ContributorRole>(
  Object.keys(ROLE_DISPLAY_NAMES) as ContributorRole[],
);

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
);

const getWorkspacePriorityTone = (tone: 'warning' | 'action' | 'ready') => (
  tone === 'warning'
    ? {
      border: 'rgba(251,191,36,0.42)',
      background: 'rgba(251,191,36,0.08)',
      chipBackground: 'rgba(251,191,36,0.16)',
      chipColor: '#fde68a',
      button: '#b45309',
    }
    : tone === 'ready'
      ? {
        border: 'rgba(52,211,153,0.34)',
        background: 'rgba(16,185,129,0.08)',
        chipBackground: 'rgba(16,185,129,0.16)',
        chipColor: '#86efac',
        button: '#0f766e',
      }
      : {
        border: 'rgba(96,165,250,0.34)',
        background: 'rgba(59,130,246,0.08)',
        chipBackground: 'rgba(59,130,246,0.16)',
        chipColor: '#bfdbfe',
        button: '#1d4ed8',
      }
);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const toNumber = (value: string | number | undefined | null): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

function getCrewRate(crewMember: CrewMember): number {
  const source = asRecord(crewMember) ?? {};
  const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);

  const candidateValues = [
    source.rate,
    source.dayRate,
    source.day_rate,
    nested?.rate,
    nested?.dayRate,
    nested?.day_rate,
  ];

  for (const value of candidateValues) {
    const numericValue = toNumber(value as string | number | undefined);
    if (numericValue > 0) {
      return numericValue;
    }
  }

  return 0;
}

function normalizeCrewMembers(project: CastingProject): NormalizedCrewMember[] {
  return (project.crew ?? [])
    .map((crewMember) => {
      const source = asRecord(crewMember) ?? {};
      const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);
      const name = readFirstNonEmptyString(source.name, nested?.name) ?? 'Crew-medlem';
      const role = readFirstNonEmptyString(
        source.role,
        source.crewRole,
        source.crew_role,
        source.position,
        nested?.role,
        nested?.crewRole,
      ) ?? 'Crew-medlem';
      const department = readFirstNonEmptyString(source.department, nested?.department);
      const rate = getCrewRate(crewMember);

      return {
        id: String(source.id ?? ''),
        name,
        role,
        department,
        rate,
      };
    })
    .filter((crewMember) => crewMember.id.length > 0);
}

function normalizeTravelCosts(project: CastingProject): NormalizedTravelCost[] {
  return (project.crew ?? [])
    .map((crewMember) => {
      const source = asRecord(crewMember) ?? {};
      const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);
      const travelCostsRecord = asRecord(source.travelCosts) ?? asRecord(source.travel_costs) ?? {};
      const entries = Object.values(travelCostsRecord)
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
        .map((entry) => {
          const breakdown = asRecord(entry.breakdown) ?? {};
          return toNumber(breakdown.totalCost as string | number | undefined);
        })
        .filter((value) => value > 0);

      return {
        crewMemberId: String(source.id ?? ''),
        crewMemberName: readFirstNonEmptyString(source.name, nested?.name) ?? 'Crew-medlem',
        department: readFirstNonEmptyString(source.department, nested?.department),
        travelDayCount: entries.length,
        totalCost: entries.reduce((sum, value) => sum + value, 0),
      };
    })
    .filter((entry) => entry.crewMemberId.length > 0 && entry.totalCost > 0);
}

function formatCurrency(amount: number, currency: string): string {
  return `${Math.round(amount).toLocaleString('nb-NO')} ${currency}`;
}

function formatSeconds(seconds: number): string {
  if (seconds <= 0) {
    return '0:00';
  }
  const totalMinutes = Math.floor(seconds / 60);
  const remainderSeconds = seconds % 60;
  return `${totalMinutes}:${String(remainderSeconds).padStart(2, '0')}`;
}

function toContributorRole(value: unknown): ContributorRole {
  if (typeof value === 'string' && CONTRIBUTOR_ROLE_KEYS.has(value as ContributorRole)) {
    return value as ContributorRole;
  }
  return 'other';
}

function toSplitSheetStatus(value: unknown): SplitSheetStatus {
  return value === 'pending_signatures'
    || value === 'completed'
    || value === 'archived'
    ? value
    : 'draft';
}

function normalizeSplitSheetContributor(
  value: unknown,
  index: number,
): SplitSheetContributor | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const name = readFirstNonEmptyString(record.name, record.fullName, record.full_name);
  if (!name) {
    return null;
  }

  const email = readFirstNonEmptyString(record.email, record.mail);
  const customFields = asRecord(record.custom_fields) ?? asRecord(record.customFields) ?? {};

  return {
    id: readFirstNonEmptyString(record.id),
    split_sheet_id: readFirstNonEmptyString(record.split_sheet_id, record.splitSheetId),
    name,
    email,
    role: toContributorRole(record.role),
    percentage: toNumber(record.percentage as string | number | undefined),
    signed_at: readFirstNonEmptyString(record.signed_at, record.signedAt) ?? null,
    invitation_sent_at: readFirstNonEmptyString(record.invitation_sent_at, record.invitationSentAt) ?? null,
    invitation_status: readFirstNonEmptyString(record.invitation_status, record.invitationStatus) as SplitSheetContributor['invitation_status'],
    user_id: readFirstNonEmptyString(record.user_id, record.userId) ?? null,
    order_index: typeof record.order_index === 'number'
      ? record.order_index
      : typeof record.orderIndex === 'number'
        ? record.orderIndex
        : index,
    notes: readFirstNonEmptyString(record.notes) ?? null,
    custom_fields: customFields,
    created_at: readFirstNonEmptyString(record.created_at, record.createdAt),
    updated_at: readFirstNonEmptyString(record.updated_at, record.updatedAt),
  };
}

function normalizeProjectSplitSheet(project: CastingProject): SplitSheet | null {
  const source = asRecord(project.splitSheetData) ?? asRecord(project.split_sheet_data);
  if (!source) {
    return null;
  }

  const contributors = asArray(source.contributors)
    .map((entry, index) => normalizeSplitSheetContributor(entry, index))
    .filter((entry): entry is SplitSheetContributor => entry !== null);

  return {
    id: readFirstNonEmptyString(source.id) ?? project.id,
    project_id: readFirstNonEmptyString(source.project_id, source.projectId) ?? project.id,
    title: readFirstNonEmptyString(source.title) ?? `${project.name} - Split Sheet`,
    description: readFirstNonEmptyString(source.description) ?? '',
    status: toSplitSheetStatus(source.status),
    total_percentage: toNumber(source.total_percentage as string | number | undefined),
    metadata: asRecord(source.metadata) ?? undefined,
    created_at: readFirstNonEmptyString(source.created_at, source.createdAt),
    updated_at: readFirstNonEmptyString(source.updated_at, source.updatedAt),
    contributor_count: typeof source.contributor_count === 'number'
      ? source.contributor_count
      : contributors.length,
    signed_count: typeof source.signed_count === 'number' ? source.signed_count : undefined,
    contributors,
  };
}

function normalizeProjectCollaboratorDrafts(project: CastingProject): SplitSheetContributorDraft[] {
  const collaboratorEntries = asArray(project.collaborators);
  if (collaboratorEntries.length > 0) {
    return collaboratorEntries.reduce<SplitSheetContributorDraft[]>((drafts, entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return drafts;
      }
      const name = readFirstNonEmptyString(record.name, record.fullName, record.full_name);
      if (!name) {
        return drafts;
      }
      drafts.push({
        name,
        email: readFirstNonEmptyString(record.email, record.mail) ?? '',
        role: toContributorRole(record.role),
        percentage: toNumber(record.percentage as string | number | undefined),
        user_id: readFirstNonEmptyString(record.user_id, record.userId) ?? undefined,
        order_index: index,
        custom_fields: asRecord(record.custom_fields) ?? asRecord(record.customFields) ?? {},
      });
      return drafts;
    }, []);
  }

  return (project.crew ?? []).reduce<SplitSheetContributorDraft[]>((drafts, crewMember, index) => {
      const source = asRecord(crewMember) ?? {};
      const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);
      const contactInfo = asRecord(source.contactInfo) ?? asRecord(source.contact_info) ?? {};
      const name = readFirstNonEmptyString(source.name, nested?.name);
      if (!name) {
        return drafts;
      }
      drafts.push({
        name,
        email: readFirstNonEmptyString(contactInfo.email, source.email, nested?.email) ?? '',
        role: toContributorRole(source.role ?? nested?.role),
        percentage: 0,
        user_id: readFirstNonEmptyString(source.user_id, source.userId, nested?.user_id, nested?.userId) ?? undefined,
        order_index: index,
        custom_fields: {},
      });
      return drafts;
    }, []);
}

function formatDateTime(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('nb-NO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function toIsoDateTimeValue(value: string): string | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function buildBudgetReviewDefaults(projectName: string, phase: EconomyFocusPhase): { title: string; description: string } {
  if (phase === 'all') {
    return {
      title: `Budsjettpakke · ${projectName}`,
      description: 'Oppdatert budsjettramme med faseestimater, bemanning, reise og avtaler. Vennligst godkjenn eller be om endringer.',
    };
  }

  return {
    title: `Budsjettpakke · ${PHASE_LABELS[phase]}`,
    description: `Oppdatert budsjett for ${PHASE_LABELS[phase].toLowerCase()} med relevante kostlinjer, avtaler og estimater. Vennligst godkjenn eller be om endringer.`,
  };
}

function buildBudgetMilestoneDefaults(phase: EconomyFocusPhase): { title: string; description: string } {
  if (phase === 'all') {
    return {
      title: 'Følg opp budsjett og avtaler',
      description: 'Kontroller avvik, godkjenninger og avtalepunkter før neste fase i prosjektet.',
    };
  }

  return {
    title: `Følg opp ${PHASE_LABELS[phase].toLowerCase()}`,
    description: `Avklar avvik, godkjenninger og leveranser for ${PHASE_LABELS[phase].toLowerCase()} før neste beslutning i prosjektet.`,
  };
}

function buildDeliverableReviewDefaults(
  projectName: string,
  approvalTemplate: ProducerWorkflowApprovalTemplate,
): { title: string; description: string } {
  const selectedTemplate = DELIVERABLE_APPROVAL_TEMPLATES.find((template) => template.key === approvalTemplate)
    ?? DELIVERABLE_APPROVAL_TEMPLATES[0];

  return {
    title: `${selectedTemplate.title} klar for klientgodkjenning · ${projectName}`,
    description: `Vennligst gjennomgå ${selectedTemplate.title.toLowerCase()} og bekreft om leveransen kan gå videre, eller legg inn konkrete endringsønsker.`,
  };
}

function getProjectWorkflowStatusLabel(status?: CastingProject['producerWorkflowStatus'] | null): string {
  if (!status) {
    return 'Planlegging';
  }
  return PROJECT_WORKFLOW_STATUS_LABELS[status] ?? 'Planlegging';
}

function summarizeProducerReviews(reviews: ProducerClientReview[]): {
  pending: number;
  approved: number;
  changesRequested: number;
  rejected: number;
} {
  return reviews.reduce(
    (summary, review) => {
      if (review.status === 'approved') {
        summary.approved += 1;
      } else if (review.status === 'changes_requested') {
        summary.changesRequested += 1;
      } else if (review.status === 'rejected') {
        summary.rejected += 1;
      } else {
        summary.pending += 1;
      }
      return summary;
    },
    { pending: 0, approved: 0, changesRequested: 0, rejected: 0 },
  );
}

function normalizeFocusedPhase(value: unknown): EconomyFocusPhase {
  return value === 'preproduction'
    || value === 'production'
    || value === 'postproduction'
    || value === 'all'
    ? value
    : 'all';
}

function getReviewPriority(status: string): number {
  if (status === 'changes_requested' || status === 'rejected') {
    return 0;
  }
  if (status === 'approved') {
    return 2;
  }
  return 1;
}

function isEconomyActivityTimelineItem(item: ProducerTimelineItem, activityKey: string): boolean {
  const metadata = asRecord(item.metadata);
  return readFirstNonEmptyString(metadata?.source) === 'economy-workspace-activity'
    && readFirstNonEmptyString(metadata?.activityKey) === activityKey;
}

export default function ProjectEconomyHub({
  project,
  profession = 'videographer',
  readOnly = false,
  canSendBudgetReview = false,
  onProjectUpdated,
  onOpenTeam,
  onOpenReviews,
  onOpenTimeline,
  onOpenDeliverableSource,
  onOpenMedia,
}: ProjectEconomyHubProps) {
  const { enqueueSnackbar } = useSnackbar();
  const useLocalFallback = shouldUseRoleRoomLocalFallback();
  const {
    items,
    totals,
    loading,
    error,
    reload,
    createItem,
    updateItem,
    removeItem,
  } = useProducerEconomy(project.id);
  const {
    items: reviewItems,
    loading: reviewsLoading,
    createReview,
  } = useProducerReviews(project.id);
  const {
    items: timelineItems,
    loading: timelineLoading,
    error: timelineError,
    createItem: createTimelineItem,
  } = useProducerTimeline(project.id);
  const {
    shotLists,
    productionEstimate,
    error: planningError,
  } = useProjectProductionEstimate({
    projectId: project.id,
    initialProject: project,
    initialShotLists: project.shotLists,
    initialProductionDays: project.productionDays,
  });
  const producerPlanning = useMemo(
    () => normalizeProducerProjectPlanning(project),
    [project],
  );
  const getAgreementMediaFocus = useCallback((agreement?: ProjectAgreement | null): ClientPortalWorkspaceFocus | undefined => {
    if (!agreement) {
      return undefined;
    }
    const location = getProducerWorkspaceLocationForSurface(
      producerPlanning.workspaceNavigation,
      'delivery',
    );
    return {
      workspace: 'delivery',
      sectionId: location?.sectionId,
      pageId: location?.pageId,
      artifactId: getAgreementWorkspaceArtifactId(agreement),
    };
  }, [producerPlanning.workspaceNavigation]);
  const producerStrategySnapshot = useMemo(
    () => getProducerStrategySnapshot(producerPlanning),
    [producerPlanning],
  );
  const deliveryManifest = useMemo(
    () => buildProducerDeliveryManifest(project.name, producerPlanning, productionEstimate, reviewItems),
    [producerPlanning, project.name, productionEstimate, reviewItems],
  );

  const [projectBudgetInput, setProjectBudgetInput] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isSyncingCrew, setIsSyncingCrew] = useState(false);
  const [isSyncingTravel, setIsSyncingTravel] = useState(false);
  const [budgetPanelVersion, setBudgetPanelVersion] = useState(0);
  const [activeView, setActiveView] = useState<EconomyWorkspaceView>('overview');
  const [focusedPhase, setFocusedPhase] = useState<EconomyFocusPhase>('all');
  const [budgetReviewTitle, setBudgetReviewTitle] = useState(() => buildBudgetReviewDefaults(project.name, 'all').title);
  const [budgetReviewDescription, setBudgetReviewDescription] = useState(() => buildBudgetReviewDefaults(project.name, 'all').description);
  const [budgetReviewDueAt, setBudgetReviewDueAt] = useState('');
  const [budgetMilestoneTitle, setBudgetMilestoneTitle] = useState(() => buildBudgetMilestoneDefaults('all').title);
  const [budgetMilestoneDescription, setBudgetMilestoneDescription] = useState(() => buildBudgetMilestoneDefaults('all').description);
  const [budgetMilestoneDueAt, setBudgetMilestoneDueAt] = useState('');
  const [isSubmittingBudgetReview, setIsSubmittingBudgetReview] = useState(false);
  const [isCreatingBudgetMilestone, setIsCreatingBudgetMilestone] = useState(false);
  const [approvalComposerMode, setApprovalComposerMode] = useState<ApprovalComposerMode>(
    canSendBudgetReview ? 'budget' : 'deliverable',
  );
  const [selectedApprovalTemplate, setSelectedApprovalTemplate] = useState<ProducerWorkflowApprovalTemplate>('storyboard');
  const [deliverableReviewTitle, setDeliverableReviewTitle] = useState(() => buildDeliverableReviewDefaults(project.name, 'storyboard').title);
  const [deliverableReviewDescription, setDeliverableReviewDescription] = useState(() => buildDeliverableReviewDefaults(project.name, 'storyboard').description);
  const [deliverableReviewDueAt, setDeliverableReviewDueAt] = useState('');
  const [isSubmittingDeliverableReview, setIsSubmittingDeliverableReview] = useState(false);
  const [agreementsById, setAgreementsById] = useState<Record<string, ProjectAgreement>>({});
  const [agreementsLoading, setAgreementsLoading] = useState(false);
  const [agreementLookupError, setAgreementLookupError] = useState<string | null>(null);

  useEffect(() => {
    setProjectBudgetInput(project.budget ? String(project.budget) : '');
  }, [project.budget, project.id]);

  useEffect(() => {
    setActiveView('overview');
  }, [project.id]);

  useEffect(() => {
    setFocusedPhase('all');
  }, [project.id]);

  useEffect(() => {
    setApprovalComposerMode(canSendBudgetReview ? 'budget' : 'deliverable');
  }, [canSendBudgetReview, project.id]);

  useEffect(() => onProducerWorkflowFocusEvent((payload) => {
    if (payload.projectId !== project.id || payload.panel !== 'economy') {
      return;
    }

    if (payload.focusedPhase) {
      setFocusedPhase(payload.focusedPhase);
    }

    if (payload.approvalTemplate && DELIVERABLE_APPROVAL_TYPE_SET.has(payload.approvalTemplate)) {
      setSelectedApprovalTemplate(payload.approvalTemplate);
      setApprovalComposerMode('deliverable');
    }

    if (payload.economyView) {
      setActiveView(payload.economyView);
      return;
    }

    if (payload.agreementId || payload.linkedEntityType === 'project_agreement') {
      setActiveView('budget');
      return;
    }

    setActiveView('approvals');
  }), [project.id]);

  useEffect(() => {
    const reviewDefaults = buildBudgetReviewDefaults(project.name, focusedPhase);
    setBudgetReviewTitle(reviewDefaults.title);
    setBudgetReviewDescription(reviewDefaults.description);
    setBudgetReviewDueAt('');

    const milestoneDefaults = buildBudgetMilestoneDefaults(focusedPhase);
    setBudgetMilestoneTitle(milestoneDefaults.title);
    setBudgetMilestoneDescription(milestoneDefaults.description);
    setBudgetMilestoneDueAt('');
  }, [focusedPhase, project.id, project.name]);

  useEffect(() => {
    const deliverableDefaults = buildDeliverableReviewDefaults(project.name, selectedApprovalTemplate);
    setDeliverableReviewTitle(deliverableDefaults.title);
    setDeliverableReviewDescription(deliverableDefaults.description);
    setDeliverableReviewDueAt('');
  }, [project.id, project.name, selectedApprovalTemplate]);

  const readLocalAgreements = useCallback(async (): Promise<ProjectAgreement[]> => {
    const stored = await settingsService.getSetting<ProjectAgreement[]>(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, {
      projectId: project.id,
    });
    return Array.isArray(stored) ? stored : [];
  }, [project.id]);

  const loadAgreementLookup = useCallback(async () => {
    setAgreementsLoading(true);
    setAgreementLookupError(null);
    try {
      const agreements = useLocalFallback
        ? await readLocalAgreements()
        : await projectAgreementsApi.getAll(project.id);
      setAgreementsById(
        agreements.reduce<Record<string, ProjectAgreement>>((next, agreement) => {
          next[agreement.id] = agreement;
          return next;
        }, {}),
      );
    } catch (loadError) {
      console.error('[ProjectEconomyHub] Failed to load agreement lookup', loadError);
      setAgreementLookupError('Kunne ikke hente juridiske avtaler for økonomiflyten.');
    } finally {
      setAgreementsLoading(false);
    }
  }, [project.id, readLocalAgreements, useLocalFallback]);

  useEffect(() => {
    void loadAgreementLookup();
  }, [loadAgreementLookup]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== project.id) {
      return;
    }
    void loadAgreementLookup();
  }), [loadAgreementLookup, project.id]);

  const currency = readFirstNonEmptyString(project.currency) ?? 'NOK';
  const projectAgreements = useMemo(
    () => Object.values(agreementsById),
    [agreementsById],
  );
  const normalizedCrewMembers = useMemo(() => normalizeCrewMembers(project), [project]);
  const normalizedTravelCosts = useMemo(() => normalizeTravelCosts(project), [project]);
  const splitSheetData = useMemo(() => normalizeProjectSplitSheet(project), [project]);
  const splitSheetInitialContributors = useMemo(
    () => normalizeProjectCollaboratorDrafts(project),
    [project],
  );
  const splitSheetContributorCount = splitSheetData?.contributors?.length ?? splitSheetInitialContributors.length;
  const splitSheetStatusLabel = splitSheetData
    ? SPLIT_SHEET_STATUS_LABELS[splitSheetData.status]
    : 'Ikke opprettet';
  const billableCrewMembers = useMemo(
    () => normalizedCrewMembers.filter((crewMember) => crewMember.rate > 0),
    [normalizedCrewMembers],
  );
  const plannedShootDays = Math.max(1, project.productionDays?.length ?? 0);
  const crewDailyTotal = useMemo(
    () => billableCrewMembers.reduce((sum, crewMember) => sum + crewMember.rate, 0),
    [billableCrewMembers],
  );
  const projectedCrewTotal = crewDailyTotal * plannedShootDays;
  const totalTravelCosts = useMemo(
    () => normalizedTravelCosts.reduce((sum, entry) => sum + entry.totalCost, 0),
    [normalizedTravelCosts],
  );
  const suggestedCrewDays = Math.max(1, productionEstimate.suggestedShootDays) * Math.max(1, billableCrewMembers.length || normalizedCrewMembers.length || 1);
  const primaryFormatEstimate = productionEstimate.formatEstimates.find((item) => item.emphasis === 'primary')
    ?? productionEstimate.formatEstimates[0]
    ?? null;
  const unscheduledLoad = productionEstimate.productionDayLoads.find((item) => item.dayId === 'unscheduled') ?? null;
  const brandGuideReadyCount = useMemo(
    () => [
      Boolean(producerPlanning.brandGuide.logoUrl),
      Boolean(producerPlanning.brandGuide.colors?.length),
      Boolean(producerPlanning.brandGuide.fonts?.filter((font) => Boolean(font?.trim())).length),
      Boolean(producerPlanning.brandGuide.toneOfVoice?.trim()),
      Boolean(producerPlanning.brandGuide.visualStyle?.trim()),
    ].filter(Boolean).length,
    [producerPlanning.brandGuide],
  );
  const deliveryWorkflowReadyCount = useMemo(
    () => [
      producerPlanning.deliveryWorkflow.fileNamingConvention,
      producerPlanning.deliveryWorkflow.versioningRule,
      producerPlanning.deliveryWorkflow.folderStructure,
      producerPlanning.deliveryWorkflow.draftVsFinalRule,
      producerPlanning.deliveryWorkflow.backupRoutine,
      producerPlanning.deliveryWorkflow.deliveryCadence,
    ].filter((value) => Boolean(value?.trim())).length,
    [producerPlanning.deliveryWorkflow],
  );
  const pendingClientMoments = useMemo(
    () => deliveryManifest.pendingClientMoments.slice(0, 4),
    [deliveryManifest.pendingClientMoments],
  );
  const nextDeliveryItems = useMemo(
    () => deliveryManifest.deliveryItems
      .slice()
      .sort((left, right) => {
        const leftTime = left.publishAt ? Date.parse(left.publishAt) : Number.POSITIVE_INFINITY;
        const rightTime = right.publishAt ? Date.parse(right.publishAt) : Number.POSITIVE_INFINITY;
        return leftTime - rightTime;
      })
      .slice(0, 3),
    [deliveryManifest.deliveryItems],
  );

  const handleSplitSheetSaved = async (savedSplitSheet: SplitSheet) => {
    const normalizedSavedSplitSheet: SplitSheet = {
      ...savedSplitSheet,
      id: project.id,
      project_id: project.id,
    };

    const nextProject: CastingProject = {
      ...project,
      enableSplitSheet: true,
      splitSheetData: normalizedSavedSplitSheet,
      updatedAt: new Date().toISOString(),
    };

    await castingService.saveProject(nextProject);
    await onProjectUpdated?.(nextProject);
    const contributorCount = savedSplitSheet.contributors?.length ?? 0;
    await syncEconomyActivityTimelineItem({
      activityKey: 'split-sheet',
      title: 'Teamavtale oppdatert',
      description: `${contributorCount} bidragsytere er nå synkronisert i prosjektets teamavtale.`,
      phase: 'postproduction',
      linkedEntityType: 'split_sheet',
      linkedEntityId: savedSplitSheet.id,
      metadata: {
        splitSheetStatus: savedSplitSheet.status,
        contributorCount,
      },
    });
    enqueueSnackbar('Teamavtale oppdatert i økonomi-arbeidsflaten.', { variant: 'success' });
  };

  const handlePersistProjectForEconomy = useCallback(async (): Promise<boolean> => {
    try {
      const nextProject: CastingProject = {
        ...project,
        updatedAt: new Date().toISOString(),
      };

      await castingService.saveProject(nextProject);
      await onProjectUpdated?.(nextProject);
      return true;
    } catch (error) {
      console.error('[ProjectEconomyHub] Failed to persist project before split sheet save', error);
      enqueueSnackbar('Prosjektet kunne ikke lagres før teamavtalen ble oppdatert.', { variant: 'error' });
      return false;
    }
  }, [enqueueSnackbar, onProjectUpdated, project]);

  const travelDayCount = useMemo(
    () => normalizedTravelCosts.reduce((sum, entry) => sum + entry.travelDayCount, 0),
    [normalizedTravelCosts],
  );
  const projectBudget = toNumber(project.budget);
  const phaseTotals = useMemo(
    () => (Object.keys(PHASE_LABELS) as ProducerPhase[]).reduce<Record<ProducerPhase, { estimate: number; approved: number; actual: number }>>(
      (acc, phaseKey) => {
        const phaseItems = items.filter((item) => item.phase === phaseKey);
        acc[phaseKey] = phaseItems.reduce(
          (sum, item) => ({
            estimate: sum.estimate + toNumber(item.estimate),
            approved: sum.approved + toNumber(item.approved),
            actual: sum.actual + toNumber(item.actual),
          }),
          { estimate: 0, approved: 0, actual: 0 },
        );
        return acc;
      },
      {
        preproduction: { estimate: 0, approved: 0, actual: 0 },
        production: { estimate: 0, approved: 0, actual: 0 },
        postproduction: { estimate: 0, approved: 0, actual: 0 },
      },
    ),
    [items],
  );
  const phaseEstimateTotal = useMemo(
    () => items.reduce((sum, item) => sum + toNumber(item.estimate), 0),
    [items],
  );
  const budgetUtilization = projectBudget > 0 ? projectedCrewTotal / projectBudget : null;
  const operationalReviewItems = useMemo(
    () => getProducerOperationalReviews(reviewItems),
    [reviewItems],
  );
  const budgetReviews = useMemo(
    () => operationalReviewItems
      .filter((item) => item.review_type === 'budget_package')
      .sort((left, right) => new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime()),
    [operationalReviewItems],
  );
  const deliverableReviews = useMemo(
    () => operationalReviewItems
      .filter((item) => DELIVERABLE_APPROVAL_TYPE_SET.has(item.review_type as ProducerWorkflowApprovalTemplate))
      .sort((left, right) => new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime()),
    [operationalReviewItems],
  );
  const agreementReviews = useMemo(
    () => operationalReviewItems
      .filter((item) => (
        item.review_type === 'change_order'
        || item.review_type === 'client_approval'
        || item.target_entity_type === 'project_agreement'
      ))
      .sort((left, right) => new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime()),
    [operationalReviewItems],
  );
  const agreementSignatureSummary = useMemo(() => projectAgreements.reduce(
    (summary, agreement) => {
      const signatureStatus = agreement.google_signature?.status;
      if (!signatureStatus || signatureStatus === 'not_started') {
        summary.notStarted += 1;
        return summary;
      }
      if (signatureStatus === 'signed') {
        summary.signed += 1;
        return summary;
      }
      if (signatureStatus === 'rejected' || signatureStatus === 'changes_requested' || signatureStatus === 'error') {
        summary.needsAttention += 1;
        return summary;
      }
      summary.inFlight += 1;
      return summary;
    },
    { notStarted: 0, inFlight: 0, signed: 0, needsAttention: 0 },
  ), [projectAgreements]);
  const latestApprovalTouchpoint = useMemo(
    () => [...budgetReviews, ...deliverableReviews, ...agreementReviews]
      .sort((left, right) => new Date(right.requested_at).getTime() - new Date(left.requested_at).getTime())[0] ?? null,
    [agreementReviews, budgetReviews, deliverableReviews],
  );
  const workflowDriverReview = useMemo(() => {
    const sortedReviews = [...operationalReviewItems].sort((left, right) => {
      const leftTimestamp = new Date(left.decision_at ?? left.requested_at).getTime();
      const rightTimestamp = new Date(right.decision_at ?? right.requested_at).getTime();
      return rightTimestamp - leftTimestamp;
    });

    if (project.producerWorkflowStatus === 'changes_requested') {
      return sortedReviews.find((review) => (
        review.status === 'changes_requested' || review.status === 'rejected'
      )) ?? null;
    }

    if (project.producerWorkflowStatus === 'awaiting_client') {
      return sortedReviews.find((review) => (
        review.status !== 'approved' && review.status !== 'rejected' && review.status !== 'changes_requested'
      )) ?? null;
    }

    if (project.producerWorkflowStatus === 'approved') {
      return sortedReviews.find((review) => review.status === 'approved') ?? null;
    }

    return null;
  }, [operationalReviewItems, project.producerWorkflowStatus]);
  const statusTouchpoint = workflowDriverReview ?? latestApprovalTouchpoint;
  const budgetReviewSummary = useMemo(
    () => budgetReviews.reduce(
      (summary, review) => {
        if (review.status === 'approved') {
          summary.approved += 1;
        } else if (review.status === 'changes_requested') {
          summary.changesRequested += 1;
        } else if (review.status === 'rejected') {
          summary.rejected += 1;
        } else {
          summary.pending += 1;
        }
        return summary;
      },
      { pending: 0, approved: 0, changesRequested: 0, rejected: 0 },
    ),
    [budgetReviews],
  );
  const deliverableReviewSummary = useMemo(
    () => summarizeProducerReviews(deliverableReviews),
    [deliverableReviews],
  );
  const agreementReviewSummary = useMemo(
    () => agreementReviews.reduce(
      (summary, review) => {
        if (review.status === 'approved') {
          summary.approved += 1;
        } else if (review.status === 'changes_requested') {
          summary.changesRequested += 1;
        } else if (review.status === 'rejected') {
          summary.rejected += 1;
        } else {
          summary.pending += 1;
        }
        return summary;
      },
      { pending: 0, approved: 0, changesRequested: 0, rejected: 0 },
    ),
    [agreementReviews],
  );
  const operationalReviewSummary = useMemo(
    () => summarizeProducerReviews(operationalReviewItems),
    [operationalReviewItems],
  );
  const syncedCrewItems = useMemo(
    () => items.filter((item) => {
      const metadata = asRecord(item.metadata);
      return readFirstNonEmptyString(metadata?.source) === 'crew-sync';
    }),
    [items],
  );
  const syncedTravelItems = useMemo(
    () => items.filter((item) => {
      const metadata = asRecord(item.metadata);
      return readFirstNonEmptyString(metadata?.source) === 'travel-sync';
    }),
    [items],
  );
  const budgetReviewIds = useMemo(
    () => new Set(budgetReviews.map((review) => review.id)),
    [budgetReviews],
  );
  const budgetPackageEntityId = useMemo(
    () => makeProducerPackageEntityId('economy', project.id),
    [project.id],
  );
  const budgetTimelineItems = useMemo(
    () => timelineItems
      .filter((item) => {
        if (item.linked_entity_type === 'economy' || item.linked_entity_id === budgetPackageEntityId) {
          return true;
        }
        if (item.linked_entity_type === 'client_review' && item.linked_entity_id && budgetReviewIds.has(item.linked_entity_id)) {
          return true;
        }
        const metadata = asRecord(item.metadata);
        return readFirstNonEmptyString(metadata?.reviewType) === 'budget_package'
          || readFirstNonEmptyString(metadata?.targetEntityType) === 'economy';
      })
      .sort((left, right) => {
        const leftDue = left.due_at ? new Date(left.due_at).getTime() : 0;
        const rightDue = right.due_at ? new Date(right.due_at).getTime() : 0;
        return rightDue - leftDue;
      }),
    [budgetPackageEntityId, budgetReviewIds, timelineItems],
  );
  const topDepartments = useMemo(() => {
    const totalsByDepartment = new Map<string, number>();
    for (const crewMember of billableCrewMembers) {
      const key = crewMember.department || 'Andre';
      totalsByDepartment.set(key, (totalsByDepartment.get(key) ?? 0) + crewMember.rate);
    }
    return [...totalsByDepartment.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3);
  }, [billableCrewMembers]);
  const crewSyncCoverage = billableCrewMembers.length > 0
    ? syncedCrewItems.length / billableCrewMembers.length
    : null;
  const travelSyncCoverage = normalizedTravelCosts.length > 0
    ? syncedTravelItems.length / normalizedTravelCosts.length
    : null;
  const approvalPendingCount = budgetReviewSummary.pending + deliverableReviewSummary.pending + agreementReviewSummary.pending;
  const approvalChangeRequestCount = budgetReviewSummary.changesRequested
    + deliverableReviewSummary.changesRequested
    + agreementReviewSummary.changesRequested;
  const approvalPressure = approvalPendingCount + approvalChangeRequestCount;
  const projectWorkflowDetail = operationalReviewItems.length > 0
    ? [
      statusTouchpoint ? `Styrt av ${statusTouchpoint.title}` : null,
      `${operationalReviewSummary.pending} venter`,
      `${operationalReviewSummary.changesRequested} krever endringer`,
      `${operationalReviewSummary.approved} godkjent`,
      operationalReviewSummary.rejected > 0 ? `${operationalReviewSummary.rejected} avslått` : null,
    ].filter((value): value is string => Boolean(value)).join(' · ')
    : statusTouchpoint
      ? `${deliverableReviews.length} leveranser · ${budgetReviews.length} budsjettpakker · ${agreementReviews.length} avtalebeslutninger`
      : 'Ingen budsjettpakker eller avtalegodkjenninger sendt til klient ennå.';
  const legalFlowSummary = useMemo(() => {
    if (projectAgreements.length === 0) {
      return 'Ingen juridiske avtaler er opprettet ennå.';
    }
    return [
      `${projectAgreements.length} avtaler totalt`,
      `${agreementSignatureSummary.inFlight} til signering`,
      `${agreementSignatureSummary.needsAttention} krever avklaring`,
      `${agreementSignatureSummary.signed} signert`,
    ].join(' · ');
  }, [agreementSignatureSummary, projectAgreements.length]);
  const focusedPhaseLabel = focusedPhase === 'all' ? 'Alle faser' : PHASE_LABELS[focusedPhase];
  const selectedApprovalTemplateConfig = useMemo(
    () => DELIVERABLE_APPROVAL_TEMPLATES.find((template) => template.key === selectedApprovalTemplate)
      ?? DELIVERABLE_APPROVAL_TEMPLATES[0],
    [selectedApprovalTemplate],
  );
  const visibleApprovalComposerMode = !canSendBudgetReview && approvalComposerMode === 'budget'
    ? 'deliverable'
    : approvalComposerMode;
  const getReviewAgreementId = useCallback((review: ProducerClientReview): string | undefined => {
    const metadata = asRecord(review.metadata) ?? {};
    return readFirstNonEmptyString(
      metadata.agreementId,
      review.target_entity_type === 'project_agreement' ? review.target_entity_id : undefined,
    );
  }, []);
  const getReviewFocusedPhase = useCallback((review: ProducerClientReview): EconomyFocusPhase => {
    const metadata = asRecord(review.metadata) ?? {};
    return normalizeFocusedPhase(
      readFirstNonEmptyString(metadata.focusedPhase, metadata.phase),
    );
  }, []);
  const getReviewApprovalTemplate = useCallback((review: ProducerClientReview): ProducerWorkflowApprovalTemplate | undefined => (
    DELIVERABLE_APPROVAL_TYPE_SET.has(review.review_type as ProducerWorkflowApprovalTemplate)
      ? review.review_type as ProducerWorkflowApprovalTemplate
      : undefined
  ), []);
  const buildReviewFocusPayload = useCallback((review: ProducerClientReview): Partial<ProducerWorkflowFocusPayload> => ({
    reviewId: review.id,
    linkedEntityType: review.target_entity_type ?? undefined,
    linkedEntityId: review.target_entity_id ?? undefined,
    agreementId: getReviewAgreementId(review),
    approvalTemplate: getReviewApprovalTemplate(review),
    focusedPhase: getReviewFocusedPhase(review),
  }), [getReviewAgreementId, getReviewApprovalTemplate, getReviewFocusedPhase]);
  const getAgreementForReview = useCallback((review: ProducerClientReview): ProjectAgreement | undefined => {
    const agreementId = getReviewAgreementId(review);
    if (!agreementId) {
      return undefined;
    }
    return agreementsById[agreementId];
  }, [agreementsById, getReviewAgreementId]);
  const statusTouchpointAgreement = useMemo(
    () => (statusTouchpoint ? getAgreementForReview(statusTouchpoint) : undefined),
    [getAgreementForReview, statusTouchpoint],
  );
  const approvalWorkQueue = useMemo<ApprovalWorkQueueItem[]>(() => (
    [...operationalReviewItems]
      .map((review) => {
        const agreementId = getReviewAgreementId(review);
        const approvalTemplate = getReviewApprovalTemplate(review);
        const lane: ApprovalWorkQueueLane = review.review_type === 'budget_package'
          ? 'budget'
          : review.review_type === 'change_order'
            || review.review_type === 'client_approval'
            || review.target_entity_type === 'project_agreement'
            || Boolean(agreementId)
            ? 'agreement'
            : 'deliverable';
        const laneLabel = lane === 'budget'
          ? 'Budsjettpakke'
          : lane === 'agreement'
            ? 'Avtale / endring'
            : 'Leveranse';

        return {
          review,
          lane,
          laneLabel,
          focusedPhase: getReviewFocusedPhase(review),
          agreementId,
          approvalTemplate,
          isStatusDriver: workflowDriverReview?.id === review.id,
        };
      })
      .sort((left, right) => {
        if (left.isStatusDriver !== right.isStatusDriver) {
          return left.isStatusDriver ? -1 : 1;
        }

        const priorityDifference = getReviewPriority(left.review.status) - getReviewPriority(right.review.status);
        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        const leftDue = left.review.due_at ? new Date(left.review.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const rightDue = right.review.due_at ? new Date(right.review.due_at).getTime() : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }

        const leftTimestamp = new Date(left.review.decision_at ?? left.review.requested_at).getTime();
        const rightTimestamp = new Date(right.review.decision_at ?? right.review.requested_at).getTime();
        return rightTimestamp - leftTimestamp;
      })
  ), [
    getReviewAgreementId,
    getReviewApprovalTemplate,
    getReviewFocusedPhase,
    operationalReviewItems,
    workflowDriverReview,
  ]);
  const phaseCards = useMemo(
    () => (Object.keys(PHASE_LABELS) as ProducerPhase[]).map((phaseKey) => {
      const totalsForPhase = phaseTotals[phaseKey];
      const phaseItems = items.filter((item) => item.phase === phaseKey);
      const syncedLineCount = phaseItems.filter((item) => {
        const metadata = asRecord(item.metadata);
        return readFirstNonEmptyString(metadata?.source) !== undefined;
      }).length;
      return {
        phase: phaseKey,
        label: PHASE_LABELS[phaseKey],
        estimate: totalsForPhase.estimate,
        approved: totalsForPhase.approved,
        actual: totalsForPhase.actual,
        lineCount: phaseItems.length,
        syncedLineCount,
      };
    }),
    [items, phaseTotals],
  );
  const economyPriority = useMemo(() => {
    const blockers: string[] = [];
    const crewNeedsSync = billableCrewMembers.length > 0 && syncedCrewItems.length < billableCrewMembers.length;
    const travelNeedsSync = normalizedTravelCosts.length > 0 && syncedTravelItems.length < normalizedTravelCosts.length;

    if (projectBudget <= 0 && items.length === 0) {
      blockers.push('Sett prosjektramme eller legg inn første kostlinjer før resten av økonomiflyten bygges.');
      if (projectedCrewTotal > 0) {
        blockers.push(`Bemanningsprognosen tilsier allerede ${formatCurrency(projectedCrewTotal, currency)} som bør forankres i totalrammen.`);
      }
      return {
        title: 'Sett økonomisk ramme først',
        description: 'Økonomi blir ryddig først når totalramme og første kostgrunnlag er på plass. Resten av godkjenning, avtaler og milepæler bør bygges på det.',
        actionLabel: 'Åpne budsjett og avtaler',
        actionView: 'budget' as EconomyWorkspaceView,
        tone: 'warning' as const,
        blockers,
      };
    }

    if (crewNeedsSync || travelNeedsSync || unscheduledLoad) {
      if (crewNeedsSync) {
        blockers.push(`Teamkostnader er bare synket ${Math.round((crewSyncCoverage ?? 0) * 100)}%.`);
      }
      if (travelNeedsSync) {
        blockers.push(`Reise og logistikk er bare synket ${Math.round((travelSyncCoverage ?? 0) * 100)}%.`);
      }
      if (unscheduledLoad) {
        blockers.push(`${unscheduledLoad.shotListCount} shotlister mangler opptaksdag og gjør estimatet mindre pålitelig.`);
      }
      return {
        title: 'Stram inn budsjettgrunnlaget',
        description: 'Tallene bør kobles hardere til team, reise og opptaksplan før du sender pakken videre til klient eller låser avtaler.',
        actionLabel: 'Gå til budsjettarbeid',
        actionView: 'budget' as EconomyWorkspaceView,
        tone: 'action' as const,
        blockers,
      };
    }

    if (approvalPressure > 0 || agreementSignatureSummary.inFlight > 0 || agreementSignatureSummary.needsAttention > 0) {
      if (approvalPendingCount > 0) {
        blockers.push(`${approvalPendingCount} saker venter fortsatt på klientbeslutning.`);
      }
      if (approvalChangeRequestCount > 0) {
        blockers.push(`${approvalChangeRequestCount} saker krever endringer før prosjektet kan gå videre.`);
      }
      if (agreementSignatureSummary.inFlight > 0) {
        blockers.push(`${agreementSignatureSummary.inFlight} juridiske avtaler er ute til signering.`);
      }
      if (agreementSignatureSummary.needsAttention > 0) {
        blockers.push(`${agreementSignatureSummary.needsAttention} juridiske avtaler krever avklaring.`);
      }
      return {
        title: 'Lukk beslutninger og signatur',
        description: 'Økonomien er nær klar, men prosjektet styres nå av åpne klientbeslutninger eller juridiske avtaler som må lukkes.',
        actionLabel: 'Åpne godkjenning',
        actionView: 'approvals' as EconomyWorkspaceView,
        tone: 'action' as const,
        blockers,
      };
    }

    return {
      title: 'Økonomigrunnlaget er klart',
      description: 'Ramme, budsjettlinjer og beslutninger henger sammen. Neste steg er å sende ny pakke eller følge opp neste fase.',
      actionLabel: 'Gå til budsjettarbeid',
      actionView: 'budget' as EconomyWorkspaceView,
      tone: 'ready' as const,
      blockers: [
        `${phaseCards.length} faser er oppdatert mot samme totalramme.`,
        `${agreementSignatureSummary.signed} juridiske avtaler er allerede signert.`,
      ],
    };
  }, [
    agreementSignatureSummary.inFlight,
    agreementSignatureSummary.needsAttention,
    agreementSignatureSummary.signed,
    approvalChangeRequestCount,
    approvalPendingCount,
    approvalPressure,
    billableCrewMembers.length,
    crewSyncCoverage,
    currency,
    items.length,
    normalizedTravelCosts.length,
    phaseCards.length,
    projectBudget,
    projectedCrewTotal,
    syncedCrewItems.length,
    syncedTravelItems.length,
    travelSyncCoverage,
    unscheduledLoad,
  ]);
  const economyStageCards = useMemo(() => [
    {
      label: 'Ramme',
      value: projectBudget > 0 ? formatCurrency(projectBudget, currency) : 'Mangler',
      detail: projectBudget > 0
        ? `Faseestimat ${formatCurrency(phaseEstimateTotal, currency)}`
        : 'Sett totalramme først',
      tone: projectBudget > 0 ? 'ready' : 'warning',
    },
    {
      label: 'Arbeid',
      value: `${items.length} linjer`,
      detail: `${syncedCrewItems.length + syncedTravelItems.length} synkede · ${focusedPhaseLabel}`,
      tone: items.length > 0 ? 'action' : 'warning',
    },
    {
      label: 'Beslutning',
      value: approvalPressure > 0 ? `${approvalPressure} åpne` : 'Rolig',
      detail: agreementSignatureSummary.inFlight > 0
        ? `${agreementSignatureSummary.inFlight} til signering`
        : `${agreementSignatureSummary.signed} signert`,
      tone: approvalPressure > 0 || agreementSignatureSummary.inFlight > 0 ? 'action' : 'ready',
    },
  ], [
    agreementSignatureSummary.inFlight,
    agreementSignatureSummary.signed,
    approvalPressure,
    currency,
    focusedPhaseLabel,
    items.length,
    phaseEstimateTotal,
    projectBudget,
    syncedCrewItems.length,
    syncedTravelItems.length,
  ]);
  const economySupportSignals = useMemo(() => ([
    {
      label: 'Produksjonsestimat',
      value: `${productionEstimate.suggestedShootDays} opptaksdager · ${suggestedCrewDays} crew-dager`,
      detail: primaryFormatEstimate
        ? `Hovedleveranse ${formatSeconds(primaryFormatEstimate.estimatedSeconds)} · ${shotLists.length} shotlister`
        : `${shotLists.length} shotlister · ingen formatberegning ennå`,
    },
    {
      label: 'Leveransegrunnlag',
      value: `${deliveryManifest.deliveryItems.length} leveranser · ${pendingClientMoments.length} åpne klientpunkter`,
      detail: nextDeliveryItems.length > 0
        ? nextDeliveryItems.map((item) => item.title).join(' · ')
        : 'Ingen kommende leveranser er planlagt ennå.',
    },
    {
      label: 'Merkevare og rutine',
      value: `${brandGuideReadyCount}/5 merkevarepunkter · ${deliveryWorkflowReadyCount}/6 leveringsregler`,
      detail: producerStrategySnapshot.length > 0
        ? producerStrategySnapshot.map((item) => `${item.label}: ${item.value}`).join(' · ')
        : 'Ingen tydelig retning eller leveranseregler er lagt inn ennå.',
    },
  ]), [
    brandGuideReadyCount,
    deliveryManifest.deliveryItems.length,
    deliveryWorkflowReadyCount,
    nextDeliveryItems,
    pendingClientMoments.length,
    primaryFormatEstimate,
    producerStrategySnapshot,
    productionEstimate.suggestedShootDays,
    shotLists.length,
    suggestedCrewDays,
  ]);
  const economyPriorityTone = getWorkspacePriorityTone(economyPriority.tone);

  const openBudgetWorkspaceFocus = useCallback((review: ProducerClientReview) => {
    const focusPayload = buildReviewFocusPayload(review);
    setFocusedPhase(focusPayload.focusedPhase ?? 'all');
    setActiveView('budget');
    emitProducerWorkflowFocusEvent({
      projectId: project.id,
      panel: 'economy',
      economyView: 'budget',
      reviewId: review.id,
      linkedEntityType: focusPayload.linkedEntityType,
      linkedEntityId: focusPayload.linkedEntityId,
      agreementId: focusPayload.agreementId,
      approvalTemplate: focusPayload.approvalTemplate,
      focusedPhase: focusPayload.focusedPhase,
    });
  }, [buildReviewFocusPayload, project.id]);

  const syncEconomyActivityTimelineItem = useCallback(async (payload: {
    activityKey: string;
    title: string;
    description: string;
    phase: ProducerPhase;
    status?: 'planned' | 'in_progress' | 'completed' | 'blocked';
    linkedEntityType?: string;
    linkedEntityId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const timelineItems = await producerWorkflowService.getTimeline(project.id);
    const existingTimelineItem = timelineItems.find((item) => isEconomyActivityTimelineItem(item, payload.activityKey));
    const timelinePayload = {
      phase: payload.phase,
      title: payload.title,
      description: payload.description,
      status: payload.status ?? 'completed',
      linkedEntityType: payload.linkedEntityType,
      linkedEntityId: payload.linkedEntityId,
      metadata: {
        ...(payload.metadata ?? {}),
        source: 'economy-workspace-activity',
        activityKey: payload.activityKey,
      },
    };

    if (existingTimelineItem) {
      await producerWorkflowService.updateTimelineItem(project.id, existingTimelineItem.id, timelinePayload);
      return;
    }

    await producerWorkflowService.createTimelineItem(project.id, timelinePayload);
  }, [project.id]);

  const handleSaveProjectBudget = async () => {
    const nextBudget = toNumber(projectBudgetInput);
    setIsSavingBudget(true);
    try {
      const nextProject: CastingProject = {
        ...project,
        budget: nextBudget,
        updatedAt: new Date().toISOString(),
      };
      await castingService.saveProject(nextProject);
      await onProjectUpdated?.(nextProject);
      await syncEconomyActivityTimelineItem({
        activityKey: 'project-budget',
        title: 'Prosjektramme oppdatert',
        description: `Prosjektrammen er oppdatert til ${formatCurrency(nextBudget, currency)} i økonomisenteret.`,
        phase: 'preproduction',
        linkedEntityType: 'economy',
        linkedEntityId: makeProducerPackageEntityId('economy', project.id),
        metadata: {
          budget: nextBudget,
          currency,
        },
      });
      enqueueSnackbar('Prosjektramme oppdatert.', { variant: 'success' });
    } catch (saveError) {
      enqueueSnackbar(
        saveError instanceof Error ? saveError.message : 'Kunne ikke lagre prosjektramme.',
        { variant: 'error' },
      );
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleSyncCrewCosts = async () => {
    if (billableCrewMembers.length === 0) {
      enqueueSnackbar('Legg inn dagsatser på teamet før du synkroniserer bemanning til budsjett.', {
        variant: 'warning',
      });
      return;
    }

    setIsSyncingCrew(true);
    try {
      const existingItemsByCrewId = new Map<string, typeof items[number]>();

      for (const item of items) {
        const metadata = asRecord(item.metadata);
        const source = readFirstNonEmptyString(metadata?.source);
        const crewMemberId = readFirstNonEmptyString(metadata?.crewMemberId);
        if (source === 'crew-sync' && crewMemberId) {
          existingItemsByCrewId.set(crewMemberId, item);
        }
      }

      const currentCrewIds = new Set<string>();

      for (const crewMember of billableCrewMembers) {
        currentCrewIds.add(crewMember.id);
        const existingItem = existingItemsByCrewId.get(crewMember.id);
        const syncedEstimate = crewMember.rate * plannedShootDays;
        const metadata = {
          ...(asRecord(existingItem?.metadata) ?? {}),
          source: 'crew-sync',
          crewMemberId: crewMember.id,
          dayRate: crewMember.rate,
          shootDayCount: plannedShootDays,
          crewRole: crewMember.role,
          department: crewMember.department ?? null,
        };
        const commonPayload = {
          phase: 'production' as const,
          category: crewMember.department || 'Bemanning',
          itemName: `${crewMember.name} · ${crewMember.role}`,
          description: `${plannedShootDays} opptaksdager · ${formatCurrency(crewMember.rate, currency)} per dag`,
          estimate: syncedEstimate,
          status: existingItem?.status ?? 'draft',
          clientVisible: existingItem ? Boolean(existingItem.client_visible) : true,
          metadata,
        };

        if (existingItem) {
          await updateItem(existingItem.id, {
            ...commonPayload,
            approved: toNumber(existingItem.approved),
            actual: toNumber(existingItem.actual),
            currency: existingItem.currency || currency,
          });
          continue;
        }

        await createItem({
          ...commonPayload,
          approved: 0,
          actual: 0,
          currency,
        });
      }

      for (const [crewMemberId, syncedItem] of existingItemsByCrewId.entries()) {
        if (currentCrewIds.has(crewMemberId)) {
          continue;
        }
        await removeItem(syncedItem.id);
      }

      await reload();
      setBudgetPanelVersion((previous) => previous + 1);
      await syncEconomyActivityTimelineItem({
        activityKey: 'crew-cost-sync',
        title: 'Bemanningskostnader synkronisert',
        description: `${billableCrewMembers.length} teammedlemmer med dagsatser er oppdatert i produksjonsbudsjettet.`,
        phase: 'production',
        linkedEntityType: 'economy',
        linkedEntityId: makeProducerPackageEntityId('economy', project.id),
        metadata: {
          syncedCrewCount: billableCrewMembers.length,
          plannedShootDays,
          projectedCrewTotal,
          currency,
        },
      });
      enqueueSnackbar('Bemanning og budsjettrader er synkronisert.', { variant: 'success' });
    } catch (syncError) {
      enqueueSnackbar(
        syncError instanceof Error ? syncError.message : 'Kunne ikke synkronisere teamkostnader.',
        { variant: 'error' },
      );
    } finally {
      setIsSyncingCrew(false);
    }
  };

  const handleSyncTravelCosts = async () => {
    if (normalizedTravelCosts.length === 0) {
      enqueueSnackbar('Registrer reisekostnader på produksjonsdagene før du synkroniserer dem til økonomi.', {
        variant: 'warning',
      });
      return;
    }

    setIsSyncingTravel(true);
    try {
      const existingItemsByCrewId = new Map<string, typeof items[number]>();

      for (const item of items) {
        const metadata = asRecord(item.metadata);
        const source = readFirstNonEmptyString(metadata?.source);
        const crewMemberId = readFirstNonEmptyString(metadata?.crewMemberId);
        if (source === 'travel-sync' && crewMemberId) {
          existingItemsByCrewId.set(crewMemberId, item);
        }
      }

      const currentCrewIds = new Set<string>();

      for (const travelEntry of normalizedTravelCosts) {
        currentCrewIds.add(travelEntry.crewMemberId);
        const existingItem = existingItemsByCrewId.get(travelEntry.crewMemberId);
        const metadata = {
          ...(asRecord(existingItem?.metadata) ?? {}),
          source: 'travel-sync',
          crewMemberId: travelEntry.crewMemberId,
          travelDayCount: travelEntry.travelDayCount,
          department: travelEntry.department ?? null,
        };
        const commonPayload = {
          phase: 'production' as const,
          category: 'Reise og logistikk',
          itemName: `${travelEntry.crewMemberName} · Reise`,
          description: `${travelEntry.travelDayCount} registrerte reisedager`,
          estimate: travelEntry.totalCost,
          status: existingItem?.status ?? 'draft',
          clientVisible: existingItem ? Boolean(existingItem.client_visible) : true,
          metadata,
        };

        if (existingItem) {
          await updateItem(existingItem.id, {
            ...commonPayload,
            approved: toNumber(existingItem.approved),
            actual: toNumber(existingItem.actual),
            currency: existingItem.currency || currency,
          });
          continue;
        }

        await createItem({
          ...commonPayload,
          approved: 0,
          actual: 0,
          currency,
        });
      }

      for (const [crewMemberId, syncedItem] of existingItemsByCrewId.entries()) {
        if (currentCrewIds.has(crewMemberId)) {
          continue;
        }
        await removeItem(syncedItem.id);
      }

      await reload();
      setBudgetPanelVersion((previous) => previous + 1);
      await syncEconomyActivityTimelineItem({
        activityKey: 'travel-cost-sync',
        title: 'Reise og logistikk synkronisert',
        description: `${normalizedTravelCosts.length} registrerte reiseoppføringer er oppdatert i budsjettet.`,
        phase: 'production',
        linkedEntityType: 'economy',
        linkedEntityId: makeProducerPackageEntityId('economy', project.id),
        metadata: {
          syncedTravelCount: normalizedTravelCosts.length,
          travelDayCount,
          totalTravelCosts,
          currency,
        },
      });
      enqueueSnackbar('Reisekostnader er synkronisert til økonomi.', { variant: 'success' });
    } catch (syncError) {
      enqueueSnackbar(
        syncError instanceof Error ? syncError.message : 'Kunne ikke synkronisere reisekostnader.',
        { variant: 'error' },
      );
    } finally {
      setIsSyncingTravel(false);
    }
  };

  const handleCandidateStatusChange = async (candidateId: string, status: string) => {
    const candidate = project.candidates.find((entry) => entry.id === candidateId);
    if (!candidate) {
      return;
    }

    const nextProject: CastingProject = {
      ...project,
      candidates: project.candidates.map((entry) => (
        entry.id === candidateId
          ? { ...entry, status }
          : entry
      )),
    };

    await castingService.saveCandidate(project.id, {
      ...candidate,
      status,
    });
    await onProjectUpdated?.(nextProject);
  };

  const handleCreateBudgetReview = async () => {
    if (readOnly || !canSendBudgetReview) {
      return;
    }

    const title = budgetReviewTitle.trim();
    const description = budgetReviewDescription.trim();
    if (!title) {
      enqueueSnackbar('Legg inn en tydelig tittel før budsjettpakken sendes.', { variant: 'warning' });
      return;
    }

    if (projectBudget <= 0 && phaseEstimateTotal <= 0 && items.length === 0) {
      enqueueSnackbar('Legg inn totalramme eller økonomilinjer før du sender budsjettpakken.', { variant: 'warning' });
      return;
    }

    setIsSubmittingBudgetReview(true);
    try {
      const focusedPhaseTotals = focusedPhase === 'all'
        ? null
        : phaseTotals[focusedPhase];

      await createReview({
        reviewType: 'budget_package',
        title,
        description: description || undefined,
        targetEntityType: 'economy',
        targetEntityId: budgetPackageEntityId,
        dueAt: toIsoDateTimeValue(budgetReviewDueAt),
        metadata: {
          source: 'economy-hub',
          projectName: project.name,
          currency,
          focusedPhase,
          projectBudget,
          estimateTotal: toNumber(totals.estimate),
          approvedTotal: toNumber(totals.approved),
          actualTotal: toNumber(totals.actual),
          phaseEstimateTotal: focusedPhase === 'all' ? phaseEstimateTotal : focusedPhaseTotals?.estimate ?? 0,
          phaseApprovedTotal: focusedPhase === 'all' ? toNumber(totals.approved) : focusedPhaseTotals?.approved ?? 0,
          phaseActualTotal: focusedPhase === 'all' ? toNumber(totals.actual) : focusedPhaseTotals?.actual ?? 0,
          syncedCrewLines: syncedCrewItems.length,
          syncedTravelLines: syncedTravelItems.length,
        },
      });

      const defaults = buildBudgetReviewDefaults(project.name, focusedPhase);
      setBudgetReviewTitle(defaults.title);
      setBudgetReviewDescription(defaults.description);
      setBudgetReviewDueAt('');
      enqueueSnackbar('Budsjettpakken er sendt til klientgodkjenning fra økonomisenteret.', { variant: 'success' });
    } catch (reviewError) {
      enqueueSnackbar(
        reviewError instanceof Error ? reviewError.message : 'Kunne ikke sende budsjettpakken til klient.',
        { variant: 'error' },
      );
    } finally {
      setIsSubmittingBudgetReview(false);
    }
  };

  const handleCreateBudgetMilestone = async () => {
    if (readOnly) {
      return;
    }

    const title = budgetMilestoneTitle.trim();
    const description = budgetMilestoneDescription.trim();
    if (!title) {
      enqueueSnackbar('Legg inn en tittel før du oppretter en økonomimilepæl.', { variant: 'warning' });
      return;
    }

    setIsCreatingBudgetMilestone(true);
    try {
      const phase = focusedPhase === 'all' ? 'preproduction' : focusedPhase;
      await createTimelineItem({
        phase,
        title,
        description: description || undefined,
        dueAt: toIsoDateTimeValue(budgetMilestoneDueAt),
        status: 'planned',
        linkedEntityType: 'economy',
        linkedEntityId: budgetPackageEntityId,
        metadata: {
          source: 'economy-hub',
          projectName: project.name,
          currency,
          focusedPhase,
          category: 'economy_milestone',
        },
      });

      const defaults = buildBudgetMilestoneDefaults(focusedPhase);
      setBudgetMilestoneTitle(defaults.title);
      setBudgetMilestoneDescription(defaults.description);
      setBudgetMilestoneDueAt('');
      enqueueSnackbar('Økonomimilepælen er lagt til i prosjektets tidslinje.', { variant: 'success' });
    } catch (timelineCreateError) {
      enqueueSnackbar(
        timelineCreateError instanceof Error ? timelineCreateError.message : 'Kunne ikke opprette økonomimilepæl.',
        { variant: 'error' },
      );
    } finally {
      setIsCreatingBudgetMilestone(false);
    }
  };

  const handleCreateDeliverableReview = async () => {
    if (readOnly) {
      return;
    }

    const title = deliverableReviewTitle.trim();
    const description = deliverableReviewDescription.trim();
    if (!title) {
      enqueueSnackbar('Legg inn en tydelig tittel før leveransen sendes til klient.', { variant: 'warning' });
      return;
    }

    setIsSubmittingDeliverableReview(true);
    try {
      const targetEntityId = makeProducerPackageEntityId(selectedApprovalTemplate, project.id);
      await createReview({
        reviewType: selectedApprovalTemplate,
        title,
        description: description || undefined,
        targetEntityType: selectedApprovalTemplate,
        targetEntityId,
        dueAt: toIsoDateTimeValue(deliverableReviewDueAt),
        metadata: {
          source: 'economy-hub',
          approvalTemplate: selectedApprovalTemplate,
          projectName: project.name,
          focusedPhase,
          profession,
        },
      });

      const defaults = buildDeliverableReviewDefaults(project.name, selectedApprovalTemplate);
      setDeliverableReviewTitle(defaults.title);
      setDeliverableReviewDescription(defaults.description);
      setDeliverableReviewDueAt('');
      enqueueSnackbar(`${selectedApprovalTemplateConfig.title} er sendt til klientgodkjenning fra økonomisenteret.`, {
        variant: 'success',
      });
    } catch (reviewError) {
      enqueueSnackbar(
        reviewError instanceof Error ? reviewError.message : 'Kunne ikke sende leveransen til klientgodkjenning.',
        { variant: 'error' },
      );
    } finally {
      setIsSubmittingDeliverableReview(false);
    }
  };

  const budgetWorkspacePriority = useMemo(() => {
    const crewNeedsSync = billableCrewMembers.length > 0 && syncedCrewItems.length < billableCrewMembers.length;
    const travelNeedsSync = normalizedTravelCosts.length > 0 && syncedTravelItems.length < normalizedTravelCosts.length;

    if (projectBudget <= 0) {
      return {
        title: 'Forankre totalrammen før resten av budsjettet',
        description: projectedCrewTotal > 0
          ? `Bemanningsprognosen tilsier allerede ${formatCurrency(projectedCrewTotal, currency)}. Lås totalrammen først, så blir resten av økonomiarbeidet konsistent.`
          : 'Sett en totalramme før du begynner å sende budsjettpakker eller avtaler videre.',
        actionLabel: 'Lagre totalramme',
        actionKey: 'save-budget',
        tone: 'warning' as const,
        blockers: [
          'Prosjektet mangler en økonomisk ramme som resten av kostlinjene kan styres mot.',
        ],
      };
    }

    if (crewNeedsSync) {
      return {
        title: 'Synk teamkostnader før du går videre',
        description: `Teamet er bare synket ${Math.round((crewSyncCoverage ?? 0) * 100)}%. Kostgrunnlaget blir mer pålitelig når dagsatser og roller ligger i samme budsjettflate.`,
        actionLabel: 'Synk team til budsjett',
        actionKey: 'sync-crew',
        tone: 'action' as const,
        blockers: [
          `${billableCrewMembers.length - syncedCrewItems.length} teammedlemmer mangler fortsatt kobling til økonomien.`,
        ],
      };
    }

    if (travelNeedsSync) {
      return {
        title: 'Samle reise og logistikk inn i budsjettet',
        description: `Reisekostnader er bare synket ${Math.round((travelSyncCoverage ?? 0) * 100)}%. Legg dette inn før klienten ser totalbildet.`,
        actionLabel: 'Synk reiser til budsjett',
        actionKey: 'sync-travel',
        tone: 'action' as const,
        blockers: [
          `${normalizedTravelCosts.length - syncedTravelItems.length} reiseprofiler er ikke skrevet tilbake til økonomien ennå.`,
        ],
      };
    }

    if (unscheduledLoad) {
      return {
        title: 'Knytt opptaksplan til budsjettet',
        description: `${unscheduledLoad.shotListCount} shotlister mangler opptaksdag. Så lenge opptaksplanen er løs, blir også økonomiprognosen svakere.`,
        actionLabel: onOpenTeam ? 'Åpne produksjonsplan' : 'Hold budsjettfokus',
        actionKey: onOpenTeam ? 'open-team' : 'stay-budget',
        tone: 'warning' as const,
        blockers: [
          'Opptaksdager må på plass før estimat og logistikk kan regnes som ferdig grunnlag.',
        ],
      };
    }

    if (items.length === 0) {
      return {
        title: 'Legg inn første kostlinjer',
        description: 'Totalrammen er satt, men budsjettlinjene er fortsatt tomme. Legg inn første kostgrunnlag før avtaler og godkjenning bygges videre.',
        actionLabel: 'Arbeid i budsjettpanelet',
        actionKey: 'stay-budget',
        tone: 'action' as const,
        blockers: [
          'Ingen kostlinjer er registrert ennå i budsjettflaten.',
        ],
      };
    }

    if (approvalPressure > 0 || agreementSignatureSummary.inFlight > 0 || agreementSignatureSummary.needsAttention > 0) {
      return {
        title: 'Økonomien er klar for beslutning',
        description: 'Tallene henger sammen. Neste steg er å lukke klientbeslutninger og juridiske avtaler som fortsatt styrer prosjektstatus.',
        actionLabel: 'Gå til godkjenning',
        actionKey: 'go-approvals',
        tone: 'ready' as const,
        blockers: [
          `${approvalPressure} åpne godkjenninger og ${agreementSignatureSummary.inFlight + agreementSignatureSummary.needsAttention} juridiske avtaler må fortsatt lukkes.`,
        ],
      };
    }

    return {
      title: 'Budsjettgrunnlaget er stramt',
      description: 'Ramme, kostlinjer og synkede grunnlag henger sammen. Du kan enten jobbe videre i avtalesporet eller gå til neste beslutningspunkt.',
      actionLabel: 'Gå til godkjenning',
      actionKey: 'go-approvals',
      tone: 'ready' as const,
      blockers: [
        `${items.length} kostlinjer og ${projectAgreements.length} avtaler følger nå samme økonomiske retning.`,
      ],
    };
  }, [
    agreementSignatureSummary.inFlight,
    agreementSignatureSummary.needsAttention,
    approvalPressure,
    billableCrewMembers.length,
    crewSyncCoverage,
    currency,
    items.length,
    normalizedTravelCosts.length,
    onOpenTeam,
    projectAgreements.length,
    projectBudget,
    projectedCrewTotal,
    syncedCrewItems.length,
    syncedTravelItems.length,
    travelSyncCoverage,
    unscheduledLoad,
  ]);

  const approvalPriorityReview = useMemo(
    () => approvalWorkQueue.find((item) => item.review.status === 'changes_requested' || item.review.status === 'rejected')
      ?? approvalWorkQueue.find((item) => item.isStatusDriver)
      ?? approvalWorkQueue[0],
    [approvalWorkQueue],
  );

  const approvalsWorkspacePriority = useMemo(() => {
    if (approvalPriorityReview && (approvalPriorityReview.review.status === 'changes_requested' || approvalPriorityReview.review.status === 'rejected')) {
      return {
        title: 'Lukk saken som stopper neste klientbeslutning',
        description: `${approvalPriorityReview.review.title} krever avklaring før økonomiflyten kan gå rolig videre.`,
        actionLabel: 'Åpne saken',
        actionKey: 'open-priority-review',
        tone: 'warning' as const,
        blockers: [
          'Endringer eller avvisning bør løses før nye leveranser eller budsjettpakker sendes.',
        ],
      };
    }

    if (approvalPriorityReview?.isStatusDriver) {
      return {
        title: 'Prosjektstatus styres av én åpen beslutning',
        description: `${approvalPriorityReview.review.title} er nå det viktigste økonomiske touchpointet mot klienten.`,
        actionLabel: 'Åpne saken',
        actionKey: 'open-priority-review',
        tone: 'action' as const,
        blockers: [
          'Statusdriveren bør avklares før du sender flere økonomiske beslutninger parallelt.',
        ],
      };
    }

    if (deliverableReviews.length === 0 && budgetReviews.length === 0 && agreementReviews.length === 0) {
      return {
        title: 'Start med første klientbeslutning',
        description: 'Ingen leveranser, budsjettpakker eller avtaler er sendt ennå. Opprett første beslutningspunkt herfra.',
        actionLabel: canSendBudgetReview ? 'Lag budsjettpakke' : 'Lag leveransegodkjenning',
        actionKey: canSendBudgetReview ? 'compose-budget' : 'compose-deliverable',
        tone: 'warning' as const,
        blockers: [
          'Klienten mangler fortsatt en første økonomisk beslutning å ta stilling til.',
        ],
      };
    }

    if (agreementSignatureSummary.needsAttention > 0 || agreementSignatureSummary.inFlight > 0) {
      return {
        title: 'Følg opp juridisk signatur før du lukker økonomiflyten',
        description: `${agreementSignatureSummary.inFlight} avtaler er ute til signering og ${agreementSignatureSummary.needsAttention} trenger avklaring.`,
        actionLabel: 'Åpne budsjett og avtaler',
        actionKey: 'open-budget',
        tone: 'action' as const,
        blockers: [
          'Signatursporet bør være tydelig før milepæler og leveranser markeres som ferdige.',
        ],
      };
    }

    if (budgetTimelineItems.length === 0) {
      return {
        title: 'Legg inn første økonomimilepæl',
        description: 'Tidslinjen mangler fortsatt et konkret økonomisk kontrollpunkt. Legg inn milepælen her før flyten sprer seg.',
        actionLabel: 'Opprett milepæl',
        actionKey: 'compose-milestone',
        tone: 'action' as const,
        blockers: [
          'Ingen økonomimilepæler er synlige i prosjektets tidslinje ennå.',
        ],
      };
    }

    return {
      title: 'Godkjenningene er under kontroll',
      description: 'Leveranser, budsjettpakker og milepæler kan nå følges opp rolig fra samme flate.',
      actionLabel: 'Åpne klientsamarbeid',
      actionKey: 'open-reviews',
      tone: 'ready' as const,
      blockers: [
        `${approvalWorkQueue.length} åpne saker følges nå i samme økonomiske kontrollflate.`,
      ],
    };
  }, [
    agreementReviews.length,
    agreementSignatureSummary.inFlight,
    agreementSignatureSummary.needsAttention,
    approvalPriorityReview,
    approvalWorkQueue.length,
    budgetReviews.length,
    budgetTimelineItems.length,
    canSendBudgetReview,
    deliverableReviews.length,
  ]);

  const budgetPriorityTone = getWorkspacePriorityTone(budgetWorkspacePriority.tone);
  const approvalsPriorityTone = getWorkspacePriorityTone(approvalsWorkspacePriority.tone);

  const handleBudgetWorkspacePriorityAction = useCallback(() => {
    switch (budgetWorkspacePriority.actionKey) {
      case 'save-budget':
        void handleSaveProjectBudget();
        break;
      case 'sync-crew':
        void handleSyncCrewCosts();
        break;
      case 'sync-travel':
        void handleSyncTravelCosts();
        break;
      case 'open-team':
        onOpenTeam?.();
        break;
      case 'go-approvals':
        setActiveView('approvals');
        break;
      default:
        break;
    }
  }, [
    budgetWorkspacePriority.actionKey,
    handleSaveProjectBudget,
    handleSyncCrewCosts,
    handleSyncTravelCosts,
    onOpenTeam,
  ]);

  const handleApprovalsWorkspacePriorityAction = useCallback(() => {
    switch (approvalsWorkspacePriority.actionKey) {
      case 'compose-deliverable':
        setApprovalComposerMode('deliverable');
        break;
      case 'compose-budget':
        setApprovalComposerMode('budget');
        break;
      case 'compose-milestone':
        setApprovalComposerMode('milestone');
        break;
      case 'open-budget':
        setActiveView('budget');
        break;
      case 'open-priority-review':
        if (approvalPriorityReview) {
          onOpenReviews?.(buildReviewFocusPayload(approvalPriorityReview.review));
        }
        break;
      case 'open-reviews':
        onOpenReviews?.();
        break;
      default:
        break;
    }
  }, [
    approvalPriorityReview,
    approvalsWorkspacePriority.actionKey,
    buildReviewFocusPayload,
    onOpenReviews,
  ]);

  const openReviewFocus = useCallback((focus?: Partial<ProducerWorkflowFocusPayload>) => {
    onOpenReviews?.(focus);
  }, [onOpenReviews]);

  const openTimelineFocus = useCallback((focus?: Partial<ProducerWorkflowFocusPayload>) => {
    onOpenTimeline?.(focus);
  }, [onOpenTimeline]);

  return (
    <Stack spacing={2}>
      <Box
        sx={{
          p: { xs: 1.5, md: 2 },
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.22)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.82) 100%)',
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ lg: 'center' }}>
            <Stack spacing={0.35}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800 }}>
                  Styr økonomien
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1,
                    py: 0.35,
                    borderRadius: 999,
                    border: '1px solid rgba(59,130,246,0.24)',
                    bgcolor: 'rgba(59,130,246,0.12)',
                  }}
                >
                  <Typography sx={{ color: '#93c5fd', fontSize: '0.73rem', fontWeight: 700 }}>
                    {getProjectWorkflowStatusLabel(project.producerWorkflowStatus)}
                  </Typography>
                </Box>
              </Stack>
              <Typography
                sx={{
                  color: 'rgba(226,232,240,0.9)',
                  maxWidth: 760,
                  '@media (min-width: 3840px)': { maxWidth: 1100, fontSize: '1rem' },
                  '@media (min-width: 5120px)': { maxWidth: 1320, fontSize: '1.08rem' },
                }}
              >
                {project.name} · Valuta {currency} · Fokus {focusedPhaseLabel}
              </Typography>
            </Stack>
            <Typography
              sx={{
                color: 'rgba(226,232,240,0.88)',
                fontSize: '0.82rem',
                maxWidth: 460,
                textAlign: { lg: 'right' },
                '@media (min-width: 3840px)': { maxWidth: 760, fontSize: '0.92rem' },
              }}
            >
              Team {formatCurrency(projectedCrewTotal, currency)} · Reise {formatCurrency(totalTravelCosts, currency)}
            </Typography>
          </Stack>

          <Box
            sx={{
              px: 1.2,
              py: 0.95,
              borderRadius: 1.5,
              border: '1px solid rgba(96,165,250,0.16)',
              background: 'rgba(15,23,42,0.52)',
            }}
          >
            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
              {projectAgreements.length > 0 ? legalFlowSummary : projectWorkflowDetail}
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.86)', fontSize: '0.78rem', mt: 0.35 }}>
              {economyStageCards.map((card) => `${card.label}: ${card.value}`).join(' · ')}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {(error || reviewsLoading || timelineError || timelineLoading || planningError || agreementsLoading || agreementLookupError) && (
        <Stack spacing={1}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {reviewsLoading ? <Alert severity="info">Oppdaterer budsjettgodkjenning fra klient.</Alert> : null}
          {timelineError ? <Alert severity="error">{timelineError}</Alert> : null}
          {timelineLoading ? <Alert severity="info">Oppdaterer økonomimilepæler og leveranser.</Alert> : null}
          {planningError ? <Alert severity="error">{planningError}</Alert> : null}
          {agreementsLoading ? <Alert severity="info">Oppdaterer juridiske avtaler og Google-signaturstatus.</Alert> : null}
          {agreementLookupError ? <Alert severity="error">{agreementLookupError}</Alert> : null}
        </Stack>
      )}

      <Box
        sx={{
          borderRadius: 2,
          border: '1px solid rgba(148,163,184,0.18)',
          background: 'linear-gradient(180deg, rgba(15,23,42,0.88) 0%, rgba(2,6,23,0.78) 100%)',
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={activeView}
          onChange={(_event, nextValue: EconomyWorkspaceView) => setActiveView(nextValue)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            px: { xs: 1, md: 1.5 },
            pt: 1,
            borderBottom: '1px solid rgba(148,163,184,0.16)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              color: 'rgba(226,232,240,0.84)',
              minHeight: 48,
            },
            '& .Mui-selected': {
              color: '#f8fafc',
            },
            '& .MuiTabs-indicator': {
              backgroundColor: '#fbbf24',
            },
          }}
        >
          <Tab value="overview" label="Oversikt" />
          <Tab value="budget" label="Budsjett" />
          <Tab value="approvals" label="Godkjenning" />
        </Tabs>

        <Box sx={{ p: { xs: 1.25, md: 1.75 } }}>
          {activeView === 'overview' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  lg: 'minmax(0, 1.55fr) minmax(300px, 0.9fr)',
                },
                gap: 2,
                alignItems: 'start',
                '@media (min-width: 3840px)': {
                  gridTemplateColumns: 'minmax(0, 1.7fr) minmax(360px, 1fr)',
                },
                '@media (min-width: 5120px)': {
                  gridTemplateColumns: 'minmax(0, 1.85fr) minmax(420px, 1fr)',
                },
              }}
            >
              <Stack spacing={2}>
                <Box
                  sx={{
                    p: 1.6,
                    borderRadius: 2,
                    border: `1px solid ${economyPriorityTone.border}`,
                    background: economyPriorityTone.background,
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ md: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.08rem' }}>
                        {economyPriority.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.9rem', mt: 0.45, maxWidth: 760 }}>
                        {economyPriority.description}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={`Arbeider i ${focusedPhaseLabel}`}
                      sx={{
                        bgcolor: economyPriorityTone.chipBackground,
                        color: economyPriorityTone.chipColor,
                        fontWeight: 700,
                      }}
                    />
                  </Stack>
                  <Stack spacing={0.55} sx={{ mt: 1.1 }}>
                    {economyPriority.blockers.slice(0, 3).map((blocker) => (
                      <Typography key={blocker} sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.84rem' }}>
                        • {blocker}
                      </Typography>
                    ))}
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.3 }}>
                    <Button
                      variant="contained"
                      onClick={() => setActiveView(economyPriority.actionView)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: economyPriorityTone.button,
                        '&:hover': {
                          bgcolor: economyPriorityTone.button,
                          filter: 'brightness(0.95)',
                        },
                      }}
                    >
                      {economyPriority.actionLabel}
                    </Button>
                    {onOpenReviews && (approvalPressure > 0 || agreementSignatureSummary.inFlight > 0 || agreementSignatureSummary.needsAttention > 0) ? (
                      <Button
                        variant="outlined"
                        onClick={() => openReviewFocus()}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Åpne klientsamarbeid
                      </Button>
                    ) : null}
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    Økonomiflyt
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(3, minmax(0, 1fr))',
                      },
                      gap: 1,
                    }}
                  >
                    {economyStageCards.map((card) => (
                      <Box
                        key={card.label}
                        sx={{
                          p: 1.2,
                          borderRadius: 1.5,
                          border: card.tone === 'warning'
                            ? '1px solid rgba(251,191,36,0.32)'
                            : card.tone === 'ready'
                              ? '1px solid rgba(52,211,153,0.24)'
                              : '1px solid rgba(96,165,250,0.24)',
                          background: card.tone === 'warning'
                            ? 'rgba(251,191,36,0.06)'
                            : card.tone === 'ready'
                              ? 'rgba(16,185,129,0.06)'
                              : 'rgba(59,130,246,0.06)',
                        }}
                      >
                        <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.8rem', fontWeight: 700 }}>
                          {card.label}
                        </Typography>
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.02rem', mt: 0.4 }}>
                          {card.value}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.35 }}>
                          {card.detail}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Fasebudsjett
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem' }}>
                        Hver fase peker videre til samme budsjettramme, så du slipper å lese økonomien som flere parallelle paneler.
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={focusedPhaseLabel}
                      sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(3, minmax(0, 1fr))',
                      },
                      gap: 1.1,
                    }}
                  >
                    {phaseCards.map((phaseCard) => {
                      const isActive = focusedPhase === phaseCard.phase;
                      return (
                        <Box
                          key={phaseCard.phase}
                          onClick={() => {
                            setFocusedPhase(phaseCard.phase);
                            setActiveView('budget');
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setFocusedPhase(phaseCard.phase);
                              setActiveView('budget');
                            }
                          }}
                          sx={{
                            p: 1.25,
                            borderRadius: 1.5,
                            border: isActive ? '1px solid rgba(251,191,36,0.42)' : '1px solid rgba(148,163,184,0.14)',
                            background: isActive ? 'rgba(251,191,36,0.08)' : 'rgba(2,6,23,0.54)',
                            cursor: 'pointer',
                            transition: 'border-color 0.2s ease, background 0.2s ease',
                            '&:hover': {
                              borderColor: 'rgba(251,191,36,0.32)',
                            },
                            '&:focus-visible': {
                              outline: '2px solid #fbbf24',
                              outlineOffset: '2px',
                            },
                          }}
                        >
                          <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                              {phaseCard.label}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${phaseCard.lineCount} linjer`}
                              sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                            />
                          </Stack>
                          <Typography sx={{ color: '#e2e8f0', fontWeight: 800, fontSize: '1rem', mt: 0.55 }}>
                            {formatCurrency(phaseCard.estimate, currency)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.35 }}>
                            Godkjent {formatCurrency(phaseCard.approved, currency)} · Faktisk {formatCurrency(phaseCard.actual, currency)}
                          </Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.8)', fontSize: '0.78rem', mt: 0.45 }}>
                            {phaseCard.syncedLineCount > 0
                              ? `${phaseCard.syncedLineCount} linjer kommer fra team/reise-synk`
                              : 'Ingen synkede team- eller reiselinjer ennå.'}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Det som styrer tallene
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem' }}>
                        Økonomien skal lese samme sannhet som produksjonsplan, leveranser og klientgrunnlag, ikke en separat sidevei.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {onOpenTimeline ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onOpenTimeline()}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne tidslinje
                        </Button>
                      ) : null}
                      {onOpenReviews ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openReviewFocus()}
                          sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                          Åpne klientsamarbeid
                        </Button>
                      ) : null}
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(3, minmax(0, 1fr))',
                      },
                      gap: 1,
                    }}
                  >
                    {economySupportSignals.map((signal) => (
                      <Box
                        key={signal.label}
                        sx={{
                          p: 1.15,
                          borderRadius: 1.4,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.54)',
                        }}
                      >
                        <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.8rem', fontWeight: 700 }}>
                          {signal.label}
                        </Typography>
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.97rem', mt: 0.45 }}>
                          {signal.value}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.8rem', mt: 0.45 }}>
                          {signal.detail}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    Økonomiflyt akkurat nå
                  </Typography>
                  <Stack spacing={1}>
                    {budgetTimelineItems.slice(0, 4).map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.1,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.54)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                          <Box>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {item.title}
                            </Typography>
                            {item.description ? (
                              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                                {item.description}
                              </Typography>
                            ) : null}
                          </Box>
                          <Stack spacing={0.5} alignItems={{ sm: 'flex-end' }}>
                            <Chip size="small" label={getProducerTimelineStatusLabel(item.status)} />
                            {formatDateTime(item.due_at) ? (
                              <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                Frist {formatDateTime(item.due_at)}
                              </Typography>
                            ) : null}
                          </Stack>
                        </Stack>
                      </Box>
                    ))}
                    {budgetTimelineItems.length === 0 ? (
                      <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.9rem' }}>
                        Ingen økonomimilepæler er opprettet ennå. Send budsjettpakke eller legg til økonomilinjer for å bygge flyten.
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>

              <Box
                sx={{
                  position: { lg: 'sticky' },
                  top: { lg: 16 },
                  alignSelf: 'start',
                }}
              >
                <Stack spacing={2}>
                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(15,23,42,0.66)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 800, mb: 0.6 }}>
                      Neste steg
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.86rem' }}>
                      {economyPriority.description}
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 1 }}>
                      {economyPriority.blockers.slice(0, 2).map((blocker) => (
                        <Typography key={blocker} sx={{ color: 'rgba(203,213,225,0.88)', fontSize: '0.8rem' }}>
                          • {blocker}
                        </Typography>
                      ))}
                    </Stack>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => setActiveView(economyPriority.actionView)}
                      sx={{
                        mt: 1.2,
                        textTransform: 'none',
                        fontWeight: 700,
                        minHeight: 44,
                        bgcolor: economyPriorityTone.button,
                        '&:hover': {
                          bgcolor: economyPriorityTone.button,
                          filter: 'brightness(0.95)',
                        },
                      }}
                    >
                      {economyPriority.actionLabel}
                    </Button>
                  </Box>

                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(15,23,42,0.66)',
                    }}
                  >
                    <Typography sx={{ color: '#fff', fontWeight: 800, mb: 0.8 }}>
                      Statusdriver akkurat nå
                    </Typography>
                    {statusTouchpoint ? (
                      <Stack spacing={0.75}>
                        <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                          {statusTouchpoint.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem' }}>
                          {workflowDriverReview ? 'Denne saken driver prosjektstatusen akkurat nå.' : 'Siste sak i økonomi- og klientflyten.'}
                        </Typography>
                        <Chip
                          size="small"
                          label={`${getProducerReviewTypeLabel(statusTouchpoint.review_type)} · ${getProducerReviewStatusLabel(statusTouchpoint.status)}`}
                          sx={{ alignSelf: 'flex-start' }}
                        />
                        {statusTouchpointAgreement?.google_signature ? (
                          <Chip
                            size="small"
                            label={`Juridisk signatur · ${getAgreementSignatureLabel(statusTouchpointAgreement.google_signature)}`}
                            sx={{
                              alignSelf: 'flex-start',
                              bgcolor: getAgreementSignatureTone(statusTouchpointAgreement.google_signature).background,
                              color: getAgreementSignatureTone(statusTouchpointAgreement.google_signature).color,
                            }}
                          />
                        ) : null}
                        {onOpenTimeline ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => openTimelineFocus({
                              reviewId: statusTouchpoint.id,
                              linkedEntityType: 'client_review',
                              linkedEntityId: statusTouchpoint.id,
                            })}
                            sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                          >
                            Åpne i tidslinje
                          </Button>
                        ) : null}
                      </Stack>
                    ) : (
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem' }}>
                        Ingen budsjettpakker eller avtalegodkjenninger er sendt ennå.
                      </Typography>
                    )}
                  </Box>
                </Stack>
              </Box>
            </Box>
          ) : null}
          {activeView === 'budget' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  xl: 'minmax(0, 1.7fr) minmax(320px, 0.88fr)',
                },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Stack spacing={2}>
                <ProducerEconomyPanel
                  key={`${project.id}:${budgetPanelVersion}`}
                  projectId={project.id}
                  title="Budsjett og avtaler"
                  readOnly={readOnly}
                  canSendBudgetReview={false}
                  focusedPhase={focusedPhase}
                  onFocusedPhaseChange={setFocusedPhase}
                  contractsPanel={(
                    <ProjectAgreementsPanel
                      project={project}
                      readOnly={readOnly}
                      onProjectUpdated={onProjectUpdated}
                      onCandidateStatusChange={(candidateId, status) => {
                        void handleCandidateStatusChange(candidateId, status);
                      }}
                      onOpenMedia={onOpenMedia}
                      onOpenReviews={onOpenReviews}
                      onOpenTimeline={onOpenTimeline}
                    />
                  )}
                />

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    justifyContent="space-between"
                    sx={{ mb: 1.25 }}
                  >
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Teamavtaler og fordeling
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem' }}>
                        Hold honorarer, fordeling og rettigheter på samme tallgrunnlag.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip size="small" label={splitSheetStatusLabel} sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#d8b4fe' }} />
                      <Chip size="small" label={`${splitSheetContributorCount} bidragsytere`} sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }} />
                    </Stack>
                  </Stack>

                  {splitSheetContributorCount === 0 ? (
                    <Alert severity="info">
                      Legg til team eller bidragsytere først. Når teamet er klart, kan teamavtaler og fordeling bygges her uten å forlate økonomi.
                    </Alert>
                  ) : readOnly ? (
                    <Stack spacing={1}>
                      <Alert severity="info">
                        Teamavtaler vises i lesemodus for denne rollen.
                      </Alert>
                      <Stack spacing={0.8}>
                        {(splitSheetData?.contributors ?? splitSheetInitialContributors).map((contributor, index) => (
                          <Box
                            key={`${contributor.email || contributor.name}-${index}`}
                            sx={{
                              p: 1,
                              borderRadius: 1.25,
                              border: '1px solid rgba(148,163,184,0.18)',
                              background: 'rgba(2,6,23,0.54)',
                            }}
                          >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                              <Box>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>
                                  {contributor.name}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.85rem' }}>
                                  {ROLE_DISPLAY_NAMES[contributor.role] ?? contributor.role}
                                </Typography>
                              </Box>
                              <Stack direction="row" spacing={1} flexWrap="wrap">
                                {contributor.email ? (
                                  <Chip size="small" label={contributor.email} />
                                ) : null}
                                {contributor.percentage > 0 ? (
                                  <Chip size="small" label={`${contributor.percentage.toFixed(2)}%`} />
                                ) : null}
                              </Stack>
                            </Stack>
                          </Box>
                        ))}
                      </Stack>
                    </Stack>
                  ) : (
                    <SplitSheetEditor
                      splitSheet={splitSheetData}
                      projectId={project.id}
                      projectName={project.name}
                      initialContributors={splitSheetInitialContributors}
                      profession={profession}
                      agreementLabel="Teamavtale"
                      onSaveProject={handlePersistProjectForEconomy}
                      onSave={(savedSplitSheet) => {
                        void handleSplitSheetSaved(savedSplitSheet);
                      }}
                      onCancel={() => undefined}
                    />
                  )}
                </Box>
              </Stack>

              <Stack
                spacing={2}
                sx={{
                  position: { xl: 'sticky' },
                  top: { xl: 20 },
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${budgetPriorityTone.border}`,
                    background: budgetPriorityTone.background,
                  }}
                >
                  <Stack spacing={1.1}>
                    <Chip
                      size="small"
                      label="Neste steg"
                      sx={{
                        alignSelf: 'flex-start',
                        bgcolor: budgetPriorityTone.chipBackground,
                        color: budgetPriorityTone.chipColor,
                      }}
                    />
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        {budgetWorkspacePriority.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.9rem', mt: 0.45 }}>
                        {budgetWorkspacePriority.description}
                      </Typography>
                    </Box>
                    <Stack spacing={0.55}>
                      {budgetWorkspacePriority.blockers.map((blocker) => (
                        <Typography key={blocker} sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.82rem' }}>
                          • {blocker}
                        </Typography>
                      ))}
                    </Stack>
                    <Button
                      variant="contained"
                      onClick={handleBudgetWorkspacePriorityAction}
                      disabled={
                        readOnly
                        || (budgetWorkspacePriority.actionKey === 'save-budget' && isSavingBudget)
                        || (budgetWorkspacePriority.actionKey === 'sync-crew' && (loading || isSyncingCrew))
                        || (budgetWorkspacePriority.actionKey === 'sync-travel' && (loading || isSyncingTravel))
                      }
                      sx={{
                        alignSelf: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: budgetPriorityTone.button,
                        '&:hover': { bgcolor: budgetPriorityTone.button },
                      }}
                    >
                      {budgetWorkspacePriority.actionLabel}
                    </Button>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(15,23,42,0.66)',
                  }}
                >
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Budsjettgrunnlag
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem', mt: 0.35 }}>
                        Her styrer du fasefokus, totalramme og synk mellom plan, team og logistikk før tallene sendes videre.
                      </Typography>
                    </Box>

                    <Box
                      sx={{
                        p: 1.15,
                        borderRadius: 1.5,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'rgba(2,6,23,0.52)',
                      }}
                    >
                      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                          Fasefokus
                        </Typography>
                        <Chip
                          size="small"
                          label={focusedPhaseLabel}
                          sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap">
                        <Button
                          size="small"
                          variant={focusedPhase === 'all' ? 'contained' : 'outlined'}
                          onClick={() => setFocusedPhase('all')}
                          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: focusedPhase === 'all' ? '#1d4ed8' : 'transparent' }}
                        >
                          Alle faser
                        </Button>
                        {phaseCards.map((phaseCard) => (
                          <Button
                            key={phaseCard.phase}
                            size="small"
                            variant={focusedPhase === phaseCard.phase ? 'contained' : 'outlined'}
                            onClick={() => setFocusedPhase(phaseCard.phase)}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: focusedPhase === phaseCard.phase ? '#0f766e' : 'transparent' }}
                          >
                            {phaseCard.label}
                          </Button>
                        ))}
                      </Stack>
                    </Box>

                    <Box
                      sx={{
                        p: 1.15,
                        borderRadius: 1.5,
                        border: '1px solid rgba(148,163,184,0.14)',
                        background: 'rgba(2,6,23,0.52)',
                      }}
                    >
                      <Typography sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
                        Prosjektramme
                      </Typography>
                      <Stack spacing={1}>
                        <TextField
                          size="small"
                          label="Totalramme"
                          value={projectBudgetInput}
                          onChange={(event) => setProjectBudgetInput(event.target.value)}
                          disabled={readOnly}
                          InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                        />
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                          <Button
                            variant="contained"
                            onClick={() => setProjectBudgetInput(String(projectedCrewTotal))}
                            disabled={readOnly}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1d4ed8' }}
                          >
                            Bruk bemanningsprognose
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => { void handleSaveProjectBudget(); }}
                            disabled={readOnly || isSavingBudget}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Lagre totalramme
                          </Button>
                        </Stack>
                        {budgetUtilization !== null ? (
                          <Chip
                            size="small"
                            label={`Teamandel ${(budgetUtilization * 100).toFixed(1)}% av totalrammen`}
                            sx={{
                              alignSelf: 'flex-start',
                              bgcolor: budgetUtilization > 1 ? 'rgba(248,113,113,0.16)' : 'rgba(52,211,153,0.16)',
                              color: budgetUtilization > 1 ? '#fca5a5' : '#86efac',
                            }}
                          />
                        ) : null}
                      </Stack>
                    </Box>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                        gap: 1,
                      }}
                    >
                      <Box
                        sx={{
                          p: 1.15,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.52)',
                        }}
                      >
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                          Teamkostnader
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                          {formatCurrency(crewDailyTotal, currency)} per opptaksdag · {formatCurrency(projectedCrewTotal, currency)} over {plannedShootDays} dager.
                        </Typography>
                        <Stack spacing={0.6} sx={{ mt: 1 }}>
                          {topDepartments.slice(0, 3).map(([department, departmentRate]) => (
                            <Chip
                              key={department}
                              size="small"
                              label={`${department}: ${formatCurrency(departmentRate, currency)}/dag`}
                              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                            />
                          ))}
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.2 }}>
                          <Button
                            variant="contained"
                            startIcon={<SyncIcon />}
                            onClick={() => { void handleSyncCrewCosts(); }}
                            disabled={readOnly || loading || isSyncingCrew}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#0f766e' }}
                          >
                            Synk team
                          </Button>
                          {onOpenTeam ? (
                            <Button
                              variant="outlined"
                              endIcon={<ArrowForwardIcon />}
                              onClick={onOpenTeam}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne team
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>

                      <Box
                        sx={{
                          p: 1.15,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.52)',
                        }}
                      >
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                          Reise og logistikk
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                          {normalizedTravelCosts.length > 0
                            ? `${normalizedTravelCosts.length} profiler · ${travelDayCount} reisedager · ${formatCurrency(totalTravelCosts, currency)}`
                            : 'Ingen registrerte reisekostnader ennå.'}
                        </Typography>
                        <Stack spacing={0.6} sx={{ mt: 1 }}>
                          {normalizedTravelCosts.slice(0, 3).map((entry) => (
                            <Chip
                              key={entry.crewMemberId}
                              size="small"
                              label={`${entry.crewMemberName}: ${formatCurrency(entry.totalCost, currency)}`}
                              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(249,115,22,0.16)', color: '#fdba74' }}
                            />
                          ))}
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.2 }}>
                          <Button
                            variant="contained"
                            startIcon={<SyncIcon />}
                            onClick={() => { void handleSyncTravelCosts(); }}
                            disabled={readOnly || loading || isSyncingTravel}
                            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#c2410c' }}
                          >
                            Synk reiser
                          </Button>
                          {onOpenTeam ? (
                            <Button
                              variant="outlined"
                              endIcon={<ArrowForwardIcon />}
                              onClick={onOpenTeam}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne plan
                            </Button>
                          ) : null}
                        </Stack>
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Box>
          ) : null}

          {activeView === 'approvals' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  xl: 'minmax(0, 1.35fr) minmax(320px, 0.85fr)',
                },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Stack spacing={2}>
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${approvalsPriorityTone.border}`,
                    background: approvalsPriorityTone.background,
                  }}
                >
                  <Stack spacing={1.1}>
                    <Chip
                      size="small"
                      label="Gjør dette nå"
                      sx={{
                        alignSelf: 'flex-start',
                        bgcolor: approvalsPriorityTone.chipBackground,
                        color: approvalsPriorityTone.chipColor,
                      }}
                    />
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        {approvalsWorkspacePriority.title}
                      </Typography>
                      <Typography sx={{ color: 'rgba(226,232,240,0.76)', fontSize: '0.9rem', mt: 0.45 }}>
                        {approvalsWorkspacePriority.description}
                      </Typography>
                    </Box>
                    <Stack spacing={0.55}>
                      {approvalsWorkspacePriority.blockers.map((blocker) => (
                        <Typography key={blocker} sx={{ color: 'rgba(203,213,225,0.78)', fontSize: '0.82rem' }}>
                          • {blocker}
                        </Typography>
                      ))}
                    </Stack>
                    <Button
                      variant="contained"
                      onClick={handleApprovalsWorkspacePriorityAction}
                      disabled={
                        (approvalsWorkspacePriority.actionKey === 'compose-budget' && (!canSendBudgetReview || readOnly))
                        || (approvalsWorkspacePriority.actionKey === 'compose-deliverable' && readOnly)
                        || (approvalsWorkspacePriority.actionKey === 'compose-milestone' && readOnly)
                      }
                      sx={{
                        alignSelf: 'flex-start',
                        textTransform: 'none',
                        fontWeight: 700,
                        bgcolor: approvalsPriorityTone.button,
                        '&:hover': { bgcolor: approvalsPriorityTone.button },
                      }}
                    >
                      {approvalsWorkspacePriority.actionLabel}
                    </Button>
                  </Stack>
                </Box>

                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1.25 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Arbeidskø for økonomi og godkjenning
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem' }}>
                        Lukk saken som stopper prosjektet før du går videre til resten.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip
                        size="small"
                        label={`Krever handling ${approvalWorkQueue.filter((item) => item.review.status === 'changes_requested' || item.review.status === 'rejected').length}`}
                        sx={{ bgcolor: 'rgba(251,191,36,0.14)', color: '#fde68a' }}
                      />
                      <Chip
                        size="small"
                        label={`Venter ${approvalWorkQueue.filter((item) => item.review.status === 'pending').length}`}
                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                      />
                      <Chip
                        size="small"
                        label={`Signatur ${agreementSignatureSummary.inFlight} ute`}
                        sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }}
                      />
                    </Stack>
                  </Stack>
                  <Stack spacing={1}>
                    {approvalWorkQueue.length > 0 ? approvalWorkQueue.slice(0, 6).map((queueItem) => {
                      const linkedAgreement = getAgreementForReview(queueItem.review);
                      const signatureTone = linkedAgreement?.google_signature
                        ? getAgreementSignatureTone(linkedAgreement.google_signature)
                        : null;

                      return (
                        <Box
                          key={queueItem.review.id}
                          sx={{
                            p: 1.1,
                            borderRadius: 1.25,
                            border: queueItem.isStatusDriver
                              ? '1px solid rgba(251,191,36,0.42)'
                              : '1px solid rgba(148,163,184,0.14)',
                            background: queueItem.isStatusDriver
                              ? 'rgba(251,191,36,0.07)'
                              : 'rgba(15,23,42,0.58)',
                          }}
                        >
                          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between">
                            <Box>
                              <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 0.6 }}>
                                {queueItem.isStatusDriver ? (
                                  <Chip
                                    size="small"
                                    label={`Driver prosjektstatus · ${getProjectWorkflowStatusLabel(project.producerWorkflowStatus)}`}
                                    sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }}
                                  />
                                ) : null}
                                <Chip
                                  size="small"
                                  label={queueItem.laneLabel}
                                  sx={{ bgcolor: 'rgba(96,165,250,0.14)', color: '#dbeafe' }}
                                />
                                <Chip
                                  size="small"
                                  label={queueItem.focusedPhase === 'all' ? 'Alle faser' : PHASE_LABELS[queueItem.focusedPhase]}
                                  sx={{ bgcolor: 'rgba(45,212,191,0.14)', color: '#99f6e4' }}
                                />
                                <Chip
                                  size="small"
                                  label={getProducerReviewStatusLabel(queueItem.review.status)}
                                  sx={{ bgcolor: 'rgba(15,23,42,0.88)', color: '#f8fafc' }}
                                />
                                {linkedAgreement?.google_signature ? (
                                  <Chip
                                    size="small"
                                    label={`Signatur · ${getAgreementSignatureLabel(linkedAgreement.google_signature)}`}
                                    sx={{
                                      bgcolor: signatureTone?.background,
                                      color: signatureTone?.color,
                                    }}
                                  />
                                ) : null}
                              </Stack>
                              <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                {queueItem.review.title}
                              </Typography>
                              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.25 }}>
                                {getProducerReviewTypeLabel(queueItem.review.review_type)}
                                {queueItem.review.description ? ` · ${queueItem.review.description}` : ''}
                              </Typography>
                              {linkedAgreement?.google_signature ? (
                                <Typography
                                  sx={{
                                    color: signatureTone?.color ?? 'rgba(203,213,225,0.78)',
                                    fontSize: '0.82rem',
                                    mt: 0.35,
                                    fontWeight: 600,
                                  }}
                                >
                                  {linkedAgreement.google_signature.status === 'signed'
                                    ? 'Juridisk signatur er fullført.'
                                    : linkedAgreement.google_signature.status === 'changes_requested'
                                      ? 'Google-signatur krever endringer før avtalen kan lukkes.'
                                      : linkedAgreement.google_signature.status === 'rejected'
                                        ? 'Google-signatur er avvist og må avklares.'
                                        : 'Google-signatur pågår fortsatt for denne avtalen.'}
                                </Typography>
                              ) : null}
                              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.55 }}>
                                {formatDateTime(queueItem.review.requested_at) ? (
                                  <Typography sx={{ color: 'rgba(148,163,184,0.84)', fontSize: '0.78rem' }}>
                                    Sendt {formatDateTime(queueItem.review.requested_at)}
                                  </Typography>
                                ) : null}
                                {formatDateTime(queueItem.review.due_at) ? (
                                  <Typography sx={{ color: 'rgba(148,163,184,0.84)', fontSize: '0.78rem' }}>
                                    Frist {formatDateTime(queueItem.review.due_at)}
                                  </Typography>
                                ) : null}
                                <Typography sx={{ color: 'rgba(148,163,184,0.84)', fontSize: '0.78rem' }}>
                                  {queueItem.review.comments?.length ?? 0} kommentarer
                                </Typography>
                              </Stack>
                            </Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
                              {onOpenMedia && linkedAgreement ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => onOpenMedia(getAgreementMediaFocus(linkedAgreement))}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i klientflate
                                </Button>
                              ) : null}
                              {queueItem.lane !== 'deliverable' ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openBudgetWorkspaceFocus(queueItem.review)}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i budsjett og avtaler
                                </Button>
                              ) : null}
                              {onOpenReviews ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openReviewFocus(buildReviewFocusPayload(queueItem.review))}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i klientsamarbeid
                                </Button>
                              ) : null}
                              {onOpenTimeline ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openTimelineFocus({
                                    ...buildReviewFocusPayload(queueItem.review),
                                    linkedEntityType: 'client_review',
                                    linkedEntityId: queueItem.review.id,
                                  })}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i tidslinje
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    }) : (
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem' }}>
                        Ingen klientbeslutninger er opprettet ennå. Start med budsjettpakke, leveransegodkjenning eller klientavtale.
                      </Typography>
                    )}
                  </Stack>
                </Box>

                {!readOnly ? (
                  <Box
                    sx={{
                      borderRadius: 2,
                      border: '1px solid rgba(148,163,184,0.16)',
                      background: 'rgba(15,23,42,0.66)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box sx={{ px: 1.5, pt: 1.5, pb: 0.8 }}>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Opprett fra økonomi
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem', mt: 0.35 }}>
                        Hold bare én type beslutning åpen om gangen: leveranse, budsjettpakke eller milepæl.
                      </Typography>
                    </Box>
                    <Tabs
                      value={visibleApprovalComposerMode}
                      onChange={(_event, nextValue: ApprovalComposerMode) => setApprovalComposerMode(nextValue)}
                      variant="scrollable"
                      allowScrollButtonsMobile
                      sx={{
                        px: 1,
                        borderBottom: '1px solid rgba(148,163,184,0.14)',
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          color: 'rgba(203,213,225,0.74)',
                          fontWeight: 700,
                          minHeight: 42,
                        },
                        '& .Mui-selected': {
                          color: '#fff !important',
                        },
                      }}
                    >
                      <Tab value="deliverable" label="Leveranse" />
                      {canSendBudgetReview ? <Tab value="budget" label="Budsjettpakke" /> : null}
                      <Tab value="milestone" label="Milepæl" />
                    </Tabs>
                    <Box sx={{ p: 1.5 }}>
                      {visibleApprovalComposerMode === 'deliverable' ? (
                        <Stack spacing={1}>
                          <TextField
                            select
                            size="small"
                            label="Leveransetype"
                            value={selectedApprovalTemplate}
                            onChange={(event) => setSelectedApprovalTemplate(event.target.value as ProducerWorkflowApprovalTemplate)}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          >
                            {DELIVERABLE_APPROVAL_TEMPLATES.map((template) => (
                              <MenuItem key={template.key} value={template.key}>
                                {template.title}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Alert severity="info" sx={{ bgcolor: 'rgba(30,41,59,0.72)', color: '#dbeafe' }}>
                            {selectedApprovalTemplateConfig.description}
                          </Alert>
                          <TextField
                            size="small"
                            label="Tittel"
                            value={deliverableReviewTitle}
                            onChange={(event) => setDeliverableReviewTitle(event.target.value)}
                            disabled={isSubmittingDeliverableReview}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Hva skal klienten vurdere?"
                            value={deliverableReviewDescription}
                            onChange={(event) => setDeliverableReviewDescription(event.target.value)}
                            multiline
                            minRows={3}
                            disabled={isSubmittingDeliverableReview}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Svarfrist"
                            type="datetime-local"
                            value={deliverableReviewDueAt}
                            onChange={(event) => setDeliverableReviewDueAt(event.target.value)}
                            disabled={isSubmittingDeliverableReview}
                            InputLabelProps={{
                              shrink: true,
                              sx: { color: 'rgba(226,232,240,0.82)' },
                            }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Chip
                                size="small"
                                label={`Fokus ${focusedPhaseLabel}`}
                                sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                              />
                              <Chip
                                size="small"
                                label={`${selectedApprovalTemplateConfig.title} · ${deliverableReviews.filter((review) => review.review_type === selectedApprovalTemplate).length} sendt`}
                                sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(96,165,250,0.14)', color: '#dbeafe' }}
                              />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              {onOpenDeliverableSource ? (
                                <Button
                                  variant="outlined"
                                  onClick={() => onOpenDeliverableSource(selectedApprovalTemplate)}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne kilde
                                </Button>
                              ) : null}
                              <Button
                                variant="contained"
                                startIcon={<FactCheckIcon />}
                                onClick={() => { void handleCreateDeliverableReview(); }}
                                disabled={isSubmittingDeliverableReview}
                                sx={{
                                  textTransform: 'none',
                                  fontWeight: 700,
                                  bgcolor: '#2563eb',
                                  '&:hover': { bgcolor: '#1d4ed8' },
                                }}
                              >
                                Opprett klientgodkjenning
                              </Button>
                            </Stack>
                          </Stack>
                        </Stack>
                      ) : null}

                      {visibleApprovalComposerMode === 'budget' && canSendBudgetReview ? (
                        <Stack spacing={1}>
                          <Alert severity="info" sx={{ bgcolor: 'rgba(30,41,59,0.72)', color: '#fef3c7' }}>
                            Samle budsjettlinjer, avtaler og fasevalg i én pakke før du sender den videre til klientgodkjenning.
                          </Alert>
                          <TextField
                            size="small"
                            label="Pakketittel"
                            value={budgetReviewTitle}
                            onChange={(event) => setBudgetReviewTitle(event.target.value)}
                            disabled={isSubmittingBudgetReview}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Hva skal klienten ta stilling til?"
                            value={budgetReviewDescription}
                            onChange={(event) => setBudgetReviewDescription(event.target.value)}
                            multiline
                            minRows={3}
                            disabled={isSubmittingBudgetReview}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Svarfrist"
                            type="datetime-local"
                            value={budgetReviewDueAt}
                            onChange={(event) => setBudgetReviewDueAt(event.target.value)}
                            disabled={isSubmittingBudgetReview}
                            InputLabelProps={{
                              shrink: true,
                              sx: { color: 'rgba(226,232,240,0.82)' },
                            }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                            <Chip
                              size="small"
                              label={`Fokus ${focusedPhaseLabel}`}
                              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(59,130,246,0.16)', color: '#bfdbfe' }}
                            />
                            <Button
                              variant="contained"
                              startIcon={<FactCheckIcon />}
                              onClick={() => { void handleCreateBudgetReview(); }}
                              disabled={isSubmittingBudgetReview}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#fbbf24',
                                color: '#111827',
                                '&:hover': { bgcolor: '#f59e0b' },
                              }}
                            >
                              Opprett og send budsjettpakke
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}

                      {visibleApprovalComposerMode === 'milestone' ? (
                        <Stack spacing={1}>
                          <Alert severity="info" sx={{ bgcolor: 'rgba(30,41,59,0.72)', color: '#99f6e4' }}>
                            Legg inn neste beslutningspunkt eller leveranse direkte i økonomiflyten, så blir den synlig i prosjektets tidslinje.
                          </Alert>
                          <TextField
                            size="small"
                            label="Milepæltittel"
                            value={budgetMilestoneTitle}
                            onChange={(event) => setBudgetMilestoneTitle(event.target.value)}
                            disabled={isCreatingBudgetMilestone}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Hva skal være ferdig?"
                            value={budgetMilestoneDescription}
                            onChange={(event) => setBudgetMilestoneDescription(event.target.value)}
                            multiline
                            minRows={3}
                            disabled={isCreatingBudgetMilestone}
                            InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                          />
                          <TextField
                            size="small"
                            label="Milepælfrist"
                            type="datetime-local"
                            value={budgetMilestoneDueAt}
                            onChange={(event) => setBudgetMilestoneDueAt(event.target.value)}
                            disabled={isCreatingBudgetMilestone}
                            InputLabelProps={{
                              shrink: true,
                              sx: { color: 'rgba(226,232,240,0.82)' },
                            }}
                          />
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                            <Chip
                              size="small"
                              label={`Plasseres i ${focusedPhase === 'all' ? PHASE_LABELS.preproduction : focusedPhaseLabel}`}
                              sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }}
                            />
                            <Button
                              variant="contained"
                              startIcon={<FactCheckIcon />}
                              onClick={() => { void handleCreateBudgetMilestone(); }}
                              disabled={isCreatingBudgetMilestone}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#0f766e',
                                '&:hover': { bgcolor: '#0d5f59' },
                              }}
                            >
                              Legg til milepæl
                            </Button>
                          </Stack>
                        </Stack>
                      ) : null}
                    </Box>
                  </Box>
                ) : null}

                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1.25 }}>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                        Aktive beslutninger og historikk
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.86rem' }}>
                        Alt som allerede er sendt eller venter på svar samles her, uten at nye skjemaer ligger åpne samtidig.
                      </Typography>
                    </Box>
                    {onOpenReviews ? (
                      <Button
                        variant="outlined"
                        endIcon={<ArrowForwardIcon />}
                        onClick={() => openReviewFocus()}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Åpne klientsamarbeid
                      </Button>
                    ) : null}
                  </Stack>
                  <Stack spacing={1}>
                    {deliverableReviews.length > 0 ? (
                      <>
                        <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                          Leveransegodkjenninger
                        </Typography>
                        {deliverableReviews.map((review) => (
                          <Box
                            key={review.id}
                            sx={{
                              p: 1.15,
                              borderRadius: 1.5,
                              border: '1px solid rgba(148,163,184,0.16)',
                              background: 'rgba(2,6,23,0.54)',
                            }}
                          >
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                              <Box>
                                <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                  {review.title}
                                </Typography>
                                <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                  {getProducerReviewTypeLabel(review.review_type)}
                                </Typography>
                                {review.description ? (
                                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                    {review.description}
                                  </Typography>
                                ) : null}
                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.6 }}>
                                  {formatDateTime(review.requested_at) ? (
                                    <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                      Sendt {formatDateTime(review.requested_at)}
                                    </Typography>
                                  ) : null}
                                  <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                    {review.comments?.length ?? 0} kommentarer
                                  </Typography>
                                </Stack>
                              </Box>
                              <Chip size="small" label={getProducerReviewStatusLabel(review.status)} sx={{ alignSelf: 'flex-start' }} />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                              {onOpenDeliverableSource ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    if (DELIVERABLE_APPROVAL_TYPE_SET.has(review.review_type as ProducerWorkflowApprovalTemplate)) {
                                      onOpenDeliverableSource(review.review_type as ProducerWorkflowApprovalTemplate);
                                    }
                                  }}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne kilde
                                </Button>
                              ) : null}
                              {onOpenReviews ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openReviewFocus({
                                    reviewId: review.id,
                                    linkedEntityType: review.target_entity_type ?? undefined,
                                    linkedEntityId: review.target_entity_id ?? undefined,
                                    approvalTemplate: DELIVERABLE_APPROVAL_TYPE_SET.has(review.review_type as ProducerWorkflowApprovalTemplate)
                                      ? review.review_type as ProducerWorkflowApprovalTemplate
                                      : undefined,
                                  })}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i klientsamarbeid
                                </Button>
                              ) : null}
                              {onOpenTimeline ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => openTimelineFocus({
                                    reviewId: review.id,
                                    linkedEntityType: 'client_review',
                                    linkedEntityId: review.id,
                                    approvalTemplate: DELIVERABLE_APPROVAL_TYPE_SET.has(review.review_type as ProducerWorkflowApprovalTemplate)
                                      ? review.review_type as ProducerWorkflowApprovalTemplate
                                      : undefined,
                                  })}
                                  sx={{ textTransform: 'none', fontWeight: 700 }}
                                >
                                  Åpne i tidslinje
                                </Button>
                              ) : null}
                            </Stack>
                          </Box>
                        ))}
                      </>
                    ) : null}
                    {budgetReviews.map((review) => (
                      <Box
                        key={review.id}
                        sx={{
                          p: 1.15,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.16)',
                          background: 'rgba(2,6,23,0.54)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                          <Box>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {review.title}
                            </Typography>
                            {review.description ? (
                              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                {review.description}
                              </Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.6 }}>
                              {formatDateTime(review.requested_at) ? (
                                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                  Sendt {formatDateTime(review.requested_at)}
                                </Typography>
                              ) : null}
                              <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                {review.comments?.length ?? 0} kommentarer
                              </Typography>
                            </Stack>
                          </Box>
                          <Chip size="small" label={getProducerReviewStatusLabel(review.status)} sx={{ alignSelf: 'flex-start' }} />
                        </Stack>
                        {(onOpenReviews || onOpenTimeline) ? (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                            {onOpenReviews ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openReviewFocus({
                                  reviewId: review.id,
                                  linkedEntityType: review.target_entity_type ?? undefined,
                                  linkedEntityId: review.target_entity_id ?? undefined,
                                })}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Åpne i klientsamarbeid
                              </Button>
                            ) : null}
                            {onOpenTimeline ? (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => openTimelineFocus({
                                  reviewId: review.id,
                                  linkedEntityType: 'client_review',
                                  linkedEntityId: review.id,
                                })}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                              >
                                Åpne i tidslinje
                              </Button>
                            ) : null}
                          </Stack>
                        ) : null}
                      </Box>
                    ))}
                    {budgetReviews.length === 0 ? (
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem' }}>
                        Ingen budsjettpakker er sendt ennå.
                      </Typography>
                    ) : null}
                    {agreementReviews.length > 0 ? (
                      <>
                        <Typography sx={{ color: '#fff', fontWeight: 800, mt: 1 }}>
                          Endringsordre og klientgodkjenning
                        </Typography>
                        {agreementReviews.map((review) => {
                          const linkedAgreement = getAgreementForReview(review);
                          const signatureTone = linkedAgreement?.google_signature
                            ? getAgreementSignatureTone(linkedAgreement.google_signature)
                            : null;

                          return (
                            <Box
                              key={review.id}
                              sx={{
                                p: 1.15,
                                borderRadius: 1.5,
                                border: '1px solid rgba(148,163,184,0.16)',
                                background: 'rgba(2,6,23,0.54)',
                              }}
                            >
                              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                                <Box>
                                  <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                    {review.title}
                                  </Typography>
                                  <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                    {getProducerReviewTypeLabel(review.review_type)}
                                  </Typography>
                                  {linkedAgreement ? (
                                    <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.55 }}>
                                      <Chip
                                        size="small"
                                        label={`Avtale ${linkedAgreement.title}`}
                                        sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }}
                                      />
                                      <Chip
                                        size="small"
                                        label={`Status ${PROJECT_AGREEMENT_STATUS_LABELS[linkedAgreement.status]}`}
                                        sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                      />
                                      {linkedAgreement.google_signature ? (
                                        <Chip
                                          size="small"
                                          label={`Juridisk signatur · ${getAgreementSignatureLabel(linkedAgreement.google_signature)}`}
                                          sx={{
                                            bgcolor: signatureTone?.background,
                                            color: signatureTone?.color,
                                          }}
                                        />
                                      ) : null}
                                    </Stack>
                                  ) : null}
                                  {review.description ? (
                                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                      {review.description}
                                    </Typography>
                                  ) : null}
                                  {linkedAgreement?.google_signature ? (
                                    <Typography
                                      sx={{
                                        color: signatureTone?.color ?? 'rgba(203,213,225,0.78)',
                                        fontSize: '0.82rem',
                                        mt: 0.35,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {linkedAgreement.google_signature.status === 'signed'
                                        ? 'Juridisk signatur er fullført og avtalen kan brukes som endelig grunnlag.'
                                        : linkedAgreement.google_signature.status === 'changes_requested'
                                          ? 'Juridisk signatur krever endringer før avtalen kan lukkes.'
                                          : linkedAgreement.google_signature.status === 'rejected'
                                            ? 'Juridisk signatur er avvist og må løses før videre prosjektsteg.'
                                            : 'Juridisk signatur pågår fortsatt for denne avtalen.'}
                                    </Typography>
                                  ) : null}
                                  <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.6 }}>
                                    {formatDateTime(review.requested_at) ? (
                                      <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                        Sendt {formatDateTime(review.requested_at)}
                                      </Typography>
                                    ) : null}
                                    <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                      {review.comments?.length ?? 0} kommentarer
                                    </Typography>
                                  </Stack>
                                </Box>
                                <Chip size="small" label={getProducerReviewStatusLabel(review.status)} sx={{ alignSelf: 'flex-start' }} />
                              </Stack>
                              {(onOpenReviews || onOpenTimeline) ? (
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                                  {onOpenReviews ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => openReviewFocus({
                                        reviewId: review.id,
                                        linkedEntityType: review.target_entity_type ?? undefined,
                                        linkedEntityId: review.target_entity_id ?? undefined,
                                        agreementId: review.target_entity_type === 'project_agreement'
                                          ? review.target_entity_id ?? undefined
                                          : undefined,
                                      })}
                                      sx={{ textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Åpne i klientsamarbeid
                                    </Button>
                                  ) : null}
                                  {onOpenTimeline ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => openTimelineFocus({
                                        reviewId: review.id,
                                        linkedEntityType: 'client_review',
                                        linkedEntityId: review.id,
                                        agreementId: review.target_entity_type === 'project_agreement'
                                          ? review.target_entity_id ?? undefined
                                          : undefined,
                                      })}
                                      sx={{ textTransform: 'none', fontWeight: 700 }}
                                    >
                                      Åpne i tidslinje
                                    </Button>
                                  ) : null}
                                </Stack>
                              ) : null}
                            </Box>
                          );
                        })}
                      </>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>

              <Stack
                spacing={2}
                sx={{
                  position: { xl: 'sticky' },
                  top: { xl: 20 },
                }}
              >
                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                    Statusdriver akkurat nå
                  </Typography>
                  {statusTouchpoint ? (
                    <Stack spacing={1}>
                      <Box
                        sx={{
                          p: 1.15,
                          borderRadius: 1.5,
                          border: '1px solid rgba(251,191,36,0.28)',
                          background: 'rgba(251,191,36,0.07)',
                        }}
                      >
                        <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                          {statusTouchpoint.title}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.35 }}>
                          {projectWorkflowDetail}
                        </Typography>
                        <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.8 }}>
                          <Chip
                            size="small"
                            label={getProducerReviewStatusLabel(statusTouchpoint.status)}
                            sx={{ bgcolor: 'rgba(15,23,42,0.88)', color: '#f8fafc' }}
                          />
                          {statusTouchpointAgreement?.google_signature ? (
                            <Chip
                              size="small"
                              label={`Signatur · ${getAgreementSignatureLabel(statusTouchpointAgreement.google_signature)}`}
                              sx={{
                                bgcolor: getAgreementSignatureTone(statusTouchpointAgreement.google_signature).background,
                                color: getAgreementSignatureTone(statusTouchpointAgreement.google_signature).color,
                              }}
                            />
                          ) : null}
                        </Stack>
                      </Box>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        {onOpenReviews ? (
                          <Button
                            variant="outlined"
                            onClick={() => openReviewFocus(buildReviewFocusPayload(statusTouchpoint))}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Åpne i klientsamarbeid
                          </Button>
                        ) : null}
                        {onOpenTimeline ? (
                          <Button
                            variant="outlined"
                            onClick={() => openTimelineFocus({
                              ...buildReviewFocusPayload(statusTouchpoint),
                              linkedEntityType: 'client_review',
                              linkedEntityId: statusTouchpoint.id,
                            })}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Åpne i tidslinje
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  ) : (
                    <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem' }}>
                      Ingen enkeltsak driver prosjektstatus akkurat nå. Nye godkjenninger og milepæler vil dukke opp her når de blir viktige.
                    </Typography>
                  )}
                </Box>

                <Box sx={{ p: 1.5, borderRadius: 2, border: '1px solid rgba(148,163,184,0.16)', background: 'rgba(15,23,42,0.66)' }}>
                  <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 800 }}>
                      Økonomimilepæler
                    </Typography>
                    <Chip
                      size="small"
                      label={`${budgetTimelineItems.length} punkter`}
                      sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#99f6e4' }}
                    />
                  </Stack>
                  <Stack spacing={1}>
                    {budgetTimelineItems.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          p: 1.1,
                          borderRadius: 1.5,
                          border: '1px solid rgba(148,163,184,0.14)',
                          background: 'rgba(2,6,23,0.54)',
                        }}
                      >
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
                          <Box>
                            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {item.title}
                            </Typography>
                            {item.description ? (
                              <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.84rem', mt: 0.3 }}>
                                {item.description}
                              </Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 0.55 }}>
                              {formatDateTime(item.due_at) ? (
                                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                  Frist {formatDateTime(item.due_at)}
                                </Typography>
                              ) : null}
                              {formatProducerTimestamp(Number(asRecord(item.metadata)?.timestampSeconds)) ? (
                                <Typography sx={{ color: 'rgba(203,213,225,0.68)', fontSize: '0.78rem' }}>
                                  Tidskode {formatProducerTimestamp(Number(asRecord(item.metadata)?.timestampSeconds))}
                                </Typography>
                              ) : null}
                            </Stack>
                          </Box>
                          <Chip size="small" label={getProducerTimelineStatusLabel(item.status)} sx={{ alignSelf: 'flex-start' }} />
                        </Stack>
                        {onOpenTimeline ? (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => openTimelineFocus({
                                timelineItemId: item.id,
                                linkedEntityType: item.linked_entity_type ?? undefined,
                                linkedEntityId: item.linked_entity_id ?? undefined,
                              })}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne i tidslinje
                            </Button>
                          </Stack>
                        ) : null}
                      </Box>
                    ))}
                    {budgetTimelineItems.length === 0 ? (
                      <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.9rem' }}>
                        Ingen økonomimilepæler er koblet til prosjektet ennå.
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
              </Stack>
            </Box>
          ) : null}
        </Box>
      </Box>
    </Stack>
  );
}
