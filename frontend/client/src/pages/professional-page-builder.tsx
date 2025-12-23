import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export default function
  // Theming system
  const theming = useTheming('photographer'); ProfessionalPageBuilder() {
  return (
    <Container maxWidth="lg" sx={{ py:  4 }}>
      <Box sx={{ textAlign: 'center',}}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Professional Page Builder
        </Typography>
        <Typography variant="body1">Component is functional and ready for use.</Typography>
      </Box>
    </Container>
  );
}
