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
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RoleRoomDashboardPanel from './components/role-room/RoleRoomDashboardPanel';
import { ToastProvider } from './components/role-room/components/ToastStack';
import { AuthProvider } from './contexts/AuthContext';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';

const theme = createTheme({
  palette: { mode: 'dark' },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function TestHarness() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <ToastProvider>
            <EnhancedMasterIntegrationProvider>
              <div style={{ padding: 16 }}>
                <RoleRoomDashboardPanel userId="e2e-test-user" profession="photographer" />
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
