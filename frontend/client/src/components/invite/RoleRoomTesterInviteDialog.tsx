/**
 * RoleRoomTesterInviteDialog — admin-flate for å invitere prototype-testere
 * direkte (push-modell), i tillegg til den eksisterende pull-modellen
 * (testere søker, admin godkjenner).
 *
 * Workflow:
 *  1. Admin fyller inn epost + navn + valgte testområder
 *  2. Optional: forhåndsbekreft NDA-versjon
 *  3. Submit → backend genererer one-time-link og sender invitasjons-epost
 *  4. Tester mottar link, lander på /role-room/accept-invite?token=…,
 *     signerer NDA, sjekker system-krav, og aktiveres
 *
 * Backend-API som forventes:
 *   POST /api/role-room/tester-invites
 *     body: { email, name, testingAreas, ndaVersion, expiresAt }
 *     returns: { id, token, inviteUrl }
 *
 * Hvis API-et ikke finnes ennå returnerer den 404 og vi viser melding.
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

const DEFAULT_TESTING_AREAS = [
  'Casting Planner',
  'Story Arc Studio',
  'Storyboard-tegning',
  'Klient-godkjenning',
  'Live Set',
  'Mobil',
  'iPad',
];

interface RoleRoomTesterInviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Endepunkt for å opprette en invitasjon. Default: '/api/role-room/tester-invites'. */
  endpoint?: string;
  /** Standard utløpstid for invitasjonen i dager. Default: 14. */
  defaultExpiresDays?: number;
}

interface InviteResponse {
  id: string;
  token: string;
  inviteUrl: string;
}

export const RoleRoomTesterInviteDialog = ({
  open,
  onClose,
  endpoint = '/api/role-room/tester-invites',
  defaultExpiresDays = 14,
}: RoleRoomTesterInviteDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResponse | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setSelectedAreas([]);
    setPersonalMessage('');
    setError(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  const canSubmit =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    selectedAreas.length > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const expiresAt = new Date(
      Date.now() + defaultExpiresDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          testingAreas: selectedAreas,
          personalMessage: personalMessage.trim() || undefined,
          ndaVersion: '1.0',
          expiresAt,
        }),
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Invite-API-et er ikke deployet ennå. Be backend om POST /api/role-room/tester-invites.');
        }
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || `Kunne ikke opprette invitasjon (${response.status})`);
      }
      const data = (await response.json()) as InviteResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukjent feil');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (result?.inviteUrl) {
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
      } catch {
        /* fail silent — bruker kan bare lese URL-en */
      }
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0f172a',
          color: '#fff',
          border: '1px solid rgba(184,107,255,0.32)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Inviter prototype-tester
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
            Sender en one-time-link med NDA og system-krav. Utløper om {defaultExpiresDays} dager.
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Lukk" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {result ? (
          <Stack spacing={2}>
            <Alert severity="success" variant="outlined">
              Invitasjon opprettet og e-post sendt til {email}.
            </Alert>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', mb: 0.5, display: 'block' }}>
                One-time-link (kopier og del manuelt om e-posten ikke kommer fram):
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.25,
                  bgcolor: 'rgba(2,6,15,0.6)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.78rem', wordBreak: 'break-all' }}>
                  {result.inviteUrl}
                </Typography>
                <IconButton
                  onClick={handleCopyLink}
                  aria-label="Kopier link"
                  size="small"
                  sx={{ color: '#b86bff' }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <TextField
              label="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              size="small"
              autoFocus
              InputProps={{ sx: { color: '#fff' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
            />
            <TextField
              label="E-post"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              size="small"
              InputProps={{ sx: { color: '#fff' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
            />
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', display: 'block', mb: 1 }}>
                Områder å teste (velg minst ett)
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {DEFAULT_TESTING_AREAS.map((area) => {
                  const isSelected = selectedAreas.includes(area);
                  return (
                    <Chip
                      key={area}
                      label={area}
                      onClick={() => toggleArea(area)}
                      sx={{
                        bgcolor: isSelected ? 'rgba(184,107,255,0.24)' : 'rgba(255,255,255,0.06)',
                        color: isSelected ? '#e9d5ff' : 'rgba(255,255,255,0.78)',
                        border: isSelected ? '1px solid rgba(184,107,255,0.5)' : '1px solid rgba(255,255,255,0.12)',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    />
                  );
                })}
              </Stack>
            </Box>
            <TextField
              label="Personlig melding (valgfri)"
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              fullWidth
              multiline
              rows={3}
              size="small"
              placeholder="Hei! Vil du teste The Role Room? Du får tilgang i 14 dager…"
              InputProps={{ sx: { color: '#fff' } }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
            />
            {error && <Alert severity="error" variant="outlined">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {result ? (
          <Button variant="contained" onClick={handleClose}>Ferdig</Button>
        ) : (
          <>
            <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Avbryt
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit}
              startIcon={submitting ? <CircularProgress size={16} /> : <SendIcon />}
              sx={{
                bgcolor: '#b86bff',
                '&:hover': { bgcolor: '#a855f7' },
                '&:disabled': { bgcolor: 'rgba(184,107,255,0.3)' },
              }}
            >
              {submitting ? 'Sender…' : 'Send invitasjon'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default RoleRoomTesterInviteDialog;
