/**
 * CursorLayer — andres markører på lerretet. Ligger inne i <ReactFlow> og
 * bruker viewporten (x*zoom + vx) til å plassere markørene i skjermrommet;
 * rerendrer ved pan/zoom uten å måle DOM.
 */

import React from 'react';
import { Box } from '@mui/material';
import { useViewport } from '@xyflow/react';
import type { Peer } from './presenceReducer';

export interface CursorLayerProps {
  peers: Peer[];
}

export function CursorLayer({ peers }: CursorLayerProps) {
  const { x: vx, y: vy, zoom } = useViewport();
  if (peers.length === 0) return null;
  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }} data-testid="narrative-cursor-layer">
      {peers.map((p) => {
        if (!p.cursor) return null;
        const left = p.cursor.x * zoom + vx;
        const top = p.cursor.y * zoom + vy;
        return (
          <Box
            key={p.clientId}
            data-testid={`narrative-cursor-${p.userId}`}
            sx={{ position: 'absolute', left, top, transform: 'translate(-2px, -2px)', transition: 'left 80ms linear, top 80ms linear' }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" style={{ display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}>
              <path d="M1 1 L1 15 L5 11 L8 18 L10.5 17 L7.5 10 L13 10 Z" fill={p.color} stroke="#04140a" strokeWidth="1" />
            </svg>
            <Box sx={{ position: 'absolute', left: 14, top: 12, bgcolor: p.color, color: '#04140a', fontSize: 10, fontWeight: 700, px: 0.6, py: 0.1, borderRadius: 0.75, whiteSpace: 'nowrap' }}>
              {p.name}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
