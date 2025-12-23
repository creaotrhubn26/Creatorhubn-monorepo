import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { Box, Container } from '@mui/material';
import BusinessBrandingSettings from '../components/BusinessBrandingSettings';

const BusinessBrandingPage: React.FC = () => {
  // Theming system
  const theming = useTheming('photographer');
  // Use session-based user ID for demo purposes
  const userId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, rgba(255, 1400.1) 0%, rgba(255, 1400.05) 100%)',
        paddingTop: 4,
        paddingBottom: 4,
    }}
    >
      <Container maxWidth="xl">
        <BusinessBrandingSettings userId={userId} />
      </Container>
    </Box>
  );
};

export default BusinessBrandingPage;
