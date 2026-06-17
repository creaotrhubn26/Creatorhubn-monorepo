/**
 * Client Workspace Shell — den enklere klient-flaten Daniel ba om.
 *
 * Producer-shellet (RoleRoomDashboardPanel) viser hele content-production
 * pipelinen (Brief→Story→Storyboard→Klient→Levering→Økonomi + sub-tabs). Det
 * er rikt og riktig for innholdsprodusenten, men overveldende for klienten.
 *
 * Denne flaten viser KUN de 5 tabs `client_reviewer`-rollen har i
 * useRoleNavConfig: Økonomi, Godkjenning, Brief, Roller, Plan. Hver tab
 * gjenbruker en eksisterende komponent — data er allerede synkronisert
 * mellom de to flatene fordi begge leser samme API.
 *
 * Rute: /client/workspace/:projectId — kan også brukes av produsent via
 * ?preview=true (vises da med banner "Du ser dette som klient").
 */

import { lazy, Suspense, useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Paid as EconomyIcon,
  FactCheck as ApprovalIcon,
  Assignment as BriefIcon,
  People as RolesIcon,
  CalendarMonth as PlanIcon,
  RocketLaunch as MarketingPlanIcon,
  Palette as MerkevareIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';

// Lazy-load tab-panelene så bundle-en ikke vokser unødvendig.
const ClientEconomyPanel = lazy(() => import('../producer/ClientEconomyPanel'));
const ClientApprovalView = lazy(() => import('./ClientApprovalView'));
const ClientBriefView = lazy(() => import('./ClientBriefView'));
const ClientRolesView = lazy(() => import('./ClientRolesView'));
const ClientPlanView = lazy(() => import('./ClientPlanView'));
const ClientMarketingPlanView = lazy(() => import('./ClientMarketingPlanView'));
const ClientMerkevareView = lazy(() => import('./ClientMerkevareView'));

type TabValue = 'economy' | 'approval' | 'brief' | 'merkevare' | 'roles' | 'plan' | 'marketing-plan';

const TABS: Array<{ value: TabValue; label: string; icon: React.ReactElement }> = [
  { value: 'economy', label: 'Økonomi', icon: <EconomyIcon /> },
  { value: 'approval', label: 'Godkjenning', icon: <ApprovalIcon /> },
  { value: 'brief', label: 'Brief', icon: <BriefIcon /> },
  { value: 'merkevare', label: 'Merkevare', icon: <MerkevareIcon /> },
  { value: 'roles', label: 'Roller', icon: <RolesIcon /> },
  { value: 'plan', label: 'Plan', icon: <PlanIcon /> },
  { value: 'marketing-plan', label: 'Markedsplan', icon: <MarketingPlanIcon /> },
];

function getInitialTab(): TabValue {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabValue | null;
  return TABS.some((t) => t.value === tab) ? (tab as TabValue) : 'economy';
}

export default function ClientWorkspaceShell({
  projectId: projectIdProp,
}: { projectId?: string } = {}) {
  // Wouter-rute (App.tsx) passer projectId via useParams. casting-main.tsx
  // (theroleroom.com sin path-parser-shell) sender den som prop. Begge støttes.
  const params = useParams<{ projectId: string }>();
  const projectId = projectIdProp ?? params.projectId ?? '';
  const [, setLocation] = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState<TabValue>(getInitialTab);

  // ?preview=true → produsent ser sin egen klient-flate
  const isPreviewMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('preview') === 'true';
  }, []);

  const handleTabChange = (_e: React.SyntheticEvent, next: TabValue) => {
    setActiveTab(next);
    // Behold tab i URL så reload + deep-link funker
    const url = new URL(window.location.href);
    url.searchParams.set('tab', next);
    window.history.replaceState({}, '', url.toString());
  };

  if (!projectId) {
    return (
      <Container maxWidth="md" sx={{ pt: 6 }}>
        <Alert severity="error">Mangler prosjekt-ID i URL. Sjekk lenken du fikk fra innholdsprodusenten.</Alert>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'rgba(7,13,26,0.96)',
        background:
          'radial-gradient(circle at top left, rgba(34,211,238,0.10) 0%, transparent 40%), radial-gradient(circle at bottom right, rgba(168,85,247,0.10) 0%, transparent 35%), #07101e',
        color: '#e2e8f0',
      }}
    >
      {/* Preview-banner — produsent som ser klient-flate */}
      {isPreviewMode && (
        <Alert
          severity="info"
          icon={<ArrowBackIcon />}
          action={
            <Typography
              component="a"
              onClick={(e) => { e.preventDefault(); setLocation('/'); }}
              sx={{ cursor: 'pointer', textDecoration: 'underline', color: 'inherit' }}
            >
              Tilbake til produsent-flaten
            </Typography>
          }
          sx={{ borderRadius: 0 }}
        >
          Du ser dette som klient (forhåndsvisning). Klienten ser de samme tallene + kan ikke endre kampanjer.
        </Alert>
      )}

      {/* Header — logo + prosjekt + bruker-avatar */}
      <Box
        sx={{
          borderBottom: '1px solid rgba(148,163,184,0.16)',
          bgcolor: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box
              component="img"
              src="/theroleroom-app-icon-1024.png"
              alt="The Role Room"
              sx={{ width: 36, height: 36, borderRadius: 1.5 }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#e2e8f0' }} noWrap>
                The Role Room
              </Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'rgba(226,232,240,0.6)' }} noWrap>
                Klient-flate · {projectId}
              </Typography>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Tab-navigasjon — sticky under header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid rgba(148,163,184,0.16)',
          bgcolor: 'rgba(15,23,42,0.92)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            variant={isMobile ? 'scrollable' : 'standard'}
            scrollButtons="auto"
            allowScrollButtonsMobile
            textColor="inherit"
            indicatorColor="primary"
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(226,232,240,0.66)',
                fontWeight: 700,
                fontSize: '0.85rem',
                minHeight: 56,
                textTransform: 'none',
              },
              '& .MuiTab-root.Mui-selected': { color: '#22d3ee' },
              '& .MuiTabs-indicator': { backgroundColor: '#22d3ee', height: 3 },
            }}
          >
            {TABS.map((t) => (
              <Tab key={t.value} value={t.value} label={t.label} icon={t.icon} iconPosition="start" />
            ))}
          </Tabs>
        </Container>
      </Box>

      {/* Tab-innhold */}
      <Container maxWidth="lg" sx={{ py: { xs: 1.5, sm: 2.5 } }}>
        <Suspense
          fallback={
            <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={28} sx={{ color: '#22d3ee' }} />
            </Stack>
          }
        >
          {activeTab === 'economy' && (
            <ClientEconomyPanel projectId={projectId} userRole="client_reviewer" />
          )}
          {activeTab === 'approval' && <ClientApprovalView projectId={projectId} />}
          {activeTab === 'brief' && <ClientBriefView projectId={projectId} />}
          {activeTab === 'merkevare' && <ClientMerkevareView projectId={projectId} />}
          {activeTab === 'roles' && <ClientRolesView projectId={projectId} />}
          {activeTab === 'plan' && <ClientPlanView projectId={projectId} />}
          {activeTab === 'marketing-plan' && <ClientMarketingPlanView projectId={projectId} />}
        </Suspense>
      </Container>
    </Box>
  );
}
