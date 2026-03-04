import type { Scene } from '@/core/models/scene';

export function transformObject(
  scene: Scene,
  id: string,
  transform: Partial<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }>,
): Scene {
  return {
    ...scene,
    nodes: scene.nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            transform: {
              position: transform.position ?? n.transform.position,
              rotation: transform.rotation ?? n.transform.rotation,
              scale: transform.scale ?? n.transform.scale,
            },
          }
        : n,
    ),
  };
}
