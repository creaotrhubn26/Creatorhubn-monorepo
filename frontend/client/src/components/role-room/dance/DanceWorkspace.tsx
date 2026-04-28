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
import { DanceDashboard } from './DanceDashboard';
import { ChoreographyBuilderConnected } from './ChoreographyBuilderConnected';
import { RehearsalPlannerConnected } from './RehearsalPlannerConnected';
import { DancerProfileGridConnected } from './DancerProfileGridConnected';
import { DanceProjectCalendar } from './DanceProjectCalendar';
import { DancerInjuryLogPanel } from './DancerInjuryLogPanel';
import { FormationViewConnected } from './FormationViewConnected';
import { VideoLibrary } from './VideoLibrary';
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
import { authSessionService } from '../services/authSessionService';

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

const DanceWorkspaceInner: React.FC<DanceWorkspaceProps> = ({ modeOverride, projectId }) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;
  const mode = modeOverride ?? getActiveProfessionMode();
  const tabs = useMemo(() => getTabsForProfession(mode), [mode]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0]?.id ?? 'dashboard');

  if (!isDanceMode(mode) || tabs.length === 0) return null;

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const renderTabBody = (tab: TabConfig): React.ReactElement => {
    switch (tab.id) {
      case 'dashboard':
        return <DanceDashboard modeOverride={mode} />;
      case 'pieces':
        return (
          <Box sx={{ p: { xs: 1, md: 2 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <ChoreographyBuilderConnected projectId={projectId ?? null} />
          </Box>
        );
      case 'formations':
        return (
          <Box sx={{ p: { xs: 1, md: 2 }, bgcolor: '#0a0a0a', minHeight: '100%' }}>
            <FormationViewConnected projectId={projectId ?? null} />
          </Box>
        );
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
            <DanceProjectCalendar projectId={projectId ?? null} professionMode={mode} />
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
      case 'grants':
        return <GrantsPanel projectId={projectId ?? null} />;
      case 'billing':
        return <InvoicesPanel projectId={projectId ?? null} />;
      case 'union':
        return <UnionPanel projectId={projectId ?? null} />;
      case 'team':
        return <TeamAdminPanel />;
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
        <Tabs
          value={activeTab.id}
          onChange={(_, value) => setActiveTabId(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
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
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              value={tab.id}
              label={labels[tab.labelToken] ?? tab.id}
            />
          ))}
        </Tabs>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{renderTabBody(activeTab)}</Box>
    </Box>
  );
};

export const DanceWorkspace = React.memo(DanceWorkspaceInner);
DanceWorkspace.displayName = 'DanceWorkspace';

export default DanceWorkspace;
