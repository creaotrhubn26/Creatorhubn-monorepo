export const ART_DEPARTMENT_PHASES = ['concept', 'design', 'build', 'shoot', 'wrap'] as const;
export const ART_SCENE_STATUSES = ['not_started', 'researching', 'designing', 'ready_for_review', 'blocked'] as const;
export const ART_SET_STRATEGIES = ['unknown', 'location', 'build', 'hybrid'] as const;
export const ART_DEPARTMENTS = [
  'art',
  'sets',
  'props',
  'costume',
  'hair_makeup',
  'construction',
  'sfx',
  'vfx',
] as const;
export const ART_DECISION_STATUSES = ['draft', 'ready_for_review', 'changes_requested'] as const;
export const ART_DECISION_IMPACTS = ['creative', 'schedule', 'budget', 'safety', 'continuity'] as const;
export const ART_HANDOFF_STATUSES = ['not_started', 'in_progress', 'ready', 'blocked'] as const;
export const ART_CONTINUITY_DEPARTMENTS = ['sets', 'props', 'costume', 'hair_makeup'] as const;
export const ART_CONTINUITY_STATUSES = ['planned', 'in_progress', 'ready', 'on_set', 'reset_required', 'complete', 'blocked'] as const;
export const ART_CONTINUITY_SOURCES = ['unknown', 'owned', 'rented', 'purchased', 'fabricated', 'borrowed'] as const;
export const ART_CONTINUITY_CONDITIONS = ['unknown', 'good', 'attention', 'damaged', 'missing'] as const;

type ArtDepartmentPhase = (typeof ART_DEPARTMENT_PHASES)[number];
type ArtSceneStatus = (typeof ART_SCENE_STATUSES)[number];
type ArtSetStrategy = (typeof ART_SET_STRATEGIES)[number];
type ArtDepartmentId = (typeof ART_DEPARTMENTS)[number];
type ArtDecisionStatus = (typeof ART_DECISION_STATUSES)[number];
type ArtDecisionImpact = (typeof ART_DECISION_IMPACTS)[number];
type ArtHandoffStatus = (typeof ART_HANDOFF_STATUSES)[number];
type ArtContinuityDepartment = (typeof ART_CONTINUITY_DEPARTMENTS)[number];
type ArtContinuityStatus = (typeof ART_CONTINUITY_STATUSES)[number];
type ArtContinuitySource = (typeof ART_CONTINUITY_SOURCES)[number];
type ArtContinuityCondition = (typeof ART_CONTINUITY_CONDITIONS)[number];

interface ArtContinuityReference {
  id: string;
  kind: 'photo' | 'video' | 'other';
  storageFileId?: string;
  storageProvider?: 'aws_s3';
  contentType?: string;
  sizeBytes?: number;
  label?: string;
}

export interface ArtDepartmentOperations {
  phase: ArtDepartmentPhase;
  visualDirection?: string;
  palette: string[];
  scenePlans: Array<{
    sceneId: string;
    status: ArtSceneStatus;
    setStrategy: ArtSetStrategy;
    departments: ArtDepartmentId[];
    owner?: string;
    dueAt?: string;
    designIntent?: string;
    blocker?: string;
    updatedAt?: string;
  }>;
  decisions: Array<{
    id: string;
    title: string;
    status: ArtDecisionStatus;
    impact: ArtDecisionImpact;
    sceneIds: string[];
    owner?: string;
    dueAt?: string;
    notes?: string;
    updatedAt?: string;
  }>;
  handoffs: Array<{
    id: string;
    department: ArtDepartmentId;
    title: string;
    status: ArtHandoffStatus;
    owner?: string;
    dueAt?: string;
    notes?: string;
    updatedAt?: string;
  }>;
  continuityItems: Array<{
    id: string;
    department: ArtContinuityDepartment;
    title: string;
    sceneId: string;
    productionDayId?: string;
    characterRoleId?: string;
    propId?: string;
    status: ArtContinuityStatus;
    source: ArtContinuitySource;
    condition: ArtContinuityCondition;
    owner?: string;
    location?: string;
    presetNotes?: string;
    resetNotes?: string;
    issue?: string;
    beforeReferences: ArtContinuityReference[];
    afterReferences: ArtContinuityReference[];
    updatedAt?: string;
  }>;
}

export interface ArtDepartmentActivityEntry {
  id: string;
  type: 'workspace_saved';
  message: string;
  actorUserId: string;
  createdAt: string;
}

export class ArtDepartmentValidationError extends Error {}

const PHASES = new Set<string>(ART_DEPARTMENT_PHASES);
const SCENE_STATUSES = new Set<string>(ART_SCENE_STATUSES);
const SET_STRATEGIES = new Set<string>(ART_SET_STRATEGIES);
const DEPARTMENTS = new Set<string>(ART_DEPARTMENTS);
const DECISION_STATUSES = new Set<string>(ART_DECISION_STATUSES);
const DECISION_IMPACTS = new Set<string>(ART_DECISION_IMPACTS);
const HANDOFF_STATUSES = new Set<string>(ART_HANDOFF_STATUSES);
const CONTINUITY_DEPARTMENTS = new Set<string>(ART_CONTINUITY_DEPARTMENTS);
const CONTINUITY_STATUSES = new Set<string>(ART_CONTINUITY_STATUSES);
const CONTINUITY_SOURCES = new Set<string>(ART_CONTINUITY_SOURCES);
const CONTINUITY_CONDITIONS = new Set<string>(ART_CONTINUITY_CONDITIONS);

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new ArtDepartmentValidationError(`${field} må være mellom 1 og ${maxLength} tegn.`);
  }
  return normalized;
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (normalized.length > maxLength) {
    throw new ArtDepartmentValidationError(`${field} kan ikke være lengre enn ${maxLength} tegn.`);
  }
  return normalized || undefined;
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, field: string): T {
  if (typeof value !== 'string' || !allowed.has(value)) {
    throw new ArtDepartmentValidationError(`${field} har en ugyldig verdi.`);
  }
  return value as T;
}

function limitedArray(value: unknown, field: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) throw new ArtDepartmentValidationError(`${field} må være en liste.`);
  if (value.length > maxLength) {
    throw new ArtDepartmentValidationError(`${field} kan maksimalt inneholde ${maxLength} elementer.`);
  }
  return value;
}

function timestamp(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, field, 40);
  if (normalized && !Number.isFinite(Date.parse(normalized))) {
    throw new ArtDepartmentValidationError(`${field} må være et gyldig tidspunkt.`);
  }
  return normalized;
}

function uniqueBy<T>(items: T[], key: (item: T) => string, field: string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) throw new ArtDepartmentValidationError(`${field} inneholder duplikater.`);
    seen.add(id);
  }
  return items;
}

function stringList(value: unknown, field: string, maxLength: number, itemLength: number): string[] {
  return [...new Set(limitedArray(value, field, maxLength).map((item, index) => (
    requiredString(item, `${field}[${index}]`, itemLength)
  )))];
}

function continuityReferences(value: unknown, field: string): ArtContinuityReference[] {
  return uniqueBy(limitedArray(value ?? [], field, 24).map((entry, index) => {
    const item = objectValue(entry);
    if (!item) throw new ArtDepartmentValidationError(`${field}[${index}] er ugyldig.`);
    const kind = enumValue<'photo' | 'video' | 'other'>(item.kind, new Set(['photo', 'video', 'other']), `${field}[${index}].kind`);
    const storageProvider = item.storageProvider === undefined
      ? undefined
      : enumValue<'aws_s3'>(item.storageProvider, new Set(['aws_s3']), `${field}[${index}].storageProvider`);
    const sizeBytes = item.sizeBytes === undefined ? undefined : Number(item.sizeBytes);
    if (sizeBytes !== undefined && (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 250 * 1024 * 1024)) {
      throw new ArtDepartmentValidationError(`${field}[${index}].sizeBytes er ugyldig.`);
    }
    const storageFileId = optionalString(item.storageFileId, `${field}[${index}].storageFileId`, 120);
    if (storageProvider === 'aws_s3' && !storageFileId) {
      throw new ArtDepartmentValidationError(`${field}[${index}] mangler storageFileId.`);
    }
    return {
      id: requiredString(item.id, `${field}[${index}].id`, 120),
      kind,
      storageFileId,
      storageProvider,
      contentType: optionalString(item.contentType, `${field}[${index}].contentType`, 120),
      sizeBytes,
      label: optionalString(item.label, `${field}[${index}].label`, 160),
    };
  }), (item) => item.id, field);
}

export function emptyArtDepartmentOperations(): ArtDepartmentOperations {
  return {
    phase: 'concept',
    palette: [],
    scenePlans: [],
    decisions: [],
    handoffs: ART_DEPARTMENTS.map((department) => ({
      id: `handoff-${department}`,
      department,
      title: department === 'art' ? 'Art direction' : department.replace('_', ' '),
      status: 'not_started',
    })),
    continuityItems: [],
  };
}

/**
 * Treat every value from the browser as untrusted. Activity is deliberately
 * excluded: only the route appends actor and timestamp to the audit trail.
 */
export function normalizeArtDepartmentOperations(value: unknown): ArtDepartmentOperations {
  const input = objectValue(value);
  if (!input) throw new ArtDepartmentValidationError('operations må være et objekt.');

  const palette = stringList(input.palette ?? [], 'palette', 16, 40);
  const scenePlans = uniqueBy(limitedArray(input.scenePlans ?? [], 'scenePlans', 500).map((entry, index) => {
    const item = objectValue(entry);
    if (!item) throw new ArtDepartmentValidationError(`scenePlans[${index}] er ugyldig.`);
    return {
      sceneId: requiredString(item.sceneId, `scenePlans[${index}].sceneId`, 255),
      status: enumValue<ArtSceneStatus>(item.status, SCENE_STATUSES, `scenePlans[${index}].status`),
      setStrategy: enumValue<ArtSetStrategy>(item.setStrategy, SET_STRATEGIES, `scenePlans[${index}].setStrategy`),
      departments: stringList(item.departments ?? [], `scenePlans[${index}].departments`, ART_DEPARTMENTS.length, 40)
        .map((department) => enumValue<ArtDepartmentId>(department, DEPARTMENTS, `scenePlans[${index}].departments`)),
      owner: optionalString(item.owner, `scenePlans[${index}].owner`, 160),
      dueAt: timestamp(item.dueAt, `scenePlans[${index}].dueAt`),
      designIntent: optionalString(item.designIntent, `scenePlans[${index}].designIntent`, 5_000),
      blocker: optionalString(item.blocker, `scenePlans[${index}].blocker`, 2_000),
      updatedAt: timestamp(item.updatedAt, `scenePlans[${index}].updatedAt`),
    };
  }), (item) => item.sceneId, 'scenePlans');

  const decisions = uniqueBy(limitedArray(input.decisions ?? [], 'decisions', 300).map((entry, index) => {
    const item = objectValue(entry);
    if (!item) throw new ArtDepartmentValidationError(`decisions[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `decisions[${index}].id`, 120),
      title: requiredString(item.title, `decisions[${index}].title`, 240),
      status: enumValue<ArtDecisionStatus>(item.status, DECISION_STATUSES, `decisions[${index}].status`),
      impact: enumValue<ArtDecisionImpact>(item.impact, DECISION_IMPACTS, `decisions[${index}].impact`),
      sceneIds: stringList(item.sceneIds ?? [], `decisions[${index}].sceneIds`, 120, 255),
      owner: optionalString(item.owner, `decisions[${index}].owner`, 160),
      dueAt: timestamp(item.dueAt, `decisions[${index}].dueAt`),
      notes: optionalString(item.notes, `decisions[${index}].notes`, 5_000),
      updatedAt: timestamp(item.updatedAt, `decisions[${index}].updatedAt`),
    };
  }), (item) => item.id, 'decisions');

  const handoffs = uniqueBy(limitedArray(input.handoffs ?? [], 'handoffs', 100).map((entry, index) => {
    const item = objectValue(entry);
    if (!item) throw new ArtDepartmentValidationError(`handoffs[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `handoffs[${index}].id`, 120),
      department: enumValue<ArtDepartmentId>(item.department, DEPARTMENTS, `handoffs[${index}].department`),
      title: requiredString(item.title, `handoffs[${index}].title`, 200),
      status: enumValue<ArtHandoffStatus>(item.status, HANDOFF_STATUSES, `handoffs[${index}].status`),
      owner: optionalString(item.owner, `handoffs[${index}].owner`, 160),
      dueAt: timestamp(item.dueAt, `handoffs[${index}].dueAt`),
      notes: optionalString(item.notes, `handoffs[${index}].notes`, 3_000),
      updatedAt: timestamp(item.updatedAt, `handoffs[${index}].updatedAt`),
    };
  }), (item) => item.id, 'handoffs');

  const continuityItems = uniqueBy(limitedArray(input.continuityItems ?? [], 'continuityItems', 1_000).map((entry, index) => {
    const item = objectValue(entry);
    if (!item) throw new ArtDepartmentValidationError(`continuityItems[${index}] er ugyldig.`);
    return {
      id: requiredString(item.id, `continuityItems[${index}].id`, 120),
      department: enumValue<ArtContinuityDepartment>(item.department, CONTINUITY_DEPARTMENTS, `continuityItems[${index}].department`),
      title: requiredString(item.title, `continuityItems[${index}].title`, 240),
      sceneId: requiredString(item.sceneId, `continuityItems[${index}].sceneId`, 255),
      productionDayId: optionalString(item.productionDayId, `continuityItems[${index}].productionDayId`, 255),
      characterRoleId: optionalString(item.characterRoleId, `continuityItems[${index}].characterRoleId`, 255),
      propId: optionalString(item.propId, `continuityItems[${index}].propId`, 255),
      status: enumValue<ArtContinuityStatus>(item.status, CONTINUITY_STATUSES, `continuityItems[${index}].status`),
      source: enumValue<ArtContinuitySource>(item.source, CONTINUITY_SOURCES, `continuityItems[${index}].source`),
      condition: enumValue<ArtContinuityCondition>(item.condition, CONTINUITY_CONDITIONS, `continuityItems[${index}].condition`),
      owner: optionalString(item.owner, `continuityItems[${index}].owner`, 160),
      location: optionalString(item.location, `continuityItems[${index}].location`, 500),
      presetNotes: optionalString(item.presetNotes, `continuityItems[${index}].presetNotes`, 4_000),
      resetNotes: optionalString(item.resetNotes, `continuityItems[${index}].resetNotes`, 4_000),
      issue: optionalString(item.issue, `continuityItems[${index}].issue`, 2_000),
      beforeReferences: continuityReferences(item.beforeReferences, `continuityItems[${index}].beforeReferences`),
      afterReferences: continuityReferences(item.afterReferences, `continuityItems[${index}].afterReferences`),
      updatedAt: timestamp(item.updatedAt, `continuityItems[${index}].updatedAt`),
    };
  }), (item) => item.id, 'continuityItems');

  return {
    phase: enumValue<ArtDepartmentPhase>(input.phase, PHASES, 'phase'),
    visualDirection: optionalString(input.visualDirection, 'visualDirection', 10_000),
    palette,
    scenePlans,
    decisions,
    handoffs,
    continuityItems,
  };
}

export interface ArtContinuityReferenceUniverse {
  sceneIds: ReadonlySet<string>;
  productionDayScenes: ReadonlyMap<string, ReadonlySet<string>>;
  characterRoleIds: ReadonlySet<string>;
  propIds: ReadonlySet<string>;
  media: ReadonlyMap<string, { productionDayId: string; sceneId: string }>;
}

/**
 * JSONB keeps this lane migration-free, but every cross-department reference
 * still has to resolve to canonical project data. The browser never gets to
 * invent a scene, day, character, prop or private-media relationship.
 */
export function validateArtContinuityReferences(
  operations: ArtDepartmentOperations,
  universe: ArtContinuityReferenceUniverse,
): void {
  for (const item of operations.continuityItems) {
    if (!universe.sceneIds.has(item.sceneId)) {
      throw new ArtDepartmentValidationError(`Continuity-punktet «${item.title}» peker på en ukjent scene.`);
    }
    if (item.productionDayId) {
      const dayScenes = universe.productionDayScenes.get(item.productionDayId);
      if (!dayScenes || !dayScenes.has(item.sceneId)) {
        throw new ArtDepartmentValidationError(`Continuity-punktet «${item.title}» peker på feil opptaksdag.`);
      }
    }
    if (item.characterRoleId && !universe.characterRoleIds.has(item.characterRoleId)) {
      throw new ArtDepartmentValidationError(`Continuity-punktet «${item.title}» peker på en ukjent karakter.`);
    }
    if (item.propId && !universe.propIds.has(item.propId)) {
      throw new ArtDepartmentValidationError(`Continuity-punktet «${item.title}» peker på en ukjent rekvisitt.`);
    }
    for (const reference of [...item.beforeReferences, ...item.afterReferences]) {
      if (!reference.storageFileId) continue;
      const media = universe.media.get(reference.storageFileId);
      if (!item.productionDayId || !media
        || media.productionDayId !== item.productionDayId
        || media.sceneId !== item.sceneId) {
        throw new ArtDepartmentValidationError(`Mediet på «${item.title}» tilhører ikke valgt scene og opptaksdag.`);
      }
    }
  }
}

export function readArtDepartmentActivity(value: unknown): ArtDepartmentActivityEntry[] {
  const input = objectValue(value);
  if (!input || !Array.isArray(input.activity)) return [];
  return input.activity.flatMap((entry) => {
    const item = objectValue(entry);
    if (!item || item.type !== 'workspace_saved') return [];
    try {
      return [{
        id: requiredString(item.id, 'activity.id', 120),
        type: 'workspace_saved' as const,
        message: requiredString(item.message, 'activity.message', 400),
        actorUserId: requiredString(item.actorUserId, 'activity.actorUserId', 255),
        createdAt: timestamp(item.createdAt, 'activity.createdAt') ?? new Date(0).toISOString(),
      }];
    } catch {
      return [];
    }
  }).slice(-100);
}

export function summarizeArtDepartmentChanges(
  previous: ArtDepartmentOperations | null,
  next: ArtDepartmentOperations,
): string {
  if (!previous) return 'Opprettet produksjonsdesigngrunnlaget.';
  const changed: string[] = [];
  if (previous.phase !== next.phase) changed.push(`fase ${previous.phase} → ${next.phase}`);
  if (previous.scenePlans.length !== next.scenePlans.length) changed.push(`${next.scenePlans.length} sceneplaner`);
  if (previous.decisions.length !== next.decisions.length) changed.push(`${next.decisions.length} beslutninger`);
  if (previous.handoffs.length !== next.handoffs.length) changed.push(`${next.handoffs.length} handoffs`);
  if (previous.continuityItems.length !== next.continuityItems.length) changed.push(`${next.continuityItems.length} continuity-punkter`);
  if (previous.visualDirection !== next.visualDirection || previous.palette.join('|') !== next.palette.join('|')) {
    changed.push('visuell retning');
  }
  return changed.length > 0 ? `Oppdaterte ${changed.join(', ')}.` : 'Lagret produksjonsdesigngrunnlaget.';
}
