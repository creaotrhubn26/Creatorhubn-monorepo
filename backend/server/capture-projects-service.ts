import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { projects, shotLists } from '../migrations/schema.js';
import { captureSessions } from '../migrations/capture-schema.js';

type Db = NodePgDatabase<Record<string, unknown>>;

/// Slim project view tailored to the iPad CaptureApp's project picker
/// and shot-list panel. We deliberately don't return the full
/// `projects.projectData` JSON (often hundreds of KB of memory-card
/// configs etc) — just the fields the iPad renders.
export interface CaptureProjectSummary {
  id: string;
  title: string;
  clientName: string | null;
  eventDate: string | null;
  location: string | null;
  projectType: string | null;
  status: string;
  shotListSummary: {
    listId: string | null;
    totalShots: number;
    completedShots: number;
    mustHaveShots: number;
    completedMustHave: number;
  } | null;
  showcaseSettings: Record<string, unknown> | null;
  updatedAt: string | null;
}

/// Full project + shot list returned by GET /api/capture/projects/:id.
/// Carries the actual shots[] array so the iPad's ShotListPanel can
/// render the planning surface without a second round-trip.
export interface CaptureProjectDetail extends CaptureProjectSummary {
  description: string | null;
  shotList: ShotListItem[];
}

export interface ShotListItem {
  id: string;
  scene: string;
  description?: string;
  estimatedDuration?: number;
  priority?: string;
  shotType?: string;
  locationName?: string;
  notes?: string;
  scouted?: boolean;
  isCompleted?: boolean;
  /// Optional — set when the iPad has linked this shot to a captured
  /// asset id (see Phase 2B Lag D follow-up — not yet implemented).
  capturedAssetId?: string | null;
  [key: string]: unknown;
}

/// List the projects this photographer owns. Returned in
/// most-recently-updated order so the iPad picker shows current work
/// first; lightweight summary so the list scrolls smoothly even with
/// hundreds of historical weddings.
export async function listProjectsForPhotographer(
  db: Db,
  ownerUserId: string,
  limit: number = 50,
): Promise<CaptureProjectSummary[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      title: projects.title,
      clientName: projects.clientName,
      eventDate: projects.eventDate,
      location: projects.location,
      projectType: projects.projectType,
      status: projects.status,
      settings: projects.settings,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, ownerUserId))
    .orderBy(desc(projects.updatedAt))
    .limit(limit);

  // Pull all shot list summaries for this photographer in one extra
  // query, keyed by projectId — saves N+1 round-trips when the
  // photographer has dozens of projects.
  const shotListRows = await db
    .select({
      projectId: shotLists.projectId,
      id: shotLists.id,
      totalShots: shotLists.totalShots,
      completedShots: shotLists.completedShots,
      mustHaveShots: shotLists.mustHaveShots,
      completedMustHave: shotLists.completedMustHave,
    })
    .from(shotLists)
    .where(eq(shotLists.userId, ownerUserId));
  const shotListByProject = new Map<string, typeof shotListRows[number]>();
  for (const sl of shotListRows) {
    if (sl.projectId) shotListByProject.set(sl.projectId, sl);
  }

  return rows.map((row) => {
    const settings = (row.settings ?? {}) as Record<string, unknown>;
    const sl = shotListByProject.get(row.id);
    return {
      id: row.id,
      title: (row.title || row.name || 'Untitled project').toString(),
      clientName: row.clientName ?? null,
      eventDate: row.eventDate ? String(row.eventDate) : null,
      location: row.location ?? null,
      projectType: row.projectType ?? null,
      status: row.status ?? 'active',
      shotListSummary: sl
        ? {
            listId: sl.id,
            totalShots: sl.totalShots ?? 0,
            completedShots: sl.completedShots ?? 0,
            mustHaveShots: sl.mustHaveShots ?? 0,
            completedMustHave: sl.completedMustHave ?? 0,
          }
        : null,
      showcaseSettings: (settings.showcaseSettings as Record<string, unknown> | undefined) ?? null,
      updatedAt: row.updatedAt ?? null,
    };
  });
}

/// Full project + shots[] for the iPad's session detail / shot-list
/// panel. Returns null when the project doesn't exist or doesn't belong
/// to the photographer.
export async function fetchProjectDetail(
  db: Db,
  ownerUserId: string,
  projectId: string,
): Promise<CaptureProjectDetail | null> {
  const owned = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, ownerUserId)))
    .limit(1);
  const row = owned[0];
  if (!row) return null;

  const slRow = await db
    .select()
    .from(shotLists)
    .where(and(eq(shotLists.userId, ownerUserId), eq(shotLists.projectId, projectId)))
    .limit(1);
  const shotList = slRow[0];
  const shots: ShotListItem[] = Array.isArray(shotList?.shots)
    ? (shotList!.shots as ShotListItem[])
    : [];

  const settings = (row.settings ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    title: (row.title || row.name || 'Untitled project').toString(),
    description: row.description ?? null,
    clientName: row.clientName ?? null,
    eventDate: row.eventDate ? String(row.eventDate) : null,
    location: row.location ?? null,
    projectType: row.projectType ?? null,
    status: row.status ?? 'active',
    shotListSummary: shotList
      ? {
          listId: shotList.id,
          totalShots: shotList.totalShots ?? 0,
          completedShots: shotList.completedShots ?? 0,
          mustHaveShots: shotList.mustHaveShots ?? 0,
          completedMustHave: shotList.completedMustHave ?? 0,
        }
      : null,
    showcaseSettings: (settings.showcaseSettings as Record<string, unknown> | undefined) ?? null,
    updatedAt: row.updatedAt ?? null,
    shotList: shots,
  };
}

export interface CreateMinimalProjectInput {
  ownerUserId: string;
  title: string;
  clientName?: string;
  eventDate?: string;     // ISO date YYYY-MM-DD
  location?: string;
  projectType?: string;   // e.g. 'wedding', 'portrait', 'event' — defaults 'photo_session'
}

/// Create the minimal project the iPad needs when the photographer picks
/// "simple photo session" instead of selecting an existing project. Goal
/// is to make the row exist + return its id quickly — the photographer
/// can flesh out the project later from the web dashboard.
export async function createMinimalProject(
  db: Db,
  input: CreateMinimalProjectInput,
): Promise<{ id: string; title: string; createdAt: string }> {
  const inserted = await db
    .insert(projects)
    .values({
      name: input.title,
      title: input.title,
      userId: input.ownerUserId,
      clientName: input.clientName ?? null,
      eventDate: input.eventDate ?? null,
      location: input.location ?? null,
      projectType: input.projectType ?? 'photo_session',
      status: 'active',
      // Mark the source so the dashboard can show a tiny "Created on
      // iPad" badge — helpful when the photographer wonders why a
      // sparse project showed up.
      projectData: { createdVia: 'ipad_capture' },
      settings: {},
    } as any)
    .returning({ id: projects.id, title: projects.title });
  const row = inserted[0];
  if (!row) throw new Error('project insert returned no row');
  return {
    id: row.id,
    title: (row.title ?? input.title).toString(),
    createdAt: new Date().toISOString(),
  };
}

/// Link an existing capture session to a project. Used by the iPad
/// after either selecting a project from the picker (link existing
/// session) or auto-creating a project on first shutter (link the
/// brand-new session).
export async function linkCaptureSessionToProject(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  projectId: string | null,
): Promise<{ ok: true } | { ok: false; error: 'session_not_found' | 'project_not_found' }> {
  // Verify the photographer owns BOTH the session and the project.
  // Otherwise an attacker with one but not the other could attribute
  // a session to a stranger's project.
  if (projectId) {
    const ownedProject = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, ownerUserId)))
      .limit(1);
    if (ownedProject.length === 0) return { ok: false, error: 'project_not_found' };
  }
  const updated = await db
    .update(captureSessions)
    .set({ projectId, updatedAt: new Date() })
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .returning({ id: captureSessions.id });
  if (updated.length === 0) return { ok: false, error: 'session_not_found' };
  return { ok: true };
}
