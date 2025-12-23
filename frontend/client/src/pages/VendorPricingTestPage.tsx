import { useTheming } from '../utils/theming-helper';
import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import UniversalVendorDashboard from '@/components/vendor/UniversalVendorDashboard';

function VendorPricingTestPage() {
  // Theming system
  const theming = useTheming('photographer');
  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h4" sx={{  mb: 2, fontWeight: 600}}>
          🏪 Vendor Prisadministrasjon Test
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', mb:  3 }}>
          Testing av prisadministrasjon for vendor profession med UniversalVendorDashboard
        </Typography>
      </Paper>

      {/* Test Audio Vendor */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h5" sx={{  mb: 2, color: theming.colors.primary }}>
          🎵 Audio & Music Vendor
        </Typography>
        <UniversalVendorDashboard
          vendorType="audio"
          vendorName="Norsk Musikk Plugins"
          userId="test-vendor-audio"
          compact={false}
        />
      </Paper>

      {/* Test Print Vendor */}
      <Paper sx={{ p:  3, mb:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h5" sx={{  mb: 2, color: theming.colors.primary }}>
          🖨️ Print & Design Vendor
        </Typography>
        <UniversalVendorDashboard
          vendorType="print"
          vendorName="NorthTone Design"
          userId="test-vendor-print"
          compact={false}
        />
      </Paper>

      {/* Test Software Vendor */}
      <Paper sx={{ p:  3 ,  ...theming.getThemedCardSx() }}>
        <Typography variant="h5" sx={{  mb: 2, color: theming.colors.primary }}>
          💻 Software & Tools Vendor
        </Typography>
        <UniversalVendorDashboard
          vendorType="software"
          vendorName="Nordic Software Solutions"
          userId="test-vendor-software"
          compact={false}
        />
      </Paper>
    </Box>
  );
}

export default VendorPricingTestPage;
