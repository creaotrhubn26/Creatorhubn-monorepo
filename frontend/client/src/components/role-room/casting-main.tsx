import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Box, CircularProgress, CssBaseline, Typography } from '@mui/material';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CastingPlannerPanel } from './components/CastingPlannerPanel';
import { CastingLandingPage } from './components/CastingLandingPage';
import RoleRoomEducationPartnershipPage from './components/RoleRoomEducationPartnershipPage';
import TalentPortalView from './components/TalentPortalView';
import { ToastProvider } from './components/ToastStack';
import authSessionService from './services/authSessionService';
import { googleWorkspaceApi } from './services/castingApiService';
import { EnhancedMasterIntegrationProvider } from '@/integration/EnhancedMasterIntegrationProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import { parseTalentPortalIntentFromWindow } from './utils/talentPortal';
import { isRoleRoomEducationPathname } from './utils/runtime';

const castingQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ROLE_ROOM_DOCUMENT_TITLE = 'The Role Room - CreatorHub';
const ROLE_ROOM_FAVICON_URL = '/TheRoleRoom_App_Logo.png';

function upsertHeadLink(rel: string, href: string) {
  if (typeof document === 'undefined') {
    return;
  }

  const existingLink = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (existingLink) {
    if (rel !== 'apple-touch-icon') {
      existingLink.type = href.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    } else {
      existingLink.removeAttribute('type');
    }
    existingLink.href = href;
    return;
  }

  const link = document.createElement('link');
  link.rel = rel;
  if (rel !== 'apple-touch-icon') {
    link.type = href.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  }
  link.href = href;
  document.head.appendChild(link);
}

function CastingStandaloneAppContent() {
  const isEducationPath = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return isRoleRoomEducationPathname(window.location.pathname, window.location);
  }, []);

  if (isEducationPath) {
    return <RoleRoomEducationPartnershipPage />;
  }

  return <CastingStandaloneRuntimeContent />;
}

function CastingStandaloneRuntimeContent() {
  // Check if user is logged in - determines which view to show
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [processingGoogleLogin, setProcessingGoogleLogin] = useState(false);
  const handledGoogleTransferRef = useRef<string | null>(null);

  const guestMode = false;

  useEffect(() => {
    let isMounted = true;
    const clearGoogleIntentFromUrl = () => {
      if (typeof window === 'undefined') {
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleMessage');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    };

    const bootstrapAuthState = async () => {
      const session = await authSessionService.loadSession();
      if (!isMounted) return;

      const params = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      const googleStatus = params.get('rrGoogleStatus');
      const googleTransferId = params.get('rrGoogleTransfer');
      const googleMode = params.get('rrGoogleMode');

      if (googleStatus === 'success' && googleMode === 'login' && googleTransferId) {
        const transferKey = `${googleMode}:${googleTransferId}`;
        if (handledGoogleTransferRef.current !== transferKey) {
          handledGoogleTransferRef.current = transferKey;
          setProcessingGoogleLogin(true);
          try {
            const transfer = await googleWorkspaceApi.getOauthSessionResult(googleTransferId);
            if (!isMounted) return;

            if (transfer.mode === 'login' && transfer.user && transfer.sessionToken) {
              await authSessionService.applyRoleRoomLogin(
                {
                  id: transfer.user.id,
                  email: transfer.user.email,
                  role: transfer.user.role,
                  display_name: transfer.user.display_name,
                  name: transfer.user.name,
                  loginAs: transfer.user.loginAs,
                  requestedRole: transfer.user.requestedRole ?? null,
                },
                transfer.sessionToken,
              );
              if (!isMounted) return;
              try {
                sessionStorage.removeItem('role-room-commercial-draft-v1');
              } catch {
                // Ignore storage cleanup failures.
              }
              setIsAuthenticated(true);
              clearGoogleIntentFromUrl();
              setProcessingGoogleLogin(false);
              setAuthResolved(true);
              return;
            }
          } catch (error) {
            console.error('[CastingStandaloneApp] Failed to complete Google login redirect', error);
          } finally {
            if (isMounted) {
              clearGoogleIntentFromUrl();
              setProcessingGoogleLogin(false);
            }
          }
        }
      }

      setIsAuthenticated(!!session.adminUser);
      setAuthResolved(true);
    };

    void bootstrapAuthState();
    const handleUpdate = () => {
      const session = authSessionService.getSessionSync();
      setIsAuthenticated(!!session.adminUser);
      setAuthResolved(true);
    };
    window.addEventListener('auth-session-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('auth-session-updated', handleUpdate);
    };
  }, []);

  const handleReturnToLanding = useCallback(async () => {
    try {
      sessionStorage.removeItem('rrg');
    } catch {
      // Ignore session cleanup failures.
    }

    try {
      localStorage.removeItem('creatorhub_auth_user');
      localStorage.removeItem('creatorhub_auth_token');
    } catch {
      // Ignore storage cleanup failures.
    }

    await authSessionService.clearSession();

    setIsAuthenticated(false);
    setAuthResolved(true);
    setProcessingGoogleLogin(false);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('guest');
      url.searchParams.delete('bypass');
      url.searchParams.delete('rrGoogleStatus');
      url.searchParams.delete('rrGoogleTransfer');
      url.searchParams.delete('rrGoogleMode');
      url.searchParams.delete('rrGoogleMessage');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const handleEnter = () => {
    // Reload the page to check authentication state
    window.location.reload();
  };

  const talentPortalIntent = useMemo(
    () => parseTalentPortalIntentFromWindow(),
    [],
  );
  const sessionAdminUser = authSessionService.getSessionSync().adminUser;
  const normalizedRole = String(sessionAdminUser?.role || '').trim().toLowerCase();
  const normalizedRequestedRole = String(sessionAdminUser?.requestedRole || '').trim().toLowerCase();
  const shouldRenderTalentPortal = !guestMode && (
    Boolean(talentPortalIntent)
    || normalizedRole === 'talent'
    || normalizedRequestedRole === 'talent'
  );

  return (
    <Box sx={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {!authResolved || processingGoogleLogin ? (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            color: 'rgba(255,255,255,0.84)',
            bgcolor: '#050816',
          }}
        >
          <CircularProgress size={30} sx={{ color: '#8b5cf6' }} />
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
            {processingGoogleLogin ? 'Fullfører Google-innlogging…' : 'Laster Role Room…'}
          </Typography>
        </Box>
      ) : !isAuthenticated ? (
          <CastingLandingPage onEnter={handleEnter} />
        ) : (
          <ToastProvider position="bottom-right">
            {shouldRenderTalentPortal ? (
              <TalentPortalView
                intent={talentPortalIntent}
                onClose={() => {
                  void handleReturnToLanding();
                }}
              />
            ) : (
              <CastingPlannerPanel 
                onClose={() => {
                  void handleReturnToLanding();
                }}
                isFullscreen={true}
                onToggleFullscreen={() => {
                  // Not applicable in standalone mode - already fullscreen
                  console.log('Fullscreen toggle not available in standalone mode');
                }}
                isStandalone={true}
                isGuestMode={false}
              />
            )}
          </ToastProvider>
        )}
    </Box>
  );
}

export default function CastingStandaloneApp() {
  useEffect(() => {
    try {
      localStorage.setItem('casting-theme-mode', 'dark');
    } catch {
      // Ignore storage persistence failures.
    }
    if (typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = 'dark';
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.title = ROLE_ROOM_DOCUMENT_TITLE;
    upsertHeadLink('icon', ROLE_ROOM_FAVICON_URL);
    upsertHeadLink('shortcut icon', ROLE_ROOM_FAVICON_URL);
    upsertHeadLink('apple-touch-icon', ROLE_ROOM_FAVICON_URL);
  }, []);

  const muiTheme = useMemo(() => createTheme({
    palette: { mode: 'dark', primary: { main: '#1976d2' }, secondary: { main: '#dc004e' } },
    shape: { borderRadius: 8 },
  }), []);

  return (
    <QueryClientProvider client={castingQueryClient}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        <AuthProvider>
          <EnhancedMasterIntegrationProvider>
            <CastingStandaloneAppContent />
          </EnhancedMasterIntegrationProvider>
        </AuthProvider>
      </MuiThemeProvider>
    </QueryClientProvider>
  );
}

const container = document.getElementById('casting-root');
if (container) {
  const root = createRoot(container);
  root.render(<CastingStandaloneApp />);
}
