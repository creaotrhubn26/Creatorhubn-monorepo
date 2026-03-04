import type { Scene, SceneNode } from '@/core/models/scene';

export function updateObject(scene: Scene, id: string, patch: Partial<SceneNode>): Scene {
  return {
    ...scene,
    nodes: scene.nodes.map((n) =>
      n.id === id
        ? { ...n, ...patch, transform: { ...n.transform, ...(patch.transform ?? {}) } }
        : n,
    ),
  };
}
