import type { CastingProject, UserRole } from '../models/casting';
import { castingService } from './castingService';

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
   * Generate share link (for future implementation with backend)
   */
  generateShareLink(projectId: string, role: UserRole['role']): string {
    // In a real implementation, this would generate a secure token
    // For now, return a placeholder
    return `${window.location.origin}/casting/${projectId}?role=${role}`;
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





