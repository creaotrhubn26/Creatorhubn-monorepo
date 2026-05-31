/**
 * DanceWorkspace — top-level workspace for profession-mode = dance_*.
 *
 * Replaces the standard CastingPlannerPanel UI when a user is in dance
 * mode. Reads its tab configuration from `professionTabs.ts` so the
 * tab order, labels and feature-grouping are driven by the architecture
 * doc rather than hardcoded here.
 *
 * Tabs that map to a built component render the real component. Tabs
 * that map to a not-yet-built feature render an honest placeholder
 * card pointing at the architecture-doc reference, so users (and
 * Daniel) can see what's coming without us shipping fake screens.
 *
 * No film/photo flow imports from this file.
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Construction as ConstructionIcon } from '@mui/icons-material';
import useBrandingSettings from '../hooks/useBrandingSettings';
import {
  getActiveProfessionMode,
  isDanceMode,
  type ProfessionMode,
} from '../config/professionMode';
import {
  getTabsForProfession,
  type TabConfig,
} from '../config/professionTabs';
// F12: Code-split tunge tabs. FormationView (Three.js + Fabric.js +
// CurveOverlay) + VideoLibrary (wavesurfer + annotation-pipeline) +
// ChoreographyBuilder (count-grid + audio) + Production-Calendar +
// Analysis-panel utgjør hovedparten av bundle-størrelsen. Lazy-load
// disse, og pakk renderTabBody i en Suspense-fallback.
import { DanceDashboard } from './DanceDashboard';
import { RehearsalPlannerConnected } from './RehearsalPlannerConnected';
import { DancerProfileGridConnected } from './DancerProfileGridConnected';
import { DancerInjuryLogPanel } from './DancerInjuryLogPanel';

const DanceAnalysisPanel = React.lazy(() =>
  import('./DanceAnalysisPanel').then((m) => ({ default: m.DanceAnalysisPanel })),
);
const DanceProductionCalendar = React.lazy(() =>
  import('./DanceProductionCalendar').then((m) => ({ default: m.DanceProductionCalendar })),
);
const ChoreographyBuilderConnected = React.lazy(() =>
  import('./ChoreographyBuilderConnected').then((m) => ({ default: m.ChoreographyBuilderConnected })),
);
const FormationViewConnected = React.lazy(() =>
  import('./FormationViewConnected').then((m) => ({ default: m.FormationViewConnected })),
);
import DanceFlowShell from './DanceFlowShell';
import FormationHeaderBar, {
  type FormationSubTab,
  type FormationSaveStatus,
} from './FormationHeaderBar';
import ClipsSidebar from './ClipsSidebar';
import FormationVideoPanel from './FormationVideoPanel';
import DanceFlowNavRail from './DanceFlowNavRail';
import { useDanceCheatSheet } from './DanceCheatSheet';
import { isDanceReadOnlyRole } from './danceRoleUtils';
import { useAuth } from '../../../hooks/useAuth';
const VideoLibrary = React.lazy(() =>
  import('./VideoLibrary').then((m) => ({ default: m.VideoLibrary })),
);
import {
  ClassesPanel,
  InstructorsPanel,
  RoomsPanel,
  MovementVocabPanel,
} from './StudioOpsPanels';
import {
  PerformancesPanel,
  MusicArchivePanel,
  ReelPanel,
  GrantsPanel,
  InvoicesPanel,
  UnionPanel,
} from './AdminOpsPanels';
import {
  DancePricingPage,
  PlanAdminPanel,
  TesterAdminPanel,
  AdminSettingsPanel,
  TrialBanner,
} from './BillingPanels';
import { TeamAdminPanel } from './TeamAdminPanel';
import { MyTeamsHeader, useMyMemberships } from './MyTeamsHeader';
import { UpgradeToFreelanceDialog } from './UpgradeToFreelanceDialog';
import { AddonsPanel } from './AddonsPanel';
import { authSessionService } from '../services/authSessionService';
import CommandPalette from '../shared/CommandPalette';
import ProfessionModeChip from '../shared/ProfessionModeChip';
import HelpButton, { type WhatsNewItem } from '../shared/HelpButton';
import FirstTimeTour from '../shared/FirstTimeTour';
import {
  EmojiPeople as WelcomeIcon,
  Search as SearchTourIcon,
  HelpOutline as HelpTourIcon,
  SwapHoriz as ModeTourIcon,
} from '@mui/icons-material';



export interface DanceWorkspaceProps {
  /** Override mode (mostly for tests). Falls back to URL/storage. */
  modeOverride?: ProfessionMode;
  /** Aktivt CreatorHub-prosjekt (gir kalender + scoping). Valgfri i demo-flyt. */
  projectId?: string;
}

const FEATURE_LABEL: Record<NonNullable<TabConfig['feature']>, string> = {
  core: 'Kjerne',
  production: 'Drift',
  resources: 'Ressurser',
  on_set: 'Øving / scene',
  finance: 'Økonomi',
  union: 'Forbund / NAV',
};

const FEATURE_COLOR: Record<NonNullable<TabConfig['feature']>, string> = {
  core: '#8b5cf6',
  production: '#0ea5e9',
  resources: '#10b981',
  on_set: '#f59e0b',
  finance: '#ec4899',
  union: '#a855f7',
};

interface PlaceholderProps {
  title: string;
  body: string;
  feature?: TabConfig['feature'];
}

const ComingSoonCard: React.FC<PlaceholderProps> = ({ title, body, feature }) => (
  <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
    <Card sx={{ maxWidth: 720, mx: 'auto', bgcolor: '#111114', border: '1px solid rgba(139,92,246,0.25)', color: '#e5e7eb' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ConstructionIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>{title}</Typography>
            {feature ? (
              <Chip
                size="small"
                label={FEATURE_LABEL[feature]}
                sx={{
                  mt: 0.5,
                  bgcolor: `${FEATURE_COLOR[feature]}1f`,
                  color: FEATURE_COLOR[feature],
                  fontWeight: 600,
                  height: 22,
                }}
              />
            ) : null}
          </Box>
        </Stack>
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.78)', lineHeight: 1.6 }}>
          {body}
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'rgba(229,231,235,0.5)' }}>
          Planlagt i Fase 3 — bygges etter bruker-intervjuene per
          docs/role-room/dans/arkitektur-gjenbruk-2026-04-25.md.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

/**
 * FormationsTabBody — egen sub-komponent så vi får hooks-state for sub-tab,
 * save-status og breadcrumbs uten å forurense DanceWorkspace's hooks-rad.
 * Wrappes i DanceFlowShell m/ FormationHeaderBar (Phase 2).
 */
interface FormationsTabBodyProps {
  projectId: string | null;
}

const FormationsTabBody: React.FC<FormationsTabBodyProps> = ({ projectId }) => {
  // Audit H1: detect read-only-modus via session.role
  const auth = useAuth();
  const readOnly = isDanceReadOnlyRole(auth.user?.role);
  const [subTab, setSubTab] = React.useState<FormationSubTab>('formation');
  const [saveStatus, setSaveStatus] = React.useState<FormationSaveStatus>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // Audit A5: persistent sist-lagret-tid for header-pillen.
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  // Audit G_2: vet om vi har noen formasjoner — disable Export på tomt projekt.
  const [hasFormations, setHasFormations] = React.useState<boolean>(false);

  const handleSaveStatusChange = React.useCallback(
    (status: FormationSaveStatus, error: string | null, ts: number | null) => {
      setSaveStatus(status);
      setSaveError(error);
      if (ts != null) setLastSavedAt(ts);
    },
    [],
  );

  // G_2: lytt på FormationView's 'dance:formations-count'-event
  // (dispatched når formations.length endres).
  React.useEffect(() => {
    const onCount = (e: Event): void => {
      const detail = (e as CustomEvent<{ count?: number }>).detail;
      if (detail && typeof detail.count === 'number') {
        setHasFormations(detail.count > 0);
      }
    };
    window.addEventListener('dance:formations-count', onCount as EventListener);
    return () => window.removeEventListener('dance:formations-count', onCount as EventListener);
  }, []);

  // Audit I2: ?-keybind for cheat-sheet modal med alle keybinds + tips.
  const cheatSheet = useDanceCheatSheet();

  // Audit K2: lytt på 'dance:toast' og resirkuler eksisterende
  // share-snackbar for diskret feedback ('Forbi klipp-lengden' etc.)
  React.useEffect(() => {
    const onToast = (e: Event): void => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail && typeof detail.message === 'string') {
        setShareMessage(detail.message);
      }
    };
    window.addEventListener('dance:toast', onToast as EventListener);
    return () => window.removeEventListener('dance:toast', onToast as EventListener);
  }, []);

  // Phase 3 vil koble breadcrumbs til ekte prosjekt-navn fra context.
  const breadcrumbs = React.useMemo(
    () => [
      { label: 'Dans' },
      { label: 'Formasjoner', ariaLabel: 'Formasjoner — aktiv visning' },
    ],
    [],
  );

  // Workflow-audit G19: Share-knapp wired. Kopier nåværende URL til
  // clipboard + vis snackbar. Senere kan vi utvide til delbare lenker
  // med token-basert read-only-tilgang (audit-v2 H1).
  const handleShare = React.useCallback(async (): Promise<void> => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage('Lenke kopiert til utklippstavle');
    } catch {
      setShareMessage('Kunne ikke kopiere lenke');
    }
  }, []);
  const [shareMessage, setShareMessage] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!shareMessage) return;
    const t = setTimeout(() => setShareMessage(null), 2200);
    return () => clearTimeout(t);
  }, [shareMessage]);

  return (
    <DanceFlowShell
      header={
        <FormationHeaderBar
          breadcrumbs={breadcrumbs}
          activeSubTab={subTab}
          onSubTabChange={setSubTab}
          saveStatus={saveStatus}
          saveError={saveError}
          lastSavedAt={lastSavedAt}
          onShare={handleShare}
          disableExport={!hasFormations}
        />
      }
      clipsSidebar={<ClipsSidebar projectId={projectId} />}
    >
      {subTab === 'formation' ? (
        <Box sx={{ p: { xs: 1, md: 2 }, minHeight: '100%' }}>
          <FormationViewConnected
            projectId={projectId}
            hideSavePill
            onSaveStatusChange={handleSaveStatusChange}
            videoPanelSlot={<FormationVideoPanel />}
            readOnly={readOnly}
          />
        </Box>
      ) : (
        // Annotate er den eneste sub-tab'en uten forward — viser placeholder
        // inntil Phase 6 lager drawer. Dancers/Analysis/Review bytter top-level
        // tab via dance:set-tab og lander aldri her.
        <Box sx={{ p: { xs: 2, md: 3 }, color: '#9ca3af' }}>
          <Typography variant="body2">
            Annotate-drawer kommer i Phase 6 (frihånd-tegning over scenen +
            tekst-pins per posisjon).
          </Typography>
        </Box>
      )}
      {/* Audit I2: cheat-sheet modal — vises ved ? eller programmatisk */}
      {cheatSheet.CheatSheet}
      {/* Workflow-audit G19: share-feedback snackbar */}
      {shareMessage ? (
        <Box
          role="status"
          data-testid="dance-flow-share-snackbar"
          sx={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: '#1e2536',
            color: '#a78bfa',
            border: '1px solid #a78bfa',
            borderRadius: 1,
            px: 2,
            py: 1,
            fontSize: 12,
            fontWeight: 600,
            zIndex: 2000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {shareMessage}
        </Box>
      ) : null}
    </DanceFlowShell>
  );
};

const PLACEHOLDER_BODIES: Record<string, string> = {
  classes: 'Studio-elever og semester-registrering. Henter betalingsstatus fra Fiken/Tripletex og kobler mot KID-betaling.',
  instructors: 'Instruktør-roster med "timer levert per måned"-kolonne for selvstendige ENK-instruktører.',
  rooms: 'Sal-booking — speil-saler, ballett-saler, dansestudioer. Gjenbruker LocationManagementPanel under panseret.',
  performances: 'Forestillings-kalender + stripboard for rekkefølgen av stykker i en forestilling.',
  reel: 'Reel-portefølje for frilanser — Vimeo/YouTube-import, AI-tagging av bevegelseskvalitet, casting-eksport.',
  music: 'Musikk-arkiv med BPM-tagging og TONO-clearing-status. Varsler hvis et stykke har musikk som ikke er cleared før forestilling.',
  movement_vocab: 'Standardisert bevegelsesterminologi for koreografer. Lar instruktører referere konsistent.',
  injuries: 'Skadelogg for frilansere — genererer NAV-søknadsgrunnlag fra gigg-historikk + skadehendelser.',
  grants: 'Maler for Kulturrådet (Fri scenekunst — dans), Fond for lyd og bilde, kommunale midler. Gjenbruker prosjektbeskrivelsen.',
  billing: 'EHF-faktura for kommune-avtaler, KID-betaling for studio-elever, Fiken/Tripletex-koblinger.',
  union: 'Skuda/NoDa-medlemstatus, aktive tariffer, automatisk loggføring av arbeidsdager til Skuda-statistikk.',
};

const DANCE_WHATS_NEW: WhatsNewItem[] = [
  {
    date: '2026-05-29',
    kind: 'fix',
    title: 'Dance API-kall autentiserer nå riktig',
    description: 'Choreography, formations, ops, billing, teams, profiles og rehearsals sender Authorization-header — slutt på 401 i nettleser-konsollen.',
  },
  {
    date: '2026-05-29',
    kind: 'feature',
    title: '"Hva er nytt"-modal i dansestudio',
    description: 'Help-knappen nederst-høyre viser nå dansestudio-spesifikke oppdateringer i stedet for å sende deg til en generell news-side.',
  },
  {
    date: '2026-05-28',
    kind: 'improvement',
    title: '7 UX-forbedringer i Dance Workspace',
    description: 'Polish av navigasjon og tab-flyt på tvers av Classes/Instructors/Rooms/Performances.',
  },
  {
    date: '2026-05-26',
    kind: 'feature',
    title: 'F12 — code-splitting med React.lazy',
    description: 'Tunge dance-paneler lastes nå on-demand. Mobil-sweep (F11) gjør hele workspacet brukbart på telefon.',
  },
  {
    date: '2026-05-22',
    kind: 'feature',
    title: 'F10 — Classes/Instructors/Rooms stat-stripes',
    description: 'Hver kjernekategori har egne KPI-stripes øverst, slik at du ser status uten å bore ned.',
  },
  {
    date: '2026-05-20',
    kind: 'feature',
    title: 'F8 — Dance Production Calendar',
    description: '12 nye kalender-features for å planlegge forestillinger, prøver og turné.',
  },
  {
    date: '2026-05-18',
    kind: 'feature',
    title: 'F5-B — ekte 3D, bezier-curve-tool og wavesurfer.js',
    description: 'Ingen stubs igjen i Formation Builder. Bezier-formasjoner, ekte 3D-render, audio-waveform-cue.',
  },
  {
    date: '2026-05-12',
    kind: 'feature',
    title: 'Magic-link + PIN GDPR-flyt for team-invites',
    description: 'Login-redesign med 3 path-valg, custom-rolle-system og full invite-stack ende-til-ende.',
  },
  {
    date: '2026-05-08',
    kind: 'feature',
    title: 'Full Stripe billing + tester-invites',
    description: 'Abonnement, add-ons, trial-banner, customer-portal og admin-konfig på plass.',
  },
];

const DanceWorkspaceInner: React.FC<DanceWorkspaceProps> = ({ modeOverride, projectId }) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const mode = modeOverride ?? getActiveProfessionMode();
  const tabs = useMemo(() => getTabsForProfession(mode), [mode]);

  // Initial tab kommer fra ?tab=<id> hvis gyldig, ellers første tab.
  // Brukes useState-lazy-initializer slik at `tabs` leses ÉN gang ved
  // mount uten stale-closure-risiko (forrige useMemo med []-deps +
  // eslint-disable hadde subtilt bug-potensial).
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window === 'undefined') return tabs[0]?.id ?? 'dashboard';
    const fromUrl = new URLSearchParams(window.location.search).get('tab');
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) return fromUrl;
    return tabs[0]?.id ?? 'dashboard';
  });

  // Sync ?tab=<id> til URL ved bytte — uten å trigge full nav.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('tab') === activeTabId) return;
    url.searchParams.set('tab', activeTabId);
    window.history.replaceState({}, '', url.toString());
  }, [activeTabId]);

  // Cross-component navigation via CustomEvent.
  // Bruk: window.dispatchEvent(new CustomEvent('dance:set-tab', { detail: { tabId: 'season' } }))
  React.useEffect(() => {
    const onSetTab = (e: Event): void => {
      const detail = (e as CustomEvent<{ tabId?: string }>).detail;
      if (detail && typeof detail.tabId === 'string') {
        setActiveTabId(detail.tabId);
      }
    };
    window.addEventListener('dance:set-tab', onSetTab as EventListener);
    return () => window.removeEventListener('dance:set-tab', onSetTab as EventListener);
  }, []);

  // GA4 dataLayer event ved tab-bytte. Kun client-side.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
    if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
    w.dataLayer.push({
      event: 'dance_tab_view',
      tab_id: activeTabId,
      profession_mode: mode,
    });
  }, [activeTabId, mode]);

  // Audit D1: hold siste video-tid på window-prop så ⌘K's 'Opprett
  // formasjon ved nåværende tid' kan lese den uten å re-rendere
  // tre-nivåer-ned-komponenter. Stateløs ref-pattern.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as Window & { __dancePlayhead?: number };
    const onTime = (e: Event): void => {
      const detail = (e as CustomEvent<{ currentTime?: number }>).detail;
      if (detail && typeof detail.currentTime === 'number') {
        w.__dancePlayhead = detail.currentTime;
      }
    };
    window.addEventListener('dance:video-time', onTime as EventListener);
    return () => window.removeEventListener('dance:video-time', onTime as EventListener);
  }, []);

  // Multi-team membership + active-team-bytter (URL ?team=<orgId>)
  const { memberships, refresh: refreshMemberships } = useMyMemberships();
  const initialActiveTeam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('team');
  }, []);
  const [activeTeamOrgId, setActiveTeamOrgId] = useState<string | null>(initialActiveTeam);

  // Konverterings-dialog: vises ÉN gang for team-medlemmer (ikke eier)
  // som ikke har sett tilbudet ennå.
  const upgradeOfferTarget = useMemo(() => {
    return memberships.find(
      (m) => m.role && !m.role.isOwnerRole && m.upgradeOfferSeenAt === null && m.member.status === 'active',
    ) ?? null;
  }, [memberships]);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  React.useEffect(() => {
    if (upgradeOfferTarget) setUpgradeDialogOpen(true);
  }, [upgradeOfferTarget?.member.memberRowId]);

  if (!isDanceMode(mode) || tabs.length === 0) return null;

  // Capability-gating: admin-tabs (admin_plans / admin_testers / admin_settings)
  // er kun tilgjengelig for eier-roller. Andre tabs er åpne.
  const ownerMembership = memberships.find(
    (m) => m.role?.isOwnerRole === true && m.member.status === 'active',
  );
  const isOwner = !!ownerMembership;
  const ADMIN_ONLY_TABS = new Set(['admin_plans', 'admin_testers', 'admin_settings']);
  const allVisibleTabs = tabs.filter((t) => isOwner || !ADMIN_ONLY_TABS.has(t.id));

  // Brukervennlige kategorier — mapper RoleRooms interne 'feature'-kode
  // til norske gruppenavn brukeren forstår.
  type TabCategory = 'all' | 'core' | 'operations' | 'creative' | 'business';
  const TAB_CATEGORIES: Record<string, TabCategory> = {
    // Oversikt
    dashboard: 'core', pieces: 'core', formations: 'core',
    // Drift (resources + on_set)
    classes: 'operations', students: 'operations', instructors: 'operations',
    rooms: 'operations', team: 'operations', rehearsal_log: 'operations',
    video: 'operations', performances: 'operations', season: 'operations',
    // Kreativt (production)
    music: 'creative', movement_vocab: 'creative', analysis: 'creative',
    reel: 'creative', injuries: 'creative',
    // Forretning (finance + union)
    grants: 'business', billing: 'business', union: 'business',
    pricing: 'business', addons: 'business',
    admin_plans: 'business', admin_testers: 'business', admin_settings: 'business',
  };
  const CATEGORY_LABELS: Record<TabCategory, string> = {
    all: 'Alt',
    core: 'Oversikt',
    operations: 'Drift',
    creative: 'Kreativt',
    business: 'Forretning',
  };

  const [activeCategory, setActiveCategory] = React.useState<TabCategory>('all');
  const visibleTabs = activeCategory === 'all'
    ? allVisibleTabs
    : allVisibleTabs.filter((t) => TAB_CATEGORIES[t.id] === activeCategory);

  const activeTab = visibleTabs.find((t) => t.id === activeTabId) ?? visibleTabs[0];

  // Mobile swipe-gesture for tab-bytte. Krever ≥80px horisontal bevegelse
  // og <60px vertikal, slik at vi ikke kommer i veien for normal scroll.
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent): void => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dy) > 60) return;
    if (Math.abs(dx) < 80) return;
    const idx = visibleTabs.findIndex((tt) => tt.id === activeTab?.id);
    if (idx < 0) return;
    const nextIdx = dx < 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= visibleTabs.length) return;
    setActiveTabId(visibleTabs[nextIdx].id);
  };

  const renderTabBody = (tab: TabConfig): React.ReactElement => {
    switch (tab.id) {
      case 'dashboard':
        return <DanceDashboard modeOverride={mode} projectId={projectId ?? null} />;
      case 'pieces':
        return (
          <Box sx={{ p: { xs: 1, md: 2 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <ChoreographyBuilderConnected projectId={projectId ?? null} />
          </Box>
        );
      case 'formations':
        // Phase 2: FormationsTabBody owner shell+header+sub-tab-state.
        // FormationViewConnected wrappes m/ hideSavePill — headeren eier pillen.
        return <FormationsTabBody projectId={projectId ?? null} />;
      case 'rehearsal_log':
        return (
          <Box sx={{ p: { xs: 1, md: 2 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <RehearsalPlannerConnected projectId={projectId ?? null} />
          </Box>
        );
      case 'students':
        return (
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <DancerProfileGridConnected projectId={projectId ?? null} />
          </Box>
        );
      case 'season':
        return (
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <DanceProductionCalendar projectId={projectId ?? null} professionMode={mode} />
          </Box>
        );
      case 'injuries':
        return <DancerInjuryLogPanel projectId={projectId ?? null} />;
      case 'video': {
        const session = authSessionService.getSessionSync();
        const userId = session.currentUserId
          ?? (session.adminUser?.id != null ? String(session.adminUser.id) : 'default-user');
        return <VideoLibrary projectId={projectId ?? null} currentUserId={userId} />;
      }
      case 'classes':
        return <ClassesPanel projectId={projectId ?? null} />;
      case 'instructors':
        return <InstructorsPanel projectId={projectId ?? null} />;
      case 'rooms':
        return <RoomsPanel projectId={projectId ?? null} />;
      case 'movement_vocab':
        return <MovementVocabPanel projectId={projectId ?? null} />;
      case 'performances':
        return <PerformancesPanel projectId={projectId ?? null} />;
      case 'music':
        return <MusicArchivePanel projectId={projectId ?? null} />;
      case 'reel':
        return <ReelPanel projectId={projectId ?? null} />;
      case 'analysis':
        return <DanceAnalysisPanel projectId={projectId ?? null} />;
      case 'grants':
        return <GrantsPanel projectId={projectId ?? null} />;
      case 'billing':
        return <InvoicesPanel projectId={projectId ?? null} />;
      case 'union':
        return <UnionPanel projectId={projectId ?? null} />;
      case 'team':
        return <TeamAdminPanel />;
      case 'addons':
        return <AddonsPanel />;
      case 'pricing':
        return <DancePricingPage persona={mode === 'dance_studio' ? 'dance_studio' : mode === 'dance_freelance' ? 'dance_freelance' : 'both'} />;
      case 'admin_plans':
        return <PlanAdminPanel />;
      case 'admin_testers':
        return <TesterAdminPanel />;
      case 'admin_settings':
        return <AdminSettingsPanel />;
      default:
        return (
          <ComingSoonCard
            title={labels[tab.labelToken] ?? tab.id}
            body={PLACEHOLDER_BODIES[tab.id] ?? 'Dette panelet bygges i Fase 3 etter bruker-intervjuene.'}
            feature={tab.feature}
          />
        );
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#050505' }}>
      <Box sx={{ px: 1, py: 0.5 }}>
        <TrialBanner />
      </Box>
      {memberships.length > 0 ? (
        <Box sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'flex-end' }}>
          <MyTeamsHeader
            memberships={memberships}
            activeTeamOrgId={activeTeamOrgId ?? memberships[0]?.team.teamOrganizationId ?? null}
            onSwitchTeam={(orgId) => {
              setActiveTeamOrgId(orgId);
              const url = new URL(window.location.href);
              url.searchParams.set('team', orgId);
              window.history.replaceState(null, '', url.toString());
            }}
          />
        </Box>
      ) : null}
      {upgradeDialogOpen && upgradeOfferTarget ? (
        <UpgradeToFreelanceDialog
          membership={upgradeOfferTarget}
          onClose={() => {
            setUpgradeDialogOpen(false);
            void refreshMemberships();
          }}
        />
      ) : null}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'rgba(10,10,10,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(139,92,246,0.18)',
        }}
      >
        {/* Permanent mode-chip øverst — bruker vet alltid hvilken
            profession-modus de er i. Klikkbar for bytte. */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <ProfessionModeChip
              mode={mode}
              onSwitch={(newMode) => {
                const url = new URL(window.location.href);
                url.searchParams.set('mode', newMode);
                window.location.href = url.toString();
              }}
            />
            {/* Kategori-filter — reduserer 18 tabs til relevante grupper */}
            <Stack direction="row" spacing={0.5}>
              {(['all', 'core', 'operations', 'creative', 'business'] as TabCategory[]).map((cat) => (
                <Box
                  key={cat}
                  component="button"
                  onClick={() => setActiveCategory(cat)}
                  sx={{
                    px: 1.2,
                    py: 0.4,
                    border: 'none',
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    bgcolor: activeCategory === cat ? 'rgba(245, 184, 46, 0.15)' : 'transparent',
                    color: activeCategory === cat ? '#F5B82E' : 'rgba(229, 231, 235, 0.55)',
                    transition: 'all 0.15s ease',
                    '&:hover': { color: '#F5B82E', bgcolor: 'rgba(245, 184, 46, 0.08)' },
                  }}
                >
                  {CATEGORY_LABELS[cat]}
                </Box>
              ))}
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
            <Box component="kbd" sx={{ px: 0.5, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)' }}>⌘K</Box>
            {' '}for å søke
          </Typography>
        </Box>
        <Tabs
          value={activeTab.id}
          onChange={(_, value) => setActiveTabId(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            // Phase 3b: skjul horisontal Tabs på lg+; NavRail tar over.
            // Mobile/tablet beholder horisontal-Tabs siden rail tar for mye
            // plass på smal skjerm.
            display: { xs: 'flex', lg: 'none' },
            minHeight: 48,
            px: 1,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              color: 'rgba(229,231,235,0.62)',
              minHeight: 48,
              fontSize: '0.875rem',
            },
            '& .Mui-selected': { color: '#fff' },
            '& .MuiTabs-indicator': { bgcolor: '#8b5cf6', height: 3, borderRadius: 1.5 },
          }}
        >
          {visibleTabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={labels[tab.labelToken] ?? tab.id}
              data-testid={`dance-tab-${tab.id}`}
            />
          ))}
        </Tabs>
      </Box>
      {/* Phase 3b: NavRail på lg+ ved siden av tabpanel. Under lg er rail
          skjult (display none via sx-breakpoint i komponenten — wrapping
          Box må derfor være row uansett, ellers brytes flex-flow). */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            display: { xs: 'none', lg: 'block' },
            flex: '0 0 auto',
          }}
        >
          <DanceFlowNavRail
            items={visibleTabs.map((t) => ({
              id: t.id,
              label: labels[t.labelToken] ?? t.id,
              feature: t.feature,
            }))}
            activeId={activeTab.id}
            onSelect={setActiveTabId}
          />
        </Box>
        <Box
          role="tabpanel"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          sx={{ flex: 1, minHeight: 0, minWidth: 0 }}
        >
          <React.Suspense
            fallback={
              <Box
                data-testid="dance-tab-loading"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 6,
                  color: '#a78bfa',
                  fontSize: 12,
                  letterSpacing: 1.5,
                  fontWeight: 700,
                }}
              >
                LASTER…
              </Box>
            }
          >
            {renderTabBody(activeTab)}
          </React.Suspense>
        </Box>
      </Box>

      {/* Cmd+K command palette — søk og hopp mellom 18 paneler */}
      <CommandPalette
        commands={[
          ...visibleTabs.map((t) => {
            const tabLabel = labels[t.labelToken] ?? t.id;
            return {
              id: `tab-${t.id}`,
              label: tabLabel,
              description: t.descriptionToken ? labels[t.descriptionToken] : undefined,
              category: 'Hopp til' as const,
              keywords: [t.id, tabLabel.toLowerCase()],
              onSelect: () => setActiveTabId(t.id),
            };
          }),
          // Audit D1: formation-actions tilgjengelig fra ⌘K palette.
          // Dispatch CustomEvents — FormationView/Timeline lytter.
          {
            id: 'formation-create-at-now',
            label: 'Opprett formasjon ved nåværende tid',
            description: 'Bruker video-playhead som start-tid',
            category: 'Kreativt' as const,
            keywords: ['ny', 'opprett', 'create', 'formasjon'],
            onSelect: () => {
              setActiveTabId('formations');
              // Dispatchen leses av FormationView's create-listener.
              // Bruker 0 hvis ingen video — bedre enn å gjøre ingenting.
              const vTime = (window as Window & { __dancePlayhead?: number }).__dancePlayhead ?? 0;
              window.dispatchEvent(
                new CustomEvent('dance:create-formation-at', { detail: { timeSec: vTime } }),
              );
            },
          },
          {
            id: 'formation-export-pdf',
            label: 'Eksporter stage plot (PDF)',
            description: 'Print eller lagre som PDF',
            category: 'Handling' as const,
            keywords: ['pdf', 'print', 'stage', 'plot', 'export'],
            onSelect: () => {
              setActiveTabId('formations');
              window.dispatchEvent(
                new CustomEvent('dance:export-formation', { detail: { format: 'pdf' } }),
              );
            },
          },
          {
            id: 'formation-export-png',
            label: 'Eksporter scene som PNG',
            description: 'Snapshot av nåværende formasjon',
            category: 'Handling' as const,
            keywords: ['png', 'bilde', 'snapshot', 'export'],
            onSelect: () => {
              setActiveTabId('formations');
              window.dispatchEvent(
                new CustomEvent('dance:export-formation', { detail: { format: 'png' } }),
              );
            },
          },
          {
            id: 'formation-export-backup',
            label: 'Eksporter backup-fil (JSON)',
            description: 'For re-import / deling',
            category: 'Handling' as const,
            keywords: ['json', 'backup', 'export'],
            onSelect: () => {
              setActiveTabId('formations');
              window.dispatchEvent(
                new CustomEvent('dance:export-formation', { detail: { format: 'json' } }),
              );
            },
          },
        ]}
      />

      {/* Persistent help-knapp nederst-høyre.
          `mode="dance"` henter publiserte oppføringer fra Admin Room → CMS.
          DANCE_WHATS_NEW brukes som fallback hvis backend er nede / tom. */}
      <HelpButton
        supportEmail="support@theroleroom.com"
        whatsNewTitle="Hva er nytt i Dance Studio"
        mode="dance"
        whatsNew={DANCE_WHATS_NEW}
      />

      {/* Første-gang-tour — vises kun ved første besøk per bruker */}
      <FirstTimeTour
        tourId="dance-workspace-v1"
        steps={[
          {
            title: 'Velkommen til Dance Studio',
            body: 'Her finner du klasser, instruktører, rom, koreografi og fakturering — alt samlet ett sted. Vi tar deg gjennom 3 ting du bør vite først.',
            icon: <WelcomeIcon />,
          },
          {
            title: 'Søk overalt med Cmd+K',
            body: 'Trykk ⌘K (eller Ctrl+K) for å hoppe direkte til hvilket som helst panel. Klasser, Koreografi, Faktura — alt er ett tastetrykk unna.',
            icon: <SearchTourIcon />,
          },
          {
            title: 'Du er i Studio-modus',
            body: 'Chipen øverst viser nåværende modus. Klikk på den for å bytte til Frilans-modus hvis du heller er solo-danser. Funksjoner tilpasses automatisk.',
            icon: <ModeTourIcon />,
          },
          {
            title: 'Hjelp er alltid synlig',
            body: 'Spørsmål? "?"-knappen nede i høyre hjørne har snarveier, support-kontakt og tastatursnarveier. Trykk ? når som helst for å åpne den.',
            icon: <HelpTourIcon />,
          },
        ]}
      />
    </Box>
  );
};

export const DanceWorkspace = React.memo(DanceWorkspaceInner);
DanceWorkspace.displayName = 'DanceWorkspace';

export default DanceWorkspace;
