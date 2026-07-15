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
import WorkspaceDesignOverlay from './WorkspaceDesignOverlay';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { createPortal } from 'react-dom';
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
import OppdragTab from './tabs/OppdragTab';
import BookingerTab from './tabs/BookingerTab';
import ForesporslerTab from './tabs/ForesporslerTab';
import UtstyrTab from './tabs/UtstyrTab';
import AcademyInstructorAdminStudio from '../academy/AcademyInstructorAdminStudio';
import { AcademyProvider } from '@/contexts/AcademyContext';
import CommunityHub from '../community/CommunityHub';
import WorkspaceChatPanel from './WorkspaceChatPanel';
import UniversalPrototypeFeedback from '../prototype-testing/UniversalPrototypeFeedback';
import { usePresence } from './usePresence';
import { ws, WS_NAV, navForProfession, localizeNav, workspaceCategoryFor, isMusicProfession, type WsNavItem } from './workspaceTheme';
import { getProfessionDisplayName } from '@shared/profession-types';
import { useWorkspaceCategoryMap } from './useWorkspaceCategory';
import { WsLocaleProvider, type WsLocale } from './wsLocale';
import { localeForVendor } from '../universal/editing-marketplace/editingMarketplaceStrings';

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

/**
 * CreatorHub Design (Nivå 2): slå nav-overstyringer (fra design-tokens) på en
 * ferdig-filtrert/lokalisert nav-liste. Patch pr. key: label/badge/hidden/order.
 * Ukjent/tom → uendret. order sorterer kun når minst én key har order (ellers stabil).
 */
function applyNavOverrides(items: WsNavItem[], ov: Record<string, any> | null | undefined): WsNavItem[] {
  if (!ov || typeof ov !== 'object') return items;
  const kept = items
    .filter((n) => !ov[n.key]?.hidden)
    .map((n) => {
      const o = ov[n.key];
      if (!o) return n;
      const next: WsNavItem = { ...n };
      if (typeof o.label === 'string' && o.label) next.label = o.label;
      if (typeof o.badge === 'number') next.badge = o.badge || undefined;
      return next;
    });
  if (!Object.values(ov).some((o: any) => typeof o?.order === 'number')) return kept;
  return kept
    .map((n, i) => ({ n, i, ord: typeof ov[n.key]?.order === 'number' ? ov[n.key].order : 1000 + i }))
    .sort((a, b) => a.ord - b.ord || a.i - b.i)
    .map((x) => x.n);
}

const TeamWorkspacePage: React.FC = () => {
  const [, params] = useRoute('/workspace/:projectId');
  const [, paramsTab] = useRoute('/workspace/:projectId/:tab');
  const projectId = paramsTab?.projectId || params?.projectId || 'sample';
  const [, navigate] = useLocation();
  const { user, logout, isPrototypeTester, isAdmin } = useAuth();

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
    // Profesjons-AGNOSTISK henting (/api/projects/:id) — den forrige brukte kun
    // /api/photographer/… og falt til sample-prosjektet for musikk/vendor/service.
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}`)
      .then((r: any) => {
        const p = r?.project || r; // generisk endepunkt returnerer feltene direkte
        if (!p || !p.id) return;
        const rawDate = p.eventDate || p.event_date || p.date;
        const date = rawDate ? new Date(rawDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined;
        setRealProject({
          id: p.id, name: p.title || p.name || 'Uten tittel',
          type: p.projectType || p.project_type || undefined,
          status: p.status === 'active' ? 'Pågående' : (p.status || undefined),
          date, location: p.location || undefined, coverUrl: p.coverUrl || p.cover_url || null, members: [],
          updatedAt: p.updatedAt || p.updated_at || null,
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

  // Kun det EKTE sample-prosjektet får SAMPLE_PROJECT-innhold. Et ekte prosjekt
  // som ennå ikke er lastet (eller feilet) får et nøytralt skall — ALDRI «Sara &
  // Amir – Wedding» (sample-lekkasje inn i ikke-fotograf-prosjekter).
  const project = projectId === 'sample'
    ? { ...SAMPLE_PROJECT, id: projectId, members }
    : { ...(realProject || { id: projectId, name: '', type: undefined, status: undefined, date: undefined, location: undefined, coverUrl: null }), members };
  const wsUser = {
    name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || user?.email || 'Bruker'),
    // Rolle-etiketten hentes fra profesjons-registeret (dekker alle ~20
    // profesjonene, ikke bare foto/video/musikk/vendor — service-profesjoner
    // som hundefrisør fikk før feilaktig «Fotograf»).
    role: getProfessionDisplayName(user?.profession) || 'Medlem',
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
  }, [user?.id]);

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

  // Profesjons-filtrert nav — kategorien er admin-styrt (profession_types.
  // workspace_category via useWorkspaceCategoryMap), med kode-map som fallback.
  const categoryOverrides = useWorkspaceCategoryMap();

  // Workspace-språk: utenlandske partner-vendors (is_foreign fra vendor/me,
  // samme deteksjon som partner-portalen) får engelsk i nav, shell og faner.
  // Kun vendor-kategorien sjekkes — alle andre er alltid norske.
  const [wsLocale, setWsLocale] = useState<WsLocale>('no');
  const isVendorCategory = workspaceCategoryFor(user?.profession, categoryOverrides) === 'vendor';
  useEffect(() => {
    if (!isVendorCategory) { setWsLocale('no'); return; }
    apiRequest('/api/editing/vendor/me')
      .then((me: any) => setWsLocale(localeForVendor({ isForeign: me?.isForeign, country: me?.country })))
      .catch(() => setWsLocale('no'));
  }, [isVendorCategory]);

  // CreatorHub Design (Nivå 2): nav-overstyringer som DATA (design-tokens, ws=creatorhub).
  // Patch pr. key (label/badge/hidden/order) — tom/feil → WS_NAV-fallback (uendret).
  const [navOv, setNavOv] = useState<Record<string, any> | null>(null);
  // CreatorHub Design (Nivå 3): live-overlay på ekte ruten, aktivert med ?design=1.
  const [designMode, setDesignMode] = useState<boolean>(() => {
    try { return new URLSearchParams(window.location.search).get('design') === '1'; } catch { return false; }
  });
  useEffect(() => {
    let live = true;
    fetch('/api/design/tokens?ws=creatorhub', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && d.tokens && d.tokens.nav && typeof d.tokens.nav === 'object') setNavOv(d.tokens.nav); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const nav = useMemo(
    () => applyNavOverrides(localizeNav(navForProfession(user?.profession, { isMentor, categoryOverrides }), wsLocale), navOv),
    [user?.profession, isMentor, categoryOverrides, wsLocale, navOv],
  );
  // Hvis aktiv fane ikke finnes i profesjonens nav (f.eks. delt lenke til
  // 'shotlist' for en musikkprodusent), fall tilbake til Oversikt.
  useEffect(() => {
    if (!nav.length) return;
    const valid = new Set(nav.map((n) => n.key));
    // 'chat' og universelle finnes alltid i nav; rom/visuelle kan mangle.
    if (!valid.has(tab) && tab !== 'oversikt') goTab('oversikt');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, nav]);

  // Slå opp i den kategori-resolvede nav-en (riktig label for f.eks. vendor);
  // WS_NAV som fallback for keys utenfor profesjonens nav.
  const navItem = nav.find((n) => n.key === tab) || WS_NAV.find((n) => n.key === tab);

  const content = useMemo(() => {
    switch (tab) {
      case 'oversikt':        return <OversiktTab projectId={projectId} profession={user?.profession} />;
      case 'prosjektplan':    return <ProsjektplanTab projectId={projectId} />;
      case 'produksjonskart': return <ProduksjonskartTab projectId={projectId} />;
      case 'shotlist':        return <ShotlistTab projectId={projectId} />;
      case 'laater':          return <LaaterTab projectId={projectId} />;
      case 'sesjoner':        return <SesjonerTab projectId={projectId} />;
      case 'oppdrag':         return <OppdragTab projectId={projectId} />;
      case 'bookinger':       return <BookingerTab projectId={projectId} />;
      case 'academy':         return <AcademyProvider><AcademyInstructorAdminStudio /></AcademyProvider>;
      case 'community':       return <CommunityHub userId={user?.id} userEmail={user?.email} profession={user?.profession || undefined} />;
      case 'moodboard':       return <MoodboardTab projectId={projectId} />;
      case 'media':           return <MediaTab projectId={projectId} />;
      case 'utstyr':          return <UtstyrTab projectId={projectId} profession={user?.profession} userId={user?.id} />;
      case 'leveranser':      return <LeveranserTab projectId={projectId} />;
      case 'oppgaver':        return <OppgaverTab projectId={projectId} />;
      case 'avtaler':         return <AvtalerTab projectId={projectId} />;
      case 'foresporsler':    return <ForesporslerTab projectId={projectId} profession={user?.profession} userId={user?.id} userName={user?.firstName || (user as any)?.name || user?.email} />;
      case 'kundevisning':    return <KundevisningTab projectId={projectId} />;
      case 'team':            return <TeamTab projectId={projectId} profession={user?.profession} userId={user?.id} projectName={(project as any)?.title || (project as any)?.name} lastUpdated={(realProject as any)?.updatedAt || null} />;
      case 'sound-room':      return <SoundRoomTab projectId={projectId} />;
      case 'video-room':      return <VideoRoomTab projectId={projectId} />;
      case 'photo-room':      return <PhotoRoomTab projectId={projectId} />;
      case 'chat':            return <Box sx={{ height: 'calc(100dvh - 160px)', maxWidth: 760, mx: 'auto' }}><WorkspaceChatPanel projectId={projectId} category={workspaceCategoryFor(user?.profession, categoryOverrides)} /></Box>;
      default:                return <ComingTab label={navItem?.label || tab} />;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, projectId, user?.id, user?.email, user?.profession, user?.firstName, (project as any)?.title, (project as any)?.name, (realProject as any)?.updatedAt, navItem?.label, categoryOverrides]);

  return (
    <WsLocaleProvider value={wsLocale}>
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
      {/* Modul-boundary per fane (keyed på tab → nullstilles ved bytte). Fane-
          komponentene er statisk importert (ikke lazy), så #426 er ikke risikoen
          her — men uten boundary bobler en render-krasj i ÉN fane opp til den
          globale app-router-boundaryen og gjør HELE /workspace-ruten til feil-
          skjerm. Her isoleres krasjen til dét panelet; bytt fane for å komme videre. */}
      <ErrorBoundary
        key={tab}
        componentName={`workspace-tab:${tab}`}
        context={{ tab, projectId }}
        fallback={
          <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '60vh', px: 3, textAlign: 'center' }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: ws.text }}>Denne fanen kunne ikke vises</Typography>
            <Typography sx={{ fontSize: 13, color: ws.textDim }}>Prøv en annen fane, eller last siden på nytt.</Typography>
          </Stack>
        }
      >
        {content}
      </ErrorBoundary>
      {/* CreatorHub Design (N3): admin-gated. Portalert til <body> så position:fixed er ekte
          viewport-relativ (MUI-shell-wrappere lager containing-block-ancestorer som ellers
          dytter FAB-en utenfor skjermen og forskyver overlay-pins). FAB åpner live-overlayet. */}
      {isAdmin && typeof document !== 'undefined' && createPortal(
        designMode ? (
          <WorkspaceDesignOverlay onClose={() => setDesignMode(false)} />
        ) : (
          <Box role="button" tabIndex={0} onClick={() => setDesignMode(true)}
            sx={{ position: 'fixed', bottom: 24, left: 24, zIndex: 2000, display: 'flex', alignItems: 'center', gap: 1,
              px: 1.75, py: 1, borderRadius: 999, cursor: 'pointer', bgcolor: '#FBFAF6', color: '#171C28',
              border: '1px solid #E7E3D8', boxShadow: '0 4px 16px rgba(0,0,0,.28)', fontWeight: 700, fontSize: 13,
              '&:hover': { bgcolor: '#fff' } }}>
            <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#EE7A08' }} />
            CreatorHub Design
          </Box>
        ),
        document.body,
      )}
      <Snackbar open={!!accepted} autoHideDuration={5000} onClose={() => setAccepted(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setAccepted(null)}>{accepted}</Alert>
      </Snackbar>

      {/* Prototype-tester: feedback-FAB også inne i workspace (ikke bare på
          dashboardet) — testere gir tilbakemelding der de faktisk jobber.
          currentTab={tab} tagger feedbacken med hvilken workspace-flate den
          gjelder. Gated på isPrototypeTester (samme som UniversalDashboard). */}
      {isPrototypeTester && (
        <UniversalPrototypeFeedback
          profession={user?.profession}
          dashboardType="workspace"
          component="workspace"
          currentTab={tab}
          userEmail={user?.email}
          floatingPosition={{ bottom: 96, right: 24, zIndex: 1200 }}
        />
      )}

      {/* Nytt prosjekt — ProjectCreationWithMemoryCards-wizarden */}
      <Dialog open={showCreate} onClose={() => setShowCreate(false)} fullWidth maxWidth="lg">
        <DialogContent dividers sx={{ p: 0 }}>
          {showCreate && (
            <ProjectCreationWithMemoryCards
              profession={(user?.profession as string) || undefined}
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
    </WsLocaleProvider>
  );
};

export default TeamWorkspacePage;
