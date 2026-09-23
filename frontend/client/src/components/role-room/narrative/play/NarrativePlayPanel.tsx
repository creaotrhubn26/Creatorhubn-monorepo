/**
 * NarrativePlayPanel — Play-fanen i arbeidsflaten: StoryPlayer med debugger
 * og «Rediger element». Den offentlige delingssiden bruker StoryPlayer direkte.
 *
 * Tomt-tilstand (UX-27): ingen elementer å spille ennå — i stedet for
 * StoryPlayers generiske hint gir arbeidsflaten en «Åpne Brett»-knapp som
 * ber NarrativeWorkspace bytte til brett-fanen (samme mekanisme som
 * kommandopaletten/hjem-panelet bruker).
 */

import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { AutoAwesomeMosaicOutlined as BoardIcon } from '@mui/icons-material';
import type { NarrativeGraph } from '../narrativeTypes';
import { narrativeColors } from '../narrativeTheme';
import { requestNarrativeTab } from '../../game/GameBillingPanels';
import { StoryPlayer } from './StoryPlayer';

export interface NarrativePlayPanelProps {
  graph: NarrativeGraph;
  onEditElement: (elementId: string) => void;
}

export function NarrativePlayPanel({ graph, onEditElement }: NarrativePlayPanelProps) {
  if (graph.elements.length === 0) {
    return (
      <Box sx={{ p: 3 }} data-testid="narrative-play-panel">
        <Typography sx={{ color: narrativeColors.textDim, fontSize: 13, mb: 1.5 }}>
          Ingen elementer ennå. Tegn historien på et brett først, så kan du spille den her.
        </Typography>
        <Button
          size="small" variant="outlined" startIcon={<BoardIcon />}
          onClick={() => requestNarrativeTab('boards')}
          sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent }}
          data-testid="narrative-play-open-boards"
        >
          Åpne Brett
        </Button>
      </Box>
    );
  }
  return <StoryPlayer graph={graph} onEditElement={onEditElement} showDebugger />;
}
