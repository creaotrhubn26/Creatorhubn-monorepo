// @ts-nocheck
/**
 * TeamWorkspacePage — per-prosjekt Team Workspace (dark CreatorHub).
 *
 * Rute: /workspace/:projectId  (valgfritt ?tab=oversikt)
 * Rendrer WorkspaceShell + aktivt tab. Andre tabs enn Oversikt får et
 * pent «kommer»-skall inntil de wires (bygges ett om gangen).
 */
import React, { useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Box, Typography, Stack, Snackbar, Alert, Dialog, DialogContent } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import ProjectCreationWithMemoryCards from '../project/ProjectCreationWithMemoryCards';
import WorkspaceShell from './WorkspaceShell';
import OversiktTab from './tabs/OversiktTab';
import ProsjektplanTab from './tabs/ProsjektplanTab';
import ProduksjonskartTab from './tabs/ProduksjonskartTab';
import ShotlistTab from './tabs/ShotlistTab';
import MoodboardTab from './tabs/MoodboardTab';
import MediaTab from './tabs/MediaTab';
import LeveranserTab from './tabs/LeveranserTab';
import OppgaverTab from './tabs/OppgaverTab';
import AvtalerTab from './tabs/AvtalerTab';
import KundevisningTab from './tabs/KundevisningTab';
import TeamTab from './tabs/TeamTab';
import WorkspaceChatPanel from './WorkspaceChatPanel';
import { usePresence } from './usePresence';
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
  const [accepted, setAccepted] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { online } = usePresence(projectId, `/workspace/${projectId}/${tab}`);

  // Aksepter team-invitasjon når man åpner lenken (?invite=<token>).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('invite');
    if (!token) return;
    apiRequest(`/api/projects/team/accept/${encodeURIComponent(token)}`, { method: 'POST' })
      .then((r: any) => {
        if (r?.success) setAccepted('Du er nå med i prosjektteamet 🎉');
        // fjern token fra URL
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      })
      .catch(() => { /* ugyldig/utløpt — stille */ });
  }, []);

  // Last ekte prosjekt-data i headeren (fallback til sample for /workspace/sample).
  const [realProject, setRealProject] = useState<any | null>(null);
  useEffect(() => {
    if (!projectId || projectId === 'sample') { setRealProject(null); return; }
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`)
      .then((r: any) => {
        const p = r?.project;
        if (!p) return;
        const date = p.eventDate ? new Date(p.eventDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;
        setRealProject({
          id: p.id, name: p.title || 'Uten tittel', type: p.projectType || undefined,
          status: p.status === 'active' ? 'Pågående' : (p.status || undefined),
          date, location: p.location || undefined, coverUrl: p.coverUrl || null, members: [],
        });
      })
      .catch(() => setRealProject(null));
  }, [projectId]);

  const project = realProject || { ...SAMPLE_PROJECT, id: projectId };
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
    oppgaver: <OppgaverTab projectId={projectId} />,
    avtaler: <AvtalerTab projectId={projectId} />,
    kundevisning: <KundevisningTab projectId={projectId} />,
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
      online={online}
      onNewProject={() => setShowCreate(true)}
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
      <Snackbar open={!!accepted} autoHideDuration={5000} onClose={() => setAccepted(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAccepted(null)}>{accepted}</Alert>
      </Snackbar>

      {/* Nytt prosjekt — ProjectCreationWithMemoryCards-wizarden */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} fullWidth maxWidth="lg">
        <DialogContent dividers sx={{ p: 0 }}>
          {showCreate && (
            <ProjectCreationWithMemoryCards
              profession={(user?.profession as string) || 'photographer'}
              userId={user?.id}
              onProjectCreated={(p: any) => {
                setShowCreate(false);
                if (p?.id) navigate(`/workspace/${p.id}`);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
};

export default TeamWorkspacePage;
