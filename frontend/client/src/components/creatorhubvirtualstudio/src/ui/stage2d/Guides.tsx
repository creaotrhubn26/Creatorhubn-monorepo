import * as React from 'react';
import { useScene, useMeasurements } from '@/state/selectors';

const pxPerMeter = 60;
const rect = () => {
  const top = 56;
  const bottom = 250; // Reduced from 260 for better 2D view
  const h = window.innerHeight - top - bottom;
  return { top, height: h, midY: top + h * 0.55 };
};
const toStage = (x: number, z: number) => ({
  x: window.innerWidth / 2 + x * pxPerMeter,
  y: rect().midY - z * pxPerMeter,
});

function distanceMeters2D(a: [number, number], b: [number, number]) {
  const dx = a[0] - b[0],
    dz = a[1] - b[1];
  return Math.hypot(dx, dz);
}

export default function Guides() {
  const scene = useScene();
  const measurements = useMeasurements();

  type Line = { from: [number, number]; to: [number, number]; label: string; color?: string };
  const lines: Line[] = [];

  // Manual measurements
  for (const m of measurements) {
    const a = toStage(m.a[0], m.a[1]);
    const b = toStage(m.b[0], m.b[1]);
    const d = distanceMeters2D(m.a, m.b).toFixed(2);
    lines.push({ from: [a.x, a.y], to: [b.x, b.y], label: m.label ?? `${d} m` });
  }

  // Auto quick lines (first cam->model, first light->model)
  const cam = scene.nodes.find((n) => n.camera);
  const model = scene.nodes.find((n) => n.type === 'model');
  const key = scene.nodes.find((n) => n.light);
  if (cam && model) {
    const a = toStage(cam.transform.position[0], cam.transform.position[2]);
    const b = toStage(model.transform.position[0], model.transform.position[2]);
    const d = distanceMeters2D(
      [cam.transform.position[0], cam.transform.position[2]],
      [model.transform.position[0], model.transform.position[2]],
    ).toFixed(2);
    lines.push({ from: [a.x, a.y], to: [b.x, b.y], label: `Camera→Model ${d} m` });
  }
  if (key && model) {
    const a = toStage(key.transform.position[0], key.transform.position[2]);
    const b = toStage(model.transform.position[0], model.transform.position[2]);
    const d = distanceMeters2D(
      [key.transform.position[0], key.transform.position[2]],
      [model.transform.position[0], model.transform.position[2]],
    ).toFixed(2);
    lines.push({ from: [a.x, a.y], to: [b.x, b.y], label: `Key→Model ${d} m` });
  }

  if (lines.length === 0) return null;

  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <defs>
        <marker id="arrow-end" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#2563eb" />
        </marker>
        <marker id="arrow-start" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M8,0 L0,4 L8,8 z" fill="#2563eb" />
        </marker>
      </defs>
      {lines.map((ln, i) => {
        const [x1, y1] = ln.from,
          [x2, y2] = ln.to;
        const mx = (x1 + x2) / 2,
          my = (y1 + y2) / 2;
        const dx = x2 - x1,
          dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * 12,
          ny = (dx / len) * 12;
        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={ln.color ||'#2563eb'}
              strokeWidth="2"
              markerStart="url(#arrow-start)"
              markerEnd="url(#arrow-end)"
            />
            <rect
              x={mx + nx - 56}
              y={my + ny - 12}
              width="112"
              height="24"
              rx="6"
              ry="6"
              fill="white"
              stroke="#93c5fd"
            />
            <text x={mx + nx} y={my + ny + 4} textAnchor="middle" fontSize="12" fill="#1e293b">
              {ln.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
