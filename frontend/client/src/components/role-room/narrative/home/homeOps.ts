/**
 * homeOps — rene hjelpere for prosjekt-hjem (Fase 7b). Testes med vitest.
 */
import type { NarrativeMilestone, NarrativeProjectOverview, NarrativeSceneStatus } from '../narrativeTypes';

export type NextUpBucket = 'urgent' | 'today' | 'soon';
export const NEXT_UP_ORDER: readonly NextUpBucket[] = ['urgent', 'today', 'soon'];
export const NEXT_UP_LABELS: Record<NextUpBucket, string> = { urgent: 'Forfalt', today: 'I dag', soon: 'Neste 14 dager' };

export interface NextUpItem {
  key: string;
  kind: 'milestone' | 'review' | 'task';
  title: string;
  detail: string;
  at: string | null;
  bucket: NextUpBucket;
  tab: string;
}

export function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

const DAY = 86_400_000;

/** Bucketing for frister: forfalt → i dag → innen 14 dager; senere/uten dato = null. */
export function bucketByDue(dueAt: string | null | undefined, now = Date.now()): NextUpBucket | null {
  if (!dueAt) return null;
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return null;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = startOfToday.getTime() + DAY;
  if (due < startOfToday.getTime()) return 'urgent';
  if (due < endOfToday) return 'today';
  if (due < now + 14 * DAY) return 'soon';
  return null;
}

/** Milepæler som fortjener plass i «Neste opp» (ikke ferdige, med frist ≤ 14 d eller blokkert). */
export function nextUpFromMilestones(milestones: readonly NarrativeMilestone[], now = Date.now()): NextUpItem[] {
  const out: NextUpItem[] = [];
  for (const m of milestones) {
    if (m.status === 'done') continue;
    const bucket = bucketByDue(m.dueAt, now) ?? (m.status === 'blocked' ? 'urgent' : null);
    if (!bucket) continue;
    out.push({ key: `milestone:${m.id}`, kind: 'milestone', title: m.title, detail: m.status === 'blocked' ? 'Blokkert' : 'Milepæl', at: m.dueAt, bucket, tab: 'plan' });
  }
  return out;
}

export function sortNextUp(items: readonly NextUpItem[]): NextUpItem[] {
  const rank = (b: NextUpBucket) => NEXT_UP_ORDER.indexOf(b);
  return [...items].sort((a, b) => rank(a.bucket) - rank(b.bucket) || String(a.at ?? '9').localeCompare(String(b.at ?? '9')));
}

export interface HomeKpi {
  key: 'scenes' | 'gates' | 'tasks' | 'reviews' | 'lines' | 'platform';
  label: string;
  value: string;
  sub: string;
  pct: number | null;
  tab: string;
  tone: 'accent' | 'warning' | 'error' | 'neutral';
}

const DONE_STATUSES: NarrativeSceneStatus[] = ['approved', 'implemented'];

export function homeKpis(o: NarrativeProjectOverview): HomeKpi[] {
  const scenesDone = DONE_STATUSES.reduce((n, s) => n + (o.scenes.byStatus[s] ?? 0), 0);
  return [
    { key: 'scenes', label: 'Scener', value: String(o.scenes.total), sub: `${scenesDone} godkjent/implementert · ${o.scenes.byStatus.in_review ?? 0} til review`, pct: pct(scenesDone, o.scenes.total), tab: 'scenes', tone: 'accent' },
    { key: 'gates', label: 'Leveransegater', value: `${pct(o.gates.passed, o.gates.total)} %`, sub: `${o.gates.passed} av ${o.gates.total} bestått${o.gates.failed ? ` · ${o.gates.failed} feilet` : ''}`, pct: pct(o.gates.passed, o.gates.total), tab: 'scenes', tone: o.gates.failed ? 'warning' : 'accent' },
    { key: 'tasks', label: 'Oppgaver', value: String(o.tasks.open), sub: o.tasks.overdue ? `${o.tasks.overdue} forfalt · ${o.tasks.done} ferdig` : `${o.tasks.done} ferdig`, pct: pct(o.tasks.done, o.tasks.open + o.tasks.done), tab: 'scenes', tone: o.tasks.overdue ? 'error' : 'neutral' },
    { key: 'reviews', label: 'Åpne runder', value: String(o.reviews.open), sub: o.reviews.open ? 'venter på beslutning' : 'ingen runder åpne', pct: null, tab: 'scenes', tone: o.reviews.open ? 'warning' : 'neutral' },
    { key: 'lines', label: 'Replikker', value: String(o.lines.total), sub: `${o.lines.approved} godkjente opptak`, pct: pct(o.lines.approved, o.lines.total), tab: 'characters', tone: 'neutral' },
    { key: 'platform', label: 'Plattformkrav', value: o.platform.requirements ? `${o.platform.verified}/${o.platform.requirements}` : '–', sub: o.platform.primaryName ? `verifisert · ${o.platform.primaryName}` : 'ingen målplattform satt', pct: o.platform.requirements ? pct(o.platform.verified, o.platform.requirements) : null, tab: 'platform', tone: 'neutral' },
  ];
}

/** Første-gangs-tilstand: ingenting er lagt inn ennå. */
export function isEmptyProject(o: NarrativeProjectOverview): boolean {
  return o.scenes.total === 0 && o.episodes.length === 0 && o.milestones.length === 0 && o.lines.total === 0;
}
