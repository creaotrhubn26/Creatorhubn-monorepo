/**
 * Test harness for E2E testing the CastingPlannerPanel (full 11-tab view)
 * including Story Arc Studio, StoryLogicPanel, ManuscriptPanel, etc.
 * Wraps with all required providers from the main app chain.
 *
 * Pre-seeds an auth session so CastingPlannerPanel does not redirect
 * when running without a backend.
 */
import React, { Component, type ErrorInfo, type ReactNode, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CastingPlannerPanel } from './components/role-room/components/CastingPlannerPanel';
import { ToastProvider } from './components/role-room/components/ToastStack';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import { AuthProvider } from './contexts/AuthContext';
import { authSessionService } from './components/role-room/services/authSessionService';
import { settingsService } from './components/role-room/services/settingsService';
import { castingService } from './components/role-room/services/castingService';
import type { CastingProject } from './components/role-room/models/casting';

// Sprint A.7: Lås `getCurrentUserId()` MED EN GANG (før React-tre mounter)
// så all settings/casting-IO bruker samme nøkkel som vår pre-seed.
// settingsService.getCurrentUserId leser fra window.__currentUserId.
if (typeof window !== 'undefined') {
  (window as Window & { __currentUserId?: string }).__currentUserId = 'e2e-test-user';

  // Sprint A.7: La e2e-tester velge protected-demo-prosjekter (Northwind,
  // TROLL) som aktivt prosjekt uten å først lage kopi. Patcher metoden
  // som styrer "Lag kopi vs Åpne"-knappen i project-modal.
  (castingService as unknown as { canCurrentSessionMutateProtectedDemo: () => boolean })
    .canCurrentSessionMutateProtectedDemo = () => true;

  // Sprint A.7: La e2e-tester også mutere protected-demo-data (shotlists, frames).
  // `assertDemoProjectCanMutate` sjekker `isProtectedDemoSeedWriteActive` som
  // respekterer dette flagget.
  (window as Window & { __roleRoomE2eBypassProtectedDemo?: boolean })
    .__roleRoomE2eBypassProtectedDemo = true;
}

const theme = createTheme({
  palette: { mode: 'dark' },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

class TestErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TestHarness ErrorBoundary]', error.message, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div id="error-boundary-hit" style={{ color: 'red', padding: 20 }}>
          <h2>Test Harness Error</h2>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Bygger et minimalt valid demo-prosjekt som låser opp e2e-tester som
 * trenger `selectFirstProject` (Sprint A.7). Holder shapen minimal — bare
 * det `CastingPlannerPanel` MUST har for å rendre uten å krasje.
 */
function buildBasicSeedProject(): CastingProject {
  const now = new Date().toISOString();
  return {
    id: 'e2e-seed-project-basic',
    name: 'E2E Basic Test Project',
    description: 'Seeded by test-harness-casting.tsx for e2e-tester.',
    status: 'casting',
    ownerId: 'e2e-test-user',
    ownerEmail: 'e2e@test.local',
    ownerLabel: 'E2E Tester',
    createdBy: 'e2e-test-user',
    createdByEmail: 'e2e@test.local',
    createdByLabel: 'E2E Tester',
    createdAt: now,
    updatedAt: now,
    // Minimale, tomme arrays — ingen seed-data nødvendig
    roles: [],
    candidates: [],
    schedules: [],
    crew: [],
    locations: [],
    props: [],
    shotLists: [],
  } as unknown as CastingProject;
}

/**
 * Wrapper that pre-seeds a mock auth session before rendering CastingPlannerPanel.
 * This prevents the "no adminUser → redirect to /casting.html" path that fires
 * when isStandalone=true and the backend is unavailable.
 *
 * Sprint A.7: Når URL inneholder ?seed=basic seedes ett minimalt demo-prosjekt
 * så `selectFirstProject` i e2e-specs har en `<li>` å klikke på. Holder hele
 * test-harness uavhengig av backend.
 */
function SessionSeeder({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seedSession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const sessionMode = searchParams.get('session');
      const seedFlag = searchParams.get('seed');
      const isContentProducerSession = sessionMode === 'content-producer';

      // Pre-seed admin user so CastingPlannerPanel won't redirect when isStandalone=true
      await authSessionService.setAdminUser({
        id: 'e2e-test-user',
        email: 'e2e@test.local',
        role: 'admin',
        display_name: 'E2E Tester',
        loginAs: isContentProducerSession ? 'content_producer' : undefined,
        requestedRole: isContentProducerSession ? 'content_producer' : null,
      });
      // Pre-seed profession so the profession selector dialog doesn't open
      await settingsService.setSetting('virtualStudio_castingProfession', 'photographer', {
        userId: 'e2e-test-user',
      });
      // Sprint A.7: pre-seed onboarding-completed for alle aktuelle professions
      // så ProfessionOnboardingDialog ikke åpner og blokkerer pointer-events.
      // getOnboardingProfession() returnerer 'producer' i content-producer-mode,
      // 'photographer' ellers — vi setter begge for å være trygge.
      await settingsService.setSetting(
        'roleRoom_onboardingCompleted',
        { photographer: true, producer: true, director: true, general: true },
        { userId: 'e2e-test-user' },
      );

      // Sprint A.7: opt-in seed av et basic demo-prosjekt
      const workspaceStateNamespace = isContentProducerSession
        ? 'roleRoom_workspaceState_content_producer'
        : 'roleRoom_workspaceState_production_team';

      if (seedFlag === 'basic' || seedFlag === 'demo') {
        try {
          const seedProject = buildBasicSeedProject();
          await castingService.saveProject(seedProject);

          // Pre-seed workspace-state så panelet auto-restorer prosjektet
          // som currentProject on mount.
          await settingsService.setSetting(
            workspaceStateNamespace,
            {
              projectId: seedProject.id,
              lastRealProjectId: seedProject.id,
              activeTab: 0,
              storyArcView: 'main',
              updatedAt: new Date().toISOString(),
            },
            { userId: 'e2e-test-user' },
          );
        } catch (err) {
          console.warn('[test-harness] Failed to seed basic project:', err);
        }
      } else if (seedFlag === 'producer-demo') {
        // Sprint A.7: Producer-demo seeder full Northwind-data via samme
        // produksjonsbane som NewProjectCreationModal. Gir e2e-tester den
        // konkrete `cp-shotlist-2`/`cp-shot-2A`-strukturen og scene-data
        // de assertes mot.
        try {
          await castingService.initializeContentProducerDemoData();
          await settingsService.setSetting(
            workspaceStateNamespace,
            {
              projectId: 'content-producer-demo-2026',
              lastRealProjectId: 'content-producer-demo-2026',
              activeTab: 0,
              storyArcView: 'main',
              updatedAt: new Date().toISOString(),
            },
            { userId: 'e2e-test-user' },
          );
        } catch (err) {
          console.warn('[test-harness] Failed to seed producer-demo project:', err);
        }
      }

      setReady(true);
    };
    seedSession();
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}

function CastingTestHarness() {
  return (
    <TestErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ToastProvider>
            <AuthProvider>
              <EnhancedMasterIntegrationProvider>
                <SessionSeeder>
                  <div style={{ width: '100vw', height: '100vh' }}>
                    <CastingPlannerPanel isStandalone />
                  </div>
                </SessionSeeder>
              </EnhancedMasterIntegrationProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </TestErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CastingTestHarness />
  </React.StrictMode>
);
