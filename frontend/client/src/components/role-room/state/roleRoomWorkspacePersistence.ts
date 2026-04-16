/**
 * Role Room mobile workspace persistence.
 *
 * Covers backlog items 041 (siste tre prosjekter quick switch) and
 * 042/366 (restore last workspace after refresh).
 *
 * All reads/writes are wrapped in try/catch so a broken storage quota or
 * private-mode browser never takes down the Role Room boot path.
 */

const RECENT_PROJECTS_KEY = 'role-room:mobile:recent-projects';
const LAST_WORKSPACE_KEY = 'role-room:mobile:last-workspace';
const MAX_RECENT_PROJECTS = 3;

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRecentProjects(): string[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = s.getItem(RECENT_PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_PROJECTS);
  } catch {
    return [];
  }
}

export function pushRecentProject(projectId: string): string[] {
  const s = storage();
  const current = readRecentProjects().filter((id) => id !== projectId);
  const next = [projectId, ...current].slice(0, MAX_RECENT_PROJECTS);
  if (s) {
    try {
      s.setItem(RECENT_PROJECTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }
  return next;
}

export interface LastWorkspace {
  projectId: string;
  subTab?: string;
  savedAt: number;
}

export function readLastWorkspace(): LastWorkspace | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(LAST_WORKSPACE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.projectId !== 'string') return null;
    return {
      projectId: parsed.projectId,
      subTab: typeof parsed.subTab === 'string' ? parsed.subTab : undefined,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveLastWorkspace(projectId: string, subTab?: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(
      LAST_WORKSPACE_KEY,
      JSON.stringify({ projectId, subTab, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota errors */
  }
}

export function clearLastWorkspace(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(LAST_WORKSPACE_KEY);
  } catch {
    /* ignore */
  }
}
