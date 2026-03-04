import * as React from 'react';
import { Box } from '@mui/material';
import type { SceneNode } from '@/core/models/scene';
import { useActions, useScene } from '@/state/selectors';

const shapeFor: Record<string, React.CSSProperties> = {
  softbox: {
    width: 60,
    height: 60,
    border: '2px solid #64748b',
    borderRadius: 8,
    background: '#f8fafc',
  },
  umbrella: { width: 62, height: 62, border: '2px dashed #64748b', borderRadius: '50%' },
  spot: { width: 24, height: 24, border: '2px solid #475569', borderRadius: '50%' },
  reflector: { width: 50, height: 30, border: '2px solid #475569', borderRadius: '50% / 40%' },
  camera: { width: 48, height: 30, border: '2px solid #334155', borderRadius: 4 },
  model: { width: 22, height: 90, border: '2px solid #334155', borderRadius: 6 },
};

export default function StageItem2D({
  node,
  style,
}: {
  node: SceneNode;
  style?: React.CSSProperties;
}) {
  const { select, transformNode } = useActions();
  const scene = useScene();
  const selected = scene.selection.includes(node.id);

  // Basic drag in X/Z plane
  const dragRef = React.useRef<{ startX: number; startY: number; base: [number, number] } | null>(
    null,
  );
  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    select([node.id]);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      base: [node.transform.position[0], node.transform.position[2]],
    };
  };
  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = (e.clientX - d.startX) / 60; // px->m
      const dz = (e.clientY - d.startY) / 60;
      transformNode(node.id, {
        position: [d.base[0] + dx, node.transform.position[1], d.base[1] + dz],
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [node.id, node.transform.position, transformNode]);

  return (
    <Box
      onMouseDown={onMouseDown}
      sx={{
        position: 'absolute',
        transform: 'translate(-50%, -50%)',
        cursor: 'grab',
        p: 0.5,
        border: selected ? '2px solid #2563eb' : '2px solid transparent',
        borderRadius: 1,
        bgcolor: 'transparent'}}
      style={style}
    >
      <div style={shapeFor[node.type] ?? shapeFor['softbox']} />
    </Box>
  );
}
