// @ts-nocheck
/**
 * ui.tsx — delte byggeklosser for Team Workspace-tabbene (dark CreatorHub).
 */
import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { ws } from './workspaceTheme';

export const WsCard: React.FC<{ children: React.ReactNode; sx?: any; pad?: number }> = ({ children, sx, pad = 2 }) => (
  <Box sx={{
    bgcolor: ws.panel, border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px`,
    p: pad, ...sx,
  }}>
    {children}
  </Box>
);

export const WsSectionTitle: React.FC<{ icon?: React.ReactNode; title: string; action?: React.ReactNode; sx?: any }> = ({ icon, title, action, sx }) => (
  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5, ...sx }}>
    <Stack direction="row" alignItems="center" spacing={1}>
      {icon}
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: ws.text }}>{title}</Typography>
    </Stack>
    {action}
  </Stack>
);

/** Donut/ring progress (Team Sync %, Ressursallokering) */
export const WsRing: React.FC<{ value: number; size?: number; thickness?: number; color?: string; label?: string; sub?: string }> = ({
  value, size = 120, thickness = 10, color = ws.green, label, sub,
}) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, value)) / 100);
  return (
    <Box sx={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: size * 0.22, fontWeight: 800, color: ws.text, lineHeight: 1 }}>{label ?? `${value}%`}</Typography>
        {sub && <Typography sx={{ fontSize: 11, color: ws.textDim, mt: 0.25 }}>{sub}</Typography>}
      </Box>
    </Box>
  );
};

/** Tynn fremdriftslinje */
export const WsBar: React.FC<{ value: number; color?: string; height?: number }> = ({ value, color = ws.accent, height = 6 }) => (
  <Box sx={{ width: '100%', height, borderRadius: height, bgcolor: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
    <Box sx={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', bgcolor: color, borderRadius: height }} />
  </Box>
);
