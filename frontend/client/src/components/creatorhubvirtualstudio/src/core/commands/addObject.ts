import type { Scene, SceneNode } from '@/core/models/scene';
import { uid } from '@/core/utils/ids';

export function addObject(scene: Scene, partial: Partial<SceneNode>): Scene {
  const node: SceneNode = {
    id: partial.id ?? uid('node'),
    type: partial.type ??'softbox',
    name: partial.name,
    transform: partial.transform ?? {
      position: [0, 1.5, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    visible: partial.visible ?? true,
    light: partial.light,
    camera: partial.camera,
    userData: partial.userData ?? {},
  };
  return { ...scene, nodes: [...scene.nodes, node], selection: [node.id] };
}
