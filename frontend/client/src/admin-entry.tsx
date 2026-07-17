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
import LoginPageSimple from '@/pages/LoginPageSimple';
import AdminDashboard from '@/components/admin/AdminDashboard';
import VisualCMSAdminDashboard from '@/components/admin/VisualCMSAdminDashboard';
import EquipmentAdminPage from '@/pages/EquipmentAdminPage';
import PhotoVenuesAdminPage from '@/pages/PhotoVenuesAdminPage';

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
                        {/*
                         * Rot-ruten «/» rendrer admin-dashbordet. Dette bootstrap-
                         * treet lastes kun på (a) path-baserte /admin-ruter på
                         * hoved-hosten, eller (b) HELE den admin-dedikerte hosten
                         * (admin.creatorhubn.com) fra roten — se main.tsx
                         * isAdminDedicatedHost. På hoved-hosten treffer «/» aldri
                         * dette treet (der booter App), så ruten er kun aktiv på
                         * admin-hosten. Uten den fikk admin.creatorhubn.com/ 404
                         * «Siden ikke funnet» (NotFound-catch-all).
                         */}
                        <Route path="/">
                          {() => <AdminDashboard />}
                        </Route>
                        <Route path="/admin">
                          {() => <AdminDashboard />}
                        </Route>
                        {/*
                         * Admin-dashbordets auth-guard redirigerer uinnloggede til
                         * /login?redirect=/admin. På den admin-dedikerte hosten er
                         * admin-entry eneste bundle, så /login MÅ finnes her (på
                         * hoved-hosten eier App denne ruten). LoginPageSimple leser
                         * redirect-paramet og går til /admin etter innlogging. Uten
                         * denne ruten fikk admin.creatorhubn.com 404 rett etter at
                         * dashbordet redirigerte til login.
                         */}
                        <Route path="/login" component={LoginPageSimple} />
                        <Route path="/visual-cms-admin" component={VisualCMSAdminDashboard} />
                        <Route path="/equipment-admin" component={EquipmentAdminPage} />
                        <Route path="/photo-venues-admin" component={PhotoVenuesAdminPage} />
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
