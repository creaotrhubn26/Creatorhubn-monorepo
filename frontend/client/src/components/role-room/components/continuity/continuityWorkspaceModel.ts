import type {
  CastingProject,
  ProductionContinuityOperations,
  ProductionContinuitySnapshot,
  ProductionDay,
} from '../../models/casting';

const nowIso = () => new Date().toISOString();

export function selectContinuityDay(days: ProductionDay[]): ProductionDay | undefined {
  const active = days.filter((day) => day.status !== 'cancelled');
  return active.find((day) => day.status === 'in_progress')
    ?? active.find((day) => (day.date ?? '') >= new Date().toISOString().slice(0, 10))
    ?? active.at(-1);
}

export function buildContinuityOperations(day: ProductionDay): ProductionContinuityOperations {
  const existing = day.productionContinuity;
  const sceneIds = new Set(day.scenes);
  const sceneRecords = day.scenes.map((sceneId) => (
    existing?.sceneRecords.find((record) => record.sceneId === sceneId)
    ?? { sceneId, status: 'not_started' as const, updatedAt: nowIso() }
  ));
  const takes = (existing?.takes ?? []).filter((item) => sceneIds.has(item.sceneId));
  const takeIds = new Set(takes.map((item) => item.id));
  return {
    sceneRecords,
    takes,
    entries: (existing?.entries ?? []).filter((item) => sceneIds.has(item.sceneId) && (!item.takeId || takeIds.has(item.takeId))),
    deviations: (existing?.deviations ?? []).filter((item) => sceneIds.has(item.sceneId) && (!item.takeId || takeIds.has(item.takeId))),
    dailyNotes: existing?.dailyNotes,
    editorNotes: existing?.editorNotes,
    comments: existing?.comments ?? [],
    revisions: existing?.revisions ?? [],
    activity: existing?.activity ?? [],
  };
}

export function restoreContinuitySnapshot(
  current: ProductionContinuityOperations,
  snapshot: ProductionContinuitySnapshot,
): ProductionContinuityOperations {
  return {
    ...snapshot,
    comments: current.comments,
    revisions: current.revisions,
    activity: current.activity,
  };
}

export function mergeContinuityServerMetadata(
  local: ProductionContinuityOperations,
  remote: ProductionContinuityOperations,
): ProductionContinuityOperations {
  const comments = new Map([...local.comments, ...remote.comments].map((item) => [item.id, item]));
  return {
    ...local,
    comments: [...comments.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    revisions: remote.revisions,
    activity: remote.activity,
  };
}

export function createContinuityId(prefix: 'take' | 'entry' | 'deviation' | 'reference'): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${random}`;
}

export function nextTakeNumber(operations: ProductionContinuityOperations, sceneId: string): number {
  return operations.takes
    .filter((take) => take.sceneId === sceneId)
    .reduce((highest, take) => Math.max(highest, take.takeNumber), 0) + 1;
}

export function sceneLabel(project: CastingProject, sceneId: string): string {
  const scene = (project.sceneBreakdowns ?? []).find((item) => item.id === sceneId);
  if (!scene) return sceneId;
  const number = scene.sceneNumber ?? sceneId;
  const heading = scene.sceneHeading || scene.description || '';
  return `Scene ${number}${heading ? ` · ${heading}` : ''}`;
}

export function continuitySummary(operations: ProductionContinuityOperations) {
  return {
    completedScenes: operations.sceneRecords.filter((item) => item.status === 'complete').length,
    totalScenes: operations.sceneRecords.length,
    takes: operations.takes.length,
    circledTakes: operations.takes.filter((item) => item.circled).length,
    openRisks: operations.entries.filter((item) => item.severity !== 'info').length
      + operations.deviations.filter((item) => item.type === 'continuity_risk' && !item.accepted).length,
    deviations: operations.deviations.length,
  };
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildContinuityDailyReport(
  project: CastingProject,
  day: ProductionDay,
  operations: ProductionContinuityOperations,
): string {
  const rows: string[][] = [[
    'Prosjekt', 'Dato', 'Scene', 'Take', 'Sirklet', 'Status', 'Start-TC', 'Slutt-TC',
    'Kontinuitet', 'Performance', 'Teknisk', 'Lyd',
  ]];
  for (const take of operations.takes) {
    rows.push([
      project.name, day.date ?? '', sceneLabel(project, take.sceneId), String(take.takeNumber),
      take.circled ? 'Ja' : 'Nei', take.status, take.timecodeStart ?? '', take.timecodeEnd ?? '',
      take.continuityNotes ?? '', take.performanceNotes ?? '', take.technicalNotes ?? '', take.soundNotes ?? '',
    ]);
  }
  rows.push([]);
  rows.push(['KONTINUITETSLOGG', 'Scene', 'Kategori', 'Alvorlighet', 'Emne', 'Beskrivelse', 'Take', 'Referanser']);
  for (const entry of operations.entries) {
    rows.push([
      '', sceneLabel(project, entry.sceneId), entry.category, entry.severity, entry.subject ?? '',
      entry.description, entry.takeId ?? '', entry.references.map((item) => item.url ?? item.label ?? item.storageFileId ?? '').join(' | '),
    ]);
  }
  rows.push([]);
  rows.push(['MANUSAVVIK', 'Scene', 'Type', 'Karakter', 'Original', 'Fremført', 'Notat', 'Godkjent']);
  for (const deviation of operations.deviations) {
    rows.push([
      '', sceneLabel(project, deviation.sceneId), deviation.type, deviation.character ?? '',
      deviation.originalText ?? '', deviation.performedText ?? '', deviation.note ?? '', deviation.accepted ? 'Ja' : 'Nei',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function buildLinedScriptReport(
  project: CastingProject,
  day: ProductionDay,
  operations: ProductionContinuityOperations,
): string {
  const lines = [
    `${project.name} · lined script / klipperrapport`,
    `Produksjonsdag: ${day.date ?? day.id}`,
    '',
  ];
  for (const record of operations.sceneRecords) {
    const takes = operations.takes.filter((take) => take.sceneId === record.sceneId);
    const deviations = operations.deviations.filter((item) => item.sceneId === record.sceneId);
    lines.push(`${sceneLabel(project, record.sceneId)} — ${record.status}`);
    lines.push(`Takes: ${takes.map((take) => `${take.takeNumber}${take.circled ? ' ⭕' : ''} (${take.status})`).join(', ') || 'Ingen'}`);
    for (const deviation of deviations) {
      lines.push(`- ${deviation.type}${deviation.character ? ` · ${deviation.character}` : ''}: ${deviation.performedText || deviation.note || deviation.originalText || 'Registrert avvik'}`);
    }
    lines.push('');
  }
  if (operations.editorNotes) lines.push('Til klipp:', operations.editorNotes);
  return lines.join('\n');
}

export interface ContinuityDraft {
  baseVersion: number;
  updatedAt: string;
  operations: ProductionContinuityOperations;
}

export function continuityDraftKey(projectId: string, dayId: string): string {
  return `roleRoom:continuityDraft:${projectId}:${dayId}`;
}

export function loadContinuityDraft(projectId: string, dayId: string): ContinuityDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(continuityDraftKey(projectId, dayId)) ?? 'null') as ContinuityDraft | null;
    return parsed && Number.isInteger(parsed.baseVersion) && parsed.operations ? parsed : null;
  } catch {
    return null;
  }
}

export function saveContinuityDraft(projectId: string, dayId: string, draft: ContinuityDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(continuityDraftKey(projectId, dayId), JSON.stringify(draft));
  } catch {
    // The primary server save remains available if browser storage is blocked.
  }
}

export function clearContinuityDraft(projectId: string, dayId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(continuityDraftKey(projectId, dayId));
  } catch {
    // Ignore unavailable browser storage.
  }
}
