import { CastingProject, UserRole } from '../models/casting';
import { castingService } from './castingService';

type ShareTokenEntry = {
  token: string;
  projectId: string;
  role: UserRole['role'];
  createdAt: string;
  expiresAt: string;
};

const SHARE_TOKEN_STORAGE_KEY = 'role-room-share-links';
const SHARE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseShareTokenEntries = (value: unknown): ShareTokenEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const token = entry.token;
    const projectId = entry.projectId;
    const role = entry.role;
    const createdAt = entry.createdAt;
    const expiresAt = entry.expiresAt;

    if (
      typeof token !== 'string' ||
      typeof projectId !== 'string' ||
      typeof role !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof expiresAt !== 'string'
    ) {
      return [];
    }

    return [{
      token,
      projectId,
      role: role as UserRole['role'],
      createdAt,
      expiresAt,
    }];
  });
};

const pruneExpiredShareTokens = (entries: ShareTokenEntry[]): ShareTokenEntry[] => {
  const now = Date.now();
  return entries.filter((entry) => Date.parse(entry.expiresAt) > now);
};

const loadShareTokens = (): ShareTokenEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SHARE_TOKEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return pruneExpiredShareTokens(parseShareTokenEntries(parsed));
  } catch {
    return [];
  }
};

const saveShareTokens = (entries: ShareTokenEntry[]): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHARE_TOKEN_STORAGE_KEY, JSON.stringify(entries));
};

const createShareToken = (): string => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replace(/-/g, '');
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
};

/**
 * Sharing Service
 * Handles sharing of casting projects and storyboards with team
 */
export const sharingService = {
  /**
   * Share project with user
   */
  async shareProject(projectId: string, userId: string, role: UserRole['role'], permissions: UserRole['permissions']): Promise<UserRole> {
    const userRole: UserRole = {
      id: `user-role-${Date.now()}`,
      userId,
      projectId,
      role,
      permissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await castingService.saveUserRole(projectId, userRole);
    return userRole;
  },

  /**
   * Get shared users for a project
   */
  async getSharedUsers(projectId: string): Promise<UserRole[]> {
    return await castingService.getUserRoles(projectId);
  },

  /**
   * Remove user from project
   */
  async removeUser(projectId: string, userRoleId: string): Promise<void> {
    await castingService.deleteUserRole(projectId, userRoleId);
  },

  /**
   * Update user permissions
   */
  async updateUserPermissions(projectId: string, userRoleId: string, permissions: UserRole['permissions']): Promise<void> {
    const userRoles = await castingService.getUserRoles(projectId);
    const userRole = userRoles.find(ur => ur.id === userRoleId);
    if (!userRole) return;
    
    userRole.permissions = permissions;
    await castingService.saveUserRole(projectId, userRole);
  },

  /**
   * Generate a share link with a persisted access token.
   */
  generateShareLink(projectId: string, role: UserRole['role']): string {
    const token = createShareToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + SHARE_TOKEN_TTL_MS).toISOString();

    const storedTokens = loadShareTokens();
    const nextTokens = pruneExpiredShareTokens([
      ...storedTokens.filter((entry) => entry.token !== token),
      {
        token,
        projectId,
        role,
        createdAt,
        expiresAt,
      },
    ]);
    saveShareTokens(nextTokens);

    const sharePath = `/casting/${projectId}`;
    if (typeof window === 'undefined') {
      return `${sharePath}?role=${encodeURIComponent(role)}&share=${encodeURIComponent(token)}`;
    }

    const shareUrl = new URL(sharePath, window.location.origin);
    shareUrl.searchParams.set('role', role);
    shareUrl.searchParams.set('share', token);
    shareUrl.searchParams.set('expires', expiresAt);
    return shareUrl.toString();
  },

  /**
   * Resolve share metadata from a persisted token.
   */
  resolveShareToken(token: string): { projectId: string; role: UserRole['role']; expiresAt: string } | null {
    if (!token.trim()) return null;
    const match = loadShareTokens().find((entry) => entry.token === token);
    if (!match) return null;
    return {
      projectId: match.projectId,
      role: match.role,
      expiresAt: match.expiresAt,
    };
  },

  /**
   * Export project to JSON
   */
  async exportProject(projectId: string): Promise<string> {
    const project = await castingService.getProject(projectId);
    if (!project) throw new Error('Project not found');
    
    return JSON.stringify(project, null, 2);
  },

  /**
   * Import project from JSON
   */
  async importProject(jsonData: string): Promise<CastingProject> {
    try {
      const project = JSON.parse(jsonData) as CastingProject;
      
      // Validate and ensure all required fields
      if (!project.id || !project.name) {
        throw new Error('Invalid project data');
      }
      
      // Generate new ID to avoid conflicts
      project.id = `project-${Date.now()}`;
      project.createdAt = new Date().toISOString();
      project.updatedAt = new Date().toISOString();
      
      await castingService.saveProject(project);
      return project;
    } catch (error) {
      console.error('Error importing project:', error);
      throw new Error('Failed to import project');
    }
  },
};



