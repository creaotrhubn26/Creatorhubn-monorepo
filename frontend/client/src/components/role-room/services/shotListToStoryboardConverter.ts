/**
 * ShotListToStoryboardConverter
 * 
 * Service for converting CastingShot objects to StoryboardFrame objects.
 * Enables integration between shot lists in Casting Planner and Storyboard system.
 */

import type { CastingShot, ShotType, CameraAngle, CameraMovement } from '../models/casting';

// StoryboardFrame interface (matching storyboardStore structure)
export interface StoryboardFrame {
  id: string;
  index: number;
  imageUrl?: string;
  thumbnailUrl?: string;
  title: string;
  description?: string;
  shotType: ShotType;
  cameraAngle: CameraAngle;
  cameraMovement: CameraMovement;
  duration: number; // seconds
  status: 'draft' | 'pending' | 'approved' | 'revision';
  sceneSnapshot?: {
    camera: {
      position: [number, number, number];
      rotation: [number, number, number];
      focalLength: number;
      aperture: number;
    };
    lights: Array<{
      id: string;
      type: string;
      position: [number, number, number];
      intensity: number;
    }>;
  };
  annotations?: any[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Converts a CastingShot to a StoryboardFrame
 */
export function convertCastingShotToStoryboardFrame(
  shot: CastingShot,
  index: number,
  roleName?: string
): StoryboardFrame {
  const frameId = `frame-${shot.id}-${Date.now()}`;
  
  return {
    id: frameId,
    index,
    imageUrl: shot.imageUrl,
    thumbnailUrl: shot.imageUrl, // Use same image for thumbnail if available
    title: roleName || `Shot ${index + 1}`,
    description: shot.description || shot.notes,
    shotType: shot.shotType,
    cameraAngle: shot.cameraAngle,
    cameraMovement: shot.cameraMovement,
    duration: shot.duration || 3, // Default 3 seconds if not specified
    status: 'draft',
    sceneSnapshot: shot.focalLength ? {
      camera: {
        position: [0, 0, 0], // Default position, should be loaded from scene if available
        rotation: [0, 0, 0],
        focalLength: shot.focalLength,
        aperture: 2.8, // Default aperture
      },
      lights: [],
    } : undefined,
    createdAt: shot.createdAt,
    updatedAt: shot.updatedAt,
  };
}

/**
 * Converts an array of CastingShots to StoryboardFrames
 */
export function convertShotListToStoryboardFrames(
  shots: CastingShot[],
  getRoleName?: (roleId: string) => string
): StoryboardFrame[] {
  return shots.map((shot, index) => {
    const roleName = shot.roleId && getRoleName ? getRoleName(shot.roleId) : undefined;
    return convertCastingShotToStoryboardFrame(shot, index, roleName);
  });
}

/**
 * Creates a storyboard name from shot list information
 */
export function generateStoryboardName(
  sceneName: string,
  shotListName?: string
): string {
  if (shotListName) {
    return `Storyboard: ${shotListName}`;
  }
  return `Storyboard: ${sceneName}`;
}




