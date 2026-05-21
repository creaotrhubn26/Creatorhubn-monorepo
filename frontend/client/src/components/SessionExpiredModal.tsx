/**
 * SessionExpiredModal — Global modal som dukker opp når en
 * authenticated request returnerer 401 fra et endpoint som krever
 * gyldig session-token (RoleRoom/dance/casting/auth).
 *
 * Lytter på 'creatorhub:session-expired'-event dispatched fra
 * lib/queryClient.ts. Vis vennlig "sesjon utløpt"-melding med ett
 * klikk til ny innlogging. Husker return-URL så bruker kommer
 * tilbake til samme side etter re-login.
 *
 * Designprinsipper:
 *   • Aldri vise generisk "401 Unauthorized" — alltid full kontekst
 *   • Auto-clear stale token før re-login-redirect så samme feil
 *     ikke repeterer
 *   • Cooldown: ikke vis modalen flere ganger i samme 30s-vindu
 *     (request-bølger kan trigge mange 401 på samme tid)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Stack, IconButton, Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  LockOutlined as LockIcon,
  Login as LoginIcon,
} from '@mui/icons-material';

const COOLDOWN_MS = 30_000;
const RETURN_URL_STORAGE_KEY = 'creatorhub:session-expired:return-url';

function clearStaleTokens(): void {
  try {
    if (typeof window === 'undefined') return;
    // CreatorHub-spesifikke token-keys
    const keysToClear = [
      'creatorhub-auth-token',
      'creatorhub-session-token',
      'role-room-auth-session',
      'authToken',
    ];
    for (const k of keysToClear) {
      window.localStorage.removeItem(k);
    }
    // Cookies: la backend slette via /logout
  } catch {
    /* noop */
  }
}

export const SessionExpiredModal: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [triggerInfo, setTriggerInfo] = useState<{ triggeredBy?: string }>({});
  const lastShownRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{
        returnUrl?: string;
        triggeredBy?: string;
        isAuthEndpoint?: boolean;
      }>;
      const now = Date.now();
      // Cooldown — unngå modal-spam fra request-bølger
      if (now - lastShownRef.current < COOLDOWN_MS) return;
      lastShownRef.current = now;

      // Lagre return-URL slik at vi kan redirecte tilbake etter re-login
      if (customEvent.detail?.returnUrl) {
        try {
          window.sessionStorage.setItem(
            RETURN_URL_STORAGE_KEY,
            customEvent.detail.returnUrl,
          );
        } catch {
          /* noop */
        }
      }
      setTriggerInfo({ triggeredBy: customEvent.detail?.triggeredBy });
      setOpen(true);

      // GA4 telemetry — viktig for å spore hvor ofte dette skjer
      const w = window as unknown as { gtag?: (...args: unknown[]) => void };
      if (typeof w.gtag === 'function') {
        w.gtag('event', 'session_expired_modal_shown', {
          triggered_by: customEvent.detail?.triggeredBy ?? 'unknown',
        });
      }
    };
    window.addEventListener('creatorhub:session-expired', handler);
    return () => {
      window.removeEventListener('creatorhub:session-expired', handler);
    };
  }, []);

  const handleReLogin = () => {
    clearStaleTokens();
    setOpen(false);
    // Redirect til login med return-URL som query-param
    let returnUrl = '/';
    try {
      const stored = window.sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
      if (stored) returnUrl = stored;
    } catch {
      /* noop */
    }
    const loginUrl = `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
    window.location.href = loginUrl;
  };

  const handleDismiss = () => {
    setOpen(false);
    // Ikke clear token — bruker velger å fortsette med risiko for nye 401
  };

  // På theroleroom.com ligger login-routen vanligvis på /login
  // (samme route som CreatorHub). Hvis ikke matcher login eksakt,
  // kan vi falle tilbake på root.

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      maxWidth="xs"
      fullWidth
      aria-labelledby="session-expired-title"
    >
      <DialogTitle
        id="session-expired-title"
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <LockIcon sx={{ color: '#F5B82E' }} />
          <Typography variant="h6">Sesjonen din har utløpt</Typography>
        </Stack>
        <IconButton onClick={handleDismiss} size="small" aria-label="Lukk">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Du må logge inn på nytt for å fortsette der du var. Vi husker
            hvilken side du var på, så du kommer rett tilbake etterpå.
          </Typography>
          <Alert severity="info" sx={{ py: 0.5 }}>
            <Typography variant="caption">
              Hvis dette skjer flere ganger på rad, prøv å logge ut og
              tømme cookies (DevTools → Application → Clear site data),
              så logg inn på nytt.
            </Typography>
          </Alert>
          {triggerInfo.triggeredBy && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', fontFamily: 'monospace', fontSize: 11 }}>
              Endepunkt som feilet: {triggerInfo.triggeredBy}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDismiss}>Avbryt</Button>
        <Button
          variant="contained"
          startIcon={<LoginIcon />}
          onClick={handleReLogin}
          autoFocus
          sx={{
            bgcolor: '#F5B82E',
            color: '#1F2937',
            fontWeight: 700,
            '&:hover': { bgcolor: '#D49B1A' },
          }}
        >
          Logg inn på nytt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionExpiredModal;
