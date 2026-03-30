import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';
import { creatorHubTheme } from './theme/creatorHubTheme';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { UniversalSessionProvider } from './contexts/UniversalSessionContext';
import { ClientSessionProvider } from './contexts/ClientSessionContext';
import { LanguageProvider } from '@/components/language-provider';
import { AuthProvider } from './contexts/AuthContext';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import { ProjectProvider } from './contexts/ProjectContext';
import GlobalChatProvider from '@/components/chat/GlobalChatProvider';
import { Toaster } from '@/components/ui/toaster';
import NotFound from '@/pages/not-found';
import AdminDashboard from '@/components/admin/AdminDashboard';
import VisualCMSAdminDashboard from '@/components/admin/VisualCMSAdminDashboard';
import EquipmentAdminPage from '@/pages/EquipmentAdminPage';

const AdminBootstrapApp = () => (
  <QueryClientProvider client={queryClient}>
    <DemoModeProvider>
      <UniversalSessionProvider>
        <ClientSessionProvider>
          <LanguageProvider>
            <ThemeProvider theme={creatorHubTheme}>
              <CssBaseline />
              <AuthProvider>
                <EnhancedMasterIntegrationProvider
                  enableDebugMode={import.meta.env.VITE_ENABLE_INTEGRATION_DEBUG === 'true'}
                  enablePerformanceMonitoring={true}
                  enableAnalytics={true}
                >
                  <ProjectProvider>
                    <GlobalChatProvider>
                      <Switch>
                        <Route path="/admin">
                          {() => <AdminDashboard />}
                        </Route>
                        <Route path="/visual-cms-admin" component={VisualCMSAdminDashboard} />
                        <Route path="/equipment-admin" component={EquipmentAdminPage} />
                        <Route component={NotFound} />
                      </Switch>
                      <Toaster />
                    </GlobalChatProvider>
                  </ProjectProvider>
                </EnhancedMasterIntegrationProvider>
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </ClientSessionProvider>
      </UniversalSessionProvider>
    </DemoModeProvider>
  </QueryClientProvider>
);

export default AdminBootstrapApp;
