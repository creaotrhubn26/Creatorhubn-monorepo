import type { UserRole, UserRoleType } from '../models/casting';
import { castingService } from './castingService';
import { getCurrentUserId } from './settingsService';

type PermissionKey = keyof NonNullable<UserRole['permissions']>;

/**
 * Casting Auth Service
 * Handles role-based access control for casting projects
 */
export const castingAuthService = {
  /**
   * Get current user (placeholder - in real app would get from auth system)
   */
  getCurrentUserId(): string {
    // Placeholder - in real implementation would get from auth context
    return getCurrentUserId();
  },

  /**
   * Get user role for a project
   */
  async getUserRole(projectId: string, userId?: string): Promise<UserRole | null> {
    const targetUserId = userId || this.getCurrentUserId();
    const userRoles = await castingService.getUserRoles(projectId);
    return (
      userRoles.find((ur) => {
        const roleUserId = String(ur.userId ?? ur.user_id ?? '');
        return roleUserId === String(targetUserId);
      }) || null
    );
  },

  /**
   * Check if user has permission
   */
  async hasPermission(
    projectId: string,
    permission: PermissionKey,
    userId?: string
  ): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    const permissions = userRole.permissions ?? {};
    
    // Director and producer have all permissions
    if (userRole.role === 'director' || userRole.role === 'producer') {
      return true;
    }

    if (permission === 'canEditShotLists') {
      return permissions.canEditShotLists === true || permissions.canEditShots === true;
    }
    if (permission === 'canEditShots') {
      return permissions.canEditShots === true || permissions.canEditShotLists === true;
    }

    return permissions[permission] === true;
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
    
    // Director, producer, production manager, and content producer can edit production
    return ['director', 'producer', 'production_manager', 'content_producer'].includes(userRole.role) ||
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
   * Check if user can comment in review workflows
   */
  async canComment(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    return ['director', 'producer', 'content_producer', 'client_reviewer'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canComment', userId);
  },

  /**
   * Check if user can request changes in review workflows
   */
  async canRequestChanges(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    return ['director', 'producer', 'content_producer', 'client_reviewer'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canRequestChanges', userId);
  },

  /**
   * Check if user can view/edit economy data
   */
  async canViewEconomy(projectId: string, userId?: string): Promise<boolean> {
    const userRole = await this.getUserRole(projectId, userId);
    if (!userRole) return false;
    return ['director', 'producer', 'content_producer', 'client_reviewer'].includes(userRole.role) ||
           await this.hasPermission(projectId, 'canViewEconomy', userId);
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
          canEditShots: true,
          canEditShotLists: true,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: true,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'content_producer':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: true,
          canEditShots: true,
          canEditShotLists: true,
          canManageCrew: false,
          canManageLocations: true,
          canApprove: false,
          canEditScript: true,
          canLockScript: false,
          canRunTableRead: true,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'client_reviewer':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: true,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: true,
          canRequestChanges: true,
          canViewEconomy: true,
        };
      case 'casting_director':
        return {
          canViewAll: true,
          canEditCasting: true,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'production_manager':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: true,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: true,
          canManageLocations: true,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'camera_team':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: true,
          canEditShotLists: true,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'writer':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: false,
          canRunTableRead: true,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'script_editor':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: true,
          canLockScript: true,
          canRunTableRead: true,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'reader':
        return {
          canViewAll: true,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: true,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      case 'agency':
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
      default:
        return {
          canViewAll: false,
          canEditCasting: false,
          canEditProduction: false,
          canEditShots: false,
          canEditShotLists: false,
          canManageCrew: false,
          canManageLocations: false,
          canApprove: false,
          canEditScript: false,
          canLockScript: false,
          canRunTableRead: false,
          canComment: false,
          canRequestChanges: false,
          canViewEconomy: false,
        };
    }
  },
};


