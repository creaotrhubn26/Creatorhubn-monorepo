// Leads & Vekst (Admin Room) — gives The Role Room ITSELF the full producer
// lead-gen toolkit, so we can market The Role Room as a product and pull our own
// leads. Reuses the exact same self-contained producer panels (Leads with
// segmentation/ROI/follow-up/AI, Omtaler, Oppdag, Arrangement) that the agent
// uses for clients — here they operate on The Role Room's own connected accounts.
import React, { useState } from 'react';
import { Box, Stack, Typography, Tabs, Tab, Alert } from '@mui/material';
import {
  ContactPage as LeadsIcon, CampaignOutlined as MentionsIcon,
  TravelExplore as DiscoveryIcon, EventOutlined as EventsIcon,
} from '@mui/icons-material';
import LeadsPanel from '../../components/role-room/components/producer/LeadsPanel';
import MentionsPanel from '../../components/role-room/components/producer/MentionsPanel';
import DiscoveryPanel from '../../components/role-room/components/producer/DiscoveryPanel';
import EventsPanel from '../../components/role-room/components/producer/EventsPanel';

type SubTab = 'leads' | 'mentions' | 'discovery' | 'events';

export default function LeadsGrowthTab() {
  const [sub, setSub] = useState<SubTab>('leads');

  return (
    <Stack spacing={1.5}>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#f8fafc' }}>Leads & Vekst</Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '0.86rem' }}>
          Det samme lead-genererings-verktøyet kundene får — her brukt på The Role Room sine egne kontoer, så vi kan
          markedsføre produktet og hente inn egne leads.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ py: 0.5 }}>
        Krever at The Role Room sin egen Facebook-/Instagram-konto er koblet til (samme «Koble Instagram»-flyt som i agenten).
        Live data følger Meta App Review-godkjenningene.
      </Alert>

      <Tabs
        value={sub}
        onChange={(_e, next: SubTab) => setSub(next)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: '1px solid rgba(148,163,184,0.14)', minHeight: 44, '& .Mui-selected': { color: '#22d3ee !important' }, '& .MuiTabs-indicator': { bgcolor: '#22d3ee' } }}
      >
        <Tab value="leads" label="Leads" icon={<LeadsIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 44 }} />
        <Tab value="mentions" label="Omtaler" icon={<MentionsIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 44 }} />
        <Tab value="discovery" label="Oppdag" icon={<DiscoveryIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 44 }} />
        <Tab value="events" label="Arrangement" icon={<EventsIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', minHeight: 44 }} />
      </Tabs>

      <Box>
        {sub === 'leads' ? <LeadsPanel />
          : sub === 'mentions' ? <MentionsPanel />
          : sub === 'discovery' ? <DiscoveryPanel />
          : <EventsPanel />}
      </Box>
    </Stack>
  );
}
