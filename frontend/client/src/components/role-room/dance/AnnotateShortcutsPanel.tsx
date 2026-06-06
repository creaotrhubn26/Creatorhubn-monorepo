/**
 * AnnotateShortcutsPanel — Shortcuts-panel i DanceAnnotate-mockup.
 *
 * Liten kompakt cheat-sheet for de viktigste annotering-keybindene:
 * Space play/pause · ←/→ seek · A Add Annotation · D Delete · S Split.
 *
 * Holdes som en tabell-lignende stack inni bunn-panelet ved siden av
 * Annotation Details.
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { danceFlowColors } from './danceFlowTheme';

interface Row { keys: string; label: string; }

const ROWS: readonly Row[] = [
  { keys: 'Space', label: 'Play / Pause' },
  { keys: '← / →', label: 'Seek' },
  { keys: 'A', label: 'Add Annotation' },
  { keys: 'D', label: 'Delete Annotation' },
  { keys: 'S', label: 'Split Annotation' },
];

export default function AnnotateShortcutsPanel(): React.ReactElement {
  return (
    <Box data-testid="annotate-shortcuts-panel">
      <Typography
        variant="overline"
        sx={{
          display: 'block', mb: 1,
          color: danceFlowColors.textMuted,
          fontWeight: 700, letterSpacing: 1.2, fontSize: 11,
        }}
      >
        Shortcuts
      </Typography>
      <Stack spacing={0.5}>
        {ROWS.map((r) => (
          <Stack
            key={r.keys}
            direction="row"
            alignItems="center"
            spacing={1.5}
            data-testid={`annotate-shortcut-${r.keys.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Box
              sx={{
                fontSize: 10, fontWeight: 700,
                fontFamily: 'ui-monospace, Menlo, monospace',
                color: danceFlowColors.gold,
                bgcolor: 'rgba(251,191,36,0.08)',
                px: 0.75, py: 0.25,
                borderRadius: 0.5,
                minWidth: 64,
                textAlign: 'center',
              }}
            >
              {r.keys}
            </Box>
            <Typography sx={{ fontSize: 12, color: danceFlowColors.textSecondary }}>
              {r.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
