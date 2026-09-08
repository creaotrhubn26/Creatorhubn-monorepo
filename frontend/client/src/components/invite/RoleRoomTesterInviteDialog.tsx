/**
 * PrototypeTesterInviteDialog — CreatorHub-adminflate for å invitere
 * prototype-testere direkte (push-modell), i tillegg til den eksisterende
 * pull-modellen (testere søker, admin godkjenner).
 *
 * Workflow:
 *  1. Admin fyller inn epost + navn + valgte testområder
 *  2. Submit → backend genererer one-time-link og sender invitasjons-e-post
 *  3. Tester mottar lenken og godtar hele avtalegrunnlaget
 *  4. CreatorHub oppretter konto og solo_pro-tilgang
 *
 * Backend-API som forventes:
 *   POST /api/prototype-tester-invites
 *     body: { email, name, profession, company, testingAreas, personalMessage }
 *     returns: { id, token, inviteUrl, emailDelivery }
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
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

const DEFAULT_TESTING_AREAS = [
  'CreatorHub-dashboard',
  'Story Arc Studio',
  'Prosjekt og arbeidsflyt',
  'Showcase og klient-godkjenning',
  'Kontrakt og fakturering',
  'Integrasjoner',
  'Mobil',
  'iPad',
];

const PROFESSION_OPTIONS = [
  { value: 'photographer', label: 'Fotograf' },
  { value: 'videographer', label: 'Videograf' },
  { value: 'music_producer', label: 'Musikkprodusent' },
  { value: 'vendor', label: 'Leverandør' },
] as const;

interface PrototypeTesterInviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** Endepunkt for å opprette en invitasjon. Default: CreatorHub-programmet. */
  endpoint?: string;
}

interface InviteResponse {
  id: string;
  token: string;
  inviteUrl: string;
  emailDelivery?: {
    sent: boolean;
    provider?: string | null;
    reason?: string | null;
    messageId?: string | null;
  } | null;
}

export const PrototypeTesterInviteDialog = ({
  open,
  onClose,
  endpoint = '/api/prototype-tester-invites',
}: PrototypeTesterInviteDialogProps) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [company, setCompany] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [personalMessage, setPersonalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResponse | null>(null);

  const reset = () => {
    setName('');
    setEmail('');
    setProfession('');
    setCompany('');
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
    try {
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: {
          email: email.trim(),
          name: name.trim(),
          profession: profession.trim() || undefined,
          company: company.trim() || undefined,
          testingAreas: selectedAreas,
          personalMessage: personalMessage.trim() || undefined,
        },
      });
      if (!data?.id || !data?.token || !data?.inviteUrl) {
        throw new Error('Invitasjonen ble ikke opprettet med en gyldig lenke.');
      }
      setResult(data as InviteResponse);
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
            Sender en 14-dagers lenke med programvilkår, NDA, databehandleravtale og intensjonsavtale.
          </Typography>
        </Box>
        <IconButton onClick={handleClose} aria-label="Lukk" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {result ? (
          <Stack spacing={2}>
            <Alert
              severity={result.emailDelivery?.sent ? 'success' : 'warning'}
              variant="outlined"
            >
              {result.emailDelivery?.sent
                ? `Invitasjon opprettet og e-post sendt til ${email}.`
                : `Invitasjonen er opprettet, men e-posten ble ikke bekreftet sendt${result.emailDelivery?.reason ? `: ${result.emailDelivery.reason}` : '.'}`}
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
            <Stack direction="row" spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: 'rgba(255,255,255,0.6)' }}>
                  Profesjon (valgfri)
                </InputLabel>
                <Select
                  label="Profesjon (valgfri)"
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  sx={{ color: '#fff' }}
                >
                  <MenuItem value=""><em>Ikke valgt</em></MenuItem>
                  {PROFESSION_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Bedrift (valgfri)"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                fullWidth
                size="small"
                helperText="Tas med i avtalegrunnlaget"
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.6)' } }}
                FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.4)' } }}
              />
            </Stack>
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
              placeholder="Hei! Vi vil gjerne invitere deg til CreatorHubs prototypeprogram …"
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

// Bakoverkompatibelt eksportnavn mens eldre imports fases ut.
export const RoleRoomTesterInviteDialog = PrototypeTesterInviteDialog;

export default PrototypeTesterInviteDialog;
