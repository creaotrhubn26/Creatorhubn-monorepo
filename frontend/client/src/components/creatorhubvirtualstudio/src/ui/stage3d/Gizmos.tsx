import * as React from 'react';
import { useScene, useActions } from'@/state/selectors';
let TransformControls: any = null,
  useThree: any = null;
try {
  // @ts-ignore
  TransformControls = require('@react-three/drei').TransformControls;
  // @ts-ignore
  useThree = require('@react-three/fiber').useThree;
} catch {}

export default function Gizmos() {
  const scene = useScene();
  const { transformNode } = useActions();
  const id = scene.selection[0];
  const node = scene.nodes.find((n) => n.id === id);
  const { camera, gl } = useThree ? useThree() : { camera: null, gl: null };

  if (!TransformControls || !node) return null;

  const onObjectChange = (e: any) => {
    const obj = e?.target?.object;
    if (!obj) return;
    const p = obj.position;
    transformNode(node.id, { position: [p.x, p.y, p.z] });
  };

  return (
    <TransformControls onObjectChange={onObjectChange}>
      {/* @ts-ignore - three.js primitive */}
      <mesh
        position={[
          node.transform.position[0],
          node.transform.position[1],
          node.transform.position[2],
        ]}
      >
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </TransformControls>
  );
}
