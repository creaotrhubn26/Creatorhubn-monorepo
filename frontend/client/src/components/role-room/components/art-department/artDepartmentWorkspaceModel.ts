import type {
  ArtDepartmentDecision,
  ArtDepartmentHandoff,
  ArtDepartmentId,
  ArtDepartmentOperations,
  ArtDepartmentScenePlan,
  CastingProject,
  SceneBreakdown,
} from '../../models/casting';

export const ART_DEPARTMENT_SURFACES = ['overview', 'scenes', 'visual-direction', 'departments', 'handoff'] as const;
export type ArtDepartmentSurface = (typeof ART_DEPARTMENT_SURFACES)[number];

export function isArtDepartmentSurface(value: unknown): value is ArtDepartmentSurface {
  return typeof value === 'string' && ART_DEPARTMENT_SURFACES.includes(value as ArtDepartmentSurface);
}

export const ART_DEPARTMENT_LABELS: Record<ArtDepartmentId, string> = {
  art: 'Art direction',
  sets: 'Set decoration',
  props: 'Rekvisitt',
  costume: 'Kostyme',
  hair_makeup: 'Hår og sminke',
  construction: 'Konstruksjon',
  sfx: 'Spesialeffekter',
  vfx: 'VFX',
};

const ART_DEPARTMENTS = Object.keys(ART_DEPARTMENT_LABELS) as ArtDepartmentId[];

export interface ArtSceneCard {
  id: string;
  label: string;
  heading: string;
  location: string;
  productionDayLabels: string[];
  propNames: string[];
  sourceNeeds: string[];
  plan: ArtDepartmentScenePlan;
}

export interface ArtDepartmentWorkspaceBrief {
  scenes: ArtSceneCard[];
  stats: {
    sceneCount: number;
    plannedSceneCount: number;
    blockedSceneCount: number;
    reviewSceneCount: number;
    unassignedPropCount: number;
    openDecisionCount: number;
    readyHandoffCount: number;
  };
  nextActions: Array<{
    id: string;
    title: string;
    detail: string;
    surface: ArtDepartmentSurface;
    tone: 'attention' | 'active' | 'ready' | 'neutral';
  }>;
}

function normalize(value: unknown): string {
  return String(value ?? '').trim();
}

function sceneLabel(scene: SceneBreakdown, index: number): string {
  const number = normalize(scene.sceneNumber);
  return number ? `Scene ${number}` : `Scene ${index + 1}`;
}

function defaultHandoffs(): ArtDepartmentHandoff[] {
  return ART_DEPARTMENTS.map((department) => ({
    id: `handoff-${department}`,
    department,
    title: ART_DEPARTMENT_LABELS[department],
    status: 'not_started',
  }));
}

export function createEmptyArtDepartmentOperations(): ArtDepartmentOperations {
  return {
    phase: 'concept',
    palette: [],
    scenePlans: [],
    decisions: [],
    handoffs: defaultHandoffs(),
    activity: [],
  };
}

export function mergeArtDepartmentOperations(value?: ArtDepartmentOperations | null): ArtDepartmentOperations {
  const empty = createEmptyArtDepartmentOperations();
  if (!value) return empty;
  const handoffsByDepartment = new Map((value.handoffs ?? []).map((handoff) => [handoff.department, handoff]));
  return {
    ...empty,
    ...value,
    palette: Array.isArray(value.palette) ? value.palette : [],
    scenePlans: Array.isArray(value.scenePlans) ? value.scenePlans : [],
    decisions: Array.isArray(value.decisions) ? value.decisions : [],
    handoffs: ART_DEPARTMENTS.map((department) => handoffsByDepartment.get(department) ?? empty.handoffs.find((item) => item.department === department)!),
    activity: Array.isArray(value.activity) ? value.activity : [],
  };
}

export function createArtDepartmentId(prefix: 'decision'): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function buildArtDepartmentWorkspaceBrief(
  project: CastingProject,
  rawOperations?: ArtDepartmentOperations | null,
): ArtDepartmentWorkspaceBrief {
  const operations = mergeArtDepartmentOperations(rawOperations);
  const planByScene = new Map(operations.scenePlans.map((plan) => [plan.sceneId, plan]));
  const sceneSources = Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [];
  const knownSceneIds = new Set(sceneSources.map((scene) => String(scene.id)));
  const missingSceneIds = (project.productionDays ?? [])
    .flatMap((day) => day.scenes ?? [])
    .map(String)
    .filter((id, index, list) => id && !knownSceneIds.has(id) && list.indexOf(id) === index);
  const allScenes: SceneBreakdown[] = [
    ...sceneSources,
    ...missingSceneIds.map((id) => ({ id, heading: id })),
  ];

  const scenes = allScenes.map((scene, index): ArtSceneCard => {
    const id = String(scene.id);
    const sourceNeeds = [
      ...(scene.propsNeeded ?? []),
      ...(scene.vehicles ?? []),
      ...(scene.specialEffects ? ['Spesialeffekter'] : []),
    ].map(String).filter(Boolean);
    const propNames = (project.props ?? [])
      .filter((prop) => (prop.assignedScenes ?? []).map(String).includes(id))
      .map((prop) => prop.name || prop.id)
      .sort((a, b) => a.localeCompare(b, 'nb'));
    const productionDayLabels = (project.productionDays ?? [])
      .filter((day) => (day.scenes ?? []).map(String).includes(id))
      .map((day) => normalize(day.date) || day.id);
    return {
      id,
      label: sceneLabel(scene, index),
      heading: normalize(scene.heading || scene.sceneHeading || scene.sceneName || scene.description) || 'Uten sceneoverskrift',
      location: normalize(scene.locationName || String(scene.setting ?? '')) || 'Lokasjon ikke registrert',
      productionDayLabels,
      propNames,
      sourceNeeds,
      plan: planByScene.get(id) ?? {
        sceneId: id,
        status: 'not_started',
        setStrategy: 'unknown',
        departments: [],
      },
    };
  });

  const unassignedPropCount = (project.props ?? []).filter((prop) => (prop.assignedScenes ?? []).length === 0).length;
  const blockedSceneCount = scenes.filter((scene) => scene.plan.status === 'blocked').length;
  const reviewSceneCount = scenes.filter((scene) => scene.plan.status === 'ready_for_review').length;
  const plannedSceneCount = scenes.filter((scene) => scene.plan.status !== 'not_started').length;
  const openDecisionCount = (operations.decisions ?? []).filter((decision) => decision.status !== 'ready_for_review').length;
  const readyHandoffCount = (operations.handoffs ?? []).filter((handoff) => handoff.status === 'ready').length;

  const nextActions: ArtDepartmentWorkspaceBrief['nextActions'] = [];
  if (blockedSceneCount > 0) {
    nextActions.push({ id: 'blocked-scenes', title: `${blockedSceneCount} scener er blokkert`, detail: 'Åpne sceneplanene og dokumenter neste ansvarlige handling.', surface: 'scenes', tone: 'attention' });
  }
  if (scenes.length > plannedSceneCount) {
    nextActions.push({ id: 'unplanned-scenes', title: `${scenes.length - plannedSceneCount} scener mangler art-plan`, detail: 'Sett strategi, fagbehov og kreativ intensjon uten å endre manuset.', surface: 'scenes', tone: 'active' });
  }
  if (unassignedPropCount > 0) {
    nextActions.push({ id: 'unassigned-props', title: `${unassignedPropCount} rekvisitter mangler scenekobling`, detail: 'Koble dem til riktig scene før opptaksdagen pakkes.', surface: 'departments', tone: 'attention' });
  }
  if (!operations.visualDirection?.trim()) {
    nextActions.push({ id: 'visual-direction', title: 'Visuell retning er ikke dokumentert', detail: 'Beskriv designintensjonen som regissør, foto og art-avdeling skal arbeide etter.', surface: 'visual-direction', tone: 'neutral' });
  }
  if (nextActions.length === 0) {
    nextActions.push({ id: 'ready', title: 'Art-grunnlaget er oppdatert', detail: `${reviewSceneCount} scener er klare for review og ${readyHandoffCount} avdelingshandoffs er klare.`, surface: 'handoff', tone: 'ready' });
  }

  return {
    scenes,
    stats: {
      sceneCount: scenes.length,
      plannedSceneCount,
      blockedSceneCount,
      reviewSceneCount,
      unassignedPropCount,
      openDecisionCount,
      readyHandoffCount,
    },
    nextActions,
  };
}

export function upsertScenePlan(
  operations: ArtDepartmentOperations,
  plan: ArtDepartmentScenePlan,
): ArtDepartmentOperations {
  const without = operations.scenePlans.filter((item) => item.sceneId !== plan.sceneId);
  return { ...operations, scenePlans: [...without, plan] };
}

export function upsertDecision(
  operations: ArtDepartmentOperations,
  decision: ArtDepartmentDecision,
): ArtDepartmentOperations {
  const without = operations.decisions.filter((item) => item.id !== decision.id);
  return { ...operations, decisions: [...without, decision] };
}
