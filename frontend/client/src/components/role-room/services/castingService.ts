import { 
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
  UserRole,
  Consent,
} from '../models/casting';
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
      const result = await response.json();
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
  const localProjects = getProjectsFromStorage();

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
    const dbProjects = Array.isArray(data) ? data : data.projects || [];
    
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
    console.error('Error fetching projects from database:', error);
    // Fall back to local storage
    return localProjects;
  }
}

/**
 * Save project to database with fallback to storage
 */
async function saveProjectToDb(project: CastingProject): Promise<void> {
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
  /**
   * Get all projects from database or storage
   */
  async getProjects(): Promise<CastingProject[]> {
    try {
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
    const localProjects = getProjectsFromStorage();
    const localProject = localProjects.find(p => p.id === id);
    
    try {
      const response = await fetch(`/api/casting/projects/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return localProject || null;
        }
        throw new Error(`Failed to fetch project: ${response.statusText}`);
      }
      const dbProject = await response.json();
      
      // Compare richness - prefer richer data (check both arrays and counts)
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
      
      if (localHasData && !dbHasData) {
        return localProject ?? null;
      }
      
      return dbProject ?? null;
    } catch (_error) {
      // Fall back to storage
      return localProject || null;
    }
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
    return project?.userRoles || [];
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

  async initializeMockData(): Promise<void> {
    if (!this._initPromise) {
      this._initPromise = this._doInitializeMockData();
    }
    return this._initPromise;
  },

  async _doInitializeMockData(): Promise<void> {
    try {
      const existingProjects = await this.getProjects();
      if (existingProjects.length > 0) {
        // Don't overwrite existing data
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
      id: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
          projectId: 'troll-project-2026',
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
