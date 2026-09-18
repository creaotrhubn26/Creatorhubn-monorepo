/**
 * sceneOps — rene hjelpere for «Scener & gameplay» (ingen React/DOM).
 *
 * Forebygg-feil-prinsippet ligger her: kodeforslag og duplikatsjekk kjøres
 * FØR lagring, review-knappen deaktiveres når en runde er åpen, og stale-
 * sjekk sammenligner hash før beslutning — så 409 er unntaket, ikke regelen.
 */

import type {
  NarrativeSceneDetail,
  NarrativeSceneReview,
  NarrativeSceneStatus,
  NarrativeSceneSummary,
  NarrativeSceneTask,
  NarrativeSceneTaskStatus,
} from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';

/** Speiler CHECK-en i 0621: 1–3 bokstaver + 1–4 sifre. */
export const SCENE_CODE_RE = /^[A-Za-z]{1,3}[0-9]{1,4}[A-Za-z]?$/;

export function normalizeSceneCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidSceneCode(raw: string): boolean {
  return SCENE_CODE_RE.test(normalizeSceneCode(raw));
}

/** Neste ledige «S{n}» (samme regel som serverens nextSceneCode). */
export function nextSceneCode(existingCodes: readonly string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = /^S(\d{1,4})$/i.exec(code.trim());
    if (m) max = Math.max(max, Number.parseInt(m[1], 10));
  }
  return `S${Math.min(max + 1, 9999)}`;
}

export function isDuplicateCode(raw: string, existingCodes: readonly string[], ignoreCode: string | null = null): boolean {
  const code = normalizeSceneCode(raw);
  if (!code) return false;
  return existingCodes.some((c) => normalizeSceneCode(c) === code && normalizeSceneCode(ignoreCode ?? '') !== code);
}

export const SCENE_STATUS_LABELS: Record<NarrativeSceneStatus, string> = {
  idea: 'Idé',
  in_progress: 'Under arbeid',
  in_review: 'Til review',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
  implemented: 'Implementert',
};

export const SCENE_STATUS_COLORS: Record<NarrativeSceneStatus, string> = {
  idea: '#6b7280',
  in_progress: '#60a5fa',
  in_review: narrativeColors.warning,
  changes_requested: narrativeColors.error,
  approved: narrativeColors.accent,
  implemented: '#a78bfa',
};

export const TASK_STATUS_LABELS: Record<NarrativeSceneTaskStatus, string> = {
  todo: 'Å gjøre',
  doing: 'Pågår',
  done: 'Ferdig',
};

export const REVIEW_STATUS_LABELS: Record<NarrativeSceneReview['status'], string> = {
  in_review: 'Til review',
  changes_requested: 'Endringer ønsket',
  approved: 'Godkjent',
  superseded: 'Erstattet av ny runde',
};

export function openReview(reviews: readonly NarrativeSceneReview[]): NarrativeSceneReview | null {
  return reviews.find((r) => r.status === 'in_review') ?? null;
}

/** Gjeldende runde har eldre hash enn scenen nå → beslutning ville gitt 409. */
export function snapshotIsStale(detail: Pick<NarrativeSceneDetail, 'reviews' | 'currentSnapshotHash'>): boolean {
  const open = openReview(detail.reviews);
  return !!open && open.snapshotHash !== detail.currentSnapshotHash;
}

/**
 * Kan «Be om review» trykkes? Ikke når en runde er åpen og uendret (da er
 * knappen støy); en ny runde er lov når den åpne er stale (klienten viser
 * «Send ny runde»).
 */
export function canRequestReview(detail: Pick<NarrativeSceneDetail, 'reviews' | 'currentSnapshotHash'>): { ok: boolean; reason: string | null } {
  const open = openReview(detail.reviews);
  if (!open) return { ok: true, reason: null };
  if (open.snapshotHash !== detail.currentSnapshotHash) return { ok: true, reason: null };
  return { ok: false, reason: `Runde ${open.round} er allerede åpen. Avgjør den, eller endre scenen for å sende en ny runde.` };
}

export function taskProgress(tasks: readonly Pick<NarrativeSceneTask, 'status'>[]): { total: number; done: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function isOverdue(dueAt: string | null, status?: NarrativeSceneStatus | NarrativeSceneTaskStatus, now = Date.now()): boolean {
  if (!dueAt) return false;
  if (status === 'done' || status === 'approved' || status === 'implemented') return false;
  const t = Date.parse(dueAt);
  return Number.isFinite(t) && t < now;
}

export interface SceneFilter {
  query?: string;
  status?: NarrativeSceneStatus | 'all';
  assigneeUserId?: string | null;
}

export function filterScenes(scenes: readonly NarrativeSceneSummary[], filter: SceneFilter): NarrativeSceneSummary[] {
  const q = (filter.query ?? '').trim().toLowerCase();
  return scenes.filter((s) => {
    if (filter.status && filter.status !== 'all' && s.status !== filter.status) return false;
    if (filter.assigneeUserId && s.assigneeUserId !== filter.assigneeUserId) return false;
    if (!q) return true;
    return [s.code, s.title, s.subtitle, s.location].some((v) => v.toLowerCase().includes(q));
  });
}

/** «S12 – Skogpassasjen» (uten tittel: bare koden). */
export function sceneLabel(scene: Pick<NarrativeSceneSummary, 'code' | 'title'>): string {
  return scene.title ? `${scene.code} – ${scene.title}` : scene.code;
}

/** Dato-input (yyyy-mm-dd) ⇄ ISO-tidsstempel ved midnatt lokal tid. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

/** Bilde-URL for en ramme: prosjekt-asset (via grafen) eller ekstern URL. */
export function frameImageUrl(
  frame: { assetId: string | null; externalUrl: string | null },
  assets: ReadonlyArray<{ id: string; externalUrl: string | null; kind: string }>,
): string | null {
  if (frame.externalUrl) return frame.externalUrl;
  if (frame.assetId) {
    const a = assets.find((x) => x.id === frame.assetId);
    return a?.kind === 'image' ? a.externalUrl : null;
  }
  return null;
}
