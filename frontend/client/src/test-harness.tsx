/**
 * Minimal test harness for E2E testing the Role Room panel
 * in isolation, without loading the full App.tsx (which has
 * pre-existing syntax errors in unrelated components).
 *
 * Providers som må være rundt RoleRoomDashboardPanel:
 *   - QueryClient (react-query)
 *   - ThemeProvider (MUI)
 *   - AuthProvider (useAuth)
 *   - ToastProvider (useToast i flere children)
 *   - EnhancedMasterIntegrationProvider (useEnhancedMasterIntegration)
 *
 * URL-flagg (kun for e2e):
 *   ?harness=dance_studio        Mounter DanceWorkspace direkte med en seedet
 *                                projectId, slik at spec slipper å drive
 *                                project-creation-modalen. Brukes av dance-*-
 *                                specs. I produksjon lastes dance bare etter at
 *                                project-creation-modalen har valgt et prosjekt.
 *   ?harness=game_studio         Mounter NarrativeWorkspace (Story Graph) med
 *                                seedet projectId. Brukes av narrative-*-specs.
 *   ?harness=content_producer    Mounter RoleRoomDashboardPanel som
 *                                innholdsprodusent (Creative Space Sync /
 *                                klient-brief, producer-timeline, osv.).
 *   ?harness-project=<id>        Override projectId (default: proj-spring-2026)
 *   ?harness=game_invite         Mounter GameInviteLandingPage (/game/invite/:token) med
 *                                ?harness-token=<token>
 *   ?harness=story_play          Mounter StoryPlayView (offentlig /story/:token) med
 *                                ?harness-token=<token> (default sgs_e2e_public)
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoleRoomDashboardPanel from './components/role-room/RoleRoomDashboardPanel';
import { ToastProvider } from './components/role-room/components/ToastStack';
import { AuthProvider } from './contexts/AuthContext';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import { DanceWorkspace } from './components/role-room/dance';
import { NarrativeWorkspace } from './components/role-room/narrative';
import { StoryPlayView } from './pages/story-play';
import { StoryReviewView } from './pages/story-review';
import { GameInviteLandingPage } from './components/role-room/game/GameInviteLandingPage';

const theme = createTheme({
  palette: { mode: 'dark' },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function readUrlFlag(name: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function TestHarness() {
  const harnessMode = readUrlFlag('harness');
  const seededProjectId = readUrlFlag('harness-project') ?? 'proj-spring-2026';

  let panel: React.ReactNode;
  if (harnessMode === 'dance_studio' || harnessMode === 'dance_freelance') {
    panel = (
      <DanceWorkspace
        modeOverride={harnessMode}
        projectId={seededProjectId}
      />
    );
  } else if (harnessMode === 'game_studio') {
    // Story Graph (spillstudio) — mounter NarrativeWorkspace direkte med
    // seedet projectId, som dans. Brukes av narrative-*-specs.
    panel = (
      <NarrativeWorkspace
        modeOverride="game_studio"
        projectId={seededProjectId}
      />
    );
  } else if (harnessMode === 'story_play') {
    // Offentlig spill-side (/story/:token) uten wouter/App-bootstrap.
    panel = <StoryPlayView token={readUrlFlag('harness-token') ?? 'sgs_e2e_public'} locale={readUrlFlag('harness-locale')} embed={readUrlFlag('harness-embed') === '1'} />;
  } else if (harnessMode === 'story_review') {
    // Gjeste-review av scene (/story-review/:token) uten wouter/App-bootstrap.
    panel = <StoryReviewView token={readUrlFlag('harness-token') ?? 'nrl_e2e_approve'} />;
  } else if (harnessMode === 'game_invite') {
    // Spillstudio team-invite landing (/game/invite/:token) uten wouter/App-bootstrap.
    panel = <GameInviteLandingPage token={readUrlFlag('harness-token') ?? 'gti_ok'} />;
  } else if (harnessMode === 'content_producer') {
    panel = (
      <RoleRoomDashboardPanel userId="e2e-test-user" profession="content_producer" />
    );
  } else {
    panel = (
      <RoleRoomDashboardPanel userId="e2e-test-user" profession="photographer" />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
            <EnhancedMasterIntegrationProvider>
              <div data-testid="e2e-harness-root" style={{ padding: 16 }}>
                {panel}
              </div>
            </EnhancedMasterIntegrationProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TestHarness />
  </React.StrictMode>
);
