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
 * Wrapper that pre-seeds a mock auth session before rendering CastingPlannerPanel.
 * This prevents the "no adminUser → redirect to /casting.html" path that fires
 * when isStandalone=true and the backend is unavailable.
 */
function SessionSeeder({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const seedSession = async () => {
      // Pre-seed admin user so CastingPlannerPanel won't redirect when isStandalone=true
      await authSessionService.setAdminUser({
        id: 'e2e-test-user',
        email: 'e2e@test.local',
        role: 'admin',
        display_name: 'E2E Tester',
      });
      // Pre-seed profession so the profession selector dialog doesn't open
      await settingsService.setSetting('virtualStudio_castingProfession', 'photographer', {
        userId: 'e2e-test-user',
      });
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
