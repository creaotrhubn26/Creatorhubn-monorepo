/**
 * Class Photo Scene Service
 * 
 * Integrates the Class Photo system with the main Virtual Studio scene.
 * Handles adding students and teachers as actual 3D actor models.
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('ClassPhotoScene');

import { 
  ClassPhotoSession, 
  Student,
  TEACHER_COLORS,
  TEACHER_HEIGHT,
} from './classPhotoService';
import { virtualActorService, ActorParameters } from './virtualActorService';

// =============================================================================
// School HDRI Presets
// =============================================================================

export interface SchoolHDRIPreset {
  id: string;
  name: string;
  description: string;
  url: string;
  thumbnail: string;
  intensity: number;
  rotation: number;
  recommended: boolean;  // Best for class photos
  indoorOutdoor: 'indoor' | 'outdoor';
}

export const SCHOOL_HDRI_PRESETS: SchoolHDRIPreset[] = [
  // ============================================================================
  // Valid Poly Haven HDRIs for school/class photography (CC0 license)
  // Note: Poly Haven doesn't have dedicated classroom/gym HDRIs
  // These are the best alternatives from their library
  // ============================================================================
  
  // INDOOR - Large Spaces (Gym/Hall alternatives)
  {
    id: 'school_gymnasium',
    name: 'Large Hall (Gym Style)',
    description: 'Large indoor space with high ceilings and overhead lighting',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/empty_warehouse_01.png',
    intensity: 1.0,
    rotation: 0,
    recommended: true,
    indoorOutdoor: 'indoor',
  },
  {
    id: 'school_hall_bright',
    name: 'School Lobby / Entrance',
    description: 'Bright entrance hall - natural light from windows',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/entrance_hall_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/entrance_hall.png',
    intensity: 1.1,
    rotation: 0,
    recommended: true,
    indoorOutdoor: 'indoor',
  },
  {
    id: 'school_auditorium',
    name: 'Assembly Hall / Auditorium',
    description: 'Concert hall lighting - great for choir/drama groups',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/music_hall_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/music_hall_01.png',
    intensity: 0.9,
    rotation: 0,
    recommended: false,
    indoorOutdoor: 'indoor',
  },
  
  // INDOOR - Studio Setups (Professional class photos)
  {
    id: 'school_studio_soft',
    name: 'Photo Studio (Soft)',
    description: 'Professional soft lighting - best for yearbook quality',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_03.png',
    intensity: 1.1,
    rotation: 0,
    recommended: true,
    indoorOutdoor: 'indoor',
  },
  {
    id: 'school_studio_even',
    name: 'Photo Studio (Even)',
    description: 'Even lighting across all rows - consistent exposure',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_01_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_01.png',
    intensity: 1.0,
    rotation: 0,
    recommended: false,
    indoorOutdoor: 'indoor',
  },
  {
    id: 'school_high_key',
    name: 'Photo Studio (Bright)',
    description: 'High-key bright look - clean yearbook portraits',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/studio_small_08.png',
    intensity: 1.3,
    rotation: 0,
    recommended: false,
    indoorOutdoor: 'indoor',
  },
  
  // OUTDOOR - School Grounds
  {
    id: 'school_quad',
    name: 'School Courtyard',
    description: 'Actual school quad - outdoor class photos',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/school_quad_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/school_quad.png',
    intensity: 1.0,
    rotation: 0,
    recommended: true,
    indoorOutdoor: 'outdoor',
  },
  {
    id: 'school_outdoor_shade',
    name: 'Outdoor (Shaded)',
    description: 'Partly cloudy - no squinting, natural colors',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/kloofendal_48d_partly_cloudy.png',
    intensity: 0.9,
    rotation: 0,
    recommended: false,
    indoorOutdoor: 'outdoor',
  },
  {
    id: 'school_overcast_field',
    name: 'Outdoor (Overcast)',
    description: 'Overcast sky - very even natural lighting',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/cloudy_field_1k.hdr',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cloudy_field.png',
    intensity: 1.0,
    rotation: 0,
    recommended: false,
    indoorOutdoor: 'outdoor',
  },
];

// =============================================================================
// Types
// =============================================================================

export interface ClassPhotoActorConfig {
  id: string;
  name: string;
  height: number;           // cm
  position: THREE.Vector3;
  isTeacher: boolean;
  teacherRole?: string;
  color?: string;
  pose: 'standing' | 'seated' | 'kneeling';
  row: number;
}

export interface ClassPhotoSceneConfig {
  actors: ClassPhotoActorConfig[];
  props: {
    id: string;
    type: string;
    position: THREE.Vector3;
    dimensions: { width: number; height: number; depth: number };
  }[];
  camera: {
    position: THREE.Vector3;
    target: THREE.Vector3;
    fov: number;
  };
  backdrop: {
    width: number;
    height: number;
    color: string;
  };
}

// =============================================================================
// Constants
// =============================================================================

// Age groups to approximate actor age parameter
const AGE_BY_GROUP: Record<string, number> = {
  kindergarten: 5,
  elementary: 10,
  middle_school: 14,
  high_school: 17,
};

// Skin tone variations for diversity
const SKIN_TONES = [
  '#FFDAB9', // Light
  '#F4C2A0', // Fair
  '#D2A679', // Medium
  '#B87333', // Tan
  '#8B4513', // Brown
  '#654321', // Dark Brown
];

// Hair colors
const HAIR_COLORS = [
  '#1a1a1a', // Black
  '#3D2314', // Dark Brown
  '#654321', // Brown
  '#A0522D', // Auburn
  '#FFD700', // Blonde
  '#8B0000', // Red
];

// Clothing colors for students (school appropriate)
const STUDENT_COLORS = [
  '#1a365d', // Navy
  '#2d3748', // Dark Gray
  '#1e3a5f', // Dark Blue
  '#4a5568', // Gray
  '#2c5282', // Blue
];

// =============================================================================
// Class Photo Scene Service
// =============================================================================

class ClassPhotoSceneService {
  private sceneUpdateCallback: ((config: ClassPhotoSceneConfig) => void) | null = null;
  private actorNodeIds: string[] = [];
  private propNodeIds: string[] = [];

  /**
   * Register callback for scene updates
   */
  onSceneUpdate(callback: (config: ClassPhotoSceneConfig) => void) {
    this.sceneUpdateCallback = callback;
  }

  /**
   * Convert class photo session to scene configuration
   */
  sessionToSceneConfig(session: ClassPhotoSession): ClassPhotoSceneConfig {
    const actors: ClassPhotoActorConfig[] = [];
    const props: ClassPhotoSceneConfig['props'] = [];

    // Convert students to actor configs
    for (const [id, student] of session.students) {
      actors.push({
        id: `class-photo-${id}`,
        name: student.name,
        height: student.height,
        position: student.position3D.clone(),
        isTeacher: student.isTeacher || false,
        teacherRole: student.teacherRole,
        color: student.color,
        pose: student.pose,
        row: student.assignedRow,
      });
    }

    // Convert props to scene props
    for (const [id, prop] of session.props) {
      props.push({
        id: `class-photo-prop-${id}`,
        type: prop.type,
        position: prop.position.clone(),
        dimensions: {
          width: prop.width,
          height: prop.height,
          depth: prop.depth,
        },
      });
    }

    return {
      actors,
      props,
      camera: {
        position: session.cameraPosition.clone(),
        target: session.cameraTarget.clone(),
        fov: 50,
      },
      backdrop: {
        width: session.sceneWidth + 2,
        height: 4,
        color: '#888888',
      },
    };
  }

  /**
   * Create actor parameters for a student/teacher
   */
  createActorParams(actor: ClassPhotoActorConfig, ageGroup: string): ActorParameters {
    // Estimate age based on height and group
    let age = AGE_BY_GROUP[ageGroup] || 10;
    
    // Teachers are adults
    if (actor.isTeacher) {
      age = 35 + Math.random() * 20; // 35-55 years
    } else {
      // Vary age slightly based on height
      const avgHeight = actor.height;
      age = age + (avgHeight > 150 ? 2 : avgHeight < 130 ? -2 : 0);
    }

    // Random gender for diversity
    const gender = Math.random() > 0.5 ? 1 : 0;

    // Height parameter (normalized 0-1)
    // Convert cm to parameter (assuming 100cm = 0, 200cm = 1)
    const heightParam = (actor.height - 100) / 100;

    return {
      age,
      gender,
      height: Math.max(0, Math.min(1, heightParam)),
      weight: 0.4 + Math.random() * 0.2, // Normal weight range
      muscle: 0.3 + Math.random() * 0.2, // Average muscle
    };
  }

  /**
   * Get random skin tone for diversity
   */
  getRandomSkinTone(): string {
    return SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
  }

  /**
   * Get random hair color
   */
  getRandomHairColor(): string {
    return HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
  }

  /**
   * Get clothing color (teacher vs student)
   */
  getClothingColor(actor: ClassPhotoActorConfig): string {
    if (actor.isTeacher && actor.color) {
      return actor.color;
    }
    return STUDENT_COLORS[Math.floor(Math.random() * STUDENT_COLORS.length)];
  }

  /**
   * Create a scene node for a class photo actor
   */
  createActorNode(actor: ClassPhotoActorConfig, ageGroup: string): any {
    const params = this.createActorParams(actor, ageGroup);
    
    // Convert pose to body_pose if needed
    let poseRotation = [0, 0, 0];
    if (actor.pose === 'seated') {
      // Seated pose: bend at hips
      poseRotation = [-Math.PI / 2, 0, 0];
    } else if (actor.pose === 'kneeling') {
      poseRotation = [-Math.PI / 4, 0, 0];
    }

    return {
      id: actor.id,
      type: 'model',
      name: actor.name,
      visible: true,
      transform: {
        position: [actor.position.x, actor.position.y, actor.position.z],
        rotation: poseRotation,
        scale: [1, 1, 1],
      },
      userData: {
        actorType: 'classPhoto',
        isTeacher: actor.isTeacher,
        teacherRole: actor.teacherRole,
        actorParams: params,
        skinTone: this.getRandomSkinTone(),
        hairColor: this.getRandomHairColor(),
        clothingColor: this.getClothingColor(actor),
        height: actor.height,
        pose: actor.pose,
        row: actor.row,
      },
    };
  }

  /**
   * Create a prop node for class photo equipment
   */
  createPropNode(prop: ClassPhotoSceneConfig['props'][0]): any {
    return {
      id: prop.id,
      type: 'prop',
      name: `Class Photo ${prop.type}`,
      visible: true,
      transform: {
        position: [prop.position.x, prop.position.y, prop.position.z],
        rotation: [0, 0, 0],
        scale: [prop.dimensions.width, prop.dimensions.height, prop.dimensions.depth],
      },
      userData: {
        propType: prop.type,
        classPhotoEquipment: true,
      },
    };
  }

  /**
   * Dispatch event to add actors to the main scene
   */
  addActorsToScene(session: ClassPhotoSession, ageGroup: string) {
    const config = this.sessionToSceneConfig(session);
    
    // Clear previous actors
    this.clearClassPhotoActors();

    // Create actor nodes
    const actorNodes = config.actors.map(actor => 
      this.createActorNode(actor, ageGroup)
    );

    // Create prop nodes
    const propNodes = config.props.map(prop => 
      this.createPropNode(prop)
    );

    // Store IDs for cleanup
    this.actorNodeIds = actorNodes.map(n => n.id);
    this.propNodeIds = propNodes.map(n => n.id);

    // Dispatch event to add nodes
    const event = new CustomEvent('vs-class-photo-actors', {
      detail: {
        actors: actorNodes,
        props: propNodes,
        camera: config.camera,
        backdrop: config.backdrop,
      },
    });
    window.dispatchEvent(event);

    // Call callback if registered
    if (this.sceneUpdateCallback) {
      this.sceneUpdateCallback(config);
    }

    return { actorNodes, propNodes };
  }

  /**
   * Update a single actor in the scene
   */
  updateActorInScene(actor: ClassPhotoActorConfig, ageGroup: string) {
    const node = this.createActorNode(actor, ageGroup);
    
    const event = new CustomEvent('vs-class-photo-actor-update', {
      detail: { node },
    });
    window.dispatchEvent(event);
  }

  /**
   * Remove an actor from the scene
   */
  removeActorFromScene(actorId: string) {
    const event = new CustomEvent('vs-class-photo-actor-remove', {
      detail: { id: `class-photo-${actorId}` },
    });
    window.dispatchEvent(event);

    this.actorNodeIds = this.actorNodeIds.filter(id => id !== `class-photo-${actorId}`);
  }

  /**
   * Clear all class photo actors from the scene
   */
  clearClassPhotoActors() {
    const event = new CustomEvent('vs-class-photo-clear', {
      detail: {
        actorIds: this.actorNodeIds,
        propIds: this.propNodeIds,
      },
    });
    window.dispatchEvent(event);

    this.actorNodeIds = [];
    this.propNodeIds = [];
  }

  /**
   * Get all current actor node IDs
   */
  getActorNodeIds(): string[] {
    return this.actorNodeIds;
  }

  /**
   * Get all current prop node IDs
   */
  getPropNodeIds(): string[] {
    return this.propNodeIds;
  }

  /**
   * Set HDRI environment for class photos
   */
  setClassPhotoHDRI(hdriId: string = 'school_studio_soft') {
    const preset = SCHOOL_HDRI_PRESETS.find(p => p.id === hdriId);
    if (!preset) {
      log.warn(`HDRI preset not found: ${hdriId}`);
      return;
    }

    const event = new CustomEvent('vs-class-photo-hdri', {
      detail: { 
        hdriId,
        url: preset.url,
        intensity: preset.intensity,
        rotation: preset.rotation,
      },
    });
    window.dispatchEvent(event);
    
    log.info(`Set HDRI environment: ${preset.name}`);
  }

  /**
   * Get all school HDRI presets
   */
  getSchoolHDRIs(): SchoolHDRIPreset[] {
    return SCHOOL_HDRI_PRESETS;
  }

  /**
   * Get recommended HDRI presets
   */
  getRecommendedHDRIs(): SchoolHDRIPreset[] {
    return SCHOOL_HDRI_PRESETS.filter(p => p.recommended);
  }

  /**
   * Get indoor HDRI presets
   */
  getIndoorHDRIs(): SchoolHDRIPreset[] {
    return SCHOOL_HDRI_PRESETS.filter(p => p.indoorOutdoor === 'indoor');
  }

  /**
   * Get outdoor HDRI presets
   */
  getOutdoorHDRIs(): SchoolHDRIPreset[] {
    return SCHOOL_HDRI_PRESETS.filter(p => p.indoorOutdoor ==='outdoor');
  }
}

// Singleton instance
export const classPhotoSceneService = new ClassPhotoSceneService();

export default classPhotoSceneService;

