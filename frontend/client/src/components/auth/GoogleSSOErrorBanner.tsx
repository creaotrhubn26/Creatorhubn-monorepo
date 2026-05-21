// @ts-nocheck
/**
 * GoogleSSOErrorBanner — Slice 9X.80
 *
 * Vises persistent øverst i appen når Google-SSO har gitt en feil
 * (redirect_uri_mismatch, scope-error, refresh-token-utløpt, etc.).
 * Bytter ut tidligere 30s sessionStorage-TTL som var altfor kort —
 * brukere som refresher mistet feilmeldingen og så blank skjerm.
 *
 * Forsvinner ved:
 *   - Klikk på X (eksplisitt dismiss)
 *   - TTL utløper (10 min)
 *   - Vellykket re-innlogging
 */

import React, { useState } from 'react';
import { Box, Stack, Typography, Button, IconButton, Slide } from '@mui/material';
import {
  Warning as WarningIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useCreatorHubStoredSession } from '@/hooks/useCreatorHubStoredSession';
import { startCreatorHubGoogleLogin } from '@/lib/creatorhubGoogleAuth';

const GoogleSSOErrorBanner: React.FC = () => {
  const { googleLoginError, clearGoogleLoginError } = useCreatorHubStoredSession();
  const [retrying, setRetrying] = useState(false);

  if (!googleLoginError) return null;

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await startCreatorHubGoogleLogin({
        returnPath: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
      });
      clearGoogleLoginError();
    } catch {
      setRetrying(false);
    }
  };

  return (
    <Slide direction="down" in mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          bgcolor: 'rgba(239, 68, 68, 0.95)',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.32)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={2}
          sx={{
            px: { xs: 2, md: 4 },
            py: 1.5,
            maxWidth: 1400,
            mx: 'auto',
          }}
        >
          <WarningIcon sx={{ fontSize: 22, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Google-innlogging feilet
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.92, display: 'block', mt: 0.25 }}>
              {googleLoginError}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: '0.95rem !important' }} />}
            onClick={handleRetry}
            disabled={retrying}
            sx={{
              bgcolor: '#fff',
              color: '#dc2626',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: '999px',
              px: 2,
              '&:hover': { bgcolor: '#fef2f2' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.6)', color: '#dc2626' },
            }}
          >
            {retrying ? 'Starter…' : 'Prøv igjen'}
          </Button>
          <IconButton
            size="small"
            onClick={clearGoogleLoginError}
            aria-label="Lukk feilmelding"
            sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
    </Slide>
  );
};

export default GoogleSSOErrorBanner;
