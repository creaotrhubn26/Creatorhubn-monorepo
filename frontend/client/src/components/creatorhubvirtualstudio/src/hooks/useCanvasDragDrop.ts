/**
 * useCanvasDragDrop - Hook for handling drag-and-drop onto the 3D canvas
 * 
 * Features:
 * - Handles equipment drops from catalog
 * - Calculates 3D position from mouse/touch coordinates
 * - Raycasting to place on floor or existing objects
 * - Visual drop indicator
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { logger } from '../core/services/logger';
import { equipmentIntegrationService } from '../core/services/equipmentIntegrationService';

const log = logger.module('CanvasDragDrop');

export interface DropPosition {
  x: number;
  y: number;
  z: number;
  normal?: THREE.Vector3;
  object?: THREE.Object3D;
}

export interface DragDropState {
  isDragging: boolean;
  isOverCanvas: boolean;
  dropPosition: DropPosition | null;
  draggedItem: any | null;
}

export interface UseCanvasDragDropOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | HTMLDivElement>;
  camera: THREE.Camera | null;
  scene: THREE.Scene | null;
  groundPlaneY?: number;
  snapToGrid?: boolean;
  gridSize?: number;
  onDrop?: (item: any, position: [number, number, number]) => void;
}

export interface UseCanvasDragDropReturn {
  state: DragDropState;
  dropIndicatorPosition: THREE.Vector3 | null;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  setCamera: (camera: THREE.Camera) => void;
  setScene: (scene: THREE.Scene) => void;
}

export function useCanvasDragDrop(options: UseCanvasDragDropOptions): UseCanvasDragDropReturn {
  const {
    canvasRef,
    groundPlaneY = 0,
    snapToGrid = true,
    gridSize = 0.5,
    onDrop,
  } = options;

  // Refs for camera and scene (can be updated dynamically)
  const cameraRef = useRef<THREE.Camera | null>(options.camera);
  const sceneRef = useRef<THREE.Scene | null>(options.scene);
  
  // Raycaster and plane for intersection
  const raycasterRef = useRef(new THREE.Raycaster());
  const groundPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundPlaneY));
  const mouseRef = useRef(new THREE.Vector2());

  // State
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    isOverCanvas: false,
    dropPosition: null,
    draggedItem: null,
  });

  const [dropIndicatorPosition, setDropIndicatorPosition] = useState<THREE.Vector3 | null>(null);

  // Update refs when props change
  const setCamera = useCallback((camera: THREE.Camera) => {
    cameraRef.current = camera;
  }, []);

  const setScene = useCallback((scene: THREE.Scene) => {
    sceneRef.current = scene;
  }, []);

  // Calculate 3D position from screen coordinates
  const getWorldPosition = useCallback((clientX: number, clientY: number): DropPosition | null => {
    const canvas = canvasRef.current;
    const camera = cameraRef.current;

    if (!canvas || !camera) return null;

    // Get canvas bounds
    const rect = canvas.getBoundingClientRect();
    
    // Convert to normalized device coordinates (-1 to +1)
    mouseRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    // Set up raycaster
    raycasterRef.current.setFromCamera(mouseRef.current, camera);

    // First, try to intersect with existing objects in scene
    const scene = sceneRef.current;
    if (scene) {
      const intersects = raycasterRef.current.intersectObjects(scene.children, true);
      
      // Filter out non-mesh objects and helpers
      const validIntersects = intersects.filter((i) => {
        const obj = i.object;
        // Skip helpers, grids, lights, etc.
        if (obj.type === 'GridHelper' || obj.type === 'AxesHelper') return false;
        if (obj.name.includes('helper') || obj.name.includes('Helper')) return false;
        return obj.visible;
      });

      if (validIntersects.length > 0) {
        const hit = validIntersects[0];
        const pos = hit.point.clone();
        
        // Snap to grid if enabled
        if (snapToGrid) {
          pos.x = Math.round(pos.x / gridSize) * gridSize;
          pos.z = Math.round(pos.z / gridSize) * gridSize;
        }
        
        // Ensure Y is at ground or on top of object
        pos.y = Math.max(groundPlaneY, pos.y);

        return {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          normal: hit.normal?.clone(),
          object: hit.object,
        };
      }
    }

    // Fall back to ground plane intersection
    const planeIntersect = new THREE.Vector3();
    if (raycasterRef.current.ray.intersectPlane(groundPlaneRef.current, planeIntersect)) {
      // Snap to grid if enabled
      if (snapToGrid) {
        planeIntersect.x = Math.round(planeIntersect.x / gridSize) * gridSize;
        planeIntersect.z = Math.round(planeIntersect.z / gridSize) * gridSize;
      }
      planeIntersect.y = groundPlaneY;

      return {
        x: planeIntersect.x,
        y: planeIntersect.y,
        z: planeIntersect.z,
      };
    }

    return null;
  }, [canvasRef, groundPlaneY, snapToGrid, gridSize]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const position = getWorldPosition(e.clientX, e.clientY);
    
    setState((prev) => ({
      ...prev,
      isOverCanvas: true,
      dropPosition: position,
    }));

    if (position) {
      setDropIndicatorPosition(new THREE.Vector3(position.x, position.y, position.z));
    }
  }, [getWorldPosition]);

  // Handle drag leave
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the canvas entirely
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        setState((prev) => ({
          ...prev,
          isOverCanvas: false,
          dropPosition: null,
        }));
        setDropIndicatorPosition(null);
      }
    }
  }, [canvasRef]);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    try {
      const dataString = e.dataTransfer.getData('application/json');
      if (!dataString) {
        log.warn('No drag data found');
        return;
      }

      const data = JSON.parse(dataString);
      
      // Calculate drop position
      const position = getWorldPosition(e.clientX, e.clientY);
      const dropPos: [number, number, number] = position 
        ? [position.x, position.y, position.z] 
        : [0, 0, 0];

      if (data.type ==='equipment') {
        // Create scene node and add to scene
        const node = equipmentIntegrationService.createSceneNode(
          data.item.modelFunction,
          data.options || data.item.defaultOptions,
          data.item.name,
          dropPos
        );
        equipmentIntegrationService.addToScene(node);

        // Call onDrop callback if provided
        if (onDrop) {
          onDrop(data.item, dropPos);
        }
      }
    } catch (err) {
      log.error('Error handling drop: ', err);
    }

    // Reset state
    setState({
      isDragging: false,
      isOverCanvas: false,
      dropPosition: null,
      draggedItem: null,
    });
    setDropIndicatorPosition(null);
  }, [getWorldPosition, onDrop]);

  // Listen for global drag start/end events
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/json')) {
        setState((prev) => ({ ...prev, isDragging: true }));
      }
    };

    const handleDragEnd = () => {
      setState((prev) => ({
        ...prev,
        isDragging: false,
        isOverCanvas: false,
        dropPosition: null,
        draggedItem: null,
      }));
      setDropIndicatorPosition(null);
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  return {
    state,
    dropIndicatorPosition,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setCamera,
    setScene,
  };
}

/**
 * DropIndicator - Visual indicator component for drop position
 * Use this in your R3F Canvas
 */
export function createDropIndicatorMaterial(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    color: 0x00ff88,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
}

export function createDropIndicatorGeometry(): THREE.BufferGeometry {
  // Create a circular indicator
  const geometry = new THREE.RingGeometry(0.3, 0.5, 32);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

// Export default hook
export default useCanvasDragDrop;

