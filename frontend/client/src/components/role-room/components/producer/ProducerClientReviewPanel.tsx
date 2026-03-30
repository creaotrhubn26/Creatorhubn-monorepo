import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  ListSubheader,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  RateReview as RateReviewIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type {
  CastingProject,
  ProducerAccountAccessPlatform,
  ProducerBrandLogoVariantSelection,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerProjectPlanning,
  RoleRoomGoogleAgreementSignatureStatus,
  ProducerWorkflowProjectMeta,
  ProducerWorkflowProjectStatus,
} from '../../models/casting';
import { useProducerReviews } from '../../hooks/useProducerReviews';
import {
  getProducerOperationalReviews,
  isClientGroundingManagedReview,
  producerWorkflowService,
  type ProducerClientReview,
  type ProducerReviewDecision,
} from '../../services/producerWorkflowService';
import {
  projectAgreementsApi,
  type ProjectAgreement,
} from '../../services/castingApiService';
import castingService from '../../services/castingService';
import {
  emitProjectAgreementEvent,
  onProjectAgreementEvent,
} from '../../services/projectAgreementEvents';
import { onProducerWorkflowEvent } from '../../services/producerWorkflowEvents';
import {
  onProducerWorkflowFocusEvent,
  type ProducerWorkflowApprovalTemplate,
  type ProducerWorkflowFocusPayload,
} from '../../services/producerWorkflowFocusEvents';
import settingsService from '../../services/settingsService';
import { shouldUseRoleRoomLocalFallback } from '../../utils/runtime';
import {
  buildAgreementTimelinePayload,
  getAgreementStatusFromReviewDecision,
  isAgreementTimelineItem,
} from '../../utils/projectAgreementWorkflow';
import {
  formatProducerTimestamp,
  getProducerEntityTypeLabel,
  getProducerReviewStatusLabel,
  getProducerReviewTypeLabel,
  makeProducerPackageEntityId,
  PRODUCER_REVIEW_TYPE_OPTIONS,
  type ProducerWorkflowEntityOption,
} from '../../utils/producerWorkflow';
import {
  getAgreementSignatureLabel,
  getAgreementSignatureTone,
  getAgreementTypeLabel,
  getAgreementWorkspaceArtifactId,
  PROJECT_AGREEMENT_COUNTERPARTY_LABELS,
  PROJECT_AGREEMENT_STATUS_LABELS,
} from '../../utils/projectAgreements';
import {
  getProducerAccountAccessPlatformFromMomentId,
  getProducerContentLogicMomentKind,
  getProducerClientContributionTasks,
  PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS,
  PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS,
  PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS,
  PRODUCER_BRAND_LOGO_VARIANT_LABELS,
  getProducerWorkspaceLocationForSurface,
  getProducerWorkspaceSurfaceForContributionSource,
  resolveProducerBrandLogoVariant,
  getProducerStrategySnapshot,
  mergeProducerPlanningClientMomentsWithReviews,
  PRODUCER_CONTENT_LOGIC_MOMENT_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS,
  PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS,
  PRODUCER_PLANNING_CLIENT_MOMENT_LABELS,
  normalizeProducerProjectPlanning,
} from '../../utils/producerProjectPlanning';
import { buildClientPortalUrl, type ClientPortalWorkspaceFocus } from '../../utils/clientPortal';

interface ProducerClientReviewPanelProps {
  projectId: string;
  projectName?: string;
  project?: CastingProject | null;
  projectWorkflowStatus?: ProducerWorkflowProjectStatus;
  projectWorkflowMeta?: ProducerWorkflowProjectMeta;
  canEdit?: boolean;
  canComment?: boolean;
  canDecide?: boolean;
  canApproveReview?: boolean;
  canRequestReviewChanges?: boolean;
  entityOptions?: ProducerWorkflowEntityOption[];
  initialReviewId?: string;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
  onOpenEconomy?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenTimeline?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
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

const CLIENT_MATERIAL_TYPE_LABELS: Record<ProducerClientMaterialType, string> = {
  brief_note: 'Briefnotat',
  asset_link: 'Lenke',
  brand_asset: 'Merkevarefil',
  reference: 'Referanse',
  document: 'Dokument',
  feedback: 'Tilbakemelding',
};

const DECISION_OPTIONS: Array<{ value: ProducerReviewDecision; label: string; color: string }> = [
  { value: 'approved', label: 'Godkjenn', color: '#34d399' },
  { value: 'rejected', label: 'Avslå', color: '#f87171' },
  { value: 'changes_requested', label: 'Be om endringer', color: '#fbbf24' },
];

const ECONOMY_MANAGED_REVIEW_TYPES = new Set([
  'storyboard',
  'manuscript',
  'shotlist',
  'budget_package',
  'client_approval',
  'change_order',
]);
const DEFAULT_COLLABORATION_REVIEW_TYPE = 'scene_notes';
const EMPTY_ENTITY_OPTIONS: ProducerWorkflowEntityOption[] = [];
const LOCAL_PROJECT_AGREEMENTS_NAMESPACE = 'role-room-project-agreements';
const COLLABORATION_REVIEW_TYPE_OPTIONS = PRODUCER_REVIEW_TYPE_OPTIONS.filter(
  (option) => !ECONOMY_MANAGED_REVIEW_TYPES.has(option.value),
);
const ECONOMY_REVIEW_TYPE_OPTIONS = PRODUCER_REVIEW_TYPE_OPTIONS.filter(
  (option) => ECONOMY_MANAGED_REVIEW_TYPES.has(option.value),
);
const PROJECT_WORKFLOW_STATUS_LABELS: Record<ProducerWorkflowProjectStatus, string> = {
  planning: 'Planlegging',
  awaiting_client: 'Venter på klient',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
};
const PROJECT_WORKFLOW_STATUS_COLORS: Record<ProducerWorkflowProjectStatus, { color: string; background: string; border: string }> = {
  planning: {
    color: '#cbd5e1',
    background: 'rgba(148,163,184,0.14)',
    border: 'rgba(148,163,184,0.38)',
  },
  awaiting_client: {
    color: '#bfdbfe',
    background: 'rgba(59,130,246,0.14)',
    border: 'rgba(96,165,250,0.4)',
  },
  changes_requested: {
    color: '#fde68a',
    background: 'rgba(251,191,36,0.16)',
    border: 'rgba(251,191,36,0.45)',
  },
  approved: {
    color: '#86efac',
    background: 'rgba(16,185,129,0.16)',
    border: 'rgba(52,211,153,0.45)',
  },
};
const DELIVERY_LOGO_SELECTION_OPTIONS: Array<{ value: ProducerBrandLogoVariantSelection; label: string }> = [
  { value: 'auto', label: 'Bruk anbefalt variant' },
  { value: 'primary', label: `Tving ${PRODUCER_BRAND_LOGO_VARIANT_LABELS.primary}` },
  { value: 'light', label: `Tving ${PRODUCER_BRAND_LOGO_VARIANT_LABELS.light}` },
  { value: 'dark', label: `Tving ${PRODUCER_BRAND_LOGO_VARIANT_LABELS.dark}` },
  { value: 'icon', label: `Tving ${PRODUCER_BRAND_LOGO_VARIANT_LABELS.icon}` },
];

const asRecord = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const formatReviewEventDateTime = (value?: string | null): string | null => {
  if (!value) {
    return null;
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

function getDefaultTargetEntityType(reviewType: string): string {
  return PRODUCER_REVIEW_TYPE_OPTIONS.find((option) => option.value === reviewType)?.defaultTargetEntityType ?? '';
}

function readPlanningMomentIdFromReview(review: ProducerClientReview): string | null {
  const metadata = asRecord(review.metadata);
  const planningMomentId = readFirstNonEmptyString(metadata.planningMomentId, review.target_entity_id);
  return planningMomentId || null;
}

function readLinkedDeliveryIdsFromReview(review: ProducerClientReview): string[] {
  const metadata = asRecord(review.metadata);
  const candidateArrays = [
    metadata.deliveryItemIds,
    metadata.contentCalendarItemIds,
    metadata.linkedDeliveryIds,
  ];
  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      return candidate
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());
    }
  }
  const planningMomentId = readPlanningMomentIdFromReview(review);
  if (planningMomentId?.startsWith('content:')) {
    return [planningMomentId.replace(/^content:/, '').trim()].filter((value) => value.length > 0);
  }
  return [];
}

function normalizeAccountAccessPlatform(value: unknown): ProducerAccountAccessPlatform | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized in PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS) {
    return normalized as ProducerAccountAccessPlatform;
  }
  return null;
}

function readAccountAccessPlatformsFromReview(review: ProducerClientReview): ProducerAccountAccessPlatform[] {
  const metadata = asRecord(review.metadata);
  const platforms = new Set<ProducerAccountAccessPlatform>();
  const candidateArrays = [
    metadata.accountAccessPlatforms,
    metadata.account_access_platforms,
  ];

  for (const candidate of candidateArrays) {
    if (!Array.isArray(candidate)) {
      continue;
    }
    candidate.forEach((value) => {
      const platform = normalizeAccountAccessPlatform(value);
      if (platform) {
        platforms.add(platform);
      }
    });
  }

  const directPlatform = normalizeAccountAccessPlatform(
    readFirstNonEmptyString(metadata.accountAccessPlatform, metadata.account_access_platform),
  );
  if (directPlatform) {
    platforms.add(directPlatform);
  }

  const fromMomentId = getProducerAccountAccessPlatformFromMomentId(readPlanningMomentIdFromReview(review));
  if (fromMomentId) {
    platforms.add(fromMomentId);
  }

  return Array.from(platforms);
}

function normalizeApprovalTemplate(reviewType?: string | null): ProducerWorkflowApprovalTemplate | undefined {
  if (reviewType === 'storyboard' || reviewType === 'manuscript' || reviewType === 'shotlist') {
    return reviewType;
  }
  return undefined;
}

function isResolvedClientGroundingReview(review: ProducerClientReview): boolean {
  return isClientGroundingManagedReview(review) && review.status === 'approved';
}

function getGoogleSignatureStatusFromDecision(
  decision: ProducerReviewDecision,
): RoleRoomGoogleAgreementSignatureStatus {
  if (decision === 'approved') {
    return 'signed';
  }
  if (decision === 'changes_requested') {
    return 'changes_requested';
  }
  return 'rejected';
}

function getContentLogicMomentKindForReview(review: ProducerClientReview): ReturnType<typeof getProducerContentLogicMomentKind> {
  const metadata = asRecord(review.metadata);
  const planningMomentId = readFirstNonEmptyString(metadata.planningMomentId, review.target_entity_id);
  return getProducerContentLogicMomentKind(planningMomentId);
}

function getAccountAccessPlatformsForReview(review: ProducerClientReview): ProducerAccountAccessPlatform[] {
  return readAccountAccessPlatformsFromReview(review);
}

function getDecisionCopyForReview(review: ProducerClientReview): {
  labels: Record<ProducerReviewDecision, string>;
  placeholder: string;
  helper: string | null;
} {
  if (getAccountAccessPlatformsForReview(review).length > 0) {
    return {
      labels: {
        approved: 'Bekreft kontotilgang',
        changes_requested: 'Be om ny tilgang',
        rejected: 'Avvis tilgangsoppsett',
      },
      placeholder: 'Hva mangler for at tilgang eller invitasjon kan fullføres? (valgfritt)',
      helper: 'Denne beslutningen gjelder sikker tilgang til publiseringskontoer uten delte passord eller 2-faktor-koder.',
    };
  }
  const contentLogicMomentKind = getContentLogicMomentKindForReview(review);
  if (contentLogicMomentKind === 'hook') {
    return {
      labels: {
        approved: 'Godkjenn hook',
        changes_requested: 'Be om ny hook',
        rejected: 'Avvis hook',
      },
      placeholder: 'Hva må endres i hooken? (valgfritt)',
      helper: 'Denne beslutningen gjelder åpningsgrepet og hvordan innholdet skal fange oppmerksomheten.',
    };
  }
  if (contentLogicMomentKind === 'cta') {
    return {
      labels: {
        approved: 'Godkjenn CTA',
        changes_requested: 'Be om ny CTA',
        rejected: 'Avvis CTA',
      },
      placeholder: 'Hva må endres i CTA eller distribusjon? (valgfritt)',
      helper: 'Denne beslutningen gjelder hva publikum skal gjøre videre og hvordan innholdet leder dit.',
    };
  }
  if (contentLogicMomentKind === 'proof') {
    return {
      labels: {
        approved: 'Godkjenn bevis',
        changes_requested: 'Be om nye bevis',
        rejected: 'Avvis bevis',
      },
      placeholder: 'Hva mangler i bevisene eller argumentasjonen? (valgfritt)',
      helper: 'Denne beslutningen gjelder hvilke argumenter, fakta eller eksempler som må støtte budskapet.',
    };
  }
  return {
    labels: {
      approved: 'Godkjenn',
      changes_requested: 'Be om endringer',
      rejected: 'Avslå',
    },
    placeholder: 'Beslutningsnotat (valgfritt)',
    helper: null,
  };
}

function getReviewClientInviteActionLabel(
  contentLogicMomentKind: ReturnType<typeof getProducerContentLogicMomentKind>,
  review?: ProducerClientReview,
): string {
  if (review && getAccountAccessPlatformsForReview(review).length > 0) {
    return 'Bekreft kontotilgang';
  }
  if (contentLogicMomentKind === 'hook') {
    return 'Ta stilling til hooken';
  }
  if (contentLogicMomentKind === 'cta') {
    return 'Ta stilling til CTA og neste handling';
  }
  if (contentLogicMomentKind === 'proof') {
    return 'Ta stilling til bevis og argumentasjon';
  }
  return 'Gå gjennom saken';
}

function buildReviewClientInviteEmailSubject(
  projectName: string,
  review: ProducerClientReview,
): string {
  const accountAccessPlatforms = getAccountAccessPlatformsForReview(review);
  if (accountAccessPlatforms.length > 0) {
    return `${projectName} · Kontotilgang · ${accountAccessPlatforms.map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform]).join(' / ')}`;
  }
  const contentLogicMomentKind = getContentLogicMomentKindForReview(review);
  if (contentLogicMomentKind) {
    return `${projectName} · Content Logic · ${PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]}`;
  }
  return `${projectName} · Klientreview · ${review.title}`;
}

export default function ProducerClientReviewPanel({
  projectId,
  projectName = 'Prosjekt',
  project = null,
  projectWorkflowStatus = 'planning',
  projectWorkflowMeta,
  canEdit = true,
  canComment = true,
  canDecide = true,
  canApproveReview = false,
  canRequestReviewChanges = false,
  entityOptions = EMPTY_ENTITY_OPTIONS,
  initialReviewId,
  onOpenMedia,
  onOpenEconomy,
  onOpenTimeline,
}: ProducerClientReviewPanelProps) {
  const { enqueueSnackbar } = useSnackbar();
  const { items, summary, loading, error, createReview, addComment, setDecision } = useProducerReviews(projectId);
  const [agreementsById, setAgreementsById] = useState<Record<string, ProjectAgreement>>({});
  const [clientIntake, setClientIntake] = useState<ProducerClientIntake>(EMPTY_CLIENT_INTAKE);
  const [clientMaterials, setClientMaterials] = useState<ProducerClientMaterial[]>([]);
  const [clientInputLoading, setClientInputLoading] = useState(false);
  const [clientInputError, setClientInputError] = useState<string | null>(null);
  const reviewRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const initialReviewFocusRef = useRef<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState(DEFAULT_COLLABORATION_REVIEW_TYPE);
  const [newDescription, setNewDescription] = useState('');
  const [newDueAt, setNewDueAt] = useState('');
  const [newTargetEntityType, setNewTargetEntityType] = useState(getDefaultTargetEntityType(DEFAULT_COLLABORATION_REVIEW_TYPE));
  const [newTargetEntityId, setNewTargetEntityId] = useState('');
  const [commentDraftByReview, setCommentDraftByReview] = useState<Record<string, string>>({});
  const [commentTimestampByReview, setCommentTimestampByReview] = useState<Record<string, string>>({});
  const [expandedCommentsByReview, setExpandedCommentsByReview] = useState<Record<string, boolean>>({});
  const [decisionReasonByReview, setDecisionReasonByReview] = useState<Record<string, string>>({});
  const [decisionTimestampByReview, setDecisionTimestampByReview] = useState<Record<string, string>>({});
  const [deliveryLogoSelectionByDeliveryId, setDeliveryLogoSelectionByDeliveryId] = useState<Record<string, ProducerBrandLogoVariantSelection>>({});
  const [savingDeliveryLogoById, setSavingDeliveryLogoById] = useState<Record<string, boolean>>({});
  const [pendingFocus, setPendingFocus] = useState<ProducerWorkflowFocusPayload | null>(null);
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(null);
  const useLocalFallback = shouldUseRoleRoomLocalFallback();
  const isEconomyManagedDraftType = ECONOMY_MANAGED_REVIEW_TYPES.has(newType);
  const selectedApprovalTemplate = normalizeApprovalTemplate(newType);
  const canAdjustDeliveryLogoSelection = canEdit || canDecide;

  const distinctEntityTypes = useMemo(() => {
    const seen = new Set<string>();
    return entityOptions.filter((option) => {
      if (!option.entityType || seen.has(option.entityType)) {
        return false;
      }
      seen.add(option.entityType);
      return true;
    });
  }, [entityOptions]);

  const filteredEntityOptions = useMemo(() => {
    if (!newTargetEntityType) {
      return entityOptions;
    }
    return entityOptions.filter((option) => option.entityType === newTargetEntityType);
  }, [entityOptions, newTargetEntityType]);

  const decisionOptions = useMemo(() => {
    return DECISION_OPTIONS.filter((option) => {
      if (option.value === 'changes_requested') {
        return canRequestReviewChanges;
      }
      return canApproveReview;
    });
  }, [canApproveReview, canRequestReviewChanges]);
  const projectStatusLabel = PROJECT_WORKFLOW_STATUS_LABELS[projectWorkflowStatus] ?? PROJECT_WORKFLOW_STATUS_LABELS.planning;
  const projectStatusColors = PROJECT_WORKFLOW_STATUS_COLORS[projectWorkflowStatus] ?? PROJECT_WORKFLOW_STATUS_COLORS.planning;
  const producerPlanning = useMemo(
    () => (project ? normalizeProducerProjectPlanning(project) : null),
    [project],
  );
  useEffect(() => {
    if (!producerPlanning) {
      setDeliveryLogoSelectionByDeliveryId({});
      return;
    }
    setDeliveryLogoSelectionByDeliveryId(
      producerPlanning.contentCalendar.reduce<Record<string, ProducerBrandLogoVariantSelection>>((accumulator, item) => {
        accumulator[item.id] = item.logoVariantSelection ?? 'auto';
        return accumulator;
      }, {}),
    );
  }, [producerPlanning]);
  const producerPlanningWithLocalLogoSelections = useMemo<ProducerProjectPlanning | null>(() => {
    if (!producerPlanning) {
      return null;
    }
    return {
      ...producerPlanning,
      contentCalendar: producerPlanning.contentCalendar.map((item) => ({
        ...item,
        logoVariantSelection: deliveryLogoSelectionByDeliveryId[item.id] ?? item.logoVariantSelection ?? 'auto',
      })),
    };
  }, [deliveryLogoSelectionByDeliveryId, producerPlanning]);
  const deliveryItemsByPlanningMomentId = useMemo(() => {
    const lookup = new Map<string, ProducerProjectPlanning['contentCalendar'][number]>();
    if (!producerPlanningWithLocalLogoSelections) {
      return lookup;
    }
    producerPlanningWithLocalLogoSelections.contentCalendar.forEach((item) => {
      lookup.set(`content:${item.id}`, item);
    });
    return lookup;
  }, [producerPlanningWithLocalLogoSelections]);
  const deliveryItemsById = useMemo(() => {
    const lookup = new Map<string, ProducerProjectPlanning['contentCalendar'][number]>();
    if (!producerPlanningWithLocalLogoSelections) {
      return lookup;
    }
    producerPlanningWithLocalLogoSelections.contentCalendar.forEach((item) => {
      lookup.set(item.id, item);
    });
    return lookup;
  }, [producerPlanningWithLocalLogoSelections]);
  const availableLogoVariantTypes = useMemo(
    () => new Set((producerPlanningWithLocalLogoSelections?.brandGuide.logoVariants ?? []).map((item) => item.type)),
    [producerPlanningWithLocalLogoSelections?.brandGuide.logoVariants],
  );
  const accountAccessEntriesByPlatform = useMemo(() => {
    const lookup = new Map<ProducerAccountAccessPlatform, ProducerProjectPlanning['accountAccess']['entries'][number]>();
    producerPlanning?.accountAccess.entries.forEach((entry) => {
      lookup.set(entry.platform, entry);
    });
    return lookup;
  }, [producerPlanning?.accountAccess.entries]);
  const clientBriefReadyCount = useMemo(
    () => [
      clientIntake.projectGoal,
      clientIntake.deliverables,
      clientIntake.targetAudience,
      clientIntake.keyMessage,
      clientIntake.contactName,
      clientIntake.contactEmail,
    ].filter((value) => typeof value === 'string' && value.trim().length > 0).length,
    [clientIntake],
  );
  const clientMaterialsByType = useMemo(
    () => clientMaterials.reduce<Record<string, number>>((summaryMap, material) => {
      summaryMap[material.entry_type] = (summaryMap[material.entry_type] ?? 0) + 1;
      return summaryMap;
    }, {}),
    [clientMaterials],
  );
  const strategySnapshot = useMemo(
    () => (producerPlanning ? getProducerStrategySnapshot(producerPlanning) : []),
    [producerPlanning],
  );
  const clientMoments = useMemo(
    () => producerPlanning ? mergeProducerPlanningClientMomentsWithReviews(producerPlanning, items).slice(0, 6) : [],
    [items, producerPlanning],
  );
  const clientContributionTasks = useMemo(
    () => producerPlanning
      ? getProducerClientContributionTasks(producerPlanning, clientIntake, clientMaterials)
        .filter((task) => task.status !== 'ready')
        .slice(0, 6)
      : [],
    [clientIntake, clientMaterials, producerPlanning],
  );
  const clientInviteEmailStatus = useMemo(() => {
    const email = readFirstNonEmptyString(clientIntake.contactEmail);
    if (email) {
      return {
        tone: 'ready' as const,
        text: `E-postutkast går til ${email}.`,
      };
    }
    return {
      tone: 'warning' as const,
      text: 'Kontakt-e-post mangler i briefen. E-postutkast åpnes uten mottaker.',
    };
  }, [clientIntake.contactEmail]);
  const getWorkspaceFocusForReview = useCallback((review: ProducerClientReview): ClientPortalWorkspaceFocus => {
    const metadata = asRecord(review.metadata);
    const targetEntityType = readFirstNonEmptyString(
      metadata.groundingEntity,
      metadata.targetEntityType,
      review.target_entity_type,
    );
    const linkedAgreement = review.target_entity_type === 'project_agreement' && review.target_entity_id
      ? agreementsById[review.target_entity_id]
      : undefined;
    const meetingItemId = readFirstNonEmptyString(
      metadata.meetingItemId,
      metadata.meeting_item_id,
      review.target_entity_type === 'meeting_decision' ? review.target_entity_id : undefined,
    );
    const workspace = targetEntityType === 'client_material'
      ? 'materials'
      : targetEntityType === 'account_access' || review.review_type === 'account_access'
        ? 'accounts'
      : targetEntityType === 'content_calendar'
        ? 'brand'
      : targetEntityType === 'meeting_decision'
        ? 'meetings'
      : targetEntityType === 'project_agreement'
          || review.review_type === 'budget_package'
          || review.review_type === 'client_approval'
          || review.review_type === 'change_order'
          || review.review_type === 'storyboard'
          || review.review_type === 'manuscript'
          || review.review_type === 'shotlist'
        ? 'delivery'
        : 'brief';
    const location = getProducerWorkspaceLocationForSurface(producerPlanning?.workspaceNavigation, workspace);
    return {
      workspace,
      sectionId: location?.sectionId,
      pageId: location?.pageId,
      artifactId: targetEntityType === 'project_agreement'
        ? getAgreementWorkspaceArtifactId(linkedAgreement)
        : targetEntityType === 'meeting_decision'
          ? (meetingItemId ? `meeting-decision:${meetingItemId}` : undefined)
        : targetEntityType === 'client_material'
          ? review.target_entity_id ?? undefined
          : undefined,
    };
  }, [agreementsById, producerPlanning?.workspaceNavigation]);
  const getMediaFocusForContributionTask = useCallback((task: (typeof clientContributionTasks)[number]): ClientPortalWorkspaceFocus => {
    const workspace = getProducerWorkspaceSurfaceForContributionSource(task.sourceType);
    const location = getProducerWorkspaceLocationForSurface(producerPlanning?.workspaceNavigation, workspace);
    return {
      workspace,
      sectionId: location?.sectionId,
      pageId: location?.pageId,
    };
  }, [producerPlanning?.workspaceNavigation]);
  const operationalReviewItems = useMemo(
    () => getProducerOperationalReviews(items),
    [items],
  );
  const projectStatusDetail = useMemo(() => {
    const fallbackPending = projectWorkflowMeta?.pendingReviews ?? 0;
    const fallbackApproved = projectWorkflowMeta?.approvedReviews ?? 0;
    const fallbackRejected = projectWorkflowMeta?.rejectedReviews ?? 0;
    const fallbackChangesRequested = projectWorkflowMeta?.changesRequestedReviews ?? 0;
    const pendingCount = summary.pending > 0 ? summary.pending : fallbackPending;
    const approvedCount = summary.approved > 0 ? summary.approved : fallbackApproved;
    const rejectedCount = summary.rejected > 0 ? summary.rejected : fallbackRejected;
    const changesRequestedCount = summary.changesRequested > 0 ? summary.changesRequested : fallbackChangesRequested;

    if (pendingCount + approvedCount + rejectedCount + changesRequestedCount <= 0) {
      return 'Ingen klientbeslutninger er registrert ennå.';
    }

    const details = [
      `${pendingCount} venter`,
      `${changesRequestedCount} krever endringer`,
      `${approvedCount} godkjent`,
    ];

    if (rejectedCount > 0) {
      details.push(`${rejectedCount} avslått`);
    }

    return details.join(' · ');
  }, [projectWorkflowMeta, summary]);
  const economyRedirectCopy = useMemo(() => {
    if (newType === 'budget_package') {
      return {
        title: 'Budsjettpakker opprettes i økonomi',
        description: 'Hold budsjetter, fasevalg og klientgodkjenning samlet i økonomisenteret. Klientsamarbeid brukes videre til dialog, kommentarer og beslutning.',
        buttonLabel: 'Åpne budsjettflyt',
      };
    }

    if (newType === 'client_approval' || newType === 'change_order') {
      return {
        title: 'Klientavtaler og endringsordre styres fra økonomi',
        description: 'Opprett eller oppdater klientavtalen i økonomiområdet. Her inne følger du bare dialog, kommentarer og beslutninger etter at avtalen er sendt.',
        buttonLabel: 'Åpne avtaler i økonomi',
      };
    }

    const templateTitle = selectedApprovalTemplate
      ? getProducerReviewTypeLabel(selectedApprovalTemplate)
      : getProducerReviewTypeLabel(newType);

    return {
      title: `${templateTitle} sendes fra økonomi`,
      description: 'Leveransegodkjenninger for storyboard, manus og shotlist opprettes i økonomisenteret slik at økonomi, tidslinje og klientsamarbeid holder samme status.',
      buttonLabel: 'Åpne leveranseflyt i økonomi',
    };
  }, [newType, selectedApprovalTemplate]);
  const sortedReviewItems = useMemo(
    () => [...operationalReviewItems].sort((left, right) => {
      const leftTimestamp = new Date(left.decision_at ?? left.requested_at).getTime();
      const rightTimestamp = new Date(right.decision_at ?? right.requested_at).getTime();
      return rightTimestamp - leftTimestamp;
    }),
    [operationalReviewItems],
  );
  const activeClientGroundingReviews = useMemo(
    () => sortedReviewItems.filter((review) => isClientGroundingManagedReview(review) && !isResolvedClientGroundingReview(review)),
    [sortedReviewItems],
  );
  const defaultClientWorkspaceFocus = useMemo<ClientPortalWorkspaceFocus>(() => {
    const location = getProducerWorkspaceLocationForSurface(producerPlanning?.workspaceNavigation, 'brief');
    return {
      workspace: 'brief',
      sectionId: location?.sectionId,
      pageId: location?.pageId,
    };
  }, [producerPlanning?.workspaceNavigation]);
  const accountWorkspaceFocus = useMemo<ClientPortalWorkspaceFocus>(() => {
    const location = getProducerWorkspaceLocationForSurface(producerPlanning?.workspaceNavigation, 'accounts');
    return {
      workspace: 'accounts',
      sectionId: location?.sectionId,
      pageId: location?.pageId,
    };
  }, [producerPlanning?.workspaceNavigation]);
  const primaryClientWorkspaceFocus = useMemo<ClientPortalWorkspaceFocus>(() => {
    if (activeClientGroundingReviews[0]) {
      return getWorkspaceFocusForReview(activeClientGroundingReviews[0]);
    }
    if (clientContributionTasks[0]) {
      return getMediaFocusForContributionTask(clientContributionTasks[0]);
    }
    return defaultClientWorkspaceFocus;
  }, [
    activeClientGroundingReviews,
    clientContributionTasks,
    defaultClientWorkspaceFocus,
    getMediaFocusForContributionTask,
    getWorkspaceFocusForReview,
  ]);
  const visibleReviewItems = useMemo(
    () => sortedReviewItems.filter((review) => !isResolvedClientGroundingReview(review)),
    [sortedReviewItems],
  );
  const statusDriverReview = useMemo(() => {
    if (projectWorkflowStatus === 'changes_requested') {
      return sortedReviewItems.find((review) => (
        review.status === 'changes_requested' || review.status === 'rejected'
      )) ?? null;
    }
    if (projectWorkflowStatus === 'awaiting_client') {
      return sortedReviewItems.find((review) => (
        review.status !== 'approved' && review.status !== 'rejected' && review.status !== 'changes_requested'
      )) ?? null;
    }
    if (projectWorkflowStatus === 'approved') {
      return sortedReviewItems.find((review) => review.status === 'approved') ?? null;
    }
    return null;
  }, [projectWorkflowStatus, sortedReviewItems]);
  const getEconomyFocusForReview = useCallback((review: ProducerClientReview): Partial<ProducerWorkflowFocusPayload> | null => {
    const metadata = asRecord(review.metadata);
    const approvalTemplate = normalizeApprovalTemplate(readFirstNonEmptyString(
      metadata.approvalTemplate,
      review.review_type,
      review.target_entity_type,
    ));
    const focusedPhase = readFirstNonEmptyString(metadata.focusedPhase, metadata.phase);
    const normalizedFocusedPhase = (
      focusedPhase === 'preproduction'
      || focusedPhase === 'production'
      || focusedPhase === 'postproduction'
      || focusedPhase === 'all'
    ) ? focusedPhase : undefined;
    const agreementId = readFirstNonEmptyString(
      metadata.agreementId,
      review.target_entity_type === 'project_agreement' ? review.target_entity_id : undefined,
    );

    const baseFocus: Partial<ProducerWorkflowFocusPayload> = {
      reviewId: review.id,
      linkedEntityType: review.target_entity_type ?? undefined,
      linkedEntityId: review.target_entity_id ?? undefined,
      focusedPhase: normalizedFocusedPhase,
    };

    if (
      review.review_type === 'change_order'
      || review.review_type === 'client_approval'
      || review.target_entity_type === 'project_agreement'
      || agreementId
    ) {
      return {
        ...baseFocus,
        agreementId: agreementId ?? review.target_entity_id ?? undefined,
        economyView: 'budget',
      };
    }

    if (review.review_type === 'budget_package' || review.target_entity_type === 'economy') {
      return {
        ...baseFocus,
        economyView: 'approvals',
      };
    }

    if (approvalTemplate) {
      return {
        ...baseFocus,
        approvalTemplate,
        economyView: 'approvals',
      };
    }

    return null;
  }, []);
  const statusDriverEconomyFocus = useMemo(
    () => (statusDriverReview ? getEconomyFocusForReview(statusDriverReview) : null),
    [getEconomyFocusForReview, statusDriverReview],
  );
  const statusDriverTimelineFocus = useMemo(() => {
    if (!statusDriverReview) {
      return null;
    }
    return {
      reviewId: statusDriverReview.id,
      linkedEntityType: 'client_review',
      linkedEntityId: statusDriverReview.id,
      agreementId: statusDriverReview.target_entity_type === 'project_agreement'
        ? statusDriverReview.target_entity_id ?? undefined
        : readFirstNonEmptyString(asRecord(statusDriverReview.metadata).agreementId),
    } satisfies Partial<ProducerWorkflowFocusPayload>;
  }, [statusDriverReview]);
  const statusDriverCopy = useMemo(() => {
    if (!statusDriverReview) {
      return null;
    }

    const eventTime = formatReviewEventDateTime(statusDriverReview.decision_at ?? statusDriverReview.requested_at);
    if (projectWorkflowStatus === 'changes_requested') {
      return `Statusen styres nå av ${getProducerReviewTypeLabel(statusDriverReview.review_type)} «${statusDriverReview.title}». Klienten har bedt om endringer${eventTime ? ` · ${eventTime}` : ''}.`;
    }
    if (projectWorkflowStatus === 'awaiting_client') {
      return `Statusen styres nå av ${getProducerReviewTypeLabel(statusDriverReview.review_type)} «${statusDriverReview.title}». Prosjektet venter på beslutning${eventTime ? ` · sendt ${eventTime}` : ''}.`;
    }
    if (projectWorkflowStatus === 'approved') {
      return `Statusen ble sist flyttet til godkjent av ${getProducerReviewTypeLabel(statusDriverReview.review_type)} «${statusDriverReview.title}»${eventTime ? ` · ${eventTime}` : ''}.`;
    }
    return null;
  }, [projectWorkflowStatus, statusDriverReview]);

  const parseTimestampToSeconds = (value?: string): number | undefined => {
    if (!value) return undefined;
    const input = value.trim();
    if (!input) return undefined;

    if (/^\d+$/.test(input)) {
      return Math.max(0, Number.parseInt(input, 10));
    }

    const match = input.match(/^(\d+):([0-5]\d)$/);
    if (!match) return undefined;
    const minutes = Number.parseInt(match[1], 10);
    const seconds = Number.parseInt(match[2], 10);
    return Math.max(0, (minutes * 60) + seconds);
  };

  const handleDeliveryLogoVariantSelection = useCallback(async (
    deliveryId: string,
    selection: ProducerBrandLogoVariantSelection,
  ) => {
    if (!project || !producerPlanningWithLocalLogoSelections) {
      return;
    }

    const previousSelection = deliveryLogoSelectionByDeliveryId[deliveryId] ?? 'auto';
    setDeliveryLogoSelectionByDeliveryId((prev) => ({ ...prev, [deliveryId]: selection }));
    setSavingDeliveryLogoById((prev) => ({ ...prev, [deliveryId]: true }));

    try {
      const nextPlanning: ProducerProjectPlanning = {
        ...producerPlanningWithLocalLogoSelections,
        contentCalendar: producerPlanningWithLocalLogoSelections.contentCalendar.map((item) => (
          item.id === deliveryId
            ? { ...item, logoVariantSelection: selection }
            : item
        )),
      };
      await castingService.saveProject({
        ...project,
        producerPlanning: nextPlanning,
      });
      enqueueSnackbar('Logovalg oppdatert for leveransen.', { variant: 'success' });
    } catch (error) {
      console.error('[ProducerClientReviewPanel] Failed to persist delivery logo selection', error);
      setDeliveryLogoSelectionByDeliveryId((prev) => ({ ...prev, [deliveryId]: previousSelection }));
      enqueueSnackbar('Kunne ikke lagre logovalg.', { variant: 'error' });
    } finally {
      setSavingDeliveryLogoById((prev) => ({ ...prev, [deliveryId]: false }));
    }
  }, [
    deliveryLogoSelectionByDeliveryId,
    enqueueSnackbar,
    producerPlanningWithLocalLogoSelections,
    project,
  ]);

  const handleReviewTypeChange = (nextType: string) => {
    const nextTargetEntityType = getDefaultTargetEntityType(nextType);
    setNewType(nextType);
    setNewTargetEntityType(nextTargetEntityType);

    const nextTargetEntityId = entityOptions.find((option) => option.entityType === nextTargetEntityType)?.entityId ?? '';
    setNewTargetEntityId(nextTargetEntityId);
  };

  useEffect(() => {
    if (newTargetEntityId && filteredEntityOptions.some((option) => option.entityId === newTargetEntityId)) {
      return;
    }
    setNewTargetEntityId(filteredEntityOptions[0]?.entityId ?? '');
  }, [filteredEntityOptions, newTargetEntityId]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createReview({
      reviewType: newType,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      dueAt: newDueAt || undefined,
      targetEntityType: newTargetEntityType || undefined,
      targetEntityId: newTargetEntityId || undefined,
    });
    setNewTitle('');
    setNewDescription('');
    setNewDueAt('');
    setNewTargetEntityType(getDefaultTargetEntityType(DEFAULT_COLLABORATION_REVIEW_TYPE));
    setNewTargetEntityId('');
    setNewType(DEFAULT_COLLABORATION_REVIEW_TYPE);
  };

  const handleOpenEconomyForDraftType = useCallback(() => {
    if (!onOpenEconomy) {
      return;
    }

    if (selectedApprovalTemplate) {
      onOpenEconomy({
        projectId,
        panel: 'economy',
        economyView: 'approvals',
        approvalTemplate: selectedApprovalTemplate,
        linkedEntityType: selectedApprovalTemplate,
        linkedEntityId: makeProducerPackageEntityId(selectedApprovalTemplate, projectId),
        focusedPhase: 'preproduction',
      });
      return;
    }

    if (newType === 'budget_package') {
      onOpenEconomy({
        projectId,
        panel: 'economy',
        economyView: 'approvals',
        linkedEntityType: 'economy',
        linkedEntityId: makeProducerPackageEntityId('economy', projectId),
        focusedPhase: 'all',
      });
      return;
    }

    onOpenEconomy({
      projectId,
      panel: 'economy',
      economyView: 'budget',
      linkedEntityType: 'project_agreement',
      linkedEntityId: newTargetEntityId || undefined,
      focusedPhase: 'all',
    });
  }, [newTargetEntityId, newType, onOpenEconomy, projectId, selectedApprovalTemplate]);

  const handleComment = async (reviewId: string) => {
    const draft = commentDraftByReview[reviewId]?.trim();
    if (!draft) return;
    await addComment(reviewId, {
      commentText: draft,
      timestampSeconds: parseTimestampToSeconds(commentTimestampByReview[reviewId]),
    });
    setCommentDraftByReview((prev) => ({ ...prev, [reviewId]: '' }));
    setCommentTimestampByReview((prev) => ({ ...prev, [reviewId]: '' }));
  };

  const getEntityLabel = (entityType?: string | null, entityId?: string | null): string | null => {
    if (!entityType && !entityId) {
      return null;
    }
    const matchingEntity = entityOptions.find((option) => option.entityType === entityType && option.entityId === entityId);
    if (matchingEntity) {
      return matchingEntity.description ? `${matchingEntity.label} · ${matchingEntity.description}` : matchingEntity.label;
    }
    if (entityType) {
      const label = getProducerEntityTypeLabel(entityType);
      return entityId ? `${label} (${entityId})` : label;
    }
    return entityId ?? null;
  };

  const openEconomyFocus = useCallback((review: ProducerClientReview) => {
    if (!onOpenEconomy) {
      return;
    }

    const metadata = asRecord(review.metadata);
    const focusedPhaseRaw = readFirstNonEmptyString(metadata.focusedPhase, metadata.phase);
    const focusedPhase = focusedPhaseRaw === 'preproduction'
      || focusedPhaseRaw === 'production'
      || focusedPhaseRaw === 'postproduction'
      || focusedPhaseRaw === 'all'
      ? focusedPhaseRaw
      : undefined;

    const isAgreementReview = review.target_entity_type === 'project_agreement'
      || review.review_type === 'client_approval'
      || review.review_type === 'change_order';
    const approvalTemplate = normalizeApprovalTemplate(review.review_type);

    onOpenEconomy({
      reviewId: review.id,
      agreementId: review.target_entity_type === 'project_agreement'
        ? review.target_entity_id ?? undefined
        : undefined,
      linkedEntityType: review.target_entity_type ?? undefined,
      linkedEntityId: review.target_entity_id ?? undefined,
      economyView: isAgreementReview ? 'budget' : 'approvals',
      focusedPhase,
      approvalTemplate,
    });
  }, [onOpenEconomy]);

  const openTimelineFocus = useCallback((review: ProducerClientReview) => {
    if (!onOpenTimeline) {
      return;
    }

    onOpenTimeline({
      reviewId: review.id,
      linkedEntityType: 'client_review',
      linkedEntityId: review.id,
      agreementId: review.target_entity_type === 'project_agreement'
        ? review.target_entity_id ?? undefined
        : undefined,
    });
  }, [onOpenTimeline]);

  const readLocalAgreements = useCallback(async (): Promise<ProjectAgreement[]> => {
    const stored = await settingsService.getSetting<ProjectAgreement[]>(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, {
      projectId,
    });
    return Array.isArray(stored) ? stored : [];
  }, [projectId]);

  const loadAgreementLookup = useCallback(async () => {
    const agreements = useLocalFallback
      ? await readLocalAgreements()
      : await projectAgreementsApi.getAll(projectId);
    setAgreementsById(
      agreements.reduce<Record<string, ProjectAgreement>>((next, agreement) => {
        next[agreement.id] = agreement;
        return next;
      }, {}),
    );
  }, [projectId, readLocalAgreements, useLocalFallback]);

  useEffect(() => {
    void loadAgreementLookup();
  }, [loadAgreementLookup]);

  const loadClientInput = useCallback(async () => {
    setClientInputLoading(true);
    setClientInputError(null);
    try {
      const [nextIntake, nextMaterials] = await Promise.all([
        producerWorkflowService.getClientIntake(projectId),
        producerWorkflowService.getClientMaterials(projectId),
      ]);
      setClientIntake({
        ...EMPTY_CLIENT_INTAKE,
        ...nextIntake,
      });
      setClientMaterials(nextMaterials);
    } catch (loadError) {
      console.error('[ProducerClientReviewPanel] Failed to load client input', loadError);
      setClientInputError('Kunne ikke hente klientbrief og materiale.');
    } finally {
      setClientInputLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadClientInput();
  }, [loadClientInput]);

  useEffect(() => {
    if (!producerPlanning) {
      return;
    }

    void producerWorkflowService.ensurePlanningClientReviews(projectId, producerPlanning).catch((syncError) => {
      console.error('[ProducerClientReviewPanel] Failed to ensure planning reviews', syncError);
    });
    void producerWorkflowService.ensureMeetingWorkspaceWorkflow(projectId, producerPlanning).catch((syncError) => {
      console.error('[ProducerClientReviewPanel] Failed to ensure meeting workflow', syncError);
    });
    void producerWorkflowService.ensureClientGroundingReviews(projectId).catch((syncError) => {
      console.error('[ProducerClientReviewPanel] Failed to ensure client grounding reviews', syncError);
    });
  }, [producerPlanning, projectId]);

  useEffect(() => onProjectAgreementEvent((payload) => {
    if (payload.projectId !== projectId) {
      return;
    }
    void loadAgreementLookup();
  }), [loadAgreementLookup, projectId]);

  useEffect(() => onProducerWorkflowEvent((payload) => {
    if (payload.projectId !== projectId || payload.domain !== 'project') {
      return;
    }
    void loadClientInput();
  }), [loadClientInput, projectId]);

  useEffect(() => onProducerWorkflowFocusEvent((payload) => {
    if (payload.projectId !== projectId || payload.panel !== 'reviews') {
      return;
    }
    setPendingFocus(payload);
  }), [projectId]);

  useEffect(() => {
    if (!initialReviewId) {
      return;
    }
    const initialFocusKey = `${projectId}:${initialReviewId}`;
    if (initialReviewFocusRef.current === initialFocusKey) {
      return;
    }
    initialReviewFocusRef.current = initialFocusKey;
    setPendingFocus({
      projectId,
      panel: 'reviews',
      reviewId: initialReviewId,
    });
  }, [initialReviewId, projectId]);

  const resolveFocusedReviewId = useCallback((payload: ProducerWorkflowFocusPayload): string | null => {
    if (payload.reviewId && items.some((review) => review.id === payload.reviewId)) {
      return payload.reviewId;
    }

    if (payload.agreementId) {
      return items.find((review) => (
        review.target_entity_type === 'project_agreement'
        && review.target_entity_id === payload.agreementId
      ))?.id ?? null;
    }

    if (payload.linkedEntityType || payload.linkedEntityId) {
      return items.find((review) => (
        (payload.linkedEntityType ? review.target_entity_type === payload.linkedEntityType : true)
        && (payload.linkedEntityId ? review.target_entity_id === payload.linkedEntityId : true)
      ))?.id ?? null;
    }

    return null;
  }, [items]);

  useEffect(() => {
    if (!pendingFocus) {
      return undefined;
    }

    const resolvedReviewId = resolveFocusedReviewId(pendingFocus);
    if (!resolvedReviewId) {
      return undefined;
    }

    setHighlightedReviewId(resolvedReviewId);
    const target = reviewRefs.current[resolvedReviewId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setPendingFocus(null);

    const timeoutId = window.setTimeout(() => {
      setHighlightedReviewId((current) => (current === resolvedReviewId ? null : current));
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [pendingFocus, resolveFocusedReviewId]);

  const buildReviewPortalUrl = useCallback((review: ProducerClientReview): string => {
    const focus = getWorkspaceFocusForReview(review);
    return buildClientPortalUrl(projectId, {
      tab: 'reviews',
      workspace: focus.workspace,
      sectionId: focus.sectionId,
      pageId: focus.pageId,
      reviewId: review.id,
      artifactId: focus.artifactId,
    });
  }, [getWorkspaceFocusForReview, projectId]);

  const handleCopyReviewPortalUrl = useCallback(async (review: ProducerClientReview) => {
    const reviewPortalUrl = buildReviewPortalUrl(review);
    if (!reviewPortalUrl) {
      enqueueSnackbar('Kunne ikke bygge klientlenke for denne saken.', { variant: 'error' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(reviewPortalUrl);
      enqueueSnackbar('Godkjenningslenke kopiert.', { variant: 'success' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.prompt('Kopier godkjenningslenken manuelt:', reviewPortalUrl);
      return;
    }
    enqueueSnackbar('Clipboard er ikke tilgjengelig for denne saken.', { variant: 'info' });
  }, [buildReviewPortalUrl, enqueueSnackbar]);

  const buildReviewClientInviteText = useCallback((review: ProducerClientReview): string => {
    const reviewPortalUrl = buildReviewPortalUrl(review);
    const contentLogicMomentKind = getContentLogicMomentKindForReview(review);
    const accountAccessPlatforms = getAccountAccessPlatformsForReview(review);
    const eyebrow = accountAccessPlatforms.length > 0
      ? `[Kontotilgang · ${accountAccessPlatforms.map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform]).join(' / ')}]`
      : contentLogicMomentKind
      ? `[Content Logic · ${PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]}]`
      : `[${getProducerReviewTypeLabel(review.review_type)}]`;
    const actionLabel = getReviewClientInviteActionLabel(contentLogicMomentKind, review);
    return [
      eyebrow,
      '',
      `Hei,`,
      '',
      `Du har en sak klar i klientportalen for ${projectName}.`,
      `${actionLabel}: ${review.title}`,
      review.description || 'Ingen ekstra beskrivelse er lagt inn for denne saken.',
      review.due_at ? `Frist: ${new Date(review.due_at).toLocaleString('nb-NO')}` : '',
      '',
      `Åpne saken her: ${reviewPortalUrl}`,
    ].filter(Boolean).join('\n');
  }, [buildReviewPortalUrl, projectName]);

  const handleCopyReviewClientInviteText = useCallback(async (review: ProducerClientReview) => {
    const content = buildReviewClientInviteText(review);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content);
      enqueueSnackbar('Klienttekst kopiert.', { variant: 'success' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.prompt('Kopier klientteksten manuelt:', content);
      return;
    }
    enqueueSnackbar('Clipboard er ikke tilgjengelig for denne saken.', { variant: 'info' });
  }, [buildReviewClientInviteText, enqueueSnackbar]);

  const handleOpenReviewClientInviteMail = useCallback((review: ProducerClientReview) => {
    if (typeof window === 'undefined') {
      return;
    }
    const recipient = readFirstNonEmptyString(clientIntake.contactEmail);
    const subject = buildReviewClientInviteEmailSubject(projectName, review);
    const body = buildReviewClientInviteText(review);
    const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }, [buildReviewClientInviteText, clientIntake.contactEmail, projectName]);

  const handleOpenReviewPortal = useCallback((review: ProducerClientReview) => {
    const reviewPortalUrl = buildReviewPortalUrl(review);
    if (!reviewPortalUrl) {
      enqueueSnackbar('Kunne ikke åpne klientlenken for denne saken.', { variant: 'error' });
      return;
    }
    if (typeof window !== 'undefined') {
      window.open(reviewPortalUrl, '_blank', 'noopener,noreferrer');
    }
  }, [buildReviewPortalUrl, enqueueSnackbar]);

  const syncAgreementTimeline = useCallback(async (agreement: ProjectAgreement) => {
    const timelineItems = await producerWorkflowService.getTimeline(projectId);
    const existingTimelineItem = timelineItems.find((item) => isAgreementTimelineItem(item, agreement.id));
    const payload = buildAgreementTimelinePayload(agreement);

    if (existingTimelineItem) {
      await producerWorkflowService.updateTimelineItem(projectId, existingTimelineItem.id, payload);
      return;
    }

    await producerWorkflowService.createTimelineItem(projectId, payload);
  }, [projectId]);

  const syncAgreementFromReviewDecision = useCallback(async (
    review: { id: string; target_entity_type?: string | null; target_entity_id?: string | null },
    decision: ProducerReviewDecision,
  ) => {
    if (review.target_entity_type !== 'project_agreement' || !review.target_entity_id) {
      return;
    }

    const existingAgreement = agreementsById[review.target_entity_id]
      ?? (await (useLocalFallback ? readLocalAgreements() : projectAgreementsApi.getAll(projectId)))
        .find((agreement) => agreement.id === review.target_entity_id);

    if (!existingAgreement) {
      return;
    }

    let updatedAgreement: ProjectAgreement | undefined;

    if (existingAgreement.google_signature) {
      const nextSignatureStatus = getGoogleSignatureStatusFromDecision(decision);

      if (useLocalFallback) {
        const agreements = await readLocalAgreements();
        const now = new Date().toISOString();
        const nextAgreements = agreements.map((agreement) => {
          if (agreement.id !== review.target_entity_id) {
            return agreement;
          }

          const existingSignature = agreement.google_signature ?? existingAgreement.google_signature;
          return {
            ...agreement,
            status: nextSignatureStatus === 'signed' ? 'signed' : 'sent',
            signed_date: nextSignatureStatus === 'signed'
              ? agreement.signed_date ?? now
              : undefined,
            updated_at: now,
            google_signature: {
              id: existingSignature?.id ?? `local-google-signature-${agreement.id}`,
              projectId,
              agreementId: agreement.id,
              provider: 'google_workspace',
              status: nextSignatureStatus,
              documentTitle: existingSignature?.documentTitle ?? agreement.title,
              driveSourceFileId: existingSignature?.driveSourceFileId ?? null,
              signedDriveFileId: existingSignature?.signedDriveFileId ?? null,
              auditArtifactId: existingSignature?.auditArtifactId ?? null,
              requestUrl: existingSignature?.requestUrl ?? null,
              webViewUrl: existingSignature?.webViewUrl ?? null,
              requestedBy: existingSignature?.requestedBy ?? null,
              requestedByEmail: existingSignature?.requestedByEmail ?? null,
              counterpartyName: existingSignature?.counterpartyName ?? agreement.counterparty_name,
              counterpartyEmail: existingSignature?.counterpartyEmail ?? agreement.counterparty_email,
              preparedAt: existingSignature?.preparedAt ?? now,
              sentAt: nextSignatureStatus === 'signed'
                ? existingSignature?.sentAt ?? now
                : nextSignatureStatus === 'changes_requested' || nextSignatureStatus === 'rejected'
                  ? existingSignature?.sentAt ?? now
                  : now,
              signedAt: nextSignatureStatus === 'signed' ? now : null,
              declinedAt: nextSignatureStatus === 'changes_requested' || nextSignatureStatus === 'rejected'
                ? now
                : null,
              lastOpenedAt: existingSignature?.lastOpenedAt ?? null,
              lastSyncedAt: now,
              signatureHash: existingSignature?.signatureHash ?? null,
              metadata: {
                ...(existingSignature?.metadata ?? {}),
                reviewId: review.id,
                reviewDecision: decision,
              },
            },
          };
        });
        await settingsService.setSetting(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, nextAgreements, {
          projectId,
        });
        updatedAgreement = nextAgreements.find((agreement) => agreement.id === review.target_entity_id);
      } else {
        const response = await projectAgreementsApi.updateGoogleSignatureStatus(
          projectId,
          existingAgreement.id,
          nextSignatureStatus,
          {
            reviewId: review.id,
            reviewDecision: decision,
          },
        );
        updatedAgreement = response.agreement;
      }
    } else {
      const nextAgreementStatus = getAgreementStatusFromReviewDecision(decision, existingAgreement);

      if (useLocalFallback) {
        const agreements = await readLocalAgreements();
        const nextAgreements = agreements.map((agreement) => (
          agreement.id === review.target_entity_id
            ? {
                ...agreement,
                status: nextAgreementStatus,
                signed_date: nextAgreementStatus === 'signed'
                  ? agreement.signed_date ?? new Date().toISOString()
                  : agreement.signed_date,
                updated_at: new Date().toISOString(),
              }
            : agreement
        ));
        await settingsService.setSetting(LOCAL_PROJECT_AGREEMENTS_NAMESPACE, nextAgreements, {
          projectId,
        });
        updatedAgreement = nextAgreements.find((agreement) => agreement.id === review.target_entity_id);
      } else {
        await projectAgreementsApi.updateStatus(review.target_entity_id, nextAgreementStatus);
        const agreements = await projectAgreementsApi.getAll(projectId);
        updatedAgreement = agreements.find((agreement) => agreement.id === review.target_entity_id);
      }
    }

    if (!updatedAgreement) {
      return;
    }

    await syncAgreementTimeline(updatedAgreement);
    setAgreementsById((previous) => ({
      ...previous,
      [updatedAgreement.id]: updatedAgreement,
    }));
    emitProjectAgreementEvent({
      projectId,
      mutation: updatedAgreement.google_signature ? 'signature_updated' : 'status_updated',
      agreementId: updatedAgreement.id,
    });
  }, [agreementsById, projectId, readLocalAgreements, syncAgreementTimeline, useLocalFallback]);

  const handleDecision = useCallback(async (
    review: { id: string; target_entity_type?: string | null; target_entity_id?: string | null },
    decision: ProducerReviewDecision,
  ) => {
    await setDecision(review.id, {
      decision,
      reason: decisionReasonByReview[review.id]?.trim() || undefined,
      timestampSeconds: parseTimestampToSeconds(decisionTimestampByReview[review.id]),
    });
    await syncAgreementFromReviewDecision(review, decision);
    setDecisionReasonByReview((prev) => ({ ...prev, [review.id]: '' }));
    setDecisionTimestampByReview((prev) => ({ ...prev, [review.id]: '' }));
  }, [decisionReasonByReview, decisionTimestampByReview, setDecision, syncAgreementFromReviewDecision]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack spacing={1}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ lg: 'center' }}>
          <Stack spacing={0.35}>
            <Stack direction="row" spacing={1} alignItems="center">
              <RateReviewIcon sx={{ color: '#c084fc' }} />
              <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                Klientgodkjenning
              </Typography>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  px: 1,
                  py: 0.35,
                  borderRadius: 999,
                  border: `1px solid ${projectStatusColors.border}`,
                  bgcolor: projectStatusColors.background,
                }}
              >
                <Typography sx={{ color: projectStatusColors.color, fontSize: '0.73rem', fontWeight: 700 }}>
                  {projectStatusLabel}
                </Typography>
              </Box>
            </Stack>
            <Typography sx={{ color: 'rgba(203,213,225,0.72)', fontSize: '0.82rem' }}>
              {projectName} · Venter {summary.pending} · Godkjent {summary.approved} · Endringer {summary.changesRequested}
            </Typography>
          </Stack>
          {(statusDriverEconomyFocus && onOpenEconomy) || (statusDriverTimelineFocus && onOpenTimeline) ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
              {statusDriverEconomyFocus && onOpenEconomy ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onOpenEconomy(statusDriverEconomyFocus)}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#f8fafc', borderColor: 'rgba(148,163,184,0.35)' }}
                >
                  Åpne i økonomi
                </Button>
              ) : null}
              {statusDriverTimelineFocus && onOpenTimeline ? (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onOpenTimeline(statusDriverTimelineFocus)}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#f8fafc', borderColor: 'rgba(148,163,184,0.35)' }}
                >
                  Åpne i tidslinje
                </Button>
              ) : null}
            </Stack>
          ) : null}
        </Stack>

        <Box
          sx={{
            px: 1.2,
            py: 0.95,
            borderRadius: 1.5,
            border: projectWorkflowStatus === 'changes_requested'
              ? '1px solid rgba(251,191,36,0.22)'
              : projectWorkflowStatus === 'approved'
                ? '1px solid rgba(16,185,129,0.2)'
                : '1px solid rgba(96,165,250,0.16)',
            background: projectWorkflowStatus === 'changes_requested'
              ? 'rgba(251,191,36,0.08)'
              : projectWorkflowStatus === 'approved'
                ? 'rgba(16,185,129,0.08)'
                : 'rgba(59,130,246,0.08)',
          }}
        >
          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
            {statusDriverReview && statusDriverCopy ? statusDriverCopy : `Prosjektstatus styres av klientbeslutningene: ${projectStatusDetail}`}
          </Typography>
        </Box>
      </Stack>

      <Box
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          border: '1px solid rgba(148,163,184,0.2)',
          background: 'rgba(15,23,42,0.52)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Prosjektgrunnlag
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.84rem', mt: 0.35 }}>
              Se hva klienten faktisk har fylt inn og levert.
            </Typography>
          </Box>
          {onOpenMedia ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onOpenMedia(primaryClientWorkspaceFocus)}
              sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' }, minHeight: 44 }}
            >
              Åpne grunnlag
            </Button>
          ) : null}
        </Stack>
        {clientInputError ? (
          <Alert severity="error" sx={{ mt: 1.1 }}>
            {clientInputError}
          </Alert>
        ) : null}
        {clientInputLoading ? (
          <Alert severity="info" sx={{ mt: 1.1 }}>
            Oppdaterer klientbrief og materiale.
          </Alert>
        ) : (
          <Stack spacing={1.1} sx={{ mt: 1.1 }}>
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              <Chip size="small" label={`Brieffelter ${clientBriefReadyCount}/6`} sx={{ bgcolor: 'rgba(59,130,246,0.18)', color: '#dbeafe' }} />
              <Chip size="small" label={`Materiale ${clientMaterials.length}`} sx={{ bgcolor: 'rgba(192,132,252,0.18)', color: '#f5d0fe' }} />
              {Object.entries(clientMaterialsByType).slice(0, 3).map(([type, count]) => (
                <Chip
                  key={type}
                  size="small"
                  label={`${CLIENT_MATERIAL_TYPE_LABELS[type as ProducerClientMaterialType] ?? type}: ${count}`}
                  sx={{ bgcolor: 'rgba(148,163,184,0.18)', color: '#f1f5f9' }}
                />
              ))}
            </Stack>
            <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.82rem' }}>
              Kontakt: {[clientIntake.contactName, clientIntake.contactEmail, clientIntake.contactPhone].filter(Boolean).join(' · ') || 'Ikke fylt ut ennå'}
            </Typography>
            {readFirstNonEmptyString(clientIntake.projectGoal, clientIntake.deliverables, clientIntake.keyMessage) ? (
              <Typography sx={{ color: 'rgba(203,213,225,0.88)', fontSize: '0.82rem' }}>
                {[
                  readFirstNonEmptyString(clientIntake.projectGoal) ? `Mål: ${clientIntake.projectGoal}` : null,
                  readFirstNonEmptyString(clientIntake.deliverables) ? `Leveranser: ${clientIntake.deliverables}` : null,
                  readFirstNonEmptyString(clientIntake.keyMessage) ? `Budskap: ${clientIntake.keyMessage}` : null,
                ].filter(Boolean).join(' · ')}
              </Typography>
            ) : null}
          </Stack>
        )}
      </Box>

      <Box
        sx={{
          p: 1.25,
          borderRadius: 1.5,
          border: '1px solid rgba(148,163,184,0.2)',
          background: 'rgba(15,23,42,0.52)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Åpne blokkeringer
            </Typography>
            <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.84rem', mt: 0.35 }}>
              Dette stopper videre arbeid akkurat nå.
            </Typography>
          </Box>
          {onOpenMedia ? (
            <Button
              size="small"
              variant="outlined"
              onClick={() => onOpenMedia(primaryClientWorkspaceFocus)}
              sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' }, minHeight: 44 }}
            >
              Åpne grunnlag
            </Button>
          ) : null}
        </Stack>
        {activeClientGroundingReviews.length > 0 ? (
          <Stack spacing={0.9} sx={{ mt: 1.1 }}>
            {activeClientGroundingReviews.map((review) => (
              <Box
                key={`grounding-${review.id}`}
                sx={{
                  p: 1,
                  borderRadius: 1.25,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.46)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {review.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(191,219,254,0.9)', fontSize: '0.78rem', mt: 0.2, lineHeight: 1.4 }}>
                      {`${getProducerReviewTypeLabel(review.review_type)} · ${getProducerReviewStatusLabel(review.status)}`}
                    </Typography>
                    {review.description ? (
                      <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.82rem', mt: 0.3 }}>
                        {review.description}
                      </Typography>
                    ) : null}
                  </Box>
                  {onOpenMedia ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onOpenMedia(getWorkspaceFocusForReview(review))}
                      sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { md: 'flex-start' }, minHeight: 44 }}
                    >
                      Løs i brief og materiale
                    </Button>
                  ) : null}
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : clientContributionTasks.length === 0 ? (
          <Alert severity="success" sx={{ mt: 1.1, bgcolor: 'rgba(16,185,129,0.12)', color: '#d1fae5' }}>
            Klientgrunnlaget er oppdatert og klart til bruk i plan, tidslinje og leveranser.
          </Alert>
        ) : null}
        {clientContributionTasks.length > 0 ? (
          <Stack spacing={0.9} sx={{ mt: 1.1 }}>
            {clientContributionTasks.map((task) => (
              <Box
                key={`contribution-${task.id}`}
                sx={{
                  p: 1,
                  borderRadius: 1.25,
                  border: '1px solid rgba(148,163,184,0.14)',
                  background: 'rgba(2,6,23,0.46)',
                }}
              >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>
                      {task.title}
                    </Typography>
                    <Typography sx={{ color: 'rgba(191,219,254,0.9)', fontSize: '0.78rem', mt: 0.2, lineHeight: 1.4 }}>
                      {[
                        PRODUCER_CLIENT_CONTRIBUTION_SOURCE_LABELS[task.sourceType],
                        PRODUCER_CLIENT_CONTRIBUTION_STATUS_LABELS[task.status],
                        task.phase === 'preproduction' ? 'Pre-produksjon' : task.phase === 'production' ? 'Produksjon' : 'Post-produksjon',
                      ].join(' · ')}
                    </Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.88)', fontSize: '0.82rem', mt: 0.3 }}>
                      {task.detail}
                    </Typography>
                  </Box>
                  <Stack spacing={0.45} alignItems={{ md: 'flex-end' }}>
                    {onOpenMedia ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onOpenMedia(getMediaFocusForContributionTask(task))}
                        sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                      >
                        Løs i brief og materiale
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Stack>
        ) : null}
      </Box>

      {strategySnapshot.length > 0 || clientMoments.length > 0 ? (
        <Box
          sx={{
            p: 1.25,
            borderRadius: 1.5,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'rgba(15,23,42,0.52)',
          }}
        >
          <Stack spacing={1}>
            <Typography sx={{ color: '#fff', fontWeight: 700 }}>
              Retning og neste klientpunkter
            </Typography>
            {strategySnapshot.length > 0 ? (
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                {strategySnapshot.map((item) => (
                  <Chip
                    key={item.label}
                    size="small"
                    label={`${item.label}: ${item.value}`}
                    sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }}
                  />
                ))}
              </Stack>
            ) : null}
            {clientMoments.length > 0 ? (
              <Stack spacing={0.75}>
                {clientMoments.map((moment) => {
                  const contentLogicMomentKind = getProducerContentLogicMomentKind(moment.id);
                  const isContentLogicMoment = Boolean(contentLogicMomentKind);
                  const accountAccessPlatform = getProducerAccountAccessPlatformFromMomentId(moment.id);
                  const isAccountAccessMoment = Boolean(accountAccessPlatform);
                  const contentLogicMomentLabel = contentLogicMomentKind
                    ? PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]
                    : '';
                  const linkedDeliveryItem = moment.type === 'content_delivery'
                    ? deliveryItemsByPlanningMomentId.get(moment.id)
                    : undefined;
                  const linkedDeliveryVariantResolution = linkedDeliveryItem && producerPlanningWithLocalLogoSelections
                    ? resolveProducerBrandLogoVariant(
                      producerPlanningWithLocalLogoSelections.brandGuide,
                      linkedDeliveryItem.format,
                      linkedDeliveryItem.logoVariantSelection ?? 'auto',
                    )
                    : null;
                  return (
                    <Box
                      key={moment.id}
                      sx={{
                        p: 0.95,
                        borderRadius: 1.2,
                        border: isContentLogicMoment
                          ? '1px solid rgba(167,139,250,0.26)'
                          : isAccountAccessMoment
                            ? '1px solid rgba(45,212,191,0.26)'
                          : '1px solid rgba(148,163,184,0.14)',
                        background: isContentLogicMoment
                          ? 'rgba(76,29,149,0.16)'
                          : isAccountAccessMoment
                            ? 'rgba(15,118,110,0.14)'
                          : 'rgba(2,6,23,0.46)',
                      }}
                    >
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={0.65} flexWrap="wrap" sx={{ mb: 0.45 }}>
                            <Chip
                              size="small"
                              label={isContentLogicMoment ? 'Content Logic' : PRODUCER_PLANNING_CLIENT_MOMENT_LABELS[moment.type]}
                              sx={{
                                bgcolor: isContentLogicMoment ? 'rgba(167,139,250,0.18)' : 'rgba(59,130,246,0.14)',
                                color: isContentLogicMoment ? '#ede9fe' : '#bfdbfe',
                              }}
                            />
                            {isContentLogicMoment ? (
                              <Chip
                                size="small"
                                label={contentLogicMomentLabel}
                                sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#cffafe' }}
                              />
                            ) : null}
                            {isAccountAccessMoment && accountAccessPlatform ? (
                              <>
                                <Chip
                                  size="small"
                                  label="Kontotilgang"
                                  sx={{ bgcolor: 'rgba(45,212,191,0.16)', color: '#ccfbf1' }}
                                />
                                <Chip
                                  size="small"
                                  label={PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[accountAccessPlatform]}
                                  sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                />
                              </>
                            ) : null}
                            <Chip
                              size="small"
                              label={moment.reviewStatusLabel ?? moment.statusLabel}
                              sx={{
                                bgcolor: moment.reviewStatus === 'approved'
                                  ? 'rgba(16,185,129,0.16)'
                                  : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                    ? 'rgba(248,113,113,0.16)'
                                    : 'rgba(148,163,184,0.16)',
                                color: moment.reviewStatus === 'approved'
                                  ? '#a7f3d0'
                                  : moment.reviewStatus === 'changes_requested' || moment.reviewStatus === 'rejected'
                                    ? '#fecaca'
                                    : '#cbd5e1',
                              }}
                            />
                          </Stack>
                          <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
                            {moment.title}
                          </Typography>
                          <Typography sx={{ color: isContentLogicMoment ? 'rgba(233,213,255,0.94)' : isAccountAccessMoment ? 'rgba(204,251,241,0.92)' : 'rgba(226,232,240,0.88)', fontSize: '0.82rem', mt: 0.3 }}>
                            {moment.detail}
                          </Typography>
                          {linkedDeliveryItem && linkedDeliveryVariantResolution ? (
                            <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.76rem', mt: 0.32 }}>
                              {`Logo i leveransen: ${linkedDeliveryVariantResolution.resolvedLabel} · ${linkedDeliveryVariantResolution.selectionLabel}`}
                            </Typography>
                          ) : null}
                          {isContentLogicMoment ? (
                            <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.76rem', mt: 0.3 }}>
                              Klienten godkjenner hook, CTA og proof points her før storyboard og leveranse låses.
                            </Typography>
                          ) : null}
                          {isAccountAccessMoment ? (
                            <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.76rem', mt: 0.3 }}>
                              Klienten må avklare invite, OAuth eller sikker publiseringstilgang før leveransen kan sendes helt videre.
                            </Typography>
                          ) : null}
                        </Box>
                        <Stack spacing={0.45} alignItems={{ md: 'flex-end' }}>
                          <Typography sx={{ color: 'rgba(203,213,225,0.88)', fontSize: '0.76rem' }}>
                            {[moment.date, moment.owner].filter(Boolean).join(' · ') || 'Ingen dato eller ansvarlig satt'}
                          </Typography>
                          {(isContentLogicMoment || isAccountAccessMoment || moment.type === 'framework_alignment') && onOpenMedia ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenMedia(
                                isAccountAccessMoment
                                  ? accountWorkspaceFocus
                                  : defaultClientWorkspaceFocus,
                              )}
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                            >
                              {isContentLogicMoment
                                ? 'Åpne Content Logic'
                                : isAccountAccessMoment
                                  ? 'Åpne kontotilgang'
                                  : 'Åpne brief og materiale'}
                            </Button>
                          ) : null}
                          {!isContentLogicMoment && !isAccountAccessMoment && moment.type !== 'framework_alignment' && onOpenTimeline ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenTimeline({ focusedPhase: moment.phase })}
                              sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                            >
                              Åpne i tidslinje
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.85rem' }}>
                Legg inn klientpunkter i faseplan eller content-kalender for å styre godkjenninger og publisering fra samme flyt.
              </Typography>
            )}
          </Stack>
        </Box>
      ) : null}

      {error && <Alert severity="error">{error}</Alert>}

      {canEdit && (
        <Stack spacing={1.2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="review-followup-type-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Oppfølgingstype</InputLabel>
              <Select
                labelId="review-followup-type-label"
                label="Oppfølgingstype"
                value={newType}
                onChange={(event) => handleReviewTypeChange(String(event.target.value))}
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                <ListSubheader sx={{ bgcolor: '#0f172a', color: 'rgba(203,213,225,0.72)', fontWeight: 700 }}>
                  Klientsamarbeid
                </ListSubheader>
                {COLLABORATION_REVIEW_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
                <ListSubheader sx={{ bgcolor: '#0f172a', color: 'rgba(203,213,225,0.72)', fontWeight: 700 }}>
                  Økonomi og godkjenning
                </ListSubheader>
                {ECONOMY_REVIEW_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {isEconomyManagedDraftType ? (
              <Box sx={{ flex: 1, minWidth: 280 }}>
                <Alert severity="info" sx={{ bgcolor: 'rgba(37,99,235,0.12)', color: '#dbeafe', height: '100%' }}>
                  {economyRedirectCopy.title}. {economyRedirectCopy.description}
                </Alert>
              </Box>
            ) : (
              <>
                <TextField
                  size="small"
                  label="Tittel"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  sx={{ flex: 1, minWidth: 220 }}
                  InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                />
                <TextField
                  size="small"
                  label="Frist"
                  type="datetime-local"
                  value={newDueAt}
                  onChange={(event) => setNewDueAt(event.target.value)}
                  sx={{ minWidth: 220 }}
                  InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
                />
              </>
            )}
          </Stack>

          {isEconomyManagedDraftType ? (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip
                  size="small"
                  label={selectedApprovalTemplate
                    ? `${getProducerReviewTypeLabel(selectedApprovalTemplate)} styres i økonomi`
                    : `${getProducerReviewTypeLabel(newType)} styres i økonomi`}
                  sx={{ bgcolor: 'rgba(96,165,250,0.14)', color: '#bfdbfe' }}
                />
                <Chip
                  size="small"
                  label="Klientsamarbeid brukes til kommentarer og beslutning"
                  sx={{ bgcolor: 'rgba(192,132,252,0.14)', color: '#e9d5ff' }}
                />
              </Stack>
              {onOpenEconomy ? (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleOpenEconomyForDraftType}
                  sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 210 }}
                >
                  {economyRedirectCopy.buttonLabel}
                </Button>
              ) : null}
            </Stack>
          ) : (
            <>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id="review-target-type-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Måltype</InputLabel>
                  <Select
                    labelId="review-target-type-label"
                    label="Måltype"
                    value={newTargetEntityType}
                    onChange={(event) => {
                      const nextType = String(event.target.value);
                      setNewTargetEntityType(nextType);
                      setNewTargetEntityId(entityOptions.find((option) => option.entityType === nextType)?.entityId ?? '');
                    }}
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                  >
                    <MenuItem value="">Ingen kobling</MenuItem>
                    {distinctEntityTypes.map((option) => (
                      <MenuItem key={option.entityType} value={option.entityType}>
                        {getProducerEntityTypeLabel(option.entityType)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {filteredEntityOptions.length > 0 ? (
                  <FormControl size="small" sx={{ flex: 1, minWidth: 260 }}>
                    <InputLabel id="review-target-entity-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Målentitet</InputLabel>
                    <Select
                      labelId="review-target-entity-label"
                      label="Målentitet"
                      value={newTargetEntityId}
                      onChange={(event) => setNewTargetEntityId(String(event.target.value))}
                      sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                    >
                      {filteredEntityOptions.map((option) => (
                        <MenuItem key={`${option.entityType}:${option.entityId}`} value={option.entityId}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <TextField
                    size="small"
                    label="Mål-ID"
                    value={newTargetEntityId}
                    onChange={(event) => setNewTargetEntityId(event.target.value)}
                    sx={{ flex: 1, minWidth: 220 }}
                    InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
                  />
                )}
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={() => { void handleCreate(); }}
                  disabled={loading || !newTitle.trim()}
                  sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 170 }}
                >
                  Opprett oppfølging
                </Button>
              </Stack>

              <TextField
                size="small"
                label="Beskrivelse"
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                multiline
                minRows={2}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            </>
          )}
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack spacing={1.2}>
        {visibleReviewItems.length === 0 ? (
          <Typography sx={{ color: 'rgba(148,163,184,0.82)' }}>
            Ingen åpne reviews opprettet enda.
          </Typography>
        ) : (
          visibleReviewItems.map((review) => {
            const entityLabel = getEntityLabel(review.target_entity_type, review.target_entity_id);
            const linkedAgreement = review.target_entity_type === 'project_agreement' && review.target_entity_id
              ? agreementsById[review.target_entity_id]
              : undefined;
            const linkedPlanningMomentId = readPlanningMomentIdFromReview(review);
            const linkedDeliveryIds = readLinkedDeliveryIdsFromReview(review);
            const linkedDeliveryItems = linkedDeliveryIds
              .map((deliveryId) => deliveryItemsById.get(deliveryId))
              .filter((item): item is NonNullable<typeof item> => Boolean(item));
            const linkedDeliveryItem = linkedPlanningMomentId
              ? deliveryItemsByPlanningMomentId.get(linkedPlanningMomentId)
              : linkedDeliveryItems[0];
            const linkedDeliveryVariantResolution = linkedDeliveryItem && producerPlanningWithLocalLogoSelections
              ? resolveProducerBrandLogoVariant(
                producerPlanningWithLocalLogoSelections.brandGuide,
                linkedDeliveryItem.format,
                linkedDeliveryItem.logoVariantSelection ?? 'auto',
              )
              : null;
            const affectedDeliveryCount = linkedDeliveryItems.length > 0
              ? linkedDeliveryItems.length
              : linkedDeliveryItem
                ? 1
                : 0;
            const linkedAccountAccessPlatforms = getAccountAccessPlatformsForReview(review);
            const isAccountAccessReview = linkedAccountAccessPlatforms.length > 0;
            const linkedAccountAccessEntries = linkedAccountAccessPlatforms
              .map((platform) => accountAccessEntriesByPlatform.get(platform))
              .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
            const contentLogicMomentKind = getContentLogicMomentKindForReview(review);
            const isContentLogicReview = Boolean(contentLogicMomentKind);
            const contentLogicMomentLabel = contentLogicMomentKind
              ? PRODUCER_CONTENT_LOGIC_MOMENT_LABELS[contentLogicMomentKind]
              : '';
            const decisionCopy = getDecisionCopyForReview(review);
            const isStatusDriver = statusDriverReview?.id === review.id;
            const isEconomyManagedReview = ECONOMY_MANAGED_REVIEW_TYPES.has(review.review_type)
              || review.target_entity_type === 'project_agreement';
            const isClientGroundingReview = isClientGroundingManagedReview(review);
            const isDeliveryManagedReview = Boolean(linkedDeliveryItem);
            const isMediaManagedReview = isClientGroundingReview || isContentLogicReview || isDeliveryManagedReview || isAccountAccessReview;
            const signatureTone = linkedAgreement?.google_signature
              ? getAgreementSignatureTone(linkedAgreement.google_signature)
              : null;
            const reviewMetaLine = [
              isContentLogicReview ? 'Content Logic' : isAccountAccessReview ? 'Kontotilgang' : getProducerReviewTypeLabel(review.review_type),
              isAccountAccessReview ? `Plattform: ${linkedAccountAccessPlatforms.map((platform) => PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform]).join(' · ')}` : '',
              isContentLogicReview ? `Fokus: ${contentLogicMomentLabel}` : entityLabel ? `Mål: ${entityLabel}` : '',
              review.due_at ? `Frist: ${new Date(review.due_at).toLocaleString('nb-NO')}` : '',
            ].filter(Boolean).join(' · ');
            const reviewContextLine = [
              isStatusDriver ? `Statusdriver (${projectStatusLabel})` : '',
              isContentLogicReview ? 'Klientavklaring før storyboard, manus og leveranse' : '',
              isAccountAccessReview ? 'Klientavklaring av sikker kontotilgang før publisering og handoff' : '',
              linkedDeliveryItem ? `Leveranse ${linkedDeliveryItem.channel} · ${linkedDeliveryItem.format}` : '',
              isEconomyManagedReview ? 'Økonomistyrt' : '',
              linkedAgreement ? getAgreementTypeLabel(linkedAgreement.agreement_type) : '',
              linkedAgreement ? `Avtale ${PROJECT_AGREEMENT_STATUS_LABELS[linkedAgreement.status]}` : '',
              linkedAgreement ? `${PROJECT_AGREEMENT_COUNTERPARTY_LABELS[linkedAgreement.counterparty_type as 'client' | 'extra'] ?? 'Motpart'}: ${linkedAgreement.counterparty_name}` : '',
            ].filter(Boolean).join(' · ');
            const reviewSignatureLine = linkedAgreement?.google_signature
              ? `Juridisk signatur · ${getAgreementSignatureLabel(linkedAgreement.google_signature)}`
              : '';
            const reviewComments = review.comments ?? [];
            const commentsExpanded = expandedCommentsByReview[review.id] ?? false;
            const visibleComments = commentsExpanded ? reviewComments : reviewComments.slice(-2);
            return (
              <Box
                key={review.id}
                ref={(node: HTMLDivElement | null) => { reviewRefs.current[review.id] = node; }}
                sx={{
                  borderRadius: 1.5,
                  border: highlightedReviewId === review.id
                    ? '1px solid rgba(251,191,36,0.52)'
                    : isContentLogicReview
                      ? '1px solid rgba(167,139,250,0.32)'
                      : isAccountAccessReview
                        ? '1px solid rgba(45,212,191,0.28)'
                      : '1px solid rgba(148,163,184,0.22)',
                  p: 1.25,
                  bgcolor: highlightedReviewId === review.id
                    ? 'rgba(251,191,36,0.08)'
                    : isContentLogicReview
                      ? 'rgba(76,29,149,0.15)'
                      : isAccountAccessReview
                        ? 'rgba(15,118,110,0.12)'
                      : 'rgba(15,23,42,0.55)',
                  boxShadow: highlightedReviewId === review.id
                    ? '0 0 0 1px rgba(251,191,36,0.12), 0 12px 32px rgba(2,6,23,0.22)'
                    : 'none',
                  transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                }}
              >
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" flexWrap="wrap">
                  <Box>
                    {isContentLogicReview ? (
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                        <Chip
                          size="small"
                          label="Content Logic"
                          sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#ede9fe' }}
                        />
                        <Chip
                          size="small"
                          label={contentLogicMomentLabel}
                          sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#cffafe' }}
                        />
                      </Stack>
                    ) : null}
                    {isAccountAccessReview ? (
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap sx={{ mb: 0.45 }}>
                        <Chip
                          size="small"
                          label="Kontotilgang"
                          sx={{ bgcolor: 'rgba(45,212,191,0.18)', color: '#ccfbf1' }}
                        />
                        {linkedAccountAccessPlatforms.map((platform) => (
                          <Chip
                            key={platform}
                            size="small"
                            label={PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[platform]}
                            sx={{ bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                          />
                        ))}
                      </Stack>
                    ) : null}
                    <Typography sx={{ color: '#fff', fontWeight: 700 }}>{review.title}</Typography>
                    <Typography sx={{ color: 'rgba(226,232,240,0.9)', fontSize: '0.82rem', mt: 0.22, lineHeight: 1.45 }}>
                      {reviewMetaLine}
                    </Typography>
                    {reviewContextLine ? (
                      <Typography sx={{ color: 'rgba(191,219,254,0.88)', fontSize: '0.78rem', mt: 0.28, lineHeight: 1.45 }}>
                        {reviewContextLine}
                      </Typography>
                    ) : null}
                    {reviewSignatureLine ? (
                      <Typography
                        sx={{
                          color: signatureTone?.color ?? 'rgba(226,232,240,0.82)',
                          fontSize: '0.78rem',
                          mt: 0.28,
                          lineHeight: 1.45,
                        }}
                      >
                        {reviewSignatureLine}
                      </Typography>
                    ) : null}
                  </Box>
                  <Chip
                    size="small"
                    label={getProducerReviewStatusLabel(review.status)}
                    sx={{
                      color: review.status === 'approved' ? '#34d399' : review.status === 'changes_requested' ? '#fbbf24' : review.status === 'rejected' ? '#f87171' : '#94a3b8',
                      border: '1px solid rgba(148,163,184,0.35)',
                      bgcolor: 'rgba(15,23,42,0.8)',
                    }}
                  />
                </Stack>

                {review.description && (
                  <Typography sx={{ color: isContentLogicReview ? 'rgba(233,213,255,0.92)' : isAccountAccessReview ? 'rgba(204,251,241,0.92)' : 'rgba(203,213,225,0.9)', fontSize: '0.9rem', mt: 1 }}>
                    {review.description}
                  </Typography>
                )}
                {isAccountAccessReview ? (
                  <Box
                    sx={{
                      mt: 0.9,
                      p: 0.95,
                      borderRadius: 1.2,
                      border: '1px solid rgba(45,212,191,0.2)',
                      bgcolor: 'rgba(15,23,42,0.42)',
                    }}
                  >
                    <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 800 }}>
                      Konto og tilgang i denne saken
                    </Typography>
                    <Stack spacing={0.5} sx={{ mt: 0.35 }}>
                      {linkedAccountAccessEntries.map((entry) => (
                        <Box key={entry.platform}>
                          <Typography sx={{ color: '#ccfbf1', fontSize: '0.78rem', fontWeight: 700 }}>
                            {`${PRODUCER_ACCOUNT_ACCESS_PLATFORM_LABELS[entry.platform]} · ${PRODUCER_ACCOUNT_ACCESS_STATUS_LABELS[entry.status]}`}
                          </Typography>
                          <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.76rem', mt: 0.18 }}>
                            {`${PRODUCER_ACCOUNT_ACCESS_METHOD_LABELS[entry.method]} · ${entry.accessScope || 'Scope ikke satt'}`}
                          </Typography>
                          <Typography sx={{ color: 'rgba(191,219,254,0.84)', fontSize: '0.75rem', mt: 0.18 }}>
                            {`Invite / konto: ${entry.inviteTarget || entry.accountLabel || 'Ikke satt'}${entry.clientOwnerLabel ? ` · Eier: ${entry.clientOwnerLabel}` : ''}`}
                          </Typography>
                        </Box>
                      ))}
                      <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.75rem', mt: 0.1 }}>
                        2-faktor skal bli hos kontoeier. Role Room skal bare styre invite, OAuth og status.
                      </Typography>
                    </Stack>
                  </Box>
                ) : null}
                {linkedDeliveryItem && linkedDeliveryVariantResolution ? (
                  <Box
                    sx={{
                      mt: 0.9,
                      p: 0.95,
                      borderRadius: 1.2,
                      border: '1px solid rgba(59,130,246,0.2)',
                      bgcolor: 'rgba(15,23,42,0.42)',
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} justifyContent="space-between">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 800 }}>
                          Logo i denne leveransen
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.76)', fontSize: '0.78rem', mt: 0.18 }}>
                          {`${linkedDeliveryItem.title} · ${linkedDeliveryItem.channel} · ${linkedDeliveryItem.format || 'Format ikke satt'}`}
                        </Typography>
                        <Typography sx={{ color: '#bfdbfe', fontSize: '0.78rem', fontWeight: 700, mt: 0.24 }}>
                          {`Brukes nå: ${linkedDeliveryVariantResolution.resolvedLabel}`}
                        </Typography>
                        <Typography sx={{ color: 'rgba(203,213,225,0.74)', fontSize: '0.76rem', mt: 0.18 }}>
                          {`${linkedDeliveryVariantResolution.selectionLabel} · Anbefalt: ${linkedDeliveryVariantResolution.recommendedLabel}${linkedDeliveryVariantResolution.autoApplied ? ' · auto aktiv' : ''}`}
                        </Typography>
                        {!linkedDeliveryVariantResolution.autoApplied ? (
                          <Typography sx={{ color: 'rgba(253,224,71,0.92)', fontSize: '0.75rem', mt: 0.24, fontWeight: 700 }}>
                            {`Denne overstyringen påvirker ${affectedDeliveryCount || 1} ${affectedDeliveryCount === 1 || affectedDeliveryCount === 0 ? 'leveranse' : 'leveranser'} i preview, handoff, PDF og eksportpakke.`}
                          </Typography>
                        ) : null}
                        {availableLogoVariantTypes.size === 0 ? (
                          <Typography sx={{ color: 'rgba(251,191,36,0.88)', fontSize: '0.75rem', mt: 0.24 }}>
                            Ingen logovarianter er lastet opp i merkevareguiden ennå.
                          </Typography>
                        ) : null}
                        {savingDeliveryLogoById[linkedDeliveryItem.id] ? (
                          <Typography sx={{ color: 'rgba(191,219,254,0.82)', fontSize: '0.74rem', mt: 0.24 }}>
                            Lagrer logovalg for leveransen...
                          </Typography>
                        ) : null}
                      </Box>
                      <FormControl
                        size="small"
                        sx={{ minWidth: { xs: '100%', md: 220 } }}
                        disabled={!canAdjustDeliveryLogoSelection || availableLogoVariantTypes.size === 0 || Boolean(savingDeliveryLogoById[linkedDeliveryItem.id])}
                      >
                        <InputLabel
                          id={`delivery-logo-selection-label-${review.id}`}
                          sx={{ color: 'rgba(226,232,240,0.82)' }}
                        >
                          Logovalg
                        </InputLabel>
                        <Select
                          labelId={`delivery-logo-selection-label-${review.id}`}
                          value={linkedDeliveryItem.logoVariantSelection ?? 'auto'}
                          label="Logovalg"
                          onChange={(event) => {
                            void handleDeliveryLogoVariantSelection(
                              linkedDeliveryItem.id,
                              event.target.value as ProducerBrandLogoVariantSelection,
                            );
                          }}
                          sx={{
                            color: '#f8fafc',
                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.28)' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(96,165,250,0.42)' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(96,165,250,0.65)' },
                          }}
                        >
                          {DELIVERY_LOGO_SELECTION_OPTIONS.map((option) => (
                            <MenuItem
                              key={option.value}
                              value={option.value}
                              disabled={option.value !== 'auto' && !availableLogoVariantTypes.has(option.value)}
                            >
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>
                ) : null}
                {isContentLogicReview ? (
                  <Typography sx={{ color: 'rgba(191,219,254,0.86)', fontSize: '0.8rem', mt: 0.65, fontWeight: 600 }}>
                    Denne avklaringen styrer hvordan hook, budskap og CTA faktisk blir behandlet i innholdsproduksjonen.
                  </Typography>
                ) : null}
                {isStatusDriver ? (
                  <Typography sx={{ color: '#fde68a', fontSize: '0.82rem', mt: 0.7, fontWeight: 600 }}>
                    Denne saken er det som akkurat nå styrer prosjektstatusen.
                  </Typography>
                ) : null}
                {linkedAgreement?.google_signature ? (
                  <Typography
                    sx={{
                      color: signatureTone?.color ?? 'rgba(226,232,240,0.82)',
                      fontSize: '0.82rem',
                      mt: 0.65,
                      fontWeight: 600,
                    }}
                  >
                    {linkedAgreement.google_signature.status === 'signed'
                      ? 'Juridisk signatur er fullført og låst på avtalen.'
                      : linkedAgreement.google_signature.status === 'changes_requested'
                        ? 'Google-signaturflyten har bedt om endringer før avtalen kan fullføres.'
                        : linkedAgreement.google_signature.status === 'rejected'
                          ? 'Google-signaturflyten er avvist og må avklares før prosjektet går videre.'
                          : 'Juridisk signering pågår fortsatt. Reviewgodkjenning og signatur holdes derfor som to separate steg.'}
                  </Typography>
                ) : null}

                {(isMediaManagedReview ? onOpenMedia : (onOpenEconomy || onOpenTimeline)) && (
                  <Stack spacing={0.55} sx={{ mt: 0.9 }}>
                    <Typography
                      sx={{
                        color: clientInviteEmailStatus.tone === 'ready' ? 'rgba(167,243,208,0.92)' : 'rgba(253,224,71,0.92)',
                        fontSize: '0.78rem',
                        lineHeight: 1.4,
                      }}
                    >
                      {clientInviteEmailStatus.text}
                    </Typography>
                    <Stack direction="row" spacing={0.3} flexWrap="wrap" useFlexGap>
                      {isMediaManagedReview && onOpenMedia ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => onOpenMedia(getWorkspaceFocusForReview(review))}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          {isContentLogicReview
                            ? 'Åpne Content Logic'
                            : isAccountAccessReview
                              ? 'Åpne kontotilgang'
                            : isDeliveryManagedReview
                              ? 'Åpne merkevare og leveranse'
                              : 'Åpne relevant arbeidsflate'}
                        </Button>
                      ) : null}
                      {!isMediaManagedReview && onOpenEconomy ? (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => openEconomyFocus(review)}
                          sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                        >
                          Åpne i økonomi
                        </Button>
                      ) : null}
                      {!isMediaManagedReview && onOpenTimeline ? (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => openTimelineFocus(review)}
                          sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(226,232,240,0.92)', minHeight: 44 }}
                        >
                          Åpne i tidslinje
                        </Button>
                      ) : null}
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => { void handleCopyReviewPortalUrl(review); }}
                        sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.92)', minHeight: 44 }}
                      >
                        Kopier godkjenningslenke
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => { void handleCopyReviewClientInviteText(review); }}
                        sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.92)', minHeight: 44 }}
                      >
                        Kopier klienttekst
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleOpenReviewClientInviteMail(review)}
                        sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.92)', minHeight: 44 }}
                      >
                        Åpne e-postutkast
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleOpenReviewPortal(review)}
                        sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.92)', minHeight: 44 }}
                      >
                        Åpne klientlenke
                      </Button>
                    </Stack>
                  </Stack>
                )}

                {reviewComments.length > 0 ? (
                  <Stack spacing={0.45} sx={{ mt: 0.9 }}>
                    <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography sx={{ color: 'rgba(191,219,254,0.9)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Kommentarer
                      </Typography>
                      <Typography sx={{ color: 'rgba(203,213,225,0.88)', fontSize: '0.76rem' }}>
                        {`${reviewComments.length} ${reviewComments.length === 1 ? 'innspill' : 'innspill'}`}
                      </Typography>
                      {reviewComments.length > 2 ? (
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => setExpandedCommentsByReview((previous) => ({
                            ...previous,
                            [review.id]: !commentsExpanded,
                          }))}
                          sx={{ minWidth: 0, px: 0.8, textTransform: 'none', fontWeight: 700, color: 'rgba(191,219,254,0.92)', minHeight: 44 }}
                        >
                          {commentsExpanded ? 'Vis færre' : 'Vis alle'}
                        </Button>
                      ) : null}
                    </Stack>
                    <Stack spacing={0.35}>
                      {visibleComments.map((comment) => (
                        <Box key={comment.id} sx={{ p: 0.6, borderRadius: 1, bgcolor: 'rgba(2,6,23,0.42)' }}>
                          <Typography sx={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.4 }}>{comment.comment_text}</Typography>
                          <Typography sx={{ color: 'rgba(148,163,184,0.76)', fontSize: '0.72rem', mt: 0.18 }}>
                            {comment.author_role || 'ukjent'} • {new Date(comment.created_at).toLocaleString('nb-NO')}
                            {typeof comment.timestamp_seconds === 'number' ? ` • ${formatProducerTimestamp(comment.timestamp_seconds)}` : ''}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                ) : null}

                {canComment && (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={0.8} sx={{ mt: 0.9 }}>
                      <TextField
                        size="small"
                        placeholder="Skriv kommentar"
                        inputProps={{ 'aria-label': `Kommentar til ${review.title}` }}
                        value={commentDraftByReview[review.id] ?? ''}
                        onChange={(event) => setCommentDraftByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Tid (mm:ss)"
                        inputProps={{ 'aria-label': `Tidskode for kommentar til ${review.title}` }}
                        value={commentTimestampByReview[review.id] ?? ''}
                        onChange={(event) => setCommentTimestampByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                        sx={{ width: { xs: '100%', md: 140 } }}
                      />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => { void handleComment(review.id); }}
                      disabled={!commentDraftByReview[review.id]?.trim()}
                      sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                    >
                      Kommenter
                    </Button>
                  </Stack>
                )}

                {isClientGroundingReview ? (
                  <Alert severity="info" sx={{ mt: 1, bgcolor: 'rgba(59,130,246,0.08)', color: '#dbeafe' }}>
                    Denne saken oppdateres automatisk når klienten fyller inn briefen eller laster opp materiale.
                  </Alert>
                ) : null}

                {canDecide && decisionOptions.length > 0 && !isClientGroundingReview && (
                  <Stack spacing={1} sx={{ mt: 1 }}>
                    {decisionCopy.helper ? (
                      <Typography sx={{ color: 'rgba(191,219,254,0.86)', fontSize: '0.78rem' }}>
                        {decisionCopy.helper}
                      </Typography>
                    ) : null}
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {decisionOptions.map((decisionOption) => (
                        <Button
                          key={decisionOption.value}
                          size="small"
                          variant="outlined"
                          onClick={() => { void handleDecision(review, decisionOption.value); }}
                          sx={{
                            textTransform: 'none',
                            borderColor: `${decisionOption.color}55`,
                            color: decisionOption.color,
                            '&:hover': { borderColor: decisionOption.color, bgcolor: `${decisionOption.color}18` },
                            minHeight: 44,
                          }}
                        >
                          {decisionCopy.labels[decisionOption.value]}
                        </Button>
                      ))}
                    </Stack>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                      <TextField
                        size="small"
                        placeholder={decisionCopy.placeholder}
                        inputProps={{ 'aria-label': `Beslutningsnotat for ${review.title}` }}
                        value={decisionReasonByReview[review.id] ?? ''}
                        onChange={(event) => setDecisionReasonByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        placeholder="Tid (mm:ss)"
                        inputProps={{ 'aria-label': `Tidskode for beslutning på ${review.title}` }}
                        value={decisionTimestampByReview[review.id] ?? ''}
                        onChange={(event) => setDecisionTimestampByReview((prev) => ({ ...prev, [review.id]: event.target.value }))}
                        sx={{ width: { xs: '100%', md: 140 } }}
                      />
                    </Stack>
                  </Stack>
                )}
              </Box>
            );
          })
        )}
      </Stack>
    </Box>
  );
}
