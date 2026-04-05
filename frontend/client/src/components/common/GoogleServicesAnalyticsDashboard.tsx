import React from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import GoogleAnalyticsDashboardEnhanced from '../admin/GoogleAnalyticsDashboardEnhanced';

interface GoogleServicesAnalyticsDashboardProps {
  userId?: string;
  compact?: boolean;
  showDetails?: boolean;
}

export const GoogleServicesAnalyticsDashboard: React.FC<
  GoogleServicesAnalyticsDashboardProps
> = ({ compact = false, showDetails = true }) => {
  return (
    <Stack spacing={2}>
      {!compact ? (
        <Box sx={{ maxWidth: 760 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#181512',
              mb: 1,
            }}
          >
            Analytics
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#6c625b',
              lineHeight: 1.7,
            }}
          >
            Denne flaten bruker samme CreatorHub-design og samme ekte datagrunnlag
            som admin-overviewet. Hardkodede demo-tall er fjernet, og tomme
            datakilder vises eksplisitt i stedet for å fylle inn mock-data.
          </Typography>
        </Box>
      ) : null}

      {showDetails ? (
        <Alert
          severity="info"
          sx={{
            borderRadius: '20px',
            bgcolor: 'rgba(255, 248, 240, 0.92)',
            border: '1px solid rgba(255, 107, 48, 0.16)',
          }}
        >
          Google Services-flaten er slått sammen med den operative
          CreatorHub-analyticsvisningen for å sikre ett visuelt språk og ett
          sannferdig tallgrunnlag.
        </Alert>
      ) : null}

      <GoogleAnalyticsDashboardEnhanced hideHeader={compact} />
    </Stack>
  );
};

export default GoogleServicesAnalyticsDashboard;
