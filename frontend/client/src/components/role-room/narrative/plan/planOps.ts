/** planOps — rene hjelpere for produksjonsplanen (Gantt/liste). Fase 7d. Testes med vitest. */
import type { NarrativeMilestone, NarrativeMilestoneLane, NarrativeSceneSummary } from '../narrativeTypes';
import { NARRATIVE_MILESTONE_LANES } from '../narrativeTypes';

export type ZoomLevel = 'week' | 'month' | 'quarter';
export const ZOOM_LEVELS: readonly ZoomLevel[] = ['week', 'month', 'quarter'];
export const ZOOM_LABELS: Record<ZoomLevel, string> = { week: 'Uke', month: 'Måned', quarter: 'Kvartal' };
/** Synlig vindu per zoom (dager). */
export const ZOOM_DAYS: Record<ZoomLevel, number> = { week: 7 * 8, month: 31 * 4, quarter: 31 * 12 };

const DAY = 86_400_000;
export function startOfDay(ms: number): number { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
export function addDays(ms: number, days: number): number { return ms + days * DAY; }

export interface PlanWindow { start: number; end: number }

/** Vindu: fra tidligste start (eller i dag − 7 d) og `ZOOM_DAYS` fram. */
export function planWindow(items: ReadonlyArray<{ startAt: string | null; dueAt: string | null }>, zoom: ZoomLevel, now = Date.now()): PlanWindow {
  const dates = items.flatMap((i) => [i.startAt, i.dueAt]).filter((d): d is string => !!d).map((d) => new Date(d).getTime()).filter(Number.isFinite);
  const earliest = dates.length ? Math.min(...dates) : now;
  const start = startOfDay(Math.min(earliest, now) - 7 * DAY);
  return { start, end: addDays(start, ZOOM_DAYS[zoom]) };
}

export function dateToPercent(iso: string | number, win: PlanWindow): number {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(100, ((t - win.start) / (win.end - win.start)) * 100));
}

export interface Band { label: string; leftPct: number; widthPct: number; key: string }

/** Måned-bånd over vinduet (til overskrifter). */
export function monthBands(win: PlanWindow): Band[] {
  const out: Band[] = [];
  const cur = new Date(win.start); cur.setDate(1); cur.setHours(0, 0, 0, 0);
  while (cur.getTime() < win.end) {
    const next = new Date(cur); next.setMonth(next.getMonth() + 1);
    const a = Math.max(cur.getTime(), win.start); const b = Math.min(next.getTime(), win.end);
    out.push({ key: `${cur.getFullYear()}-${cur.getMonth()}`, label: cur.toLocaleDateString('nb-NO', { month: 'short', year: '2-digit' }), leftPct: dateToPercent(a, win), widthPct: dateToPercent(b, win) - dateToPercent(a, win) });
    cur.setTime(next.getTime());
  }
  return out;
}

/** Uke-bånd (ISO-uke-nummer) — brukes ved zoom = uke. */
export function weekBands(win: PlanWindow): Band[] {
  const out: Band[] = [];
  let t = startOfDay(win.start);
  const d = new Date(t); const dow = (d.getDay() + 6) % 7; t -= dow * DAY; // mandag
  while (t < win.end) {
    const a = Math.max(t, win.start); const b = Math.min(t + 7 * DAY, win.end);
    out.push({ key: String(t), label: `U${isoWeek(new Date(t))}`, leftPct: dateToPercent(a, win), widthPct: dateToPercent(b, win) - dateToPercent(a, win) });
    t += 7 * DAY;
  }
  return out;
}

export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

export interface PlanBar {
  key: string;
  kind: 'milestone' | 'scene';
  id: string;
  title: string;
  lane: NarrativeMilestoneLane;
  startAt: string | null;
  dueAt: string | null;
  status: string;
  /** Prosent i vinduet; punkt-milepæl (uten start) får smal bar ved frist. */
  leftPct: number;
  widthPct: number;
  overdue: boolean;
}

export interface LaneRow { lane: NarrativeMilestoneLane; bars: PlanBar[] }

/** Rader per bane: milepæler + scener med datoer (scener under «story»). Uten dato → egen liste. */
export function laneRows(milestones: readonly NarrativeMilestone[], scenes: readonly NarrativeSceneSummary[], win: PlanWindow, now = Date.now()): { rows: LaneRow[]; undated: PlanBar[] } {
  const rows: LaneRow[] = NARRATIVE_MILESTONE_LANES.map((lane) => ({ lane, bars: [] }));
  const undated: PlanBar[] = [];
  const push = (bar: Omit<PlanBar, 'leftPct' | 'widthPct' | 'overdue'>) => {
    const done = bar.status === 'done' || bar.status === 'approved' || bar.status === 'implemented';
    const dueMs = bar.dueAt ? new Date(bar.dueAt).getTime() : NaN;
    const overdue = !done && Number.isFinite(dueMs) && dueMs < now;
    if (!bar.startAt && !bar.dueAt) { undated.push({ ...bar, leftPct: 0, widthPct: 0, overdue }); return; }
    const a = bar.startAt ? new Date(bar.startAt).getTime() : dueMs;
    const b = Number.isFinite(dueMs) ? dueMs : a + DAY;
    const leftPct = dateToPercent(Math.min(a, b), win);
    const widthPct = Math.max(0.6, dateToPercent(Math.max(a, b) + (a === b ? DAY : 0), win) - leftPct);
    rows.find((r) => r.lane === bar.lane)!.bars.push({ ...bar, leftPct, widthPct, overdue });
  };
  for (const m of milestones) push({ key: `m:${m.id}`, kind: 'milestone', id: m.id, title: m.title, lane: m.lane, startAt: m.startAt, dueAt: m.dueAt, status: m.status });
  for (const s of scenes) push({ key: `s:${s.id}`, kind: 'scene', id: s.id, title: `${s.code} · ${s.title}`, lane: 'story', startAt: s.startAt, dueAt: s.dueAt, status: s.status });
  for (const r of rows) r.bars.sort((x, y) => x.leftPct - y.leftPct);
  return { rows: rows.filter((r) => r.bars.length > 0), undated };
}

export type SortKey = 'due' | 'lane' | 'status' | 'title';
export function sortMilestones(items: readonly NarrativeMilestone[], key: SortKey): NarrativeMilestone[] {
  const laneIdx = (l: NarrativeMilestoneLane) => NARRATIVE_MILESTONE_LANES.indexOf(l);
  const statusIdx: Record<string, number> = { blocked: 0, in_progress: 1, planned: 2, done: 3 };
  return [...items].sort((a, b) => {
    switch (key) {
      case 'due': return String(a.dueAt ?? '9').localeCompare(String(b.dueAt ?? '9')) || a.sortOrder - b.sortOrder;
      case 'lane': return laneIdx(a.lane) - laneIdx(b.lane) || a.sortOrder - b.sortOrder;
      case 'status': return (statusIdx[a.status] ?? 9) - (statusIdx[b.status] ?? 9) || a.sortOrder - b.sortOrder;
      default: return a.title.localeCompare(b.title, 'nb');
    }
  });
}

export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
}
export function dateInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
