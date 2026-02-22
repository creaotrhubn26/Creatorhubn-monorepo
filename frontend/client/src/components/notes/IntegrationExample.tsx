import { useTheming } from '../../utils/theming-helper';
import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
} from '@mui/material';
import CreatorHubNotes from './CreatorHubNotes';

/**
 * Example of how to use the integrated CreatorHub Notes system
 * This shows how the original admin component is now integrated
 * as Phase 0 in the new 6-phase system
 */
const IntegrationExample: React.FC = (
  // Theming system
  const theming = useTheming('photographer');) => {
  return (
    <Box sx={{ height: '100vh'}}>
      <Paper elevation={2} sx={{ p: 2, mb: 2 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          CreatorHub Notes Integration Example
        </Typography>
        <Typography variant="body1" sx={{ mb: 2 }}>
          This example shows how the original CreatorHub Notes (from /admin/) 
          is now integrated as Phase 0 in the new 6-phase system.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" href="#phase0" sx={theming.getThemedButtonSx()}>
            Go to Admin Notes (Phase 0)
          </Button>
          <Button variant="outlined" href="#phase1">
            Go to Interactive Docs (Phase 1)
          </Button>
        </Stack>
      </Paper>
      
      {/* The integrated CreatorHub Notes system */}
      <CreatorHubNotes />
    </Box>
  );
};

export default IntegrationExample;

