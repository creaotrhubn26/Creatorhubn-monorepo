// @ts-nocheck
import type { CastingProject, CrewMember, SceneBreakdown, ShotList, UserRole } from '../models/casting';
import {
  normalizeProducerProjectPlanning,
  PRODUCER_PLANNING_PHASE_LABELS,
} from './producerProjectPlanning';

export interface ProducerWorkflowEntityOption {
  entityType: string;
  entityId: string;
  label: string;
  description?: string;
}

export interface ProducerWorkflowOwnerOption {
  value: string;
  label: string;
  description?: string;
}

export interface ProducerReviewTypeOption {
  value: string;
  label: string;
  defaultTargetEntityType?: string;
}

const REVIEW_TYPE_LABELS: Record<string, string> = {
  storyboard: 'Storyboard',
  manuscript: 'Manus',
  shotlist: 'Shotlist',
  budget_package: 'Budsjettpakke',
  client_approval: 'Klientgodkjenning',
  change_order: 'Endringsordre',
  client_intake_request: 'Klientbrief',
  client_material_request: 'Klientmateriale',
  meeting_decision: 'Møtebeslutning',
  framework_alignment: 'Retning / idé / aktivering',
  phase_checkpoint: 'Fasepunkt',
  content_delivery: 'Innholdsleveranse',
  account_access: 'Kontotilgang',
  scene_notes: 'Scenenotater',
  location_plan: 'Lokasjonsplan',
  equipment_plan: 'Utstyrsplan',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  storyboard: 'Storyboard',
  manuscript: 'Manus',
  shotlist: 'Shotlist',
  scene: 'Scene',
  shot: 'Shot',
  economy: 'Økonomi',
  project_agreement: 'Prosjektavtale',
  client_review: 'Klientreview',
  client_intake: 'Klientbrief',
  planning_framework: 'Retning / idé / aktivering',
  phase_plan: 'Faseplan',
  content_calendar: 'Content-kalender',
  account_access: 'Kontotilgang',
  client_material: 'Klientmateriale',
  meeting_decision: 'Møtebeslutning',
  meeting_follow_up: 'Møteoppfølging',
  meeting_workspace: 'Møteplan',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Venter',
  approved: 'Godkjent',
  rejected: 'Avslått',
  changes_requested: 'Endringer ønsket',
};

const TIMELINE_STATUS_LABELS: Record<string, string> = {
  planned: 'Planlagt',
  in_progress: 'Pågår',
  blocked: 'Blokkert',
  completed: 'Fullført',
};

const ECONOMY_STATUS_LABELS: Record<string, string> = {
  draft: 'Utkast',
  pending_approval: 'Venter på godkjenning',
  approved: 'Godkjent',
  blocked: 'Blokkert',
  completed: 'Fullført',
};

export const PRODUCER_REVIEW_TYPE_OPTIONS: ProducerReviewTypeOption[] = [
  { value: 'storyboard', label: 'Storyboard', defaultTargetEntityType: 'storyboard' },
  { value: 'manuscript', label: 'Manus', defaultTargetEntityType: 'manuscript' },
  { value: 'shotlist', label: 'Shotlist', defaultTargetEntityType: 'shotlist' },
  { value: 'budget_package', label: 'Budsjettpakke', defaultTargetEntityType: 'economy' },
  { value: 'client_approval', label: 'Klientgodkjenning', defaultTargetEntityType: 'project_agreement' },
  { value: 'change_order', label: 'Endringsordre', defaultTargetEntityType: 'project_agreement' },
  { value: 'meeting_decision', label: 'Møtebeslutning', defaultTargetEntityType: 'meeting_decision' },
  { value: 'phase_checkpoint', label: 'Fasepunkt', defaultTargetEntityType: 'phase_plan' },
  { value: 'content_delivery', label: 'Innholdsleveranse', defaultTargetEntityType: 'content_calendar' },
  { value: 'scene_notes', label: 'Scenenotater', defaultTargetEntityType: 'scene' },
  { value: 'location_plan', label: 'Lokasjonsplan', defaultTargetEntityType: 'scene' },
  { value: 'equipment_plan', label: 'Utstyrsplan', defaultTargetEntityType: 'shotlist' },
];

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
);

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

export function makeProducerPackageEntityId(
  entityType: 'storyboard' | 'manuscript' | 'shotlist' | 'economy',
  projectId: string,
): string {
  return `${entityType}-package:${projectId}`;
}

function getSceneLabelParts(scene: SceneBreakdown): { label: string; description?: string } {
  const record = asRecord(scene) ?? {};
  const sceneNumber = readFirstNonEmptyString(record.sceneNumber, record.scene_number);
  const sceneTitle = readFirstNonEmptyString(
    record.sceneName,
    record.scene_name,
    record.heading,
    record.sceneHeading,
    record.scene_heading,
    record.locationName,
    record.location_name,
  ) ?? 'Uten scenetittel';
  const prefix = sceneNumber ? `Scene ${sceneNumber}` : 'Scene';
  const description = readFirstNonEmptyString(record.description, record.intExt, record.timeOfDay);
  return {
    label: `${prefix} · ${sceneTitle}`,
    description,
  };
}

function getShotListLabelParts(shotList: ShotList): { label: string; description?: string } {
  const record = asRecord(shotList) ?? {};
  const label = readFirstNonEmptyString(record.sceneName, record.scene_name, record.notes) ?? 'Shotlist';
  const description = readFirstNonEmptyString(record.productionPhase, record.productionContext);
  return { label, description };
}

function getCrewLabel(crewMember: CrewMember): { label: string; description?: string; value?: string } {
  const record = asRecord(crewMember) ?? {};
  const label = readFirstNonEmptyString(record.name) ?? 'Crew';
  const description = [
    readFirstNonEmptyString(record.role),
    readFirstNonEmptyString(record.department),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  const contactInfo = asRecord(record.contactInfo) ?? asRecord(record.contact_info);
  const value = readFirstNonEmptyString(contactInfo?.email, record.email, record.id, label);
  return {
    label,
    description: description || undefined,
    value,
  };
}

function getRoleLabel(role: UserRole): { label: string; description?: string; value?: string } {
  const record = asRecord(role) ?? {};
  const roleName = readFirstNonEmptyString(record.role) ?? 'Prosjektrolle';
  const value = readFirstNonEmptyString(record.email, record.userId, record.user_id, record.id);
  return {
    label: roleName,
    description: readFirstNonEmptyString(record.email, record.userId, record.user_id),
    value,
  };
}

export function buildProducerWorkflowEntityOptions(project: CastingProject): ProducerWorkflowEntityOption[] {
  const projectId = String(project.id ?? '').trim();
  if (!projectId) {
    return [];
  }
  const planning = normalizeProducerProjectPlanning(project);

  const sceneOptions = (project.sceneBreakdowns ?? [])
    .filter((scene): scene is SceneBreakdown => Boolean(scene?.id))
    .flatMap((scene) => {
      const sceneId = String(scene.id);
      const { label, description } = getSceneLabelParts(scene);
      return [
        {
          entityType: 'scene',
          entityId: sceneId,
          label,
          description,
        },
        {
          entityType: 'storyboard',
          entityId: sceneId,
          label: `Storyboard · ${label}`,
          description,
        },
      ] satisfies ProducerWorkflowEntityOption[];
    });

  const shotListOptions = (project.shotLists ?? [])
    .filter((shotList): shotList is ShotList => Boolean(shotList?.id))
    .flatMap((shotList) => {
      const shotListId = String(shotList.id);
      const { label, description } = getShotListLabelParts(shotList);
      const shotOptions = (shotList.shots ?? [])
        .filter((shot) => Boolean(shot?.id))
        .map((shot) => ({
          entityType: 'shot',
          entityId: String(shot.id),
          label: `${label} · ${readFirstNonEmptyString(shot.description, shot.shotType) ?? 'Shot'}`,
          description: readFirstNonEmptyString(shot.status, shot.priority),
        }));

      return [
        {
          entityType: 'shotlist',
          entityId: shotListId,
          label: `Shotlist · ${label}`,
          description,
        },
        ...shotOptions,
      ] satisfies ProducerWorkflowEntityOption[];
    });

  const packageOptions: ProducerWorkflowEntityOption[] = [
    {
      entityType: 'manuscript',
      entityId: makeProducerPackageEntityId('manuscript', projectId),
      label: 'Manuspakke',
      description: project.name,
    },
    {
      entityType: 'storyboard',
      entityId: makeProducerPackageEntityId('storyboard', projectId),
      label: 'Storyboardpakke',
      description: `${project.sceneBreakdowns?.length ?? 0} scener`,
    },
    {
      entityType: 'shotlist',
      entityId: makeProducerPackageEntityId('shotlist', projectId),
      label: 'Shotlist-pakke',
      description: `${project.shotLists?.length ?? 0} shotlister`,
    },
    {
      entityType: 'economy',
      entityId: makeProducerPackageEntityId('economy', projectId),
      label: 'Budsjettpakke',
      description: project.currency ?? 'NOK',
    },
  ];

  const planningOptions: ProducerWorkflowEntityOption[] = [
    ...planning.activationPlan.framework
      .filter((item) => ['strategy', 'concept_development', 'campaign_development'].includes(item.key))
      .map((item) => ({
        entityType: 'planning_framework',
        entityId: `framework:${item.key}`,
        label: item.key === 'strategy'
          ? 'Retning'
          : item.key === 'concept_development'
            ? 'Idé'
            : 'Aktivering',
        description: item.focus || item.output || item.notes || undefined,
      })),
    ...planning.phasePlan.map((item) => ({
      entityType: 'phase_plan',
      entityId: `phase:${item.phase}`,
      label: `Faseplan · ${PRODUCER_PLANNING_PHASE_LABELS[item.phase]}`,
      description: item.clientCheckpoint || item.title,
    })),
    ...planning.contentCalendar.map((item) => ({
      entityType: 'content_calendar',
      entityId: `content:${item.id}`,
      label: `Content-kalender · ${item.title}`,
      description: [item.channel, item.format].filter(Boolean).join(' · ') || PRODUCER_PLANNING_PHASE_LABELS[item.phase],
    })),
  ];

  return [...packageOptions, ...planningOptions, ...sceneOptions, ...shotListOptions];
}

export function buildProducerWorkflowOwnerOptions(project: CastingProject): ProducerWorkflowOwnerOption[] {
  const options: ProducerWorkflowOwnerOption[] = [];
  const seen = new Set<string>();

  const pushOption = (value?: string, label?: string, description?: string) => {
    if (!value || !label || seen.has(value)) {
      return;
    }
    seen.add(value);
    options.push({ value, label, description });
  };

  pushOption(
    readFirstNonEmptyString(project.clientEmail),
    readFirstNonEmptyString(project.clientName) ?? 'Klient',
    readFirstNonEmptyString(project.clientCompanyName),
  );

  for (const crewMember of project.crew ?? []) {
    const { label, description, value } = getCrewLabel(crewMember);
    pushOption(value, label, description);
  }

  for (const role of project.userRoles ?? []) {
    const { label, description, value } = getRoleLabel(role);
    pushOption(value, label, description);
  }

  return options;
}

export function getProducerReviewTypeLabel(reviewType: string): string {
  return REVIEW_TYPE_LABELS[reviewType] ?? reviewType;
}

export function getProducerEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

export function getProducerReviewStatusLabel(status: string): string {
  return REVIEW_STATUS_LABELS[status] ?? status;
}

export function getProducerTimelineStatusLabel(status: string): string {
  return TIMELINE_STATUS_LABELS[status] ?? status;
}

export function getProducerEconomyStatusLabel(status: string): string {
  return ECONOMY_STATUS_LABELS[status] ?? status;
}

export function formatProducerTimestamp(timestampSeconds?: number | null): string | null {
  if (typeof timestampSeconds !== 'number' || !Number.isFinite(timestampSeconds) || timestampSeconds < 0) {
    return null;
  }
  const minutes = Math.floor(timestampSeconds / 60);
  const seconds = Math.floor(timestampSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
