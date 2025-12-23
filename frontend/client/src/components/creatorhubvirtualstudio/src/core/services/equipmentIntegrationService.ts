/**
 * EquipmentIntegrationService - Handles adding equipment to the Virtual Studio
 * 
 * Features:
 * - Model function mapping
 * - Drag-and-drop integration
 * - Scene preset loading
 * - Equipment positioning
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('EquipmentIntegration');

// Import all model generators
import {
  createMonolightModel,
  createLEDPanelModel,
  createFresnelModel,
  createRingLightModel,
  createTubeLightModel,
  createCOBLightModel,
  createPracticalLightModel,
} from '../models/StudioLightModels';

import {
  createSoftboxModel,
  createOctaboxModel,
  createBeautyDishModel,
  createUmbrellaModel,
  createSnootModel,
  createBarnDoorsModel,
  createGelFrameModel,
  createGoboModel,
} from '../models/LightModifierModels';

import {
  createSliderModel,
  createDollyModel,
  createJibModel,
  createGimbalModel,
  createCameraCageModel,
  createFollowFocusModel,
  createMatteBoxModel,
  createCameraRailsModel,
} from '../models/CameraMotionModels';

import {
  createBoomPoleModel,
  createMicStandModel,
  createShotgunMicModel,
  createLavalierModel,
  createAudioRecorderModel,
  createHeadphonesModel,
  createPopFilterModel,
  createShockMountModel,
} from '../models/AudioEquipmentModels';

import {
  createPosingStoolModel,
  createDirectorChairModel,
  createMakeupStationModel,
  createWardrobeRackModel,
  createPlantModel,
  createCouchModel,
  createDeskModel,
} from '../models/SetFurnitureModels';

import {
  createTeleprompterModel,
  createMonitorModel,
  createClapperboardModel,
  createCartModel,
  createPowerDistroModel,
  createCableRampModel,
} from '../models/VideoProductionModels';

import {
  createHazeMachineModel,
  createFanModel,
  createRainRigModel,
  createMirrorBoardModel,
} from '../models/SpecialEffectsModels';

import {
  createMaferClampModel,
  createCardelliniClampModel,
  createSpeedRailModel,
  createGripHeadModel,
  createMenaceArmModel,
  createWallSpreaderModel,
  createSpigotAdapterModel,
} from '../models/GripHardwareModels';

// Also import from existing models
import {
  createCStandModel,
  createLightStandModel,
  createTripodModel,
  createSandbagModel,
  createAppleBoxModel,
  createBackdropStandModel,
} from '../models/StudioSupportModels';

import {
  createSeamlessBackdropModel,
  createCycloramaModel,
  createVFlatModel,
  createProductTableModel,
  createLightGridModel,
  createScrimFlagModel,
  createDiffusionFrameModel,
  createTexturedBackdropModel,
} from '../models/StudioBackdropModels';

// ============================================================================
// Model Function Registry
// ============================================================================

type ModelFunction = (options?: any) => THREE.Group | null;

const MODEL_FUNCTION_REGISTRY: Record<string, ModelFunction> = {
  // Studio Lights
  createMonolightModel,
  createLEDPanelModel,
  createFresnelModel,
  createRingLightModel,
  createTubeLightModel,
  createCOBLightModel,
  createPracticalLightModel,
  
  // Light Modifiers
  createSoftboxModel,
  createOctaboxModel,
  createBeautyDishModel,
  createUmbrellaModel,
  createSnootModel,
  createBarnDoorsModel,
  createGelFrameModel,
  createGoboModel,
  
  // Camera & Motion
  createSliderModel,
  createDollyModel,
  createJibModel,
  createGimbalModel,
  createCameraCageModel,
  createFollowFocusModel,
  createMatteBoxModel,
  createCameraRailsModel,
  
  // Audio
  createBoomPoleModel,
  createMicStandModel,
  createShotgunMicModel,
  createLavalierModel,
  createAudioRecorderModel,
  createHeadphonesModel,
  createPopFilterModel,
  createShockMountModel,
  
  // Furniture
  createPosingStoolModel,
  createDirectorChairModel,
  createMakeupStationModel,
  createWardrobeRackModel,
  createPlantModel,
  createCouchModel,
  createDeskModel,
  
  // Video Production
  createTeleprompterModel,
  createMonitorModel,
  createClapperboardModel,
  createCartModel,
  createPowerDistroModel,
  createCableRampModel,
  
  // Special Effects
  createHazeMachineModel,
  createFanModel,
  createRainRigModel,
  createMirrorBoardModel,
  
  // Grip Hardware
  createMaferClampModel,
  createCardelliniClampModel,
  createSpeedRailModel,
  createGripHeadModel,
  createMenaceArmModel,
  createWallSpreaderModel,
  createSpigotAdapterModel,
  
  // Studio Support (existing)
  createCStandModel,
  createLightStandModel,
  createTripodModel,
  createSandbagModel,
  createAppleBoxModel,
  createBackdropStandModel,
  
  // Studio Backdrops (existing)
  createSeamlessBackdropModel,
  createCycloramaModel,
  createVFlatModel,
  createProductTableModel,
  createLightGridModel,
  createScrimFlagModel,
  createDiffusionFrameModel,
  createTexturedBackdropModel,
};

// ============================================================================
// Equipment Type Mapping
// ============================================================================

type SceneNodeType = 'light' | 'camera' | 'model' | 'modifier' | 'audio' | 'furniture' | 'grip' | 'effect';

interface EquipmentTypeInfo {
  sceneNodeType: SceneNodeType;
  isLight: boolean;
  lightType?: 'strobe' | 'continuous' | 'practical';
  defaultPower?: number;
  defaultColor?: string;
}

const EQUIPMENT_TYPE_MAP: Record<string, EquipmentTypeInfo> = {
  // Lights
  createMonolightModel: { sceneNodeType: 'light', isLight: true, lightType: 'strobe', defaultPower: 500 },
  createLEDPanelModel: { sceneNodeType: 'light', isLight: true, lightType: 'continuous', defaultPower: 100 },
  createFresnelModel: { sceneNodeType: 'light', isLight: true, lightType: 'continuous', defaultPower: 1000 },
  createRingLightModel: { sceneNodeType: 'light', isLight: true, lightType: 'continuous', defaultPower: 50 },
  createTubeLightModel: { sceneNodeType: 'light', isLight: true, lightType: 'continuous', defaultPower: 30 },
  createCOBLightModel: { sceneNodeType: 'light', isLight: true, lightType: 'continuous', defaultPower: 300 },
  createPracticalLightModel: { sceneNodeType: 'light', isLight: true, lightType: 'practical', defaultPower: 60 },
  
  // Modifiers
  createSoftboxModel: { sceneNodeType: 'modifier', isLight: false },
  createOctaboxModel: { sceneNodeType: 'modifier', isLight: false },
  createBeautyDishModel: { sceneNodeType: 'modifier', isLight: false },
  createUmbrellaModel: { sceneNodeType: 'modifier', isLight: false },
  createSnootModel: { sceneNodeType: 'modifier', isLight: false },
  createBarnDoorsModel: { sceneNodeType: 'modifier', isLight: false },
  createGelFrameModel: { sceneNodeType: 'modifier', isLight: false },
  createGoboModel: { sceneNodeType: 'modifier', isLight: false },
  
  // Camera equipment
  createSliderModel: { sceneNodeType: 'model', isLight: false },
  createDollyModel: { sceneNodeType: 'model', isLight: false },
  createJibModel: { sceneNodeType: 'model', isLight: false },
  createGimbalModel: { sceneNodeType: 'model', isLight: false },
  createCameraCageModel: { sceneNodeType: 'model', isLight: false },
  createFollowFocusModel: { sceneNodeType: 'model', isLight: false },
  createMatteBoxModel: { sceneNodeType: 'model', isLight: false },
  createCameraRailsModel: { sceneNodeType: 'model', isLight: false },
  createTripodModel: { sceneNodeType: 'model', isLight: false },
  
  // Audio
  createBoomPoleModel: { sceneNodeType: 'audio', isLight: false },
  createMicStandModel: { sceneNodeType: 'audio', isLight: false },
  createShotgunMicModel: { sceneNodeType: 'audio', isLight: false },
  createLavalierModel: { sceneNodeType: 'audio', isLight: false },
  createAudioRecorderModel: { sceneNodeType: 'audio', isLight: false },
  createHeadphonesModel: { sceneNodeType: 'audio', isLight: false },
  createPopFilterModel: { sceneNodeType: 'audio', isLight: false },
  createShockMountModel: { sceneNodeType: 'audio', isLight: false },
  
  // Furniture
  createPosingStoolModel: { sceneNodeType: 'furniture', isLight: false },
  createDirectorChairModel: { sceneNodeType: 'furniture', isLight: false },
  createMakeupStationModel: { sceneNodeType: 'furniture', isLight: false },
  createWardrobeRackModel: { sceneNodeType: 'furniture', isLight: false },
  createPlantModel: { sceneNodeType: 'furniture', isLight: false },
  createCouchModel: { sceneNodeType: 'furniture', isLight: false },
  createDeskModel: { sceneNodeType: 'furniture', isLight: false },
  
  // Video Production
  createTeleprompterModel: { sceneNodeType: 'model', isLight: false },
  createMonitorModel: { sceneNodeType: 'model', isLight: false },
  createClapperboardModel: { sceneNodeType: 'model', isLight: false },
  createCartModel: { sceneNodeType: 'model', isLight: false },
  createPowerDistroModel: { sceneNodeType: 'model', isLight: false },
  createCableRampModel: { sceneNodeType: 'model', isLight: false },
  
  // Effects
  createHazeMachineModel: { sceneNodeType: 'effect', isLight: false },
  createFanModel: { sceneNodeType: 'effect', isLight: false },
  createRainRigModel: { sceneNodeType: 'effect', isLight: false },
  createMirrorBoardModel: { sceneNodeType: 'effect', isLight: false },
  
  // Grip
  createMaferClampModel: { sceneNodeType: 'grip', isLight: false },
  createCardelliniClampModel: { sceneNodeType: 'grip', isLight: false },
  createSpeedRailModel: { sceneNodeType: 'grip', isLight: false },
  createGripHeadModel: { sceneNodeType: 'grip', isLight: false },
  createMenaceArmModel: { sceneNodeType: 'grip', isLight: false },
  createWallSpreaderModel: { sceneNodeType: 'grip', isLight: false },
  createSpigotAdapterModel: { sceneNodeType: 'grip', isLight: false },
  createCStandModel: { sceneNodeType: 'grip', isLight: false },
  createLightStandModel: { sceneNodeType: 'grip', isLight: false },
  createSandbagModel: { sceneNodeType: 'grip', isLight: false },
  createAppleBoxModel: { sceneNodeType: 'grip', isLight: false },
  createBackdropStandModel: { sceneNodeType: 'grip', isLight: false },
  
  // Backdrops
  createSeamlessBackdropModel: { sceneNodeType: 'model', isLight: false },
  createCycloramaModel: { sceneNodeType: 'model', isLight: false },
  createVFlatModel: { sceneNodeType: 'model', isLight: false },
  createProductTableModel: { sceneNodeType: 'model', isLight: false },
  createLightGridModel: { sceneNodeType: 'model', isLight: false },
  createScrimFlagModel: { sceneNodeType: 'model', isLight: false },
  createDiffusionFrameModel: { sceneNodeType: 'model', isLight: false },
  createTexturedBackdropModel: { sceneNodeType: 'model', isLight: false },
};

// ============================================================================
// Service Implementation
// ============================================================================

export interface SceneNode {
  id: string;
  type: SceneNodeType;
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  modelFunction: string;
  modelOptions: Record<string, any>;
  userData?: Record<string, any>;
  // For lights
  light?: {
    power: number;
    color: string;
    temperature?: number;
    enabled: boolean;
  };
}

class EquipmentIntegrationService {
  private idCounter = 0;

  /**
   * Generate unique ID for scene nodes
   */
  private generateId(): string {
    return `equip_${Date.now()}_${++this.idCounter}`;
  }

  /**
   * Get model function by name
   */
  getModelFunction(name: string): ModelFunction | null {
    return MODEL_FUNCTION_REGISTRY[name] || null;
  }

  /**
   * Get all available model functions
   */
  getAllModelFunctions(): string[] {
    return Object.keys(MODEL_FUNCTION_REGISTRY);
  }

  /**
   * Create a 3D model from function name and options
   */
  createModel(functionName: string, options?: Record<string, any>): THREE.Group | null {
    const fn = this.getModelFunction(functionName);
    if (!fn) {
      log.warn(`Model function not found: ${functionName}`);
      return null;
    }
    return fn(options);
  }

  /**
   * Get equipment type info
   */
  getEquipmentTypeInfo(functionName: string): EquipmentTypeInfo | null {
    return EQUIPMENT_TYPE_MAP[functionName] || null;
  }

  /**
   * Create scene node from equipment item
   */
  createSceneNode(
    functionName: string,
    options: Record<string, any>,
    name: string,
    position: [number, number, number] = [0, 0, 0],
    rotation?: [number, number, number],
    scale?: [number, number, number]
  ): SceneNode {
    const typeInfo = this.getEquipmentTypeInfo(functionName);
    
    const node: SceneNode = {
      id: this.generateId(),
      type: typeInfo?.sceneNodeType || 'model',
      name,
      position,
      rotation,
      scale,
      modelFunction: functionName,
      modelOptions: options,
      userData: {
        equipmentType: functionName,
        options,
      },
    };

    // Add light properties if it's a light
    if (typeInfo?.isLight) {
      node.light = {
        power: typeInfo.defaultPower || 100,
        color: '#ffffff',
        temperature: 5600,
        enabled: true,
      };
      node.userData!.lightType = typeInfo.lightType;
    }

    return node;
  }

  /**
   * Create scene nodes from a scene preset
   */
  createSceneFromPreset(preset: {
    equipment: Array<{
      modelFunction: string;
      options: Record<string, any>;
      position: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      name: string;
    }>;
  }): SceneNode[] {
    return preset.equipment.map((item) =>
      this.createSceneNode(
        item.modelFunction,
        item.options,
        item.name,
        item.position,
        item.rotation,
        item.scale
      )
    );
  }

  /**
   * Handle drop event and create scene node
   */
  handleDropEvent(
    data: { type: string; item: any; options: Record<string, any> },
    dropPosition: [number, number, number]
  ): SceneNode | null {
    if (data.type !== 'equipment') return null;

    return this.createSceneNode(
      data.item.modelFunction,
      data.options,
      data.item.name,
      dropPosition
    );
  }

  /**
   * Dispatch event to add equipment to scene
   */
  addToScene(node: SceneNode): void {
    const event = new CustomEvent('ch-add-equipment', {
      detail: node,
    });
    window.dispatchEvent(event);
  }

  /**
   * Dispatch event to load entire preset
   */
  loadPreset(preset: {
    equipment: Array<{
      modelFunction: string;
      options: Record<string, any>;
      position: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
      name: string;
    }>;
    recommendedCamera?: {
      position: [number, number, number];
      target: [number, number, number];
      fov: number;
    };
  }): void {
    const nodes = this.createSceneFromPreset(preset);
    
    // Clear existing scene
    window.dispatchEvent(new CustomEvent('ch-clear-scene'));
    
    // Add all nodes
    nodes.forEach((node) => {
      this.addToScene(node);
    });

    // Set camera if provided
    if (preset.recommendedCamera) {
      window.dispatchEvent(
        new CustomEvent('ch-set-camera', {
          detail: preset.recommendedCamera,
        })
      );
    }
  }
}

// Export singleton instance
export const equipmentIntegrationService = new EquipmentIntegrationService();

// Export types
export type { SceneNode, EquipmentTypeInfo, ModelFunction };

// Export model registry for direct access
export { MODEL_FUNCTION_REGISTRY, EQUIPMENT_TYPE_MAP };

