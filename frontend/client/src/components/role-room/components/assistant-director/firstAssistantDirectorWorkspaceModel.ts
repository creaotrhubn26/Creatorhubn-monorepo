import type {
  Candidate,
  CastingProject,
  CrewMember,
  Location,
  ProductionDay,
  Role,
  SceneBreakdown,
} from '../../models/casting';

export const FIRST_ASSISTANT_DIRECTOR_SURFACES = [
  'today',
  'stripboard',
  'shooting-plan',
  'call-sheet',
  'cast-crew',
  'on-set',
] as const;

export type FirstAssistantDirectorSurface =
  (typeof FIRST_ASSISTANT_DIRECTOR_SURFACES)[number];
export type FirstAssistantDirectorBriefTone = 'attention' | 'upcoming' | 'ready' | 'neutral';

export interface FirstAssistantDirectorBriefItem {
  id: string;
  title: string;
  description: string;
  sourceLabel: string;
  tone: FirstAssistantDirectorBriefTone;
  target: Exclude<FirstAssistantDirectorSurface, 'today'>;
  actionLabel: string;
}

export interface FirstAssistantDirectorReadinessCheck {
  id: 'scenes' | 'call-time' | 'location' | 'cast' | 'crew';
  label: string;
  ready: boolean;
  detail: string;
}

export interface FirstAssistantDirectorProductionDaySummary {
  id: string;
  kind: 'today' | 'next';
  date: string;
  callTime?: string;
  wrapTime?: string;
  location?: string;
  sceneCount: number;
  pageCount: number;
  missingSceneCount: number;
  unresolvedCastCount: number;
  assignedCrewCount: number;
  confirmedAssignedCrewCount: number;
}

export interface FirstAssistantDirectorBrief {
  generatedAt: string;
  projectUpdatedAt?: string;
  productionDay: FirstAssistantDirectorProductionDaySummary | null;
  readiness: FirstAssistantDirectorReadinessCheck[];
  stats: {
    sceneCount: number;
    scheduledSceneCount: number;
    unscheduledSceneCount: number;
    upcomingProductionDayCount: number;
    assignedCrewCount: number;
    confirmedAssignedCrewCount: number;
  };
  items: FirstAssistantDirectorBriefItem[];
}

interface BuildFirstAssistantDirectorBriefInput {
  project: CastingProject;
  now?: Date;
}

export function isFirstAssistantDirectorSurface(
  value: unknown,
): value is FirstAssistantDirectorSurface {
  return typeof value === 'string'
    && FIRST_ASSISTANT_DIRECTOR_SURFACES.includes(value as FirstAssistantDirectorSurface);
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLocaleUpperCase('nb-NO').replace(/\s+/g, ' ')
    : '';
}

function nonCancelledProductionDays(project: CastingProject): ProductionDay[] {
  return (Array.isArray(project.productionDays) ? project.productionDays : [])
    .filter((day) => day.status !== 'cancelled');
}

function isUpcomingProductionDay(day: ProductionDay, today: string): boolean {
  const date = readDateKey(day.date);
  return Boolean(date && date >= today && day.status !== 'completed' && day.status !== 'cancelled');
}

function selectProductionDay(
  days: ProductionDay[],
  today: string,
): { day: ProductionDay; date: string } | null {
  return days
    .map((day) => ({ day, date: readDateKey(day.date) }))
    .filter((entry): entry is { day: ProductionDay; date: string } => Boolean(entry.date))
    .filter(({ day, date }) => (
      date >= today
      && day.status !== 'completed'
      && day.status !== 'cancelled'
    ))
    .sort((left, right) => left.date.localeCompare(right.date))[0] ?? null;
}

function resolveLocation(day: ProductionDay, locations: Location[]): string | undefined {
  const directLocation = readText(day.location);
  if (directLocation) return directLocation;
  if (!day.locationId) return undefined;
  return readText(locations.find((location) => location.id === day.locationId)?.name);
}

function scenePageCount(scene: SceneBreakdown): number {
  return typeof scene.pageLength === 'number' && Number.isFinite(scene.pageLength)
    ? Math.max(0, scene.pageLength)
    : 0;
}

function isFilledRole(role: Role, candidates: Candidate[]): boolean {
  return role.status === 'filled'
    || role.status === 'cast'
    || role.status === 'confirmed'
    || typeof role.assignedCandidateId === 'string'
    || typeof role.assigned_candidate_id === 'string'
    || candidates.some((candidate) => {
      const assigned = candidate.assignedRoles ?? candidate.assigned_roles ?? [];
      return candidate.roleId === role.id
        || candidate.role_id === role.id
        || (Array.isArray(assigned) && assigned.includes(role.id));
    });
}

function isConfirmedCrew(member: CrewMember): boolean {
  return member.status === 'confirmed';
}

export function buildFirstAssistantDirectorBrief({
  project,
  now = new Date(),
}: BuildFirstAssistantDirectorBriefInput): FirstAssistantDirectorBrief {
  const today = localDateKey(now);
  const scenes = Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [];
  const sceneById = new Map(scenes.map((scene) => [scene.id, scene]));
  const crew = Array.isArray(project.crew) ? project.crew : [];
  const crewById = new Map(crew.map((member) => [member.id, member]));
  const roles = Array.isArray(project.roles) ? project.roles : [];
  const candidates = Array.isArray(project.candidates) ? project.candidates : [];
  const roleByReference = new Map<string, Role>();
  for (const role of roles) {
    roleByReference.set(role.id, role);
    roleByReference.set(normalizeName(role.name), role);
  }
  const locations = Array.isArray(project.locations) ? project.locations : [];
  const days = nonCancelledProductionDays(project);
  const upcomingDays = days.filter((day) => isUpcomingProductionDay(day, today));
  const selected = selectProductionDay(days, today);
  const scheduledSceneIds = new Set(
    days.flatMap((day) => (Array.isArray(day.scenes) ? day.scenes : []))
      .filter((sceneId): sceneId is string => typeof sceneId === 'string' && sceneId.length > 0),
  );
  const scheduledSceneCount = scenes.filter((scene) => scheduledSceneIds.has(scene.id)).length;
  const unscheduledSceneCount = Math.max(0, scenes.length - scheduledSceneCount);

  let productionDay: FirstAssistantDirectorProductionDaySummary | null = null;
  let readiness: FirstAssistantDirectorReadinessCheck[] = [];

  if (selected) {
    const sceneIds = Array.isArray(selected.day.scenes)
      ? selected.day.scenes.filter((sceneId): sceneId is string => typeof sceneId === 'string' && sceneId.length > 0)
      : [];
    const dayScenes = sceneIds
      .map((sceneId) => sceneById.get(sceneId))
      .filter((scene): scene is SceneBreakdown => Boolean(scene));
    const missingSceneCount = Math.max(0, sceneIds.length - dayScenes.length);
    const requiredCharacters = new Map<string, Role | undefined>();
    for (const reference of dayScenes.flatMap((scene) => (Array.isArray(scene.characters) ? scene.characters : []))) {
      const value = String(reference ?? '').trim();
      if (!value) continue;
      const role = roleByReference.get(value) ?? roleByReference.get(normalizeName(value));
      const key = role?.id || normalizeName(value);
      if (!requiredCharacters.has(key)) requiredCharacters.set(key, role);
    }
    const unresolvedCastCount = [...requiredCharacters.values()]
      .filter((role) => !role || !isFilledRole(role, candidates)).length;
    const assignedCrew = (Array.isArray(selected.day.crew) ? selected.day.crew : [])
      .map((crewId) => crewById.get(crewId))
      .filter((member): member is CrewMember => Boolean(member));
    const confirmedAssignedCrewCount = assignedCrew.filter(isConfirmedCrew).length;
    const location = resolveLocation(selected.day, locations);
    const callTime = readText(selected.day.callTime);

    productionDay = {
      id: selected.day.id,
      kind: selected.date === today ? 'today' : 'next',
      date: selected.date,
      callTime,
      wrapTime: readText(selected.day.wrapTime),
      location,
      sceneCount: sceneIds.length,
      pageCount: dayScenes.reduce((total, scene) => total + scenePageCount(scene), 0),
      missingSceneCount,
      unresolvedCastCount,
      assignedCrewCount: assignedCrew.length,
      confirmedAssignedCrewCount,
    };

    readiness = [
      {
        id: 'scenes',
        label: 'Scener',
        ready: sceneIds.length > 0 && missingSceneCount === 0,
        detail: sceneIds.length === 0
          ? 'Ingen scener er lagt til på dagen.'
          : missingSceneCount > 0
            ? `${missingSceneCount} scene-ID mangler scenegrunnlag.`
            : `${sceneIds.length} ${sceneIds.length === 1 ? 'scene er' : 'scener er'} knyttet til dagen.`,
      },
      {
        id: 'call-time',
        label: 'Oppmøte',
        ready: Boolean(callTime),
        detail: callTime ? `Oppmøte er satt til ${callTime}.` : 'Oppmøtetid er ikke registrert.',
      },
      {
        id: 'location',
        label: 'Lokasjon',
        ready: Boolean(location),
        detail: location ? `Hovedlokasjon: ${location}.` : 'Ingen hovedlokasjon er registrert.',
      },
      {
        id: 'cast',
        label: 'Medvirkende',
        ready: unresolvedCastCount === 0,
        detail: unresolvedCastCount === 0
          ? 'Alle registrerte karakterbehov har en besatt rolle.'
          : `${unresolvedCastCount} ${unresolvedCastCount === 1 ? 'karakterbehov mangler' : 'karakterbehov mangler'} besatt rolle.`,
      },
      {
        id: 'crew',
        label: 'Crew',
        ready: assignedCrew.length > 0 && confirmedAssignedCrewCount === assignedCrew.length,
        detail: assignedCrew.length === 0
          ? 'Ingen crewmedlemmer er knyttet til dagen.'
          : confirmedAssignedCrewCount === assignedCrew.length
            ? `Alle ${assignedCrew.length} tildelte crewmedlemmer er bekreftet.`
            : `${assignedCrew.length - confirmedAssignedCrewCount} av ${assignedCrew.length} tildelte crewmedlemmer er ikke bekreftet.`,
      },
    ];
  }

  const items: FirstAssistantDirectorBriefItem[] = [];

  if (!productionDay) {
    items.push({
      id: 'production-day-missing',
      title: 'Ingen kommende opptaksdag er registrert',
      description: 'Produksjonsplanen har ingen aktiv dato i dag eller fremover.',
      sourceLabel: 'Produksjonsdager',
      tone: 'neutral',
      target: 'shooting-plan',
      actionLabel: 'Åpne opptaksplan',
    });
  } else {
    items.push({
      id: `production-day-${productionDay.id}`,
      title: productionDay.kind === 'today' ? 'Opptaksdag i dag' : 'Neste opptaksdag er registrert',
      description: `${productionDay.date}${productionDay.callTime ? ` · oppmøte ${productionDay.callTime}` : ''} · ${productionDay.sceneCount} ${productionDay.sceneCount === 1 ? 'scene' : 'scener'}${productionDay.location ? ` · ${productionDay.location}` : ''}.`,
      sourceLabel: 'Produksjonsplan',
      tone: productionDay.kind === 'today' ? 'attention' : 'upcoming',
      target: productionDay.kind === 'today' ? 'on-set' : 'shooting-plan',
      actionLabel: productionDay.kind === 'today' ? 'Åpne Live Set' : 'Se opptaksplan',
    });

    const missingCoreChecks = readiness.filter((check) => (
      !check.ready && ['scenes', 'call-time', 'location'].includes(check.id)
    ));
    if (missingCoreChecks.length > 0) {
      items.push({
        id: 'day-plan-incomplete',
        title: `${missingCoreChecks.length} ${missingCoreChecks.length === 1 ? 'grunnopplysning mangler' : 'grunnopplysninger mangler'} for opptaksdagen`,
        description: missingCoreChecks.map((check) => check.detail).join(' '),
        sourceLabel: 'Opptaksdag',
        tone: 'attention',
        target: 'shooting-plan',
        actionLabel: 'Fullfør dagsplan',
      });
    }

    if (productionDay.unresolvedCastCount > 0) {
      items.push({
        id: 'day-cast-unresolved',
        title: `${productionDay.unresolvedCastCount} ${productionDay.unresolvedCastCount === 1 ? 'karakterbehov er' : 'karakterbehov er'} ikke besatt`,
        description: 'Tallet sammenligner kun scenenes registrerte karakterer med prosjektroller markert som besatt.',
        sourceLabel: 'Scener og rollestatus',
        tone: 'attention',
        target: 'cast-crew',
        actionLabel: 'Se medvirkende',
      });
    }

    if (productionDay.assignedCrewCount === 0) {
      items.push({
        id: 'day-crew-missing',
        title: 'Ingen crew er knyttet til opptaksdagen',
        description: 'Prosjektet kan ha crew, men produksjonsdagen har ingen registrerte crew-ID-er.',
        sourceLabel: 'Opptaksdag og crew',
        tone: 'attention',
        target: 'cast-crew',
        actionLabel: 'Fordel crew',
      });
    } else if (productionDay.confirmedAssignedCrewCount < productionDay.assignedCrewCount) {
      const count = productionDay.assignedCrewCount - productionDay.confirmedAssignedCrewCount;
      items.push({
        id: 'day-crew-unconfirmed',
        title: `${count} ${count === 1 ? 'tildelt crewmedlem er' : 'tildelte crewmedlemmer er'} ikke bekreftet`,
        description: 'Viser kun crew som er eksplisitt knyttet til opptaksdagen.',
        sourceLabel: 'Crewstatus',
        tone: 'upcoming',
        target: 'cast-crew',
        actionLabel: 'Følg opp crew',
      });
    }

    const selectedDay = days.find((day) => day.id === productionDay.id);
    const movementEntries = Array.isArray(selectedDay?.secondAd?.entries)
      ? selectedDay.secondAd.entries
      : [];
    if (movementEntries.length > 0) {
      const acknowledged = movementEntries.filter((entry) => [
        'acknowledged', 'arrived', 'makeup', 'wardrobe', 'ready', 'on_set', 'wrapped',
      ].includes(entry.status)).length;
      const ready = movementEntries.filter((entry) => ['ready', 'on_set', 'wrapped'].includes(entry.status)).length;
      items.push({
        id: 'second-ad-day-status',
        title: `${ready}/${movementEntries.length} medvirkende er klare for sett`,
        description: `${acknowledged}/${movementEntries.length} har bekreftet eller kommet videre i dagsflyten. Oppdateres fra 2nd ADs individuelle tider og status.`,
        sourceLabel: '2nd AD dagsstatus',
        tone: acknowledged === movementEntries.length ? 'ready' : 'attention',
        target: 'on-set',
        actionLabel: 'Åpne Live Set',
      });
    }
  }

  if (scenes.length === 0) {
    items.push({
      id: 'scenes-missing',
      title: 'Ingen scener er registrert',
      description: 'Stripboard og dagsplan kan ikke kontrolleres før prosjektet har registrerte scener.',
      sourceLabel: 'Scene breakdown',
      tone: 'neutral',
      target: 'stripboard',
      actionLabel: 'Åpne manus og scener',
    });
  } else if (unscheduledSceneCount > 0) {
    items.push({
      id: 'unscheduled-scenes',
      title: `${unscheduledSceneCount} ${unscheduledSceneCount === 1 ? 'scene er' : 'scener er'} ikke planlagt`,
      description: 'Viser registrerte scene-ID-er som ikke finnes på en aktiv produksjonsdag.',
      sourceLabel: 'Scener og produksjonsdager',
      tone: 'attention',
      target: 'stripboard',
      actionLabel: 'Åpne stripboard',
    });
  }

  if (productionDay && readiness.length > 0 && readiness.every((check) => check.ready)) {
    items.push({
      id: 'call-sheet-ready',
      title: 'Registrert dagsgrunnlag er klart for callsheet',
      description: 'Scener, oppmøtetid, lokasjon, medvirkende og tildelt crew er registrert og bekreftet.',
      sourceLabel: 'Opptaksberedskap',
      tone: 'ready',
      target: 'call-sheet',
      actionLabel: 'Åpne callsheet',
    });
  }

  return {
    generatedAt: now.toISOString(),
    projectUpdatedAt: readText(project.updatedAt),
    productionDay,
    readiness,
    stats: {
      sceneCount: scenes.length,
      scheduledSceneCount,
      unscheduledSceneCount,
      upcomingProductionDayCount: upcomingDays.length,
      assignedCrewCount: productionDay?.assignedCrewCount ?? 0,
      confirmedAssignedCrewCount: productionDay?.confirmedAssignedCrewCount ?? 0,
    },
    items,
  };
}
