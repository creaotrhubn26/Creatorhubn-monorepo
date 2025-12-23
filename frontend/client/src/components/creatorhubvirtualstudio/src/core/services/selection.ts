import { Scene, SceneNode } from '../models/scene';

/**
 * Select nodes by IDs
 */
export function select(scene: Scene, ids: string[]): Scene {
  return { ...scene, selection: ids };
}

/**
 * Hit test for top-down 2D view
 * Tests if a point (x, y) in world coordinates intersects with any node
 * Returns the ID of the topmost intersected node, or null if none
 */
export function hitTestTopDown(scene: Scene, x: number, y: number): string | null {
  // Get nodes sorted by Z position (higher Z = on top in top-down view)
  const sortedNodes = [...scene.nodes]
    .filter((node) => node.visible)
    .sort((a, b) => (b.transform.position[2] || 0) - (a.transform.position[2] || 0));

  for (const node of sortedNodes) {
    const pos = node.transform.position;
    const scale = node.transform.scale;

    // Calculate bounding box based on node type
    const bounds = getNodeBounds(node);
    
    // Check if point is within bounds
    const halfWidth = (bounds.width * scale[0]) / 2;
    const halfDepth = (bounds.depth * scale[2]) / 2;

    const minX = pos[0] - halfWidth;
    const maxX = pos[0] + halfWidth;
    const minY = pos[2] - halfDepth; // Z in 3D = Y in top-down
    const maxY = pos[2] + halfDepth;

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      return node.id;
    }
  }

  return null;
}

/**
 * Hit test for 3D raycasting
 * Returns the ID of the first intersected node
 */
export function hitTest3D(
  scene: Scene,
  rayOrigin: [number, number, number],
  rayDirection: [number, number, number]
): string | null {
  const visibleNodes = scene.nodes.filter((node) => node.visible);

  let closestNode: SceneNode | null = null;
  let closestDistance = Infinity;

  for (const node of visibleNodes) {
    const bounds = getNodeBounds(node);
    const pos = node.transform.position;
    const scale = node.transform.scale;

    // Simple AABB intersection test
    const halfSize: [number, number, number] = [
      (bounds.width * scale[0]) / 2,
      (bounds.height * scale[1]) / 2,
      (bounds.depth * scale[2]) / 2,
    ];

    const minBounds: [number, number, number] = [
      pos[0] - halfSize[0],
      pos[1] - halfSize[1],
      pos[2] - halfSize[2],
    ];
    const maxBounds: [number, number, number] = [
      pos[0] + halfSize[0],
      pos[1] + halfSize[1],
      pos[2] + halfSize[2],
    ];

    const t = rayAABBIntersection(rayOrigin, rayDirection, minBounds, maxBounds);
    
    if (t !== null && t < closestDistance) {
      closestDistance = t;
      closestNode = node;
    }
  }

  return closestNode?.id || null;
}

/**
 * Get bounding box dimensions for a node based on its type
 */
function getNodeBounds(node: SceneNode): { width: number; height: number; depth: number } {
  switch (node.type) {
    case 'softbox':
      const modSize = node.light?.modifierSize || [0.6, 0.6];
      return { width: modSize[0], height: modSize[1], depth: 0.3 };
    
    case 'umbrella':
      return { width: 1.0, height: 1.0, depth: 0.5 };
    
    case 'spot':
      return { width: 0.3, height: 0.3, depth: 0.4 };
    
    case 'reflector':
      return { width: 0.8, height: 0.8, depth: 0.1 };
    
    case 'camera':
      return { width: 0.2, height: 0.15, depth: 0.3 };
    
    case 'model':
      return { width: 0.5, height: 1.8, depth: 0.3 }; // Human-sized
    
    case 'backdrop':
      return { width: 4, height: 3, depth: 0.1 };
    
    case'prop':
      return { width: 0.5, height: 0.5, depth: 0.5 };
    
    default:
      return { width: 0.5, height: 0.5, depth: 0.5 };
  }
}

/**
 * Ray-AABB intersection test
 * Returns the distance t along the ray, or null if no intersection
 */
function rayAABBIntersection(
  origin: [number, number, number],
  direction: [number, number, number],
  minBounds: [number, number, number],
  maxBounds: [number, number, number]
): number | null {
  let tMin = -Infinity;
  let tMax = Infinity;

  for (let i = 0; i < 3; i++) {
    if (Math.abs(direction[i]) < 1e-8) {
      // Ray is parallel to slab
      if (origin[i] < minBounds[i] || origin[i] > maxBounds[i]) {
        return null;
      }
    } else {
      const invD = 1 / direction[i];
      let t0 = (minBounds[i] - origin[i]) * invD;
      let t1 = (maxBounds[i] - origin[i]) * invD;

      if (invD < 0) {
        [t0, t1] = [t1, t0];
      }

      tMin = Math.max(tMin, t0);
      tMax = Math.min(tMax, t1);

      if (tMax < tMin) {
        return null;
      }
    }
  }

  return tMin >= 0 ? tMin : (tMax >= 0 ? tMax : null);
}

/**
 * Get all nodes within a rectangular selection area (for box select)
 */
export function boxSelect(
  scene: Scene,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): string[] {
  const selectedIds: string[] = [];

  for (const node of scene.nodes) {
    if (!node.visible) continue;

    const pos = node.transform.position;
    const x = pos[0];
    const y = pos[2]; // Z in 3D = Y in top-down

    if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
      selectedIds.push(node.id);
    }
  }

  return selectedIds;
}

/**
 * Find node by ID
 */
export function findNode(scene: Scene, id: string): SceneNode | null {
  return scene.nodes.find((node) => node.id === id) || null;
}

/**
 * Get selected nodes
 */
export function getSelectedNodes(scene: Scene): SceneNode[] {
  return scene.nodes.filter((node) => scene.selection.includes(node.id));
}
