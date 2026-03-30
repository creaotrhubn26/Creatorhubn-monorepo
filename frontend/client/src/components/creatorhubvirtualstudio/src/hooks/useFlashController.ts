/**
 * useFlashController - Hook for Managing Wireless Flash Controller State
 * 
 * Provides:
 * - Controller selection and configuration
 * - Group management (power, mode, enable/disable)
 * - Scene light synchronization
 * - Test fire simulation
 * - Channel management
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNodes, useActions } from '../state/selectors';
import {
  ALL_FLASH_CONTROLLERS,
  type FlashController,
  type FlashGroup,
  getControllerById,
  findControllersForLight,
  createDefaultGroups,
  powerToStops,
  stopsToPower,
  formatPowerFraction,
  formatPowerStops,
} from '../core/data/FlashControllerData';

// ============================================================================
// Types
// ============================================================================

export interface ConnectedLight {
  nodeId: string;
  nodeName: string;
  brand: string;
  model: string;
  groupId: string;
  groupName: string;
  currentPower: number;
  wattage: number;
  lightType: string;
}

export interface FlashControllerState {
  controller: FlashController | null;
  groups: FlashGroup[];
  channel: number;
  connectedLights: ConnectedLight[];
  isSyncing: boolean;
  lastTestFire: number | null;
  hssEnabled: boolean;
  ttlEnabled: boolean;
}

export interface UseFlashControllerReturn {
  // State
  state: FlashControllerState;
  
  // Controller Selection
  availableControllers: FlashController[];
  selectController: (controllerId: string) => void;
  clearController: () => void;
  
  // Group Management
  updateGroup: (groupId: string, updates: Partial<FlashGroup>) => void;
  toggleGroup: (groupId: string) => void;
  setGroupPower: (groupId: string, power: number) => void;
  setGroupPowerStops: (groupId: string, stops: number) => void;
  adjustGroupPower: (groupId: string, deltaStops: number) => void;
  setGroupMode: (groupId: string, mode: FlashGroup['powerMode']) => void;
  toggleModelingLight: (groupId: string) => void;
  
  // Light Assignment
  assignLightToGroup: (nodeId: string, groupId: string) => void;
  unassignLight: (nodeId: string) => void;
  getUnassignedLights: () => any[];
  
  // Channel
  setChannel: (channel: number) => void;
  
  // Actions
  testFire: (groupId?: string) => void;
  syncToScene: () => void;
  toggleHSS: () => void;
  toggleTTL: () => void;
  
  // Utilities
  formatPower: (power: number) => string;
  formatStops: (stops: number) => string;
  canControlLight: (lightBrand: string) => boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useFlashController(): UseFlashControllerReturn {
  const nodes = useNodes();
  const { updateNode } = useActions();
  
  // State
  const [controller, setController] = useState<FlashController | null>(null);
  const [groups, setGroups] = useState<FlashGroup[]>([]);
  const [channel, setChannel] = useState(1);
  const [lightAssignments, setLightAssignments] = useState<Record<string, string>>({}); // nodeId -> groupId
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastTestFire, setLastTestFire] = useState<number | null>(null);
  const [hssEnabled, setHssEnabled] = useState(false);
  const [ttlEnabled, setTtlEnabled] = useState(false);
  
  // Get lights from scene
  const sceneLights = useMemo(() => {
    return nodes.filter((n) => n.light && n.visible !== false);
  }, [nodes]);
  
  // Build connected lights list
  const connectedLights = useMemo<ConnectedLight[]>(() => {
    return sceneLights
      .filter((light) => lightAssignments[light.id])
      .map((light) => {
        const groupId = lightAssignments[light.id];
        const group = groups.find((g) => g.id === groupId);
        const userData = light.userData;
        
        return {
          nodeId: light.id,
          nodeName: light.name || 'Light',
          brand: userData.brand ?? 'Unknown',
          model: userData.model ?? 'Unknown',
          groupId,
          groupName: group?.name || '?',
          currentPower: light.light?.power || 0.5,
          wattage: userData.wattage ?? 500,
          lightType: userData.lightType ?? 'strobe',
        };
      });
  }, [sceneLights, lightAssignments, groups]);
  
  // Available controllers based on scene lights
  const availableControllers = useMemo(() => {
    const compatibleControllers = sceneLights.flatMap((light) => {
      const brand = light.userData.brand?.trim();
      return brand ? findControllersForLight(brand) : [];
    });

    if (compatibleControllers.length === 0) {
      return ALL_FLASH_CONTROLLERS;
    }

    const seen = new Set<string>();
    return compatibleControllers.filter((controller) => {
      if (seen.has(controller.id)) {
        return false;
      }

      seen.add(controller.id);
      return true;
    });
  }, [sceneLights]);
  
  // Select controller
  const selectController = useCallback((controllerId: string) => {
    const ctrl = getControllerById(controllerId);
    if (!ctrl) return;
    
    setController(ctrl);
    setGroups(createDefaultGroups(ctrl));
    setChannel(ctrl.channelRange[0]);
    setHssEnabled(ctrl.supportsHSS);
    setTtlEnabled(false); // Start in manual mode
    
    // Auto-assign lights to groups based on order
    const newAssignments: Record<string, string> = {};
    sceneLights.forEach((light, index) => {
      const groupIndex = index % ctrl.groupNames.length;
      const group = createDefaultGroups(ctrl)[groupIndex];
      newAssignments[light.id] = group.id;
    });
    setLightAssignments(newAssignments);
  }, [sceneLights]);
  
  // Clear controller
  const clearController = useCallback(() => {
    setController(null);
    setGroups([]);
    setLightAssignments({});
  }, []);
  
  // Update group
  const updateGroup = useCallback((groupId: string, updates: Partial<FlashGroup>) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, ...updates } : g))
    );
  }, []);
  
  // Toggle group enabled
  const toggleGroup = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, enabled: !g.enabled } : g))
    );
  }, []);
  
  // Set group power (normalized 0-1)
  const setGroupPower = useCallback((groupId: string, power: number) => {
    const clampedPower = Math.max(0, Math.min(1, power));
    updateGroup(groupId, { power: clampedPower });
  }, [updateGroup]);
  
  // Set group power in stops
  const setGroupPowerStops = useCallback((groupId: string, stops: number) => {
    if (!controller) return;
    const clampedStops = Math.max(controller.powerRange[0], Math.min(controller.powerRange[1], stops));
    const power = stopsToPower(clampedStops, controller.powerRange[1]);
    updateGroup(groupId, { power, powerStops: clampedStops });
  }, [controller, updateGroup]);
  
  // Adjust power by delta stops
  const adjustGroupPower = useCallback((groupId: string, deltaStops: number) => {
    if (!controller) return;
    
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) return g;
        
        const currentStops = g.powerStops ?? powerToStops(g.power, controller.powerRange[1]);
        const newStops = Math.max(
          controller.powerRange[0],
          Math.min(controller.powerRange[1], currentStops + deltaStops)
        );
        const newPower = stopsToPower(newStops, controller.powerRange[1]);
        
        return { ...g, power: newPower, powerStops: newStops };
      })
    );
  }, [controller]);
  
  // Set group mode
  const setGroupMode = useCallback((groupId: string, mode: FlashGroup['powerMode']) => {
    updateGroup(groupId, { powerMode: mode });
  }, [updateGroup]);
  
  // Toggle modeling light
  const toggleModelingLight = useCallback((groupId: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, modelingLight: !g.modelingLight } : g))
    );
  }, []);
  
  // Assign light to group
  const assignLightToGroup = useCallback((nodeId: string, groupId: string) => {
    setLightAssignments((prev) => ({ ...prev, [nodeId]: groupId }));
  }, []);
  
  // Unassign light
  const unassignLight = useCallback((nodeId: string) => {
    setLightAssignments((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
  }, []);
  
  // Get unassigned lights
  const getUnassignedLights = useCallback(() => {
    return sceneLights.filter((light) => !lightAssignments[light.id]);
  }, [sceneLights, lightAssignments]);
  
  // Test fire
  const testFire = useCallback((groupId?: string) => {
    setLastTestFire(Date.now());
    
    // Visual feedback - briefly flash the lights
    const lightsToFire = groupId
      ? connectedLights.filter((l) => l.groupId === groupId)
      : connectedLights.filter((l) => {
          const group = groups.find((g) => g.id === l.groupId);
          return group?.enabled;
        });
    
    // Simulate flash by temporarily maxing power
    lightsToFire.forEach((light) => {
      const node = nodes.find((n) => n.id === light.nodeId);
      if (!node) return;
      
      // Store original power
      const originalPower = node.light?.power || 0.5;
      
      // Flash to max
      updateNode(node.id, {
        light: { ...node.light, power: 1 },
      });
      
      // Restore after 100ms
      setTimeout(() => {
        updateNode(node.id, {
          light: { ...node.light, power: originalPower },
        });
      }, 100);
    });
  }, [connectedLights, groups, nodes, updateNode]);
  
  // Sync controller settings to scene lights
  const syncToScene = useCallback(() => {
    setIsSyncing(true);
    
    connectedLights.forEach((light) => {
      const group = groups.find((g) => g.id === light.groupId);
      if (!group) return;
      
      const node = nodes.find((n) => n.id === light.nodeId);
      if (!node) return;
      
      // Calculate power based on group settings
      let power = group.enabled ? group.power : 0;
      
      // Apply TTL compensation if in TTL mode
      if (group.powerMode === 'ttl' && group.powerStops !== undefined) {
        // TTL compensation is additive to base power
        power = Math.max(0, Math.min(1, power + (group.powerStops - 5) / 10));
      }
      
      // Update scene node
      updateNode(node.id, {
        light: {
          ...node.light,
          power,
        },
        userData: {
          ...node.userData,
          flashGroup: group.name,
          flashGroupId: group.id,
          flashMode: group.powerMode,
          modelingLight: group.modelingLight,
        },
      });
    });
    
    setTimeout(() => setIsSyncing(false), 300);
  }, [connectedLights, groups, nodes, updateNode]);
  
  // Toggle HSS
  const toggleHSS = useCallback(() => {
    if (!controller?.supportsHSS) return;
    setHssEnabled((prev) => !prev);
  }, [controller]);
  
  // Toggle TTL
  const toggleTTL = useCallback(() => {
    if (!controller?.supportsTTL) return;
    setTtlEnabled((prev) => !prev);
    
    // Switch all groups to TTL or Manual mode
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        powerMode: !ttlEnabled ? 'ttl' : 'manual',
      }))
    );
  }, [controller, ttlEnabled]);
  
  // Format power as fraction
  const formatPower = useCallback((power: number) => {
    return formatPowerFraction(power);
  }, []);
  
  // Format stops
  const formatStops = useCallback((stops: number) => {
    return formatPowerStops(stops);
  }, []);
  
  // Check if controller can control a light brand
  const canControlLight = useCallback((lightBrand: string) => {
    if (!controller) return false;
    const brand = lightBrand.trim();

    return findControllersForLight(brand).some((supportedController) => supportedController.id === controller.id);
  }, [controller]);
  
  // Auto-sync when groups change
  useEffect(() => {
    if (controller && connectedLights.length > 0) {
      syncToScene();
    }
  }, [controller, connectedLights, syncToScene]);
  
  // Build state object
  const state: FlashControllerState = {
    controller,
    groups,
    channel,
    connectedLights,
    isSyncing,
    lastTestFire,
    hssEnabled,
    ttlEnabled,
  };
  
  return {
    state,
    availableControllers,
    selectController,
    clearController,
    updateGroup,
    toggleGroup,
    setGroupPower,
    setGroupPowerStops,
    adjustGroupPower,
    setGroupMode,
    toggleModelingLight,
    assignLightToGroup,
    unassignLight,
    getUnassignedLights,
    setChannel,
    testFire,
    syncToScene,
    toggleHSS,
    toggleTTL,
    formatPower,
    formatStops,
    canControlLight,
  };
}
