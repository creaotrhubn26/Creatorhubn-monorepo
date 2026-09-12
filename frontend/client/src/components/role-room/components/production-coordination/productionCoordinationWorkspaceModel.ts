import type {
  CastingProject,
  ProductionCoordinationCallSheetItem,
  ProductionCoordinationCrewFollowUp,
  ProductionCoordinationLogisticsItem,
  ProductionCoordinationOperations,
  ProductionDay,
} from '../../models/casting';

const nowIso = () => new Date().toISOString();

export function selectProductionCoordinationDay(days: ProductionDay[]): ProductionDay | undefined {
  const active = days.filter((day) => day.status !== 'cancelled');
  return active.find((day) => day.status === 'in_progress')
    ?? active.find((day) => (day.date ?? '') >= new Date().toISOString().slice(0, 10))
    ?? active.at(-1);
}

function defaultLogistics(project: CastingProject, day: ProductionDay): ProductionCoordinationLogisticsItem[] {
  const location = (project.locations ?? []).find((item) => item.id === day.locationId);
  const updatedAt = nowIso();
  return [
    { id: 'default:transport', category: 'transport', title: 'Transport og parkering bekreftet', status: 'not_started', updatedAt },
    { id: 'default:catering', category: 'catering', title: 'Catering, allergier og måltider bekreftet', status: 'not_started', updatedAt },
    { id: 'default:equipment', category: 'equipment', title: 'Utstyrsleveranser og returer bekreftet', status: 'not_started', updatedAt },
    ...(location ? [{
      id: `default:permit:${location.id}`,
      category: 'permit' as const,
      title: `Tillatelser for ${location.name}`,
      status: 'not_started' as const,
      updatedAt,
    }] : []),
  ];
}

function defaultCallSheetChecklist(): ProductionCoordinationCallSheetItem[] {
  const updatedAt = nowIso();
  return [
    { id: 'callsheet:schedule', title: 'Scener, rekkefølge og tider er kontrollert', status: 'not_started', updatedAt },
    { id: 'callsheet:people', title: 'Cast, crew og kontaktinformasjon er kontrollert', status: 'not_started', updatedAt },
    { id: 'callsheet:location', title: 'Lokasjon, parkering og transport er kontrollert', status: 'not_started', updatedAt },
    { id: 'callsheet:safety', title: 'Vær, HMS og særskilte hensyn er kontrollert', status: 'not_started', updatedAt },
  ];
}

function syncCrewFollowUps(
  day: ProductionDay,
  existing: ProductionCoordinationCrewFollowUp[],
): ProductionCoordinationCrewFollowUp[] {
  const byCrewId = new Map(existing.map((entry) => [entry.crewId, entry]));
  return day.crew.map((crewId) => byCrewId.get(crewId) ?? ({
    crewId,
    status: 'pending',
    updatedAt: nowIso(),
  }));
}

export function buildProductionCoordinationOperations(
  project: CastingProject,
  day: ProductionDay,
): ProductionCoordinationOperations {
  const existing = day.productionCoordination;
  return {
    tasks: existing?.tasks ?? [],
    crewFollowUps: syncCrewFollowUps(day, existing?.crewFollowUps ?? []),
    logistics: existing?.logistics?.length ? existing.logistics : defaultLogistics(project, day),
    documents: existing?.documents ?? [],
    callSheetChecklist: existing?.callSheetChecklist?.length ? existing.callSheetChecklist : defaultCallSheetChecklist(),
    escalations: existing?.escalations ?? [],
    handover: existing?.handover ?? { status: 'draft', updatedAt: nowIso() },
    activity: existing?.activity ?? [],
  };
}

export function productionCoordinationReadiness(operations: ProductionCoordinationOperations) {
  const openTasks = operations.tasks.filter((item) => item.status !== 'done').length;
  const blockedTasks = operations.tasks.filter((item) => item.status === 'blocked').length;
  const crewConfirmed = operations.crewFollowUps.filter((item) => item.status === 'confirmed').length;
  const crewProblems = operations.crewFollowUps.filter((item) => item.status === 'problem').length;
  const logisticsReady = operations.logistics.filter((item) => item.status === 'ready').length;
  const missingDocuments = operations.documents.filter((item) => item.status === 'missing' || item.status === 'requested').length;
  const callSheetReady = operations.callSheetChecklist.filter((item) => item.status === 'ready').length;
  const criticalEscalations = operations.escalations.filter((item) => item.severity === 'critical' && item.status !== 'resolved').length;
  return {
    openTasks,
    crewConfirmed,
    crewTotal: operations.crewFollowUps.length,
    logisticsReady,
    logisticsTotal: operations.logistics.length,
    missingDocuments,
    callSheetReady,
    callSheetTotal: operations.callSheetChecklist.length,
    blockers: blockedTasks + crewProblems + criticalEscalations,
  };
}

export function createCoordinationId(prefix: 'task' | 'logistics' | 'document' | 'escalation'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}
