import type { Candidate, Role, Schedule } from '../../models/casting';

export type CastingWorkspaceTarget = 'roles' | 'talents' | 'candidates' | 'auditions' | 'selection';
export type CastingWorkspaceSurface = 'overview' | CastingWorkspaceTarget;

export function isCastingWorkspaceSurface(value: unknown): value is CastingWorkspaceSurface {
  return typeof value === 'string'
    && ['overview', 'roles', 'talents', 'candidates', 'auditions', 'selection'].includes(value);
}

export interface CastingWorkspaceBrief {
  stats: {
    roleCount: number;
    openRoleCount: number;
    candidateCount: number;
    shortlistCount: number;
    selectedCount: number;
    scheduledAuditionCount: number;
  };
  actions: Array<{
    id: string;
    target: CastingWorkspaceTarget;
    title: string;
    description: string;
    evidence: string;
    tone: 'attention' | 'active' | 'ready' | 'neutral';
  }>;
}

const normalise = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function buildCastingWorkspaceBrief(input: {
  roles: Role[];
  candidates: Candidate[];
  schedules: Schedule[];
  today?: string;
}): CastingWorkspaceBrief {
  const { roles, candidates, schedules } = input;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const shortlistCount = candidates.filter((candidate) => normalise(candidate.status) === 'shortlist').length;
  const selectedCandidates = candidates.filter((candidate) => ['selected', 'confirmed'].includes(normalise(candidate.status)));
  const selectedCount = selectedCandidates.length;
  const castRoleIds = new Set(selectedCandidates.flatMap((candidate) => [
    candidate.roleId,
    candidate.role_id,
    ...(candidate.assignedRoles ?? []),
    ...(candidate.assigned_roles ?? []),
  ].filter((roleId): roleId is string => typeof roleId === 'string' && roleId.trim().length > 0)));
  const openRoleCount = roles.filter((role) => {
    const status = normalise(role.status);
    if (['open', 'casting'].includes(status)) return true;
    if (['filled', 'cast', 'closed', 'cancelled', 'selected', 'confirmed'].includes(status)) return false;
    return !castRoleIds.has(role.id);
  }).length;
  const scheduledAuditions = schedules.filter((schedule) => {
    const status = normalise(schedule.status);
    const date = String(schedule.date ?? '').slice(0, 10);
    return status !== 'cancelled' && Boolean(date) && date >= today;
  });

  const actions: CastingWorkspaceBrief['actions'] = [
    {
      id: 'roles',
      target: 'roles',
      title: roles.length === 0 ? 'Definer rollene som skal castes' : `${openRoleCount} roller er åpne for casting`,
      description: roles.length === 0
        ? 'Prosjektet har ingen registrerte karakterroller ennå.'
        : 'Åpne rollelisten for brief, krav og kobling til scener.',
      evidence: `${roles.length} registrerte roller`,
      tone: roles.length === 0 || openRoleCount > 0 ? 'attention' : 'ready',
    },
    {
      id: 'talents',
      target: 'talents',
      title: 'Finn talenter gjennom prosjektets partnere',
      description: 'Søk i samtykkede basisprofiler og behandle talentforslag fra godkjente partnerbyråer.',
      evidence: 'Prosjektavgrenset talentsøk',
      tone: roles.length > 0 ? 'active' : 'neutral',
    },
    {
      id: 'candidates',
      target: 'candidates',
      title: candidates.length === 0 ? 'Bygg kandidatlisten' : `${candidates.length} kandidater i prosjektet`,
      description: shortlistCount > 0
        ? `${shortlistCount} kandidater står på kortlisten og kan sammenlignes videre.`
        : 'Se materiale, kontaktdata, status og rollekoblinger.',
      evidence: `${shortlistCount} på kortliste`,
      tone: shortlistCount > 0 ? 'active' : candidates.length === 0 ? 'attention' : 'neutral',
    },
    {
      id: 'auditions',
      target: 'auditions',
      title: scheduledAuditions.length > 0 ? `${scheduledAuditions.length} kommende auditions` : 'Ingen kommende auditions registrert',
      description: scheduledAuditions.length > 0
        ? 'Åpne auditionplanen for tider, roller, kandidater og oppfølging.'
        : 'Planlegg neste audition når kandidatgrunnlaget er klart.',
      evidence: `${schedules.length} auditionposter totalt`,
      tone: scheduledAuditions.length > 0 ? 'active' : 'neutral',
    },
    {
      id: 'selection',
      target: 'selection',
      title: selectedCount > 0 ? `${selectedCount} kandidater er valgt eller bekreftet` : 'Ingen endelige castingvalg registrert',
      description: 'Sammenlign kandidatene og dokumenter den endelige utvelgelsen.',
      evidence: `${selectedCount} valgt/bekreftet`,
      tone: selectedCount > 0 ? 'ready' : 'neutral',
    },
  ];

  return {
    stats: {
      roleCount: roles.length,
      openRoleCount,
      candidateCount: candidates.length,
      shortlistCount,
      selectedCount,
      scheduledAuditionCount: scheduledAuditions.length,
    },
    actions,
  };
}
