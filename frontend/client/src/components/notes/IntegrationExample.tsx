import React from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useTheming } from '../../utils/theming-helper';
import CreatorHubNotes from './CreatorHubNotes';

/**
 * Integration reference for CreatorHub Notes.
 * Phase 0 = existing admin notes module embedded in the new notes flow.
 */
const IntegrationExample: React.FC = () => {
  const theming = useTheming('photographer');

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={2} sx={{ p: 2, mb: 2, ...theming.getThemedCardSx() }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          CreatorHub Notes Integration Example
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          Viser hvordan eksisterende admin-notater er koblet inn som fase 0 i notes-systemet.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" href="#phase0">
            Go to Admin Notes (Phase 0)
          </Button>
          <Button variant="outlined" href="#phase1">
            Go to Interactive Docs (Phase 1)
          </Button>
        </Stack>
      </Paper>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <CreatorHubNotes />
      </Box>
    </Box>
  );
};

export default IntegrationExample;

