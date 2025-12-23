/**
 * EquipmentGroupingService - Handle equipment grouping and linking
 * 
 * Features:
 * - Group multiple items (move/rotate together)
 * - Link light + modifier (always attached)
 * - Parent-child relationships
 * - Automatic grouping suggestions
 */

import * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export interface EquipmentNode {
  id: string;
  type: string;
  name: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  parentId?: string;
  childIds: string[];
  groupId?: string;
  linkedIds: string[]; // Always move together (e.g., light + softbox)
  userData?: Record<string, any>;
}

export interface EquipmentGroup {
  id: string;
  name: string;
  nodeIds: string[];
  pivot: THREE.Vector3;
  locked: boolean;
  color?: string;
}

export interface LinkSuggestion {
  sourceId: string;
  targetId: string;
  confidence: number;
  reason: string;
}

// ============================================================================
// Auto-linking rules
// ============================================================================

const LINKABLE_PAIRS: Array<{
  source: string[];
  target: string[];
  maxDistance: number;
  reason: string;
}> = [
  {
    source: ['monolight','strobe','flash','cob','led_panel'],
    target: ['softbox','octabox','beauty_dish','umbrella','snoot','barn_doors'],
    maxDistance: 0.5,
    reason: 'Light modifier attaches to light source',
  },
  {
    source: ['camera','camera_body'],
    target: ['lens','matte_box','follow_focus','cage'],
    maxDistance: 0.3,
    reason: 'Camera accessory attaches to camera',
  },
  {
    source: ['c_stand','light_stand'],
    target: ['monolight','strobe','led_panel','softbox'],
    maxDistance: 0.2,
    reason: 'Light mounts on stand',
  },
  {
    source: ['boom_pole'],
    target: ['shotgun_mic','shock_mount'],
    maxDistance: 0.3,
    reason: 'Microphone attaches to boom pole',
  },
  {
    source: ['mic_stand'],
    target: ['shotgun_mic','pop_filter'],
    maxDistance: 0.3,
    reason: 'Microphone mounts on stand',
  },
  {
    source: ['tripod'],
    target: ['camera','gimbal','slider'],
    maxDistance: 0.3,
    reason: 'Camera support equipment',
  },
];

// ============================================================================
// Service Implementation
// ============================================================================

class EquipmentGroupingService {
  private nodes: Map<string, EquipmentNode> = new Map();
  private groups: Map<string, EquipmentGroup> = new Map();
  private groupIdCounter = 0;

  // -------------------------------------------------------------------------
  // Node Management
  // -------------------------------------------------------------------------

  registerNode(node: EquipmentNode): void {
    this.nodes.set(node.id, {
      ...node,
      childIds: node.childIds || [],
      linkedIds: node.linkedIds || [],
    });
  }

  unregisterNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove from parent's children
    if (node.parentId) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((id) => id !== nodeId);
      }
    }

    // Remove from group
    if (node.groupId) {
      this.removeFromGroup(nodeId, node.groupId);
    }

    // Unlink from linked nodes
    node.linkedIds.forEach((linkedId) => {
      const linked = this.nodes.get(linkedId);
      if (linked) {
        linked.linkedIds = linked.linkedIds.filter((id) => id !== nodeId);
      }
    });

    this.nodes.delete(nodeId);
  }

  getNode(nodeId: string): EquipmentNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): EquipmentNode[] {
    return Array.from(this.nodes.values());
  }

  updateNodePosition(nodeId: string, position: THREE.Vector3): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const delta = position.clone().sub(node.position);
    node.position.copy(position);

    // Move children
    this.moveChildren(nodeId, delta);

    // Move linked nodes
    this.moveLinked(nodeId, delta);
  }

  private moveChildren(nodeId: string, delta: THREE.Vector3): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.childIds.forEach((childId) => {
      const child = this.nodes.get(childId);
      if (child) {
        child.position.add(delta);
        this.moveChildren(childId, delta);
      }
    });
  }

  private moveLinked(nodeId: string, delta: THREE.Vector3, visited = new Set<string>()): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.linkedIds.forEach((linkedId) => {
      if (visited.has(linkedId)) return;
      const linked = this.nodes.get(linkedId);
      if (linked) {
        linked.position.add(delta);
        this.moveLinked(linkedId, delta, visited);
      }
    });
  }

  updateNodeRotation(nodeId: string, rotation: THREE.Euler): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    const oldRotation = node.rotation.clone();
    node.rotation.copy(rotation);

    // Rotate children around this node's pivot
    const deltaQuaternion = new THREE.Quaternion().setFromEuler(rotation);
    const oldQuaternion = new THREE.Quaternion().setFromEuler(oldRotation);
    const rotationDelta = deltaQuaternion.multiply(oldQuaternion.invert());

    this.rotateChildren(nodeId, node.position, rotationDelta);
    this.rotateLinked(nodeId, node.position, rotationDelta);
  }

  private rotateChildren(
    nodeId: string,
    pivot: THREE.Vector3,
    quaternion: THREE.Quaternion
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.childIds.forEach((childId) => {
      const child = this.nodes.get(childId);
      if (child) {
        // Rotate position around pivot
        const offset = child.position.clone().sub(pivot);
        offset.applyQuaternion(quaternion);
        child.position.copy(pivot.clone().add(offset));

        // Add rotation to child
        const childQuat = new THREE.Quaternion().setFromEuler(child.rotation);
        childQuat.premultiply(quaternion);
        child.rotation.setFromQuaternion(childQuat);

        this.rotateChildren(childId, pivot, quaternion);
      }
    });
  }

  private rotateLinked(
    nodeId: string,
    pivot: THREE.Vector3,
    quaternion: THREE.Quaternion,
    visited = new Set<string>()
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.linkedIds.forEach((linkedId) => {
      if (visited.has(linkedId)) return;
      const linked = this.nodes.get(linkedId);
      if (linked) {
        // Rotate position around pivot
        const offset = linked.position.clone().sub(pivot);
        offset.applyQuaternion(quaternion);
        linked.position.copy(pivot.clone().add(offset));

        // Add rotation
        const linkedQuat = new THREE.Quaternion().setFromEuler(linked.rotation);
        linkedQuat.premultiply(quaternion);
        linked.rotation.setFromQuaternion(linkedQuat);

        this.rotateLinked(linkedId, pivot, quaternion, visited);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Linking (always move together, e.g., light + softbox)
  // -------------------------------------------------------------------------

  linkNodes(nodeId1: string, nodeId2: string): boolean {
    const node1 = this.nodes.get(nodeId1);
    const node2 = this.nodes.get(nodeId2);

    if (!node1 || !node2) return false;

    if (!node1.linkedIds.includes(nodeId2)) {
      node1.linkedIds.push(nodeId2);
    }
    if (!node2.linkedIds.includes(nodeId1)) {
      node2.linkedIds.push(nodeId1);
    }

    return true;
  }

  unlinkNodes(nodeId1: string, nodeId2: string): boolean {
    const node1 = this.nodes.get(nodeId1);
    const node2 = this.nodes.get(nodeId2);

    if (!node1 || !node2) return false;

    node1.linkedIds = node1.linkedIds.filter((id) => id !== nodeId2);
    node2.linkedIds = node2.linkedIds.filter((id) => id !== nodeId1);

    return true;
  }

  getLinkedNodes(nodeId: string): EquipmentNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    return node.linkedIds
      .map((id) => this.nodes.get(id))
      .filter((n): n is EquipmentNode => n !== undefined);
  }

  // -------------------------------------------------------------------------
  // Grouping (logical organization)
  // -------------------------------------------------------------------------

  createGroup(name: string, nodeIds: string[]): EquipmentGroup {
    const id = `group_${++this.groupIdCounter}_${Date.now()}`;

    // Calculate center pivot
    const positions = nodeIds
      .map((nid) => this.nodes.get(nid)?.position)
      .filter((p): p is THREE.Vector3 => p !== undefined);

    const pivot = new THREE.Vector3();
    if (positions.length > 0) {
      positions.forEach((p) => pivot.add(p));
      pivot.divideScalar(positions.length);
    }

    const group: EquipmentGroup = {
      id,
      name,
      nodeIds: [...nodeIds],
      pivot,
      locked: false,
    };

    this.groups.set(id, group);

    // Update nodes
    nodeIds.forEach((nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.groupId = id;
      }
    });

    return group;
  }

  dissolveGroup(groupId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    // Remove group reference from nodes
    group.nodeIds.forEach((nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.groupId = undefined;
      }
    });

    this.groups.delete(groupId);
    return true;
  }

  addToGroup(nodeId: string, groupId: string): boolean {
    const node = this.nodes.get(nodeId);
    const group = this.groups.get(groupId);

    if (!node || !group) return false;

    // Remove from old group
    if (node.groupId && node.groupId !== groupId) {
      this.removeFromGroup(nodeId, node.groupId);
    }

    if (!group.nodeIds.includes(nodeId)) {
      group.nodeIds.push(nodeId);
    }
    node.groupId = groupId;

    // Update pivot
    this.updateGroupPivot(groupId);

    return true;
  }

  removeFromGroup(nodeId: string, groupId: string): boolean {
    const node = this.nodes.get(nodeId);
    const group = this.groups.get(groupId);

    if (!node || !group) return false;

    group.nodeIds = group.nodeIds.filter((id) => id !== nodeId);
    node.groupId = undefined;

    // Dissolve empty groups
    if (group.nodeIds.length === 0) {
      this.groups.delete(groupId);
    } else {
      this.updateGroupPivot(groupId);
    }

    return true;
  }

  private updateGroupPivot(groupId: string): void {
    const group = this.groups.get(groupId);
    if (!group) return;

    const positions = group.nodeIds
      .map((nid) => this.nodes.get(nid)?.position)
      .filter((p): p is THREE.Vector3 => p !== undefined);

    if (positions.length > 0) {
      group.pivot.set(0, 0, 0);
      positions.forEach((p) => group.pivot.add(p));
      group.pivot.divideScalar(positions.length);
    }
  }

  getGroup(groupId: string): EquipmentGroup | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): EquipmentGroup[] {
    return Array.from(this.groups.values());
  }

  getGroupNodes(groupId: string): EquipmentNode[] {
    const group = this.groups.get(groupId);
    if (!group) return [];

    return group.nodeIds
      .map((id) => this.nodes.get(id))
      .filter((n): n is EquipmentNode => n !== undefined);
  }

  moveGroup(groupId: string, delta: THREE.Vector3): void {
    const group = this.groups.get(groupId);
    if (!group || group.locked) return;

    group.pivot.add(delta);

    group.nodeIds.forEach((nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.position.add(delta);
        // Also move linked nodes
        this.moveLinked(nodeId, delta, new Set([nodeId]));
      }
    });
  }

  rotateGroup(groupId: string, quaternion: THREE.Quaternion): void {
    const group = this.groups.get(groupId);
    if (!group || group.locked) return;

    group.nodeIds.forEach((nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        // Rotate position around group pivot
        const offset = node.position.clone().sub(group.pivot);
        offset.applyQuaternion(quaternion);
        node.position.copy(group.pivot.clone().add(offset));

        // Rotate node
        const nodeQuat = new THREE.Quaternion().setFromEuler(node.rotation);
        nodeQuat.premultiply(quaternion);
        node.rotation.setFromQuaternion(nodeQuat);
      }
    });
  }

  // -------------------------------------------------------------------------
  // Auto-linking suggestions
  // -------------------------------------------------------------------------

  getSuggestedLinks(nodeId: string): LinkSuggestion[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const suggestions: LinkSuggestion[] = [];
    const nodeType = this.getNodeType(node);

    this.nodes.forEach((otherNode, otherId) => {
      if (otherId === nodeId) return;
      if (node.linkedIds.includes(otherId)) return; // Already linked

      const otherType = this.getNodeType(otherNode);
      const distance = node.position.distanceTo(otherNode.position);

      // Check linkable pairs
      for (const pair of LINKABLE_PAIRS) {
        const isSourceMatch =
          pair.source.some((t) => nodeType.includes(t)) &&
          pair.target.some((t) => otherType.includes(t));
        const isTargetMatch =
          pair.target.some((t) => nodeType.includes(t)) &&
          pair.source.some((t) => otherType.includes(t));

        if ((isSourceMatch || isTargetMatch) && distance <= pair.maxDistance) {
          const confidence = 1 - distance / pair.maxDistance;
          suggestions.push({
            sourceId: nodeId,
            targetId: otherId,
            confidence,
            reason: pair.reason,
          });
        }
      }
    });

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  autoLinkNearby(nodeId: string, maxDistance = 0.5): string[] {
    const suggestions = this.getSuggestedLinks(nodeId);
    const linkedIds: string[] = [];

    for (const suggestion of suggestions) {
      if (suggestion.confidence > 0.5) {
        this.linkNodes(nodeId, suggestion.targetId);
        linkedIds.push(suggestion.targetId);
      }
    }

    return linkedIds;
  }

  private getNodeType(node: EquipmentNode): string {
    return (
      node.type?.toLowerCase() ||
      node.name?.toLowerCase() ||
      node.userData?.equipmentType?.toLowerCase() ||
      ''
    );
  }

  // -------------------------------------------------------------------------
  // Parent-Child relationships
  // -------------------------------------------------------------------------

  setParent(childId: string, parentId: string | undefined): boolean {
    const child = this.nodes.get(childId);
    if (!child) return false;

    // Remove from old parent
    if (child.parentId) {
      const oldParent = this.nodes.get(child.parentId);
      if (oldParent) {
        oldParent.childIds = oldParent.childIds.filter((id) => id !== childId);
      }
    }

    // Set new parent
    child.parentId = parentId;

    if (parentId) {
      const parent = this.nodes.get(parentId);
      if (parent && !parent.childIds.includes(childId)) {
        parent.childIds.push(childId);
      }
    }

    return true;
  }

  getChildren(nodeId: string): EquipmentNode[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    return node.childIds
      .map((id) => this.nodes.get(id))
      .filter((n): n is EquipmentNode => n !== undefined);
  }

  getParent(nodeId: string): EquipmentNode | undefined {
    const node = this.nodes.get(nodeId);
    if (!node?.parentId) return undefined;
    return this.nodes.get(node.parentId);
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  clear(): void {
    this.nodes.clear();
    this.groups.clear();
    this.groupIdCounter = 0;
  }

  serialize(): {
    nodes: EquipmentNode[];
    groups: EquipmentGroup[];
  } {
    return {
      nodes: this.getAllNodes().map((node) => ({
        ...node,
        position: node.position.clone(),
        rotation: node.rotation.clone(),
        scale: node.scale.clone(),
      })),
      groups: this.getAllGroups().map((group) => ({
        ...group,
        pivot: group.pivot.clone(),
      })),
    };
  }

  deserialize(data: { nodes: any[]; groups: any[] }): void {
    this.clear();

    data.nodes.forEach((nodeData) => {
      const node: EquipmentNode = {
        ...nodeData,
        position: new THREE.Vector3().copy(nodeData.position),
        rotation: new THREE.Euler().copy(nodeData.rotation),
        scale: new THREE.Vector3().copy(nodeData.scale),
      };
      this.nodes.set(node.id, node);
    });

    data.groups.forEach((groupData) => {
      const group: EquipmentGroup = {
        ...groupData,
        pivot: new THREE.Vector3().copy(groupData.pivot),
      };
      this.groups.set(group.id, group);
    });
  }

  // -------------------------------------------------------------------------
  // Advanced Grouping Features
  // -------------------------------------------------------------------------

  /**
   * Auto-group nodes by type
   */
  autoGroupByType(): EquipmentGroup[] {
    const typeGroups = new Map<string, string[]>();

    this.nodes.forEach((node, id) => {
      const type = this.getNodeType(node);
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(id);
    });

    const createdGroups: EquipmentGroup[] = [];

    typeGroups.forEach((nodeIds, type) => {
      if (nodeIds.length > 1) {
        // Only create group if multiple items of same type
        const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
        const group = this.createGroup(`${capitalizedType} Group`, nodeIds);
        createdGroups.push(group);
      }
    });

    return createdGroups;
  }

  /**
   * Auto-group nodes by spatial proximity
   */
  autoGroupByProximity(maxDistance = 2): EquipmentGroup[] {
    const ungroupedNodes = Array.from(this.nodes.values()).filter((n) => !n.groupId);
    const visited = new Set<string>();
    const createdGroups: EquipmentGroup[] = [];

    ungroupedNodes.forEach((node) => {
      if (visited.has(node.id)) return;

      const cluster: string[] = [node.id];
      visited.add(node.id);

      // Find nearby nodes
      ungroupedNodes.forEach((otherNode) => {
        if (visited.has(otherNode.id)) return;
        
        const distance = node.position.distanceTo(otherNode.position);
        if (distance <= maxDistance) {
          cluster.push(otherNode.id);
          visited.add(otherNode.id);
        }
      });

      if (cluster.length > 1) {
        const group = this.createGroup(`Cluster ${createdGroups.length + 1}`, cluster);
        createdGroups.push(group);
      }
    });

    return createdGroups;
  }

  /**
   * Copy a group with all its nodes
   */
  copyGroup(groupId: string, offset: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): EquipmentGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const newNodeIds: string[] = [];
    const nodeMapping = new Map<string, string>();

    // Copy all nodes in the group
    group.nodeIds.forEach((nodeId) => {
      const originalNode = this.nodes.get(nodeId);
      if (!originalNode) return;

      const newNode = this.copyNode(nodeId, offset);
      if (newNode) {
        newNodeIds.push(newNode.id);
        nodeMapping.set(nodeId, newNode.id);
      }
    });

    // Create new group
    const newGroup = this.createGroup(`${group.name} (Copy)`, newNodeIds);
    newGroup.color = group.color;

    // Preserve links within the copied group
    group.nodeIds.forEach((nodeId) => {
      const originalNode = this.nodes.get(nodeId);
      const newNodeId = nodeMapping.get(nodeId);
      if (!originalNode || !newNodeId) return;

      originalNode.linkedIds.forEach((linkedId) => {
        const newLinkedId = nodeMapping.get(linkedId);
        if (newLinkedId) {
          this.linkNodes(newNodeId, newLinkedId);
        }
      });
    });

    return newGroup;
  }

  /**
   * Copy a single node
   */
  copyNode(nodeId: string, offset: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): EquipmentNode | null {
    const original = this.nodes.get(nodeId);
    if (!original) return null;

    const newNode: EquipmentNode = {
      ...original,
      id: `${original.id}_copy_${Date.now()}`,
      position: original.position.clone().add(offset),
      rotation: original.rotation.clone(),
      scale: original.scale.clone(),
      parentId: undefined,
      childIds: [],
      groupId: undefined,
      linkedIds: [],
      userData: original.userData ? { ...original.userData } : undefined,
    };

    this.nodes.set(newNode.id, newNode);
    return newNode;
  }

  /**
   * Duplicate selected nodes
   */
  duplicateNodes(nodeIds: string[], offset: THREE.Vector3 = new THREE.Vector3(1, 0, 0)): string[] {
    const newIds: string[] = [];
    
    nodeIds.forEach((nodeId) => {
      const newNode = this.copyNode(nodeId, offset);
      if (newNode) {
        newIds.push(newNode.id);
      }
    });

    return newIds;
  }

  /**
   * Merge multiple groups into one
   */
  mergeGroups(groupIds: string[], newName?: string): EquipmentGroup | null {
    const allNodeIds: string[] = [];

    groupIds.forEach((groupId) => {
      const group = this.groups.get(groupId);
      if (group) {
        allNodeIds.push(...group.nodeIds);
        this.dissolveGroup(groupId);
      }
    });

    if (allNodeIds.length === 0) return null;

    return this.createGroup(newName || 'Merged Group', allNodeIds);
  }

  /**
   * Split a group at a specific node
   */
  splitGroup(groupId: string, splitNodeIds: string[]): EquipmentGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    // Remove nodes from original group
    splitNodeIds.forEach((nodeId) => {
      this.removeFromGroup(nodeId, groupId);
    });

    // Create new group with split nodes
    if (splitNodeIds.length > 0) {
      return this.createGroup(`${group.name} (Split)`, splitNodeIds);
    }

    return null;
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(type: string): EquipmentNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => this.getNodeType(node).toLowerCase() === type.toLowerCase()
    );
  }

  /**
   * Find orphaned nodes (no group, no links, no parent)
   */
  findOrphanedNodes(): EquipmentNode[] {
    return Array.from(this.nodes.values()).filter(
      (node) => !node.groupId && node.linkedIds.length === 0 && !node.parentId && node.childIds.length === 0
    );
  }

  /**
   * Get statistics about grouping
   */
  getStatistics(): {
    totalNodes: number;
    totalGroups: number;
    groupedNodes: number;
    linkedNodes: number;
    orphanedNodes: number;
    nodesByType: Record<string, number>;
  } {
    const nodes = Array.from(this.nodes.values());
    const nodesByType: Record<string, number> = {};

    nodes.forEach((node) => {
      const type = this.getNodeType(node);
      nodesByType[type] = (nodesByType[type] || 0) + 1;
    });

    return {
      totalNodes: nodes.length,
      totalGroups: this.groups.size,
      groupedNodes: nodes.filter((n) => n.groupId).length,
      linkedNodes: nodes.filter((n) => n.linkedIds.length > 0).length,
      orphanedNodes: this.findOrphanedNodes().length,
      nodesByType,
    };
  }

  /**
   * Align nodes in a group (horizontal, vertical, or grid)
   */
  alignGroup(groupId: string, alignment: 'horizontal' | 'vertical' | 'grid', spacing = 1): void {
    const group = this.groups.get(groupId);
    if (!group || group.locked) return;

    const nodes = this.getGroupNodes(groupId);
    if (nodes.length === 0) return;

    const startPos = group.pivot.clone();

    nodes.forEach((node, index) => {
      switch (alignment) {
        case 'horizontal':
          node.position.set(startPos.x + index * spacing, startPos.y, startPos.z);
          break;
        case 'vertical':
          node.position.set(startPos.x, startPos.y + index * spacing, startPos.z);
          break;
        case 'grid':
          const cols = Math.ceil(Math.sqrt(nodes.length));
          const row = Math.floor(index / cols);
          const col = index % cols;
          node.position.set(startPos.x + col * spacing, startPos.y, startPos.z + row * spacing);
          break;
      }
    });
  }

  /**
   * Distribute nodes evenly within a group
   */
  distributeGroup(groupId: string, axis: 'x' | 'y' |'z'): void {
    const group = this.groups.get(groupId);
    if (!group || group.locked) return;

    const nodes = this.getGroupNodes(groupId);
    if (nodes.length < 3) return;

    // Sort by position on axis
    nodes.sort((a, b) => a.position[axis] - b.position[axis]);

    const first = nodes[0].position[axis];
    const last = nodes[nodes.length - 1].position[axis];
    const spacing = (last - first) / (nodes.length - 1);

    nodes.forEach((node, index) => {
      node.position[axis] = first + index * spacing;
    });
  }
}

// Export singleton
export const equipmentGroupingService = new EquipmentGroupingService();

export default equipmentGroupingService;

