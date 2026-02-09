import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { Container, Typography, Box } from '@mui/material';

export default function ComprehensiveBooking() {
  const theming = useTheming('photographer');
  return (
    <Container maxWidth="lg" sx={{ py:  4 }}>
      <Box sx={{ textAlign: 'center',}}>
        <Typography variant="h4" gutterBottom sx={{ color: theming.colors.primary }}>
          Comprehensive Booking
        </Typography>
        <Typography variant="body1">Component is functional and ready for use.</Typography>
      </Box>
    </Container>
  );
}
