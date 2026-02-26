import { UserRole, UserRoleType } from '../models/casting';
import { castingService } from './castingService';
import { authSessionService } from './authSessionService';
import { getCurrentUserId } from './settingsService';

/**
 * Casting Auth Service
 * Handles role-based access control for casting projects
 */
export const castingAuthService = {
  /**
   * Resolve current user id from auth session with a settings fallback.
   */
  getCurrentUserId(): string {
    const session = authSessionService.getSessionSync();
    if (session.currentUserId && session.currentUserId.trim().length > 0) {
      return session.currentUserId;
    }
    if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
      return String(session.adminUser.id);
    }
    return getCurrentUserId();
  },

  /**
   * Get user role for a project
   */
  async getUserRole(projectId: string, userId?: string): Promise<UserRole | null> {
    const targetUserId = userId || this.getCurrentUserId();
    const userRoles = await castingService.getUserRoles(projectId);
    return userRoles.find(ur => ur.userId === targetUserId) || null;
  },

  /**
   * Check if user has permission
   */
  async hasPermission(
    projectId: string,
    permission: keyof UserRole['permissions'],
    userId?: string
  ): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director and producer have all permissions
    if (userRole.role === 'director' || userRole.role === 'producer') {
      return true;
    }
    
    return userRole.permissions[permission] === true;
  },

  /**
   * Check if user can view all data
   */
  async canViewAll(projectId: string, userId?: string): Promise<boolean> {
    return await this.hasPermission(projectId, 'canViewAll', userId);
  },

  /**
   * Check if user can edit casting
   */
  async canEditCasting(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, and casting director can edit casting
    return ['director', 'producer', 'casting_director'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canEditCasting', userId);
  },

  /**
   * Check if user can edit production
   */
  async canEditProduction(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, and production manager can edit production
    return ['director', 'producer', 'production_manager'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canEditProduction', userId);
  },

  /**
   * Check if user can edit shot lists
   */
  async canEditShotLists(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, and camera team can edit shot lists
    return ['director', 'producer', 'camera_team'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canEditShotLists', userId);
  },

  /**
   * Check if user can manage crew
   */
  async canManageCrew(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, and production manager can manage crew
    return ['director', 'producer', 'production_manager'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canManageCrew', userId);
  },

  /**
   * Check if user can manage locations
   */
  async canManageLocations(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, and production manager can manage locations
    return ['director', 'producer', 'production_manager'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canManageLocations', userId);
  },

  /**
   * Check if user can approve
   */
  async canApprove(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Only director and producer can approve
    return ['director', 'producer'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canApprove', userId);
  },

  /**
   * Check if user can edit screenplay/script
   */
  async canEditScript(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, writer, and script_editor can edit script
    return ['director', 'producer', 'writer', 'script_editor'].includes(userRole.role) ||
           userRole.permissions.canEditScript === true;
  },

  /**
   * Check if user can lock/unlock script (final draft)
   */
  async canLockScript(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Only director, producer, and script_editor can lock script
    return ['director', 'producer', 'script_editor'].includes(userRole.role) ||
           userRole.permissions.canLockScript === true;
  },

  /**
   * Check if user can run table reads (TTS)
   */
  async canRunTableRead(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    
    // Director, producer, writer, script_editor can run table reads
    return ['director', 'producer', 'writer', 'script_editor'].includes(userRole.role) ||
           userRole.permissions.canRunTableRead === true;
  },

  /**
   * Get default permissions for a role type
   */
  getDefaultPermissions(role: UserRoleType): UserRole['permissions'] {
    switch (role) {
      case 'director':
      case 'producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canEditShotLists: true,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: true,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
        };
      case 'casting_director':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
        };
      case 'production_manager':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: true,
          canEditShotLists: false,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
        };
      case 'camera_team':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: true,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
        };
      case 'writer':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: false,
          canRunTableRead: true,
        };
      case 'script_editor':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
        };
      case 'reader':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: true,
        };
      case 'agency':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
        };
      default:
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
        };
    }
  },
};




