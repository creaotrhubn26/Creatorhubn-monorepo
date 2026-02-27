import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, IconButton, CssBaseline } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CastingPlannerPanel } from './components/CastingPlannerPanel';
import { CastingLandingPage } from './components/CastingLandingPage';
import { ToastProvider } from './components/ToastStack';
import authSessionService from './services/authSessionService';
import { usePublishedPageCustomizations } from '@/hooks/usePageCustomizations';
import { EnhancedMasterIntegrationProvider } from '@/integration/EnhancedMasterIntegrationProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { DemoModeProvider } from '@/contexts/DemoModeContext';

// Lightweight theme context for standalone casting app (no auth/integration deps)
const CastingThemeContext = createContext<{ mode: 'light' | 'dark'; toggleTheme: () => void }>({
  mode: 'dark',
  toggleTheme: () => {},
});
const useCastingTheme = () => useContext(CastingThemeContext);

const castingQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function CastingStandaloneAppContent() {
  // Check if user is logged in - determines which view to show
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Admin-controlled demoMode toggle — fetched from published page customizations
  const { data: pageData } = usePublishedPageCustomizations('landing-desktop');
  const lpSection = (pageData?.sections?.loginPanel as Record<string, unknown> | undefined) ?? {};
  const demoModeEnabled = lpSection.demoMode !== false;

  // Guest / bypass mode — no login required (only honoured when demoMode is on)
  const [guestMode, setGuestMode] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        if (params.get('bypass') === '1' || params.get('guest') === '1') {
          sessionStorage.setItem('rrg', '1');
          return true;
        }
        return sessionStorage.getItem('rrg') === '1';
      }
    } catch {}
    return false;
  });

  // If admin disables demoMode after a guest has entered, kick them back to landing
  useEffect(() => {
    if (!demoModeEnabled && guestMode) {
      try { sessionStorage.removeItem('rrg'); } catch {}
      setGuestMode(false);
    }
  }, [demoModeEnabled, guestMode]);

  const { mode, toggleTheme } = useCastingTheme();

  useEffect(() => {
    let isMounted = true;
    authSessionService.loadSession().then(session => {
      if (!isMounted) return;
      setIsAuthenticated(!!session.adminUser);
    });
    const handleUpdate = () => {
      const session = authSessionService.getSessionSync();
      setIsAuthenticated(!!session.adminUser);
    };
    window.addEventListener('auth-session-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('auth-session-updated', handleUpdate);
    };
  }, []);

  const handleEnter = () => {
    // Reload the page to check authentication state
    window.location.reload();
  };

  const handleGuestEnter = () => {
    try { sessionStorage.setItem('rrg', '1'); } catch {}
    setGuestMode(true);
  };

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {/* Theme Toggle Button */}
      <Box sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 1300,
      }}>
        <IconButton
          onClick={toggleTheme}
          size="small"
          sx={{
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
          title={mode === 'dark' ? 'Lysere modus' : 'Mørkere modus'}
        >
          {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Box>

      {/* If not authenticated (and not guest mode), always show landing page */}
      {!isAuthenticated && !guestMode ? (
        <CastingLandingPage onEnter={handleEnter} onGuestEnter={handleGuestEnter} />
      ) : (
        /* If authenticated or guest mode, show the planner */
        <ToastProvider position="bottom-right">
          <CastingPlannerPanel 
            onClose={() => {
              if (guestMode) {
                // Exit guest mode and go back to landing
                try { sessionStorage.removeItem('rrg'); } catch {}
                setGuestMode(false);
              } else {
                // Logout and redirect to landing
                authSessionService.clearSession().then(() => window.location.reload());
              }
            }}
            isFullscreen={true}
            onToggleFullscreen={() => {
              // Not applicable in standalone mode - already fullscreen
              console.log('Fullscreen toggle not available in standalone mode');
            }}
            isStandalone={!guestMode}
          />
        </ToastProvider>
      )}
    </Box>
  );
}

function CastingStandaloneApp() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem('casting-theme-mode') as 'light' | 'dark') || 'dark';
    } catch { return 'dark'; }
  });

  const toggleTheme = () => {
    setMode(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('casting-theme-mode', next); } catch {}
      return next;
    });
  };

  const muiTheme = useMemo(() => createTheme({
    palette: { mode, primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } },
    shape: { borderRadius: 8 },
  }), [mode]);

  return (
    <QueryClientProvider client={castingQueryClient}>
      <DemoModeProvider>
        <CastingThemeContext.Provider value={{ mode, toggleTheme }}>
          <MuiThemeProvider theme={muiTheme}>
            <CssBaseline />
            <AuthProvider>
              <EnhancedMasterIntegrationProvider>
                <CastingStandaloneAppContent />
              </EnhancedMasterIntegrationProvider>
            </AuthProvider>
          </MuiThemeProvider>
        </CastingThemeContext.Provider>
      </DemoModeProvider>
    </QueryClientProvider>
  );
}

const container = document.getElementById('casting-root');
if (container) {
  const root = createRoot(container);
  root.render(<CastingStandaloneApp />);
}
