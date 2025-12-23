import { Scene } from '@/core/models/scene';

export function deleteObject(scene: Scene, id: string): Scene {
  const remain = scene.nodes.filter((n) => n.id !== id);
  const selection = scene.selection.filter((sid) => sid !== id);
  return { ...scene, nodes: remain, selection };
}
