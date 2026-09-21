import type {
  CastingProject,
  PostProductionRecord,
  PostTurnoverManifest,
  PostTurnoverStatus,
} from '../../models/casting';

export const POST_PRODUCTION_SURFACES = ['overview', 'turnovers', 'qc', 'activity'] as const;
export type PostProductionSurface = (typeof POST_PRODUCTION_SURFACES)[number];

export function isPostProductionSurface(value: unknown): value is PostProductionSurface {
  return typeof value === 'string' && POST_PRODUCTION_SURFACES.includes(value as PostProductionSurface);
}

export const POST_TURNOVER_STATUS_LABELS: Record<PostTurnoverStatus, string> = {
  draft: 'Utkast',
  ready: 'Klar for mottak',
  received: 'Mottatt',
  qc_issues: 'QC-avvik',
  accepted: 'Godkjent',
  superseded: 'Erstattet',
};

export interface PostProductionBrief {
  activeCount: number;
  readyCount: number;
  receivedCount: number;
  acceptedCount: number;
  staleCount: number;
  openIssueCount: number;
  blockingIssueCount: number;
  latestTurnovers: PostTurnoverManifest[];
}

export function buildPostProductionBrief(record?: PostProductionRecord | null): PostProductionBrief {
  const turnovers = record?.operations.turnovers ?? [];
  const active = turnovers.filter((turnover) => turnover.status !== 'superseded');
  const openIssues = active.flatMap((turnover) => turnover.issues.filter((issue) => issue.status === 'open'));
  return {
    activeCount: active.length,
    readyCount: active.filter((turnover) => turnover.status === 'ready').length,
    receivedCount: active.filter((turnover) => turnover.status === 'received' || turnover.status === 'qc_issues').length,
    acceptedCount: active.filter((turnover) => turnover.status === 'accepted').length,
    staleCount: active.filter((turnover) => turnover.impact.stale).length,
    openIssueCount: openIssues.length,
    blockingIssueCount: openIssues.filter((issue) => issue.severity === 'blocker').length,
    latestTurnovers: [...turnovers]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 5),
  };
}

export function productionDayLabel(project: CastingProject, productionDayId: string): string {
  const day = (project.productionDays ?? []).find((candidate) => candidate.id === productionDayId);
  if (!day) return productionDayId;
  const date = day.date ? new Date(`${day.date}T12:00:00`) : null;
  const dateLabel = date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: '2-digit', month: 'short' }).format(date)
    : productionDayId;
  const location = (project.locations ?? []).find((candidate) => candidate.id === day.locationId)?.name;
  return location ? `${dateLabel} · ${location}` : dateLabel;
}

export function nextTurnoverAction(turnover: PostTurnoverManifest): {
  status: PostTurnoverStatus;
  label: string;
  authority: 'prepare' | 'review';
} | null {
  if (turnover.status === 'draft') return { status: 'ready', label: 'Gjør klar', authority: 'prepare' };
  if (turnover.status === 'ready') return { status: 'received', label: 'Bekreft mottatt', authority: 'review' };
  if (turnover.status === 'received') return { status: 'accepted', label: 'Godkjenn turnover', authority: 'review' };
  if (turnover.status === 'qc_issues' && !turnover.issues.some((issue) => issue.status === 'open')) {
    return { status: 'ready', label: 'Lever på nytt', authority: 'prepare' };
  }
  return null;
}
