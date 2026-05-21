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
 *   ?harness=content_producer    Mounter RoleRoomDashboardPanel som
 *                                innholdsprodusent (Creative Space Sync /
 *                                klient-brief, producer-timeline, osv.).
 *   ?harness-project=<id>        Override projectId (default: proj-spring-2026)
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
