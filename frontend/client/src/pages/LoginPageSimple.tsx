import React, { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useLocation } from 'wouter';
import LoginModal from '@/components/auth/LoginModal';
import { useAuth } from '@/hooks/useAuth';
import {
  CREATORHUB_AUTH_TOKEN_KEY,
  consumeCreatorHubGoogleLoginError,
} from '@/lib/creatorhubGoogleAuth';

export default function LoginPageSimple() {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const candidate = new URLSearchParams(window.location.search).get('redirect');
    return candidate && candidate.startsWith('/') ? candidate : null;
  }, []);

  const hasStoredToken =
    typeof window !== 'undefined'
      ? Boolean(window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY))
      : false;

  const currentRole = String(user?.role || '').toLowerCase();
  const currentUserCanAccessRedirect =
    !redirectTarget ||
    redirectTarget !== '/admin' ||
    currentRole === 'admin' ||
    currentRole === 'super_admin';

  useEffect(() => {
    setGoogleError(consumeCreatorHubGoogleLoginError());
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !hasStoredToken || !currentUserCanAccessRedirect) {
      return;
    }

    setLocation(redirectTarget || '/dashboard');
  }, [currentUserCanAccessRedirect, hasStoredToken, isAuthenticated, redirectTarget, setLocation]);

  if (isAuthenticated && hasStoredToken && currentUserCanAccessRedirect) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at top, rgba(255, 186, 108, 0.28) 0%, rgba(20, 16, 11, 0.96) 52%, #060709 100%)',
        }}
      >
        <CircularProgress sx={{ color: '#ffba6c' }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at top, rgba(255, 186, 108, 0.28) 0%, rgba(20, 16, 11, 0.96) 52%, #060709 100%)',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 48%, rgba(255,186,108,0.06) 100%)',
        }}
      />
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
        }}
      >
        {isAuthenticated && hasStoredToken && !currentUserCanAccessRedirect && (
          <Box
            sx={{
              position: 'absolute',
              top: 32,
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: 560,
              px: 2.5,
              py: 1.5,
              borderRadius: '999px',
              border: '1px solid rgba(255,186,108,0.24)',
              background: 'rgba(18,15,11,0.84)',
              backdropFilter: 'blur(18px)',
            }}
          >
            <Typography sx={{ color: '#ffcf9c', fontSize: 14, textAlign: 'center' }}>
              Du er allerede logget inn uten admin-tilgang. Logg inn på nytt med admin-kontoen for å åpne admin.
            </Typography>
          </Box>
        )}
      </Box>

      <LoginModal
        open={true}
        onClose={() => setLocation('/')}
        context="general"
        initialError={googleError}
        initialLoginType={null}
        redirectTo={redirectTarget || '/dashboard'}
      />
    </Box>
  );
}
