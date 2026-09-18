/**
 * PresenceAvatars — «hvem er her nå»: fargede initial-sirkler (maks 5 + «+N»),
 * mønster fra dance/FormationHeaderBar.tsx. Tooltip viser navn og brett.
 */

import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { narrativeColors } from '../narrativeTheme';
import { initialsOf } from './presenceColors';
import type { Peer } from './presenceReducer';

export interface PresenceAvatarsProps {
  peers: Peer[];
  boardNameById?: Map<string, string>;
  connected: boolean;
}

export function PresenceAvatars({ peers, boardNameById, connected }: PresenceAvatarsProps) {
  if (peers.length === 0) {
    return (
      <Tooltip title={connected ? 'Ingen andre er her nå' : 'Sanntid: ikke tilkoblet'}>
        <Box data-testid="narrative-presence" data-connected={connected ? '1' : '0'} sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? narrativeColors.accent : narrativeColors.textDim, opacity: 0.7 }} />
      </Tooltip>
    );
  }
  return (
    <Box data-testid="narrative-presence" data-connected={connected ? '1' : '0'} sx={{ display: 'flex', alignItems: 'center', pl: 0.75 }}>
      {peers.slice(0, 5).map((p) => {
        const board = p.boardId ? boardNameById?.get(p.boardId) : null;
        return (
          <Tooltip key={p.clientId} title={`${p.name}${board ? ` · ${board}` : ''}`}>
            <Box
              data-testid={`narrative-presence-${p.userId}`}
              sx={{
                width: 22, height: 22, borderRadius: '50%', bgcolor: p.color, color: '#04140a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800,
                border: `2px solid ${narrativeColors.bgPanel}`, marginLeft: '-6px', cursor: 'default',
              }}
            >
              {initialsOf(p.name)}
            </Box>
          </Tooltip>
        );
      })}
      {peers.length > 5 ? <Box sx={{ ml: 0.5, fontSize: 10, fontWeight: 700, color: narrativeColors.textDim }}>+{peers.length - 5}</Box> : null}
    </Box>
  );
}
