import {
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  PRODUCER_DEMO_ECONOMY_SEED,
  PRODUCER_DEMO_REVIEW_SEED,
  PRODUCER_DEMO_TIMELINE_SEED,
  isRoleRoomDemoSeedAllowed,
} from '../constants/producerDemo';
import type {
  CastingProject,
  ProducerClientIntake,
  ProducerClientMaterial,
  ProducerClientMaterialType,
  ProducerMeetingDecisionItem,
  ProducerMeetingFollowUpItem,
  ProducerProjectPlanning,
  ProducerWorkflowProjectMeta,
  ProducerWorkflowProjectStatus,
} from '../models/casting';
import authSessionService from './authSessionService';
import { castingService } from './castingService';
import { emitProducerWorkflowEvent } from './producerWorkflowEvents';
import { getCurrentUserId, settingsService } from './settingsService';
import {
  getProducerPlanningClientMoments,
  normalizeProducerProjectPlanning,
  summarizeProducerClientGrounding,
} from '../utils/producerProjectPlanning';
import { logRoleRoomDiagnostic } from '../utils/roleRoomDiagnostics';

export type ProducerPhase = 'preproduction' | 'production' | 'postproduction';
export type ProducerReviewDecision = 'approved' | 'rejected' | 'changes_requested';

let contentProducerWorkflowInitPromise: Promise<void> | null = null;
const API_BASE = '/api/role-room';

const TIMELINE_NAMESPACE = 'role-room-producer-timeline';
const ECONOMY_NAMESPACE = 'role-room-producer-economy';
const REVIEWS_NAMESPACE = 'role-room-producer-reviews';
const CLIENT_MATERIALS_NAMESPACE = 'role-room-producer-client-materials';
const SYNTHETIC_REVIEW_SOURCES = new Set(['codex-smoke', 'cli-smoke', 'smoke-test']);
const SYNTHETIC_REVIEW_TITLE_PATTERN = /^(auto review|smoke review|rbac review|qa review(?:\s+\d+)?|qa budget sync|budget package \d+|codex-review-)/i;
const CLIENT_INTAKE_TIMELINE_ENTITY_ID = 'client-intake';
const CLIENT_MATERIAL_TIMELINE_ENTITY_ID = 'client-materials';
const CLIENT_INTAKE_TIMELINE_SOURCE = 'client-intake-status';
const CLIENT_MATERIAL_TIMELINE_SOURCE = 'client-material-status';
const CLIENT_GROUNDING_REVIEW_SOURCE = 'client-grounding';
const CLIENT_INTAKE_REVIEW_TYPE = 'client_intake_request';
const CLIENT_MATERIAL_REVIEW_TYPE = 'client_material_request';
const MEETING_WORKSPACE_SOURCE = 'meeting-workspace';
const MEETING_DECISION_REVIEW_TYPE = 'meeting_decision';
const MEETING_DECISION_ENTITY_TYPE = 'meeting_decision';
const MEETING_FOLLOW_UP_ENTITY_TYPE = 'meeting_follow_up';

type LooseRecord = Record<string, unknown>;

const hasText = (value: unknown): value is string => (
  typeof value === 'string' && value.trim().length > 0
);

const stableSerialize = (value: unknown): string => JSON.stringify(value, (_key, nestedValue) => {
  if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
    return Object.keys(nestedValue as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = (nestedValue as Record<string, unknown>)[key];
        return sorted;
      }, {});
  }
  return nestedValue;
}) ?? 'undefined';

export interface ProducerTimelineItem {
  id: string;
  project_id: string;
  phase: ProducerPhase;
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
  due_at?: string | null;
  status: string;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerEconomyItem {
  id: string;
  project_id: string;
  phase: ProducerPhase;
  category: string;
  item_name: string;
  description?: string | null;
  estimate: string | number;
  approved: string | number;
  actual: string | number;
  currency: string;
  status: string;
  client_visible: boolean;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  sort_order: number;
  metadata?: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerReviewComment {
  id: string;
  review_id: string;
  project_id: string;
  author_user_id?: string | null;
  author_role?: string | null;
  comment_text: string;
  timestamp_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProducerClientReview {
  id: string;
  project_id: string;
  review_type: string;
  title: string;
  description?: string | null;
  target_entity_type?: string | null;
  target_entity_id?: string | null;
  requested_by_user_id?: string | null;
  requested_at: string;
  due_at?: string | null;
  status: string;
  decision_by_user_id?: string | null;
  decision_at?: string | null;
  decision_reason?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  comments: ProducerReviewComment[];
}

export interface ProducerProjectNotification {
  id: string;
  project_id: string;
  audience: string;
  event_type: string;
  inbox_type: string;
  title: string;
  message?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  linked_entity_type?: string | null;
  linked_entity_id?: string | null;
  assigned_to_user_id?: string | null;
  assigned_to_label?: string | null;
  due_at?: string | null;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  mention_user_ids: string[];
  mention_emails: string[];
  metadata?: Record<string, unknown>;
  created_by_user_id?: string | null;
  created_by_role?: string | null;
  created_at: string;
  updated_at: string;
  read: boolean;
  read_at?: string | null;
}

export interface UpdateProducerNotificationInput {
  inboxType?: string;
  clientName?: string | null;
  clientEmail?: string | null;
  assignedToUserId?: string | null;
  assignedToLabel?: string | null;
  dueAt?: string | null;
  resolved?: boolean;
  archived?: boolean;
  mentionUserIds?: string[];
  mentionEmails?: string[];
}

export interface ProducerExpenseReceiptFile {
  id: string;
  expenseId: string;
  projectId: string;
  fileName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  sha256?: string | null;
  pageCount?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string | null;
}

export interface ProducerReceiptOcrJob {
  id: string;
  expenseId: string;
  receiptFileId?: string | null;
  projectId: string;
  status: string;
  attempts: number;
  confidence?: number | null;
  extractedText?: string | null;
  extractedData?: Record<string, unknown>;
  engine?: string | null;
  lastError?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  updatedAt?: string | null;
}

export interface ProducerExpense {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  merchantName?: string | null;
  expenseDate?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  currency: string;
  category?: string | null;
  paidByUserId?: string | null;
  paidByLabel?: string | null;
  costOwner: string;
  refundStatus: string;
  clientApprovalStatus: string;
  duplicateOfExpenseId?: string | null;
  ocrStatus: string;
  ocrConfidence?: number | null;
  ocrReviewRequired: boolean;
  amountValidationStatus: string;
  vatValidationStatus: string;
  privacyNoticeAcknowledgedAt?: string | null;
  metadata?: Record<string, unknown>;
  receipts: ProducerExpenseReceiptFile[];
  ocrJobs: ProducerReceiptOcrJob[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CreateProducerExpenseInput {
  title: string;
  description?: string | null;
  merchantName?: string | null;
  expenseDate?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  currency?: string;
  category?: string | null;
  paidByUserId?: string | null;
  paidByLabel?: string | null;
  costOwner?: string;
  refundStatus?: string;
  clientApprovalStatus?: string;
  ocrText?: string | null;
  queueOcr?: boolean;
  privacyNoticeAcknowledged?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateProducerExpenseStatusInput {
  refundStatus?: string;
  clientApprovalStatus?: string;
}

export interface CorrectProducerExpenseOcrInput {
  merchantName?: string | null;
  expenseDate?: string | null;
  amount?: number | null;
  vatAmount?: number | null;
  category?: string | null;
}

export interface CreateProducerTimelineItemInput {
  phase: ProducerPhase;
  title: string;
  description?: string;
  ownerUserId?: string;
  dueAt?: string;
  status?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerTimelineItemInput = Partial<CreateProducerTimelineItemInput>;

export interface CreateProducerEconomyItemInput {
  phase: ProducerPhase;
  category: string;
  itemName: string;
  description?: string;
  estimate?: number;
  approved?: number;
  actual?: number;
  currency?: string;
  status?: string;
  clientVisible?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerEconomyItemInput = Partial<CreateProducerEconomyItemInput>;

export interface CreateProducerReviewInput {
  reviewType: string;
  title: string;
  description?: string;
  targetEntityType?: string;
  targetEntityId?: string;
  dueAt?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerReviewInput = Partial<CreateProducerReviewInput>;

export interface CreateProducerClientMaterialInput {
  entryType: ProducerClientMaterialType;
  title: string;
  description?: string;
  externalUrl?: string;
  phase?: ProducerPhase;
  linkedShotListId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export type UpdateProducerClientMaterialInput = Partial<CreateProducerClientMaterialInput>;

export interface AddProducerReviewCommentInput {
  commentText: string;
  timestampSeconds?: number;
}

export interface SetProducerReviewDecisionInput {
  decision: ProducerReviewDecision;
  reason?: string;
  timestampSeconds?: number;
}

function normalizeClientIntake(value: unknown): ProducerClientIntake {
  const record = asRecord(value);
  return {
    projectGoal: readFirstNonEmptyString(record.project_goal, record.projectGoal) ?? '',
    deliverables: readFirstNonEmptyString(record.deliverables) ?? '',
    targetAudience: readFirstNonEmptyString(record.target_audience, record.targetAudience) ?? '',
    keyMessage: readFirstNonEmptyString(record.key_message, record.keyMessage) ?? '',
    timingConstraints: readFirstNonEmptyString(record.timing_constraints, record.timingConstraints) ?? '',
    brandNotes: readFirstNonEmptyString(record.brand_notes, record.brandNotes) ?? '',
    materialOverview: readFirstNonEmptyString(record.material_overview, record.materialOverview) ?? '',
    referenceLinks: readFirstNonEmptyString(record.reference_links, record.referenceLinks) ?? '',
    contactName: readFirstNonEmptyString(record.contact_name, record.contactName) ?? '',
    contactEmail: readFirstNonEmptyString(record.contact_email, record.contactEmail) ?? '',
    contactPhone: readFirstNonEmptyString(record.contact_phone, record.contactPhone) ?? '',
    additionalNotes: readFirstNonEmptyString(record.additional_notes, record.additionalNotes) ?? '',
    updatedAt: readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? undefined,
    updatedByRole: readFirstNonEmptyString(record.updated_by_role, record.updatedByRole) ?? undefined,
  };
}

function normalizeClientMaterial(value: unknown, projectId: string): ProducerClientMaterial {
  const record = asRecord(value);
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? createdAt;
  const rawPhase = readFirstNonEmptyString(record.phase);
  const phase = rawPhase === 'preproduction' || rawPhase === 'production' || rawPhase === 'postproduction'
    ? rawPhase
    : null;

  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-client-material'),
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    entry_type: (
      readFirstNonEmptyString(record.entry_type, record.entryType) as ProducerClientMaterialType | undefined
    ) ?? 'document',
    title: readFirstNonEmptyString(record.title) ?? 'Uten tittel',
    description: readFirstNonEmptyString(record.description) ?? null,
    external_url: readFirstNonEmptyString(record.external_url, record.externalUrl) ?? null,
    phase,
    linked_shot_list_id: readFirstNonEmptyString(record.linked_shot_list_id, record.linkedShotListId) ?? null,
    status: readFirstNonEmptyString(record.status) ?? 'provided',
    metadata: normalizeMetadata(record.metadata),
    created_by_user_id: readFirstNonEmptyString(record.created_by_user_id, record.createdByUserId) ?? null,
    created_by_role: readFirstNonEmptyString(record.created_by_role, record.createdByRole) ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function hasMeaningfulClientIntake(intake: ProducerClientIntake): boolean {
  return [
    intake.projectGoal,
    intake.deliverables,
    intake.targetAudience,
    intake.keyMessage,
    intake.timingConstraints,
    intake.brandNotes,
    intake.materialOverview,
    intake.referenceLinks,
    intake.contactName,
    intake.contactEmail,
    intake.contactPhone,
    intake.additionalNotes,
  ].some((value) => typeof value === 'string' && value.trim().length > 0);
}

function buildClientIntakeTimelinePayload(
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): CreateProducerTimelineItemInput | null {
  if (!hasMeaningfulClientIntake(intake)) {
    return null;
  }

  const grounding = summarizeProducerClientGrounding(intake, materials);
  const missingEssentials = grounding.missingEssentials.slice(0, 3);
  const detailParts = [
    intake.projectGoal ? `Mål: ${intake.projectGoal}` : null,
    intake.deliverables ? `Leveranser: ${intake.deliverables}` : null,
    intake.targetAudience ? `Målgruppe: ${intake.targetAudience}` : null,
    intake.keyMessage ? `Budskap: ${intake.keyMessage}` : null,
    [intake.contactName, intake.contactEmail, intake.contactPhone]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .join(' · '),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (missingEssentials.length > 0) {
    detailParts.push(`Manglende avklaringer: ${missingEssentials.join(', ')}`);
  }

  return {
    phase: 'preproduction',
    title: grounding.briefReadyCount >= grounding.totalBriefFields
      ? 'Klientbrief er klar for produksjon'
      : 'Klientbrief trenger avklaringer',
    description: detailParts.join(' · '),
    dueAt: undefined,
    status: grounding.briefReadyCount >= grounding.totalBriefFields
      ? 'completed'
      : grounding.briefReadyCount >= 3
        ? 'in_progress'
        : 'blocked',
    linkedEntityType: 'client_intake',
    linkedEntityId: CLIENT_INTAKE_TIMELINE_ENTITY_ID,
    metadata: {
      source: CLIENT_INTAKE_TIMELINE_SOURCE,
      briefReadyCount: grounding.briefReadyCount,
      totalBriefFields: grounding.totalBriefFields,
      missingEssentials,
      updatedAt: intake.updatedAt ?? null,
      updatedByRole: intake.updatedByRole ?? null,
      contactName: intake.contactName ?? '',
      contactEmail: intake.contactEmail ?? '',
      materialCount: grounding.materialCount,
    },
  };
}

function getMaterialPriorityValue(material: ProducerClientMaterial): 'critical' | 'important' | 'reference' {
  const metadata = asRecord(material.metadata);
  const priority = readFirstNonEmptyString(metadata.priority);
  if (priority === 'critical' || priority === 'reference') {
    return priority;
  }
  return 'important';
}

function getClientMaterialTimelinePhase(materials: ProducerClientMaterial[]): ProducerPhase {
  const phases = materials
    .map((material) => material.phase)
    .filter((phase): phase is ProducerPhase => (
      phase === 'preproduction' || phase === 'production' || phase === 'postproduction'
    ));

  if (phases.includes('preproduction')) {
    return 'preproduction';
  }
  if (phases.includes('production')) {
    return 'production';
  }
  return 'postproduction';
}

function buildClientMaterialsTimelinePayload(
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): CreateProducerTimelineItemInput | null {
  if (materials.length === 0) {
    return null;
  }

  const grounding = summarizeProducerClientGrounding(intake, materials);
  const criticalCount = materials.filter((material) => getMaterialPriorityValue(material) === 'critical').length;
  const outdatedCount = materials.filter((material) => material.status === 'outdated').length;
  const inReviewCount = materials.filter((material) => material.status === 'in_review').length;
  const approvedCount = materials.filter((material) => material.status === 'approved').length;
  const brandAssetCount = grounding.materialsByType.brand_asset ?? 0;
  const latestMaterialAt = materials
    .map((material) => Date.parse(material.updated_at ?? material.created_at ?? ''))
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((left, right) => right - left)[0];

  const status = outdatedCount > 0
    ? 'blocked'
    : approvedCount === materials.length
      ? 'completed'
      : 'in_progress';

  const summaryParts = [
    `${materials.length} material${materials.length === 1 ? '' : 'er'} registrert`,
    criticalCount > 0 ? `${criticalCount} kritisk${criticalCount === 1 ? '' : 'e'}` : null,
    brandAssetCount > 0 ? `${brandAssetCount} merkevarefil${brandAssetCount === 1 ? '' : 'er'}` : 'Merkevarefiler mangler',
    grounding.topMaterialTitles.length > 0 ? `Nøkler: ${grounding.topMaterialTitles.slice(0, 3).join(', ')}` : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    phase: getClientMaterialTimelinePhase(materials),
    title: outdatedCount > 0
      ? 'Klientmateriale trenger oppdatering'
      : criticalCount > 0
        ? 'Klientmateriale krever gjennomgang'
        : 'Klientmateriale er klart til bruk',
    description: summaryParts.join(' · '),
    status,
    linkedEntityType: 'client_material',
    linkedEntityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
    metadata: {
      source: CLIENT_MATERIAL_TIMELINE_SOURCE,
      materialCount: materials.length,
      criticalCount,
      outdatedCount,
      inReviewCount,
      approvedCount,
      materialsByType: grounding.materialsByType,
      materialsByPhase: grounding.materialsByPhase,
      topMaterialTitles: grounding.topMaterialTitles,
      latestMaterialAt: Number.isFinite(latestMaterialAt) ? new Date(latestMaterialAt).toISOString() : null,
      materialOverview: intake.materialOverview ?? '',
    },
  };
}

function buildClientIntakeReviewPayload(
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): CreateProducerReviewInput | null {
  const grounding = summarizeProducerClientGrounding(intake, materials);
  if (grounding.briefReadyCount >= grounding.totalBriefFields) {
    return null;
  }

  const missingEssentials = grounding.missingEssentials.slice(0, 5);
  const detailParts = [
    'Klienten må fylle inn briefen før plan, økonomi og leveranser kan låses.',
    missingEssentials.length > 0 ? `Mangler: ${missingEssentials.join(', ')}` : null,
    hasText(intake.projectGoal) ? `Nåværende mål: ${intake.projectGoal}` : null,
    hasText(intake.deliverables) ? `Leveranser: ${intake.deliverables}` : null,
    hasText(intake.contactName) || hasText(intake.contactEmail)
      ? `Kontakt: ${[intake.contactName, intake.contactEmail].filter(hasText).join(' · ')}`
      : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    reviewType: CLIENT_INTAKE_REVIEW_TYPE,
    title: grounding.briefReadyCount === 0
      ? 'Klienten må fylle inn prosjektbrief'
      : 'Klientbrief trenger flere avklaringer',
    description: detailParts.join(' · '),
    targetEntityType: 'client_intake',
    targetEntityId: CLIENT_INTAKE_TIMELINE_ENTITY_ID,
    metadata: {
      source: CLIENT_GROUNDING_REVIEW_SOURCE,
      groundingEntity: 'client_intake',
      focusedPhase: 'preproduction',
      phase: 'preproduction',
      briefReadyCount: grounding.briefReadyCount,
      totalBriefFields: grounding.totalBriefFields,
      missingEssentials,
      materialCount: grounding.materialCount,
    },
  };
}

function buildClientMaterialsReviewPayload(
  intake: ProducerClientIntake,
  materials: ProducerClientMaterial[],
): CreateProducerReviewInput | null {
  const grounding = summarizeProducerClientGrounding(intake, materials);
  const outdatedCount = materials.filter((material) => material.status === 'outdated').length;
  const brandAssetCount = grounding.materialsByType.brand_asset ?? 0;
  const referenceCount = grounding.materialsByType.reference ?? 0;
  const documentCount = grounding.materialsByType.document ?? 0;
  const feedbackCount = grounding.materialsByType.feedback ?? 0;
  const expectsFeedback = materials.some((material) => (
    material.status === 'in_review'
    || material.phase === 'postproduction'
  ));

  const missingItems = [
    materials.length === 0 ? 'Ingen klientmaterialer er lastet opp ennå' : null,
    outdatedCount > 0 ? `${outdatedCount} material${outdatedCount === 1 ? '' : 'er'} trenger oppdatering` : null,
    brandAssetCount === 0 ? 'Logo og merkevarefiler mangler' : null,
    referenceCount === 0 && !hasText(intake.referenceLinks) ? 'Referanser eller visuell retning mangler' : null,
    documentCount === 0 ? 'Dokumentasjon eller prosjektkrav mangler' : null,
    expectsFeedback && feedbackCount === 0 ? 'Ingen klienttilbakemelding er registrert ennå' : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (missingItems.length === 0) {
    return null;
  }

  const detailParts = [
    'Klienten må laste opp eller oppdatere materiale for at produsenten skal kunne planlegge og levere konsistent.',
    `Behov nå: ${missingItems.join(', ')}`,
    grounding.topMaterialTitles.length > 0
      ? `Tilgjengelig nå: ${grounding.topMaterialTitles.slice(0, 3).join(', ')}`
      : null,
    hasText(intake.materialOverview) ? `Materialoversikt: ${intake.materialOverview}` : null,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    reviewType: CLIENT_MATERIAL_REVIEW_TYPE,
    title: materials.length === 0
      ? 'Klienten må legge inn prosjektmateriale'
      : 'Klientmateriale må suppleres eller oppdateres',
    description: detailParts.join(' · '),
    targetEntityType: 'client_material',
    targetEntityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
    metadata: {
      source: CLIENT_GROUNDING_REVIEW_SOURCE,
      groundingEntity: 'client_material',
      focusedPhase: 'preproduction',
      phase: 'preproduction',
      materialCount: grounding.materialCount,
      materialsByType: grounding.materialsByType,
      materialsByPhase: grounding.materialsByPhase,
      missingItems,
      topMaterialTitles: grounding.topMaterialTitles,
    },
  };
}

function matchesTimelinePayload(
  item: ProducerTimelineItem,
  payload: CreateProducerTimelineItemInput,
): boolean {
  const payloadMetadata = payload.metadata ?? {};
  return item.phase === payload.phase
    && item.title === payload.title
    && (item.description ?? null) === (payload.description ?? null)
    && (item.status ?? 'planned') === (payload.status ?? 'planned')
    && (item.linked_entity_type ?? null) === (payload.linkedEntityType ?? null)
    && (item.linked_entity_id ?? null) === (payload.linkedEntityId ?? null)
    && stableSerialize(item.metadata ?? {}) === stableSerialize(payloadMetadata);
}

async function syncClientGroundingTimeline(projectId: string): Promise<void> {
  const [timelineItems, intake, materials] = await Promise.all([
    producerWorkflowService.getTimeline(projectId),
    producerWorkflowService.getClientIntake(projectId),
    producerWorkflowService.getClientMaterials(projectId),
  ]);

  const timelineDefinitions = [
    {
      source: CLIENT_INTAKE_TIMELINE_SOURCE,
      linkedEntityType: 'client_intake',
      linkedEntityId: CLIENT_INTAKE_TIMELINE_ENTITY_ID,
      payload: buildClientIntakeTimelinePayload(intake, materials),
    },
    {
      source: CLIENT_MATERIAL_TIMELINE_SOURCE,
      linkedEntityType: 'client_material',
      linkedEntityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
      payload: buildClientMaterialsTimelinePayload(intake, materials),
    },
  ] as const;

  for (const definition of timelineDefinitions) {
    const existing = timelineItems.find((item) => {
      const metadata = asRecord(item.metadata);
      return readFirstNonEmptyString(metadata.source) === definition.source
        || (
          item.linked_entity_type === definition.linkedEntityType
          && item.linked_entity_id === definition.linkedEntityId
        );
    });

    if (!definition.payload) {
      if (existing) {
        await producerWorkflowService.deleteTimelineItem(projectId, existing.id);
      }
      continue;
    }

    if (!existing) {
      await producerWorkflowService.createTimelineItem(projectId, definition.payload);
      continue;
    }

    if (!matchesTimelinePayload(existing, definition.payload)) {
      await producerWorkflowService.updateTimelineItem(projectId, existing.id, definition.payload);
    }
  }
}

async function syncClientGroundingReviews(projectId: string): Promise<void> {
  const [currentReviews, intake, materials] = await Promise.all([
    producerWorkflowService.getReviews(projectId),
    producerWorkflowService.getClientIntake(projectId),
    producerWorkflowService.getClientMaterials(projectId),
  ]);

  const reviewDefinitions = [
    {
      reviewType: CLIENT_INTAKE_REVIEW_TYPE,
      targetEntityType: 'client_intake',
      targetEntityId: CLIENT_INTAKE_TIMELINE_ENTITY_ID,
      payload: buildClientIntakeReviewPayload(intake, materials),
      resolvedReason: 'Klientbriefen er nå fylt ut og klar til bruk i videre planlegging.',
    },
    {
      reviewType: CLIENT_MATERIAL_REVIEW_TYPE,
      targetEntityType: 'client_material',
      targetEntityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
      payload: buildClientMaterialsReviewPayload(intake, materials),
      resolvedReason: 'Klientmaterialet er nå oppdatert og kan brukes i plan, produksjon og levering.',
    },
  ] as const;

  for (const definition of reviewDefinitions) {
    const relatedReviews = currentReviews
      .filter((review) => {
        const metadata = asRecord(review.metadata);
        return readFirstNonEmptyString(metadata.source) === CLIENT_GROUNDING_REVIEW_SOURCE
          && (
            review.review_type === definition.reviewType
            || (
              review.target_entity_type === definition.targetEntityType
              && review.target_entity_id === definition.targetEntityId
            )
          );
      })
      .sort((left, right) => getReviewActivityTimestamp(right) - getReviewActivityTimestamp(left));

    const openReview = relatedReviews.find((review) => isPendingReviewStatus(review.status));

    if (!definition.payload) {
      if (openReview) {
        await producerWorkflowService.setReviewDecisionWithTimeline(projectId, openReview.id, {
          decision: 'approved',
          reason: definition.resolvedReason,
        });
      }
      continue;
    }

    if (!openReview) {
      await producerWorkflowService.createReviewWithTimeline(projectId, definition.payload);
      continue;
    }

    if (!isReviewEquivalentToPayload(openReview, definition.payload)) {
      await producerWorkflowService.updateReviewWithTimeline(projectId, openReview.id, definition.payload);
    }
  }
}

function queueClientGroundingResync(projectId: string): void {
  void (async () => {
    try {
      await Promise.all([
        syncClientGroundingTimeline(projectId),
        syncClientGroundingReviews(projectId),
      ]);
      emitProducerWorkflowEvent({
        projectId,
        domain: 'timeline',
        mutation: 'reloaded',
        entityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
      });
      emitProducerWorkflowEvent({
        projectId,
        domain: 'reviews',
        mutation: 'reloaded',
        entityId: CLIENT_MATERIAL_TIMELINE_ENTITY_ID,
      });
      emitProducerWorkflowEvent({
        projectId,
        domain: 'project',
        mutation: 'updated',
        entityId: projectId,
      });
    } catch (error) {
      logRoleRoomDiagnostic('producer-workflow:client-grounding-resync-failed', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

function asRecord(value: unknown): LooseRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as LooseRecord;
  }
  return {};
}

function buildAuthHeaders(): Record<string, string> {
  const headers = authSessionService.getAuthHeadersSync();
  const session = authSessionService.getSessionSync();
  const adminUser = session.adminUser;

  if (typeof session.currentUserId === 'string' && session.currentUserId.trim().length > 0) {
    headers['x-role-room-user-id'] = session.currentUserId.trim();
  }
  if (typeof adminUser?.email === 'string' && adminUser.email.trim().length > 0) {
    headers['x-role-room-email'] = adminUser.email.trim();
  }
  if (typeof adminUser?.role === 'string' && adminUser.role.trim().length > 0) {
    headers['x-role-room-role'] = adminUser.role.trim();
  }
  if (typeof adminUser?.loginAs === 'string' && adminUser.loginAs.trim().length > 0) {
    headers['x-role-room-login-as'] = adminUser.loginAs.trim();
  }
  if (typeof adminUser?.requestedRole === 'string' && adminUser.requestedRole.trim().length > 0) {
    headers['x-role-room-requested-role'] = adminUser.requestedRole.trim();
  }

  return headers;
}

async function producerWorkflowRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }

    const errorRecord = asRecord(parsedBody);
    const detail =
      readFirstNonEmptyString(errorRecord.error, errorRecord.message, errorRecord.detail)
      ?? (typeof parsedBody === 'string' && parsedBody.trim().length > 0 ? parsedBody.trim() : undefined)
      ?? `Producer workflow request failed (${response.status})`;

    if (detail.includes('Mangler x-api-key header eller gyldig session')) {
      void authSessionService.clearSession();
      throw new Error('Role Room-sesjonen mangler eller har utløpt. Logg inn på nytt.');
    }

    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();
  if (!responseText.trim()) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

async function producerWorkflowFormDataRequest<T>(endpoint: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: buildAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const rawBody = await response.text().catch(() => '');
    let parsedBody: unknown = null;
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        parsedBody = rawBody;
      }
    }
    const errorRecord = asRecord(parsedBody);
    const detail =
      readFirstNonEmptyString(errorRecord.error, errorRecord.message, errorRecord.detail)
      ?? (typeof parsedBody === 'string' && parsedBody.trim().length > 0 ? parsedBody.trim() : undefined)
      ?? `Producer workflow upload failed (${response.status})`;
    throw new Error(detail);
  }

  const responseText = await response.text();
  return responseText.trim() ? JSON.parse(responseText) as T : undefined as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(prefix: string): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readFirstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readSeedKey(metadata?: Record<string, unknown> | null): string | null {
  const value = metadata?.seedKey;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }
  return { ...(metadata as Record<string, unknown>) };
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function normalizePhase(value: unknown): ProducerPhase {
  if (value === 'production' || value === 'postproduction') {
    return value;
  }
  return 'preproduction';
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }
  return fallback;
}

function isMissingProducerTimelineItemError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /fant ikke tidslinjeelement/i.test(error.message)
    || /producer workflow request failed \\(404\\)/i.test(error.message);
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function getActorUserId(): string {
  const session = authSessionService.getSessionSync();
  return (
    readFirstNonEmptyString(
      session.currentUserId,
      session.adminUser?.email,
      session.adminUser?.id !== undefined && session.adminUser?.id !== null ? String(session.adminUser.id) : undefined,
      getCurrentUserId(),
    )
    ?? 'default-user'
  );
}

type ProducerWorkspaceSessionRole = 'production_team' | 'content_producer' | 'client_reviewer';

function getCurrentProducerWorkspaceSessionRole(): ProducerWorkspaceSessionRole {
  const session = authSessionService.getSessionSync();
  const normalizedRole = readFirstNonEmptyString(session.adminUser?.role)?.toLowerCase();
  const normalizedLoginAs = readFirstNonEmptyString(session.adminUser?.loginAs)?.toLowerCase();
  const normalizedRequestedRole = readFirstNonEmptyString(session.adminUser?.requestedRole)?.toLowerCase();

  if (normalizedLoginAs === 'content_producer') {
    if (normalizedRequestedRole === 'client' || normalizedRequestedRole === 'client_reviewer') {
      return 'client_reviewer';
    }
    return 'content_producer';
  }

  if (normalizedRequestedRole === 'client' || normalizedRequestedRole === 'client_reviewer') {
    return 'client_reviewer';
  }

  if (normalizedRequestedRole === 'content_producer') {
    return 'content_producer';
  }

  if (normalizedRole === 'client_reviewer') {
    return 'client_reviewer';
  }

  if (normalizedRole === 'content_producer') {
    return 'content_producer';
  }

  return 'production_team';
}

function canCurrentSessionMutateProducerWorkflow(): boolean {
  return getCurrentProducerWorkspaceSessionRole() !== 'client_reviewer';
}

function compareIso(left?: string | null, right?: string | null): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, 'nb-NO');
}

function sortTimelineItems(items: ProducerTimelineItem[]): ProducerTimelineItem[] {
  const phaseRank: Record<ProducerPhase, number> = {
    preproduction: 0,
    production: 1,
    postproduction: 2,
  };

  return [...items].sort((left, right) => {
    const phaseDelta = phaseRank[left.phase] - phaseRank[right.phase];
    if (phaseDelta !== 0) {
      return phaseDelta;
    }
    const sortDelta = left.sort_order - right.sort_order;
    if (sortDelta !== 0) {
      return sortDelta;
    }
    const dueDelta = compareIso(left.due_at, right.due_at);
    if (dueDelta !== 0) {
      return dueDelta;
    }
    return compareIso(left.created_at, right.created_at);
  });
}

function sortEconomyItems(items: ProducerEconomyItem[]): ProducerEconomyItem[] {
  const phaseRank: Record<ProducerPhase, number> = {
    preproduction: 0,
    production: 1,
    postproduction: 2,
  };

  return [...items].sort((left, right) => {
    const phaseDelta = phaseRank[left.phase] - phaseRank[right.phase];
    if (phaseDelta !== 0) {
      return phaseDelta;
    }
    const sortDelta = left.sort_order - right.sort_order;
    if (sortDelta !== 0) {
      return sortDelta;
    }
    return compareIso(left.created_at, right.created_at);
  });
}

function sortReviewComments(items: ProducerReviewComment[]): ProducerReviewComment[] {
  return [...items].sort((left, right) => compareIso(left.created_at, right.created_at));
}

function sortReviews(items: ProducerClientReview[]): ProducerClientReview[] {
  return [...items].sort((left, right) => compareIso(right.requested_at, left.requested_at));
}

function normalizeTimelineItem(value: unknown, projectId: string, index = 0): ProducerTimelineItem {
  const record = asRecord(value);
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? createdAt;

  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-timeline'),
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    phase: normalizePhase(record.phase),
    title: readFirstNonEmptyString(record.title) ?? 'Ny milepæl',
    description: readFirstNonEmptyString(record.description) ?? null,
    owner_user_id: readFirstNonEmptyString(record.owner_user_id, record.ownerUserId) ?? null,
    due_at: readFirstNonEmptyString(record.due_at, record.dueAt) ?? null,
    status: readFirstNonEmptyString(record.status) ?? 'planned',
    linked_entity_type: readFirstNonEmptyString(record.linked_entity_type, record.linkedEntityType) ?? null,
    linked_entity_id: readFirstNonEmptyString(record.linked_entity_id, record.linkedEntityId) ?? null,
    sort_order: normalizeNumber(record.sort_order ?? record.sortOrder, index),
    metadata: normalizeMetadata(record.metadata),
    created_by: readFirstNonEmptyString(record.created_by, record.createdBy) ?? getActorUserId(),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeEconomyItem(value: unknown, projectId: string, index = 0): ProducerEconomyItem {
  const record = asRecord(value);
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? createdAt;

  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-economy'),
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    phase: normalizePhase(record.phase),
    category: readFirstNonEmptyString(record.category) ?? 'Ukategorisert',
    item_name: readFirstNonEmptyString(record.item_name, record.itemName) ?? 'Ny kostlinje',
    description: readFirstNonEmptyString(record.description) ?? null,
    estimate: normalizeNumber(record.estimate),
    approved: normalizeNumber(record.approved),
    actual: normalizeNumber(record.actual),
    currency: readFirstNonEmptyString(record.currency) ?? 'NOK',
    status: readFirstNonEmptyString(record.status) ?? 'draft',
    client_visible: normalizeBoolean(record.client_visible ?? record.clientVisible, true),
    linked_entity_type: readFirstNonEmptyString(record.linked_entity_type, record.linkedEntityType) ?? null,
    linked_entity_id: readFirstNonEmptyString(record.linked_entity_id, record.linkedEntityId) ?? null,
    sort_order: normalizeNumber(record.sort_order ?? record.sortOrder, index),
    metadata: normalizeMetadata(record.metadata),
    created_by: readFirstNonEmptyString(record.created_by, record.createdBy) ?? getActorUserId(),
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeReviewComment(value: unknown, projectId: string, reviewId: string): ProducerReviewComment {
  const record = asRecord(value);
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? createdAt;
  const rawTimestamp = record.timestamp_seconds ?? record.timestampSeconds;
  const normalizedTimestamp =
    rawTimestamp === null || rawTimestamp === undefined
      ? null
      : normalizeNumber(rawTimestamp, Number.NaN);

  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-review-comment'),
    review_id: readFirstNonEmptyString(record.review_id, record.reviewId) ?? reviewId,
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    author_user_id: readFirstNonEmptyString(record.author_user_id, record.authorUserId) ?? null,
    author_role: readFirstNonEmptyString(record.author_role, record.authorRole) ?? null,
    comment_text: readFirstNonEmptyString(record.comment_text, record.commentText) ?? '',
    timestamp_seconds: Number.isFinite(normalizedTimestamp) ? normalizedTimestamp : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function normalizeReview(value: unknown, projectId: string): ProducerClientReview {
  const record = asRecord(value);
  const reviewId = readFirstNonEmptyString(record.id) ?? generateId('producer-review');
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const requestedAt = readFirstNonEmptyString(record.requested_at, record.requestedAt) ?? createdAt;
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? requestedAt;
  const rawComments = Array.isArray(record.comments) ? record.comments : [];

  return {
    id: reviewId,
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    review_type: readFirstNonEmptyString(record.review_type, record.reviewType) ?? 'shotlist',
    title: readFirstNonEmptyString(record.title) ?? 'Ny klientgodkjenning',
    description: readFirstNonEmptyString(record.description) ?? null,
    target_entity_type: readFirstNonEmptyString(record.target_entity_type, record.targetEntityType) ?? null,
    target_entity_id: readFirstNonEmptyString(record.target_entity_id, record.targetEntityId) ?? null,
    requested_by_user_id: readFirstNonEmptyString(record.requested_by_user_id, record.requestedByUserId) ?? getActorUserId(),
    requested_at: requestedAt,
    due_at: readFirstNonEmptyString(record.due_at, record.dueAt) ?? null,
    status: readFirstNonEmptyString(record.status) ?? 'pending',
    decision_by_user_id: readFirstNonEmptyString(record.decision_by_user_id, record.decisionByUserId) ?? null,
    decision_at: readFirstNonEmptyString(record.decision_at, record.decisionAt) ?? null,
    decision_reason: readFirstNonEmptyString(record.decision_reason, record.decisionReason) ?? null,
    metadata: normalizeMetadata(record.metadata),
    created_at: createdAt,
    updated_at: updatedAt,
    comments: sortReviewComments(
      rawComments
        .map((comment) => normalizeReviewComment(comment, projectId, reviewId))
        .filter((comment) => comment.comment_text.trim().length > 0),
    ),
  };
}

function normalizeNotification(value: unknown, projectId: string): ProducerProjectNotification {
  const record = asRecord(value);
  const createdAt = readFirstNonEmptyString(record.created_at, record.createdAt) ?? nowIso();
  const updatedAt = readFirstNonEmptyString(record.updated_at, record.updatedAt) ?? createdAt;
  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-notification'),
    project_id: readFirstNonEmptyString(record.project_id, record.projectId) ?? projectId,
    audience: readFirstNonEmptyString(record.audience) ?? 'producer_team',
    event_type: readFirstNonEmptyString(record.event_type, record.eventType) ?? 'unknown',
    inbox_type: readFirstNonEmptyString(record.inbox_type, record.inboxType) ?? 'general',
    title: readFirstNonEmptyString(record.title) ?? 'Nytt varsel',
    message: readFirstNonEmptyString(record.message) ?? null,
    client_name: readFirstNonEmptyString(record.client_name, record.clientName) ?? null,
    client_email: readFirstNonEmptyString(record.client_email, record.clientEmail) ?? null,
    linked_entity_type: readFirstNonEmptyString(record.linked_entity_type, record.linkedEntityType) ?? null,
    linked_entity_id: readFirstNonEmptyString(record.linked_entity_id, record.linkedEntityId) ?? null,
    assigned_to_user_id: readFirstNonEmptyString(record.assigned_to_user_id, record.assignedToUserId) ?? null,
    assigned_to_label: readFirstNonEmptyString(record.assigned_to_label, record.assignedToLabel) ?? null,
    due_at: readFirstNonEmptyString(record.due_at, record.dueAt) ?? null,
    resolved_at: readFirstNonEmptyString(record.resolved_at, record.resolvedAt) ?? null,
    resolved_by_user_id: readFirstNonEmptyString(record.resolved_by_user_id, record.resolvedByUserId) ?? null,
    archived_at: readFirstNonEmptyString(record.archived_at, record.archivedAt) ?? null,
    archived_by_user_id: readFirstNonEmptyString(record.archived_by_user_id, record.archivedByUserId) ?? null,
    mention_user_ids: normalizeStringArray(record.mention_user_ids ?? record.mentionUserIds),
    mention_emails: normalizeStringArray(record.mention_emails ?? record.mentionEmails).map((email) => email.toLowerCase()),
    metadata: normalizeMetadata(record.metadata),
    created_by_user_id: readFirstNonEmptyString(record.created_by_user_id, record.createdByUserId) ?? null,
    created_by_role: readFirstNonEmptyString(record.created_by_role, record.createdByRole) ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    read: normalizeBoolean(record.read, false),
    read_at: readFirstNonEmptyString(record.read_at, record.readAt) ?? null,
  };
}

function normalizeExpenseReceiptFile(value: unknown, projectId: string, expenseId: string): ProducerExpenseReceiptFile {
  const record = asRecord(value);
  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-receipt'),
    expenseId: readFirstNonEmptyString(record.expenseId, record.expense_id) ?? expenseId,
    projectId: readFirstNonEmptyString(record.projectId, record.project_id) ?? projectId,
    fileName: readFirstNonEmptyString(record.fileName, record.file_name) ?? null,
    originalName: readFirstNonEmptyString(record.originalName, record.original_name) ?? null,
    mimeType: readFirstNonEmptyString(record.mimeType, record.mime_type) ?? null,
    fileSize: record.fileSize === null || record.file_size === null
      ? null
      : normalizeNumber(record.fileSize ?? record.file_size, Number.NaN),
    sha256: readFirstNonEmptyString(record.sha256) ?? null,
    pageCount: record.pageCount === null || record.page_count === null
      ? null
      : normalizeNumber(record.pageCount ?? record.page_count, Number.NaN),
    metadata: normalizeMetadata(record.metadata),
    createdAt: readFirstNonEmptyString(record.createdAt, record.created_at) ?? null,
  };
}

function normalizeReceiptOcrJob(value: unknown, projectId: string, expenseId: string): ProducerReceiptOcrJob {
  const record = asRecord(value);
  return {
    id: readFirstNonEmptyString(record.id) ?? generateId('producer-ocr-job'),
    expenseId: readFirstNonEmptyString(record.expenseId, record.expense_id) ?? expenseId,
    receiptFileId: readFirstNonEmptyString(record.receiptFileId, record.receipt_file_id) ?? null,
    projectId: readFirstNonEmptyString(record.projectId, record.project_id) ?? projectId,
    status: readFirstNonEmptyString(record.status) ?? 'queued',
    attempts: normalizeNumber(record.attempts, 0),
    confidence: record.confidence === null ? null : normalizeNumber(record.confidence, Number.NaN),
    extractedText: readFirstNonEmptyString(record.extractedText, record.extracted_text) ?? null,
    extractedData: normalizeMetadata(record.extractedData ?? record.extracted_data),
    engine: readFirstNonEmptyString(record.engine) ?? null,
    lastError: readFirstNonEmptyString(record.lastError, record.last_error) ?? null,
    queuedAt: readFirstNonEmptyString(record.queuedAt, record.queued_at) ?? null,
    startedAt: readFirstNonEmptyString(record.startedAt, record.started_at) ?? null,
    completedAt: readFirstNonEmptyString(record.completedAt, record.completed_at) ?? null,
    updatedAt: readFirstNonEmptyString(record.updatedAt, record.updated_at) ?? null,
  };
}

function normalizeExpense(value: unknown, projectId: string): ProducerExpense {
  const record = asRecord(value);
  const id = readFirstNonEmptyString(record.id) ?? generateId('producer-expense');
  const receipts = Array.isArray(record.receipts) ? record.receipts : [];
  const ocrJobs = Array.isArray(record.ocrJobs ?? record.ocr_jobs) ? (record.ocrJobs ?? record.ocr_jobs) as unknown[] : [];
  return {
    id,
    projectId: readFirstNonEmptyString(record.projectId, record.project_id) ?? projectId,
    title: readFirstNonEmptyString(record.title) ?? 'Utlegg',
    description: readFirstNonEmptyString(record.description) ?? null,
    merchantName: readFirstNonEmptyString(record.merchantName, record.merchant_name) ?? null,
    expenseDate: readFirstNonEmptyString(record.expenseDate, record.expense_date) ?? null,
    amount: record.amount === null ? null : normalizeNumber(record.amount, Number.NaN),
    vatAmount: record.vatAmount === null || record.vat_amount === null
      ? null
      : normalizeNumber(record.vatAmount ?? record.vat_amount, Number.NaN),
    currency: readFirstNonEmptyString(record.currency) ?? 'NOK',
    category: readFirstNonEmptyString(record.category) ?? null,
    paidByUserId: readFirstNonEmptyString(record.paidByUserId, record.paid_by_user_id) ?? null,
    paidByLabel: readFirstNonEmptyString(record.paidByLabel, record.paid_by_label) ?? null,
    costOwner: readFirstNonEmptyString(record.costOwner, record.cost_owner) ?? 'client',
    refundStatus: readFirstNonEmptyString(record.refundStatus, record.refund_status) ?? 'not_requested',
    clientApprovalStatus: readFirstNonEmptyString(record.clientApprovalStatus, record.client_approval_status) ?? 'pending',
    duplicateOfExpenseId: readFirstNonEmptyString(record.duplicateOfExpenseId, record.duplicate_of_expense_id) ?? null,
    ocrStatus: readFirstNonEmptyString(record.ocrStatus, record.ocr_status) ?? 'pending',
    ocrConfidence: record.ocrConfidence === null || record.ocr_confidence === null
      ? null
      : normalizeNumber(record.ocrConfidence ?? record.ocr_confidence, Number.NaN),
    ocrReviewRequired: normalizeBoolean(record.ocrReviewRequired ?? record.ocr_review_required, true),
    amountValidationStatus: readFirstNonEmptyString(record.amountValidationStatus, record.amount_validation_status) ?? 'pending',
    vatValidationStatus: readFirstNonEmptyString(record.vatValidationStatus, record.vat_validation_status) ?? 'pending',
    privacyNoticeAcknowledgedAt: readFirstNonEmptyString(record.privacyNoticeAcknowledgedAt, record.privacy_notice_acknowledged_at) ?? null,
    metadata: normalizeMetadata(record.metadata),
    receipts: receipts.map((receipt) => normalizeExpenseReceiptFile(receipt, projectId, id)),
    ocrJobs: ocrJobs.map((job) => normalizeReceiptOcrJob(job, projectId, id)),
    createdAt: readFirstNonEmptyString(record.createdAt, record.created_at) ?? null,
    updatedAt: readFirstNonEmptyString(record.updatedAt, record.updated_at) ?? null,
  };
}

async function readLegacyTimelineStore(projectId: string): Promise<ProducerTimelineItem[]> {
  const stored = await settingsService.getSetting<ProducerTimelineItem[]>(TIMELINE_NAMESPACE, { projectId });
  if (!Array.isArray(stored)) {
    return [];
  }
  return sortTimelineItems(stored.map((item, index) => normalizeTimelineItem(item, projectId, index)));
}

async function clearLegacyTimelineStore(projectId: string): Promise<void> {
  await settingsService.setSetting(TIMELINE_NAMESPACE, [], { projectId });
}

async function readLegacyEconomyStore(projectId: string): Promise<ProducerEconomyItem[]> {
  const stored = await settingsService.getSetting<ProducerEconomyItem[]>(ECONOMY_NAMESPACE, { projectId });
  if (!Array.isArray(stored)) {
    return [];
  }
  return sortEconomyItems(stored.map((item, index) => normalizeEconomyItem(item, projectId, index)));
}

async function clearLegacyEconomyStore(projectId: string): Promise<void> {
  await settingsService.setSetting(ECONOMY_NAMESPACE, [], { projectId });
}

async function readLegacyReviewStore(projectId: string): Promise<ProducerClientReview[]> {
  const stored = await settingsService.getSetting<ProducerClientReview[]>(REVIEWS_NAMESPACE, { projectId });
  if (!Array.isArray(stored)) {
    return [];
  }
  return sortReviews(stored.map((review) => normalizeReview(review, projectId)));
}

async function clearLegacyReviewStore(projectId: string): Promise<void> {
  await settingsService.setSetting(REVIEWS_NAMESPACE, [], { projectId });
}

function buildDefinedBody(entries: Array<[string, unknown]>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (value !== undefined) {
      body[key] = value;
    }
  }
  return body;
}

async function fetchTimeline(projectId: string): Promise<ProducerTimelineItem[]> {
  const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/timeline`);
  const items = Array.isArray(response.items) ? response.items : [];
  return sortTimelineItems(items.map((item, index) => normalizeTimelineItem(item, projectId, index)));
}

async function fetchEconomy(projectId: string): Promise<ProducerEconomyItem[]> {
  const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/economy/items`);
  const items = Array.isArray(response.items) ? response.items : [];
  return sortEconomyItems(items.map((item, index) => normalizeEconomyItem(item, projectId, index)));
}

async function fetchReviews(projectId: string): Promise<ProducerClientReview[]> {
  const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/reviews`);
  const items = Array.isArray(response.items) ? response.items : [];
  return sortReviews(items.map((review) => normalizeReview(review, projectId)));
}

async function fetchNotifications(projectId: string): Promise<ProducerProjectNotification[]> {
  const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/notifications`);
  const items = Array.isArray(response.items) ? response.items : [];
  return items
    .map((item) => normalizeNotification(item, projectId))
    .sort((left, right) => compareIso(right.updated_at, left.updated_at));
}

async function fetchExpenses(projectId: string): Promise<ProducerExpense[]> {
  const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/expenses`);
  const items = Array.isArray(response.items) ? response.items : [];
  return items
    .map((item) => normalizeExpense(item, projectId))
    .sort((left, right) => compareIso(right.updatedAt, left.updatedAt));
}

async function fetchClientIntake(projectId: string): Promise<ProducerClientIntake> {
  const response = await producerWorkflowRequest<{ intake?: unknown | null }>(`/projects/${projectId}/producer/client-intake`);
  return normalizeClientIntake(response.intake ?? {});
}

async function readClientMaterialsFromStorage(projectId: string): Promise<ProducerClientMaterial[]> {
  const stored = await settingsService.getSetting<ProducerClientMaterial[]>(CLIENT_MATERIALS_NAMESPACE, { projectId });
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .map((item) => normalizeClientMaterial(item, projectId))
    .sort((left, right) => compareIso(right.updated_at, left.updated_at));
}

async function writeClientMaterialsToStorage(projectId: string, items: ProducerClientMaterial[]): Promise<void> {
  await settingsService.setSetting(CLIENT_MATERIALS_NAMESPACE, items, { projectId });
}

async function fetchClientMaterials(projectId: string): Promise<ProducerClientMaterial[]> {
  try {
    const response = await producerWorkflowRequest<{ items?: unknown[] }>(`/projects/${projectId}/producer/client-materials`);
    const items = Array.isArray(response.items) ? response.items : [];
    return items
      .map((item) => normalizeClientMaterial(item, projectId))
      .sort((left, right) => compareIso(right.updated_at, left.updated_at));
  } catch (error) {
    // Backend ikke tilgjengelig (offline / e2e-harness uten server) — bruk
    // localStorage som fallback. Skriver/leser samme namespace som createClientMaterial.
    console.warn('[producerWorkflowService] fetchClientMaterials falt tilbake til localStorage:', error);
    return readClientMaterialsFromStorage(projectId);
  }
}

const CLIENT_INPUT_READ_CACHE_TTL_MS = 3_000;
const WORKFLOW_READ_CACHE_TTL_MS = 2_500;
const clientIntakeReadCache = new Map<string, { expiresAt: number; promise: Promise<ProducerClientIntake> }>();
const clientMaterialsReadCache = new Map<string, { expiresAt: number; promise: Promise<ProducerClientMaterial[]> }>();
const timelineReadCache = new Map<string, { expiresAt: number; promise: Promise<ProducerTimelineItem[]> }>();
const reviewsReadCache = new Map<string, { expiresAt: number; promise: Promise<ProducerClientReview[]> }>();

function getCachedClientIntake(projectId: string): Promise<ProducerClientIntake> {
  const now = Date.now();
  const cached = clientIntakeReadCache.get(projectId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchClientIntake(projectId);
  clientIntakeReadCache.set(projectId, {
    expiresAt: now + CLIENT_INPUT_READ_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

function getCachedClientMaterials(projectId: string): Promise<ProducerClientMaterial[]> {
  const now = Date.now();
  const cached = clientMaterialsReadCache.get(projectId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchClientMaterials(projectId);
  clientMaterialsReadCache.set(projectId, {
    expiresAt: now + CLIENT_INPUT_READ_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

function clearClientInputReadCache(projectId: string): void {
  clientIntakeReadCache.delete(projectId);
  clientMaterialsReadCache.delete(projectId);
}

async function migrateLegacyTimelineIfNeeded(projectId: string, currentItems: ProducerTimelineItem[]): Promise<ProducerTimelineItem[]> {
  if (currentItems.length > 0) {
    return currentItems;
  }

  if (!canCurrentSessionMutateProducerWorkflow()) {
    return currentItems;
  }

  const legacyItems = await readLegacyTimelineStore(projectId);
  if (legacyItems.length === 0) {
    return currentItems;
  }

  for (const item of legacyItems) {
    await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/timeline`, {
      method: 'POST',
      body: JSON.stringify({
        phase: item.phase,
        title: item.title,
        description: item.description ?? null,
        ownerUserId: item.owner_user_id ?? null,
        dueAt: item.due_at ?? null,
        status: item.status,
        linkedEntityType: item.linked_entity_type ?? null,
        linkedEntityId: item.linked_entity_id ?? null,
        sortOrder: item.sort_order,
        metadata: item.metadata ?? {},
      }),
    });
  }

  await clearLegacyTimelineStore(projectId);
  return fetchTimeline(projectId);
}

async function migrateLegacyEconomyIfNeeded(projectId: string, currentItems: ProducerEconomyItem[]): Promise<ProducerEconomyItem[]> {
  if (currentItems.length > 0) {
    return currentItems;
  }

  if (!canCurrentSessionMutateProducerWorkflow()) {
    return currentItems;
  }

  const legacyItems = await readLegacyEconomyStore(projectId);
  if (legacyItems.length === 0) {
    return currentItems;
  }

  for (const item of legacyItems) {
    await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/economy/items`, {
      method: 'POST',
      body: JSON.stringify({
        phase: item.phase,
        category: item.category,
        itemName: item.item_name,
        description: item.description ?? null,
        estimate: normalizeNumber(item.estimate),
        approved: normalizeNumber(item.approved),
        actual: normalizeNumber(item.actual),
        currency: item.currency,
        status: item.status,
        clientVisible: item.client_visible,
        linkedEntityType: item.linked_entity_type ?? null,
        linkedEntityId: item.linked_entity_id ?? null,
        sortOrder: item.sort_order,
        metadata: item.metadata ?? {},
      }),
    });
  }

  await clearLegacyEconomyStore(projectId);
  return fetchEconomy(projectId);
}

async function migrateLegacyReviewsIfNeeded(projectId: string, currentItems: ProducerClientReview[]): Promise<ProducerClientReview[]> {
  if (currentItems.length > 0) {
    return currentItems;
  }

  if (!canCurrentSessionMutateProducerWorkflow()) {
    return currentItems;
  }

  const legacyReviews = await readLegacyReviewStore(projectId);
  if (legacyReviews.length === 0) {
    return currentItems;
  }

  for (const review of legacyReviews) {
    const createdResponse = await producerWorkflowRequest<{ review?: unknown }>(`/projects/${projectId}/producer/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        reviewType: review.review_type,
        title: review.title,
        description: review.description ?? null,
        targetEntityType: review.target_entity_type ?? null,
        targetEntityId: review.target_entity_id ?? null,
        dueAt: review.due_at ?? null,
        metadata: review.metadata ?? {},
      }),
    });

    let migratedReview = normalizeReview(createdResponse.review, projectId);

    for (const comment of review.comments ?? []) {
      await producerWorkflowRequest<{ comment?: unknown }>(`/projects/${projectId}/producer/reviews/${migratedReview.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          commentText: comment.comment_text,
          timestampSeconds: comment.timestamp_seconds ?? undefined,
        }),
      });
    }

    if (
      review.status === 'approved'
      || review.status === 'rejected'
      || review.status === 'changes_requested'
    ) {
      const updatedResponse = await producerWorkflowRequest<{ review?: unknown }>(`/projects/${projectId}/producer/reviews/${migratedReview.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: review.status,
          reason: review.decision_reason ?? undefined,
          timestampSeconds: normalizeNumber(review.metadata?.decisionTimestampSeconds, Number.NaN),
        }),
      });
      migratedReview = normalizeReview(updatedResponse.review, projectId);
    }
  }

  await clearLegacyReviewStore(projectId);
  return fetchReviews(projectId);
}

type ProducerWorkflowReadDomain = 'timeline' | 'reviews';

function clearProducerWorkflowReadCache(
  projectId: string,
  domains: ProducerWorkflowReadDomain[] = ['timeline', 'reviews'],
): void {
  if (domains.includes('timeline')) {
    timelineReadCache.delete(projectId);
  }
  if (domains.includes('reviews')) {
    reviewsReadCache.delete(projectId);
  }
}

function getCachedTimeline(projectId: string): Promise<ProducerTimelineItem[]> {
  const now = Date.now();
  const cached = timelineReadCache.get(projectId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchTimeline(projectId)
    .then((remoteItems) => migrateLegacyTimelineIfNeeded(projectId, remoteItems));
  timelineReadCache.set(projectId, {
    expiresAt: now + WORKFLOW_READ_CACHE_TTL_MS,
    promise,
  });
  void promise.catch(() => {
    timelineReadCache.delete(projectId);
  });
  return promise;
}

function getCachedReviews(projectId: string): Promise<ProducerClientReview[]> {
  const now = Date.now();
  const cached = reviewsReadCache.get(projectId);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = fetchReviews(projectId)
    .then((remoteItems) => migrateLegacyReviewsIfNeeded(projectId, remoteItems))
    .then(async (reviews) => {
      await syncProjectWorkflowStatusSnapshot(projectId, reviews);
      return reviews;
    });
  reviewsReadCache.set(projectId, {
    expiresAt: now + WORKFLOW_READ_CACHE_TTL_MS,
    promise,
  });
  void promise.catch(() => {
    reviewsReadCache.delete(projectId);
  });
  return promise;
}

function getReviewTimelinePhase(
  reviewType?: string,
  targetEntityType?: string,
  metadata?: Record<string, unknown> | null,
): ProducerPhase {
  const normalizedReviewType = (reviewType ?? '').trim().toLowerCase();
  const normalizedTargetEntityType = (targetEntityType ?? '').trim().toLowerCase();
  const metadataRecord = asRecord(metadata);
  const focusedPhase = readFirstNonEmptyString(metadataRecord.focusedPhase, metadataRecord.phase);

  if (focusedPhase === 'preproduction' || focusedPhase === 'production' || focusedPhase === 'postproduction') {
    return focusedPhase;
  }

  if (normalizedReviewType === 'budget_package' || normalizedTargetEntityType === 'economy') {
    return 'preproduction';
  }

  if (normalizedReviewType === 'change_order') {
    return 'production';
  }

  if (normalizedTargetEntityType === 'project_agreement') {
    return 'preproduction';
  }

  if (normalizedReviewType === 'phase_checkpoint' || normalizedTargetEntityType === 'phase_plan') {
    return 'preproduction';
  }

  if (normalizedReviewType === 'framework_alignment' || normalizedTargetEntityType === 'planning_framework') {
    return 'preproduction';
  }

  if (normalizedReviewType === 'content_delivery' || normalizedTargetEntityType === 'content_calendar') {
    return 'postproduction';
  }

  if (normalizedReviewType === 'account_access' || normalizedTargetEntityType === 'account_access') {
    return 'postproduction';
  }

  if (normalizedReviewType === MEETING_DECISION_REVIEW_TYPE || normalizedTargetEntityType === MEETING_DECISION_ENTITY_TYPE) {
    return getMeetingPhase(focusedPhase);
  }

  if (['storyboard', 'manuscript', 'shotlist', 'scene_notes', 'location_plan', 'equipment_plan'].includes(normalizedReviewType)) {
    return 'preproduction';
  }

  if (normalizedTargetEntityType === 'shot') {
    return 'production';
  }

  if (normalizedTargetEntityType === 'scene') {
    return 'preproduction';
  }

  return 'preproduction';
}

function getReviewTimelineStatus(reviewStatus?: string): string {
  switch ((reviewStatus ?? '').trim().toLowerCase()) {
    case 'approved':
      return 'completed';
    case 'rejected':
    case 'changes_requested':
      return 'blocked';
    case 'in_progress':
      return 'in_progress';
    default:
      return 'planned';
  }
}

function getReviewTimelineTitle(review: ProducerClientReview): string {
  return `Klientgodkjenning · ${review.title}`;
}

function getReviewTimelineDescription(review: ProducerClientReview): string {
  const parts = [
    review.description?.trim(),
    review.status === 'approved'
      ? 'Godkjent av klient.'
      : review.status === 'changes_requested'
        ? 'Klienten har bedt om endringer.'
        : review.status === 'rejected'
          ? 'Klienten har avslått leveransen.'
          : 'Venter på klientgodkjenning.',
    review.decision_reason?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));

  return parts.join(' ');
}

function isReviewTimelineItem(item: ProducerTimelineItem, reviewId: string): boolean {
  if (item.linked_entity_type === 'client_review' && item.linked_entity_id === reviewId) {
    return true;
  }

  const metadata = item.metadata ?? {};
  return readFirstNonEmptyString(metadata.reviewId) === reviewId;
}

function hasMatchingComment(
  commentText: string,
  timestampSeconds: number | undefined,
  comments: ProducerReviewComment[] | undefined,
): boolean {
  if (!Array.isArray(comments)) {
    return false;
  }

  return comments.some((comment) => (
    comment.comment_text === commentText
    && (comment.timestamp_seconds ?? undefined) === timestampSeconds
  ));
}

function isBudgetPackageReview(review: ProducerClientReview): boolean {
  return review.review_type === 'budget_package'
    || review.target_entity_type === 'economy';
}

function isAgreementReview(review: ProducerClientReview): boolean {
  return review.review_type === 'change_order'
    || review.target_entity_type === 'project_agreement';
}

function isDeliverableReview(review: ProducerClientReview): boolean {
  return review.review_type === 'storyboard'
    || review.review_type === 'manuscript'
    || review.review_type === 'shotlist';
}

function isPlanningManagedReview(review: ProducerClientReview): boolean {
  const metadata = asRecord(review.metadata);
  return readFirstNonEmptyString(metadata.source) === 'producer-planning'
    && (
      review.review_type === 'framework_alignment'
      || review.review_type === 'phase_checkpoint'
      || review.review_type === 'content_delivery'
      || review.review_type === 'account_access'
    );
}

export function isClientGroundingManagedReview(review: ProducerClientReview): boolean {
  const metadata = asRecord(review.metadata);
  return readFirstNonEmptyString(metadata.source) === CLIENT_GROUNDING_REVIEW_SOURCE
    && (
      review.review_type === CLIENT_INTAKE_REVIEW_TYPE
      || review.review_type === CLIENT_MATERIAL_REVIEW_TYPE
    );
}

function buildPlanningReviewPayload(
  moment: ReturnType<typeof getProducerPlanningClientMoments>[number],
): CreateProducerReviewInput {
  const targetEntityType = moment.type === 'framework_alignment'
    ? 'planning_framework'
    : moment.type === 'phase_checkpoint'
      ? 'phase_plan'
      : moment.type === 'account_access'
        ? 'account_access'
      : 'content_calendar';
  const accountPlatform = moment.type === 'account_access'
    ? readFirstNonEmptyString(moment.id.split(':')[1])
    : null;
  const descriptionParts = [
    moment.detail,
    moment.owner ? `Ansvarlig: ${moment.owner}` : '',
    moment.date ? `Planlagt: ${moment.date}` : '',
    `Planstatus: ${moment.statusLabel}`,
  ].filter((value): value is string => value.trim().length > 0);

  return {
    reviewType: moment.type,
    title: moment.title,
    description: descriptionParts.join(' · '),
    targetEntityType,
    targetEntityId: moment.id,
    dueAt: moment.date,
    metadata: {
      source: 'producer-planning',
      planningMomentId: moment.id,
      planningMomentType: moment.type,
      deliveryItemIds: moment.type === 'content_delivery'
        ? [readFirstNonEmptyString(moment.id.replace(/^content:/, ''))]
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
        : [],
      accountAccessPlatform: accountPlatform,
      accountAccessPlatforms: accountPlatform ? [accountPlatform] : [],
      focusedPhase: moment.phase,
      phase: moment.phase,
      planningFrameworkKey: moment.type === 'framework_alignment'
        ? readFirstNonEmptyString(moment.id.split(':')[1])
        : null,
      linkedShotListId: moment.linkedShotListId ?? null,
      statusLabel: moment.statusLabel,
      owner: moment.owner ?? null,
      priority: moment.priority,
    },
  };
}

function shouldDeletePlanningReview(review: ProducerClientReview): boolean {
  return isPlanningManagedReview(review)
    && isPendingReviewStatus(review.status)
    && (review.comments?.length ?? 0) === 0;
}

function isMeetingManagedReview(review: ProducerClientReview): boolean {
  const metadata = asRecord(review.metadata);
  return readFirstNonEmptyString(metadata.source) === MEETING_WORKSPACE_SOURCE
    && review.review_type === MEETING_DECISION_REVIEW_TYPE;
}

function shouldDeleteMeetingReview(review: ProducerClientReview): boolean {
  return isMeetingManagedReview(review)
    && isPendingReviewStatus(review.status)
    && (review.comments?.length ?? 0) === 0;
}

function isMeetingManagedTimelineItem(item: ProducerTimelineItem): boolean {
  const metadata = asRecord(item.metadata);
  return readFirstNonEmptyString(metadata.source) === MEETING_WORKSPACE_SOURCE
    && (
      readFirstNonEmptyString(metadata.meetingItemType) === 'decision'
      || readFirstNonEmptyString(metadata.meetingItemType) === 'follow_up'
    );
}

function getMeetingItemIdFromMetadata(metadata: Record<string, unknown>): string | null {
  return readFirstNonEmptyString(metadata.meetingItemId, metadata.meeting_item_id) ?? null;
}

function getMeetingPhase(value: unknown): ProducerPhase {
  if (value === 'preproduction' || value === 'production' || value === 'postproduction') {
    return value;
  }
  return 'preproduction';
}

function getMeetingDecisionTimelineStatus(decision: ProducerMeetingDecisionItem): string {
  return decision.status === 'done' ? 'completed' : 'planned';
}

function getMeetingFollowUpTimelineStatus(followUp: ProducerMeetingFollowUpItem): string {
  if (followUp.status === 'done') {
    return 'completed';
  }
  if (followUp.status === 'in_progress') {
    return 'in_progress';
  }
  return 'planned';
}

function buildMeetingDecisionDescription(
  decision: ProducerMeetingDecisionItem,
  planning: ProducerProjectPlanning,
): string {
  const parts = [
    planning.meetingWorkspace.sessionLabel?.trim(),
    decision.owner?.trim() ? `Ansvarlig: ${decision.owner.trim()}` : null,
    decision.notes?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));
  return parts.join(' · ');
}

function buildMeetingFollowUpDescription(
  followUp: ProducerMeetingFollowUpItem,
  planning: ProducerProjectPlanning,
): string {
  const parts = [
    planning.meetingWorkspace.sessionLabel?.trim(),
    followUp.owner?.trim() ? `Ansvarlig: ${followUp.owner.trim()}` : null,
    followUp.notes?.trim(),
  ].filter((value): value is string => Boolean(value && value.length > 0));
  return parts.join(' · ');
}

function buildMeetingDecisionReviewPayload(
  decision: ProducerMeetingDecisionItem,
  planning: ProducerProjectPlanning,
): CreateProducerReviewInput {
  const phase = getMeetingPhase(decision.phase);
  return {
    reviewType: MEETING_DECISION_REVIEW_TYPE,
    title: decision.title.trim(),
    description: buildMeetingDecisionDescription(decision, planning) || undefined,
    targetEntityType: MEETING_DECISION_ENTITY_TYPE,
    targetEntityId: decision.id,
    dueAt: decision.dueAt ?? undefined,
    metadata: {
      source: MEETING_WORKSPACE_SOURCE,
      meetingItemType: 'decision',
      meetingItemId: decision.id,
      meetingStatus: planning.meetingWorkspace.status,
      meetingSessionLabel: planning.meetingWorkspace.sessionLabel ?? null,
      focusedPhase: phase,
      phase,
      clientVisible: true,
      owner: decision.owner ?? null,
      activeMeetUrl: planning.meetingWorkspace.activeMeetUrl ?? null,
      linkedEntityType: decision.linkedEntityType ?? null,
      linkedEntityId: decision.linkedEntityId ?? null,
    },
  };
}

function buildMeetingDecisionTimelinePayload(
  decision: ProducerMeetingDecisionItem,
  planning: ProducerProjectPlanning,
  sortOrder: number,
): CreateProducerTimelineItemInput {
  const phase = getMeetingPhase(decision.phase);
  return {
    phase,
    title: `Møtebeslutning · ${decision.title.trim()}`,
    description: buildMeetingDecisionDescription(decision, planning) || undefined,
    dueAt: decision.dueAt ?? undefined,
    status: getMeetingDecisionTimelineStatus(decision),
    linkedEntityType: MEETING_DECISION_ENTITY_TYPE,
    linkedEntityId: decision.id,
    sortOrder,
    metadata: {
      source: MEETING_WORKSPACE_SOURCE,
      meetingItemType: 'decision',
      meetingItemId: decision.id,
      meetingStatus: planning.meetingWorkspace.status,
      meetingSessionLabel: planning.meetingWorkspace.sessionLabel ?? null,
      focusedPhase: phase,
      phase,
      owner: decision.owner ?? null,
      clientVisible: false,
      activeMeetUrl: planning.meetingWorkspace.activeMeetUrl ?? null,
      linkedEntityType: decision.linkedEntityType ?? null,
      linkedEntityId: decision.linkedEntityId ?? null,
    },
  };
}

function buildMeetingFollowUpTimelinePayload(
  followUp: ProducerMeetingFollowUpItem,
  planning: ProducerProjectPlanning,
  sortOrder: number,
): CreateProducerTimelineItemInput {
  const phase = getMeetingPhase(followUp.phase);
  return {
    phase,
    title: `Møteoppfølging · ${followUp.title.trim()}`,
    description: buildMeetingFollowUpDescription(followUp, planning) || undefined,
    dueAt: followUp.dueAt ?? undefined,
    status: getMeetingFollowUpTimelineStatus(followUp),
    linkedEntityType: MEETING_FOLLOW_UP_ENTITY_TYPE,
    linkedEntityId: followUp.id,
    sortOrder,
    metadata: {
      source: MEETING_WORKSPACE_SOURCE,
      meetingItemType: 'follow_up',
      meetingItemId: followUp.id,
      meetingStatus: planning.meetingWorkspace.status,
      meetingSessionLabel: planning.meetingWorkspace.sessionLabel ?? null,
      focusedPhase: phase,
      phase,
      owner: followUp.owner ?? null,
      activeMeetUrl: planning.meetingWorkspace.activeMeetUrl ?? null,
      linkedEntityType: followUp.linkedEntityType ?? null,
      linkedEntityId: followUp.linkedEntityId ?? null,
    },
  };
}

function isTimelineEquivalentToPayload(
  item: ProducerTimelineItem,
  payload: CreateProducerTimelineItemInput,
): boolean {
  return item.phase === payload.phase
    && item.title === payload.title
    && (item.description ?? null) === (payload.description ?? null)
    && (item.due_at ?? null) === (payload.dueAt ?? null)
    && item.status === payload.status
    && (item.linked_entity_type ?? null) === (payload.linkedEntityType ?? null)
    && (item.linked_entity_id ?? null) === (payload.linkedEntityId ?? null)
    && item.sort_order === (payload.sortOrder ?? item.sort_order)
    && stableSerialize(item.metadata ?? {}) === stableSerialize(payload.metadata ?? {});
}

function isReviewEquivalentToPayload(
  review: ProducerClientReview,
  payload: CreateProducerReviewInput,
): boolean {
  return review.review_type === payload.reviewType
    && review.title === payload.title
    && (review.description ?? null) === (payload.description ?? null)
    && (review.target_entity_type ?? null) === (payload.targetEntityType ?? null)
    && (review.target_entity_id ?? null) === (payload.targetEntityId ?? null)
    && (review.due_at ?? null) === (payload.dueAt ?? null)
    && stableSerialize(review.metadata ?? {}) === stableSerialize(payload.metadata ?? {});
}

function readFocusedPhaseFromReview(review: Pick<ProducerClientReview, 'metadata'>): ProducerPhase | 'all' {
  const metadata = asRecord(review.metadata);
  const value = readFirstNonEmptyString(metadata.focusedPhase, metadata.phase);
  if (value === 'preproduction' || value === 'production' || value === 'postproduction') {
    return value;
  }
  return 'all';
}

function compareProjectWorkflowMeta(
  left?: ProducerWorkflowProjectMeta,
  right?: ProducerWorkflowProjectMeta,
): boolean {
  return stableSerialize(left ?? null) === stableSerialize(right ?? null);
}

function isPendingReviewStatus(reviewStatus?: string | null): boolean {
  return reviewStatus !== 'approved'
    && reviewStatus !== 'rejected'
    && reviewStatus !== 'changes_requested';
}

function getReviewActivityTimestamp(review: ProducerClientReview): number {
  const candidateValues = [
    review.updated_at,
    review.decision_at,
    review.requested_at,
    review.created_at,
  ];

  let highestTimestamp = 0;
  for (const value of candidateValues) {
    if (!value) {
      continue;
    }
    const timestamp = new Date(value).getTime();
    if (Number.isFinite(timestamp) && timestamp > highestTimestamp) {
      highestTimestamp = timestamp;
    }
  }

  return highestTimestamp;
}

function isSyntheticProducerReview(review: ProducerClientReview): boolean {
  const metadata = asRecord(review.metadata);
  const source = readFirstNonEmptyString(metadata.source);

  if (source && SYNTHETIC_REVIEW_SOURCES.has(source)) {
    return true;
  }

  return SYNTHETIC_REVIEW_TITLE_PATTERN.test(review.title.trim());
}

function buildProducerReviewOperationalKey(review: ProducerClientReview): string {
  const metadata = asRecord(review.metadata);
  const planningMomentId = readFirstNonEmptyString(
    metadata.planningMomentId,
    metadata.planning_moment_id,
  );

  if (isPlanningManagedReview(review) && planningMomentId) {
    return `planning:${planningMomentId}`;
  }

  const agreementId = readFirstNonEmptyString(
    metadata.agreementId,
    metadata.agreement_id,
    review.target_entity_type === 'project_agreement' ? review.target_entity_id : undefined,
  );

  if (
    review.review_type === 'change_order'
    || review.review_type === 'client_approval'
    || review.target_entity_type === 'project_agreement'
    || agreementId
  ) {
    return `agreement:${agreementId ?? review.target_entity_id ?? review.title}`;
  }

  if (review.review_type === 'budget_package' || review.target_entity_type === 'economy') {
    const budgetPackageId = readFirstNonEmptyString(
      metadata.packageId,
      metadata.package_id,
      metadata.budgetPackageId,
      metadata.budget_package_id,
      review.target_entity_id,
    );
    const focusedPhase = readFirstNonEmptyString(metadata.focusedPhase, metadata.phase, 'all');
    return `budget:${budgetPackageId ?? focusedPhase}`;
  }

  if (review.review_type === 'storyboard' || review.review_type === 'manuscript' || review.review_type === 'shotlist') {
    const deliverableId = readFirstNonEmptyString(
      review.target_entity_id,
      metadata.linkedShotListId,
      metadata.linked_shot_list_id,
      metadata.packageId,
      metadata.package_id,
    ) ?? review.review_type;
    return `deliverable:${review.review_type}:${deliverableId}`;
  }

  const targetEntityType = readFirstNonEmptyString(
    review.target_entity_type,
    metadata.targetEntityType,
    metadata.target_entity_type,
  ) ?? 'project';
  const targetEntityId = readFirstNonEmptyString(
    review.target_entity_id,
    metadata.targetEntityId,
    metadata.target_entity_id,
    review.title,
  ) ?? review.id;

  return `review:${review.review_type}:${targetEntityType}:${targetEntityId}`;
}

export function getProducerOperationalReviews(reviews: ProducerClientReview[]): ProducerClientReview[] {
  const nonSyntheticReviews = reviews.filter((review) => !isSyntheticProducerReview(review));
  const sourceReviews = nonSyntheticReviews.length > 0 ? nonSyntheticReviews : reviews;
  const reviewsByOperationalKey = new Map<string, ProducerClientReview>();

  for (const review of sourceReviews) {
    const key = buildProducerReviewOperationalKey(review);
    const existing = reviewsByOperationalKey.get(key);

    if (!existing) {
      reviewsByOperationalKey.set(key, review);
      continue;
    }

    const existingTimestamp = getReviewActivityTimestamp(existing);
    const nextTimestamp = getReviewActivityTimestamp(review);

    if (nextTimestamp > existingTimestamp) {
      reviewsByOperationalKey.set(key, review);
      continue;
    }

    if (nextTimestamp === existingTimestamp) {
      const existingIsPending = isPendingReviewStatus(existing.status);
      const nextIsPending = isPendingReviewStatus(review.status);
      if (nextIsPending && !existingIsPending) {
        reviewsByOperationalKey.set(key, review);
        continue;
      }

      if ((review.updated_at ?? '') > (existing.updated_at ?? '')) {
        reviewsByOperationalKey.set(key, review);
      }
    }
  }

  return sortReviews([...reviewsByOperationalKey.values()]);
}

export function summarizeProducerReviewStatuses(reviews: ProducerClientReview[]): ProducerWorkflowProjectMeta {
  const operationalReviews = getProducerOperationalReviews(reviews);

  return operationalReviews.reduce<ProducerWorkflowProjectMeta>(
    (acc, review) => {
      acc.totalReviews += 1;
      if (review.status === 'approved') {
        acc.approvedReviews += 1;
        acc.lastApprovedReviewId = review.id;
      } else if (review.status === 'changes_requested') {
        acc.changesRequestedReviews += 1;
      } else if (review.status === 'rejected') {
        acc.rejectedReviews += 1;
      } else {
        acc.pendingReviews += 1;
        if (!acc.lastPendingReviewId) {
          acc.lastPendingReviewId = review.id;
        }
      }

      if (isBudgetPackageReview(review)) {
        acc.budgetReviewCount += 1;
      } else if (isAgreementReview(review)) {
        acc.agreementReviewCount += 1;
      } else if (isDeliverableReview(review)) {
        acc.deliverableReviewCount += 1;
      }

      if (review.requested_at && (!acc.lastReviewRequestedAt || review.requested_at > acc.lastReviewRequestedAt)) {
        acc.lastReviewRequestedAt = review.requested_at;
      }
      if (review.decision_at && (!acc.lastDecisionAt || review.decision_at > acc.lastDecisionAt)) {
        acc.lastDecisionAt = review.decision_at;
      }
      return acc;
    },
    {
      totalReviews: 0,
      pendingReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      changesRequestedReviews: 0,
      budgetReviewCount: 0,
      agreementReviewCount: 0,
      deliverableReviewCount: 0,
      lastReviewRequestedAt: null,
      lastDecisionAt: null,
      lastApprovedReviewId: null,
      lastPendingReviewId: null,
    },
  );
}

function getProjectWorkflowDriverReview(
  reviews: ProducerClientReview[],
  status: ProducerWorkflowProjectStatus,
): ProducerClientReview | null {
  const sortedReviews = getProducerOperationalReviews(reviews).sort((left, right) => {
    const leftTimestamp = new Date(left.decision_at ?? left.requested_at).getTime();
    const rightTimestamp = new Date(right.decision_at ?? right.requested_at).getTime();
    return rightTimestamp - leftTimestamp;
  });

  if (status === 'changes_requested') {
    return sortedReviews.find((review) => (
      review.status === 'changes_requested' || review.status === 'rejected'
    )) ?? null;
  }

  if (status === 'awaiting_client') {
    return sortedReviews.find((review) => isPendingReviewStatus(review.status)) ?? null;
  }

  if (status === 'approved') {
    return sortedReviews.find((review) => review.status === 'approved') ?? null;
  }

  return null;
}

function getProjectWorkflowTimelineStatus(
  projectStatus: ProducerWorkflowProjectStatus,
): string {
  switch (projectStatus) {
    case 'approved':
      return 'completed';
    case 'changes_requested':
      return 'blocked';
    case 'awaiting_client':
      return 'in_progress';
    default:
      return 'planned';
  }
}

function getProjectWorkflowTimelineTitle(
  projectStatus: ProducerWorkflowProjectStatus,
): string {
  switch (projectStatus) {
    case 'awaiting_client':
      return 'Prosjektstatus · Venter på klient';
    case 'changes_requested':
      return 'Prosjektstatus · Endringer ønsket';
    case 'approved':
      return 'Prosjektstatus · Godkjent';
    default:
      return 'Prosjektstatus · Planlegging';
  }
}

function getProjectWorkflowTimelineDescription(
  projectName: string,
  projectStatus: ProducerWorkflowProjectStatus,
  projectMeta: ProducerWorkflowProjectMeta,
  driverReview: ProducerClientReview | null,
): string {
  const driverSummary = driverReview
    ? `${driverReview.title} (${driverReview.review_type})`
    : projectName;

  const counts = [
    `${projectMeta.pendingReviews} venter`,
    `${projectMeta.changesRequestedReviews} krever endringer`,
    `${projectMeta.approvedReviews} godkjent`,
  ].join(' · ');

  if (projectStatus === 'changes_requested') {
    return `Klientens siste beslutning på ${driverSummary} krever endringer før prosjektet kan gå videre. ${counts}.`;
  }

  if (projectStatus === 'awaiting_client') {
    return `Prosjektet venter på klientbeslutning knyttet til ${driverSummary}. ${counts}.`;
  }

  if (projectStatus === 'approved') {
    return `Prosjektet er godkjent basert på klientbeslutningen for ${driverSummary}. ${counts}.`;
  }

  return `Prosjektet er i planlegging. ${counts}.`;
}

function isProjectWorkflowStatusTimelineItem(
  item: ProducerTimelineItem,
  projectId: string,
): boolean {
  const metadata = asRecord(item.metadata);
  return item.linked_entity_type === 'project'
    && item.linked_entity_id === projectId
    && readFirstNonEmptyString(metadata.source) === 'project-workflow-status';
}

async function syncProjectWorkflowStatusTimelineSnapshot(
  project: CastingProject,
  projectMeta: ProducerWorkflowProjectMeta,
  projectStatus: ProducerWorkflowProjectStatus,
  reviews: ProducerClientReview[],
): Promise<void> {
  const timelineItems = await fetchTimeline(project.id);
  const existingStatusItems = timelineItems.filter((item) => isProjectWorkflowStatusTimelineItem(item, project.id));

  if (projectMeta.totalReviews <= 0) {
    if (existingStatusItems.length === 0) {
      return;
    }

    await Promise.all(existingStatusItems.map(async (item) => {
      await producerWorkflowRequest<{ success?: boolean }>(`/projects/${project.id}/producer/timeline/${item.id}`, {
        method: 'DELETE',
      });
    }));
    clearProducerWorkflowReadCache(project.id, ['timeline']);
    emitProducerWorkflowEvent({
      projectId: project.id,
      domain: 'timeline',
      mutation: 'deleted',
      entityId: project.id,
    });
    return;
  }

  const driverReview = getProjectWorkflowDriverReview(reviews, projectStatus);
  const focusedPhase = driverReview ? readFocusedPhaseFromReview(driverReview) : 'preproduction';
  const timelinePhase = focusedPhase === 'all'
    ? getReviewTimelinePhase(driverReview?.review_type, driverReview?.target_entity_type ?? undefined)
    : focusedPhase;
  const statusUpdatedAt = driverReview?.decision_at ?? driverReview?.requested_at ?? nowIso();
  const agreementId = driverReview
    ? (
      driverReview.target_entity_type === 'project_agreement'
        ? driverReview.target_entity_id ?? undefined
        : readFirstNonEmptyString(asRecord(driverReview.metadata).agreementId)
    )
    : undefined;

  const metadata: Record<string, unknown> = {
    source: 'project-workflow-status',
    projectWorkflowStatus: projectStatus,
    totalReviews: projectMeta.totalReviews,
    pendingReviews: projectMeta.pendingReviews,
    approvedReviews: projectMeta.approvedReviews,
    rejectedReviews: projectMeta.rejectedReviews,
    changesRequestedReviews: projectMeta.changesRequestedReviews,
    lastReviewRequestedAt: projectMeta.lastReviewRequestedAt ?? null,
    lastDecisionAt: projectMeta.lastDecisionAt ?? null,
    reviewId: driverReview?.id ?? null,
    reviewType: driverReview?.review_type ?? null,
    targetEntityType: driverReview?.target_entity_type ?? null,
    targetEntityId: driverReview?.target_entity_id ?? null,
    focusedPhase,
    statusUpdatedAt,
  };

  if (agreementId) {
    metadata.agreementId = agreementId;
  }
  if (driverReview && isDeliverableReview(driverReview)) {
    metadata.approvalTemplate = driverReview.review_type;
  }

  const payload = {
    phase: timelinePhase,
    title: getProjectWorkflowTimelineTitle(projectStatus),
    description: getProjectWorkflowTimelineDescription(project.name, projectStatus, projectMeta, driverReview),
    dueAt: driverReview?.due_at ?? projectMeta.lastDecisionAt ?? projectMeta.lastReviewRequestedAt ?? null,
    status: getProjectWorkflowTimelineStatus(projectStatus),
    linkedEntityType: 'project',
    linkedEntityId: project.id,
    sortOrder: existingStatusItems[0]?.sort_order ?? timelineItems.length,
    metadata,
  };

  if (existingStatusItems[0]) {
    const primaryStatusItem = existingStatusItems[0];
    const primaryStatusItemUnchanged = primaryStatusItem.phase === payload.phase
      && primaryStatusItem.title === payload.title
      && (primaryStatusItem.description ?? null) === (payload.description ?? null)
      && (primaryStatusItem.due_at ?? null) === (payload.dueAt ?? null)
      && primaryStatusItem.status === payload.status
      && (primaryStatusItem.linked_entity_type ?? null) === payload.linkedEntityType
      && (primaryStatusItem.linked_entity_id ?? null) === payload.linkedEntityId
      && primaryStatusItem.sort_order === payload.sortOrder
      && stableSerialize(primaryStatusItem.metadata ?? {}) === stableSerialize(payload.metadata);
    let mutated = false;

    if (!primaryStatusItemUnchanged) {
      await producerWorkflowRequest<{ item?: unknown }>(`/projects/${project.id}/producer/timeline/${primaryStatusItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(buildDefinedBody([
          ['phase', payload.phase],
          ['title', payload.title],
          ['description', payload.description],
          ['dueAt', payload.dueAt],
          ['status', payload.status],
          ['linkedEntityType', payload.linkedEntityType],
          ['linkedEntityId', payload.linkedEntityId],
          ['sortOrder', payload.sortOrder],
          ['metadata', payload.metadata],
        ])),
      });
      mutated = true;
    }

    if (existingStatusItems.length > 1) {
      await Promise.all(existingStatusItems.slice(1).map(async (item) => {
        await producerWorkflowRequest<{ success?: boolean }>(`/projects/${project.id}/producer/timeline/${item.id}`, {
          method: 'DELETE',
        });
      }));
      mutated = true;
    }

    if (!mutated) {
      return;
    }

    clearProducerWorkflowReadCache(project.id, ['timeline']);
    emitProducerWorkflowEvent({
      projectId: project.id,
      domain: 'timeline',
      mutation: primaryStatusItemUnchanged ? 'deleted' : 'updated',
      entityId: primaryStatusItem.id,
    });
    return;
  }

  await producerWorkflowRequest<{ item?: unknown }>(`/projects/${project.id}/producer/timeline`, {
    method: 'POST',
    body: JSON.stringify({
      phase: payload.phase,
      title: payload.title,
      description: payload.description,
      ownerUserId: null,
      dueAt: payload.dueAt,
      status: payload.status,
      linkedEntityType: payload.linkedEntityType,
      linkedEntityId: payload.linkedEntityId,
      sortOrder: payload.sortOrder,
      metadata: payload.metadata,
    }),
  });

  clearProducerWorkflowReadCache(project.id, ['timeline']);
  emitProducerWorkflowEvent({
    projectId: project.id,
    domain: 'timeline',
    mutation: 'created',
    entityId: project.id,
  });
}

function buildProducerWorkflowProjectMeta(reviews: ProducerClientReview[]): ProducerWorkflowProjectMeta {
  return summarizeProducerReviewStatuses(reviews);
}

function deriveProducerWorkflowProjectStatus(
  meta: ProducerWorkflowProjectMeta,
): ProducerWorkflowProjectStatus {
  if (meta.changesRequestedReviews > 0 || meta.rejectedReviews > 0) {
    return 'changes_requested';
  }
  if (meta.pendingReviews > 0) {
    return 'awaiting_client';
  }
  if (meta.approvedReviews > 0) {
    return 'approved';
  }
  return 'planning';
}

async function syncProjectWorkflowStatusSnapshot(
  projectId: string,
  reviews: ProducerClientReview[],
): Promise<CastingProject | null> {
  const project = await castingService.getProject(projectId);
  if (!project) {
    return null;
  }

  const nextMeta = buildProducerWorkflowProjectMeta(reviews);
  const nextStatus = deriveProducerWorkflowProjectStatus(nextMeta);
  const currentStatus = project.producerWorkflowStatus ?? 'planning';
  const currentMeta = project.producerWorkflowMeta;
  const canMutateProducerWorkflow = canCurrentSessionMutateProducerWorkflow();

  if (currentStatus === nextStatus && compareProjectWorkflowMeta(currentMeta, nextMeta)) {
    if (canMutateProducerWorkflow) {
      await syncProjectWorkflowStatusTimelineSnapshot(project, nextMeta, nextStatus, reviews);
    }
    return project;
  }

  if (!canMutateProducerWorkflow) {
    return {
      ...project,
      producerWorkflowStatus: nextStatus,
      producerWorkflowMeta: nextMeta,
    };
  }

  const nextProject: CastingProject = {
    ...project,
    producerWorkflowStatus: nextStatus,
    producerWorkflowMeta: nextMeta,
    updatedAt: nowIso(),
  };
  await castingService.saveProject(nextProject);
  await syncProjectWorkflowStatusTimelineSnapshot(nextProject, nextMeta, nextStatus, reviews);
  emitProducerWorkflowEvent({
    projectId,
    domain: 'project',
    mutation: 'updated',
    entityId: projectId,
  });
  return nextProject;
}

function shouldIncludeEconomyItemInBudgetPackage(
  item: ProducerEconomyItem,
  focusedPhase: ProducerPhase | 'all',
): boolean {
  if (!item.client_visible) {
    return false;
  }

  if (focusedPhase !== 'all' && item.phase !== focusedPhase) {
    return false;
  }

  return true;
}

function getEconomyStatusFromBudgetReview(
  currentStatus: string,
  reviewStatus: string,
): string {
  if (currentStatus === 'completed') {
    return currentStatus;
  }

  switch (reviewStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
    case 'changes_requested':
      return 'blocked';
    default:
      return 'pending_approval';
  }
}

export const producerWorkflowService = {
  async getTimeline(projectId: string): Promise<ProducerTimelineItem[]> {
    return getCachedTimeline(projectId);
  },

  async createTimelineItem(projectId: string, payload: CreateProducerTimelineItemInput): Promise<ProducerTimelineItem> {
    const items = await this.getTimeline(projectId);
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/timeline`, {
      method: 'POST',
      body: JSON.stringify({
        phase: payload.phase,
        title: payload.title,
        description: payload.description ?? null,
        ownerUserId: payload.ownerUserId ?? null,
        dueAt: payload.dueAt ?? null,
        status: payload.status ?? 'planned',
        linkedEntityType: payload.linkedEntityType ?? null,
        linkedEntityId: payload.linkedEntityId ?? null,
        sortOrder: payload.sortOrder ?? items.length,
        metadata: payload.metadata ?? {},
      }),
    });
    const created = normalizeTimelineItem(response.item, projectId, items.length);
    clearProducerWorkflowReadCache(projectId, ['timeline']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'created',
      entityId: created.id,
    });
    return created;
  },

  async updateTimelineItem(
    projectId: string,
    itemId: string,
    payload: UpdateProducerTimelineItemInput,
  ): Promise<ProducerTimelineItem> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/timeline/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(buildDefinedBody([
        ['phase', payload.phase],
        ['title', payload.title],
        ['description', payload.description],
        ['ownerUserId', payload.ownerUserId],
        ['dueAt', payload.dueAt],
        ['status', payload.status],
        ['linkedEntityType', payload.linkedEntityType],
        ['linkedEntityId', payload.linkedEntityId],
        ['sortOrder', payload.sortOrder],
        ['metadata', payload.metadata],
      ])),
    });
    const persisted = normalizeTimelineItem(response.item, projectId);
    clearProducerWorkflowReadCache(projectId, ['timeline']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'updated',
      entityId: persisted.id,
    });
    return persisted;
  },

  async deleteTimelineItem(projectId: string, itemId: string): Promise<void> {
    try {
      await producerWorkflowRequest<{ success?: boolean }>(`/projects/${projectId}/producer/timeline/${itemId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      if (!isMissingProducerTimelineItemError(error)) {
        throw error;
      }
    }
    clearProducerWorkflowReadCache(projectId, ['timeline']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'deleted',
      entityId: itemId,
    });
  },

  async ensureClientGroundingTimeline(projectId: string): Promise<void> {
    if (!canCurrentSessionMutateProducerWorkflow()) {
      return;
    }

    await syncClientGroundingTimeline(projectId);
    clearProducerWorkflowReadCache(projectId, ['timeline']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'reloaded',
      entityId: projectId,
    });
  },

  async ensureClientGroundingReviews(projectId: string): Promise<ProducerClientReview[]> {
    if (!canCurrentSessionMutateProducerWorkflow()) {
      return this.getReviews(projectId);
    }

    await syncClientGroundingReviews(projectId);
    clearProducerWorkflowReadCache(projectId, ['reviews']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'reloaded',
      entityId: projectId,
    });
    return this.getReviews(projectId);
  },

  async getEconomyItems(projectId: string): Promise<ProducerEconomyItem[]> {
    const remoteItems = await fetchEconomy(projectId);
    return migrateLegacyEconomyIfNeeded(projectId, remoteItems);
  },

  async getClientIntake(projectId: string): Promise<ProducerClientIntake> {
    return getCachedClientIntake(projectId);
  },

  async updateClientIntake(
    projectId: string,
    intake: ProducerClientIntake,
  ): Promise<ProducerClientIntake> {
    const response = await producerWorkflowRequest<{ intake?: unknown | null }>(`/projects/${projectId}/producer/client-intake`, {
      method: 'PUT',
      body: JSON.stringify({
        projectGoal: intake.projectGoal ?? '',
        deliverables: intake.deliverables ?? '',
        targetAudience: intake.targetAudience ?? '',
        keyMessage: intake.keyMessage ?? '',
        timingConstraints: intake.timingConstraints ?? '',
        brandNotes: intake.brandNotes ?? '',
        materialOverview: intake.materialOverview ?? '',
        referenceLinks: intake.referenceLinks ?? '',
        contactName: intake.contactName ?? '',
        contactEmail: intake.contactEmail ?? '',
        contactPhone: intake.contactPhone ?? '',
        additionalNotes: intake.additionalNotes ?? '',
      }),
    });
    const normalized = normalizeClientIntake(response.intake ?? {});
    clearClientInputReadCache(projectId);
    clearProducerWorkflowReadCache(projectId);
    if (canCurrentSessionMutateProducerWorkflow()) {
      await syncClientGroundingTimeline(projectId);
      await syncClientGroundingReviews(projectId);
      clearProducerWorkflowReadCache(projectId);
    }
    emitProducerWorkflowEvent({
      projectId,
      domain: 'project',
      mutation: 'updated',
      entityId: projectId,
    });
    return normalized;
  },

  async getClientMaterials(projectId: string): Promise<ProducerClientMaterial[]> {
    return getCachedClientMaterials(projectId);
  },

  async createClientMaterial(
    projectId: string,
    payload: CreateProducerClientMaterialInput,
  ): Promise<ProducerClientMaterial> {
    let item: ProducerClientMaterial;
    try {
      const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/client-materials`, {
        method: 'POST',
        body: JSON.stringify({
          entryType: payload.entryType,
          title: payload.title,
          description: payload.description ?? null,
          externalUrl: payload.externalUrl ?? null,
          phase: payload.phase ?? null,
          linkedShotListId: payload.linkedShotListId ?? null,
          status: payload.status ?? 'provided',
          metadata: payload.metadata ?? {},
        }),
      });
      item = normalizeClientMaterial(response.item, projectId);
    } catch (error) {
      // Backend ikke tilgjengelig — lag item lokalt og lagre i localStorage.
      // Matcher mønsteret fra castingService.saveProject så offline-flyten
      // er konsistent på tvers av services.
      console.warn('[producerWorkflowService] createClientMaterial falt tilbake til localStorage:', error);
      item = normalizeClientMaterial({
        id: generateId('producer-client-material'),
        project_id: projectId,
        entry_type: payload.entryType,
        title: payload.title,
        description: payload.description ?? null,
        external_url: payload.externalUrl ?? null,
        phase: payload.phase ?? null,
        linked_shot_list_id: payload.linkedShotListId ?? null,
        status: payload.status ?? 'provided',
        metadata: payload.metadata ?? {},
        created_at: nowIso(),
        updated_at: nowIso(),
      }, projectId);
    }

    const existing = await readClientMaterialsFromStorage(projectId);
    await writeClientMaterialsToStorage(projectId, [item, ...existing.filter((entry) => entry.id !== item.id)]);

    clearClientInputReadCache(projectId);
    clearProducerWorkflowReadCache(projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'project',
      mutation: 'created',
      entityId: item.id,
    });
    if (canCurrentSessionMutateProducerWorkflow()) {
      queueClientGroundingResync(projectId);
    }
    return item;
  },

  async updateClientMaterial(
    projectId: string,
    materialId: string,
    payload: UpdateProducerClientMaterialInput,
  ): Promise<ProducerClientMaterial> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/client-materials/${materialId}`, {
      method: 'PATCH',
      body: JSON.stringify(buildDefinedBody([
        ['entryType', payload.entryType],
        ['title', payload.title],
        ['description', payload.description],
        ['externalUrl', payload.externalUrl],
        ['phase', payload.phase],
        ['linkedShotListId', payload.linkedShotListId],
        ['status', payload.status],
        ['metadata', payload.metadata],
      ])),
    });
    const item = normalizeClientMaterial(response.item, projectId);
    clearClientInputReadCache(projectId);
    clearProducerWorkflowReadCache(projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'project',
      mutation: 'updated',
      entityId: item.id,
    });
    if (canCurrentSessionMutateProducerWorkflow()) {
      queueClientGroundingResync(projectId);
    }
    return item;
  },

  async deleteClientMaterial(projectId: string, materialId: string): Promise<void> {
    await producerWorkflowRequest<{ success?: boolean }>(`/projects/${projectId}/producer/client-materials/${materialId}`, {
      method: 'DELETE',
    });
    clearClientInputReadCache(projectId);
    clearProducerWorkflowReadCache(projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'project',
      mutation: 'deleted',
      entityId: materialId,
    });
    if (canCurrentSessionMutateProducerWorkflow()) {
      queueClientGroundingResync(projectId);
    }
  },

  async createEconomyItem(projectId: string, payload: CreateProducerEconomyItemInput): Promise<ProducerEconomyItem> {
    const items = await this.getEconomyItems(projectId);
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/economy/items`, {
      method: 'POST',
      body: JSON.stringify({
        phase: payload.phase,
        category: payload.category,
        itemName: payload.itemName,
        description: payload.description ?? null,
        estimate: payload.estimate ?? 0,
        approved: payload.approved ?? 0,
        actual: payload.actual ?? 0,
        currency: payload.currency ?? 'NOK',
        status: payload.status ?? 'draft',
        clientVisible: payload.clientVisible ?? true,
        linkedEntityType: payload.linkedEntityType ?? null,
        linkedEntityId: payload.linkedEntityId ?? null,
        sortOrder: payload.sortOrder ?? items.length,
        metadata: payload.metadata ?? {},
      }),
    });
    const created = normalizeEconomyItem(response.item, projectId, items.length);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'created',
      entityId: created.id,
    });
    return created;
  },

  async updateEconomyItem(
    projectId: string,
    itemId: string,
    payload: UpdateProducerEconomyItemInput,
  ): Promise<ProducerEconomyItem> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/economy/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(buildDefinedBody([
        ['phase', payload.phase],
        ['category', payload.category],
        ['itemName', payload.itemName],
        ['description', payload.description],
        ['estimate', payload.estimate],
        ['approved', payload.approved],
        ['actual', payload.actual],
        ['currency', payload.currency],
        ['status', payload.status],
        ['clientVisible', payload.clientVisible],
        ['linkedEntityType', payload.linkedEntityType],
        ['linkedEntityId', payload.linkedEntityId],
        ['sortOrder', payload.sortOrder],
        ['metadata', payload.metadata],
      ])),
    });
    const persisted = normalizeEconomyItem(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'updated',
      entityId: persisted.id,
    });
    return persisted;
  },

  async deleteEconomyItem(projectId: string, itemId: string): Promise<void> {
    await producerWorkflowRequest<{ success?: boolean }>(`/projects/${projectId}/producer/economy/items/${itemId}`, {
      method: 'DELETE',
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'deleted',
      entityId: itemId,
    });
  },

  async getReviews(projectId: string): Promise<ProducerClientReview[]> {
    return getCachedReviews(projectId);
  },

  async getNotifications(projectId: string): Promise<ProducerProjectNotification[]> {
    return fetchNotifications(projectId);
  },

  async getExpenses(projectId: string): Promise<ProducerExpense[]> {
    return fetchExpenses(projectId);
  },

  async createExpense(projectId: string, payload: CreateProducerExpenseInput): Promise<ProducerExpense> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(`/projects/${projectId}/producer/expenses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const created = normalizeExpense(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'created',
      entityId: created.id,
    });
    return created;
  },

  async uploadExpenseReceipt(
    projectId: string,
    expenseId: string,
    file: File,
    ocrText?: string,
  ): Promise<ProducerExpense> {
    const formData = new FormData();
    formData.set('file', file);
    if (ocrText && ocrText.trim().length > 0) {
      formData.set('ocrText', ocrText.trim());
    }
    const response = await producerWorkflowFormDataRequest<{ item?: unknown }>(
      `/projects/${projectId}/producer/expenses/${expenseId}/receipts`,
      formData,
    );
    const updated = normalizeExpense(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'updated',
      entityId: expenseId,
    });
    return updated;
  },

  async retryExpenseOcr(projectId: string, expenseId: string, ocrText?: string): Promise<ProducerExpense> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(
      `/projects/${projectId}/producer/expenses/${expenseId}/ocr/retry`,
      {
        method: 'POST',
        body: JSON.stringify({ ocrText: ocrText ?? null }),
      },
    );
    const updated = normalizeExpense(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'updated',
      entityId: expenseId,
    });
    return updated;
  },

  async correctExpenseOcr(
    projectId: string,
    expenseId: string,
    payload: CorrectProducerExpenseOcrInput,
  ): Promise<ProducerExpense> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(
      `/projects/${projectId}/producer/expenses/${expenseId}/ocr/correction`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    const updated = normalizeExpense(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'updated',
      entityId: expenseId,
    });
    return updated;
  },

  async updateExpenseStatus(
    projectId: string,
    expenseId: string,
    payload: UpdateProducerExpenseStatusInput,
  ): Promise<ProducerExpense> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(
      `/projects/${projectId}/producer/expenses/${expenseId}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    const updated = normalizeExpense(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'economy',
      mutation: 'updated',
      entityId: expenseId,
    });
    return updated;
  },

  async markNotificationRead(projectId: string, notificationId: string): Promise<void> {
    await producerWorkflowRequest<{ success?: boolean }>(`/projects/${projectId}/producer/notifications/${notificationId}/read`, {
      method: 'POST',
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'notifications',
      mutation: 'updated',
      entityId: notificationId,
    });
  },

  async updateNotification(
    projectId: string,
    notificationId: string,
    payload: UpdateProducerNotificationInput,
  ): Promise<ProducerProjectNotification> {
    const response = await producerWorkflowRequest<{ item?: unknown }>(
      `/projects/${projectId}/producer/notifications/${notificationId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
    const updated = normalizeNotification(response.item, projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'notifications',
      mutation: 'updated',
      entityId: notificationId,
    });
    return updated;
  },

  async markAllNotificationsRead(projectId: string): Promise<void> {
    await producerWorkflowRequest<{ success?: boolean }>(`/projects/${projectId}/producer/notifications/read-all`, {
      method: 'POST',
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'notifications',
      mutation: 'updated',
      entityId: projectId,
    });
  },

  async createReview(projectId: string, payload: CreateProducerReviewInput): Promise<ProducerClientReview> {
    const response = await producerWorkflowRequest<{ review?: unknown }>(`/projects/${projectId}/producer/reviews`, {
      method: 'POST',
      body: JSON.stringify({
        reviewType: payload.reviewType,
        title: payload.title,
        description: payload.description ?? null,
        targetEntityType: payload.targetEntityType ?? null,
        targetEntityId: payload.targetEntityId ?? null,
        dueAt: payload.dueAt ?? null,
        metadata: payload.metadata ?? {},
      }),
    });
    const created = normalizeReview(response.review, projectId);
    clearProducerWorkflowReadCache(projectId, ['reviews']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'created',
      entityId: created.id,
    });
    return created;
  },

  async updateReview(
    projectId: string,
    reviewId: string,
    payload: UpdateProducerReviewInput,
  ): Promise<ProducerClientReview> {
    const response = await producerWorkflowRequest<{ review?: unknown }>(`/projects/${projectId}/producer/reviews/${reviewId}`, {
      method: 'PATCH',
      body: JSON.stringify(buildDefinedBody([
        ['reviewType', payload.reviewType],
        ['title', payload.title],
        ['description', payload.description],
        ['targetEntityType', payload.targetEntityType],
        ['targetEntityId', payload.targetEntityId],
        ['dueAt', payload.dueAt],
        ['metadata', payload.metadata],
      ])),
    });
    const updated = normalizeReview(response.review, projectId);
    clearProducerWorkflowReadCache(projectId, ['reviews']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'updated',
      entityId: updated.id,
    });
    return updated;
  },

  async updateReviewWithTimeline(
    projectId: string,
    reviewId: string,
    payload: UpdateProducerReviewInput,
  ): Promise<ProducerClientReview> {
    const review = await this.updateReview(projectId, reviewId, payload);
    await this.syncReviewTimelineItem(projectId, review);
    await this.syncBudgetReviewEconomyItems(projectId, review);
    await syncProjectWorkflowStatusSnapshot(projectId, [review, ...(await fetchReviews(projectId)).filter((item) => item.id !== review.id)]);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'updated',
      entityId: review.id,
    });
    return review;
  },

  async deleteReview(projectId: string, reviewId: string): Promise<void> {
    const timelineItems = await this.getTimeline(projectId);
    await producerWorkflowRequest<undefined>(`/projects/${projectId}/producer/reviews/${reviewId}`, {
      method: 'DELETE',
    });
    clearProducerWorkflowReadCache(projectId, ['reviews']);
    const linkedTimelineItems = timelineItems.filter((item) => isReviewTimelineItem(item, reviewId));
    await Promise.all(linkedTimelineItems.map(async (item) => {
      await this.deleteTimelineItem(projectId, item.id);
    }));
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'deleted',
      entityId: reviewId,
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'deleted',
      entityId: reviewId,
    });
    await syncProjectWorkflowStatusSnapshot(projectId, await fetchReviews(projectId));
  },

  async syncReviewTimelineItem(projectId: string, review: ProducerClientReview): Promise<void> {
    const timelineItems = await this.getTimeline(projectId);
    const existingTimelineItem = timelineItems.find((item) => isReviewTimelineItem(item, review.id));
    const metadata = {
      ...(review.metadata ?? {}),
      source: 'review-sync',
      reviewId: review.id,
      reviewType: review.review_type,
      reviewStatus: review.status,
      targetEntityType: review.target_entity_type ?? null,
      targetEntityId: review.target_entity_id ?? null,
    };
    const payload = {
      phase: getReviewTimelinePhase(review.review_type, review.target_entity_type ?? undefined, review.metadata ?? null),
      title: getReviewTimelineTitle(review),
      description: getReviewTimelineDescription(review),
      dueAt: review.due_at ?? undefined,
      status: getReviewTimelineStatus(review.status),
      linkedEntityType: 'client_review',
      linkedEntityId: review.id,
      metadata,
    };

    if (existingTimelineItem) {
      await this.updateTimelineItem(projectId, existingTimelineItem.id, payload);
      return;
    }

    await this.createTimelineItem(projectId, payload);
  },

  async createReviewWithTimeline(projectId: string, payload: CreateProducerReviewInput): Promise<ProducerClientReview> {
    const review = await this.createReview(projectId, payload);
    await this.syncReviewTimelineItem(projectId, review);
    await this.syncBudgetReviewEconomyItems(projectId, review);
    await syncProjectWorkflowStatusSnapshot(projectId, [review, ...(await fetchReviews(projectId)).filter((item) => item.id !== review.id)]);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'reloaded',
      entityId: review.id,
    });
    return review;
  },

  async syncPlanningClientReviews(
    projectId: string,
    planning: Parameters<typeof getProducerPlanningClientMoments>[0],
  ): Promise<ProducerClientReview[]> {
    const planningMoments = getProducerPlanningClientMoments(planning);
    const currentReviews = await this.getReviews(projectId);
    const planningManagedReviews = currentReviews.filter((review) => isPlanningManagedReview(review));
    const reviewsByMomentId = new Map<string, ProducerClientReview>();

    for (const review of planningManagedReviews) {
      const metadata = asRecord(review.metadata);
      const momentId = readFirstNonEmptyString(metadata.planningMomentId, review.target_entity_id);
      if (momentId) {
        reviewsByMomentId.set(momentId, review);
      }
    }

    const touchedMomentIds = new Set<string>();
    let changed = false;

    for (const moment of planningMoments) {
      const payload = buildPlanningReviewPayload(moment);
      const existing = reviewsByMomentId.get(moment.id);
      touchedMomentIds.add(moment.id);

      if (!existing) {
        await this.createReviewWithTimeline(projectId, payload);
        changed = true;
        continue;
      }

      if (!isReviewEquivalentToPayload(existing, payload)) {
        await this.updateReviewWithTimeline(projectId, existing.id, payload);
        changed = true;
      }
    }

    for (const review of planningManagedReviews) {
      const metadata = asRecord(review.metadata);
      const momentId = readFirstNonEmptyString(metadata.planningMomentId, review.target_entity_id);
      if (!momentId || touchedMomentIds.has(momentId)) {
        continue;
      }
      if (!shouldDeletePlanningReview(review)) {
        continue;
      }
      await this.deleteReview(projectId, review.id);
      changed = true;
    }

    if (!changed) {
      return currentReviews;
    }

    const refreshedReviews = await this.getReviews(projectId);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'reloaded',
      entityId: projectId,
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'reloaded',
      entityId: projectId,
    });
    return refreshedReviews;
  },

  async ensurePlanningClientReviews(
    projectId: string,
    planning: Parameters<typeof getProducerPlanningClientMoments>[0],
  ): Promise<ProducerClientReview[]> {
    if (!canCurrentSessionMutateProducerWorkflow()) {
      return this.getReviews(projectId);
    }

    return this.syncPlanningClientReviews(projectId, planning);
  },

  async syncMeetingWorkspaceWorkflow(
    projectId: string,
    planning: ProducerProjectPlanning,
  ): Promise<{ reviews: ProducerClientReview[]; timelineItems: ProducerTimelineItem[] }> {
    const normalizedPlanning = normalizeProducerProjectPlanning({ producerPlanning: planning } as CastingProject);
    const meetingWorkspace = normalizedPlanning.meetingWorkspace;
    const currentReviews = await this.getReviews(projectId);
    const currentTimelineItems = await this.getTimeline(projectId);

    const managedReviews = currentReviews.filter((review) => isMeetingManagedReview(review));
    const managedTimelineItems = currentTimelineItems.filter((item) => isMeetingManagedTimelineItem(item));
    const reviewByMeetingItemId = new Map<string, ProducerClientReview>();
    const timelineByMeetingKey = new Map<string, ProducerTimelineItem>();

    for (const review of managedReviews) {
      const meetingItemId = getMeetingItemIdFromMetadata(asRecord(review.metadata));
      if (meetingItemId) {
        reviewByMeetingItemId.set(meetingItemId, review);
      }
    }

    for (const item of managedTimelineItems) {
      const metadata = asRecord(item.metadata);
      const meetingItemId = getMeetingItemIdFromMetadata(metadata);
      const meetingItemType = readFirstNonEmptyString(metadata.meetingItemType);
      if (meetingItemId && meetingItemType) {
        timelineByMeetingKey.set(`${meetingItemType}:${meetingItemId}`, item);
      }
    }

    const touchedDecisionIds = new Set<string>();
    const touchedFollowUpIds = new Set<string>();
    let changed = false;

    for (const [decisionIndex, decision] of meetingWorkspace.decisions.entries()) {
      const title = decision.title.trim();
      if (!title) {
        continue;
      }
      touchedDecisionIds.add(decision.id);

      const existingReview = reviewByMeetingItemId.get(decision.id);
      const existingInternalTimeline = timelineByMeetingKey.get(`decision:${decision.id}`);

      if (decision.clientVisible) {
        const reviewPayload = buildMeetingDecisionReviewPayload(decision, normalizedPlanning);
        if (!existingReview) {
          await this.createReviewWithTimeline(projectId, reviewPayload);
          changed = true;
        } else if (!isReviewEquivalentToPayload(existingReview, reviewPayload)) {
          await this.updateReviewWithTimeline(projectId, existingReview.id, reviewPayload);
          changed = true;
        }

        if (existingInternalTimeline) {
          await this.deleteTimelineItem(projectId, existingInternalTimeline.id);
          changed = true;
        }
        continue;
      }

      if (existingReview && shouldDeleteMeetingReview(existingReview)) {
        await this.deleteReview(projectId, existingReview.id);
        changed = true;
      }

      if (existingReview && !shouldDeleteMeetingReview(existingReview)) {
        if (existingInternalTimeline) {
          await this.deleteTimelineItem(projectId, existingInternalTimeline.id);
          changed = true;
        }
        continue;
      }

      const timelinePayload = buildMeetingDecisionTimelinePayload(
        decision,
        normalizedPlanning,
        decisionIndex,
      );

      if (!existingInternalTimeline) {
        await this.createTimelineItem(projectId, timelinePayload);
        changed = true;
      } else if (!isTimelineEquivalentToPayload(existingInternalTimeline, timelinePayload)) {
        await this.updateTimelineItem(projectId, existingInternalTimeline.id, timelinePayload);
        changed = true;
      }
    }

    for (const [followUpIndex, followUp] of meetingWorkspace.followUps.entries()) {
      const title = followUp.title.trim();
      if (!title) {
        continue;
      }
      touchedFollowUpIds.add(followUp.id);
      const existingTimeline = timelineByMeetingKey.get(`follow_up:${followUp.id}`);
      const payload = buildMeetingFollowUpTimelinePayload(followUp, normalizedPlanning, followUpIndex);

      if (!existingTimeline) {
        await this.createTimelineItem(projectId, payload);
        changed = true;
      } else if (!isTimelineEquivalentToPayload(existingTimeline, payload)) {
        await this.updateTimelineItem(projectId, existingTimeline.id, payload);
        changed = true;
      }
    }

    for (const review of managedReviews) {
      const meetingItemId = getMeetingItemIdFromMetadata(asRecord(review.metadata));
      if (!meetingItemId || touchedDecisionIds.has(meetingItemId)) {
        continue;
      }
      if (!shouldDeleteMeetingReview(review)) {
        continue;
      }
      await this.deleteReview(projectId, review.id);
      changed = true;
    }

    for (const item of managedTimelineItems) {
      const metadata = asRecord(item.metadata);
      const meetingItemId = getMeetingItemIdFromMetadata(metadata);
      const meetingItemType = readFirstNonEmptyString(metadata.meetingItemType);

      if (meetingItemType === 'decision') {
        if (!meetingItemId || !touchedDecisionIds.has(meetingItemId)) {
          await this.deleteTimelineItem(projectId, item.id);
          changed = true;
        }
        continue;
      }

      if (meetingItemType === 'follow_up' && (!meetingItemId || !touchedFollowUpIds.has(meetingItemId))) {
        await this.deleteTimelineItem(projectId, item.id);
        changed = true;
      }
    }

    if (!changed) {
      return {
        reviews: currentReviews,
        timelineItems: currentTimelineItems,
      };
    }

    const [refreshedReviews, refreshedTimelineItems] = await Promise.all([
      this.getReviews(projectId),
      this.getTimeline(projectId),
    ]);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'reloaded',
      entityId: projectId,
    });
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'reloaded',
      entityId: projectId,
    });
    return {
      reviews: refreshedReviews,
      timelineItems: refreshedTimelineItems,
    };
  },

  async ensureMeetingWorkspaceWorkflow(
    projectId: string,
    planning: ProducerProjectPlanning,
  ): Promise<{ reviews: ProducerClientReview[]; timelineItems: ProducerTimelineItem[] }> {
    if (!canCurrentSessionMutateProducerWorkflow()) {
      return {
        reviews: await this.getReviews(projectId),
        timelineItems: await this.getTimeline(projectId),
      };
    }

    return this.syncMeetingWorkspaceWorkflow(projectId, planning);
  },

  async syncBudgetReviewEconomyItems(projectId: string, review: ProducerClientReview): Promise<void> {
    if (!isBudgetPackageReview(review)) {
      return;
    }

    const focusedPhase = readFocusedPhaseFromReview(review);
    const economyItems = await this.getEconomyItems(projectId);
    const affectedItems = economyItems.filter((item) => shouldIncludeEconomyItemInBudgetPackage(item, focusedPhase));

    await Promise.all(affectedItems.map(async (item) => {
      const nextStatus = getEconomyStatusFromBudgetReview(item.status, review.status);
      const metadata = {
        ...(item.metadata ?? {}),
        lastBudgetReviewId: review.id,
        lastBudgetReviewStatus: review.status,
        lastBudgetReviewRequestedAt: review.requested_at,
        lastBudgetReviewDecisionAt: review.decision_at ?? null,
        budgetPackageFocusedPhase: focusedPhase,
        budgetPackageEntityId: review.target_entity_id ?? null,
      };

      const currentMetadata = asRecord(item.metadata);
      const metadataUnchanged = readFirstNonEmptyString(currentMetadata.lastBudgetReviewId) === review.id
        && readFirstNonEmptyString(currentMetadata.lastBudgetReviewStatus) === review.status
        && readFirstNonEmptyString(currentMetadata.budgetPackageFocusedPhase) === focusedPhase
        && readFirstNonEmptyString(currentMetadata.budgetPackageEntityId) === (review.target_entity_id ?? undefined)
        && readFirstNonEmptyString(currentMetadata.lastBudgetReviewRequestedAt) === review.requested_at
        && readFirstNonEmptyString(currentMetadata.lastBudgetReviewDecisionAt) === (review.decision_at ?? undefined);

      if (item.status === nextStatus && metadataUnchanged) {
        return;
      }

      await this.updateEconomyItem(projectId, item.id, {
        status: nextStatus,
        metadata,
      });
    }));
  },

  async addReviewComment(
    projectId: string,
    reviewId: string,
    payload: AddProducerReviewCommentInput,
  ): Promise<ProducerReviewComment> {
    const response = await producerWorkflowRequest<{ comment?: unknown }>(`/projects/${projectId}/producer/reviews/${reviewId}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        commentText: payload.commentText,
        timestampSeconds: payload.timestampSeconds ?? null,
      }),
    });
    const comment = normalizeReviewComment(response.comment, projectId, reviewId);
    clearProducerWorkflowReadCache(projectId, ['reviews']);

    const reviews = await this.getReviews(projectId);
    const updatedReview = reviews.find((review) => review.id === reviewId);
    if (updatedReview) {
      await this.syncReviewTimelineItem(projectId, updatedReview);
      emitProducerWorkflowEvent({
        projectId,
        domain: 'timeline',
        mutation: 'updated',
        entityId: updatedReview.id,
      });
    }

    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'updated',
      entityId: reviewId,
    });
    return comment;
  },

  async setReviewDecision(
    projectId: string,
    reviewId: string,
    payload: SetProducerReviewDecisionInput,
  ): Promise<ProducerClientReview> {
    const response = await producerWorkflowRequest<{ review?: unknown }>(`/projects/${projectId}/producer/reviews/${reviewId}/decision`, {
      method: 'POST',
      body: JSON.stringify({
        decision: payload.decision,
        reason: payload.reason ?? null,
        timestampSeconds: payload.timestampSeconds ?? null,
      }),
    });
    const persisted = normalizeReview(response.review, projectId);
    clearProducerWorkflowReadCache(projectId, ['reviews']);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'reviews',
      mutation: 'updated',
      entityId: persisted.id,
    });
    return persisted;
  },

  async setReviewDecisionWithTimeline(
    projectId: string,
    reviewId: string,
    payload: SetProducerReviewDecisionInput,
  ): Promise<ProducerClientReview> {
    const review = await this.setReviewDecision(projectId, reviewId, payload);
    await this.syncReviewTimelineItem(projectId, review);
    await this.syncBudgetReviewEconomyItems(projectId, review);
    await syncProjectWorkflowStatusSnapshot(projectId, [review, ...(await fetchReviews(projectId)).filter((item) => item.id !== review.id)]);
    emitProducerWorkflowEvent({
      projectId,
      domain: 'timeline',
      mutation: 'updated',
      entityId: review.id,
    });
    return review;
  },

  async initializeContentProducerDemoWorkflow(projectId: string): Promise<void> {
    if (projectId !== CONTENT_PRODUCER_DEMO_PROJECT_ID) {
      return;
    }

    if (!isRoleRoomDemoSeedAllowed()) {
      return;
    }

    if (!canCurrentSessionMutateProducerWorkflow()) {
      return;
    }

    if (!contentProducerWorkflowInitPromise) {
      contentProducerWorkflowInitPromise = (async () => {
        const [existingTimeline, existingEconomy, existingReviews] = await Promise.all([
          this.getTimeline(projectId),
          this.getEconomyItems(projectId),
          this.getReviews(projectId),
        ]);

        const existingTimelineSeedKeys = new Set(
          existingTimeline
            .map((item) => readSeedKey(item.metadata))
            .filter((value): value is string => Boolean(value)),
        );
        const existingEconomySeedKeys = new Set(
          existingEconomy
            .map((item) => readSeedKey(item.metadata))
            .filter((value): value is string => Boolean(value)),
        );
        const existingReviewsBySeedKey = new Map<string, ProducerClientReview>();
        for (const review of existingReviews) {
          const seedKey = readSeedKey(review.metadata);
          if (seedKey) {
            existingReviewsBySeedKey.set(seedKey, review);
          }
        }

        for (const seed of PRODUCER_DEMO_TIMELINE_SEED) {
          const seedKey = readSeedKey(seed.metadata as Record<string, unknown>);
          if (seedKey && existingTimelineSeedKeys.has(seedKey)) {
            continue;
          }
          await this.createTimelineItem(projectId, {
            phase: seed.phase,
            title: seed.title,
            description: seed.description,
            ownerUserId: seed.ownerUserId,
            dueAt: seed.dueAt,
            status: seed.status,
            linkedEntityType: seed.linkedEntityType,
            linkedEntityId: seed.linkedEntityId,
            metadata: seed.metadata,
          });
        }

        for (const seed of PRODUCER_DEMO_ECONOMY_SEED) {
          const seedKey = readSeedKey(seed.metadata as Record<string, unknown>);
          if (seedKey && existingEconomySeedKeys.has(seedKey)) {
            continue;
          }
          await this.createEconomyItem(projectId, {
            phase: seed.phase,
            category: seed.category,
            itemName: seed.itemName,
            description: seed.description,
            estimate: seed.estimate,
            approved: seed.approved,
            actual: seed.actual,
            status: seed.status,
            clientVisible: seed.clientVisible,
            linkedEntityType: seed.linkedEntityType,
            linkedEntityId: seed.linkedEntityId,
            metadata: seed.metadata,
          });
        }

        for (const seed of PRODUCER_DEMO_REVIEW_SEED) {
          const seedKey = readSeedKey(seed.metadata as Record<string, unknown>);
          let review = seedKey ? existingReviewsBySeedKey.get(seedKey) : undefined;
          if (!review) {
            review = await this.createReview(projectId, {
              reviewType: seed.reviewType,
              title: seed.title,
              description: seed.description,
              targetEntityType: seed.targetEntityType,
              targetEntityId: seed.targetEntityId,
              dueAt: seed.dueAt,
              metadata: seed.metadata,
            });
            if (seedKey) {
              existingReviewsBySeedKey.set(seedKey, review);
            }
          }

          for (const commentSeed of seed.comments) {
            const commentTimestampSeconds = 'timestampSeconds' in commentSeed ? commentSeed.timestampSeconds : undefined;
            if (hasMatchingComment(commentSeed.commentText, commentTimestampSeconds, review.comments)) {
              continue;
            }
            const createdComment = await this.addReviewComment(projectId, review.id, {
              commentText: commentSeed.commentText,
              timestampSeconds: commentTimestampSeconds,
            });
            review = {
              ...review,
              comments: [...(review.comments ?? []), createdComment],
            };
            if (seedKey) {
              existingReviewsBySeedKey.set(seedKey, review);
            }
          }

          await this.syncReviewTimelineItem(projectId, review);
        }

        await syncProjectWorkflowStatusSnapshot(projectId, await fetchReviews(projectId));
      })().finally(() => {
        contentProducerWorkflowInitPromise = null;
      });
    }

    await contentProducerWorkflowInitPromise;
  },

  async syncProjectWorkflowStatus(projectId: string): Promise<CastingProject | null> {
    return syncProjectWorkflowStatusSnapshot(projectId, await fetchReviews(projectId));
  },
};
