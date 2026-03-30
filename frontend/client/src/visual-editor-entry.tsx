import React from 'react';
import { Switch, Route } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { queryClient } from './lib/queryClient';
import { creatorHubTheme } from './theme/creatorHubTheme';
import { DemoModeProvider } from './contexts/DemoModeContext';
import { UniversalSessionProvider } from './contexts/UniversalSessionContext';
import { ClientSessionProvider } from './contexts/ClientSessionContext';
import { LanguageProvider } from '@/components/language-provider';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { EnhancedMasterIntegrationProvider } from './integration/EnhancedMasterIntegrationProvider';
import GlobalChatProvider from '@/components/chat/GlobalChatProvider';
import { Toaster } from '@/components/ui/toaster';
import { EnhancedVisualEditorPage } from '@/components/admin/visual-editor/EnhancedVisualEditorPage';
import EvendiOnePager from '@/pages/EvendiOnePager';
import NotFound from '@/pages/not-found';

const VisualEditorStandaloneApp: React.FC = () => {
  return (
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
                          <Route
                            path="/visual-editor-enhanced"
                            component={() => <EnhancedVisualEditorPage />}
                          />
                          <Route
                            path="/visual-editor-enhanced/:projectId"
                            component={({ params }) => <EnhancedVisualEditorPage projectId={params.projectId} />}
                          />
                          <Route path="/evendi" component={EvendiOnePager} />
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
};

export default VisualEditorStandaloneApp;
