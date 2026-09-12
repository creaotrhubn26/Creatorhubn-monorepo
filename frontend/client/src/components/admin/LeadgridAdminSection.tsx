/**
 * LeadgridAdminSection.tsx
 *
 * Samlet hjem for alle leadgrid.no-admin-verktøy (super-admin). Erstatter at
 * disse lå spredt som under-faner i «Prisstyring» — de er innhold/markedsføring
 * for landingssiden, ikke prising.
 *
 *   Priser · Mockup-innhold · Kundeomtaler
 */

import React, { useState } from 'react';
import { Box, Tab, Tabs } from '@mui/material';
import {
  Public as PublicIcon,
  Movie as MovieIcon,
  FormatQuote as QuoteIcon,
} from '@mui/icons-material';
import LeadgridPricingConfigPanel from './LeadgridPricingConfigPanel';
import LeadgridExperienceMediaPanel from './LeadgridExperienceMediaPanel';
import LeadgridTestimonialsPanel from './LeadgridTestimonialsPanel';

export default function LeadgridAdminSection() {
  const [tab, setTab] = useState(0);
  return (
    <Box sx={{ px: { xs: 0.5, sm: 1.5 }, pt: 1 }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 1, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab icon={<PublicIcon />} iconPosition="start" label="Priser" />
        <Tab icon={<MovieIcon />} iconPosition="start" label="Mockup-innhold" />
        <Tab icon={<QuoteIcon />} iconPosition="start" label="Kundeomtaler" />
      </Tabs>
      {tab === 0 && <LeadgridPricingConfigPanel />}
      {tab === 1 && <LeadgridExperienceMediaPanel />}
      {tab === 2 && <LeadgridTestimonialsPanel />}
    </Box>
  );
}
