import { useTheming } from '../utils/theming-helper';
import { useProfessionConfigs } from '@/hooks/useProfessionConfigs';
import { useProfessionAdapter } from '@/hooks/useProfessionAdapter';
import getProfessionIcon from '@/utils/profession-icons';
import { useDynamicProfessions } from '@/components/universal/hooks/useDynamicProfessions';
import React from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
} from '@mui/material';
import { Lightbulb } from '@mui/icons-material';
import ContextualPhotographyTipsOverlay from '../components/photography/ContextualPhotographyTipsOverlay';

function ContextualPhotographyTipsPage() {
  const { profession } = useProfessionAdapter();
  // Theming system - use dynamic profession
  const theming = useTheming(profession || 'photographer');
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Paper sx={{ ...theming.getThemedCardSx(), p: 4, mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: theming.colors.primary }}>
          <Lightbulb />
          Kontekstuelle Fotograferingstips
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Få intelligente fotograferingstips tilpasset din situasjon, utstyr og erfaringsnivå.
          Systemet analyserer lysforhold, motiv og kamerainnstillinger for å gi deg de mest
          relevante rådene.
        </Typography>
      </Paper>

      <Box sx={{ position: 'relative', minHeight: '600px' }}>
        <ContextualPhotographyTipsOverlay />
      </Box>
    </Container>
  );
}

export default ContextualPhotographyTipsPage;
