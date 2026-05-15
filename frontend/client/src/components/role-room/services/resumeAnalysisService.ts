/**
 * Resume analysis — cold-start pattern #6 from ai-prinsipper.md.
 *
 * Surfaces open threads to the writer when she re-opens a manuscript so she
 * doesn't have to hunt for where she was. MVP is deterministic — no AI calls.
 * Plot-level threads (e.g. "Anna hasn't told her sister yet") require scene-
 * text analysis and belong in a later phase.
 *
 * Principles applied:
 *  - Threads are framed as observations/questions, not instructions
 *  - Each thread carries an action the writer can ignore
 *  - Stale/cosmetic threads are filtered out so the banner stays signal-dense
 */

import type { Manuscript, SceneBreakdown } from '../models/casting';

export type ResumeThreadType =
  | 'last-edited'
  | 'empty-scaffold'
  | 'unscheduled'
  | 'stale-draft';

export interface ResumeThread {
  type: ResumeThreadType;
  message: string;
  /** Primær scene actionen åpner direkte (for last-edited/empty-scaffold). */
  sceneId?: string;
  sceneNumber?: number | string;
  count?: number;
  actionLabel: string;
  /**
   * Alle scenene threaden refererer til. Brukes av actionen til å markere
   * dem visuelt i scene-listen så brukeren faktisk ser hvilke scener det
   * gjelder (ikke bare den første).
   */
  sceneIds?: string[];
}

export interface ResumeAnalysis {
  manuscriptId: string;
  threads: ResumeThread[];
  generatedAt: string;
}

const STALE_DAYS = 14;
const RECENT_RESUME_DAYS = 7;

function daysSince(iso: string | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

function isEmptyScaffold(scene: SceneBreakdown): boolean {
  const meta = (scene.metadata ?? {}) as Record<string, unknown>;
  const hasScaffoldMarker = typeof meta.scaffoldTemplateId === 'string';
  if (!hasScaffoldMarker) return false;
  const heading = String(scene.sceneHeading ?? scene.heading ?? '').trim();
  const description = String(scene.description ?? '').trim();
  const locationName = String(scene.locationName ?? '').trim();
  return !heading && !description && !locationName;
}

export function analyzeManuscriptForResume(
  manuscript: Manuscript,
  scenes: SceneBreakdown[],
): ResumeAnalysis {
  const threads: ResumeThread[] = [];

  if (scenes.length > 0) {
    const mostRecent = [...scenes]
      .filter((scene) => scene.updatedAt)
      .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())[0];
    if (mostRecent && daysSince(mostRecent.updatedAt) <= RECENT_RESUME_DAYS) {
      const sceneLabel =
        String(mostRecent.sceneHeading ?? mostRecent.heading ?? '').trim() ||
        `Scene ${mostRecent.sceneNumber ?? '?'}`;
      threads.push({
        type: 'last-edited',
        message: `Sist jobbet på "${sceneLabel}"`,
        sceneId: mostRecent.id,
        sceneNumber: mostRecent.sceneNumber,
        actionLabel: 'Fortsett her',
      });
    }
  }

  const emptyScaffold = scenes.filter(isEmptyScaffold);
  if (emptyScaffold.length > 0) {
    const first = emptyScaffold[0];
    threads.push({
      type: 'empty-scaffold',
      message:
        emptyScaffold.length === 1
          ? `1 scene-slot fra strukturen er fortsatt tom`
          : `${emptyScaffold.length} scene-slot fra strukturen er fortsatt tomme`,
      sceneId: first.id,
      sceneNumber: first.sceneNumber,
      count: emptyScaffold.length,
      sceneIds: emptyScaffold.map((scene) => scene.id),
      actionLabel: 'Begynn på første',
    });
  }

  // Terskel 3+ for å unngå banner-spam ved smårester (1-2 uplanlagte scener
  // er normalt sluttspurt-arbeid, ikke en bortglemt batch).
  const unscheduled = scenes.filter(
    (scene) => scene.status === 'not-scheduled' && !isEmptyScaffold(scene),
  );
  if (unscheduled.length >= 3) {
    threads.push({
      type: 'unscheduled',
      message: `${unscheduled.length} scener er skrevet, men ikke planlagt enda`,
      count: unscheduled.length,
      sceneIds: unscheduled.map((scene) => scene.id),
      actionLabel: 'Åpne planlegging',
    });
  }

  const staleDrafts = scenes.filter((scene) => {
    if (scene.status === 'completed') return false;
    if (isEmptyScaffold(scene)) return false;
    return daysSince(scene.updatedAt) > STALE_DAYS;
  });
  // Skip "alle scener er stale" — da er hele manuskriptet bortglemt og
  // banneret blir støy heller enn signal.
  if (staleDrafts.length > 0 && staleDrafts.length < scenes.length) {
    threads.push({
      type: 'stale-draft',
      message:
        staleDrafts.length === 1
          ? `1 scene har ikke vært rørt på over to uker — bevisst valg?`
          : `${staleDrafts.length} scener har ikke vært rørt på over to uker — bevisst valg?`,
      count: staleDrafts.length,
      sceneIds: staleDrafts.map((scene) => scene.id),
      actionLabel: 'Se hvilke',
    });
  }

  return {
    manuscriptId: manuscript.id,
    threads,
    generatedAt: new Date().toISOString(),
  };
}

const DISMISS_KEY_PREFIX = 'roleroom.resume.dismissed.';

export function isResumeBannerDismissed(manuscriptId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(DISMISS_KEY_PREFIX + manuscriptId) === '1';
  } catch {
    return false;
  }
}

export function dismissResumeBanner(manuscriptId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(DISMISS_KEY_PREFIX + manuscriptId, '1');
  } catch {
    /* ignore quota / privacy mode */
  }
}
