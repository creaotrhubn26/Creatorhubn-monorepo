// @ts-nocheck
/**
 * TeamWorkspacePage — per-prosjekt Team Workspace (dark CreatorHub).
 *
 * Rute: /workspace/:projectId  (valgfritt ?tab=oversikt)
 * Rendrer WorkspaceShell + aktivt tab. Andre tabs enn Oversikt får et
 * pent «kommer»-skall inntil de wires (bygges ett om gangen).
 */
import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Box, Typography, Stack } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import WorkspaceShell from './WorkspaceShell';
import OversiktTab from './tabs/OversiktTab';
import ProsjektplanTab from './tabs/ProsjektplanTab';
import ProduksjonskartTab from './tabs/ProduksjonskartTab';
import ShotlistTab from './tabs/ShotlistTab';
import MoodboardTab from './tabs/MoodboardTab';
import MediaTab from './tabs/MediaTab';
import LeveranserTab from './tabs/LeveranserTab';
import TeamTab from './tabs/TeamTab';
import WorkspaceChatPanel from './WorkspaceChatPanel';
import { ws, WS_NAV } from './workspaceTheme';

// Prøveprosjekt (Sara & Amir) — byttes med ekte prosjekt-fetch i wire-fasen.
const SAMPLE_PROJECT = {
  id: 'sample',
  name: 'Sara & Amir – Wedding',
  type: 'Bryllup – Foto & Video',
  status: 'In Production',
  date: '14. sep 2024',
  location: 'Oslo, Norge',
  coverUrl: null,
  members: [
    { id: '1', name: 'Thomas' }, { id: '2', name: 'Daniel' }, { id: '3', name: 'Julie' },
    { id: '4', name: 'Marcus' }, { id: '5', name: 'Nora' },
  ],
};

const ComingTab: React.FC<{ label: string }> = ({ label }) => (
  <Stack alignItems="center" justifyContent="center" sx={{ height: '60vh', color: ws.textDim }}>
    <Typography sx={{ fontSize: 18, fontWeight: 700, color: ws.text }}>{label}</Typography>
    <Typography sx={{ fontSize: 13, mt: 1 }}>Dette tabbet wires mot ekte data i neste byggetrinn.</Typography>
  </Stack>
);

const TeamWorkspacePage: React.FC = () => {
  const [, params] = useRoute('/workspace/:projectId');
  const [, paramsTab] = useRoute('/workspace/:projectId/:tab');
  const projectId = paramsTab?.projectId || params?.projectId || 'sample';
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [tab, setTab] = useState<string>(paramsTab?.tab || 'oversikt');

  const project = { ...SAMPLE_PROJECT, id: projectId };
  const wsUser = {
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.email || 'Bruker'),
    role: user?.profession === 'videographer' ? 'Videograf' : 'Fotograf',
    avatarUrl: user?.avatarUrl || null,
  };

  const navItem = WS_NAV.find((n) => n.key === tab);

  const TABS: Record<string, React.ReactNode> = {
    oversikt: <OversiktTab projectId={projectId} />,
    prosjektplan: <ProsjektplanTab projectId={projectId} />,
    produksjonskart: <ProduksjonskartTab projectId={projectId} />,
    shotlist: <ShotlistTab projectId={projectId} />,
    moodboard: <MoodboardTab projectId={projectId} />,
    media: <MediaTab projectId={projectId} />,
    leveranser: <LeveranserTab projectId={projectId} />,
    team: <TeamTab projectId={projectId} />,
    chat: (
      <Box sx={{ height: 'calc(100vh - 160px)', maxWidth: 760, mx: 'auto' }}>
        <WorkspaceChatPanel projectId={projectId} />
      </Box>
    ),
  };
  const content = TABS[tab] || <ComingTab label={navItem?.label || tab} />;

  return (
    <WorkspaceShell
      project={project}
      user={wsUser}
      activeTab={tab}
      onTab={(key) => {
        setTab(key);
        // hold URL i sync for delbare lenker (uten full navigasjon-flimmer)
        if (WS_NAV.find((n) => n.key === key)?.route) {
          navigate(`/workspace/${projectId}/${key}`, { replace: true });
        }
      }}
    >
      {content}
    </WorkspaceShell>
  );
};

export default TeamWorkspacePage;
