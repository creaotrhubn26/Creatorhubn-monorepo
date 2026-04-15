// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
  Launch as LaunchIcon,
  Save as SaveIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useProducerTimeline } from '../../hooks/useProducerTimeline';
import { useProjectProductionEstimate } from '../../hooks/useProjectProductionEstimate';
import type { ProducerPhase, ProducerTimelineItem } from '../../services/producerWorkflowService';
import {
  onProducerWorkflowFocusEvent,
  type ProducerWorkflowApprovalTemplate,
  type ProducerWorkflowFocusPayload,
} from '../../services/producerWorkflowFocusEvents';
import {
  getProducerEntityTypeLabel,
  getProducerTimelineStatusLabel,
  type ProducerWorkflowEntityOption,
  type ProducerWorkflowOwnerOption,
} from '../../utils/producerWorkflow';
import type {
  CastingProject,
  ProductionDay,
  ProductionPhase,
  RoleRoomGoogleAgreementSignatureStatus,
  ShotList,
} from '../../models/casting';
import type { ClientPortalWorkspaceFocus } from '../../utils/clientPortal';
import { PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS } from '../../utils/projectAgreements';
import {
  getProducerWorkspaceLocationForSurface,
  normalizeProducerProjectPlanning,
} from '../../utils/producerProjectPlanning';
import ProducerClientPlanningPanel from './ProducerClientPlanningPanel';

interface ProducerTimelinePanelProps {
  projectId: string;
  readOnly?: boolean;
  entityOptions?: ProducerWorkflowEntityOption[];
  ownerOptions?: ProducerWorkflowOwnerOption[];
  onProjectUpdated?: (project: CastingProject) => Promise<void> | void;
  onOpenReviews?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenEconomy?: (focus?: Partial<ProducerWorkflowFocusPayload>) => void;
  onOpenShotList?: (focus?: { phase?: ProducerPhase | 'all'; shotListId?: string }) => void;
  onOpenMedia?: (focus?: ClientPortalWorkspaceFocus) => void;
}

const PHASE_LABELS: Record<ProducerPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjonsdag',
  postproduction: 'Post-produksjon',
};

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Planlagt' },
  { value: 'in_progress', label: 'Pågår' },
  { value: 'blocked', label: 'Blokkert' },
  { value: 'completed', label: 'Fullført' },
] as const;

const EMPTY_ENTITY_OPTIONS: ProducerWorkflowEntityOption[] = [];
const EMPTY_OWNER_OPTIONS: ProducerWorkflowOwnerOption[] = [];
const MS_PER_DAY = 86_400_000;

type TimelineStatusCounts = Record<(typeof STATUS_OPTIONS)[number]['value'], number>;

type ShotListReadinessSummary = {
  phase: ProducerPhase;
  label: string;
  shotListCount: number;
  actionableCount: number;
  priorityScore: number;
  heading: string;
  summary: string;
  tone: 'neutral' | 'warning' | 'danger' | 'success';
  actionLabel?: string;
  actionTarget?: 'shotlist' | 'reviews';
};

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

const normalizeFocusedPhase = (value: unknown): ProducerPhase | 'all' | undefined => {
  if (value === 'preproduction' || value === 'production' || value === 'postproduction' || value === 'all') {
    return value;
  }
  return undefined;
};

const normalizeApprovalTemplate = (value: unknown): ProducerWorkflowApprovalTemplate | undefined => {
  if (value === 'storyboard' || value === 'manuscript' || value === 'shotlist') {
    return value;
  }
  return undefined;
};

const isProjectWorkflowStatusItem = (metadata: Record<string, unknown>): boolean => (
  readFirstNonEmptyString(metadata.source) === 'project-workflow-status'
);

const normalizeTimelineStatusValue = (
  value?: string | null,
): (typeof STATUS_OPTIONS)[number]['value'] => {
  if (value === 'completed' || value === 'approved') {
    return 'completed';
  }
  if (value === 'in_progress') {
    return 'in_progress';
  }
  if (value === 'blocked' || value === 'changes_requested' || value === 'rejected') {
    return 'blocked';
  }
  return 'planned';
};

const normalizeProductionPhase = (value: unknown): ProductionPhase | undefined => {
  if (value === 'planning' || value === 'shooting' || value === 'review' || value === 'delivery') {
    return value;
  }
  return undefined;
};

const normalizeAgreementSignatureStatus = (
  value: unknown,
): RoleRoomGoogleAgreementSignatureStatus | null => {
  if (
    value === 'not_started'
    || value === 'prepared'
    || value === 'sent'
    || value === 'opened_in_google'
    || value === 'signed'
    || value === 'rejected'
    || value === 'changes_requested'
    || value === 'error'
  ) {
    return value;
  }
  return null;
};

const getAgreementSignatureStyles = (
  status: RoleRoomGoogleAgreementSignatureStatus,
): { background: string; color: string; border: string } => {
  if (status === 'signed') {
    return {
      background: 'rgba(16,185,129,0.16)',
      color: '#86efac',
      border: 'rgba(52,211,153,0.32)',
    };
  }
  if (status === 'rejected' || status === 'changes_requested' || status === 'error') {
    return {
      background: 'rgba(248,113,113,0.16)',
      color: '#fecaca',
      border: 'rgba(248,113,113,0.32)',
    };
  }
  if (status === 'sent' || status === 'opened_in_google') {
    return {
      background: 'rgba(251,191,36,0.16)',
      color: '#fde68a',
      border: 'rgba(251,191,36,0.32)',
    };
  }
  return {
    background: 'rgba(96,165,250,0.16)',
    color: '#bfdbfe',
    border: 'rgba(96,165,250,0.32)',
  };
};

const readIsoDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toDayDistance = (value?: string | null): number | null => {
  const date = readIsoDate(value);
  if (!date) {
    return null;
  }
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_DAY);
};

const getShotListResolvedPhase = (
  shotList: ShotList,
  productionDay: ProductionDay | undefined,
): ProducerPhase => {
  const explicitPhase = normalizeProductionPhase(shotList.productionPhase);
  if (explicitPhase === 'planning') {
    return 'preproduction';
  }
  if (explicitPhase === 'shooting') {
    return 'production';
  }
  if (explicitPhase === 'review' || explicitPhase === 'delivery') {
    return 'postproduction';
  }

  const shots = Array.isArray(shotList.shots) ? shotList.shots : [];
  const hasShots = shots.length > 0;
  const allShotsCompleted = hasShots && shots.every((shot) => shot.status === 'completed');

  if (allShotsCompleted) {
    return 'postproduction';
  }
  if (productionDay) {
    return 'production';
  }
  return 'preproduction';
};

const getPhaseAccentStyles = (
  tone: ShotListReadinessSummary['tone'],
  emphasized = false,
): Record<string, string> => {
  if (tone === 'danger') {
    return {
      border: emphasized ? 'rgba(248,113,113,0.56)' : 'rgba(248,113,113,0.3)',
      background: emphasized ? 'rgba(127,29,29,0.24)' : 'rgba(127,29,29,0.14)',
      chipBackground: 'rgba(248,113,113,0.14)',
      chipColor: '#fecaca',
    };
  }
  if (tone === 'warning') {
    return {
      border: emphasized ? 'rgba(251,191,36,0.56)' : 'rgba(251,191,36,0.3)',
      background: emphasized ? 'rgba(120,53,15,0.24)' : 'rgba(120,53,15,0.14)',
      chipBackground: 'rgba(251,191,36,0.16)',
      chipColor: '#fde68a',
    };
  }
  if (tone === 'success') {
    return {
      border: emphasized ? 'rgba(74,222,128,0.5)' : 'rgba(74,222,128,0.28)',
      background: emphasized ? 'rgba(20,83,45,0.24)' : 'rgba(20,83,45,0.14)',
      chipBackground: 'rgba(74,222,128,0.16)',
      chipColor: '#bbf7d0',
    };
  }
  return {
    border: emphasized ? 'rgba(56,189,248,0.45)' : 'rgba(148,163,184,0.22)',
    background: emphasized ? 'rgba(14,116,144,0.22)' : 'rgba(15,23,42,0.45)',
    chipBackground: 'rgba(148,163,184,0.16)',
    chipColor: '#cbd5e1',
  };
};

const formatMinutes = (minutes: number): string => {
  if (minutes <= 0) {
    return '0 min';
  }
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours <= 0) {
    return `${remainder} min`;
  }
  if (remainder <= 0) {
    return `${hours} t`;
  }
  return `${hours} t ${remainder} min`;
};

export default function ProducerTimelinePanel({
  projectId,
  readOnly = false,
  entityOptions = EMPTY_ENTITY_OPTIONS,
  ownerOptions = EMPTY_OWNER_OPTIONS,
  onProjectUpdated,
  onOpenReviews,
  onOpenEconomy,
  onOpenShotList,
  onOpenMedia,
}: ProducerTimelinePanelProps) {
  const { groupedByPhase, loading, error, createItem, updateItem, removeItem } = useProducerTimeline(projectId);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [phase, setPhase] = useState<ProducerPhase>('preproduction');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [itemStatus, setItemStatus] = useState<(typeof STATUS_OPTIONS)[number]['value']>('planned');
  const [linkedEntityType, setLinkedEntityType] = useState('');
  const [linkedEntityId, setLinkedEntityId] = useState('');
  const [statusDraftById, setStatusDraftById] = useState<Record<string, string>>({});
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<ProducerWorkflowFocusPayload | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const {
    project,
    shotLists,
    productionDays,
    productionEstimate,
    error: planningError,
  } = useProjectProductionEstimate({ projectId });
  const producerPlanning = useMemo(
    () => (project ? normalizeProducerProjectPlanning(project) : null),
    [project],
  );

  const totalItems = useMemo(
    () => groupedByPhase.preproduction.length + groupedByPhase.production.length + groupedByPhase.postproduction.length,
    [groupedByPhase],
  );
  const statusSummary = useMemo(() => {
    const counters = {
      planned: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
    };
    for (const phaseKey of Object.keys(groupedByPhase) as ProducerPhase[]) {
      for (const item of groupedByPhase[phaseKey]) {
        const normalizedStatus = normalizeTimelineStatusValue(item.status);
        if (normalizedStatus === 'completed') counters.completed += 1;
        else if (normalizedStatus === 'in_progress') counters.in_progress += 1;
        else if (normalizedStatus === 'blocked') counters.blocked += 1;
        else counters.planned += 1;
      }
    }
    return counters;
  }, [groupedByPhase]);
  const completionPct = totalItems > 0 ? Math.round((statusSummary.completed / totalItems) * 100) : 0;

  const timelineStatusByPhase = useMemo(() => (
    (Object.keys(PHASE_LABELS) as ProducerPhase[]).reduce<Record<ProducerPhase, TimelineStatusCounts>>((acc, phaseKey) => {
      acc[phaseKey] = {
        planned: 0,
        in_progress: 0,
        blocked: 0,
        completed: 0,
      };
      groupedByPhase[phaseKey].forEach((item) => {
        const nextStatus = normalizeTimelineStatusValue(item.status);
        acc[phaseKey][nextStatus] += 1;
      });
      return acc;
    }, {
      preproduction: { planned: 0, in_progress: 0, blocked: 0, completed: 0 },
      production: { planned: 0, in_progress: 0, blocked: 0, completed: 0 },
      postproduction: { planned: 0, in_progress: 0, blocked: 0, completed: 0 },
    })
  ), [groupedByPhase]);

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
    if (!linkedEntityType) {
      return entityOptions;
    }
    return entityOptions.filter((option) => option.entityType === linkedEntityType);
  }, [entityOptions, linkedEntityType]);

  const ownerLookup = useMemo(() => {
    return new Map(ownerOptions.map((option) => [option.value, option]));
  }, [ownerOptions]);

  const entityLookup = useMemo(() => {
    return new Map(entityOptions.map((option) => [`${option.entityType}:${option.entityId}`, option]));
  }, [entityOptions]);

  const allTimelineItems = useMemo(
    () => [...groupedByPhase.preproduction, ...groupedByPhase.production, ...groupedByPhase.postproduction],
    [groupedByPhase],
  );

  const productionDayBySceneId = useMemo(() => {
    const lookup = new Map<string, ProductionDay>();
    productionDays.forEach((day) => {
      (day.scenes ?? []).forEach((sceneId) => {
        if (typeof sceneId === 'string' && sceneId.trim().length > 0 && !lookup.has(sceneId)) {
          lookup.set(sceneId, day);
        }
      });
    });
    return lookup;
  }, [productionDays]);

  const shotListProductionDays = useMemo(() => {
    const lookup = new Map<string, ProductionDay>();
    shotLists.forEach((shotList) => {
      const productionDay = productionDayBySceneId.get(shotList.sceneId);
      if (productionDay) {
        lookup.set(shotList.id, productionDay);
      }
    });
    return lookup;
  }, [productionDayBySceneId, shotLists]);

  const latestShotListReview = useMemo(() => {
    const shotListReviewItems = allTimelineItems.filter((item) => {
      const metadata = asRecord(item.metadata);
      return readFirstNonEmptyString(
        metadata.targetEntityType,
        metadata.approvalTemplate,
        item.linked_entity_type,
      ) === 'shotlist';
    });

    if (shotListReviewItems.length === 0) {
      return null;
    }

    const sorted = [...shotListReviewItems].sort((left, right) => {
      const leftDate = readIsoDate(left.updated_at ?? left.due_at)?.getTime() ?? 0;
      const rightDate = readIsoDate(right.updated_at ?? right.due_at)?.getTime() ?? 0;
      return rightDate - leftDate;
    });
    return sorted[0] ?? null;
  }, [allTimelineItems]);
  const getMediaFocusForItem = useCallback((item: ProducerTimelineItem): ClientPortalWorkspaceFocus => {
    const metadata = asRecord(item.metadata);
    const meetingItemId = readFirstNonEmptyString(metadata.meetingItemId, metadata.meeting_item_id);
    const meetingItemType = readFirstNonEmptyString(metadata.meetingItemType, metadata.meeting_item_type);
    const targetEntityType = readFirstNonEmptyString(
      metadata.groundingEntity,
      metadata.targetEntityType,
      item.linked_entity_type,
    );
    const workspace = targetEntityType === 'client_material'
      ? 'materials'
      : targetEntityType === 'storyboard' || targetEntityType === 'storyboard_frame'
        ? 'storyboard'
      : targetEntityType === 'manuscript' || targetEntityType === 'manuscript_scene' || targetEntityType === 'dialogue_line'
        ? 'manuscript'
      : targetEntityType === 'shotlist' || targetEntityType === 'shot'
        ? 'shotlist'
      : targetEntityType === 'meeting_decision' || targetEntityType === 'meeting_follow_up'
        ? 'meetings'
      : targetEntityType === 'project_agreement'
        ? 'delivery'
        : 'brief';
    const location = getProducerWorkspaceLocationForSurface(producerPlanning?.workspaceNavigation, workspace);
    const agreementId = readFirstNonEmptyString(metadata.agreementId, item.linked_entity_id);
    const agreementArtifactId = readFirstNonEmptyString(
      metadata.googleSignatureSignedPdfArtifactId,
      metadata.googleSignaturePdfSnapshotArtifactId,
      metadata.googleSignatureSourceArtifactId,
      metadata.googleSignatureAuditArtifactId,
    );
    return {
      workspace,
      sectionId: location?.sectionId,
      pageId: location?.pageId,
      artifactId: targetEntityType === 'meeting_decision'
        ? (meetingItemId ? `meeting-decision:${meetingItemId}` : undefined)
        : targetEntityType === 'meeting_follow_up'
          ? (meetingItemId ? `meeting-follow-up:${meetingItemId}` : undefined)
        : targetEntityType === 'project_agreement'
        ? agreementArtifactId ?? (agreementId ? `agreement:${agreementId}` : undefined)
        : targetEntityType === 'client_material'
          ? readFirstNonEmptyString(item.linked_entity_id, metadata.targetEntityId)
          : meetingItemType === 'decision'
            ? (meetingItemId ? `meeting-decision:${meetingItemId}` : undefined)
            : meetingItemType === 'follow_up'
              ? (meetingItemId ? `meeting-follow-up:${meetingItemId}` : undefined)
          : undefined,
    };
  }, [producerPlanning?.workspaceNavigation]);

  const shotListReadiness = useMemo<ShotListReadinessSummary[]>(() => {
    const byPhase = {
      preproduction: shotLists.filter((shotList) => getShotListResolvedPhase(shotList, shotListProductionDays.get(shotList.id)) === 'preproduction'),
      production: shotLists.filter((shotList) => getShotListResolvedPhase(shotList, shotListProductionDays.get(shotList.id)) === 'production'),
      postproduction: shotLists.filter((shotList) => getShotListResolvedPhase(shotList, shotListProductionDays.get(shotList.id)) === 'postproduction'),
    } satisfies Record<ProducerPhase, ShotList[]>;

    const summaries: ShotListReadinessSummary[] = (Object.keys(PHASE_LABELS) as ProducerPhase[]).map((phaseKey) => {
      const phaseShotLists = byPhase[phaseKey];
      const timelineCounts = timelineStatusByPhase[phaseKey];

      if (phaseKey === 'preproduction') {
        const missingProductionDay = phaseShotLists.filter((shotList) => !shotListProductionDays.get(shotList.id));
        const missingDeadline = phaseShotLists.filter((shotList) => !readFirstNonEmptyString(shotList.deadline));
        const emptyShotLists = phaseShotLists.filter((shotList) => !Array.isArray(shotList.shots) || shotList.shots.length === 0);
        const unscheduledLoad = productionEstimate.productionDayLoads.find((item) => item.dayId === 'unscheduled');
        const actionableCount = new Set([
          ...missingProductionDay.map((shotList) => shotList.id),
          ...missingDeadline.map((shotList) => shotList.id),
          ...emptyShotLists.map((shotList) => shotList.id),
        ]).size;

        if (phaseShotLists.length === 0) {
          return {
            phase: phaseKey,
            label: PHASE_LABELS[phaseKey],
            shotListCount: 0,
            actionableCount: 0,
            priorityScore: timelineCounts.blocked * 8 + timelineCounts.in_progress * 3 + timelineCounts.planned,
            heading: 'Ingen shotlister låst for pre-produksjon ennå',
            summary: 'Når shotlisten bygges her, blir planlegging, klientforventning og opptaksdag enklere å holde synkronisert.',
            tone: timelineCounts.blocked > 0 ? 'warning' : 'neutral',
            actionLabel: onOpenShotList ? 'Åpne shotlist' : undefined,
            actionTarget: onOpenShotList ? 'shotlist' : undefined,
          };
        }

        return {
          phase: phaseKey,
          label: PHASE_LABELS[phaseKey],
          shotListCount: phaseShotLists.length,
          actionableCount,
          priorityScore: actionableCount * 7
            + (unscheduledLoad?.realisticFieldMinutes ?? 0) / 18
            + timelineCounts.blocked * 8
            + timelineCounts.in_progress * 3
            + timelineCounts.planned,
          heading: actionableCount > 0 ? 'Lås plan og ansvar før opptak' : 'Pre-produksjonen er planlagt',
          summary: actionableCount > 0
            ? `${missingProductionDay.length} mangler opptaksdag, ${missingDeadline.length} mangler frist, ${emptyShotLists.length} mangler ferdig shotliste og ${formatMinutes(unscheduledLoad?.realisticFieldMinutes ?? 0)} står fortsatt uten plass i planen.`
            : `Shotlist, frister og opptaksdager er koblet før produksjonen starter. Anbefalt opptaksramme er ${productionEstimate.suggestedShootDays} dager.`,
          tone: actionableCount > 0 || timelineCounts.blocked > 0 ? 'warning' : 'success',
          actionLabel: onOpenShotList ? 'Åpne shotlist' : undefined,
          actionTarget: onOpenShotList ? 'shotlist' : undefined,
        };
      }

      if (phaseKey === 'production') {
        const activeShotLists = phaseShotLists.filter((shotList) => {
          const shots = Array.isArray(shotList.shots) ? shotList.shots : [];
          return shots.length > 0 && shots.some((shot) => shot.status !== 'completed');
        });
        const overdue = activeShotLists.filter((shotList) => {
          const daysUntil = toDayDistance(shotListProductionDays.get(shotList.id)?.date);
          return daysUntil !== null && daysUntil < 0;
        });
        const approaching = activeShotLists.filter((shotList) => {
          const daysUntil = toDayDistance(shotListProductionDays.get(shotList.id)?.date);
          return daysUntil !== null && daysUntil >= 0 && daysUntil <= 3;
        });
        const withoutOwner = activeShotLists.filter((shotList) => shotList.shots.some((shot) => !shot.assigneeId && !shot.reservedBy));
        const withoutEstimate = activeShotLists.filter((shotList) => shotList.shots.some((shot) => !shot.estimatedTime));
        const overloadedDays = productionEstimate.productionDayLoads.filter((item) => item.status === 'overloaded');
        const tightDays = productionEstimate.productionDayLoads.filter((item) => item.status === 'tight');
        const actionableCount = new Set([
          ...overdue.map((shotList) => shotList.id),
          ...approaching.map((shotList) => shotList.id),
          ...withoutOwner.map((shotList) => shotList.id),
          ...withoutEstimate.map((shotList) => shotList.id),
        ]).size;

        return {
          phase: phaseKey,
          label: PHASE_LABELS[phaseKey],
          shotListCount: phaseShotLists.length,
          actionableCount,
          priorityScore: overdue.length * 12
            + overloadedDays.length * 14
            + tightDays.length * 8
            + approaching.length * 8
            + actionableCount * 5
            + timelineCounts.blocked * 8
            + timelineCounts.in_progress * 4,
            heading: overdue.length > 0
              ? 'Opptaksplanen har sklidd'
              : overloadedDays.length > 0
              ? 'Produksjonsdagen er tyngre enn planen tåler'
            : actionableCount > 0
              ? 'Klargjør shotlisten før neste opptaksvindu'
              : 'Produksjonsdagen er under kontroll',
          summary: actionableCount > 0
            ? `${overdue.length} er over tid, ${approaching.length} nærmer seg opptak, ${withoutOwner.length} mangler ansvarlig, ${withoutEstimate.length} mangler tidsestimat og ${overloadedDays.length} opptaksdager er overbooket mot realistisk belastning.`
            : `Aktive scener har opptaksdag, ansvarlig og estimert tid på plass. Samlet feltbelastning er ${formatMinutes(productionEstimate.totalRealisticFieldMinutes)}.`,
          tone: overdue.length > 0 || overloadedDays.length > 0 || timelineCounts.blocked > 0 ? 'danger' : actionableCount > 0 ? 'warning' : 'success',
          actionLabel: onOpenShotList ? 'Åpne shotlist' : undefined,
          actionTarget: onOpenShotList ? 'shotlist' : undefined,
        };
      }

      const completedShotLists = phaseShotLists.filter((shotList) => {
        const shots = Array.isArray(shotList.shots) ? shotList.shots : [];
        return shots.length > 0 && shots.every((shot) => shot.status === 'completed');
      });
      const latestReviewStatus = latestShotListReview
        ? readFirstNonEmptyString(asRecord(latestShotListReview.metadata).reviewStatus, latestShotListReview.status)
        : undefined;
      const waitingForClient = completedShotLists.length > 0 && latestReviewStatus !== 'completed';
      const changesRequested = latestReviewStatus === 'blocked';
      const actionableCount = completedShotLists.length > 0 && waitingForClient ? completedShotLists.length : 0;

      return {
        phase: phaseKey,
        label: PHASE_LABELS[phaseKey],
        shotListCount: phaseShotLists.length,
        actionableCount,
        priorityScore: (changesRequested ? 16 : 0) + (waitingForClient ? 10 : 0) + timelineCounts.blocked * 8 + timelineCounts.in_progress * 4,
        heading: changesRequested
          ? 'Klienten venter på oppdatert leveranse'
          : waitingForClient
            ? 'Shotlisten er klar for klientgjennomgang'
            : completedShotLists.length > 0
              ? 'Post-produksjonen er klar for overlevering'
              : 'Post-produksjonen starter når opptaket er ferdig',
        summary: changesRequested
          ? 'Shotlist-godkjenningen har bedt om endringer. Hold post og klientsamarbeid i samme løp før levering.'
          : waitingForClient
            ? `Ferdige scener bør sendes til klient før endringer og eksport bygger seg opp i etterkant. Hovedleveransen er estimert til ${Math.floor((productionEstimate.formatEstimates.find((item) => item.emphasis === 'primary')?.estimatedSeconds ?? 0) / 60)}:${String((productionEstimate.formatEstimates.find((item) => item.emphasis === 'primary')?.estimatedSeconds ?? 0) % 60).padStart(2, '0')}.`
            : completedShotLists.length > 0
              ? 'Ferdige shotlister, klientgodkjenning og levering ligger på linje.'
              : 'Når scener blir ferdigstilt, bør godkjenning og levering styres videre herfra.',
        tone: changesRequested || timelineCounts.blocked > 0 ? 'danger' : waitingForClient ? 'warning' : completedShotLists.length > 0 ? 'success' : 'neutral',
        actionLabel: waitingForClient || changesRequested
          ? (onOpenReviews ? 'Åpne klientsamarbeid' : undefined)
          : (onOpenShotList ? 'Åpne shotlist' : undefined),
        actionTarget: waitingForClient || changesRequested
          ? (onOpenReviews ? 'reviews' : undefined)
          : (onOpenShotList ? 'shotlist' : undefined),
      };
    });

    return summaries.sort((left, right) => right.priorityScore - left.priorityScore);
  }, [allTimelineItems, latestShotListReview, onOpenReviews, onOpenShotList, productionEstimate, shotListProductionDays, shotLists, timelineStatusByPhase]);

  const phaseReadinessByPhase = useMemo(() => (
    shotListReadiness.reduce<Record<ProducerPhase, ShotListReadinessSummary>>((acc, summary) => {
      acc[summary.phase] = summary;
      return acc;
    }, {
      preproduction: {
        phase: 'preproduction',
        label: PHASE_LABELS.preproduction,
        shotListCount: 0,
        actionableCount: 0,
        priorityScore: 0,
        heading: '',
        summary: '',
        tone: 'neutral',
      },
      production: {
        phase: 'production',
        label: PHASE_LABELS.production,
        shotListCount: 0,
        actionableCount: 0,
        priorityScore: 0,
        heading: '',
        summary: '',
        tone: 'neutral',
      },
      postproduction: {
        phase: 'postproduction',
        label: PHASE_LABELS.postproduction,
        shotListCount: 0,
        actionableCount: 0,
        priorityScore: 0,
        heading: '',
        summary: '',
        tone: 'neutral',
      },
    })
  ), [shotListReadiness]);

  const handleCreate = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    await createItem({
      phase,
      title: nextTitle,
      description: description.trim() || undefined,
      ownerUserId: ownerUserId.trim() || undefined,
      dueAt: dueAt || undefined,
      status: itemStatus,
      linkedEntityType: linkedEntityType || undefined,
      linkedEntityId: linkedEntityId.trim() || undefined,
    });
    setTitle('');
    setDescription('');
    setOwnerUserId('');
    setDueAt('');
    setItemStatus('planned');
    setLinkedEntityType('');
    setLinkedEntityId('');
  };

  const handleStatusDraftChange = (itemId: string, nextStatus: string) => {
    setStatusDraftById((prev) => ({ ...prev, [itemId]: nextStatus }));
  };

  const handleSaveItemStatus = async (itemId: string) => {
    const nextStatus = statusDraftById[itemId];
    if (!nextStatus) return;
    setBusyItemId(itemId);
    try {
      await updateItem(itemId, { status: nextStatus });
      setStatusDraftById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    setBusyItemId(itemId);
    try {
      await removeItem(itemId);
      setStatusDraftById((prev) => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    } finally {
      setBusyItemId(null);
    }
  };

  const getOwnerLabel = (value?: string | null): string | null => {
    if (!value) {
      return null;
    }
    const matchingOwner = ownerLookup.get(value);
    if (!matchingOwner) {
      return value;
    }
    return matchingOwner.description ? `${matchingOwner.label} · ${matchingOwner.description}` : matchingOwner.label;
  };

  const getEntityLabel = (entityType?: string | null, entityId?: string | null): string | null => {
    if (!entityType && !entityId) {
      return null;
    }
    const matchingEntity = entityLookup.get(`${entityType ?? ''}:${entityId ?? ''}`);
    if (matchingEntity) {
      return matchingEntity.description ? `${matchingEntity.label} · ${matchingEntity.description}` : matchingEntity.label;
    }
    if (entityType) {
      const label = getProducerEntityTypeLabel(entityType);
      return entityId ? `${label} (${entityId})` : label;
    }
    return entityId ?? null;
  };

  const getEconomyFocusForItem = useCallback((item: ProducerTimelineItem): Partial<ProducerWorkflowFocusPayload> | null => {
    const metadata = asRecord(item.metadata);
    const reviewId = readFirstNonEmptyString(metadata.reviewId);
    const reviewType = readFirstNonEmptyString(metadata.reviewType);
    const targetEntityType = readFirstNonEmptyString(metadata.targetEntityType, item.linked_entity_type);
    const approvalTemplate = normalizeApprovalTemplate(readFirstNonEmptyString(
      metadata.approvalTemplate,
      reviewType,
      targetEntityType,
    ));
    const effectiveLinkedEntityType = isProjectWorkflowStatusItem(metadata)
      ? readFirstNonEmptyString(metadata.targetEntityType, item.linked_entity_type)
      : item.linked_entity_type ?? targetEntityType ?? undefined;
    const effectiveLinkedEntityId = isProjectWorkflowStatusItem(metadata)
      ? readFirstNonEmptyString(metadata.targetEntityId, item.linked_entity_id)
      : item.linked_entity_id ?? undefined;
    const agreementId = readFirstNonEmptyString(
      metadata.agreementId,
      targetEntityType === 'project_agreement' ? item.linked_entity_id : undefined,
    );
    const focusedPhase = normalizeFocusedPhase(
      readFirstNonEmptyString(metadata.focusedPhase, metadata.phase, item.phase),
    );

    const baseFocus: Partial<ProducerWorkflowFocusPayload> = {
      reviewId,
      timelineItemId: item.id,
      linkedEntityType: effectiveLinkedEntityType,
      linkedEntityId: effectiveLinkedEntityId,
      focusedPhase,
    };

    if (
      agreementId
      || targetEntityType === 'project_agreement'
      || reviewType === 'change_order'
      || reviewType === 'client_approval'
    ) {
      return {
        ...baseFocus,
        agreementId: agreementId ?? item.linked_entity_id ?? undefined,
        economyView: 'budget',
      };
    }

    if (
      item.linked_entity_type === 'economy'
      || targetEntityType === 'economy'
      || reviewType === 'budget_package'
      || readFirstNonEmptyString(metadata.source) === 'economy-milestone'
    ) {
      return {
        ...baseFocus,
        economyView: 'approvals',
        approvalTemplate,
      };
    }

    if (approvalTemplate) {
      return {
        ...baseFocus,
        economyView: 'approvals',
        approvalTemplate,
      };
    }

    return null;
  }, []);

  const getReviewFocusForItem = useCallback((item: ProducerTimelineItem): Partial<ProducerWorkflowFocusPayload> | null => {
    const metadata = asRecord(item.metadata);
    const reviewId = readFirstNonEmptyString(metadata.reviewId);
    if (reviewId) {
      return {
        reviewId,
        agreementId: readFirstNonEmptyString(metadata.agreementId),
        linkedEntityType: readFirstNonEmptyString(metadata.targetEntityType, item.linked_entity_type) ?? undefined,
        linkedEntityId: readFirstNonEmptyString(metadata.targetEntityId, item.linked_entity_id) ?? undefined,
      };
    }

    const agreementId = readFirstNonEmptyString(
      metadata.agreementId,
      item.linked_entity_type === 'project_agreement' ? item.linked_entity_id : undefined,
    );
    const agreementStatus = readFirstNonEmptyString(metadata.agreementStatus);

    if (item.linked_entity_type === 'client_review' && item.linked_entity_id) {
      return {
        reviewId: item.linked_entity_id,
        linkedEntityType: 'client_review',
        linkedEntityId: item.linked_entity_id,
        agreementId,
      };
    }

    if (agreementId || item.linked_entity_type === 'project_agreement') {
      if (agreementStatus === 'draft') {
        return null;
      }
      return {
        agreementId: agreementId ?? item.linked_entity_id ?? undefined,
        linkedEntityType: 'project_agreement',
        linkedEntityId: agreementId ?? item.linked_entity_id ?? undefined,
      };
    }

    if (item.linked_entity_type || item.linked_entity_id) {
      return {
        linkedEntityType: item.linked_entity_type ?? undefined,
        linkedEntityId: item.linked_entity_id ?? undefined,
      };
    }

    return null;
  }, []);

  useEffect(() => onProducerWorkflowFocusEvent((payload) => {
    if (payload.projectId !== projectId || payload.panel !== 'timeline') {
      return;
    }
    setPendingFocus(payload);
  }), [projectId]);

  const resolveFocusedTimelineItemId = useCallback((payload: ProducerWorkflowFocusPayload): string | null => {
    if (payload.timelineItemId && allTimelineItems.some((item) => item.id === payload.timelineItemId)) {
      return payload.timelineItemId;
    }

    if (payload.reviewId) {
      return allTimelineItems.find((item) => (
        item.linked_entity_type === 'client_review'
        && item.linked_entity_id === payload.reviewId
      ))?.id ?? null;
    }

    if (payload.agreementId) {
      return allTimelineItems.find((item) => (
        (item.linked_entity_type === 'project_agreement' && item.linked_entity_id === payload.agreementId)
        || readFirstNonEmptyString(item.metadata?.agreementId) === payload.agreementId
      ))?.id ?? null;
    }

    if (payload.linkedEntityType || payload.linkedEntityId) {
      return allTimelineItems.find((item) => (
        (payload.linkedEntityType ? item.linked_entity_type === payload.linkedEntityType : true)
        && (payload.linkedEntityId ? item.linked_entity_id === payload.linkedEntityId : true)
      ))?.id ?? null;
    }

    return null;
  }, [allTimelineItems]);

  useEffect(() => {
    if (!pendingFocus) {
      return undefined;
    }

    const resolvedItemId = resolveFocusedTimelineItemId(pendingFocus);
    if (!resolvedItemId) {
      return undefined;
    }

    setHighlightedItemId(resolvedItemId);
    const target = itemRefs.current[resolvedItemId];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setPendingFocus(null);

    const timeoutId = window.setTimeout(() => {
      setHighlightedItemId((current) => (current === resolvedItemId ? null : current));
    }, 2600);

    return () => window.clearTimeout(timeoutId);
  }, [pendingFocus, resolveFocusedTimelineItemId]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(2,6,23,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon sx={{ color: '#38bdf8' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Fase-tidslinje
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={`${totalItems} milepæler`}
          sx={{
            bgcolor: 'rgba(56,189,248,0.14)',
            color: '#bae6fd',
            border: '1px solid rgba(56,189,248,0.35)',
          }}
        />
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap">
        <Chip size="small" label={`Fullført ${statusSummary.completed}`} sx={{ bgcolor: 'rgba(74,222,128,0.16)', color: '#86efac' }} />
        <Chip size="small" label={`Pågår ${statusSummary.in_progress}`} sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#7dd3fc' }} />
        <Chip size="small" label={`Planlagt ${statusSummary.planned}`} sx={{ bgcolor: 'rgba(148,163,184,0.16)', color: '#cbd5e1' }} />
        <Chip size="small" label={`Blokkert ${statusSummary.blocked}`} sx={{ bgcolor: 'rgba(248,113,113,0.16)', color: '#fca5a5' }} />
        <Chip size="small" label={`Fremdrift ${completionPct}%`} sx={{ bgcolor: 'rgba(251,191,36,0.16)', color: '#fde68a' }} />
      </Stack>

      <Box
        sx={{
          borderRadius: 1.75,
          border: '1px solid rgba(148,163,184,0.22)',
          background: 'rgba(2,6,23,0.34)',
          p: 1.25,
        }}
      >
        <Stack spacing={1.1}>
          <Box>
            <Typography sx={{ color: '#f8fafc', fontWeight: 700 }}>
              Faseprioritet akkurat nå
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.92rem', mt: 0.4 }}>
              Shotlist, opptaksdager og klientgodkjenning prioriteres her etter hva som faktisk kan stoppe flyten før, under og etter produksjonen.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1}>
            {shotListReadiness.map((summary, index) => {
              const accent = getPhaseAccentStyles(summary.tone, index === 0 && summary.priorityScore > 0);
              return (
                <Box
                  key={summary.phase}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 1.5,
                    border: `1px solid ${accent.border}`,
                    background: accent.background,
                    p: 1.1,
                  }}
                >
                  <Stack spacing={0.9}>
                    <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" flexWrap="wrap">
                      <Typography sx={{ color: '#fff', fontWeight: 700 }}>{summary.label}</Typography>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap">
                        {index === 0 && summary.priorityScore > 0 ? (
                          <Chip
                            size="small"
                            label="Høyest nå"
                            sx={{
                              bgcolor: 'rgba(251,191,36,0.16)',
                              color: '#fde68a',
                              border: '1px solid rgba(251,191,36,0.35)',
                            }}
                          />
                        ) : null}
                        <Chip
                          size="small"
                          label={`${summary.shotListCount} shotlister`}
                          sx={{
                            bgcolor: accent.chipBackground,
                            color: accent.chipColor,
                            border: `1px solid ${accent.border}`,
                          }}
                        />
                        {summary.actionableCount > 0 ? (
                          <Chip
                            size="small"
                            label={`${summary.actionableCount} krever handling`}
                            sx={{
                              bgcolor: 'rgba(248,113,113,0.14)',
                              color: '#fecaca',
                              border: '1px solid rgba(248,113,113,0.32)',
                            }}
                          />
                        ) : null}
                      </Stack>
                    </Stack>
                    <Typography sx={{ color: '#e2e8f0', fontWeight: 600 }}>
                      {summary.heading}
                    </Typography>
                    <Typography sx={{ color: 'rgba(203,213,225,0.82)', fontSize: '0.9rem', minHeight: 44 }}>
                      {summary.summary}
                    </Typography>
                    {summary.actionTarget === 'shotlist' && onOpenShotList ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() => onOpenShotList({ phase: summary.phase })}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                      >
                        {summary.actionLabel ?? 'Åpne shotlist'}
                      </Button>
                    ) : null}
                    {summary.actionTarget === 'reviews' && onOpenReviews ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LaunchIcon />}
                        onClick={() => onOpenReviews({ focusedPhase: summary.phase, approvalTemplate: 'shotlist' })}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700 }}
                      >
                        {summary.actionLabel ?? 'Åpne klientsamarbeid'}
                      </Button>
                    ) : null}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </Box>

      {(error || planningError) && (
        <Stack spacing={1}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {planningError ? <Alert severity="error">{planningError}</Alert> : null}
        </Stack>
      )}

      {project ? (
        <ProducerClientPlanningPanel
          project={project}
          productionEstimate={productionEstimate}
          shotLists={shotLists}
          productionDays={productionDays}
          readOnly={readOnly}
          onProjectUpdated={onProjectUpdated}
          onOpenShotList={onOpenShotList}
          onOpenMedia={onOpenMedia}
        />
      ) : null}

      {!readOnly && (
        <Stack direction="column" spacing={1}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="timeline-phase-label" sx={{ color: 'rgba(226,232,240,0.8)' }}>Fase</InputLabel>
              <Select
                labelId="timeline-phase-label"
                label="Fase"
                value={phase}
                onChange={(event) => setPhase(event.target.value as ProducerPhase)}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {Object.entries(PHASE_LABELS).map(([key, label]) => (
                  <MenuItem key={key} value={key}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Milepæl"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <TextField
              size="small"
              label="Beskrivelse"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'flex-end' }}>
            {ownerOptions.length > 0 ? (
              <FormControl size="small" sx={{ flex: 1, minWidth: 240 }}>
                <InputLabel id="timeline-owner-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Ansvarlig</InputLabel>
                <Select
                  labelId="timeline-owner-label"
                  label="Ansvarlig"
                  value={ownerUserId}
                  onChange={(event) => setOwnerUserId(String(event.target.value))}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                >
                  <MenuItem value="">Ingen ansvarlig</MenuItem>
                  {ownerOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                size="small"
                label="Ansvarlig (bruker-id/e-post)"
                value={ownerUserId}
                onChange={(event) => setOwnerUserId(event.target.value)}
                sx={{ flex: 1, minWidth: 240 }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            )}
            <TextField
              size="small"
              label="Deadline"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              sx={{ minWidth: 220 }}
              InputLabelProps={{ shrink: true, sx: { color: 'rgba(226,232,240,0.82)' } }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="timeline-status-label" sx={{ color: 'rgba(226,232,240,0.8)' }}>Status</InputLabel>
              <Select
                labelId="timeline-status-label"
                label="Status"
                value={itemStatus}
                onChange={(event) => setItemStatus(event.target.value as (typeof STATUS_OPTIONS)[number]['value'])}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="timeline-link-type-label" sx={{ color: 'rgba(226,232,240,0.8)' }}>Koblingstype</InputLabel>
              <Select
                labelId="timeline-link-type-label"
                label="Koblingstype"
                value={linkedEntityType}
                onChange={(event) => {
                  const nextType = String(event.target.value);
                  setLinkedEntityType(nextType);
                  setLinkedEntityId(entityOptions.find((option) => option.entityType === nextType)?.entityId ?? '');
                }}
                fullWidth
                sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
              >
                <MenuItem value="">Ingen kobling</MenuItem>
                {distinctEntityTypes.map((option) => (
                  <MenuItem key={option.entityType} value={option.entityType}>{getProducerEntityTypeLabel(option.entityType)}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {filteredEntityOptions.length > 0 ? (
              <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                <InputLabel id="timeline-link-entity-label" sx={{ color: 'rgba(226,232,240,0.82)' }}>Koblet entitet</InputLabel>
                <Select
                  labelId="timeline-link-entity-label"
                  label="Koblet entitet"
                  value={linkedEntityId}
                  onChange={(event) => setLinkedEntityId(String(event.target.value))}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
                >
                  {filteredEntityOptions.map((option) => (
                    <MenuItem key={`${option.entityType}:${option.entityId}`} value={option.entityId}>{option.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                size="small"
                label="Koblings-ID"
                value={linkedEntityId}
                onChange={(event) => setLinkedEntityId(event.target.value)}
                sx={{ minWidth: 160 }}
                InputLabelProps={{ sx: { color: 'rgba(226,232,240,0.82)' } }}
              />
            )}
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { void handleCreate(); }}
              disabled={loading || !title.trim()}
              sx={{ bgcolor: '#fbbf24', color: '#111827', fontWeight: 700, textTransform: 'none', minWidth: 170 }}
            >
              Legg til milepæl
            </Button>
          </Stack>
        </Stack>
      )}

      <Divider sx={{ borderColor: 'rgba(148,163,184,0.2)' }} />

      <Stack spacing={1.5}>
        {(Object.keys(PHASE_LABELS) as ProducerPhase[]).map((phaseKey) => (
          <Box
            key={phaseKey}
            sx={{
              borderRadius: 1.5,
              border: '1px solid rgba(148,163,184,0.2)',
              background: 'rgba(15,23,42,0.45)',
              p: 1.25,
            }}
          >
            <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
              <Typography sx={{ color: '#e2e8f0', fontWeight: 700 }}>
                {PHASE_LABELS[phaseKey]}
              </Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`${phaseReadinessByPhase[phaseKey].shotListCount} shotlister`}
                  sx={{
                    bgcolor: 'rgba(148,163,184,0.16)',
                    color: '#cbd5e1',
                    border: '1px solid rgba(148,163,184,0.28)',
                  }}
                />
                {phaseReadinessByPhase[phaseKey].actionableCount > 0 ? (
                  <Chip
                    size="small"
                    label={`${phaseReadinessByPhase[phaseKey].actionableCount} krever handling`}
                    sx={{
                      bgcolor: 'rgba(251,191,36,0.16)',
                      color: '#fde68a',
                      border: '1px solid rgba(251,191,36,0.35)',
                    }}
                  />
                ) : null}
              </Stack>
            </Stack>
            {phaseReadinessByPhase[phaseKey].shotListCount > 0 ? (
              <Alert
                tabIndex={0}
                severity={phaseReadinessByPhase[phaseKey].tone === 'danger'
                  ? 'error'
                  : phaseReadinessByPhase[phaseKey].tone === 'warning'
                    ? 'warning'
                    : phaseReadinessByPhase[phaseKey].tone === 'success'
                      ? 'success'
                      : 'info'}
                sx={{
                  mb: 1,
                  bgcolor: 'rgba(15,23,42,0.38)',
                  color: '#e2e8f0',
                  '& .MuiAlert-message': {
                    width: '100%',
                    overflow: 'visible',
                    maxHeight: 'none',
                  },
                }}
                action={phaseReadinessByPhase[phaseKey].actionTarget === 'shotlist' && onOpenShotList ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => onOpenShotList({ phase: phaseKey })}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Åpne shotlist
                  </Button>
                ) : phaseReadinessByPhase[phaseKey].actionTarget === 'reviews' && onOpenReviews ? (
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => onOpenReviews({ focusedPhase: phaseKey, approvalTemplate: 'shotlist' })}
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Åpne klientsamarbeid
                  </Button>
                ) : undefined}
              >
                <Typography sx={{ fontWeight: 600, color: '#f8fafc' }}>
                  {phaseReadinessByPhase[phaseKey].heading}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.84)', fontSize: '0.9rem' }}>
                  {phaseReadinessByPhase[phaseKey].summary}
                </Typography>
              </Alert>
            ) : null}
            <Stack spacing={1}>
              {groupedByPhase[phaseKey].length === 0 ? (
                <Typography sx={{ color: 'rgba(148,163,184,0.82)', fontSize: '0.9rem' }}>
                  Ingen milepæler i denne fasen.
                </Typography>
              ) : (
                groupedByPhase[phaseKey].map((item) => {
                  const itemMetadata = asRecord(item.metadata);
                  const projectStatusItem = isProjectWorkflowStatusItem(itemMetadata);
                  const linkedEntityLabel = getEntityLabel(item.linked_entity_type, item.linked_entity_id);
                  const reviewFocus = getReviewFocusForItem(item);
                  const economyFocus = getEconomyFocusForItem(item);
                  const agreementSignatureStatus = normalizeAgreementSignatureStatus(itemMetadata.googleSignatureStatus);
                  const agreementSignatureStyles = agreementSignatureStatus
                    ? getAgreementSignatureStyles(agreementSignatureStatus)
                    : null;
                  const shotListLinked = readFirstNonEmptyString(
                    item.linked_entity_type,
                    itemMetadata.targetEntityType,
                    itemMetadata.approvalTemplate,
                  ) === 'shotlist';
                  const workspaceTargetEntityType = readFirstNonEmptyString(
                    itemMetadata.targetEntityType,
                    item.linked_entity_type,
                  );
                  const clientWorkspaceLinked = item.linked_entity_type === 'client_material'
                    || item.linked_entity_type === 'client_intake'
                    || item.linked_entity_type === 'project_agreement'
                    || workspaceTargetEntityType === 'project_agreement'
                    || workspaceTargetEntityType === 'meeting_decision'
                    || workspaceTargetEntityType === 'meeting_follow_up'
                    || readFirstNonEmptyString(itemMetadata.meetingItemType) === 'decision'
                    || readFirstNonEmptyString(itemMetadata.meetingItemType) === 'follow_up';
                  const workspaceActionLabel = workspaceTargetEntityType === 'project_agreement'
                    ? 'Åpne juridisk avtale'
                    : workspaceTargetEntityType === 'meeting_decision' || workspaceTargetEntityType === 'meeting_follow_up'
                      || readFirstNonEmptyString(itemMetadata.meetingItemType) === 'decision'
                      || readFirstNonEmptyString(itemMetadata.meetingItemType) === 'follow_up'
                      ? 'Åpne møteworkspace'
                      : 'Åpne brief og materiale';

                  return (
                    <Box
                      key={item.id}
                      ref={(node) => { itemRefs.current[item.id] = node; }}
                      sx={{
                        borderRadius: 1.25,
                        border: highlightedItemId === item.id
                          ? '1px solid rgba(251,191,36,0.52)'
                          : '1px solid rgba(148,163,184,0.24)',
                        p: 1,
                        bgcolor: highlightedItemId === item.id
                          ? 'rgba(251,191,36,0.08)'
                          : 'rgba(2,6,23,0.45)',
                        boxShadow: highlightedItemId === item.id
                          ? '0 0 0 1px rgba(251,191,36,0.12), 0 12px 32px rgba(2,6,23,0.22)'
                          : 'none',
                        transition: 'border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Typography sx={{ color: '#f8fafc', fontWeight: 600 }}>{item.title}</Typography>
                        <Chip
                          size="small"
                          label={getProducerTimelineStatusLabel(item.status)}
                          sx={{
                            height: 22,
                            bgcolor: 'rgba(30,41,59,0.9)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(148,163,184,0.35)',
                          }}
                        />
                      </Stack>
                      {item.description && (
                        <Typography sx={{ color: 'rgba(203,213,225,0.86)', mt: 0.6, fontSize: '0.9rem' }}>
                          {item.description}
                        </Typography>
                      )}
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} flexWrap="wrap" sx={{ mt: 0.8 }}>
                        {projectStatusItem && (
                          <Chip
                            size="small"
                            label="Prosjektstatus"
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(192,132,252,0.16)',
                              color: '#e9d5ff',
                              border: '1px solid rgba(192,132,252,0.35)',
                            }}
                          />
                        )}
                        {item.owner_user_id && (
                          <Chip
                            size="small"
                            label={`Ansvarlig: ${getOwnerLabel(item.owner_user_id) ?? item.owner_user_id}`}
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(30,41,59,0.9)',
                              color: '#cbd5e1',
                              border: '1px solid rgba(148,163,184,0.35)',
                            }}
                          />
                        )}
                        {item.due_at && (
                          <Chip
                            size="small"
                            label={`Frist: ${new Date(item.due_at).toLocaleString('nb-NO')}`}
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(30,41,59,0.9)',
                              color: '#cbd5e1',
                              border: '1px solid rgba(148,163,184,0.35)',
                            }}
                          />
                        )}
                        {linkedEntityLabel && (
                          <Chip
                            size="small"
                            label={`Kobling: ${linkedEntityLabel}`}
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(30,41,59,0.9)',
                              color: '#cbd5e1',
                              border: '1px solid rgba(148,163,184,0.35)',
                            }}
                          />
                        )}
                        {shotListLinked && (
                          <Chip
                            size="small"
                            label="Shotlist"
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(14,165,233,0.18)',
                              color: '#bae6fd',
                              border: '1px solid rgba(125,211,252,0.35)',
                            }}
                          />
                        )}
                        {clientWorkspaceLinked && (
                          <Chip
                            size="small"
                            label="Klientgrunnlag"
                            sx={{
                              height: 22,
                              bgcolor: 'rgba(192,132,252,0.16)',
                              color: '#e9d5ff',
                              border: '1px solid rgba(192,132,252,0.35)',
                            }}
                          />
                        )}
                        {agreementSignatureStatus && agreementSignatureStyles ? (
                          <Chip
                            size="small"
                            label={`Juridisk signatur · ${PROJECT_AGREEMENT_SIGNATURE_STATUS_LABELS[agreementSignatureStatus]}`}
                            sx={{
                              height: 22,
                              bgcolor: agreementSignatureStyles.background,
                              color: agreementSignatureStyles.color,
                              border: `1px solid ${agreementSignatureStyles.border}`,
                            }}
                          />
                        ) : null}
                      </Stack>
                      {agreementSignatureStatus ? (
                        <Typography
                          sx={{
                            color: agreementSignatureStyles?.color ?? 'rgba(203,213,225,0.84)',
                            mt: 0.7,
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          {agreementSignatureStatus === 'signed'
                            ? 'Avtalen er juridisk signert og milepælen er låst.'
                            : agreementSignatureStatus === 'changes_requested'
                              ? 'Signaturflyten krever endringer før prosjektet kan gå videre her.'
                              : agreementSignatureStatus === 'rejected'
                                ? 'Avtalen er avvist i signaturflyten og må avklares i økonomi og klientsamarbeid.'
                                : 'Juridisk signatur pågår fortsatt for denne milepælen.'}
                        </Typography>
                      ) : null}
                      {!readOnly && (
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ mt: 1 }}>
                          <Box sx={{ minWidth: { xs: '100%', md: 180 } }}>
                            <Select
                              size="small"
                              aria-label={`Status for ${item.title}`}
                              SelectDisplayProps={{ 'aria-label': `Status for ${item.title}` }}
                              value={statusDraftById[item.id] ?? normalizeTimelineStatusValue(item.status)}
                              onChange={(event) => handleStatusDraftChange(item.id, String(event.target.value))}
                              fullWidth
                              sx={{
                                color: '#fff',
                                minHeight: 44,
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.42)' },
                              }}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                              ))}
                            </Select>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={() => { void handleSaveItemStatus(item.id); }}
                            disabled={
                              loading
                              || busyItemId === item.id
                              || !statusDraftById[item.id]
                              || statusDraftById[item.id] === normalizeTimelineStatusValue(item.status)
                            }
                            sx={{ textTransform: 'none', fontWeight: 700, minHeight: 44 }}
                          >
                            Lagre status
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => { void handleDeleteItem(item.id); }}
                            disabled={loading || busyItemId === item.id}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                          >
                            Fjern
                          </Button>
                          {onOpenReviews && reviewFocus ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenReviews(reviewFocus)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne i klientsamarbeid
                            </Button>
                          ) : null}
                          {onOpenEconomy && economyFocus ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenEconomy(economyFocus)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne i økonomi
                            </Button>
                          ) : null}
                          {onOpenShotList && shotListLinked ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              onClick={() => onOpenShotList({
                                phase: item.phase,
                                shotListId: item.linked_entity_type === 'shotlist' ? item.linked_entity_id ?? undefined : undefined,
                              })}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne shotlist
                            </Button>
                          ) : null}
                          {onOpenMedia && clientWorkspaceLinked ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              onClick={() => onOpenMedia(getMediaFocusForItem(item))}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {workspaceActionLabel}
                            </Button>
                          ) : null}
                        </Stack>
                      )}
                      {readOnly && (onOpenReviews || onOpenEconomy || onOpenShotList || onOpenMedia) && (reviewFocus || economyFocus || shotListLinked || clientWorkspaceLinked) ? (
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1 }}>
                          {onOpenReviews && reviewFocus ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenReviews(reviewFocus)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne i klientsamarbeid
                            </Button>
                          ) : null}
                          {onOpenEconomy && economyFocus ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => onOpenEconomy(economyFocus)}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne i økonomi
                            </Button>
                          ) : null}
                          {onOpenShotList && shotListLinked ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              onClick={() => onOpenShotList({
                                phase: item.phase,
                                shotListId: item.linked_entity_type === 'shotlist' ? item.linked_entity_id ?? undefined : undefined,
                              })}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              Åpne shotlist
                            </Button>
                          ) : null}
                          {onOpenMedia && clientWorkspaceLinked ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<LaunchIcon />}
                              onClick={() => onOpenMedia(getMediaFocusForItem(item))}
                              sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                              {workspaceActionLabel}
                            </Button>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Box>
                  );
                })
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
