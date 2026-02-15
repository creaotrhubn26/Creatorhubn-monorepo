/**
 * Role Room Service — Frontend API Client
 * All requests go through /api/role-room/* and include x-api-key header
 */

import type {
  CastingProject,
  CastingRole,
  Candidate,
  CrewMember,
  Schedule,
  UserRole,
  ProjectSyncResult,
  ProjectSyncEntry,
  ApiKeyCreateResponse,
  RoleRoomHealthResponse,
  OnboardingRoleResult,
  MarketplaceInstallation,
} from '../../shared/role-room-types';

const BASE = '/api/role-room';

// ── API Key Storage ──────────────────────────────────────────

let cachedApiKey: string | null = null;

function getApiKey(): string {
  if (cachedApiKey) return cachedApiKey;
  const stored = localStorage.getItem('roleRoomApiKey');
  if (stored) {
    cachedApiKey = stored;
    return stored;
  }
  return '';
}

export function setApiKey(key: string): void {
  cachedApiKey = key;
  localStorage.setItem('roleRoomApiKey', key);
}

export function clearApiKey(): void {
  cachedApiKey = null;
  localStorage.removeItem('roleRoomApiKey');
}

// ── Fetch Wrapper ────────────────────────────────────────────

async function roleRoomFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      (body as Record<string, string>).error ?? `HTTP ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}

// ── Health & Connection ──────────────────────────────────────

export async function getHealth(): Promise<RoleRoomHealthResponse> {
  // Health endpoint doesn't require API key
  const res = await fetch(`${BASE}/health`);
  return res.json() as Promise<RoleRoomHealthResponse>;
}

export async function testConnection(): Promise<{
  status: string;
  userId: string;
  serverTime: string;
  message: string;
}> {
  return roleRoomFetch('/test-connection');
}

// ── API Keys ─────────────────────────────────────────────────

export async function createApiKey(
  name: string,
  userId: string,
  scopes?: string[],
  expiresInDays?: number
): Promise<ApiKeyCreateResponse> {
  const res = await fetch(`${BASE}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, userId, scopes, expiresInDays }),
  });
  if (!res.ok) throw new Error('Kunne ikke opprette API-nøkkel');
  return res.json() as Promise<ApiKeyCreateResponse>;
}

// ── Projects ─────────────────────────────────────────────────

export async function getProjects(): Promise<CastingProject[]> {
  return roleRoomFetch('/projects');
}

export async function getProject(id: string): Promise<CastingProject> {
  return roleRoomFetch(`/projects/${id}`);
}

export async function createProject(data: {
  name: string;
  description?: string;
  genre?: string;
  projectType?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency?: string;
  creatorhubProjectId?: string;
}): Promise<{ id: string; name: string; status: string; created_by: string }> {
  return roleRoomFetch('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProject(
  id: string,
  data: Partial<Pick<CastingProject, 'name' | 'description' | 'status' | 'genre' | 'project_type' | 'budget'>>
): Promise<{ success: boolean }> {
  return roleRoomFetch(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProject(id: string): Promise<{ success: boolean }> {
  return roleRoomFetch(`/projects/${id}`, { method: 'DELETE' });
}

// ── User Roles ───────────────────────────────────────────────

export async function getProjectRoles(projectId: string): Promise<UserRole[]> {
  return roleRoomFetch(`/projects/${projectId}/roles`);
}

export async function assignRole(
  projectId: string,
  data: { userId: string; email?: string; role: string; permissions?: Record<string, boolean> }
): Promise<{ success: boolean }> {
  return roleRoomFetch(`/projects/${projectId}/roles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeRole(
  projectId: string,
  userId: string
): Promise<{ success: boolean }> {
  return roleRoomFetch(`/projects/${projectId}/roles/${userId}`, {
    method: 'DELETE',
  });
}

// ── Casting Roles (characters) ───────────────────────────────

export async function getCastingRoles(projectId: string): Promise<CastingRole[]> {
  return roleRoomFetch(`/projects/${projectId}/casting-roles`);
}

export async function createCastingRole(
  projectId: string,
  data: { name: string; description?: string; ageRange?: string; gender?: string; roleType?: string; requirements?: Record<string, unknown> }
): Promise<{ id: string; name: string }> {
  return roleRoomFetch(`/projects/${projectId}/casting-roles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Candidates ───────────────────────────────────────────────

export async function getCandidates(projectId: string): Promise<Candidate[]> {
  return roleRoomFetch(`/projects/${projectId}/candidates`);
}

export async function addCandidate(
  projectId: string,
  data: { name: string; email?: string; phone?: string; agency?: string; notes?: string }
): Promise<{ id: string; name: string }> {
  return roleRoomFetch(`/projects/${projectId}/candidates`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Crew ─────────────────────────────────────────────────────

export async function getCrew(projectId: string): Promise<CrewMember[]> {
  return roleRoomFetch(`/projects/${projectId}/crew`);
}

export async function addCrewMember(
  projectId: string,
  data: { name: string; role: string; email?: string; phone?: string; department?: string; rate?: number }
): Promise<{ id: string; name: string }> {
  return roleRoomFetch(`/projects/${projectId}/crew`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Schedules ────────────────────────────────────────────────

export async function getSchedules(projectId: string): Promise<Schedule[]> {
  return roleRoomFetch(`/projects/${projectId}/schedules`);
}

export async function createSchedule(
  projectId: string,
  data: Record<string, unknown>
): Promise<{ id: string }> {
  return roleRoomFetch(`/projects/${projectId}/schedules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Project Sync ─────────────────────────────────────────────

export async function syncProject(data: {
  creatorhubProjectId: string;
  projectName: string;
  projectType?: string;
  description?: string;
  eventDate?: string;
  budget?: number;
  userId: string;
}): Promise<ProjectSyncResult> {
  return roleRoomFetch('/sync/project', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getSyncStatus(
  creatorhubProjectId: string
): Promise<ProjectSyncEntry[]> {
  return roleRoomFetch(`/sync/status/${creatorhubProjectId}`);
}

// ── Onboarding ───────────────────────────────────────────────

export async function registerOnboardingRole(data: {
  userId: string;
  email?: string;
  profession: string;
  role?: string;
}): Promise<OnboardingRoleResult> {
  return roleRoomFetch('/onboarding/register-role', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ── Marketplace ──────────────────────────────────────────────

export async function installApp(appId: string): Promise<{ success: boolean; appId: string; installed: boolean }> {
  return roleRoomFetch('/marketplace/install', {
    method: 'POST',
    body: JSON.stringify({ appId }),
  });
}

export async function getInstalledApps(): Promise<MarketplaceInstallation[]> {
  return roleRoomFetch('/marketplace/installed');
}

export async function uninstallApp(appId: string): Promise<{ success: boolean }> {
  return roleRoomFetch(`/marketplace/uninstall/${appId}`, { method: 'DELETE' });
}
