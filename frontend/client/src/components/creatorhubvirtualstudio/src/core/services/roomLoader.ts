/**
 * Room Loader Service
 * 
 * Loads and applies predefined room templates to the scene
 */

import * as THREE from 'three';
import { logger } from './logger';
import type { LightProbeSystem } from '../rendering/LightProbeSystem';

const log = logger.module('RoomLoader');

export interface RoomTemplate {
  id: string;
  name: string;
  description: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  environment: {
    floor?: {
      type: string;
      material: {
        color: string;
        roughness: number;
        metalness?: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    };
    backWall?: {
      type: string;
      material: {
        color: string;
        roughness: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    };
    leftWall?: {
      type: string;
      material: {
        color: string;
        roughness: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    };
    rightWall?: {
      type: string;
      material: {
        color: string;
        roughness: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    };
    ceiling?: {
      type: string;
      material: {
        color: string;
        roughness: number;
      };
      position: [number, number, number];
      rotation: [number, number, number];
      size: [number, number];
    };
    cyclorama?: {
      type: string;
      material: {
        color: string;
        roughness: number;
      };
      position: [number, number, number];
      curveRadius: number;
      curveHeight: number;
      curveWidth: number;
    };
  };
  defaultCamera?: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
  };
  lightProbes?: Array<{
    position: [number, number, number];
    radius: number;
  }>;
  notes?: string;
}

export interface LoadedRoom {
  meshes: THREE.Mesh[];
  lightProbes: LightProbeSystem | null;
  cameraConfig: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  } | null;
}

export class RoomLoader {
  private loadedRooms: Map<string, LoadedRoom> = new Map();
  
  /**
   * Load room template from JSON
   */
  async loadTemplate(templateId: string): Promise<RoomTemplate | null> {
    try {
      const response = await fetch(`/assets/templates/rooms/${templateId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.statusText}`);
      }
      
      const template: RoomTemplate = await response.json();
      return template;
    } catch (error) {
      log.error(`Failed to load room template ${templateId}:`, error);
      return null;
    }
  }
  
  /**
   * Apply room template to scene
   */
  applyTemplate(
    template: RoomTemplate,
    scene: THREE.Scene,
    lightProbeSystem?: LightProbeSystem
  ): LoadedRoom {
    const meshes: THREE.Mesh[] = [];
    
    // Create floor
    if (template.environment.floor) {
      const floor = this.createPlane(template.environment.floor);
      scene.add(floor);
      meshes.push(floor);
    }
    
    // Create walls
    if (template.environment.backWall) {
      const wall = this.createPlane(template.environment.backWall);
      scene.add(wall);
      meshes.push(wall);
    }
    
    if (template.environment.leftWall) {
      const wall = this.createPlane(template.environment.leftWall);
      scene.add(wall);
      meshes.push(wall);
    }
    
    if (template.environment.rightWall) {
      const wall = this.createPlane(template.environment.rightWall);
      scene.add(wall);
      meshes.push(wall);
    }
    
    // Create ceiling
    if (template.environment.ceiling) {
      const ceiling = this.createPlane(template.environment.ceiling);
      scene.add(ceiling);
      meshes.push(ceiling);
    }
    
    // Create cyclorama (curved wall)
    if (template.environment.cyclorama) {
      const cyclorama = this.createCyclorama(template.environment.cyclorama);
      scene.add(cyclorama);
      meshes.push(cyclorama);
    }
    
    // Setup light probes
    let probes: LightProbeSystem | null = null;
    if (template.lightProbes && lightProbeSystem) {
      template.lightProbes.forEach((probeConfig) => {
        lightProbeSystem.addProbe(
          new THREE.Vector3(...probeConfig.position),
          probeConfig.radius
        );
      });
      probes = lightProbeSystem;
    }
    
    // Camera configuration
    let cameraConfig: LoadedRoom['cameraConfig'] = null;
    if (template.defaultCamera) {
      cameraConfig = {
        position: new THREE.Vector3(...template.defaultCamera.position),
        target: new THREE.Vector3(...template.defaultCamera.target),
        fov: template.defaultCamera.fov,
      };
    }
    
    const loadedRoom: LoadedRoom = {
      meshes,
      lightProbes: probes,
      cameraConfig,
    };
    
    this.loadedRooms.set(template.id, loadedRoom);
    
    return loadedRoom;
  }
  
  /**
   * Create a plane mesh from configuration
   */
  private createPlane(config: {
    material: { color: string; roughness: number; metalness?: number };
    position: [number, number, number];
    rotation: [number, number, number];
    size: [number, number];
  }): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(config.size[0], config.size[1]);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.material.color),
      roughness: config.material.roughness,
      metalness: config.material.metalness || 0.0,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...config.position);
    mesh.rotation.set(...config.rotation);
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Create cyclorama (curved wall)
   */
  private createCyclorama(config: {
    material: { color: string; roughness: number };
    position: [number, number, number];
    curveRadius: number;
    curveHeight: number;
    curveWidth: number;
  }): THREE.Mesh {
    // Create curved geometry using TubeGeometry
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-config.curveWidth / 2, 0, 0),
      new THREE.Vector3(0, config.curveHeight, -config.curveRadius),
      new THREE.Vector3(config.curveWidth / 2, 0, 0)
    );
    
    const geometry = new THREE.TubeGeometry(curve, 32, 0.1, 32, false);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.material.color),
      roughness: config.material.roughness,
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...config.position);
    mesh.receiveShadow = true;
    
    return mesh;
  }
  
  /**
   * Remove room from scene
   */
  removeRoom(roomId: string, scene: THREE.Scene): void {
    const loadedRoom = this.loadedRooms.get(roomId);
    if (!loadedRoom) return;
    
    // Remove meshes
    loadedRoom.meshes.forEach((mesh) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });
    
    // Clear light probes
    if (loadedRoom.lightProbes) {
      loadedRoom.lightProbes.dispose();
    }
    
    this.loadedRooms.delete(roomId);
  }
  
  /**
   * Get available room templates
   */
  getAvailableTemplates(): string[] {
    return ['small_studio', 'medium_studio', 'large_studio', 'cyclorama'];
  }
}

// Export singleton instance
export const roomLoader = new RoomLoader();


