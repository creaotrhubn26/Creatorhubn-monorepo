import type {
  CastingProject,
  ProductionDay,
  ProductionManagementCheckpoint,
  ProductionManagementCostItem,
  ProductionManagementCrewConfirmation,
  ProductionManagementOperations,
} from '../../models/casting';

export interface ProductionManagementDeliverySummary {
  id: string;
  revision: number;
  status?: 'published' | 'superseded' | 'retracted';
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
  acknowledged: number;
}

const nowIso = () => new Date().toISOString();

export function selectProductionManagementDay(days: ProductionDay[]): ProductionDay | undefined {
  const active = days.filter((day) => day.status !== 'cancelled');
  return active.find((day) => day.status === 'in_progress')
    ?? active.find((day) => (day.date ?? '') >= new Date().toISOString().slice(0, 10))
    ?? active.at(-1);
}

function defaultCheckpoints(project: CastingProject, day: ProductionDay): ProductionManagementCheckpoint[] {
  const location = (project.locations ?? []).find((item) => item.id === day.locationId);
  const timestamp = nowIso();
  return [
    ...(location ? [{
      id: `location:${location.id}`,
      category: 'location' as const,
      title: `Lokasjon · ${location.name}`,
      status: 'not_started' as const,
      updatedAt: timestamp,
    }] : []),
    { id: 'default:transport', category: 'transport' as const, title: 'Transport og parkering', status: 'not_started' as const, updatedAt: timestamp },
    { id: 'default:catering', category: 'catering' as const, title: 'Catering og måltider', status: 'not_started' as const, updatedAt: timestamp },
    { id: 'default:equipment', category: 'equipment' as const, title: 'Utstyr og leveranser', status: 'not_started' as const, updatedAt: timestamp },
  ];
}

function syncCrewConfirmations(
  day: ProductionDay,
  existing: ProductionManagementCrewConfirmation[],
): ProductionManagementCrewConfirmation[] {
  const byCrewId = new Map(existing.map((entry) => [entry.crewId, entry]));
  return day.crew.map((crewId) => byCrewId.get(crewId) ?? ({
    crewId,
    status: 'pending',
    updatedAt: nowIso(),
  }));
}

export function buildProductionManagementOperations(
  project: CastingProject,
  day: ProductionDay,
): ProductionManagementOperations {
  const existing = day.productionManagement;
  return {
    dayStatus: existing?.dayStatus ?? 'not_started',
    callSheetApproval: existing?.callSheetApproval ?? 'not_ready',
    crewConfirmations: syncCrewConfirmations(day, existing?.crewConfirmations ?? []),
    checkpoints: existing?.checkpoints?.length ? existing.checkpoints : defaultCheckpoints(project, day),
    issues: existing?.issues ?? [],
    costItems: existing?.costItems ?? [],
    notes: existing?.notes,
    activity: existing?.activity ?? [],
  };
}

export function productionManagementCosts(items: ProductionManagementCostItem[]) {
  const estimated = items.reduce((sum, item) => sum + (Number.isFinite(item.estimatedCost) ? item.estimatedCost : 0), 0);
  const actual = items.reduce((sum, item) => sum + (Number.isFinite(item.actualCost) ? item.actualCost : 0), 0);
  return { estimated, actual, deviation: actual - estimated };
}

export function productionManagementReadiness(operations: ProductionManagementOperations) {
  const crewConfirmed = operations.crewConfirmations.filter((entry) => entry.status === 'confirmed').length;
  const crewDeclined = operations.crewConfirmations.filter((entry) => entry.status === 'declined').length;
  const logisticsReady = operations.checkpoints.filter((entry) => entry.status === 'ready').length;
  const logisticsBlocked = operations.checkpoints.filter((entry) => entry.status === 'blocked').length;
  const criticalIssues = operations.issues.filter((issue) => issue.status !== 'resolved' && (issue.severity === 'critical' || issue.severity === 'high')).length;
  const openIssues = operations.issues.filter((issue) => issue.status !== 'resolved').length;
  const pendingCosts = operations.costItems.filter((item) => item.status === 'pending').length;
  const blockers = crewDeclined + logisticsBlocked + criticalIssues;
  return {
    crewConfirmed,
    crewTotal: operations.crewConfirmations.length,
    logisticsReady,
    logisticsTotal: operations.checkpoints.length,
    openIssues,
    pendingCosts,
    blockers,
  };
}

export function createManagementId(prefix: 'checkpoint' | 'issue' | 'cost'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}

export function mergeProductionDay(
  project: CastingProject,
  updatedDay: ProductionDay,
): CastingProject {
  return {
    ...project,
    productionDays: (project.productionDays ?? []).map((day) => day.id === updatedDay.id ? updatedDay : day),
  };
}
