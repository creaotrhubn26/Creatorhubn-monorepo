/**
 * useAnimationBinding - Auto-bind scene objects to AnimationStateManager
 * 
 * Features:
 * - Auto-discovery of scene objects
 * - Automatic binding to animation tracks
 * - Real-time synchronization
 * - Scene change detection
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import * as THREE from 'three';
import {
  animationStateManager,
  AnimationState,
  PropertyUpdate,
  SceneBinding,
} from '../core/animation/AnimationStateManager';
import { AnimationTrack } from '../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface SceneObject {
  id: string;
  name: string;
  type: 'camera' | 'light' | 'mesh' | 'group' | 'other';
  object3D: THREE.Object3D;
  isBound: boolean;
}

export interface UseAnimationBindingOptions {
  autoBindOnMount?: boolean;
  autoBindNewObjects?: boolean;
  syncInterval?: number;
  filterTypes?: Array<'camera' | 'light' | 'mesh' | 'group'>;
}

export interface UseAnimationBindingReturn {
  // State
  sceneObjects: SceneObject[];
  boundObjects: SceneBinding[];
  animationState: AnimationState;
  isInitialized: boolean;

  // Actions
  bindObject: (nodeId: string, object3D: THREE.Object3D) => void;
  unbindObject: (nodeId: string) => void;
  bindAll: () => void;
  unbindAll: () => void;
  scanScene: () => void;
  setTracks: (tracks: AnimationTrack[]) => void;

  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (loop: boolean) => void;

  // Callbacks
  onUpdate: (callback: (updates: PropertyUpdate[]) => void) => () => void;
  onStateChange: (callback: (state: AnimationState) => void) => () => void;
}

// ============================================================================
// Object Type Detection
// ============================================================================

function detectObjectType(obj: THREE.Object3D): SceneObject['type'] {
  if (obj instanceof THREE.Camera) return 'camera';
  if (obj instanceof THREE.Light) return 'light';
  if (obj instanceof THREE.Mesh) return 'mesh';
  if (obj instanceof THREE.Group) return 'group';
  return 'other';
}

function getObjectName(obj: THREE.Object3D): string {
  if (obj.name) return obj.name;
  if (obj.userData?.name) return obj.userData.name;
  const type = detectObjectType(obj);
  return `${type}_${obj.id}`;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAnimationBinding(
  scene: THREE.Scene | null,
  options: UseAnimationBindingOptions = {}
): UseAnimationBindingReturn {
  const {
    autoBindOnMount = true,
    autoBindNewObjects = true,
    syncInterval = 100,
    filterTypes = ['camera','light','mesh','group'],
  } = options;

  const [sceneObjects, setSceneObjects] = useState<SceneObject[]>([]);
  const [boundObjects, setBoundObjects] = useState<SceneBinding[]>([]);
  const [animationState, setAnimationState] = useState<AnimationState>(
    animationStateManager.getState()
  );
  const [isInitialized, setIsInitialized] = useState(false);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Scan scene for objects
  const scanScene = useCallback(() => {
    if (!scene) return;

    const objects: SceneObject[] = [];
    const seenIds = new Set<string>();

    scene.traverse((obj) => {
      // Skip the scene itself and internal objects
      if (obj === scene || obj.type === 'AmbientLight') return;

      const type = detectObjectType(obj);
      if (!filterTypes.includes(type) && type !=='other') return;

      // Generate unique ID
      const id = obj.userData?.nodeId || obj.uuid;
      if (seenIds.has(id)) return;
      seenIds.add(id);

      const binding = animationStateManager.getBinding(id);

      objects.push({
        id,
        name: getObjectName(obj),
        type,
        object3D: obj,
        isBound: !!binding,
      });
    });

    setSceneObjects(objects);
    setBoundObjects(animationStateManager.getAllBindings());
  }, [scene, filterTypes]);

  // Bind a single object
  const bindObject = useCallback((nodeId: string, object3D: THREE.Object3D) => {
    animationStateManager.bindObject(nodeId, object3D);
    setBoundObjects(animationStateManager.getAllBindings());
    setSceneObjects((prev) =>
      prev.map((obj) =>
        obj.id === nodeId ? { ...obj, isBound: true } : obj
      )
    );
  }, []);

  // Unbind a single object
  const unbindObject = useCallback((nodeId: string) => {
    animationStateManager.unbindObject(nodeId);
    setBoundObjects(animationStateManager.getAllBindings());
    setSceneObjects((prev) =>
      prev.map((obj) =>
        obj.id === nodeId ? { ...obj, isBound: false } : obj
      )
    );
  }, []);

  // Bind all scanned objects
  const bindAll = useCallback(() => {
    sceneObjects.forEach((obj) => {
      if (!obj.isBound) {
        animationStateManager.bindObject(obj.id, obj.object3D);
      }
    });
    setBoundObjects(animationStateManager.getAllBindings());
    setSceneObjects((prev) =>
      prev.map((obj) => ({ ...obj, isBound: true }))
    );
  }, [sceneObjects]);

  // Unbind all objects
  const unbindAll = useCallback(() => {
    sceneObjects.forEach((obj) => {
      if (obj.isBound) {
        animationStateManager.unbindObject(obj.id);
      }
    });
    setBoundObjects([]);
    setSceneObjects((prev) =>
      prev.map((obj) => ({ ...obj, isBound: false }))
    );
  }, [sceneObjects]);

  // Set animation tracks
  const setTracks = useCallback((tracks: AnimationTrack[]) => {
    animationStateManager.setTracks(tracks);
  }, []);

  // Playback controls
  const play = useCallback(() => animationStateManager.play(), []);
  const pause = useCallback(() => animationStateManager.pause(), []);
  const stop = useCallback(() => animationStateManager.stop(), []);
  const seek = useCallback((time: number) => animationStateManager.seek(time), []);
  const setSpeed = useCallback((speed: number) => animationStateManager.setSpeed(speed), []);
  const setLoop = useCallback((loop: boolean) => animationStateManager.setLoop(loop), []);

  // Callbacks
  const onUpdate = useCallback(
    (callback: (updates: PropertyUpdate[]) => void) => {
      return animationStateManager.onUpdate(callback);
    },
    []
  );

  const onStateChange = useCallback(
    (callback: (state: AnimationState) => void) => {
      return animationStateManager.onStateChange(callback);
    },
    []
  );

  // Initialize on mount
  useEffect(() => {
    if (!scene) return;

    sceneRef.current = scene;

    // Subscribe to state changes
    const unsubscribe = animationStateManager.onStateChange(setAnimationState);

    // Initial scan
    scanScene();

    // Auto-bind if enabled
    if (autoBindOnMount) {
      setTimeout(() => {
        bindAll();
        setIsInitialized(true);
      }, 100);
    } else {
      setIsInitialized(true);
    }

    // Set up periodic scanning for new objects
    if (autoBindNewObjects && syncInterval > 0) {
      scanIntervalRef.current = window.setInterval(() => {
        const currentObjects = new Set(sceneObjects.map((o) => o.id));
        
        scene.traverse((obj) => {
          const id = obj.userData?.nodeId || obj.uuid;
          if (!currentObjects.has(id)) {
            const type = detectObjectType(obj);
            if (filterTypes.includes(type)) {
              animationStateManager.bindObject(id, obj);
            }
          }
        });

        scanScene();
      }, syncInterval);
    }

    return () => {
      unsubscribe();
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [scene, autoBindOnMount, autoBindNewObjects, syncInterval, filterTypes, scanScene, bindAll, sceneObjects]);

  return {
    // State
    sceneObjects,
    boundObjects,
    animationState,
    isInitialized,

    // Actions
    bindObject,
    unbindObject,
    bindAll,
    unbindAll,
    scanScene,
    setTracks,

    // Playback
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setLoop,

    // Callbacks
    onUpdate,
    onStateChange,
  };
}

export default useAnimationBinding;

