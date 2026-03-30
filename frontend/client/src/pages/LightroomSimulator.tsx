import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import LightroomPluginTest from '@/components/lightroom/LightroomPluginTest';

const LightroomSimulator: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Lightroom Integration Workspace
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Denne siden kjører nå ekte Lightroom-diagnostikk mot plugin-, Google Drive- og showcase-flyten i stedet for simulert data.
        </Typography>
      </Box>
      <LightroomPluginTest />
    </Container>
  );
};

export default LightroomSimulator;
