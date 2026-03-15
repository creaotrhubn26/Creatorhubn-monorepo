import type { 
  CastingProject, 
  Role, 
  Candidate, 
  Schedule,
  CrewMember,
  CrewAssignment,
  Location,
  Prop,
  ProductionDay,
  ShotList,
  CastingShot,
  SceneBreakdown,
  UserRole,
  Consent,
} from '../models/casting';
import type {
  LiveSetSession,
  LiveSetBatchIngestRequest,
  LiveSetBatchIngestResponse,
  LiveSetEventsSinceResponse,
  LiveSetAckResponse,
  LiveSetHealthResponse,
  WeatherAlertNormalized,
} from '../types/liveSetContracts';
import {
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  PRODUCER_DEMO_CLIENT_ADDRESS,
  PRODUCER_DEMO_CLIENT_COMPANY,
  PRODUCER_DEMO_CLIENT_EMAIL,
  PRODUCER_DEMO_CLIENT_NAME,
  PRODUCER_DEMO_CLIENT_ORGANIZATION_NUMBER,
  PRODUCER_DEMO_PRIMARY_LOCATION,
  PRODUCER_DEMO_PROJECT_DESCRIPTION,
  PRODUCER_DEMO_PROJECT_NAME,
  containsLegacyProducerDemoMarker,
} from '../constants/producerDemo';
import { sceneComposerService } from './sceneComposerService';
import settingsService, { getCurrentUserId } from './settingsService';

// Database availability cache
let dbAvailable: boolean | null = null;
let dbLastFailure: number = 0;
const DB_RETRY_INTERVAL = 60000; // Retry DB connection every 60 seconds
let dbCheckPromise: Promise<boolean> | null = null;

// Local storage fallback for projects
const PROJECTS_STORAGE_KEY = 'casting-projects';
let cachedProjects: CastingProject[] = [];
const TROLL_DEMO_PROJECT_ID = 'troll-project-2026';
const PROJECT_FETCH_CACHE_TTL_MS = 2000;
const inFlightProjectRequests = new Map<string, Promise<CastingProject | null>>();
const projectFetchCache = new Map<string, { project: CastingProject | null; cachedAt: number }>();

const invalidateProjectFetchCache = (projectId?: string): void => {
  if (projectId) {
    projectFetchCache.delete(projectId);
    inFlightProjectRequests.delete(projectId);
    return;
  }

  projectFetchCache.clear();
  inFlightProjectRequests.clear();
};

const hydrateProjects = async (): Promise<void> => {
  try {
    const userId = getCurrentUserId();
    const remote = await settingsService.getSetting<CastingProject[]>(PROJECTS_STORAGE_KEY, { userId });
    if (remote) {
      cachedProjects = remote;
      return;
    }
  } catch (error) {
    console.warn('Failed to hydrate projects:', error);
  }
};

// Guard: only hydrate when module is used in a browser context
let hydrationStarted = false;
function ensureHydrated(): void {
  if (!hydrationStarted) {
    hydrationStarted = true;
    void hydrateProjects();
  }
}

/**
 * Get projects from local storage fallback
 */
function getProjectsFromStorage(): CastingProject[] {
  ensureHydrated();
  return cachedProjects;
}

/**
 * Save projects to local storage fallback
 */
function saveProjectsToStorage(projects: CastingProject[]): void {
  cachedProjects = projects;
  void settingsService.setSetting(PROJECTS_STORAGE_KEY, projects, { userId: getCurrentUserId() });
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const readFirstNonEmptyString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const resolveCrewRole = (crewMember: CrewMember): string => {
  const source = asRecord(crewMember) ?? {};
  const nested = asRecord(source.crew_data) ?? asRecord(source.crewData);
  return (
    readFirstNonEmptyString(
      source.role,
      source.crewRole,
      source.crew_role,
      source.position,
      source.title,
      source.jobTitle,
      source.job_title,
      nested?.role,
      nested?.crewRole,
      nested?.position,
      nested?.title,
      source.department,
    ) || 'Crew-medlem'
  );
};

function normalizeCrewMember(crewMember: CrewMember): { member: CrewMember; changed: boolean } {
  const currentRole = readFirstNonEmptyString((crewMember as Record<string, unknown>).role);
  const nextRole = resolveCrewRole(crewMember);
  if (currentRole === nextRole) {
    return { member: crewMember, changed: false };
  }
  return {
    member: {
      ...(crewMember as Record<string, unknown>),
      role: nextRole,
    } as CrewMember,
    changed: true,
  };
}

function normalizeProject(project: CastingProject): { project: CastingProject; changed: boolean } {
  const sourceCrew = Array.isArray(project.crew) ? project.crew : [];
  const sourceUserRoles = Array.isArray((project as Record<string, unknown>).userRoles)
    ? ((project as Record<string, unknown>).userRoles as UserRole[])
    : [];
  let changed = !Array.isArray(project.crew);
  const normalizedCrew = sourceCrew.map((member) => {
    const normalized = normalizeCrewMember(member);
    if (normalized.changed) {
      changed = true;
    }
    return normalized.member;
  });

  const normalizedUserRoles = sourceUserRoles.map((role) => {
    const nextRole: UserRole = {
      ...role,
      projectId: role.projectId ?? role.project_id ?? project.id,
      userId: role.userId ?? role.user_id,
      createdAt: role.createdAt ?? role.created_at,
      updatedAt: role.updatedAt ?? role.updated_at,
    };
    if (
      nextRole.projectId !== role.projectId ||
      nextRole.userId !== role.userId ||
      nextRole.createdAt !== role.createdAt ||
      nextRole.updatedAt !== role.updatedAt
    ) {
      changed = true;
    }
    return nextRole;
  });
  if (!Array.isArray((project as Record<string, unknown>).userRoles)) {
    changed = true;
  }

  if (!changed) {
    return { project, changed: false };
  }

  return {
    project: {
      ...project,
      crew: normalizedCrew,
      userRoles: normalizedUserRoles,
    },
    changed: true,
  };
}

function normalizeProjects(projects: CastingProject[]): { projects: CastingProject[]; changed: boolean } {
  let changed = false;
  const normalized = projects.map((project) => {
    const next = normalizeProject(project);
    if (next.changed) {
      changed = true;
    }
    return next.project;
  });
  return { projects: normalized, changed };
}

function isTrollDemoProject(project: CastingProject): boolean {
  const projectId = String(project.id || '').trim().toLowerCase();
  const projectName = String(project.name || '').trim().toLowerCase();
  return projectId === TROLL_DEMO_PROJECT_ID || projectName === 'troll';
}

function isLegacyContentProducerDemoProject(project: CastingProject): boolean {
  const projectId = String(project.id || '').trim().toLowerCase();
  if (projectId !== CONTENT_PRODUCER_DEMO_PROJECT_ID) {
    return false;
  }

  const crewSummary = (project.crew || [])
    .map((member) => `${String(member.name || '')} ${String(member.role || '')}`)
    .join(' ');
  const roleSummary = (project.roles || [])
    .map((role) => `${String(role.name || '')} ${String(role.description || '')}`)
    .join(' ');

  return (
    containsLegacyProducerDemoMarker(
      project.name,
      project.description,
      String(project.clientName || ''),
      String(project.clientCompanyName || ''),
      crewSummary,
      roleSummary
    ) ||
    !String(project.clientName || '').trim() ||
    !String(project.clientCompanyName || '').trim()
  );
}

function producerDemoProjectNeedsUpgrade(project: CastingProject): boolean {
  if (isLegacyContentProducerDemoProject(project)) {
    return true;
  }

  const sceneBreakdowns = Array.isArray(project.sceneBreakdowns) ? project.sceneBreakdowns : [];
  const shotLists = Array.isArray(project.shotLists) ? project.shotLists : [];
  const productionDays = Array.isArray(project.productionDays) ? project.productionDays : [];

  return (
    String(project.name || '').trim() !== PRODUCER_DEMO_PROJECT_NAME ||
    !String(project.clientName || '').trim() ||
    !String(project.clientCompanyName || '').trim() ||
    sceneBreakdowns.length < 3 ||
    shotLists.length < 3 ||
    productionDays.length < 2
  );
}

function isTransientProjectFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('err_aborted')
  );
}

/**
 * Check if database is available
 */
async function checkDatabaseAvailability(): Promise<boolean> {
  // Reset dbAvailable if enough time has passed since last failure
  if (dbAvailable === false && Date.now() - dbLastFailure > DB_RETRY_INTERVAL) {
    dbAvailable = null;
  }

  if (dbAvailable !== null) {
    return dbAvailable;
  }
  
  if (dbCheckPromise) {
    return dbCheckPromise;
  }
  
  dbCheckPromise = (async () => {
    try {
      const response = await fetch('/api/casting/health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('Health check returned empty response');
      }

      const result = JSON.parse(responseText);
      dbAvailable = result.status === 'healthy';
      return dbAvailable;
    } catch (error) {
      console.error('Database not available:', error);
      dbAvailable = false;
      dbLastFailure = Date.now();
      return false;
    } finally {
      dbCheckPromise = null;
    }
  })();
  
  return dbCheckPromise;
}

/**
 * Get projects from database with fallback to storage
 */
async function getProjectsFromDb(): Promise<CastingProject[]> {
  // Get local storage data first
  const normalizedLocal = normalizeProjects(getProjectsFromStorage());
  const localProjects = normalizedLocal.projects;
  if (normalizedLocal.changed) {
    saveProjectsToStorage(localProjects);
  }

  const dbOk = await checkDatabaseAvailability();
  if (!dbOk) {
    console.warn('🎬 Database unavailable, using local projects');
    return localProjects;
  }
  
  try {
    const response = await fetch('/api/casting/projects');
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }
    const data = await response.json();
    const dbProjectsRaw = Array.isArray(data) ? data : data.projects || [];
    const normalizedDb = normalizeProjects(dbProjectsRaw);
    const dbProjects = normalizedDb.projects;
    
    // Only use DB projects if they have richer data than local
    // This prevents overwriting mock data with empty DB data
    if (dbProjects.length > 0) {
      // Check both arrays and counts (API may return counts instead of full arrays)
      const dbHasData = dbProjects.some((p: any) => 
        (p.candidates?.length > 0) || 
        (p.roles?.length > 0) || 
        (p.crew?.length > 0) ||
        (p.candidatesCount > 0) ||
        (p.rolesCount > 0) ||
        (p.crewCount > 0)
      );
      
      const localHasData = localProjects.some(p => 
        (p.candidates?.length > 0) || 
        (p.roles?.length > 0) || 
        (p.crew?.length > 0) ||
        ((p.candidatesCount ?? 0) > 0) ||
        ((p.rolesCount ?? 0) > 0) ||
        ((p.crewCount ?? 0) > 0)
      );
      
      // Only overwrite local if DB actually has richer data, or if local is empty and DB has data
      if (dbHasData) {
        saveProjectsToStorage(dbProjects); // Cache to storage
        return dbProjects;
      }
      
      // If local has data but DB doesn't, keep local data
      if (localHasData) {
        return localProjects;
      }
      
      // Both are empty, prefer DB
      saveProjectsToStorage(dbProjects);
      return dbProjects;
    }
    
    // Return local data if it's richer
    return localProjects;
  } catch (error) {
    if (isTransientProjectFetchError(error)) {
      console.warn('Project fetch interrupted, using local projects');
    } else {
      console.error('Error fetching projects from database:', error);
    }
    // Fall back to local storage
    return localProjects;
  }
}

/**
 * Save project to database with fallback to storage
 */
async function saveProjectToDb(project: CastingProject): Promise<void> {
  const normalizedProject = normalizeProject(project);
  if (normalizedProject.changed) {
    project = normalizedProject.project;
  }

  invalidateProjectFetchCache(project.id);

  // Always save to storage first
  const projects = getProjectsFromStorage();
  const existingIndex = projects.findIndex(p => p.id === project.id);
  
  if (existingIndex >= 0) {
    projects[existingIndex] = project;
  } else {
    projects.push(project);
  }
  saveProjectsToStorage(projects);
  
  // Try to sync with database
  try {
    const response = await fetch('/api/casting/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to save project: ${response.statusText}`);
    }
  } catch (error) {
    console.warn('Failed to save project to database, using local storage:', error);
    // Not throwing - user can continue working offline
  }
}

/**
 * Delete project from database with fallback to storage
 */
async function deleteProjectFromDb(id: string): Promise<void> {
  invalidateProjectFetchCache(id);

  // Remove from storage first
  let projects = getProjectsFromStorage();
  projects = projects.filter(p => p.id !== id);
  saveProjectsToStorage(projects);
  
  // Try to sync with database
  try {
    const response = await fetch(`/api/casting/projects/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
  } catch (error) {
    console.warn('Failed to delete project from database, using local storage:', error);
    // Not throwing - user can continue working offline
  }
}

export const castingService = {
  getTrollDemoProjectId(): string {
    return TROLL_DEMO_PROJECT_ID;
  },

  getContentProducerDemoProjectId(): string {
    return CONTENT_PRODUCER_DEMO_PROJECT_ID;
  },

  isTrollDemoProject(project: CastingProject): boolean {
    return isTrollDemoProject(project);
  },

  /**
   * Get all projects from database or storage
   */
  async getProjects(): Promise<CastingProject[]> {
    try {
      invalidateProjectFetchCache();
      return await getProjectsFromDb();
    } catch (error) {
      console.error('Database fetch failed, falling back to storage:', error);
      // Return projects from local storage even if database is unavailable
      return getProjectsFromStorage();
    }
  },

  /**
   * Get project by ID from database or storage
   */
  async getProject(id: string): Promise<CastingProject | null> {
    // Check local storage first
    const normalizedLocal = normalizeProjects(getProjectsFromStorage());
    const localProjects = normalizedLocal.projects;
    if (normalizedLocal.changed) {
      saveProjectsToStorage(localProjects);
    }
    const localProject = localProjects.find(p => p.id === id);

    const cached = projectFetchCache.get(id);
    if (cached && Date.now() - cached.cachedAt < PROJECT_FETCH_CACHE_TTL_MS) {
      return cached.project;
    }

    const existingRequest = inFlightProjectRequests.get(id);
    if (existingRequest) {
      return existingRequest;
    }

    const request = (async (): Promise<CastingProject | null> => {
      try {
        const response = await fetch(`/api/casting/projects/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            const fallbackProject = localProject || null;
            projectFetchCache.set(id, { project: fallbackProject, cachedAt: Date.now() });
            return fallbackProject;
          }
          throw new Error(`Failed to fetch project: ${response.statusText}`);
        }
        const dbProjectRaw = await response.json();
        const normalizedDbProject = dbProjectRaw
          ? normalizeProject(dbProjectRaw as CastingProject)
          : { project: null as CastingProject | null, changed: false };
        const dbProject = normalizedDbProject.project;

        const dbHasData = (dbProject?.candidates?.length ?? 0) > 0 ||
                          (dbProject?.roles?.length ?? 0) > 0 ||
                          (dbProject?.crew?.length ?? 0) > 0 ||
                          (dbProject?.candidatesCount ?? 0) > 0 ||
                          (dbProject?.rolesCount ?? 0) > 0 ||
                          (dbProject?.crewCount ?? 0) > 0;
        const localHasData = (localProject?.candidates?.length ?? 0) > 0 ||
                             (localProject?.roles?.length ?? 0) > 0 ||
                             (localProject?.crew?.length ?? 0) > 0 ||
                             ((localProject?.candidatesCount ?? 0) > 0) ||
                             ((localProject?.rolesCount ?? 0) > 0) ||
                             ((localProject?.crewCount ?? 0) > 0);

        const preferredProject = localHasData && !dbHasData
          ? localProject ?? null
          : dbProject ?? null;

        if (dbProject && normalizedDbProject.changed) {
          const mergedProjects = localProjects
            .filter(project => project.id !== dbProject.id)
            .concat(dbProject);
          saveProjectsToStorage(mergedProjects);
        }

        projectFetchCache.set(id, { project: preferredProject, cachedAt: Date.now() });
        return preferredProject;
      } catch (_error) {
        const fallbackProject = localProject || null;
        projectFetchCache.set(id, { project: fallbackProject, cachedAt: Date.now() });
        return fallbackProject;
      } finally {
        inFlightProjectRequests.delete(id);
      }
    })();

    inFlightProjectRequests.set(id, request);
    return request;
  },

  /**
   * Save project (create or update) to database or storage
   */
  async saveProject(project: CastingProject): Promise<void> {
    // Update timestamp
    project = { ...project, updatedAt: new Date().toISOString() };
    
    try {
      await saveProjectToDb(project);
    } catch (error) {
      console.warn('Database save failed, using local storage:', error);
      // Still save to storage as fallback
      const projects = getProjectsFromStorage();
      const existingIndex = projects.findIndex(p => p.id === project.id);
      if (existingIndex >= 0) {
        projects[existingIndex] = project;
      } else {
        projects.push(project);
      }
      saveProjectsToStorage(projects);
    }
  },

  /**
   * Delete project from database or storage
   */
  async deleteProject(id: string): Promise<void> {
    try {
      await deleteProjectFromDb(id);
    } catch (error) {
      console.warn('Database delete failed, using local storage:', error);
      // Still delete from storage as fallback
      let projects = getProjectsFromStorage();
      projects = projects.filter(p => p.id !== id);
      saveProjectsToStorage(projects);
    }
  },

  /**
   * Get roles for a project
   */
  async getRoles(projectId: string): Promise<Role[]> {
    const project = await this.getProject(projectId);
    return project?.roles || [];
  },

  /**
   * Save role to project
   */
  async saveRole(projectId: string, role: Role): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const index = project.roles.findIndex(r => r.id === role.id);
    if (index >= 0) {
      project.roles[index] = role;
    } else {
      project.roles.push(role);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete role from project
   */
  async deleteRole(projectId: string, roleId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.roles = project.roles.filter(r => r.id !== roleId);
    await this.saveProject(project);
  },

  /**
   * Get candidates for a project
   */
  async getCandidates(projectId: string): Promise<Candidate[]> {
    const project = await this.getProject(projectId);
    return project?.candidates || [];
  },

  /**
   * Save candidate to project
   */
  async saveCandidate(projectId: string, candidate: Candidate): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const index = project.candidates.findIndex(c => c.id === candidate.id);
    if (index >= 0) {
      project.candidates[index] = { ...candidate, updatedAt: new Date().toISOString() };
    } else {
      project.candidates.push(candidate);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete candidate from project
   */
  async deleteCandidate(projectId: string, candidateId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.candidates = project.candidates.filter(c => c.id !== candidateId);
    await this.saveProject(project);
  },

  /**
   * Get schedules for a project
   */
  async getSchedules(projectId: string): Promise<Schedule[]> {
    const project = await this.getProject(projectId);
    return project?.schedules || [];
  },

  /**
   * Save schedule to project
   */
  async saveSchedule(projectId: string, schedule: Schedule): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const index = project.schedules.findIndex(s => s.id === schedule.id);
    if (index >= 0) {
      project.schedules[index] = schedule;
    } else {
      project.schedules.push(schedule);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete schedule from project
   */
  async deleteSchedule(projectId: string, scheduleId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.schedules = project.schedules.filter(s => s.id !== scheduleId);
    await this.saveProject(project);
  },

  /**
   * Link role to Scene Composer scene
   */
  async linkRoleToScene(projectId: string, roleId: string, sceneId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const role = project.roles.find(r => r.id === roleId);
    if (role) {
      if (!role.sceneIds) {
        role.sceneIds = [];
      }
      if (!role.sceneIds.includes(sceneId)) {
        role.sceneIds.push(sceneId);
      }
      await this.saveRole(projectId, role);
    }
  },

  /**
   * Get scenes for a role
   */
  async getScenesForRole(projectId: string, roleId: string): Promise<string[]> {
    const roles = await this.getRoles(projectId);
    const role = roles.find(r => r.id === roleId);
    return role?.sceneIds || [];
  },

  /**
   * Get available scenes from Scene Composer
   */
  getAvailableScenes(): Array<{ id: string; name: string; thumbnail?: string }> {
    try {
      const scenes = sceneComposerService.getAllScenes();
      return scenes.map(scene => ({
        id: scene.id,
        name: scene.name,
        thumbnail: scene.thumbnail,
      }));
    } catch (error) {
      console.error('Error getting scenes from Scene Composer:', error);
      return [];
    }
  },

  /**
   * Sync with Scene Composer (validate scene IDs)
   */
  async syncWithSceneComposer(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const availableScenes = this.getAvailableScenes();
    const availableSceneIds = new Set(availableScenes.map(s => s.id));
    
    // Remove invalid scene references
    project.roles.forEach(role => {
      if (role.sceneIds) {
        role.sceneIds = role.sceneIds.filter(id => availableSceneIds.has(id));
      }
    });
    
    project.schedules.forEach(schedule => {
      if (schedule.sceneId && !availableSceneIds.has(schedule.sceneId)) {
        schedule.sceneId = undefined;
      }
    });
    
    // Sync production days
    project.productionDays?.forEach(day => {
      day.scenes = day.scenes.filter(id => availableSceneIds.has(id));
    });
    
    // Sync crew assigned scenes
    project.crew?.forEach(crew => {
      crew.assignedScenes = crew.assignedScenes.filter(id => availableSceneIds.has(id));
    });
    
    // Sync location assigned scenes
    project.locations?.forEach(location => {
      location.assignedScenes = location.assignedScenes.filter(id => availableSceneIds.has(id));
    });
    
    // Sync prop assigned scenes
    project.props?.forEach(prop => {
      prop.assignedScenes = prop.assignedScenes.filter(id => availableSceneIds.has(id));
    });
    
    // Sync shot lists
    project.shotLists?.forEach(shotList => {
      if (!availableSceneIds.has(shotList.sceneId)) {
        // Remove shot list if scene is invalid
        project.shotLists = project.shotLists?.filter(sl => sl.id !== shotList.id) || [];
      }
    });
    
    await this.saveProject(project);
  },

  // ============================================================================
  // Crew Management
  // ============================================================================

  /**
   * Get crew members for a project
   */
  async getCrew(projectId: string): Promise<CrewMember[]> {
    const project = await this.getProject(projectId);
    // Ensure crew is always an array
    if (!project) return [];
    if (!project.crew) return [];
    return Array.isArray(project.crew) ? project.crew : [];
  },

  /**
   * Save crew member to project
   */
  async saveCrew(projectId: string, crew: CrewMember): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.crew) {
      project.crew = [];
    }
    
    const index = project.crew.findIndex(c => c.id === crew.id);
    if (index >= 0) {
      project.crew[index] = { ...crew, updatedAt: new Date().toISOString() };
    } else {
      project.crew.push(crew);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete crew member from project
   */
  async deleteCrew(projectId: string, crewId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.crew = (project.crew || []).filter(c => c.id !== crewId);
    await this.saveProject(project);
  },

  // ============================================================================
  // Crew Assignment Management (DOOD / Shoot-Day scheduling)
  // Persisted per-project in localStorage via settingsService
  // ============================================================================

  /**
   * Get all crew assignments for a project
   */
  async getCrewAssignments(projectId: string): Promise<CrewAssignment[]> {
    try {
      const key = `crew-assignments-${projectId}`;
      const userId = getCurrentUserId();
      const stored = await settingsService.getSetting<CrewAssignment[]>(key, { userId });
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  },

  /**
   * Save (upsert) a single crew assignment
   */
  async saveCrewAssignment(projectId: string, assignment: CrewAssignment): Promise<void> {
    const key = `crew-assignments-${projectId}`;
    const userId = getCurrentUserId();
    const existing = await this.getCrewAssignments(projectId);
    const updated = [
      ...existing.filter(
        a => !(a.crewMemberId === assignment.crewMemberId && a.shootDayId === assignment.shootDayId)
      ),
      assignment,
    ];
    await settingsService.setSetting(key, updated, { userId });
  },

  /**
   * Delete a crew assignment for a specific member + day
   */
  async deleteCrewAssignment(projectId: string, crewMemberId: string, dayId: string): Promise<void> {
    const key = `crew-assignments-${projectId}`;
    const userId = getCurrentUserId();
    const existing = await this.getCrewAssignments(projectId);
    const updated = existing.filter(
      a => !(a.crewMemberId === crewMemberId && a.shootDayId === dayId)
    );
    await settingsService.setSetting(key, updated, { userId });
  },

  // ============================================================================
  // Location Management
  // ============================================================================

  /**
   * Get locations for a project
   */
  async getLocations(projectId: string): Promise<Location[]> {
    const project = await this.getProject(projectId);
    return project?.locations || [];
  },

  /**
   * Save location to project
   */
  async saveLocation(projectId: string, location: Location): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.locations) {
      project.locations = [];
    }
    
    const index = project.locations.findIndex(l => l.id === location.id);
    if (index >= 0) {
      project.locations[index] = { ...location, updatedAt: new Date().toISOString() };
    } else {
      project.locations.push(location);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete location from project
   */
  async deleteLocation(projectId: string, locationId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.locations = (project.locations || []).filter(l => l.id !== locationId);
    await this.saveProject(project);
  },

  // ============================================================================
  // Prop Management
  // ============================================================================

  /**
   * Get props for a project
   */
  async getProps(projectId: string): Promise<Prop[]> {
    const project = await this.getProject(projectId);
    return project?.props || [];
  },

  /**
   * Save prop to project
   */
  async saveProp(projectId: string, prop: Prop): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.props) {
      project.props = [];
    }
    
    const index = project.props.findIndex(p => p.id === prop.id);
    if (index >= 0) {
      project.props[index] = { ...prop, updatedAt: new Date().toISOString() };
    } else {
      project.props.push(prop);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete prop from project
   */
  async deleteProp(projectId: string, propId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.props = (project.props || []).filter(p => p.id !== propId);
    await this.saveProject(project);
  },

  // ============================================================================
  // Production Day Management
  // ============================================================================

  /**
   * Get production days for a project
   */
  async getProductionDays(projectId: string): Promise<ProductionDay[]> {
    const project = await this.getProject(projectId);
    return project?.productionDays || [];
  },

  /**
   * Save production day to project
   */
  async saveProductionDay(projectId: string, productionDay: ProductionDay): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.productionDays) {
      project.productionDays = [];
    }
    
    const index = project.productionDays.findIndex(pd => pd.id === productionDay.id);
    if (index >= 0) {
      project.productionDays[index] = { ...productionDay, updatedAt: new Date().toISOString() };
    } else {
      project.productionDays.push(productionDay);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete production day from project
   */
  async deleteProductionDay(projectId: string, productionDayId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.productionDays = (project.productionDays || []).filter(pd => pd.id !== productionDayId);
    await this.saveProject(project);
  },

  // ============================================================================
  // Shot List Management
  // ============================================================================

  /**
   * Get shot lists for a project from database
   */
  async getShotLists(projectId: string): Promise<ShotList[]> {
    try {
      // Try to fetch from database API first
      const response = await fetch(`/api/casting/projects/${projectId}/shot-lists`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.shotLists) {
          return data.shotLists;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch shot lists from API, falling back to local data:', error);
    }
    // Fallback to local project data
    const project = await this.getProject(projectId);
    return project?.shotLists || [];
  },

  /**
   * Get shot list by scene ID
   */
  async getShotListByScene(projectId: string, sceneId: string): Promise<ShotList | null> {
    const shotLists = await this.getShotLists(projectId);
    return shotLists.find(sl => sl.sceneId === sceneId) || null;
  },

  /**
   * Save shot list to project and database
   */
  async saveShotList(projectId: string, shotList: ShotList): Promise<void> {
    try {
      // Save to database API
      const response = await fetch(`/api/casting/projects/${projectId}/shot-lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shotList)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to save shot list to API, saving locally:', error);
    }
    
    // Fallback: save locally
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.shotLists) {
      project.shotLists = [];
    }
    
    const index = project.shotLists.findIndex(sl => sl.id === shotList.id);
    if (index >= 0) {
      project.shotLists[index] = { ...shotList, updatedAt: new Date().toISOString() };
    } else {
      project.shotLists.push(shotList);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete shot list from project and database
   */
  async deleteShotList(projectId: string, shotListId: string): Promise<void> {
    try {
      // Delete from database API
      const response = await fetch(`/api/casting/projects/${projectId}/shot-lists/${shotListId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to delete shot list from API, deleting locally:', error);
    }
    
    // Fallback: delete locally
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.shotLists = (project.shotLists || []).filter(sl => sl.id !== shotListId);
    await this.saveProject(project);
  },

  /** Alias: create a new shot list (delegates to saveShotList). */
  async addShotList(projectId: string, shotList: ShotList): Promise<void> {
    return this.saveShotList(projectId, shotList);
  },

  /** Alias: update an existing shot list by merging a partial payload. */
  async updateShotList(projectId: string, shotListId: string, patch: Partial<ShotList>): Promise<void> {
    const lists = await this.getShotLists(projectId);
    const existing = lists.find(l => l.id === shotListId);
    if (!existing) throw new Error(`Shot list ${shotListId} not found`);
    const merged: ShotList = { ...existing, ...patch, id: shotListId, updatedAt: new Date().toISOString() };
    return this.saveShotList(projectId, merged);
  },

  /**
   * Persist a new display order for shot lists.
   * If the API does not support this yet the call is a no-op (gracefully ignored).
   */
  async reorderShotLists(projectId: string, orderedIds: string[]): Promise<void> {
    try {
      const response = await fetch(`/api/casting/projects/${projectId}/shot-lists/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedIds }),
      });
      if (response.ok) return;
    } catch {
      // Non-fatal — reorder is best-effort
    }
    // Locally reorder the project's shotLists array
    const project = await this.getProject(projectId);
    if (!project?.shotLists) return;
    const map = new Map(project.shotLists.map(l => [l.id, l]));
    const reordered = orderedIds.map(id => map.get(id)).filter(Boolean) as ShotList[];
    const rest = project.shotLists.filter(l => !orderedIds.includes(l.id));
    project.shotLists = [...reordered, ...rest];
    await this.saveProject(project);
  },

  // ============================================================================
  // Live Set Sync (session + event stream)
  // ============================================================================

  async startLiveSetSession(
    projectId: string,
    payload: {
      sessionId?: string;
      operatorId: string;
      deviceId: string;
      shootingDayId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<LiveSetSession> {
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to start live set session: ${response.status}`);
    }
    const data = await response.json() as { success?: boolean; session?: LiveSetSession };
    if (!data?.success || !data?.session) {
      throw new Error('Live set session response missing session payload');
    }
    return data.session;
  },

  async batchIngestLiveSetEvents(
    projectId: string,
    payload: LiveSetBatchIngestRequest,
  ): Promise<LiveSetBatchIngestResponse> {
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/events/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to sync live set events: ${response.status}`);
    }
    const data = await response.json() as LiveSetBatchIngestResponse;
    return {
      success: Boolean(data?.success),
      ackedEventIds: Array.isArray(data?.ackedEventIds) ? data.ackedEventIds : [],
      rejected: Array.isArray(data?.rejected) ? data.rejected : [],
      conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [],
      serverTime: typeof data?.serverTime === 'string' ? data.serverTime : new Date().toISOString(),
    };
  },

  async getLiveSetEventsSince(projectId: string, since?: string): Promise<LiveSetEventsSinceResponse> {
    const query = new URLSearchParams();
    if (since) query.set('since', since);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/events${suffix}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch live set events: ${response.status}`);
    }
    const data = await response.json() as LiveSetEventsSinceResponse;
    return {
      success: Boolean(data?.success),
      events: Array.isArray(data?.events) ? data.events : [],
      conflicts: Array.isArray(data?.conflicts) ? data.conflicts : [],
      serverCursor: typeof data?.serverCursor === 'string' ? data.serverCursor : undefined,
    };
  },

  async ackLiveSetEvents(
    projectId: string,
    payload: { sessionId: string; eventIds: string[] },
  ): Promise<LiveSetAckResponse> {
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/sync/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Failed to acknowledge live set events: ${response.status}`);
    }
    const data = await response.json() as LiveSetAckResponse;
    return {
      success: Boolean(data?.success),
      ackedEventIds: Array.isArray(data?.ackedEventIds) ? data.ackedEventIds : [],
      unknownEventIds: Array.isArray(data?.unknownEventIds) ? data.unknownEventIds : [],
    };
  },

  async getLiveSetHealth(projectId: string): Promise<LiveSetHealthResponse> {
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/health`);
    if (!response.ok) {
      throw new Error(`Failed to fetch live set health: ${response.status}`);
    }
    const data = await response.json() as LiveSetHealthResponse;
    return {
      success: Boolean(data?.success),
      status: data?.status ?? 'degraded',
      dependencies: data?.dependencies ?? {
        db: 'degraded',
        weatherUpstream: 'degraded',
        websocket: 'degraded',
      },
      timestamp: data?.timestamp ?? new Date().toISOString(),
    };
  },

  async getLiveSetWeather(
    projectId: string,
    payload: { location?: string; lat?: number; lon?: number },
  ): Promise<{
    success: boolean;
    current: {
      location?: string;
      temperature?: number;
      precipitation?: number;
      windSpeed?: number;
      symbolCode?: string;
      source?: string;
      timestamp?: string;
      cache?: { hit: boolean; ttlMs: number };
    };
    alerts: WeatherAlertNormalized[];
  }> {
    const query = new URLSearchParams();
    if (typeof payload.location === 'string' && payload.location.trim()) {
      query.set('location', payload.location.trim());
    }
    if (typeof payload.lat === 'number' && Number.isFinite(payload.lat)) {
      query.set('lat', payload.lat.toString());
    }
    if (typeof payload.lon === 'number' && Number.isFinite(payload.lon)) {
      query.set('lon', payload.lon.toString());
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const response = await fetch(`/api/role-room/projects/${projectId}/live-set/weather${suffix}`);
    let data: {
      success?: boolean;
      current?: Record<string, unknown>;
      alerts?: WeatherAlertNormalized[];
      cache?: { hit?: boolean; ttlMs?: number };
    } | null = null;

    if (!response.ok && response.status === 404) {
      // Local/demo projects may not exist in backend DB yet.
      // Fallback to generic weather endpoint to keep Live Set operational.
      const location = typeof payload.location === 'string' && payload.location.trim()
        ? payload.location.trim().toLowerCase()
        : 'oslo';
      const fallbackSuffix = query.toString() ? `?${query.toString()}` : '';
      const fallbackResponse = await fetch(`/api/price-administration/weather/current/${encodeURIComponent(location)}${fallbackSuffix}`);
      if (fallbackResponse.ok) {
        const fallback = await fallbackResponse.json() as Record<string, unknown>;
        data = {
          success: true,
          current: {
            location: typeof fallback.location === 'string' ? fallback.location : payload.location,
            temperature: typeof fallback.temperature === 'number' ? fallback.temperature : undefined,
            precipitation: typeof fallback.precipitation === 'number' ? fallback.precipitation : 0,
            windSpeed: typeof fallback.windSpeed === 'number' ? fallback.windSpeed : 0,
            symbolCode: typeof fallback.symbolCode === 'string' ? fallback.symbolCode : undefined,
            source: typeof fallback.source === 'string' ? fallback.source : 'yr_api',
            timestamp: typeof fallback.timestamp === 'string' ? fallback.timestamp : new Date().toISOString(),
          },
          alerts: [],
          cache: { hit: false, ttlMs: 0 },
        };
      } else {
        throw new Error(`Failed to fetch live set weather: ${response.status}`);
      }
    } else if (!response.ok) {
      throw new Error(`Failed to fetch live set weather: ${response.status}`);
    } else {
      data = await response.json() as {
        success?: boolean;
        current?: Record<string, unknown>;
        alerts?: WeatherAlertNormalized[];
        cache?: { hit?: boolean; ttlMs?: number };
      };
    }

    const current = (data?.current ?? {}) as Record<string, unknown>;
    const cache = data?.cache;
    return {
      success: Boolean(data?.success),
      current: {
        location: typeof current.location === 'string' ? current.location : undefined,
        temperature: typeof current.temperature === 'number' ? current.temperature : undefined,
        precipitation: typeof current.precipitation === 'number' ? current.precipitation : undefined,
        windSpeed: typeof current.windSpeed === 'number' ? current.windSpeed : undefined,
        symbolCode: typeof current.symbolCode === 'string' ? current.symbolCode : undefined,
        source: typeof current.source === 'string' ? current.source : undefined,
        timestamp: typeof current.timestamp === 'string' ? current.timestamp : undefined,
        cache: {
          hit: Boolean(cache?.hit),
          ttlMs: typeof cache?.ttlMs === 'number' ? cache.ttlMs : 0,
        },
      },
      alerts: Array.isArray(data?.alerts) ? data.alerts : [],
    };
  },

  // ============================================================================
  // Team Dashboard Snapshots
  // ============================================================================

  /**
   * Get saved team dashboard snapshots for a project.
   * Falls back to user settings storage if API is unavailable.
   */
  async getTeamDashboardSnapshots<T extends object = Record<string, unknown>>(projectId: string): Promise<T[]> {
    const fallbackKey = `team-dashboard-snapshots-${projectId}`;
    const userId = getCurrentUserId();

    try {
      const response = await fetch(`/api/casting/projects/${projectId}/team-dashboard/snapshots`);
      if (response.ok) {
        const data = await response.json();
        const snapshots = Array.isArray(data?.snapshots) ? data.snapshots : [];
        await settingsService.setSetting(fallbackKey, snapshots, { userId });
        return snapshots as T[];
      }
    } catch (error) {
      console.warn('Failed to fetch team dashboard snapshots from API, using local fallback:', error);
    }

    const local = await settingsService.getSetting<Array<T>>(fallbackKey, { userId });
    return Array.isArray(local) ? local : [];
  },

  /**
   * Save a team dashboard snapshot.
   * Attempts API first, then writes to local user settings as fallback.
   */
  async saveTeamDashboardSnapshot<T extends object = Record<string, unknown>>(projectId: string, snapshot: T): Promise<T> {
    const fallbackKey = `team-dashboard-snapshots-${projectId}`;
    const userId = getCurrentUserId();
    const payload = {
      ...(snapshot as Record<string, unknown>),
      id:
        typeof (snapshot as Record<string, unknown>).id === 'string'
          ? (snapshot as Record<string, unknown>).id
          : `snapshot-${Date.now()}`,
      projectId,
      createdAt:
        typeof (snapshot as Record<string, unknown>).createdAt === 'string'
          ? (snapshot as Record<string, unknown>).createdAt
          : new Date().toISOString(),
    };

    try {
      const response = await fetch(`/api/casting/projects/${projectId}/team-dashboard/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        const saved = (data?.snapshot ?? payload) as T;
        return saved;
      }
    } catch (error) {
      console.warn('Failed to save team dashboard snapshot to API, using local fallback:', error);
    }

    const existing = await settingsService.getSetting<Array<Record<string, unknown>>>(fallbackKey, { userId });
    const snapshots = Array.isArray(existing) ? [...existing] : [];
    const index = snapshots.findIndex((item) => item.id === payload.id);
    if (index >= 0) {
      snapshots[index] = payload;
    } else {
      snapshots.unshift(payload);
    }
    await settingsService.setSetting(fallbackKey, snapshots, { userId });
    return payload as T;
  },

  // ============================================================================
  // User Role Management
  // ============================================================================

  /**
   * Get user roles for a project
   */
  async getUserRoles(projectId: string): Promise<UserRole[]> {
    const project = await this.getProject(projectId);
    return (project?.userRoles || []).map((role) => ({
      ...role,
      projectId: role.projectId ?? role.project_id ?? projectId,
      userId: role.userId ?? role.user_id,
      createdAt: role.createdAt ?? role.created_at,
      updatedAt: role.updatedAt ?? role.updated_at,
    }));
  },

  /**
   * Save user role to project
   */
  async saveUserRole(projectId: string, userRole: UserRole): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    if (!project.userRoles) {
      project.userRoles = [];
    }
    
    const index = project.userRoles.findIndex(ur => ur.id === userRole.id);
    if (index >= 0) {
      project.userRoles[index] = { ...userRole, updatedAt: new Date().toISOString() };
    } else {
      project.userRoles.push(userRole);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete user role from project
   */
  async deleteUserRole(projectId: string, userRoleId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    project.userRoles = (project.userRoles || []).filter(ur => ur.id !== userRoleId);
    await this.saveProject(project);
  },

  // ============================================================================
  // Consent Management
  // ============================================================================

  /**
   * Get consents for a candidate
   */
  async getConsents(projectId: string, candidateId: string): Promise<Consent[]> {
    const candidates = await this.getCandidates(projectId);
    const candidate = candidates.find(c => c.id === candidateId);
    return candidate?.consent || [];
  },

  /**
   * Save consent for a candidate
   */
  async saveConsent(projectId: string, candidateId: string, consent: Consent): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const candidate = project.candidates.find(c => c.id === candidateId);
    if (!candidate) {
      throw new Error(`Candidate ${candidateId} not found`);
    }
    
    if (!candidate.consent) {
      candidate.consent = [];
    }
    
    const index = candidate.consent.findIndex(c => c.id === consent.id);
    if (index >= 0) {
      candidate.consent[index] = { ...consent, updatedAt: new Date().toISOString() };
    } else {
      candidate.consent.push(consent);
    }
    
    await this.saveProject(project);
  },

  /**
   * Delete consent from candidate
   */
  async deleteConsent(projectId: string, candidateId: string, consentId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const candidate = project.candidates.find(c => c.id === candidateId);
    if (!candidate || !candidate.consent) {
      throw new Error(`Candidate ${candidateId} or consent not found`);
    }
    
    candidate.consent = candidate.consent.filter(c => c.id !== consentId);
    await this.saveProject(project);
  },

  /**
   * Initialize mock data for testing - TROLL (2022) Norwegian Film
   * Singleton: multiple callers share the same in-flight promise.
   */
  _initPromise: null as Promise<void> | null,
  _contentProducerInitPromise: null as Promise<void> | null,

  async initializeMockData(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this._doInitializeMockData();
    }
    return this._initPromise;
  },

  async initializeContentProducerDemoData(): Promise<void> {
    if (!this._contentProducerInitPromise) {
      this._contentProducerInitPromise = this._doInitializeContentProducerDemoData();
    }
    return this._contentProducerInitPromise;
  },

  async _doInitializeContentProducerDemoData(): Promise<void> {
    let existingProjects: CastingProject[] = [];
    let existingDemoProject: CastingProject | undefined;
    try {
      existingProjects = await this.getProjects();
      existingDemoProject = existingProjects.find(
        (project) => String(project.id || '').trim().toLowerCase() === CONTENT_PRODUCER_DEMO_PROJECT_ID
      );
      if (existingDemoProject && !producerDemoProjectNeedsUpgrade(existingDemoProject)) {
        return;
      }
    } catch (error) {
      console.error('Error checking existing content producer projects:', error);
    }

    const now = new Date().toISOString();
    const producerManuscriptId = `content-producer-demo-${CONTENT_PRODUCER_DEMO_PROJECT_ID}`;
    const producerSceneIds = {
      kickoff: `${producerManuscriptId}-scene-1`,
      training: `${producerManuscriptId}-scene-2`,
      post: `${producerManuscriptId}-scene-3`,
    } as const;
    const producerSceneBreakdowns: SceneBreakdown[] = [
      {
        id: producerSceneIds.kickoff,
        manuscriptId: producerManuscriptId,
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneNumber: '1',
        sceneHeading: `INT. MØTEROM HOS ${PRODUCER_DEMO_CLIENT_COMPANY.toUpperCase()} - DAY`,
        locationName: PRODUCER_DEMO_CLIENT_COMPANY,
        intExt: 'INT',
        timeOfDay: 'DAY',
        description: 'Kickoff med kunden der mål, risikobilde og godkjenningsflyt settes før produksjon.',
        characters: ['PRODUSENT', 'KLIENT'],
        propsNeeded: ['Brief', 'Risikokart', 'Leveranseoversikt'],
        storyboardFrames: [
          {
            id: `${producerSceneIds.kickoff}-frame-1`,
            shotNumber: '1A',
            title: 'Kickoff overview',
            description: 'Bredt møtebilde med klient og produsent rundt brief og leveranseplan.',
            imageUrl: '/role-room-assets/roleroom_producer.webp',
            thumbnailUrl: '/role-room-assets/roleroom_producer_thumb.webp',
            cameraAngle: 'Eye Level',
            movement: 'Static',
            duration: 6,
          },
          {
            id: `${producerSceneIds.kickoff}-frame-2`,
            shotNumber: '1B',
            title: 'Approval detail',
            description: 'Detalj av risikokart, leveransefaser og godkjenningspunkter.',
            imageUrl: '/role-room-assets/roleroom_contract.webp',
            thumbnailUrl: '/role-room-assets/roleroom_contract.webp',
            cameraAngle: 'High Angle',
            movement: 'Static',
            duration: 4,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: producerSceneIds.training,
        manuscriptId: producerManuscriptId,
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneNumber: '2',
        sceneHeading: `INT. ${PRODUCER_DEMO_PRIMARY_LOCATION.toUpperCase()} - DAY`,
        locationName: PRODUCER_DEMO_PRIMARY_LOCATION,
        intExt: 'INT',
        timeOfDay: 'DAY',
        description: 'En ny tekniker ledes gjennom sikker start, radiosamband og kontrollromsoverlevering.',
        characters: ['HMS-INSTRUKTØR', 'NY TEKNIKER', 'FOTOGRAF'],
        propsNeeded: ['Verneutstyr', 'Radio', 'SJA-skjema'],
        storyboardFrames: [
          {
            id: `${producerSceneIds.training}-frame-1`,
            shotNumber: '2A',
            title: 'Safe start wide',
            description: 'Instruktør og tekniker ved sikkerhetsveggen i treningssenteret.',
            imageUrl: '/role-room-assets/roleroom_filmfotograf.webp',
            thumbnailUrl: '/role-room-assets/roleroom_filmfotograf_thumb.webp',
            cameraAngle: 'Eye Level',
            movement: 'Static',
            duration: 7,
          },
          {
            id: `${producerSceneIds.training}-frame-2`,
            shotNumber: '2B',
            title: 'PPE insert',
            description: 'Detalj av hjelm, kortleser og radio før feltadgang.',
            imageUrl: '/role-room-assets/roleroom_camera.webp',
            thumbnailUrl: '/role-room-assets/roleroom_camera.webp',
            cameraAngle: 'Close-up',
            movement: 'Static',
            duration: 4,
          },
          {
            id: `${producerSceneIds.training}-frame-3`,
            shotNumber: '2C',
            title: 'Control room handover',
            description: 'Overlevering i kontrollrommet med fokus på kommunikasjon og rutine.',
            imageUrl: '/role-room-assets/role-video.webp',
            thumbnailUrl: '/role-room-assets/role-video.webp',
            cameraAngle: 'Over Shoulder',
            movement: 'Truck',
            duration: 6,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: producerSceneIds.post,
        manuscriptId: producerManuscriptId,
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneNumber: '3',
        sceneHeading: 'INT. REDIGERINGSROM - EVENING',
        locationName: 'REDIGERINGSROM',
        intExt: 'INT',
        timeOfDay: 'EVENING',
        description: 'Klientreview, siste korrigeringer og eksport av tre leveranseversjoner.',
        characters: ['PRODUSENT', 'KLIENT'],
        propsNeeded: ['Redigeringsstasjon', 'Kommentarspor', 'Versjonsliste'],
        storyboardFrames: [
          {
            id: `${producerSceneIds.post}-frame-1`,
            shotNumber: '3A',
            title: 'Edit suite overview',
            description: 'Bredt bilde av redigeringsrom med tre versjoner i timeline.',
            imageUrl: '/role-room-assets/roleroom_dashboard.webp',
            thumbnailUrl: '/role-room-assets/roleroom_dashboard.webp',
            cameraAngle: 'Eye Level',
            movement: 'Static',
            duration: 5,
          },
          {
            id: `${producerSceneIds.post}-frame-2`,
            shotNumber: '3B',
            title: 'Review notes',
            description: 'Kommentarspor og klientmerknader på skjerm før endelig eksport.',
            imageUrl: '/role-room-assets/roleroom_chat.webp',
            thumbnailUrl: '/role-room-assets/roleroom_chat.webp',
            cameraAngle: 'High Angle',
            movement: 'Static',
            duration: 4,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];
    const producerProductionDays: ProductionDay[] = [
      {
        id: 'cp-day-1',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        date: '2026-04-12',
        callTime: '08:30',
        wrapTime: '11:00',
        scenes: [producerSceneIds.kickoff],
        notes: 'Kickoff, klientbrief og endelig godkjenning av leveranseplan.',
        status: 'planned',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cp-day-2',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        date: '2026-04-18',
        callTime: '07:30',
        wrapTime: '17:00',
        scenes: [producerSceneIds.training],
        notes: 'Produksjonsdag i opplæringssenteret med HMS, onboarding og rekrutteringsdekning.',
        status: 'planned',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'cp-day-3',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        date: '2026-04-22',
        callTime: '10:00',
        wrapTime: '15:00',
        scenes: [producerSceneIds.post],
        notes: 'Klientreview, siste justeringer og eksport av godkjenningspakke.',
        status: 'planned',
        createdAt: now,
        updatedAt: now,
      },
    ];
    const producerShotLists: ShotList[] = [
      {
        id: 'cp-shotlist-1',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneId: producerSceneIds.kickoff,
        sceneName: 'Kickoff og brief',
        productionContext: 'corporate',
        productionPhase: 'planning',
        notes: 'Vis klientbrief, risikobilde og tydelig godkjenningsflyt.',
        createdAt: now,
        updatedAt: now,
        shots: [
          {
            id: 'cp-shot-1A',
            sceneId: producerSceneIds.kickoff,
            description: 'Wide av kickoff-bord med klient og produsent',
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
            duration: 6,
            priority: 'critical',
            status: 'completed',
            imageUrl: '/role-room-assets/roleroom_producer.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
          {
            id: 'cp-shot-1B',
            sceneId: producerSceneIds.kickoff,
            description: 'Insert av brief, risikokart og leveranseoversikt',
            shotType: 'Detail',
            cameraAngle: 'High Angle',
            cameraMovement: 'Static',
            duration: 4,
            priority: 'important',
            status: 'completed',
            imageUrl: '/role-room-assets/roleroom_contract.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
        ],
      },
      {
        id: 'cp-shotlist-2',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneId: producerSceneIds.training,
        sceneName: 'Sikker start i treningssenter',
        productionContext: 'corporate',
        productionPhase: 'shooting',
        notes: 'Skal dekke onboarding, HMS og rekrutteringsvariant i samme opptak.',
        createdAt: now,
        updatedAt: now,
        shots: [
          {
            id: 'cp-shot-2A',
            sceneId: producerSceneIds.training,
            description: 'Hero-wide av instruktør og ny tekniker ved sikkerhetsveggen',
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
            duration: 7,
            priority: 'critical',
            status: 'in_progress',
            imageUrl: '/role-room-assets/roleroom_filmfotograf.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
          {
            id: 'cp-shot-2B',
            sceneId: producerSceneIds.training,
            description: 'Insert av verneutstyr, kortleser og radio',
            shotType: 'Detail',
            cameraAngle: 'Close-up',
            cameraMovement: 'Static',
            duration: 4,
            priority: 'important',
            status: 'in_progress',
            imageUrl: '/role-room-assets/roleroom_camera.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
          {
            id: 'cp-shot-2C',
            sceneId: producerSceneIds.training,
            description: 'OTS av overlevering i kontrollrommet',
            shotType: 'Over Shoulder',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Truck',
            duration: 6,
            priority: 'important',
            status: 'not_started',
            imageUrl: '/role-room-assets/role-video.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
        ],
      },
      {
        id: 'cp-shotlist-3',
        projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
        sceneId: producerSceneIds.post,
        sceneName: 'Klientreview og eksport',
        productionContext: 'corporate',
        productionPhase: 'review',
        notes: 'Godkjenningspakke, kommentarspor og endelig eksport.',
        createdAt: now,
        updatedAt: now,
        shots: [
          {
            id: 'cp-shot-3A',
            sceneId: producerSceneIds.post,
            description: 'Wide av redigeringsrom og tre leveranseversjoner',
            shotType: 'Wide',
            cameraAngle: 'Eye Level',
            cameraMovement: 'Static',
            duration: 5,
            priority: 'important',
            status: 'completed',
            imageUrl: '/role-room-assets/roleroom_dashboard.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
          {
            id: 'cp-shot-3B',
            sceneId: producerSceneIds.post,
            description: 'Nærbilde av klientkommentarer og godkjenningsstatus',
            shotType: 'Detail',
            cameraAngle: 'High Angle',
            cameraMovement: 'Static',
            duration: 4,
            priority: 'important',
            status: 'completed',
            imageUrl: '/role-room-assets/roleroom_chat.webp',
            createdAt: now,
            updatedAt: now,
          } as CastingShot,
        ],
      },
    ];
    const demoProject: CastingProject = {
      ...(existingDemoProject || {}),
      id: CONTENT_PRODUCER_DEMO_PROJECT_ID,
      name: PRODUCER_DEMO_PROJECT_NAME,
      description: PRODUCER_DEMO_PROJECT_DESCRIPTION,
      status: 'active',
      genre: 'commercial',
      projectType: 'corporate-training',
      startDate: '2026-04-12',
      endDate: '2026-04-24',
      budget: 325000,
      currency: 'NOK',
      clientName: PRODUCER_DEMO_CLIENT_NAME,
      clientEmail: PRODUCER_DEMO_CLIENT_EMAIL,
      clientCompanyName: PRODUCER_DEMO_CLIENT_COMPANY,
      clientOrganizationNumber: PRODUCER_DEMO_CLIENT_ORGANIZATION_NUMBER,
      clientCompanyAddress: PRODUCER_DEMO_CLIENT_ADDRESS,
      roles: [
        {
          id: 'cp-role-hms-host',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'HMS-instruktor',
          description: 'Leder sikkerhetssekvensene og forklarer sjekkpunkter for nye teknikere.',
          status: 'casting',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-role-extra-shift-lead',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'Medvirkende - skiftleder',
          description: 'Demonstrerer oppmote, radiosamband og sikker overlevering i kontrollrommet.',
          status: 'casting',
          createdAt: now,
          updatedAt: now,
        },
      ],
      candidates: [
        {
          id: 'cp-candidate-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          roleId: 'cp-role-hms-host',
          name: 'Lea Bjerke',
          email: 'lea.bjerke@northwinddemo.no',
          phone: '+47 900 11 223',
          status: 'shortlisted',
          notes: 'Trygg formidler med troverdig energi for HMS- og onboarding-innhold.',
          photos: ['/role-room-assets/roleroom_casting_director.webp'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-candidate-2',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          roleId: 'cp-role-extra-shift-lead',
          name: 'Henrik Solli',
          email: 'henrik.solli@northwinddemo.no',
          phone: '+47 955 44 222',
          status: 'available',
          notes: 'Har industriell troverdighet og passer som skiftleder eller tekniker i reenactment.',
          photos: ['/role-room-assets/roleroom_fotograf.webp'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      crew: [
        {
          id: 'cp-crew-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'Mina Haugen',
          role: 'producer',
          department: 'production',
          status: 'confirmed',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-crew-2',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'Jonas Rode',
          role: 'cinematographer',
          department: 'camera',
          status: 'confirmed',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-crew-3',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'Sofie Lien',
          role: 'sound_engineer',
          department: 'sound',
          status: 'confirmed',
          createdAt: now,
          updatedAt: now,
        },
      ],
      schedules: [
        {
          id: 'cp-schedule-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          title: 'Kickoff med Northwind Drilling',
          date: '2026-04-12',
          startTime: '09:00',
          endTime: '10:30',
          type: 'meeting',
          status: 'confirmed',
          notes: 'Avklarer budskap, risikopunkter og hvilke filmer som skal brukes i onboarding og rekruttering.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-schedule-2',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          title: 'Klientreview av shotlist og storyboard',
          date: '2026-04-15',
          startTime: '14:00',
          endTime: '15:00',
          type: 'review',
          status: 'confirmed',
          notes: 'Helene godkjenner sceneprioritering for sikker start-pakken.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-schedule-3',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          title: 'Produksjonsdag - opplaeringssenter',
          date: '2026-04-18',
          startTime: '07:30',
          endTime: '17:00',
          type: 'shoot',
          status: 'confirmed',
          notes: 'Intervjuer, reenactments og B-roll fra kontrollrom og sikkerhetstrening.',
          createdAt: now,
          updatedAt: now,
        },
      ],
      locations: [
        {
          id: 'cp-location-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: PRODUCER_DEMO_PRIMARY_LOCATION,
          address: PRODUCER_DEMO_CLIENT_ADDRESS,
          accessNotes: 'Oppmote ved resepsjon. Hjelm, vernesko og registrering kreves for alle i crew.',
          assignedScenes: [producerSceneIds.training],
          createdAt: now,
          updatedAt: now,
        },
      ],
      props: [
        {
          id: 'cp-prop-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'Verneutstyr-sett',
          category: 'wardrobe',
          quantity: 6,
          assignedScenes: [producerSceneIds.training],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cp-prop-2',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          name: 'SJA-skjema og onboarding-folder',
          category: 'document',
          quantity: 4,
          assignedScenes: [producerSceneIds.training],
          createdAt: now,
          updatedAt: now,
        },
      ],
      productionDays: producerProductionDays,
      shotLists: producerShotLists,
      sceneBreakdowns: producerSceneBreakdowns,
      userRoles: [
        {
          id: 'cp-userrole-1',
          projectId: CONTENT_PRODUCER_DEMO_PROJECT_ID,
          userId: getCurrentUserId(),
          role: 'content_producer',
          permissions: {
            canViewAll: true,
            canEditCasting: true,
            canEditProduction: true,
            canEditShots: true,
            canEditShotLists: true,
            canManageCrew: false,
            canManageLocations: true,
            canApprove: false,
            canEditScript: true,
            canRunTableRead: true,
            canComment: true,
            canRequestChanges: true,
            canViewEconomy: true,
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: existingDemoProject?.createdAt || now,
      updatedAt: now,
    };

    try {
      await this.saveProject(demoProject);
      const saved = await this.getProject(demoProject.id);
      if (!saved) {
        console.error('❌ Failed to verify content producer demo project was saved!');
      }
      if (existingDemoProject) {
        console.log('✅ Content producer demo project migrated to business content demo');
      } else if (existingProjects.length > 0) {
        console.log('✅ Content producer demo project created alongside existing projects');
      }
    } catch (error) {
      console.error('Failed to initialize content producer demo project:', error);
    }
  },

  async _doInitializeMockData(): Promise<void> {
    try {
      const existingProjects = await this.getProjects();
      const hasTrollDemo = existingProjects.some((project) => isTrollDemoProject(project));
      if (hasTrollDemo) {
        // Keep existing data intact when TROLL already exists.
        return;
      }
    } catch (error) {
      console.error('Error checking existing projects:', error);
      // Continue to create mock data if database is available
    }

    const now = new Date().toISOString();
    
    // Production dates for TROLL
    const shootDay1 = new Date('2026-01-20');
    const shootDay2 = new Date('2026-01-21');
    const shootDay3 = new Date('2026-01-22');
    const shootDay4 = new Date('2026-01-25');
    const shootDay5 = new Date('2026-01-26');
    const shootDay6 = new Date('2026-01-27');

    const mockProject: CastingProject = {
      id: TROLL_DEMO_PROJECT_ID,
      name: 'TROLL',
      description: 'Norsk eventyrfilm regissert av Roar Uthaug. Når en eksplosjon i de norske fjellene avslører et urgammelt troll, må paleontologen Nora samarbeide med myndighetene for å stoppe skapningen før den når hovedstaden. En spektakulær action-eventyrfilm med VFX og storslåtte locations.',
      roles: [
        {
          id: 'role-nora',
          name: 'Nora Tidemann',
          description: 'Paleontolog, tidlig 30-årene. Intelligent, besluttsom og empatisk. Hovedpersonen som må overbevise myndighetene om trollets eksistens.',
          requirements: {
            age: { min: 28, max: 38 },
            gender: ['female'],
            appearance: ['nordisk', 'naturlig'],
            skills: ['acting', 'action', 'emotional_range'],
          },
          status: 'filled',
          sceneIds: ['scene-3', 'scene-4', 'scene-5', 'scene-7', 'scene-9', 'scene-10'],
        },
        {
          id: 'role-andreas',
          name: 'Andreas Isaksen',
          description: 'Rådgiver for Statsministerens kontor, 30-40 år. Pragmatisk og handlekraftig. Noras kontakt i myndighetene.',
          requirements: {
            age: { min: 32, max: 42 },
            gender: ['male'],
            appearance: ['nordisk', 'profesjonell'],
            skills: ['acting', 'authority'],
          },
          status: 'filled',
          sceneIds: ['scene-4', 'scene-5', 'scene-9', 'scene-10'],
        },
        {
          id: 'role-tobias',
          name: 'Tobias Tidemann',
          description: 'Noras far, 60-70 år. Tidligere forsker med hemmeligheter om trollene. Visdom og sårbarhet.',
          requirements: {
            age: { min: 60, max: 72 },
            gender: ['male'],
            appearance: ['nordisk', 'elderly'],
            skills: ['acting', 'emotional_range'],
          },
          status: 'filled',
          sceneIds: ['scene-10'],
        },
        {
          id: 'role-general',
          name: 'General Lund',
          description: 'Militær leder, 50-60 år. Autoritær og besluttsom. Vil bruke militær makt for å stoppe trollet.',
          requirements: {
            age: { min: 50, max: 62 },
            gender: ['male'],
            appearance: ['militær', 'streng'],
            skills: ['acting', 'authority', 'presence'],
          },
          status: 'filled',
          sceneIds: ['scene-4', 'scene-7'],
        },
        {
          id: 'role-statsminister',
          name: 'Statsminister Berit Moberg',
          description: 'Norges statsminister, 50-55 år. Under enormt press. Må ta vanskelige beslutninger.',
          requirements: {
            age: { min: 48, max: 58 },
            gender: ['female'],
            appearance: ['profesjonell', 'nordisk'],
            skills: ['acting', 'authority'],
          },
          status: 'filled',
          sceneIds: ['scene-7'],
        },
        {
          id: 'role-arbeider1',
          name: 'Tunnelarbeider 1',
          description: 'Erfaren tunnelarbeider, 35-50 år. Oppdager hulen.',
          requirements: {
            age: { min: 35, max: 50 },
            gender: ['male'],
            skills: ['acting'],
          },
          status: 'filled',
          sceneIds: ['scene-1', 'scene-2'],
        },
        {
          id: 'role-arbeider2',
          name: 'Tunnelarbeider 2',
          description: 'Yngre tunnelarbeider, 25-35 år.',
          requirements: {
            age: { min: 25, max: 35 },
            gender: ['male'],
            skills: ['acting'],
          },
          status: 'filled',
          sceneIds: ['scene-1', 'scene-2'],
        },
        {
          id: 'role-bonde',
          name: 'Bonden i Østerdalen',
          description: 'Lokal bonde, 50-65 år. Ser trollet i skogen.',
          requirements: {
            age: { min: 50, max: 65 },
            gender: ['male'],
            appearance: ['rural'],
            skills: ['acting', 'dialect'],
          },
          status: 'casting',
          sceneIds: ['scene-6'],
        },
      ],
      candidates: [
        {
          id: 'cand-ine',
          name: 'Ine Marie Wilmann',
          contactInfo: {
            email: 'agent@inemarie.no',
            phone: '+47 912 34 567',
            address: 'Oslo',
          },
          photos: ['/attached_assets/generated_images/professional_female_headshot_portrait.png'],
          videos: ['https://vimeo.com/demo-reel-ine'],
          auditionNotes: 'Perfekt for Nora. Sterk skuespiller med erfaring fra Wisting, Exit og internasjonale produksjoner. Fantastisk emosjonell rekkevidde.',
          status: 'confirmed',
          assignedRoles: ['role-nora'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-kim',
          name: 'Kim Falck',
          contactInfo: {
            email: 'kim.falck@agent.no',
            phone: '+47 923 45 678',
            address: 'Oslo',
          },
          photos: ['/attached_assets/generated_images/professional_male_headshot_portrait.png'],
          videos: [],
          auditionNotes: 'Overbevisende som Andreas. God kjemi med Ine i prøvescener.',
          status: 'confirmed',
          assignedRoles: ['role-andreas'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-gard',
          name: 'Gard B. Eidsvold',
          contactInfo: {
            email: 'gard@teater.no',
            phone: '+47 934 56 789',
            address: 'Oslo',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Veteran skuespiller. Perfekt som Tobias med sin varme og dybde.',
          status: 'confirmed',
          assignedRoles: ['role-tobias'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-fridtjov',
          name: 'Fridtjov Såheim',
          contactInfo: {
            email: 'fridtjov@agent.no',
            phone: '+47 945 67 890',
            address: 'Lillehammer',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Sterk tilstedeværelse. Perfekt for militær autoritet.',
          status: 'confirmed',
          assignedRoles: ['role-general'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-anneke',
          name: 'Anneke von der Lippe',
          contactInfo: {
            email: 'anneke@teater.no',
            phone: '+47 956 78 901',
            address: 'Oslo',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Prisbelønt skuespiller. Troverdig og karismatisk som statsminister.',
          status: 'confirmed',
          assignedRoles: ['role-statsminister'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-mads',
          name: 'Mads Ousdal',
          contactInfo: {
            email: 'mads.ousdal@email.no',
            phone: '+47 967 89 012',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Erfaren karakterskuespiller. Troverdig som tunnelarbeider.',
          status: 'selected',
          assignedRoles: ['role-arbeider1'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-eric',
          name: 'Eric Vorenholt',
          contactInfo: {
            email: 'eric.v@actors.no',
            phone: '+47 978 90 123',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Ung og fysisk. God for action-scener.',
          status: 'selected',
          assignedRoles: ['role-arbeider2'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-bonde1',
          name: 'Bjørn Sundquist',
          contactInfo: {
            email: 'bjorn.s@agent.no',
            phone: '+47 989 01 234',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Sterk kandidat for bonden. Autentisk dialekt.',
          status: 'shortlist',
          assignedRoles: ['role-bonde'],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'cand-bonde2',
          name: 'Per Schaanning',
          contactInfo: {
            email: 'per.s@teater.no',
            phone: '+47 990 12 345',
          },
          photos: [],
          videos: [],
          auditionNotes: 'Alternativ for bonderollen. God karakterskuespiller.',
          status: 'requested',
          assignedRoles: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
      schedules: [
        {
          id: 'aud-1',
          candidateId: 'cand-bonde1',
          roleId: 'role-bonde',
          date: '2026-01-15',
          time: '10:00',
          location: 'Studio 1, Filmparken',
          notes: 'Første audition for bonderollen. Forbered scene 6.',
          status: 'scheduled',
        },
        {
          id: 'aud-2',
          candidateId: 'cand-bonde2',
          roleId: 'role-bonde',
          date: '2026-01-15',
          time: '11:30',
          location: 'Studio 1, Filmparken',
          notes: 'Callback audition.',
          status: 'scheduled',
        },
        {
          id: 'aud-3',
          candidateId: 'cand-ine',
          roleId: 'role-nora',
          date: '2025-12-10',
          time: '14:00',
          location: 'Nordisk Film, København',
          notes: 'Kjemistry-test med Kim Falck.',
          status: 'completed',
        },
      ],
      crew: [
        {
          id: 'crew-roar',
          name: 'Roar Uthaug',
          role: 'director',
          contactInfo: {
            email: 'roar@motioncontent.no',
            phone: '+47 901 23 456',
            address: 'Oslo',
          },
          availability: {
            startDate: '2026-01-15',
            endDate: '2026-03-30',
          },
          assignedScenes: ['scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5', 'scene-6', 'scene-7', 'scene-8', 'scene-9', 'scene-10'],
          rate: 25000,
          notes: 'Hovedregissør. Erfaring fra Tomb Raider, Bølgen, Fritt Vilt.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-espen',
          name: 'Espen Sandberg',
          role: 'producer',
          contactInfo: {
            email: 'espen@motioncontent.no',
            phone: '+47 902 34 567',
          },
          availability: {
            startDate: '2026-01-01',
            endDate: '2026-06-30',
          },
          assignedScenes: [],
          rate: 20000,
          notes: 'Produsent. Erfaring fra Pirates of the Caribbean: Dead Men Tell No Tales.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-jallo',
          name: 'Jallo Faber',
          role: 'cinematographer',
          contactInfo: {
            email: 'jallo@cinematography.dk',
            phone: '+45 123 45 678',
            address: 'København',
          },
          availability: {
            startDate: '2026-01-18',
            endDate: '2026-03-15',
          },
          assignedScenes: ['scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5', 'scene-6', 'scene-7', 'scene-8', 'scene-9', 'scene-10'],
          rate: 18000,
          notes: 'Director of Photography. Erfaring fra Bølgen, Skjelvet.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-vfx',
          name: 'Storm Studios VFX',
          role: 'vfx_artist',
          contactInfo: {
            email: 'production@stormstudios.no',
            phone: '+47 903 45 678',
            address: 'Oslo',
          },
          availability: {
            startDate: '2026-01-01',
            endDate: '2026-09-30',
          },
          assignedScenes: ['scene-1', 'scene-2', 'scene-6', 'scene-8', 'scene-9', 'scene-10'],
          rate: 50000,
          notes: 'VFX supervisor og studio. Trollet og alle CGI-effekter.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-stunt',
          name: 'Kai Kolstad Rødseth',
          role: 'production_assistant',
          contactInfo: {
            email: 'kai@stunts.no',
            phone: '+47 904 56 789',
          },
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-02-28',
          },
          assignedScenes: ['scene-1', 'scene-8', 'scene-9', 'scene-10'],
          rate: 12000,
          notes: 'Stunt coordinator. Action-scener og sikkerhet.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-costume',
          name: 'Karen Fabritius Gram',
          role: 'wardrobe',
          contactInfo: {
            email: 'karen@costumes.no',
            phone: '+47 905 67 890',
          },
          availability: {
            startDate: '2026-01-10',
            endDate: '2026-03-30',
          },
          assignedScenes: [],
          rate: 8000,
          notes: 'Kostymedesigner. Militæruniformer, dagligklær, periodevise elementer.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-sound',
          name: 'Tormod Ringnes',
          role: 'sound_engineer',
          contactInfo: {
            email: 'tormod@sound.no',
            phone: '+47 906 78 901',
          },
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-05-30',
          },
          assignedScenes: [],
          rate: 10000,
          notes: 'Lyddesign. Trollets lyder, eksplosjon, atmosfære.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'crew-1ad',
          name: 'Nina Widerberg',
          role: 'production_assistant',
          contactInfo: {
            email: 'nina@ad.no',
            phone: '+47 907 89 012',
          },
          availability: {
            startDate: '2026-01-15',
            endDate: '2026-03-30',
          },
          assignedScenes: [],
          rate: 7000,
          notes: '1st Assistant Director. Scheduling og on-set koordinering.',
          createdAt: now,
          updatedAt: now,
        },
      ],
      locations: [
        {
          id: 'loc-dovre',
          name: 'Dovre Tunnel - Sprengningssted',
          address: 'Dombås, Dovre kommune',
          type: 'outdoor',
          capacity: 50,
          facilities: ['parking', 'power', 'restrooms'],
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-01-22',
          },
          assignedScenes: ['scene-1', 'scene-2', 'scene-5'],
          contactInfo: {
            name: 'Statens vegvesen',
            phone: '+47 22 07 30 00',
            email: 'filming@vegvesen.no',
          },
          coordinates: {
            lat: 62.0759,
            lng: 9.1104,
          },
          propertyId: 'DOVRE-TUNNEL-001',
          notes: 'Ekte tunnelområde. Krever koordinering med Statens vegvesen. Pyroteknikk-tillatelse nødvendig.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-oslo-apartment',
          name: 'Noras Leilighet - Grünerløkka',
          address: 'Thorvald Meyers gate 45, Oslo',
          type: 'indoor',
          capacity: 20,
          facilities: ['power', 'wifi', 'restrooms'],
          availability: {
            startDate: '2026-01-23',
            endDate: '2026-01-24',
          },
          assignedScenes: ['scene-3'],
          contactInfo: {
            name: 'Location Manager Oslo',
            phone: '+47 915 67 890',
            email: 'locations@troll-film.no',
          },
          coordinates: {
            lat: 59.9225,
            lng: 10.7580,
          },
          propertyId: 'OSLO-APT-045',
          notes: 'Autentisk Oslo-leilighet. Bohemsk stil. Fossiler og bøker som rekvisitter.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-university',
          name: 'Universitetet i Oslo - Geologisk Museum',
          address: 'Sars gate 1, Oslo',
          type: 'indoor',
          capacity: 30,
          facilities: ['parking', 'power', 'wifi', 'restrooms'],
          availability: {
            startDate: '2026-01-25',
            endDate: '2026-01-25',
          },
          assignedScenes: ['scene-4'],
          contactInfo: {
            name: 'UiO Filming',
            phone: '+47 22 85 50 50',
            email: 'filming@uio.no',
          },
          coordinates: {
            lat: 59.9169,
            lng: 10.7731,
          },
          propertyId: 'UIO-GEOL-001',
          notes: 'Geologisk museum og kontorlokaler. Filming på kveldstid etter stengetid.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-kommando',
          name: 'Forsvarets Operative Hovedkvarter',
          address: 'Reitan, Bodø',
          type: 'indoor',
          capacity: 40,
          facilities: ['parking', 'power', 'security', 'restrooms', 'catering'],
          availability: {
            startDate: '2026-02-01',
            endDate: '2026-02-03',
          },
          assignedScenes: ['scene-7'],
          contactInfo: {
            name: 'Forsvaret Media',
            phone: '+47 23 09 50 00',
            email: 'media@forsvaret.no',
          },
          coordinates: {
            lat: 67.2803,
            lng: 14.4050,
          },
          propertyId: 'FOH-REITAN-001',
          notes: 'Ekte kommandosentral. Alternativt: bygge sett på studio. Sikkerhetsgodkjenning påkrevd.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-osterdalen',
          name: 'Skog - Østerdalen',
          address: 'Koppang, Stor-Elvdal kommune',
          type: 'outdoor',
          capacity: 60,
          facilities: ['parking'],
          availability: {
            startDate: '2026-02-05',
            endDate: '2026-02-07',
          },
          assignedScenes: ['scene-6'],
          contactInfo: {
            name: 'Stor-Elvdal kommune',
            phone: '+47 62 46 46 00',
            email: 'filming@stor-elvdal.no',
          },
          coordinates: {
            lat: 61.5681,
            lng: 10.8206,
          },
          propertyId: 'OSTERD-SKOG-001',
          notes: 'Tett granskog. Nattscenar. Generatorer og lys nødvendig. Trollet CGI legges inn i post.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-e6',
          name: 'E6 Motorvei - Stunt Location',
          address: 'E6 ved Minnesund, Eidsvoll',
          type: 'outdoor',
          capacity: 100,
          facilities: ['parking', 'power'],
          availability: {
            startDate: '2026-02-10',
            endDate: '2026-02-12',
          },
          assignedScenes: ['scene-8'],
          contactInfo: {
            name: 'Statens vegvesen / Politiet',
            phone: '+47 22 07 30 00',
            email: 'vegstengning@vegvesen.no',
          },
          coordinates: {
            lat: 60.3962,
            lng: 11.1667,
          },
          propertyId: 'E6-MINNESUND-001',
          notes: 'Veistengning nødvendig. Stunt-biler og krasj. Natt-filming. Koordinering med politi.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-slottet',
          name: 'Slottsplassen - Oslo',
          address: 'Slottsplassen 1, Oslo',
          type: 'outdoor',
          capacity: 200,
          facilities: ['parking', 'power', 'security'],
          availability: {
            startDate: '2026-02-15',
            endDate: '2026-02-17',
          },
          assignedScenes: ['scene-9'],
          contactInfo: {
            name: 'Det kongelige hoff',
            phone: '+47 22 04 87 00',
            email: 'filming@slottet.no',
          },
          coordinates: {
            lat: 59.9170,
            lng: 10.7275,
          },
          propertyId: 'SLOTTET-001',
          notes: 'Filmtillatelse fra Slottet og Oslo kommune. Tidlig morgenskyting før publikum.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-karl-johan',
          name: 'Karl Johans gate - Klimaks',
          address: 'Karl Johans gate, Oslo',
          type: 'outdoor',
          capacity: 300,
          facilities: ['parking', 'power', 'restrooms'],
          availability: {
            startDate: '2026-02-18',
            endDate: '2026-02-22',
          },
          assignedScenes: ['scene-10'],
          contactInfo: {
            name: 'Oslo kommune Film',
            phone: '+47 21 80 21 80',
            email: 'film@oslo.kommune.no',
          },
          coordinates: {
            lat: 59.9133,
            lng: 10.7389,
          },
          propertyId: 'KARL-JOHAN-001',
          notes: 'Hovedscene. Full veistengning. Masse statister. Trollet forsteines i sollyset. VFX-heavy.',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'loc-studio',
          name: 'Filmparken Studio - Jar',
          address: 'Sandviksveien 26, 1363 Høvik',
          type: 'studio',
          capacity: 150,
          facilities: ['parking', 'power', 'wifi', 'restrooms', 'catering', 'dressing_rooms', 'makeup_area', 'loading_dock', 'green_room'],
          availability: {
            startDate: '2026-01-15',
            endDate: '2026-03-30',
          },
          assignedScenes: ['scene-2', 'scene-7'],
          contactInfo: {
            name: 'Filmparken Booking',
            phone: '+47 67 52 50 00',
            email: 'booking@filmparken.no',
          },
          coordinates: {
            lat: 59.9070,
            lng: 10.5950,
          },
          propertyId: 'FILMPARKEN-A',
          notes: 'Hovedstudio. Greenscreen for VFX-scener. Hulen interiør bygges her.',
          createdAt: now,
          updatedAt: now,
        },
      ],
      props: [
        {
          id: 'prop-boremaskin',
          name: 'Tunnelboremaskin',
          category: 'equipment',
          description: 'Full-size tunnelboremaskin for åpningsscenen',
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-01-22',
          },
          assignedScenes: ['scene-1'],
          quantity: 1,
          location: 'Dovre - On location',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-hjelmer',
          name: 'Arbeidshjelmer med lys',
          category: 'costume',
          description: 'Sikkerhetshjelmer med hodelykter for tunnelarbeidere',
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-01-22',
          },
          assignedScenes: ['scene-1', 'scene-2'],
          quantity: 10,
          location: 'Props-truck',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-dynamitt',
          name: 'Dynamitt (prop)',
          category: 'prop',
          description: 'Falsk dynamitt for tunnelscener',
          availability: {
            startDate: '2026-01-20',
            endDate: '2026-01-22',
          },
          assignedScenes: ['scene-1'],
          quantity: 20,
          location: 'Pyro-avdeling',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-fossiler',
          name: 'Fossiler og geologiutstyr',
          category: 'decoration',
          description: 'Diverse fossiler, steiner og paleontologi-utstyr for Noras leilighet og kontor',
          availability: {
            startDate: '2026-01-23',
            endDate: '2026-01-26',
          },
          assignedScenes: ['scene-3', 'scene-4'],
          quantity: 50,
          location: 'Props-lager',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-militær',
          name: 'Militærutstyr og våpen',
          category: 'equipment',
          description: 'Militære kjøretøy, våpen (deaktiverte), uniformer',
          availability: {
            startDate: '2026-02-01',
            endDate: '2026-02-22',
          },
          assignedScenes: ['scene-5', 'scene-7', 'scene-8', 'scene-9', 'scene-10'],
          quantity: 100,
          location: 'Forsvaret utlån',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-uvlys',
          name: 'UV-lys/kunstig sollys',
          category: 'equipment',
          description: 'Store UV-lamper som simulerer sollys for klimaksscenen',
          availability: {
            startDate: '2026-02-15',
            endDate: '2026-02-22',
          },
          assignedScenes: ['scene-9', 'scene-10'],
          quantity: 20,
          location: 'Lys-avdeling',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-biler',
          name: 'Stunt-biler for E6',
          category: 'equipment',
          description: 'Biler preparert for krasj og stunt på E6',
          availability: {
            startDate: '2026-02-10',
            endDate: '2026-02-12',
          },
          assignedScenes: ['scene-8'],
          quantity: 15,
          location: 'Stunt-koordinator',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'prop-kirkeklokker',
          name: 'Kirkeklokker (lydeffekt)',
          category: 'sound',
          description: 'Opptak av kirkeklokker for klimaksscenen',
          availability: {
            startDate: '2026-02-18',
            endDate: '2026-02-22',
          },
          assignedScenes: ['scene-10'],
          quantity: 1,
          location: 'Lydavdeling',
          createdAt: now,
          updatedAt: now,
        },
      ],
      productionDays: [
        {
          id: 'day-1',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay1.toISOString().split('T')[0],
          callTime: '06:00',
          wrapTime: '18:00',
          locationId: 'loc-dovre',
          scenes: ['scene-1'],
          crew: ['crew-roar', 'crew-jallo', 'crew-stunt', 'crew-1ad'],
          props: ['prop-boremaskin', 'prop-hjelmer', 'prop-dynamitt'],
          notes: 'Dag 1: Tunnelsprengning. Pyroteknikk. Tidlig start for sollys.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'day-2',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay2.toISOString().split('T')[0],
          callTime: '14:00',
          wrapTime: '02:00',
          locationId: 'loc-dovre',
          scenes: ['scene-2'],
          crew: ['crew-roar', 'crew-jallo', 'crew-vfx', 'crew-1ad'],
          props: ['prop-hjelmer'],
          notes: 'Dag 2: Hulen interiør. Nattscene. VFX-markører for trollet.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'day-3',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay3.toISOString().split('T')[0],
          callTime: '08:00',
          wrapTime: '16:00',
          locationId: 'loc-oslo-apartment',
          scenes: ['scene-3'],
          crew: ['crew-roar', 'crew-jallo', 'crew-costume', 'crew-1ad'],
          props: ['prop-fossiler'],
          notes: 'Dag 3: Noras leilighet. Karakter-introduksjon.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'day-4',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay4.toISOString().split('T')[0],
          callTime: '18:00',
          wrapTime: '06:00',
          locationId: 'loc-university',
          scenes: ['scene-4'],
          crew: ['crew-roar', 'crew-jallo', 'crew-1ad'],
          props: ['prop-fossiler'],
          notes: 'Dag 4: Universitetet. Nattfilming etter stengetid.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'day-5',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay5.toISOString().split('T')[0],
          callTime: '07:00',
          wrapTime: '17:00',
          locationId: 'loc-dovre',
          scenes: ['scene-5'],
          crew: ['crew-roar', 'crew-jallo', 'crew-vfx', 'crew-1ad'],
          props: ['prop-militær'],
          notes: 'Dag 5: Ruinene etter trollet. VFX for ødeleggelser.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'day-6',
          projectId: TROLL_DEMO_PROJECT_ID,
          date: shootDay6.toISOString().split('T')[0],
          callTime: '20:00',
          wrapTime: '06:00',
          locationId: 'loc-osterdalen',
          scenes: ['scene-6'],
          crew: ['crew-roar', 'crew-jallo', 'crew-vfx', 'crew-1ad'],
          props: [],
          notes: 'Dag 6: Nattfilming i skogen. Trollet sees av bonden.',
          status: 'planned',
          createdAt: now,
          updatedAt: now,
        },
      ],
      shotLists: [
        {
          id: 'shot-list-1',
          projectId: 'troll',
          sceneId: 'scene-1',
          equipment: ['ARRI Alexa Mini LF', 'Zeiss Master Primes', 'Steadicam', 'Dolly'],
          createdAt: now,
          updatedAt: now,
          shots: [
            {
              id: 'shot-1-1',
              roleId: 'role-1',
              sceneId: 'scene-1',
              description: 'Establishing shot - Tunnel inngang med arbeidere (1A)',
              shotType: 'Wide',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Static',
              focalLength: 24,
              duration: 5,
              notes: 'Drone-shot alternativ',
              imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-1-2',
              roleId: 'role-1',
              sceneId: 'scene-1',
              description: 'Medium shot - Formann gir ordre (1B)',
              shotType: 'Medium',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Static',
              focalLength: 50,
              duration: 8,
              notes: 'Fokus på dialog',
              imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-1-3',
              roleId: 'role-1',
              sceneId: 'scene-1',
              description: 'Close-up - Dynamitt plasseres (1C)',
              shotType: 'Close-up',
              cameraAngle: 'Low Angle',
              cameraMovement: 'Static',
              focalLength: 85,
              duration: 3,
              notes: 'Insert shot',
              imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-1-4',
              roleId: 'role-1',
              sceneId: 'scene-1',
              description: 'Wide - Eksplosjon og tunnelåpning (1D)',
              shotType: 'Wide',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Static',
              focalLength: 24,
              duration: 6,
              notes: 'Pyroteknikk. Flere kameraer.',
              imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
          ],
        },
        {
          id: 'shot-list-2',
          projectId: 'troll',
          sceneId: 'scene-2',
          equipment: ['RED Komodo', 'Sigma Cine Lenses', 'Gimbal', 'LED panels'],
          createdAt: now,
          updatedAt: now,
          shots: [
            {
              id: 'shot-2-1',
              roleId: 'role-1',
              sceneId: 'scene-2',
              description: 'POV - Arbeiderne går inn i hulen (2A)',
              shotType: 'Medium',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Dolly',
              focalLength: 35,
              duration: 15,
              notes: 'Steadicam. Lommelykt som eneste lys. POV-stil.',
              imageUrl: 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-2-2',
              roleId: 'role-1',
              sceneId: 'scene-2',
              description: 'Wide - Enorm hule avsløres (2B)',
              shotType: 'Wide',
              cameraAngle: 'Low Angle',
              cameraMovement: 'Tilt',
              focalLength: 16,
              duration: 8,
              notes: 'Reveal-shot. VFX for størrelse.',
              imageUrl: 'https://images.unsplash.com/photo-1504699439244-edca3c77a02a?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-2-3',
              roleId: 'role-1',
              sceneId: 'scene-2',
              description: 'ECU - Arbeiders ansikt, frykt (2C)',
              shotType: 'Extreme Close-up',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Static',
              focalLength: 100,
              duration: 3,
              notes: 'Reaksjonsshot',
              imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-2-4',
              roleId: 'role-1',
              sceneId: 'scene-2',
              description: 'Wide - Noe beveger seg i mørket (2D)',
              shotType: 'Wide',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Dolly',
              focalLength: 35,
              duration: 5,
              notes: 'VFX: Trollets silhuett',
              imageUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
          ],
        },
        {
          id: 'shot-list-10',
          projectId: 'troll',
          sceneId: 'scene-10',
          equipment: ['ARRI Alexa LF', 'Signature Primes', 'Crane', 'Drone'],
          createdAt: now,
          updatedAt: now,
          shots: [
            {
              id: 'shot-10-1',
              roleId: 'role-1',
              sceneId: 'scene-10',
              description: 'Epic wide - Trollet på Karl Johan (10A)',
              shotType: 'Wide',
              cameraAngle: 'Low Angle',
              cameraMovement: 'Crane',
              focalLength: 18,
              duration: 10,
              notes: 'VFX: Full CG troll. Drone/crane combo.',
              imageUrl: 'https://images.unsplash.com/photo-1559564484-e48b3e040ff4?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-10-2',
              roleId: 'role-1',
              sceneId: 'scene-10',
              description: 'Medium - Nora konfronterer trollet (10B)',
              shotType: 'Medium',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Dolly',
              focalLength: 50,
              duration: 12,
              notes: 'Emosjonelt klimaks. Over-shoulder stil.',
              imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-10-3',
              roleId: 'role-1',
              sceneId: 'scene-10',
              description: 'CU - Nora og Tobias (10C)',
              shotType: 'Close-up',
              cameraAngle: 'Eye Level',
              cameraMovement: 'Static',
              focalLength: 85,
              duration: 20,
              notes: 'Far-datter øyeblikk',
              imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
            {
              id: 'shot-10-4',
              roleId: 'role-1',
              sceneId: 'scene-10',
              description: 'Epic wide - Solen stiger, trollet forsteines (10D)',
              shotType: 'Wide',
              cameraAngle: 'High Angle',
              cameraMovement: 'Crane',
              focalLength: 24,
              duration: 15,
              notes: 'VFX: Trollet blir til stein. Sollys-effekt.',
              imageUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800&q=80',
              createdAt: now,
              updatedAt: now,
            } as CastingShot,
          ],
        },
      ],
      userRoles: [
        {
          id: 'userrole-1',
          userId: 'user-roar',
          projectId: 'troll',
          role: 'director',
          permissions: {
            canViewAll: true,
            canEditCasting: true,
            canEditProduction: true,
            canEditShotLists: true,
            canManageCrew: true,
            canManageLocations: true,
            canApprove: true,
          },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'userrole-2',
          userId: 'user-espen',
          projectId: 'troll',
          role: 'producer',
          permissions: {
            canViewAll: true,
            canEditCasting: true,
            canEditProduction: true,
            canEditShotLists: true,
            canManageCrew: true,
            canManageLocations: true,
            canApprove: true,
          },
          createdAt: now,
          updatedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    // Save to database
    try {
      await this.saveProject(mockProject);

      
      // Verify it was saved
      const saved = await this.getProject(mockProject.id);
      if (saved) {
        // TROLL project verified in storage
      } else {
        console.error('❌ Failed to verify TROLL project was saved!');
      }
    } catch (error) {
      console.error('Failed to initialize TROLL project:', error);
    }
  },
};
