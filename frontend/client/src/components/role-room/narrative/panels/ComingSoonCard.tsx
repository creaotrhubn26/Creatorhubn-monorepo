import React from 'react';
import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';

export function ComingSoonCard({ title, body, phase }: { title: string; body: string; phase: string }) {
  return (
    <Box sx={{ p: 3 }}>
      <Card sx={{ bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}`, color: narrativeColors.text, maxWidth: 640 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ConstructionIcon sx={{ color: narrativeColors.warning }} />
            <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
            <Chip size="small" label={phase} sx={{ ml: 'auto', bgcolor: narrativeColors.accentSoft, color: narrativeColors.accent }} />
          </Box>
          <Typography sx={{ fontSize: 13, color: narrativeColors.textDim }}>{body}</Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
