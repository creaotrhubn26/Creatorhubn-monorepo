import type { CastingProject } from '../../models/casting';

export type ProducerWorkspaceTarget = 'casting' | 'schedule' | 'crew' | 'locations' | 'economy' | 'reviews';

export interface ProducerWorkspaceBrief {
  stats: {
    productionDayCount: number;
    upcomingProductionDayCount: number;
    crewCount: number;
    confirmedCrewCount: number;
    locationCount: number;
    roleCount: number;
    selectedCandidateCount: number;
  };
  actions: Array<{
    id: string;
    target: ProducerWorkspaceTarget;
    title: string;
    description: string;
    evidence: string;
    tone: 'attention' | 'active' | 'ready' | 'neutral';
  }>;
}

const normalise = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function buildProducerWorkspaceBrief(project: CastingProject, today = new Date().toISOString().slice(0, 10)): ProducerWorkspaceBrief {
  const productionDays = (project.productionDays ?? []).filter((day) => normalise(day.status) !== 'cancelled');
  const upcomingProductionDayCount = productionDays.filter((day) => String(day.date ?? '').slice(0, 10) >= today).length;
  const crew = project.crew ?? [];
  const confirmedCrewCount = crew.filter((member) => normalise(member.status) === 'confirmed').length;
  const selectedCandidateCount = (project.candidates ?? []).filter((candidate) => ['selected', 'confirmed'].includes(normalise(candidate.status))).length;
  const budgetLabel = Number.isFinite(project.budget)
    ? `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Number(project.budget))} ${project.currency || 'NOK'}`
    : 'Ikke registrert';
  const approvalStatus = normalise(project.producerWorkflowStatus);

  return {
    stats: {
      productionDayCount: productionDays.length,
      upcomingProductionDayCount,
      crewCount: crew.length,
      confirmedCrewCount,
      locationCount: (project.locations ?? []).length,
      roleCount: (project.roles ?? []).length,
      selectedCandidateCount,
    },
    actions: [
      {
        id: 'casting',
        target: 'casting',
        title: `${selectedCandidateCount} kandidater er valgt eller bekreftet`,
        description: 'Kontroller rolledekning og åpne castingvalg før planen låses.',
        evidence: `${(project.roles ?? []).length} roller · ${(project.candidates ?? []).length} kandidater`,
        tone: selectedCandidateCount > 0 ? 'ready' : 'attention',
      },
      {
        id: 'schedule',
        target: 'schedule',
        title: upcomingProductionDayCount > 0 ? `${upcomingProductionDayCount} kommende produksjonsdager` : 'Ingen kommende produksjonsdager',
        description: 'Se opptaksplan, dagsgrunnlag og avhengigheter samlet.',
        evidence: `${productionDays.length} aktive produksjonsdager`,
        tone: upcomingProductionDayCount > 0 ? 'active' : 'attention',
      },
      {
        id: 'crew',
        target: 'crew',
        title: `${confirmedCrewCount} av ${crew.length} crew er bekreftet`,
        description: 'Følg bemanning, status, roller og kontaktgrunnlag.',
        evidence: `${crew.length} registrerte crewmedlemmer`,
        tone: crew.length > 0 && confirmedCrewCount === crew.length ? 'ready' : crew.length > 0 ? 'active' : 'attention',
      },
      {
        id: 'locations',
        target: 'locations',
        title: `${(project.locations ?? []).length} lokasjoner i prosjektet`,
        description: 'Åpne location readiness for avtaler, tillatelser, recce og backup.',
        evidence: `${(project.locations ?? []).length} registrerte lokasjoner`,
        tone: (project.locations ?? []).length > 0 ? 'neutral' : 'attention',
      },
      {
        id: 'economy',
        target: 'economy',
        title: `Budsjett: ${budgetLabel}`,
        description: 'Se økonomi, avvik og dokumenterte kostnadsdrivere.',
        evidence: Number.isFinite(project.budget) ? 'Prosjektbudsjett registrert' : 'Mangler prosjektbudsjett',
        tone: Number.isFinite(project.budget) ? 'neutral' : 'attention',
      },
      {
        id: 'reviews',
        target: 'reviews',
        title: approvalStatus === 'approved' ? 'Prosjektet er godkjent' : approvalStatus === 'awaiting_client' ? 'Venter på klientgodkjenning' : 'Godkjenning er ikke avsluttet',
        description: 'Åpne beslutningsloggen for godkjenning, endringsønsker og begrunnelse.',
        evidence: project.producerWorkflowStatus ? `Status: ${project.producerWorkflowStatus}` : 'Ingen godkjenningsstatus',
        tone: approvalStatus === 'approved' ? 'ready' : approvalStatus === 'awaiting_client' ? 'active' : 'neutral',
      },
    ],
  };
}
