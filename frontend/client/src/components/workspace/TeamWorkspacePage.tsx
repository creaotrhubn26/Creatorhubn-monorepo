// @ts-nocheck
/**
 * TeamWorkspacePage — per-prosjekt Team Workspace (dark CreatorHub).
 *
 * Rute: /workspace/:projectId  (valgfritt ?tab=oversikt)
 * Rendrer WorkspaceShell + aktivt tab. Andre tabs enn Oversikt får et
 * pent «kommer»-skall inntil de wires (bygges ett om gangen).
 */
import React, { useState, useEffect, useMemo } from 'react';
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
import SoundRoomTab from './tabs/SoundRoomTab';
import VideoRoomTab from './tabs/VideoRoomTab';
import PhotoRoomTab from './tabs/PhotoRoomTab';
import LaaterTab from './tabs/LaaterTab';
import SesjonerTab from './tabs/SesjonerTab';
import ForesporslerTab from './tabs/ForesporslerTab';
import UtstyrTab from './tabs/UtstyrTab';
import AcademyInstructorAdminStudio from '../academy/AcademyInstructorAdminStudio';
import { AcademyProvider } from '@/contexts/AcademyContext';
import CommunityHub from '../community/CommunityHub';
import WorkspaceChatPanel from './WorkspaceChatPanel';
import { usePresence } from './usePresence';
import { ws, WS_NAV, navForProfession, isMusicProfession } from './workspaceTheme';

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
  const { user, logout } = useAuth();

  const [tab, setTab] = useState<string>(paramsTab?.tab || 'oversikt');
  // URL er sannhetskilden for aktiv fane — så navigate('/workspace/:id/:tab')
  // fra hvilken som helst fane (f.eks. «Se alle»-knapper) bytter fane.
  useEffect(() => { const t = paramsTab?.tab; if (t && t !== tab) setTab(t); }, [paramsTab?.tab]);

  // Mentor/instruktør-status → Academy-admin-fane (samme gating som dashboardet).
  const [isMentor, setIsMentor] = useState(false);
  useEffect(() => {
    const uid = user?.id;
    if (!uid || uid === 'guest') { setIsMentor(false); return; }
    if (user?.profession === 'enterprise' || (user as any)?.role === 'instructor') { setIsMentor(true); return; }
    apiRequest(`/api/community/user/${encodeURIComponent(uid)}/roles`)
      .then((r: any) => setIsMentor((r?.roles || []).some((role: any) => role?.name === 'Mentor')))
      .catch(() => {});
  }, [user?.id, user?.profession]);
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

  // Ekte team-medlemmer til header-avatarene (eier + aktive medlemmer).
  const [members, setMembers] = useState<{ id: string; name?: string; avatarUrl?: string | null }[]>([]);
  useEffect(() => {
    if (!projectId || projectId === 'sample') { setMembers([]); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`)
      .then((r: any) => {
        const list: any[] = [];
        if (r?.owner) list.push({ id: r.owner.userId || 'owner', name: r.owner.name || r.owner.email, avatarUrl: r.owner.avatarUrl || null });
        for (const m of (r?.members || [])) list.push({ id: m.id, name: m.name || m.email, avatarUrl: m.avatarUrl || m.avatar_url || null });
        setMembers(list);
      })
      .catch(() => setMembers([]));
  }, [projectId]);

  const goTab = (key: string) => {
    setTab(key);
    if (WS_NAV.find((n) => n.key === key)?.route) navigate(`/workspace/${projectId}/${key}`, { replace: true });
  };

  const project = { ...(realProject || { ...SAMPLE_PROJECT, id: projectId }), members };
  const wsUser = {
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.email || 'Bruker'),
    role: isMusicProfession(user?.profession) ? 'Musikkprodusent' : (user?.profession === 'videographer' ? 'Videograf' : 'Fotograf'),
    email: user?.email || null,
    avatarUrl: user?.avatarUrl || null,
  };

  // Antall nye innkommende henvendelser (leads) → badge på Forespørsler-fanen.
  const [inboundCount, setInboundCount] = useState(0);
  useEffect(() => {
    if (!user?.id) { setInboundCount(0); return; }
    apiRequest('/api/foresporsler/inbound')
      .then((r: any) => setInboundCount(Array.isArray(r?.items) ? r.items.length : (r?.openCount || 0)))
      .catch(() => setInboundCount(0));
  }, [user?.id, tab]);

  // Ulest klient-aktivitet (nedlasting/utvalg/kommentar) → badge på Kundevisning.
  // Re-fetches ved tab-bytte; nullstilles når Kundevisning-fanen åpnes (marker sett).
  const [clientActivityUnseen, setClientActivityUnseen] = useState(0);
  useEffect(() => {
    if (!projectId || projectId === 'sample') { setClientActivityUnseen(0); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/client-activity`)
      .then((r: any) => setClientActivityUnseen(r?.unseenCount || 0))
      .catch(() => setClientActivityUnseen(0));
  }, [projectId, tab]);

  // Ulest band-aktivitet (band-kommentarer) → badge på Sound Room. Nullstilles når
  // Sound Room-fanen åpnes (marker sett).
  const [bandUnseen, setBandUnseen] = useState(0);
  useEffect(() => {
    if (!projectId || projectId === 'sample') { setBandUnseen(0); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/audio-room/unseen-comments`)
      .then((r: any) => setBandUnseen(r?.unseenCount || 0))
      .catch(() => setBandUnseen(0));
  }, [projectId, tab]);

  // Profesjons-filtrert nav — musikkprodusent får Låter/Sesjoner/Sound Room
  // i stedet for Shotlist/Produksjonskart/Photo+Video Room.
  const nav = useMemo(() => navForProfession(user?.profession, { isMentor }), [user?.profession, isMentor]);
  // Hvis aktiv fane ikke finnes i profesjonens nav (f.eks. delt lenke til
  // 'shotlist' for en musikkprodusent), fall tilbake til Oversikt.
  useEffect(() => {
    if (!nav.length) return;
    const valid = new Set(nav.map((n) => n.key));
    // 'chat' og universelle finnes alltid i nav; rom/visuelle kan mangle.
    if (!valid.has(tab) && tab !== 'oversikt') goTab('oversikt');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, nav]);

  const navItem = WS_NAV.find((n) => n.key === tab);

  const TABS: Record<string, React.ReactNode> = {
    oversikt: <OversiktTab projectId={projectId} />,
    prosjektplan: <ProsjektplanTab projectId={projectId} />,
    produksjonskart: <ProduksjonskartTab projectId={projectId} />,
    shotlist: <ShotlistTab projectId={projectId} />,
    laater: <LaaterTab projectId={projectId} />,
    sesjoner: <SesjonerTab projectId={projectId} />,
    academy: <AcademyProvider><AcademyInstructorAdminStudio /></AcademyProvider>,
    community: <CommunityHub userId={user?.id} userEmail={user?.email} profession={user?.profession || 'photographer'} />,
    moodboard: <MoodboardTab projectId={projectId} />,
    media: <MediaTab projectId={projectId} />,
    utstyr: <UtstyrTab projectId={projectId} profession={user?.profession} userId={user?.id} />,
    leveranser: <LeveranserTab projectId={projectId} />,
    oppgaver: <OppgaverTab projectId={projectId} />,
    avtaler: <AvtalerTab projectId={projectId} />,
    foresporsler: <ForesporslerTab projectId={projectId} profession={user?.profession} userId={user?.id} userName={user?.firstName || (user as any)?.name || user?.email} />,
    kundevisning: <KundevisningTab projectId={projectId} />,
    team: <TeamTab projectId={projectId} profession={user?.profession} userId={user?.id} projectName={(project as any)?.title || (project as any)?.name} />,
    'sound-room': <SoundRoomTab projectId={projectId} />,
    'video-room': <VideoRoomTab projectId={projectId} />,
    'photo-room': <PhotoRoomTab projectId={projectId} />,
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
      onLogout={() => { try { (logout as any)?.(); } catch { window.location.href = '/login'; } }}
      activeTab={tab}
      onTab={goTab}
      navItems={nav}
      badges={{ foresporsler: inboundCount, kundevisning: clientActivityUnseen, 'sound-room': bandUnseen }}
      onClientView={() => goTab('kundevisning')}
      onInvite={() => goTab('team')}
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
