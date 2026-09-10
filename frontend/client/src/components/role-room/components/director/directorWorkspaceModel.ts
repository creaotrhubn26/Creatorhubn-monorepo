import type {
  Candidate,
  CastingProject,
  ProductionDay,
  Role,
  Schedule,
  SceneBreakdown,
  ShotList,
} from '../../models/casting';

export const DIRECTOR_SURFACES = [
  'today',
  'scenes',
  'casting',
  'visual-plan',
  'on-set',
  'post',
] as const;

export type DirectorSurface = (typeof DIRECTOR_SURFACES)[number];
export type RoleRoomWorkspaceLens = 'director' | 'full';

export function isDirectorSurface(value: unknown): value is DirectorSurface {
  return typeof value === 'string' && DIRECTOR_SURFACES.includes(value as DirectorSurface);
}

export function isRoleRoomWorkspaceLens(value: unknown): value is RoleRoomWorkspaceLens {
  return value === 'director' || value === 'full';
}

export type DirectorBriefTone = 'attention' | 'upcoming' | 'ready' | 'neutral';

export interface DirectorBriefItem {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  tone: DirectorBriefTone;
  target: Exclude<DirectorSurface, 'today'>;
  actionLabel: string;
}

export interface DirectorProductionDaySummary {
  kind: 'today' | 'next';
  id: string;
  date: string;
  callTime?: string;
  sceneCount: number;
}

export interface DirectorBrief {
  generatedAt: string;
  projectUpdatedAt?: string;
  productionDay: DirectorProductionDaySummary | null;
  stats: {
    sceneCount: number;
    visuallyPlannedSceneCount: number;
    roleCount: number;
    filledRoleCount: number;
    candidateReviewCount: number;
  };
  items: DirectorBriefItem[];
}

interface BuildDirectorBriefInput {
  project: CastingProject;
  roles?: Role[];
  candidates?: Candidate[];
  schedules?: Schedule[];
  now?: Date;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function getProductionDaySummary(
  productionDays: ProductionDay[],
  todayKey: string,
): DirectorProductionDaySummary | null {
  const datedDays = productionDays
    .map((day) => ({ day, date: readDateKey(day.date) }))
    .filter((entry): entry is { day: ProductionDay; date: string } => Boolean(entry.date))
    .filter(({ day, date }) => date >= todayKey && day.status !== 'cancelled' && day.status !== 'completed')
    .sort((left, right) => left.date.localeCompare(right.date));

  const selected = datedDays[0];
  if (!selected) return null;

  return {
    kind: selected.date === todayKey ? 'today' : 'next',
    id: selected.day.id,
    date: selected.date,
    callTime: typeof selected.day.callTime === 'string' && selected.day.callTime.trim()
      ? selected.day.callTime.trim()
      : undefined,
    sceneCount: Array.isArray(selected.day.scenes) ? selected.day.scenes.length : 0,
  };
}

function sceneHasVisualPlan(scene: SceneBreakdown, shotLists: ShotList[]): boolean {
  const storyboardCount = Array.isArray(scene.storyboardFrames) ? scene.storyboardFrames.length : 0;
  const shotCount = shotLists.reduce((count, shotList) => {
    const sceneId = shotList.sceneId || shotList.scene_id;
    return sceneId === scene.id ? count + (Array.isArray(shotList.shots) ? shotList.shots.length : 0) : count;
  }, 0);
  return storyboardCount > 0 || shotCount > 0;
}

export function buildDirectorBrief({
  project,
  roles = project.roles ?? [],
  candidates = project.candidates ?? [],
  schedules = project.schedules ?? [],
  now = new Date(),
}: BuildDirectorBriefInput): DirectorBrief {
  const todayKey = localDateKey(now);
  const scenes = Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [];
  const shotLists = Array.isArray(project.shotLists) ? project.shotLists : [];
  const productionDays = Array.isArray(project.productionDays) ? project.productionDays : [];
  const productionDay = getProductionDaySummary(productionDays, todayKey);

  const visuallyPlannedSceneCount = scenes.filter((scene) => sceneHasVisualPlan(scene, shotLists)).length;
  const scenesWithoutVisualPlan = Math.max(0, scenes.length - visuallyPlannedSceneCount);
  const rolesAwaitingCasting = roles.filter((role) => role.status === 'open' || role.status === 'casting');
  const filledRoleCount = roles.filter((role) => role.status === 'filled').length;
  const candidatesForReview = candidates.filter((candidate) => (
    candidate.status === 'shortlist' || candidate.status === 'selected'
  ));
  const futureSchedules = schedules.filter((schedule) => {
    const date = readDateKey(schedule.date);
    return Boolean(
      date
      && date >= todayKey
      && schedule.status !== 'completed'
      && schedule.status !== 'cancelled',
    );
  });

  const items: DirectorBriefItem[] = [];

  if (productionDay) {
    const when = productionDay.kind === 'today' ? 'I dag' : productionDay.date;
    items.push({
      id: `production-day-${productionDay.id}`,
      title: productionDay.kind === 'today' ? 'Produksjonsdag i dag' : 'Neste produksjonsdag er registrert',
      description: `${when}${productionDay.callTime ? ` · oppmøte ${productionDay.callTime}` : ''} · ${productionDay.sceneCount} ${productionDay.sceneCount === 1 ? 'scene' : 'scener'}.`,
      sourceLabel: 'Produksjonsplan',
      tone: productionDay.kind === 'today' ? 'attention' : 'upcoming',
      target: 'on-set',
      actionLabel: productionDay.kind === 'today' ? 'Åpne opptaksflaten' : 'Se produksjonsplan',
    });
  } else if (productionDays.length === 0) {
    items.push({
      id: 'production-day-missing',
      title: 'Ingen produksjonsdag er registrert',
      description: 'Prosjektet har ingen dato i produksjonsplanen ennå.',
      sourceLabel: 'Produksjonsplan',
      tone: 'neutral',
      target: 'scenes',
      actionLabel: 'Åpne sceneoversikt',
    });
  }

  if (rolesAwaitingCasting.length > 0) {
    items.push({
      id: 'roles-awaiting-casting',
      title: `${rolesAwaitingCasting.length} ${rolesAwaitingCasting.length === 1 ? 'rolle er' : 'roller er'} ikke markert besatt`,
      description: 'Tallet bygger kun på roller med status Åpen eller Casting.',
      sourceLabel: 'Rollestatus',
      tone: 'attention',
      target: 'casting',
      actionLabel: 'Gå til casting',
    });
  }

  if (candidatesForReview.length > 0) {
    items.push({
      id: 'candidates-for-review',
      title: `${candidatesForReview.length} ${candidatesForReview.length === 1 ? 'kandidat er' : 'kandidater er'} markert for vurdering`,
      description: 'Viser kandidater med status Shortlist eller Valgt. Ingen automatisk rangering brukes.',
      sourceLabel: 'Kandidatstatus',
      tone: 'upcoming',
      target: 'casting',
      actionLabel: 'Vurder kandidater',
    });
  }

  if (scenes.length === 0) {
    items.push({
      id: 'scene-breakdown-missing',
      title: 'Ingen scener er registrert',
      description: 'Manuset har foreløpig ingen registrert sceneinndeling i prosjektdataene.',
      sourceLabel: 'Scene breakdown',
      tone: 'neutral',
      target: 'scenes',
      actionLabel: 'Åpne manus',
    });
  } else if (scenesWithoutVisualPlan > 0) {
    items.push({
      id: 'scenes-without-visual-plan',
      title: `${scenesWithoutVisualPlan} ${scenesWithoutVisualPlan === 1 ? 'scene har' : 'scener har'} ingen registrert visuell plan`,
      description: 'Disse scenene har verken storyboardrammer eller shots knyttet til seg.',
      sourceLabel: 'Scener, storyboard og shotlist',
      tone: 'attention',
      target: 'visual-plan',
      actionLabel: 'Åpne visuell plan',
    });
  } else {
    items.push({
      id: 'visual-plan-covered',
      title: 'Alle registrerte scener har en visuell plan',
      description: 'Hver scene har minst én storyboardramme eller ett registrert shot.',
      sourceLabel: 'Scener, storyboard og shotlist',
      tone: 'ready',
      target: 'visual-plan',
      actionLabel: 'Se visuell plan',
    });
  }

  if (!productionDay && futureSchedules.length > 0) {
    items.push({
      id: 'upcoming-casting-schedules',
      title: `${futureSchedules.length} kommende ${futureSchedules.length === 1 ? 'avtale' : 'avtaler'} er registrert`,
      description: 'Viser planlagte eller bekreftede avtaler fra castingkalenderen.',
      sourceLabel: 'Castingkalender',
      tone: 'upcoming',
      target: 'casting',
      actionLabel: 'Se auditions',
    });
  }

  return {
    generatedAt: now.toISOString(),
    projectUpdatedAt: typeof project.updatedAt === 'string' ? project.updatedAt : undefined,
    productionDay,
    stats: {
      sceneCount: scenes.length,
      visuallyPlannedSceneCount,
      roleCount: roles.length,
      filledRoleCount,
      candidateReviewCount: candidatesForReview.length,
    },
    items,
  };
}
