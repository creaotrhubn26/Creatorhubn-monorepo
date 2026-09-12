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
    // Display-felt satt til en troverdig produksjons-identitet (demo/marketing).
    // Funksjonelle id-er/e-poster beholdt — ingen e2e-spec asserter på navn/labels.
    name: 'Siste servering',
    description: 'Nordlys Film · Kortfilm · Regi: Ingrid Solvang',
    status: 'casting',
    ownerId: 'e2e-test-user',
    ownerEmail: 'e2e@test.local',
    ownerLabel: 'Nordlys Film',
    createdBy: 'e2e-test-user',
    createdByEmail: 'e2e@test.local',
    createdByLabel: 'Nordlys Film',
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

function buildDirectorSeedProject(): CastingProject {
  const project = buildBasicSeedProject();
  return {
    ...project,
    roles: [
      { id: 'director-role-nora', projectId: project.id, name: 'NORA', status: 'filled', sceneIds: ['director-scene-1', 'director-scene-2'] },
      { id: 'director-role-elias', projectId: project.id, name: 'ELIAS', status: 'filled', sceneIds: ['director-scene-2'] },
    ],
    sceneBreakdowns: [
      {
        id: 'director-scene-1',
        manuscriptId: 'e2e-director-manuscript',
        projectId: project.id,
        sceneNumber: 1,
        sceneHeading: 'INT. FJELLSTUE - DAG',
        locationName: 'Fjellstue',
        intExt: 'INT',
        timeOfDay: 'DAY',
        description: 'Nora gjør rommet klart før gjestene kommer.',
        characters: ['NORA'],
        propsNeeded: ['Nøkkelknippe'],
        storyboardFrames: [{ id: 'director-frame-1', title: 'Etablering' }],
      },
      {
        id: 'director-scene-2',
        manuscriptId: 'e2e-director-manuscript',
        projectId: project.id,
        sceneNumber: 2,
        sceneHeading: 'EXT. SKOG - NATT',
        locationName: 'Skog',
        intExt: 'EXT',
        timeOfDay: 'NIGHT',
        description: 'Nora og Elias følger sporene inn i tåken.',
        characters: ['NORA', 'ELIAS'],
      },
    ],
    shotLists: [{
      id: 'director-shot-list-1',
      projectId: project.id,
      sceneId: 'director-scene-1',
      shots: [{
        id: 'director-shot-1',
        sceneId: 'director-scene-1',
        shotType: 'Wide',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Static',
        description: 'Etablering av fjellstuen',
        status: 'completed',
      }],
    }],
    productionDays: [{
      id: 'director-production-day-1',
      projectId: project.id,
      date: '2026-09-11',
      scenes: ['director-scene-1'],
      crew: [],
      props: [],
      callTime: '07:30',
      status: 'planned',
    }],
  } as CastingProject;
}

function buildCinematographerSeedProject(): CastingProject {
  const project = buildDirectorSeedProject();
  return {
    ...project,
    crew: [
      { id: 'cine-dop', name: 'Dana Foto', role: 'cinematographer', status: 'confirmed' },
      { id: 'cine-gaffer', name: 'Guro Lys', role: 'gaffer', status: 'invited' },
    ],
    shotLists: [{
      id: 'cine-shot-list-1',
      projectId: project.id,
      sceneId: 'director-scene-1',
      shots: [{
        id: 'cine-shot-1',
        sceneId: 'director-scene-1',
        shotType: 'Wide',
        cameraAngle: 'Eye Level',
        cameraMovement: 'Dolly In',
        description: 'Rolig innkjøring mot Nora ved vinduet',
        lensRecommendation: '35 mm',
        lightingSetup: 'Kaldt vinduslys med varm practical i bakgrunnen',
        status: 'not_started',
      }],
    }],
  } as CastingProject;
}

function buildFirstAssistantDirectorSeedProject(): CastingProject {
  const project = buildDirectorSeedProject();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = [
    tomorrow.getFullYear(),
    String(tomorrow.getMonth() + 1).padStart(2, '0'),
    String(tomorrow.getDate()).padStart(2, '0'),
  ].join('-');

  return {
    ...project,
    locations: [{ id: 'first-ad-location', name: 'Fjellstue' }],
    crew: [
      { id: 'first-ad-lead', name: 'Ada Innspilling', role: 'first_ad', status: 'confirmed' },
      { id: 'first-ad-pa', name: 'Pia Produksjon', role: 'production_assistant', status: 'invited' },
    ],
    productionDays: [{
      id: 'first-ad-production-day-1',
      projectId: project.id,
      date,
      scenes: ['director-scene-1'],
      locationId: 'first-ad-location',
      crew: ['first-ad-lead', 'first-ad-pa'],
      props: [],
      callTime: '07:30',
      status: 'planned',
    }],
    userRoles: [{
      id: 'first-ad-user-role',
      projectId: project.id,
      userId: 'e2e-test-user',
      role: 'first_ad',
    }],
  } as CastingProject;
}

function buildSecondAssistantDirectorTrollSeedProject(): CastingProject {
  const project = buildDirectorSeedProject();
  return {
    ...project,
    id: 'e2e-troll-production',
    name: 'Troll',
    description: 'Autentisert CI-prosjekt for 2nd AD og callsheet',
    roles: [{
      id: 'troll-role-nora',
      projectId: 'e2e-troll-production',
      name: 'NORA',
      status: 'filled',
      assignedCandidateId: 'troll-candidate-nora',
      sceneIds: ['troll-scene-1'],
    }],
    candidates: [{
      id: 'troll-candidate-nora',
      projectId: 'e2e-troll-production',
      name: 'Ada Skuespiller',
      status: 'selected',
      contactInfo: { email: 'ada@example.test', phone: '+47 900 00 001' },
      assignedRoles: ['troll-role-nora'],
    }],
    shotLists: [],
    sceneBreakdowns: [{
      id: 'troll-scene-1',
      manuscriptId: 'e2e-troll-manuscript',
      projectId: 'e2e-troll-production',
      sceneNumber: 1,
      sceneHeading: 'EXT. TROLLSKOG - DAG',
      locationName: 'Trollskogen',
      intExt: 'EXT',
      timeOfDay: 'DAY',
      description: 'Nora følger sporene gjennom skogen.',
      characters: ['troll-role-nora'],
    }],
    locations: [{
      id: 'troll-location-forest',
      projectId: 'e2e-troll-production',
      name: 'Trollskogen',
      address: 'Skogveien 1, Oslo',
      accessNotes: 'Basecamp ved sørporten',
    }],
    crew: [{
      id: 'troll-second-ad',
      projectId: 'e2e-troll-production',
      name: 'Siv Regiassistent',
      role: 'second_ad',
      department: 'Regi',
      status: 'confirmed',
      contactInfo: { email: 'siv@example.test' },
    }],
    productionDays: [{
      id: 'troll-production-day-1',
      projectId: 'e2e-troll-production',
      date: '2026-09-14',
      scenes: ['troll-scene-1'],
      locationId: 'troll-location-forest',
      crew: ['troll-second-ad'],
      props: [],
      callTime: '07:00',
      wrapTime: '18:00',
      status: 'planned',
      secondAd: {
        entries: [{
          id: 'cast:troll-candidate-nora',
          personType: 'cast',
          personId: 'troll-candidate-nora',
          name: 'Ada Skuespiller',
          roleName: 'NORA',
          pickupTime: '05:45',
          callTime: '06:15',
          makeupTime: '06:30',
          wardrobeTime: '06:45',
          onSetTime: '07:30',
          transport: 'Bil 2 · Ola',
          status: 'acknowledged',
        }],
      },
    }],
    userRoles: [{
      id: 'troll-second-ad-user-role',
      projectId: 'e2e-troll-production',
      userId: 'e2e-test-user',
      role: 'second_ad',
    }],
  } as unknown as CastingProject;
}

function buildProductionManagerTrollSeedProject(): CastingProject {
  const project = buildSecondAssistantDirectorTrollSeedProject();
  return {
    ...project,
    description: 'Autentisert CI-prosjekt for produksjonsledelse og dagskontroll',
    crew: [
      {
        id: 'troll-production-manager',
        projectId: project.id,
        name: 'Liv Produksjon',
        role: 'production_manager',
        department: 'production',
        status: 'confirmed',
        contactInfo: { email: 'liv@example.test' },
      },
      {
        id: 'troll-gaffer',
        projectId: project.id,
        name: 'Guro Lys',
        role: 'gaffer',
        department: 'lighting',
        status: 'confirmed',
        contactInfo: { email: 'guro@example.test' },
      },
    ],
    productionDays: (project.productionDays ?? []).map((day) => ({
      ...day,
      crew: ['troll-production-manager', 'troll-gaffer'],
      managementVersion: 0,
      productionManagement: {
        dayStatus: 'at_risk',
        callSheetApproval: 'ready_for_review',
        crewConfirmations: [
          { crewId: 'troll-production-manager', status: 'confirmed' },
          { crewId: 'troll-gaffer', status: 'pending' },
        ],
        checkpoints: [
          { id: 'troll-location-check', category: 'location', title: 'Trollskogen', status: 'ready' },
          { id: 'troll-transport-check', category: 'transport', title: 'Transport og parkering', status: 'blocked' },
        ],
        issues: [{ id: 'troll-issue-1', title: 'Manglende parkeringstillatelse', severity: 'high', status: 'open' }],
        costItems: [{ id: 'troll-cost-1', category: 'Transport', title: 'Ekstra minibuss', estimatedCost: 5000, actualCost: 6500, status: 'pending' }],
        notes: 'Avklar parkering før publisering.',
        activity: [],
      },
    })),
    userRoles: [{
      id: 'troll-production-manager-user-role',
      projectId: project.id,
      userId: 'e2e-test-user',
      role: 'production_manager',
    }],
  } as CastingProject;
}

/**
 * Wrapper that pre-seeds a mock auth session before rendering CastingPlannerPanel.
 * This prevents the "no adminUser → redirect to /casting.html" path that fires
 * when isStandalone=true and the backend is unavailable.
 *
 * Sprint A.7: Når URL inneholder ?seed=basic seedes ett minimalt demo-prosjekt
 * så `selectFirstProject` i e2e-specs har en `<li>` å klikke på. Varianten
 * ?seed=story-writer legger også inn ett tomt manuskript for tester av
 * manuskriptfanene. Holder hele test-harness uavhengig av backend.
 */
function SessionSeeder({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seedSession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const sessionMode = searchParams.get('session');
      const seedFlag = searchParams.get('seed');
      const isContentProducerSession = sessionMode === 'content-producer';
      const isCinematographerSession = sessionMode === 'cinematographer';
      const isFirstAssistantDirectorSession = sessionMode === 'first-ad';
      const isSecondAssistantDirectorSession = sessionMode === 'second-ad';
      const isProductionManagerSession = sessionMode === 'production-manager';

      // Pre-seed admin user so CastingPlannerPanel won't redirect when isStandalone=true
      await authSessionService.setAdminUser({
        id: 'e2e-test-user',
        email: 'e2e@test.local',
        role: isFirstAssistantDirectorSession
          ? 'first_ad'
          : isSecondAssistantDirectorSession
            ? 'second_ad'
          : isProductionManagerSession
            ? 'production_manager'
          : isCinematographerSession
            ? 'cinematographer'
            : 'admin',
        display_name: 'E2E Tester',
        loginAs: isContentProducerSession
          ? 'content_producer'
          : isCinematographerSession || isFirstAssistantDirectorSession || isSecondAssistantDirectorSession || isProductionManagerSession
            ? 'production_team'
            : undefined,
        requestedRole: isContentProducerSession
          ? 'content_producer'
          : isCinematographerSession
            ? 'cinematographer'
            : isFirstAssistantDirectorSession
              ? 'first_ad'
              : isSecondAssistantDirectorSession
                ? 'second_ad'
                : isProductionManagerSession
                  ? 'production_manager'
              : null,
      });
      // Lokal backend (NODE_ENV≠production) godtar dette dev-token-et som
      // «local-admin» (getLocalDevelopmentSession) → /api/casting-ruter passerer
      // og data synkes til DB i stedet for å latche offline. Uten dette: 401.
      // ?token=… overstyrer (sim-Safari-verifisering kan ikke kjøre
      // addInitScript — se e2e/storyboard-vision-verify.spec.ts).
      const overrideToken = new URLSearchParams(window.location.search).get('token');
      window.localStorage.setItem('role_room_auth_token', overrideToken || 'dev-admin-local-session');
      window.localStorage.setItem('creatorhub_auth_token', overrideToken || 'dev-admin-local-session');
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
        { photographer: true, producer: true, director: true, cinematographer: true, first_ad: true, second_ad: true, production_manager: true, general: true },
        { userId: 'e2e-test-user' },
      );

      // Sprint A.7: opt-in seed av et basic demo-prosjekt
      const workspaceStateNamespace = isContentProducerSession
        ? 'roleRoom_workspaceState_content_producer'
        : 'roleRoom_workspaceState_production_team';

      if (seedFlag === 'basic' || seedFlag === 'demo' || seedFlag === 'story-writer' || seedFlag === 'director' || seedFlag === 'cinematographer' || seedFlag === 'first-ad' || seedFlag === 'second-ad-troll' || seedFlag === 'production-manager-troll') {
        try {
          const seedProject = seedFlag === 'director'
            ? buildDirectorSeedProject()
            : seedFlag === 'cinematographer'
              ? buildCinematographerSeedProject()
              : seedFlag === 'first-ad'
                ? buildFirstAssistantDirectorSeedProject()
              : seedFlag === 'second-ad-troll'
                ? buildSecondAssistantDirectorTrollSeedProject()
              : seedFlag === 'production-manager-troll'
                ? buildProductionManagerTrollSeedProject()
              : buildBasicSeedProject();
          await castingService.saveProject(seedProject);

          // Pre-seed workspace-state så panelet auto-restorer prosjektet
          // som currentProject on mount.
          await settingsService.setSetting(
            workspaceStateNamespace,
            {
              projectId: seedProject.id,
              lastRealProjectId: seedProject.id,
              activeTab: 0,
              workspaceLens: seedFlag === 'second-ad-troll'
                ? 'assistant-direction'
                : seedFlag === 'production-manager-troll'
                  ? 'production-management'
                  : undefined,
              firstAssistantDirectorSurface: seedFlag === 'second-ad-troll' ? 'today' : undefined,
              storyArcView: 'main',
              updatedAt: new Date().toISOString(),
            },
            { userId: 'e2e-test-user' },
          );

          if (seedFlag === 'story-writer' || seedFlag === 'director' || seedFlag === 'cinematographer' || seedFlag === 'first-ad' || seedFlag === 'second-ad-troll') {
            const now = new Date().toISOString();
            const isDirectorSeed = seedFlag === 'director' || seedFlag === 'cinematographer' || seedFlag === 'first-ad' || seedFlag === 'second-ad-troll';
            await settingsService.setSetting(
              'virtualStudio_manuscripts',
              [{
                id: seedFlag === 'second-ad-troll' ? 'e2e-troll-manuscript' : isDirectorSeed ? 'e2e-director-manuscript' : 'e2e-story-writer-manuscript',
                projectId: seedProject.id,
                title: seedFlag === 'second-ad-troll' ? 'Troll' : isDirectorSeed ? 'Siste servering' : 'E2E Story Writer',
                subtitle: '',
                author: 'E2E Tester',
                version: '1.0',
                format: 'fountain',
                content: isDirectorSeed
                  ? 'INT. FJELLSTUE - DAG\n\nNORA gjør rommet klart.\n\nNORA\nAlt må være klart før de kommer.\n\nEXT. SKOG - NATT\n\nNORA og ELIAS følger sporene inn i tåken.'
                  : '',
                pageCount: 0,
                wordCount: 0,
                status: 'draft',
                createdAt: now,
                updatedAt: now,
              }],
              { userId: 'e2e-test-user', projectId: seedProject.id },
            );
          }
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
