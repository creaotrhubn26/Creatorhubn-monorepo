/**
 * LeadMapAccept.tsx
 *
 * Landing for invitasjons-token-aksept. URL:
 *   /lead-map/accept?token=...
 *
 * Flow:
 *   1. Hent invitasjon-detaljer (uten auth) via /api/lead-map/invitations/:token
 *   2. Vis hva brukeren blir invitert til (org-navn eller prosjekt-navn + rolle)
 *   3. Hvis ikke innlogget: tilbyr Google-login (samme cookie-session som Admin Room)
 *   4. Når innlogget med matchende e-post: POST /accept → redirect til /admin-room
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress,
  Container, Stack, Typography,
} from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface InvitationPreview {
  email: string;
  role: string;
  targetType: 'organization' | 'project';
  targetName: string | null;
  inviterName: string | null;
  expiresAt: string;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('token');
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('creatorhub_auth_token')
      ?? localStorage.getItem('authToken');
  } catch { return null; }
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  salgssjef: 'Salgssjef',
  teamleder: 'Teamleder',
  salgskonsulent: 'Salgskonsulent',
  promotor: 'Promotør',
  owner: 'Eier',
  member: 'Medlem',
  viewer: 'Leser',
};

export default function LeadMapAccept() {
  const token = getToken();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Mangler invitasjons-token i lenken.');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const r = await fetch(`/api/lead-map/invitations/${token}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        const data = await r.json();
        setInvitation(data);
      } catch (err) {
        const msg = String(err);
        if (msg.includes('utlopt')) setError('Denne invitasjonen har utløpt (lenken er gyldig i 7 dager).');
        else if (msg.includes('allerede_akseptert')) setError('Denne invitasjonen er allerede akseptert.');
        else if (msg.includes('ugyldig_token')) setError('Ugyldig invitasjons-token.');
        else setError(`Klarte ikke laste invitasjonen: ${msg}`);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const acceptInvite = async () => {
    if (!token) return;
    const authToken = getAuthToken();
    if (!authToken) {
      // Sender bruker til login med return-URL
      window.location.href = `/?login=1&return=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    setAccepting(true);
    try {
      const r = await fetch(`/api/lead-map/invitations/${token}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.error === 'feil_bruker') {
          throw new Error(`Du må logge inn med ${invitation?.email} for å akseptere denne invitasjonen.`);
        }
        throw new Error(j.error ?? `HTTP ${r.status}`);
      }
      setAccepted(true);
      // Send til Admin Room → Lead Map
      setTimeout(() => { window.location.href = '/admin-room?tab=lead-map'; }, 1500);
    } catch (err) {
      setError(String(err));
    } finally { setAccepting(false); }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Stack alignItems="center" spacing={2} sx={{ mb: 3 }}>
            <BusinessOutlinedIcon sx={{ fontSize: 48, color: '#c084fc' }} />
            <Typography variant="h4" component="h1" align="center">
              Velkommen til Lead Map
            </Typography>
          </Stack>

          {loading && <Stack alignItems="center"><CircularProgress /></Stack>}

          {error && <Alert severity="error">{error}</Alert>}

          {invitation && !accepted && !error && (
            <Stack spacing={3}>
              <Typography align="center">
                <strong>{invitation.inviterName ?? 'En bruker'}</strong> har invitert deg til{' '}
                <Box component="span" sx={{ color: '#c084fc', fontWeight: 700 }}>
                  {invitation.targetName ?? 'organisasjonen'}
                </Box>{' '}
                som <strong>{ROLE_LABELS[invitation.role] ?? invitation.role}</strong>.
              </Typography>

              <Box sx={{ bgcolor: 'rgba(192,132,252,0.08)', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Invitasjon for <strong>{invitation.email}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Gyldig til {new Date(invitation.expiresAt).toLocaleString('nb-NO')}
                </Typography>
              </Box>

              <Button
                variant="contained"
                size="large"
                onClick={acceptInvite}
                disabled={accepting}
                fullWidth
              >
                {accepting ? 'Aksepterer…' : 'Aksepter invitasjon'}
              </Button>

              <Typography variant="caption" color="text.secondary" align="center">
                Hvis du ikke er innlogget blir du sendt til innlogging først.
              </Typography>
            </Stack>
          )}

          {accepted && (
            <Stack alignItems="center" spacing={2}>
              <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main' }} />
              <Typography variant="h5">Invitasjonen er akseptert</Typography>
              <Typography color="text.secondary">Sender deg til Lead Map…</Typography>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
