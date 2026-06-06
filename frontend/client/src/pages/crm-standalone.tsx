// Direct deep-link to the Universal CRM (e.g. /crm). Renders the CRM dashboard
// on its own — useful as a focused entry point and for end-to-end recording.
// Auth is still required; the CRM's API calls carry the session token.
import React from 'react';
import { Box } from '@mui/material';
import UniversalCRMDashboard from '@/components/crm/UniversalCRMDashboard';

export default function CrmStandalone() {
  return (
    <Box sx={{ p: { xs: 1, md: 2 }, maxWidth: 1400, mx: 'auto' }}>
      <UniversalCRMDashboard profession="photographer" />
    </Box>
  );
}
