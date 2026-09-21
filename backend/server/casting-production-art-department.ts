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

type ArtDepartmentPhase = (typeof ART_DEPARTMENT_PHASES)[number];
type ArtSceneStatus = (typeof ART_SCENE_STATUSES)[number];
type ArtSetStrategy = (typeof ART_SET_STRATEGIES)[number];
type ArtDepartmentId = (typeof ART_DEPARTMENTS)[number];
type ArtDecisionStatus = (typeof ART_DECISION_STATUSES)[number];
type ArtDecisionImpact = (typeof ART_DECISION_IMPACTS)[number];
type ArtHandoffStatus = (typeof ART_HANDOFF_STATUSES)[number];

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

  return {
    phase: enumValue<ArtDepartmentPhase>(input.phase, PHASES, 'phase'),
    visualDirection: optionalString(input.visualDirection, 'visualDirection', 10_000),
    palette,
    scenePlans,
    decisions,
    handoffs,
  };
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
  if (previous.visualDirection !== next.visualDirection || previous.palette.join('|') !== next.palette.join('|')) {
    changed.push('visuell retning');
  }
  return changed.length > 0 ? `Oppdaterte ${changed.join(', ')}.` : 'Lagret produksjonsdesigngrunnlaget.';
}
