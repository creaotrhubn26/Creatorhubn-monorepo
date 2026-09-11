import type {
  Candidate,
  CastingProject,
  ProductionDay,
  Role,
  SecondAdMovementEntry,
} from '../../models/casting';

export const SECOND_AD_STATUSES = [
  'not_called',
  'call_sent',
  'acknowledged',
  'arrived',
  'makeup',
  'wardrobe',
  'ready',
  'on_set',
  'wrapped',
] as const;

export const SECOND_AD_STATUS_LABELS: Record<(typeof SECOND_AD_STATUSES)[number], string> = {
  not_called: 'Ikke innkalt',
  call_sent: 'Call sendt',
  acknowledged: 'Bekreftet',
  arrived: 'Ankommet',
  makeup: 'Sminke',
  wardrobe: 'Kostyme',
  ready: 'Klar',
  on_set: 'På sett',
  wrapped: 'Ferdig',
};

function dateKey(value: unknown): string | null {
  return typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null : null;
}

function todayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function selectSecondAdProductionDay(
  days: ProductionDay[],
  now = new Date(),
): ProductionDay | null {
  const active = days
    .filter((day) => day.status !== 'cancelled')
    .map((day) => ({ day, date: dateKey(day.date) }))
    .filter((value): value is { day: ProductionDay; date: string } => Boolean(value.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const today = todayKey(now);
  return active.find(({ date }) => date >= today)?.day ?? active.at(-1)?.day ?? null;
}

function normalized(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toLocaleUpperCase('nb-NO').replace(/\s+/g, ' ')
    : '';
}

function assignedCandidate(role: Role | undefined, candidates: Candidate[]): Candidate | undefined {
  if (!role) return undefined;
  const directId = typeof role.assignedCandidateId === 'string' ? role.assignedCandidateId : undefined;
  if (directId) return candidates.find((candidate) => candidate.id === directId);
  return candidates.find((candidate) => {
    const ids = candidate.assignedRoles ?? candidate.assigned_roles ?? [];
    return Array.isArray(ids) && ids.includes(role.id);
  });
}

export function buildSecondAdMovementEntries(
  project: CastingProject,
  day: ProductionDay,
): SecondAdMovementEntry[] {
  const scenes = Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [];
  const daySceneIds = new Set(Array.isArray(day.scenes) ? day.scenes : []);
  const characterNames = Array.from(new Set(
    scenes
      .filter((scene) => daySceneIds.has(scene.id))
      .flatMap((scene) => Array.isArray(scene.characters) ? scene.characters : [])
      .map((name) => String(name).trim())
      .filter(Boolean),
  ));
  const roles = Array.isArray(project.roles) ? project.roles : [];
  const candidates = Array.isArray(project.candidates) ? project.candidates : [];
  const persisted = Array.isArray(day.secondAd?.entries) ? day.secondAd.entries : [];
  const persistedById = new Map(persisted.map((entry) => [entry.id, entry]));
  const generatedIds = new Set<string>();

  const generated = characterNames.map((character): SecondAdMovementEntry => {
    const role = roles.find((item) => normalized(item.name) === normalized(character));
    const candidate = assignedCandidate(role, candidates);
    const id = `cast:${candidate?.id ?? role?.id ?? normalized(character)}`;
    generatedIds.add(id);
    const existing = persistedById.get(id);
    return {
      id,
      personType: 'cast',
      personId: candidate?.id,
      name: candidate?.name || character,
      roleName: character,
      callTime: day.callTime || '',
      status: 'not_called',
      ...existing,
    };
  });

  return [
    ...generated,
    ...persisted.filter((entry) => !generatedIds.has(entry.id)),
  ];
}

export function secondAdReadiness(entries: SecondAdMovementEntry[]) {
  return {
    total: entries.length,
    acknowledged: entries.filter((entry) => [
      'acknowledged', 'arrived', 'makeup', 'wardrobe', 'ready', 'on_set', 'wrapped',
    ].includes(entry.status)).length,
    arrived: entries.filter((entry) => [
      'arrived', 'makeup', 'wardrobe', 'ready', 'on_set', 'wrapped',
    ].includes(entry.status)).length,
    ready: entries.filter((entry) => ['ready', 'on_set', 'wrapped'].includes(entry.status)).length,
    wrapped: entries.filter((entry) => entry.status === 'wrapped').length,
  };
}
