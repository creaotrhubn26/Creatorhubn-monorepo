/**
 * UndoRedoService - Undo/Redo history for Virtual Studio actions
 * 
 * Features:
 * - Action-based undo/redo
 * - History limit (configurable)
 * - Action batching
 * - Serializable history
 */

import type * as THREE from 'three';

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'ADD_EQUIPMENT'
  | 'DELETE_EQUIPMENT'
  | 'MOVE'
  | 'ROTATE'
  | 'SCALE'
  | 'UPDATE_PROPERTY'
  | 'GROUP'
  | 'UNGROUP'
  | 'LINK'
  | 'UNLINK'
  | 'BATCH'
  | 'LOAD_PRESET'
  | 'CLEAR_SCENE';

export interface BaseAction {
  id: string;
  type: ActionType;
  timestamp: number;
  description: string;
}

export interface AddEquipmentAction extends BaseAction {
  type: 'ADD_EQUIPMENT';
  nodeId: string;
  nodeData: any; // Serialized node data
}

export interface DeleteEquipmentAction extends BaseAction {
  type: 'DELETE_EQUIPMENT';
  nodeId: string;
  nodeData: any; // For restore
}

export interface MoveAction extends BaseAction {
  type: 'MOVE';
  nodeIds: string[];
  oldPositions: Array<{ x: number; y: number; z: number }>;
  newPositions: Array<{ x: number; y: number; z: number }>;
}

export interface RotateAction extends BaseAction {
  type: 'ROTATE';
  nodeIds: string[];
  oldRotations: Array<{ x: number; y: number; z: number }>;
  newRotations: Array<{ x: number; y: number; z: number }>;
}

export interface ScaleAction extends BaseAction {
  type: 'SCALE';
  nodeIds: string[];
  oldScales: Array<{ x: number; y: number; z: number }>;
  newScales: Array<{ x: number; y: number; z: number }>;
}

export interface UpdatePropertyAction extends BaseAction {
  type: 'UPDATE_PROPERTY';
  nodeId: string;
  property: string;
  oldValue: any;
  newValue: any;
}

export interface GroupAction extends BaseAction {
  type: 'GROUP';
  groupId: string;
  nodeIds: string[];
}

export interface UngroupAction extends BaseAction {
  type: 'UNGROUP';
  groupId: string;
  groupData: any; // For restore
}

export interface LinkAction extends BaseAction {
  type: 'LINK';
  nodeId1: string;
  nodeId2: string;
}

export interface UnlinkAction extends BaseAction {
  type: 'UNLINK';
  nodeId1: string;
  nodeId2: string;
}

export interface BatchAction extends BaseAction {
  type: 'BATCH';
  actions: Action[];
}

export interface LoadPresetAction extends BaseAction {
  type: 'LOAD_PRESET';
  presetId: string;
  previousSceneData: any; // For restore
}

export interface ClearSceneAction extends BaseAction {
  type: 'CLEAR_SCENE';
  previousSceneData: any; // For restore
}

export type Action =
  | AddEquipmentAction
  | DeleteEquipmentAction
  | MoveAction
  | RotateAction
  | ScaleAction
  | UpdatePropertyAction
  | GroupAction
  | UngroupAction
  | LinkAction
  | UnlinkAction
  | BatchAction
  | LoadPresetAction
  | ClearSceneAction;

export interface UndoRedoState {
  undoStack: Action[];
  redoStack: Action[];
  canUndo: boolean;
  canRedo: boolean;
  lastAction: Action | null;
}

// ============================================================================
// Service Implementation
// ============================================================================

export interface UndoRedoCallbacks {
  onAddEquipment?: (nodeData: any) => void;
  onDeleteEquipment?: (nodeId: string) => void;
  onRestoreEquipment?: (nodeData: any) => void;
  onMove?: (nodeIds: string[], positions: Array<{ x: number; y: number; z: number }>) => void;
  onRotate?: (nodeIds: string[], rotations: Array<{ x: number; y: number; z: number }>) => void;
  onScale?: (nodeIds: string[], scales: Array<{ x: number; y: number; z: number }>) => void;
  onUpdateProperty?: (nodeId: string, property: string, value: any) => void;
  onGroup?: (groupId: string, nodeIds: string[]) => void;
  onUngroup?: (groupId: string) => void;
  onRestoreGroup?: (groupData: any) => void;
  onLink?: (nodeId1: string, nodeId2: string) => void;
  onUnlink?: (nodeId1: string, nodeId2: string) => void;
  onRestoreScene?: (sceneData: any) => void;
}

class UndoRedoService {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  private maxHistory: number = 50;
  private actionIdCounter: number = 0;
  private callbacks: UndoRedoCallbacks = {};
  private batchMode: boolean = false;
  private batchActions: Action[] = [];
  private listeners: Set<(state: UndoRedoState) => void> = new Set();

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  // -------------------------------------------------------------------------
  // Callbacks
  // -------------------------------------------------------------------------

  setCallbacks(callbacks: UndoRedoCallbacks): void {
    this.callbacks = callbacks;
  }

  // -------------------------------------------------------------------------
  // State subscription
  // -------------------------------------------------------------------------

  subscribe(listener: (state: UndoRedoState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  getState(): UndoRedoState {
    return {
      undoStack: [...this.undoStack],
      redoStack: [...this.redoStack],
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      lastAction: this.undoStack[this.undoStack.length - 1] || null,
    };
  }

  // -------------------------------------------------------------------------
  // Action Recording
  // -------------------------------------------------------------------------

  private generateActionId(): string {
    return `action_${++this.actionIdCounter}_${Date.now()}`;
  }

  private pushAction(action: Action): void {
    if (this.batchMode) {
      this.batchActions.push(action);
      return;
    }

    this.undoStack.push(action);
    this.redoStack = []; // Clear redo stack on new action

    // Trim history if needed
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify();
  }

  // -------------------------------------------------------------------------
  // Batch Operations
  // -------------------------------------------------------------------------

  startBatch(): void {
    this.batchMode = true;
    this.batchActions = [];
  }

  endBatch(description: string): void {
    this.batchMode = false;

    if (this.batchActions.length === 0) return;

    if (this.batchActions.length === 1) {
      // Just push the single action
      this.undoStack.push(this.batchActions[0]);
    } else {
      // Create batch action
      const batchAction: BatchAction = {
        id: this.generateActionId(),
        type: 'BATCH',
        timestamp: Date.now(),
        description,
        actions: [...this.batchActions],
      };
      this.undoStack.push(batchAction);
    }

    this.batchActions = [];
    this.redoStack = [];

    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify();
  }

  cancelBatch(): void {
    this.batchMode = false;
    this.batchActions = [];
  }

  // -------------------------------------------------------------------------
  // Record Actions
  // -------------------------------------------------------------------------

  recordAdd(nodeId: string, nodeData: any, description?: string): void {
    const action: AddEquipmentAction = {
      id: this.generateActionId(),
      type: 'ADD_EQUIPMENT',
      timestamp: Date.now(),
      description: description || `Add ${nodeData.name || 'equipment'}`,
      nodeId,
      nodeData,
    };
    this.pushAction(action);
  }

  recordDelete(nodeId: string, nodeData: any, description?: string): void {
    const action: DeleteEquipmentAction = {
      id: this.generateActionId(),
      type: 'DELETE_EQUIPMENT',
      timestamp: Date.now(),
      description: description || `Delete ${nodeData.name || 'equipment'}`,
      nodeId,
      nodeData,
    };
    this.pushAction(action);
  }

  recordMove(
    nodeIds: string[],
    oldPositions: THREE.Vector3[] | Array<{ x: number; y: number; z: number }>,
    newPositions: THREE.Vector3[] | Array<{ x: number; y: number; z: number }>,
    description?: string
  ): void {
    const serializePos = (p: THREE.Vector3 | { x: number; y: number; z: number }) => ({
      x: p.x,
      y: p.y,
      z: p.z,
    });

    const action: MoveAction = {
      id: this.generateActionId(),
      type: 'MOVE',
      timestamp: Date.now(),
      description: description || `Move ${nodeIds.length} item(s)`,
      nodeIds,
      oldPositions: oldPositions.map(serializePos),
      newPositions: newPositions.map(serializePos),
    };
    this.pushAction(action);
  }

  recordRotate(
    nodeIds: string[],
    oldRotations: THREE.Euler[] | Array<{ x: number; y: number; z: number }>,
    newRotations: THREE.Euler[] | Array<{ x: number; y: number; z: number }>,
    description?: string
  ): void {
    const serializeRot = (r: THREE.Euler | { x: number; y: number; z: number }) => ({
      x: r.x,
      y: r.y,
      z: r.z,
    });

    const action: RotateAction = {
      id: this.generateActionId(),
      type: 'ROTATE',
      timestamp: Date.now(),
      description: description || `Rotate ${nodeIds.length} item(s)`,
      nodeIds,
      oldRotations: oldRotations.map(serializeRot),
      newRotations: newRotations.map(serializeRot),
    };
    this.pushAction(action);
  }

  recordScale(
    nodeIds: string[],
    oldScales: THREE.Vector3[] | Array<{ x: number; y: number; z: number }>,
    newScales: THREE.Vector3[] | Array<{ x: number; y: number; z: number }>,
    description?: string
  ): void {
    const serializeScale = (s: THREE.Vector3 | { x: number; y: number; z: number }) => ({
      x: s.x,
      y: s.y,
      z: s.z,
    });

    const action: ScaleAction = {
      id: this.generateActionId(),
      type: 'SCALE',
      timestamp: Date.now(),
      description: description || `Scale ${nodeIds.length} item(s)`,
      nodeIds,
      oldScales: oldScales.map(serializeScale),
      newScales: newScales.map(serializeScale),
    };
    this.pushAction(action);
  }

  recordPropertyChange(
    nodeId: string,
    property: string,
    oldValue: any,
    newValue: any,
    description?: string
  ): void {
    const action: UpdatePropertyAction = {
      id: this.generateActionId(),
      type: 'UPDATE_PROPERTY',
      timestamp: Date.now(),
      description: description || `Change ${property}`,
      nodeId,
      property,
      oldValue,
      newValue,
    };
    this.pushAction(action);
  }

  recordGroup(groupId: string, nodeIds: string[], description?: string): void {
    const action: GroupAction = {
      id: this.generateActionId(),
      type: 'GROUP',
      timestamp: Date.now(),
      description: description || `Group ${nodeIds.length} items`,
      groupId,
      nodeIds,
    };
    this.pushAction(action);
  }

  recordUngroup(groupId: string, groupData: any, description?: string): void {
    const action: UngroupAction = {
      id: this.generateActionId(),
      type: 'UNGROUP',
      timestamp: Date.now(),
      description: description || 'Ungroup',
      groupId,
      groupData,
    };
    this.pushAction(action);
  }

  recordLink(nodeId1: string, nodeId2: string, description?: string): void {
    const action: LinkAction = {
      id: this.generateActionId(),
      type: 'LINK',
      timestamp: Date.now(),
      description: description || 'Link equipment',
      nodeId1,
      nodeId2,
    };
    this.pushAction(action);
  }

  recordUnlink(nodeId1: string, nodeId2: string, description?: string): void {
    const action: UnlinkAction = {
      id: this.generateActionId(),
      type: 'UNLINK',
      timestamp: Date.now(),
      description: description || 'Unlink equipment',
      nodeId1,
      nodeId2,
    };
    this.pushAction(action);
  }

  recordLoadPreset(presetId: string, previousSceneData: any, description?: string): void {
    const action: LoadPresetAction = {
      id: this.generateActionId(),
      type: 'LOAD_PRESET',
      timestamp: Date.now(),
      description: description || `Load, preset: ${presetId}`,
      presetId,
      previousSceneData,
    };
    this.pushAction(action);
  }

  recordClearScene(previousSceneData: any, description?: string): void {
    const action: ClearSceneAction = {
      id: this.generateActionId(),
      type: 'CLEAR_SCENE',
      timestamp: Date.now(),
      description: description || 'Clear scene',
      previousSceneData,
    };
    this.pushAction(action);
  }

  // -------------------------------------------------------------------------
  // Undo/Redo
  // -------------------------------------------------------------------------

  undo(): boolean {
    if (this.undoStack.length === 0) return false;

    const action = this.undoStack.pop()!;
    this.redoStack.push(action);

    this.applyUndo(action);
    this.notify();

    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;

    const action = this.redoStack.pop()!;
    this.undoStack.push(action);

    this.applyRedo(action);
    this.notify();

    return true;
  }

  private applyUndo(action: Action): void {
    switch (action.type) {
      case 'ADD_EQUIPMENT':
        this.callbacks.onDeleteEquipment?.(action.nodeId);
        break;

      case 'DELETE_EQUIPMENT':
        this.callbacks.onRestoreEquipment?.(action.nodeData);
        break;

      case 'MOVE':
        this.callbacks.onMove?.(action.nodeIds, action.oldPositions);
        break;

      case 'ROTATE':
        this.callbacks.onRotate?.(action.nodeIds, action.oldRotations);
        break;

      case 'SCALE':
        this.callbacks.onScale?.(action.nodeIds, action.oldScales);
        break;

      case 'UPDATE_PROPERTY':
        this.callbacks.onUpdateProperty?.(action.nodeId, action.property, action.oldValue);
        break;

      case 'GROUP':
        this.callbacks.onUngroup?.(action.groupId);
        break;

      case 'UNGROUP':
        this.callbacks.onRestoreGroup?.(action.groupData);
        break;

      case 'LINK':
        this.callbacks.onUnlink?.(action.nodeId1, action.nodeId2);
        break;

      case 'UNLINK':
        this.callbacks.onLink?.(action.nodeId1, action.nodeId2);
        break;

      case 'BATCH':
        // Undo in reverse order
        for (let i = action.actions.length - 1; i >= 0; i--) {
          this.applyUndo(action.actions[i]);
        }
        break;

      case 'LOAD_PRESET':
      case 'CLEAR_SCENE':
        this.callbacks.onRestoreScene?.(action.previousSceneData);
        break;
    }
  }

  private applyRedo(action: Action): void {
    switch (action.type) {
      case 'ADD_EQUIPMENT':
        this.callbacks.onRestoreEquipment?.(action.nodeData);
        break;

      case 'DELETE_EQUIPMENT':
        this.callbacks.onDeleteEquipment?.(action.nodeId);
        break;

      case 'MOVE':
        this.callbacks.onMove?.(action.nodeIds, action.newPositions);
        break;

      case 'ROTATE':
        this.callbacks.onRotate?.(action.nodeIds, action.newRotations);
        break;

      case 'SCALE':
        this.callbacks.onScale?.(action.nodeIds, action.newScales);
        break;

      case 'UPDATE_PROPERTY':
        this.callbacks.onUpdateProperty?.(action.nodeId, action.property, action.newValue);
        break;

      case 'GROUP':
        this.callbacks.onGroup?.(action.groupId, action.nodeIds);
        break;

      case 'UNGROUP':
        this.callbacks.onUngroup?.(action.groupId);
        break;

      case 'LINK':
        this.callbacks.onLink?.(action.nodeId1, action.nodeId2);
        break;

      case 'UNLINK':
        this.callbacks.onUnlink?.(action.nodeId1, action.nodeId2);
        break;

      case 'BATCH':
        // Redo in original order
        action.actions.forEach((a) => this.applyRedo(a));
        break;

      case 'LOAD_PRESET':
        // Re-load the preset (would need preset data stored)
        break;

      case'CLEAR_SCENE':
        // Re-clear the scene
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  getUndoDescription(): string | null {
    const action = this.undoStack[this.undoStack.length - 1];
    return action?.description || null;
  }

  getRedoDescription(): string | null {
    const action = this.redoStack[this.redoStack.length - 1];
    return action?.description || null;
  }

  getHistory(): Action[] {
    return [...this.undoStack];
  }

  setMaxHistory(max: number): void {
    this.maxHistory = max;
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
}

// Export singleton
export const undoRedoService = new UndoRedoService();

export default undoRedoService;

