/**
 * Client-activity rendering for the project change-log.
 *
 * Mirrors the types + humanizer from `backend/server/project-change-log.ts`
 * so the web dashboard can show the same phrasing the iPad ChangeLogView
 * and email digests use. Kept as a local copy (not `@shared/`) because
 * moving the backend file would touch the insert path too — a bigger
 * refactor than this slice warrants.
 *
 * **Drift guard**: if the backend adds a new `ProjectChangeKind`, the
 * frontend must mirror the switch arm in `humanizeChangeLogEntry` OR
 * the UI will show `fallback()` for that kind. The test suite pins the
 * exact strings so a server-side rename fails the frontend build.
 */

export type ProjectChangeKind =
  | 'asset.hearted'
  | 'asset.commented'
  | 'quote.signed'
  | 'contract.signed';

export type ProjectChangeActorKind = 'client' | 'photographer';

export interface ProjectChangeLogEntry {
  id: string;
  projectId: string;
  kind: ProjectChangeKind;
  actorKind: ProjectChangeActorKind;
  actorLabel: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Human-readable one-line summary, Norwegian. Same phrasing the
 * backend produces for email digests so the two surfaces line up.
 */
export function humanizeChangeLogEntry(entry: {
  kind: ProjectChangeKind;
  actorKind: ProjectChangeActorKind;
  actorLabel: string | null;
  payload: Record<string, unknown>;
}): string {
  const actor = entry.actorLabel?.trim() || fallbackActor(entry.actorKind);
  switch (entry.kind) {
    case 'asset.hearted': {
      const hearted = Boolean(entry.payload?.hearted ?? true);
      return hearted
        ? `${actor} hjertet et bilde`
        : `${actor} fjernet hjerte fra et bilde`;
    }
    case 'asset.commented': {
      const preview =
        typeof entry.payload?.preview === 'string'
          ? (entry.payload.preview as string).trim()
          : '';
      return preview.length > 0
        ? `${actor} kommenterte: "${truncate(preview, 80)}"`
        : `${actor} la igjen en kommentar`;
    }
    case 'quote.signed':
      return `${actor} signerte tilbudet`;
    case 'contract.signed':
      return `${actor} signerte kontrakten`;
    default: {
      // Exhaustive fallback — new kinds added server-side render as
      // "Aktivitet" until the frontend mirrors them.
      const _never: never = entry.kind;
      void _never;
      return `${actor}: aktivitet`;
    }
  }
}

function fallbackActor(kind: ProjectChangeActorKind): string {
  return kind === 'client' ? 'Kunden' : 'Fotograf';
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Fetch the change log for a project. Paginated by `before` (cursor is
 * the `createdAt` timestamp of the oldest entry in the prior page).
 */
export async function fetchProjectChangeLog(
  projectId: string,
  opts: { limit?: number; before?: string | null } = {},
): Promise<ProjectChangeLogEntry[]> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', opts.before);
  const qs = params.toString();
  const url = `/api/projects/${encodeURIComponent(projectId)}/change-log${
    qs ? `?${qs}` : ''
  }`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `change-log fetch failed: ${response.status} ${response.statusText}`,
    );
  }
  const body = (await response.json()) as { entries?: ProjectChangeLogEntry[] };
  return body.entries ?? [];
}

/**
 * Filter the change log to only client-initiated events. That's usually
 * all a photographer wants to see — their own keystrokes are just noise
 * in the activity feed.
 */
export function clientOnly(
  entries: ProjectChangeLogEntry[],
): ProjectChangeLogEntry[] {
  return entries.filter((e) => e.actorKind === 'client');
}
