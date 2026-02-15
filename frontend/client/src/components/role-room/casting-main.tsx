import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, IconButton } from '@mui/material';
import { Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import { CastingPlannerPanel } from './components/CastingPlannerPanel';
import { CastingLandingPage } from './components/CastingLandingPage';
import { ToastProvider } from './components/ToastStack';
import { CustomThemeProvider, useCustomTheme } from '@/contexts/ThemeContext';
import authSessionService from './services/authSessionService';

function CastingStandaloneAppContent() {
  // Check if user is logged in - determines which view to show
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { mode, toggleTheme } = useCustomTheme();

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

      {/* If not authenticated, always show landing page */}
      {!isAuthenticated ? (
        <CastingLandingPage onEnter={handleEnter} />
      ) : (
        /* If authenticated, show the planner */
        <ToastProvider position="bottom-right">
          <CastingPlannerPanel 
            onClose={() => {
              // Logout and redirect to landing
              authSessionService.clearSession().then(() => window.location.reload());
            }}
            isFullscreen={true}
            onToggleFullscreen={() => {
              // Not applicable in standalone mode - already fullscreen
              console.log('Fullscreen toggle not available in standalone mode');
            }}
            isStandalone={true}
          />
        </ToastProvider>
      )}
    </Box>
  );
}

function CastingStandaloneApp() {
  return (
    <CustomThemeProvider>
      <CastingStandaloneAppContent />
    </CustomThemeProvider>
  );
}

const container = document.getElementById('casting-root');
if (container) {
  const root = createRoot(container);
  root.render(<CastingStandaloneApp />);
}
