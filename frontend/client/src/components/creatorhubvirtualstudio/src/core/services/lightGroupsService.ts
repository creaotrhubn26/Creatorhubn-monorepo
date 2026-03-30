/**
 * Light Groups Service
 * 
 * Manages light groups for collective control and organization
 */

import type { SceneNode } from '@/core/models/scene';

export interface LightGroup {
  id: string;
  name: string;
  lightIds: string[]; // IDs of lights in this group
  role?: 'key' | 'fill' | 'rim' | 'background' | 'effects' | 'custom';
  color: string; // UI color for identification
  
  // Group controls
  groupPower: number; // Master power multiplier (0-1)
  ratioLock: boolean; // Lock relative power ratios between lights
  patternLock: boolean; // Lock lights to pattern positions
  
  // Group state
  isMuted: boolean; // Turn off all lights in group
  isSolo: boolean; // Solo this group (mute others)
  isLocked: boolean; // Prevent editing
  isVisible: boolean; // Show/hide in scene
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

type LightGroupRole = NonNullable<LightGroup['role']>;

class LightGroupsService {
  private groups: Map<string, LightGroup> = new Map();

  private isLightGroupRole(role: string): role is LightGroupRole {
    return ['key', 'fill', 'rim', 'background', 'effects', 'custom'].includes(role);
  }

  /**
   * Create a new light group
   */
  createGroup(
    name: string,
    lightIds: string[],
    role?: LightGroup['role'],
    color?: string
  ): LightGroup {
    const id = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const group: LightGroup = {
      id,
      name,
      lightIds,
      role: role || 'custom',
      color: color || this.getDefaultColorForRole(role || 'custom'),
      groupPower: 1.0,
      ratioLock: false,
      patternLock: false,
      isMuted: false,
      isSolo: false,
      isLocked: false,
      isVisible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.groups.set(id, group);
    return group;
  }

  /**
   * Get all groups
   */
  getAllGroups(): LightGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get group by ID
   */
  getGroup(groupId: string): LightGroup | undefined {
    return this.groups.get(groupId);
  }

  /**
   * Update group
   */
  updateGroup(groupId: string, updates: Partial<LightGroup>): LightGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const updated = {
      ...group,
      ...updates,
      updatedAt: new Date(),
    };

    this.groups.set(groupId, updated);
    return updated;
  }

  /**
   * Delete group
   */
  deleteGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  /**
   * Add light to group
   */
  addLightToGroup(groupId: string, lightId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    if (!group.lightIds.includes(lightId)) {
      group.lightIds.push(lightId);
      group.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Remove light from group
   */
  removeLightFromGroup(groupId: string, lightId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    const index = group.lightIds.indexOf(lightId);
    if (index > -1) {
      group.lightIds.splice(index, 1);
      group.updatedAt = new Date();
      return true;
    }

    return false;
  }

  /**
   * Get groups containing a specific light
   */
  getGroupsForLight(lightId: string): LightGroup[] {
    return Array.from(this.groups.values()).filter((group) =>
      group.lightIds.includes(lightId)
    );
  }

  /**
   * Auto-create groups from pattern context
   */
  autoCreateGroupsFromPattern(nodes: SceneNode[]): LightGroup[] {
    const roleGroups: Record<LightGroupRole, string[]> = {
      key: [],
      fill: [],
      rim: [],
      background: [],
      effects: [],
      custom: [],
    };

    // Group lights by role from pattern context
    nodes.forEach((node) => {
      if (node.type !== 'camera' && node.type !== 'model' && node.type !== 'backdrop' && node.type !== 'prop') {
        if (node.patternContext?.role) {
          const role = node.patternContext.role;
          if (this.isLightGroupRole(role)) {
            roleGroups[role].push(node.id);
          }
        }
      }
    });

    const createdGroups: LightGroup[] = [];

    // Create groups for each role that has lights
    Object.entries(roleGroups).forEach(([role, lightIds]) => {
      if (lightIds.length > 0) {
        const group = this.createGroup(
          `${role.charAt(0).toUpperCase() + role.slice(1)} Lights`,
          lightIds,
          role as LightGroup['role']
        );
        createdGroups.push(group);
      }
    });

    return createdGroups;
  }

  /**
   * Apply group power to all lights in group
   */
  applyGroupPower(groupId: string, nodes: SceneNode[]): SceneNode[] {
    const group = this.groups.get(groupId);
    if (!group) return nodes;

    return nodes.map((node) => {
      if (group.lightIds.includes(node.id) && node.light) {
        const basePower = node.light.power;
        const newPower = group.isMuted ? 0 : basePower * group.groupPower;

        return {
          ...node,
          light: {
            ...node.light,
            power: Math.max(0, Math.min(1, newPower)),
          },
        };
      }
      return node;
    });
  }

  /**
   * Get default color for role
   */
  private getDefaultColorForRole(role: LightGroup['role']): string {
    const colors: Record<LightGroupRole, string> = {
      key: '#FF6B6B', // Red
      fill: '#4ECDC4', // Cyan
      rim: '#FFE66D', // Yellow
      background: '#95E1D3', // Light green
      effects: '#A8E6CF', // Mint
      custom: '#64748B', // Gray
    };

    return colors[role ?? 'custom'];
  }

  /**
   * Clear all groups
   */
  clearAllGroups(): void {
    this.groups.clear();
  }
}

export const lightGroupsService = new LightGroupsService();
