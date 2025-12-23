import * as React from 'react';
import { styled } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';
import StageItem2D from './StageItem2D';
import Rulers from './Rulers';
import Guides from './Guides';
import { useNodes, useMeasureMode, useActions } from '@/state/selectors';

const GridStage = styled('div')(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  backgroundColor: '#f6f7f9',
  backgroundImage:
    'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)',
  backgroundSize: '32px 32px, 32px 32px',
  backgroundPosition: '0 0, 0 0',
  borderRight: '1px solid #e5e7eb',
  overflow: 'hidden',
}));

const BackdropPaper = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: '50%',
  top: TOP_H,
  transform: 'translateX(-50%)',
  width: 520,
  height: 380,
  border: '1px solid #cbd5e1',
  background: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  borderRadius: 8,
}));

const pxPerMeter = 60;
const TOP_H = 56;
const BOTTOM_H = 250;
const stageRect = () => {
  const top = TOP_H;
  const bottom = BOTTOM_H;
  const h = window.innerHeight - top - bottom;
  return { top, height: h, midY: top + h * 0.55 };
};

const toStage = (x: number, z: number) => ({
  left: `calc(50% + ${x * pxPerMeter}px)`,
  top: `calc(${stageRect().midY}px - ${z * pxPerMeter}px)`,
});

const toWorld = (clientX: number, clientY: number) => {
  const midX = window.innerWidth / 2;
  const midY = stageRect().midY;
  const x = (clientX - midX) / pxPerMeter;
  const z = (midY - clientY) / pxPerMeter;
  return [x, z] as [number, number];
};

export default function Stage2D() {
  const nodes = useNodes();
  const measureMode = useMeasureMode();
  const { addMeasurementPoints } = useActions();
  const pendingRef = React.useRef<[number, number] | null>(null);

  const onClickStage = (e: React.MouseEvent) => {
    if (!measureMode) return;
    const [x, z] = toWorld(e.clientX, e.clientY);
    if (!pendingRef.current) {
      pendingRef.current = [x, z];
    } else {
      addMeasurementPoints(pendingRef.current, [x, z]);
      pendingRef.current = null;
    }
  };

  const onDragOver = (e: any) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const mx = (sx - rect.width / 2) / 40;
    const mz = (sy - rect.height / 2) / 40;
    const snap = (v: number) => Math.round(v / 0.25) * 0.25;
    let asset = null;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) asset = JSON.parse(raw).asset;
    } catch {}
    const ev = new CustomEvent('ch-set-ghost-2d', { detail: { pos: [snap(mx), snap(mz)], asset } });
    window.dispatchEvent(ev as any);
  };
  const onDrop = (e: any) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const { asset } = JSON.parse(raw);
      const rect = e.currentTarget.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      // convert stage coords to world meters (approx using your mapper)
      const mx = (sx - rect.width / 2) / 40; // assume 40 px per meter fallback
      const mz = (sy - rect.height / 2) / 40;
      const ev = new CustomEvent('ch-add-asset-at', { detail: { asset, position: [mx, 0, mz] } });
      window.dispatchEvent(ev as any);
    } catch {}
  };
  const [ghost, setGhost] = React.useState<[number, number] | null>(null);
  const [ghostAsset, setGhostAsset] = React.useState<any | null>(null);
  React.useEffect(() => {
    const fn = (e: any) => {
      setGhost(e.detail?.pos || null);
      setGhostAsset(e.detail?.asset || null);
    };
    window.addEventListener('ch-set-ghost-2d', fn as any);
    return () => window.removeEventListener('ch-set-ghost-2d', fn as any);
  }, []);
  return (
    <Box
      onDragOver={onDragOver}
      onDrop={onDrop}
      sx={{ position: 'absolute', inset: 0 }}
      onClick={onClickStage}
    >
      <Rulers />
      <GridStage>
        <BackdropPaper>
          <Typography variant="body2" color="text.secondary">
            Backdrop
          </Typography>
        </BackdropPaper>
        {nodes
          .filter((n) => n.type !== 'backdrop' && n.visible !== false)
          .map((n) => {
            const pos = toStage(n.transform.position[0], n.transform.position[2]);
            return <StageItem2D key={n.id} node={n} style={{ left: pos.left, top: pos.top }} />;
          })}
        <Guides />
      </GridStage>
      {ghost ? (
        <div
          style={{
            position: 'absolute',
            left: `calc(50% + ${ghost[0] * 40}px - 6px)`,
            top: `calc(50% + ${ghost[1] * 40}px - 6px)`,
            width: 12,
            height: 12,
            background: '#22c55e',
            borderRadius: 8,
            pointerEvents: 'none'}}
        />
      ) : null}
      {ghost ? (
        <div
          style={{
            position: 'absolute',
            left: `calc(50% + ${ghost[0] * 40}px - 10px)`,
            top: `calc(50% + ${ghost[1] * 40}px - 10px)`,
            width: 20,
            height: 20,
            background: 'rgba(34,197,94,0.35)',
            border: '2px solid #22c55e',
            borderRadius: 2,
            pointerEvents: 'none'}}
        />
      ) : null}
    </Box>
  );
}
