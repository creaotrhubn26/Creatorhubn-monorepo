import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForwardOutlined,
  CancelOutlined,
  CheckCircleOutlined,
  HourglassDisabledOutlined,
  LinkOffOutlined,
  RefreshOutlined,
} from '@mui/icons-material';
import {
  storeCreatorHubAuthSession,
  type CreatorHubAuthUser,
} from '@/lib/creatorhubGoogleAuth';

type WelcomeStatus =
  | 'loading'
  | 'success'
  | 'cancelled'
  | 'oauth_cancelled'
  | 'missing'
  | 'expired'
  | 'invalid'
  | 'error';

type CapturedWelcomeIntent = {
  token: string | null;
  checkout: string | null;
  googleCode: string | null;
  googleState: string | null;
  googleError: string | null;
};

type ConsumeMagicResponse = {
  success?: boolean;
  token?: string;
  user?: CreatorHubAuthUser;
  organization?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    plan?: string | null;
  } | null;
  error?: string;
};

type GoogleCallbackResponse = {
  id_token?: string;
  error?: string;
};

type GoogleExchangeResponse = {
  bearer?: string;
  user?: CreatorHubAuthUser;
  organization_id?: string;
  error?: string;
};

type PendingWelcomeSession = {
  token: string;
  user: CreatorHubAuthUser;
  organizationName: string | null;
};

// React StrictMode kan initialisere komponenten to ganger. Denne korte,
// minnebaserte broen lar begge initialiseringene se samme token samtidig som
// adresselinjen renses allerede under første render. Tokenet skrives aldri til
// storage, telemetry eller console og fjernes fra broen i første effect.
let pendingWelcomeIntent: CapturedWelcomeIntent | null = null;

function captureWelcomeIntent(): CapturedWelcomeIntent {
  if (pendingWelcomeIntent) {
    return pendingWelcomeIntent;
  }
  if (typeof window === 'undefined') {
    return {
      token: null,
      checkout: null,
      googleCode: null,
      googleState: null,
      googleError: null,
    };
  }

  const url = new URL(window.location.href);
  const fragmentParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  pendingWelcomeIntent = {
    // Nye lenker bruker fragment fordi det aldri sendes til webserveren.
    // Query støttes midlertidig for allerede utsendte velkomstlenker.
    token: fragmentParams.get('token')?.trim() || url.searchParams.get('token')?.trim() || null,
    checkout: url.searchParams.get('checkout')?.trim().toLowerCase() || null,
    googleCode: fragmentParams.get('google_code')?.trim() || url.searchParams.get('google_code')?.trim() || null,
    googleState: fragmentParams.get('state')?.trim() || url.searchParams.get('state')?.trim() || null,
    googleError:
      fragmentParams.get('google_error')?.trim().toLowerCase()
      || url.searchParams.get('google_error')?.trim().toLowerCase()
      || null,
  };

  // Fjern query + fragment umiddelbart. Dette hindrer tokenet i å følge med i
  // senere referrers, screenshots, kopierte URL-er og page-view events.
  window.history.replaceState(window.history.state, '', url.pathname || '/leadgrid/welcome');
  return pendingWelcomeIntent;
}

function releaseWelcomeIntent(intent: CapturedWelcomeIntent): void {
  intent.token = null;
  intent.googleCode = null;
  intent.googleState = null;
  intent.googleError = null;
  if (pendingWelcomeIntent === intent) {
    pendingWelcomeIntent = null;
  }
}

function isValidAuthPayload(
  payload: ConsumeMagicResponse,
): payload is ConsumeMagicResponse & { token: string; user: CreatorHubAuthUser } {
  return Boolean(
    payload.success === true
      && typeof payload.token === 'string'
      && payload.token.trim()
      && payload.user
      && typeof payload.user.id === 'string'
      && payload.user.id.trim()
      && typeof payload.user.email === 'string'
      && payload.user.email.trim(),
  );
}

async function readPayload(response: Response): Promise<ConsumeMagicResponse> {
  try {
    return await response.json() as ConsumeMagicResponse;
  } catch {
    return {};
  }
}

export default function LeadgridWelcomePage() {
  const [intent] = useState(captureWelcomeIntent);
  const tokenRef = useRef<string | null>(intent.token);
  const googleCodeRef = useRef<string | null>(intent.googleCode);
  const googleStateRef = useRef<string | null>(intent.googleState);
  const googleIdTokenRef = useRef<string | null>(null);
  const pendingSessionRef = useRef<PendingWelcomeSession | null>(null);
  const consumeStartedRef = useRef(false);
  const [status, setStatus] = useState<WelcomeStatus>(() => {
    if (intent.checkout === 'cancelled' || intent.checkout === 'canceled') return 'cancelled';
    if (intent.googleError === 'access_denied') return 'oauth_cancelled';
    if (intent.googleError) return 'error';
    if (intent.token || (intent.googleCode && intent.googleState)) return 'loading';
    if (intent.googleCode || intent.googleState) return 'invalid';
    return 'missing';
  });
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => (
    intent.googleError && intent.googleError !== 'access_denied'
      ? 'Google avbrøt innloggingen før en sikker Leadgrid-økt kunne opprettes.'
      : null
  ));

  const persistPendingSession = useCallback((): boolean => {
    const pending = pendingSessionRef.current;
    if (!pending) return false;
    if (!storeCreatorHubAuthSession(pending.token, pending.user)) {
      setErrorMessage(
        'Nettleseren blokkerte sikker lagring av innloggingen. Tillat nettstedslagring og prøv igjen.',
      );
      setStatus('error');
      return false;
    }
    pendingSessionRef.current = null;
    setOrganizationName(pending.organizationName);
    setStatus('success');
    return true;
  }, []);

  const consumeToken = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) {
      setStatus('missing');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      const response = await fetch('/api/leadgrid/self-onboard/consume-magic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({ token }),
      });
      const payload = await readPayload(response);

      if (response.ok && isValidAuthPayload(payload)) {
        tokenRef.current = null;
        pendingSessionRef.current = {
          token: payload.token,
          user: payload.user,
          organizationName: payload.organization?.name?.trim() || null,
        };
        persistPendingSession();
        return;
      }

      if (response.status === 410 || payload.error === 'magic_token_expired') {
        tokenRef.current = null;
        setStatus('expired');
        return;
      }
      if (response.status === 400 || response.status === 401) {
        tokenRef.current = null;
        setStatus('invalid');
        return;
      }
      if (response.status === 429) {
        setErrorMessage('For mange forsøk. Vent ett minutt og prøv igjen.');
      } else {
        setErrorMessage('Vi fikk ikke opprettet en sikker innlogging akkurat nå.');
      }
      setStatus('error');
    } catch {
      setErrorMessage('Kunne ikke kontakte Leadgrid. Sjekk nettet og prøv igjen.');
      setStatus('error');
    }
  }, [persistPendingSession]);

  const consumeGoogle = useCallback(async () => {
    const code = googleCodeRef.current;
    const state = googleStateRef.current;
    if (!code || !state) {
      setStatus('invalid');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    try {
      let idToken = googleIdTokenRef.current;
      if (!idToken) {
        const callbackResponse = await fetch('/api/leadgrid/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({ code, state }),
        });
        const callbackPayload = await callbackResponse
          .json()
          .catch(() => ({})) as GoogleCallbackResponse;
        if (!callbackResponse.ok || typeof callbackPayload.id_token !== 'string' || !callbackPayload.id_token.trim()) {
          if (callbackResponse.status === 400 || callbackResponse.status === 401) {
            googleCodeRef.current = null;
            googleStateRef.current = null;
            setStatus('invalid');
            return;
          }
          throw new Error(callbackPayload.error || 'google_callback_failed');
        }
        idToken = callbackPayload.id_token.trim();
        // Callback-state er engangsbruk. Behold det utvekslede Google-tokenet
        // kun i minnet slik at en midlertidig exchange-feil kan prøves igjen
        // uten å forsøke å gjenbruke OAuth-state.
        googleIdTokenRef.current = idToken;
      }

      const exchangeResponse = await fetch('/api/leadgrid/auth/google/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          id_token: idToken,
          platform: 'web',
          deviceInfo: { deviceName: 'Leadgrid Web' },
        }),
      });
      const exchangePayload = await exchangeResponse
        .json()
        .catch(() => ({})) as GoogleExchangeResponse;
      if (
        !exchangeResponse.ok
        || typeof exchangePayload.bearer !== 'string'
        || !exchangePayload.bearer.trim()
        || !exchangePayload.user
        || typeof exchangePayload.user.id !== 'string'
        || !exchangePayload.user.id.trim()
        || typeof exchangePayload.user.email !== 'string'
        || !exchangePayload.user.email.trim()
      ) {
        if (exchangeResponse.status === 400 || exchangeResponse.status === 401) {
          googleCodeRef.current = null;
          googleStateRef.current = null;
          googleIdTokenRef.current = null;
          setStatus('invalid');
          return;
        }
        throw new Error(exchangePayload.error || 'google_exchange_failed');
      }

      googleCodeRef.current = null;
      googleStateRef.current = null;
      googleIdTokenRef.current = null;
      pendingSessionRef.current = {
        token: exchangePayload.bearer,
        user: exchangePayload.user,
        organizationName: null,
      };
      persistPendingSession();
    } catch {
      setErrorMessage('Kunne ikke fullføre Google-innloggingen. Prøv igjen om et øyeblikk.');
      setStatus('error');
    }
  }, [persistPendingSession]);

  useEffect(() => {
    document.title = 'Velkommen · Leadgrid';
    releaseWelcomeIntent(intent);

    if (intent.checkout === 'cancelled' || intent.checkout === 'canceled') {
      tokenRef.current = null;
      return;
    }
    if (status === 'loading' && !consumeStartedRef.current) {
      consumeStartedRef.current = true;
      if (tokenRef.current) {
        void consumeToken();
      } else {
        void consumeGoogle();
      }
    }
  }, [consumeGoogle, consumeToken, intent, status]);

  const content = status === 'loading'
    ? {
        icon: <CircularProgress size={48} sx={{ color: '#a78bfa' }} />,
        eyebrow: 'Sikker innlogging',
        title: 'Gjør Leadgrid klart …',
        description: 'Vi kontrollerer engangslenken og oppretter en sikker økt.',
      }
    : status === 'success'
      ? {
          icon: <CheckCircleOutlined sx={{ fontSize: 52, color: '#5ee2a0' }} />,
          eyebrow: 'Kontoen er klar',
          title: organizationName ? `Velkommen til ${organizationName}` : 'Velkommen til Leadgrid',
          description: 'Du er sikkert innlogget. Nå kan du importere de første kundene og starte arbeidet.',
        }
      : status === 'cancelled'
        ? {
            icon: <CancelOutlined sx={{ fontSize: 52, color: '#fbbf77' }} />,
            eyebrow: 'Betaling avbrutt',
            title: 'Ingen betaling ble fullført',
            description: 'Kontooppsettet ditt er beholdt. Bruk velkomstlenken i e-posten når du vil fortsette.',
          }
        : status === 'oauth_cancelled'
          ? {
              icon: <CancelOutlined sx={{ fontSize: 52, color: '#fbbf77' }} />,
              eyebrow: 'Google-innlogging avbrutt',
              title: 'Ingen innlogging ble fullført',
              description: 'Ingen Leadgrid-økt ble opprettet. Du kan starte Google-innloggingen på nytt når du vil.',
            }
        : status === 'expired'
          ? {
              icon: <HourglassDisabledOutlined sx={{ fontSize: 52, color: '#fbbf77' }} />,
              eyebrow: 'Lenken er utløpt',
              title: 'Engangslenken er ikke aktiv lenger',
              description: 'Av sikkerhetsgrunner varer velkomstlenken i 14 dager. Kontakt oss for å få en ny lenke.',
            }
          : status === 'invalid'
            ? {
                icon: <LinkOffOutlined sx={{ fontSize: 52, color: '#ff8d9a' }} />,
                eyebrow: 'Lenken kan ikke brukes',
                title: 'Engangslenken er ugyldig eller allerede brukt',
                description: 'Kontroller at du åpnet hele lenken fra velkomst-e-posten. En brukt lenke kan ikke brukes på nytt.',
              }
            : status === 'missing'
              ? {
                  icon: <LinkOffOutlined sx={{ fontSize: 52, color: '#ff8d9a' }} />,
                  eyebrow: 'Velkommen til Leadgrid',
                  title: 'Velkomstlenken mangler',
                  description: 'Åpne den komplette lenken i e-posten fra Leadgrid for å logge inn sikkert.',
                }
              : {
                  icon: <RefreshOutlined sx={{ fontSize: 52, color: '#fbbf77' }} />,
                  eyebrow: 'Midlertidig feil',
                  title: 'Innloggingen ble ikke fullført',
                  description: errorMessage || 'Prøv igjen om et øyeblikk.',
                };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#0b0518',
        color: '#f4f0ff',
        display: 'flex',
        alignItems: 'center',
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            bgcolor: 'rgba(167,139,250,0.07)',
            color: '#f4f0ff',
            border: '1px solid rgba(167,139,250,0.22)',
            borderRadius: 4,
            boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 5 } }}>
            <Stack spacing={3}>
              <Box aria-hidden="true">{content.icon}</Box>
              <Box>
                <Typography variant="overline" sx={{ color: '#a78bfa', letterSpacing: 1.8 }}>
                  {content.eyebrow}
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 800, fontSize: { xs: 34, sm: 44 }, mt: 0.5 }}>
                  {content.title}
                </Typography>
              </Box>
              <Typography sx={{ color: 'rgba(244,240,255,0.74)', fontSize: 17, lineHeight: 1.65 }}>
                {content.description}
              </Typography>

              {status === 'loading' && (
                <Alert severity="info" sx={{ bgcolor: 'rgba(122,184,255,0.10)' }}>
                  Ikke lukk siden mens engangslenken kontrolleres.
                </Alert>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                {status === 'success' && (
                  <Button
                    component="a"
                    href="/leadgrid/import"
                    variant="contained"
                    endIcon={<ArrowForwardOutlined />}
                    sx={{ bgcolor: '#a78bfa', color: '#16072d', fontWeight: 750, '&:hover': { bgcolor: '#c084fc' } }}
                  >
                    Importer første kundeliste
                  </Button>
                )}
                {status === 'error' && (
                  pendingSessionRef.current
                  || tokenRef.current
                  || (googleCodeRef.current && googleStateRef.current)
                ) && (
                  <Button
                    type="button"
                    variant="contained"
                    startIcon={<RefreshOutlined />}
                    onClick={() => {
                      if (pendingSessionRef.current) {
                        persistPendingSession();
                      } else if (tokenRef.current) {
                        void consumeToken();
                      } else {
                        void consumeGoogle();
                      }
                    }}
                    sx={{ bgcolor: '#a78bfa', color: '#16072d', fontWeight: 750, '&:hover': { bgcolor: '#c084fc' } }}
                  >
                    Prøv igjen
                  </Button>
                )}
                {status !== 'loading' && status !== 'success' && (
                  <Button
                    component="a"
                    href="/leadgrid"
                    variant="outlined"
                    sx={{ color: '#f4f0ff', borderColor: 'rgba(244,240,255,0.28)' }}
                  >
                    Til Leadgrid
                  </Button>
                )}
                {(status === 'expired' || status === 'invalid' || status === 'missing') && (
                  <Button
                    component="a"
                    href="mailto:kontakt@creatorhubn.com?subject=Ny%20Leadgrid-velkomstlenke"
                    variant="text"
                    sx={{ color: '#c4b5fd' }}
                  >
                    Be om ny lenke
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
