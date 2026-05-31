/**
 * ProfilePage.tsx — Talent eier sin egen profil.
 *
 * Tre tilstander:
 *   1. Ingen profil → Onboarding-wizard (4 steg)
 *   2. Eksisterende profil → Redigerbar visning
 *   3. Demo-modus → Read-only forhåndsvisning
 *
 * Mål: Irlin skal kunne fylle ut profilen sin uten å bli forvirret.
 * Hver felt har klar label + hjelp-tekst hvis ikke åpenbar.
 */

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/EditOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { useCallback, useEffect, useState } from 'react';

import roleRoomTalentsService, { type RoleRoomTalent } from '../../services/roleRoomTalentsService';
import MediaUploader from '../components/MediaUploader';
import { palette, radius } from '../theme';

interface ProfilePageProps {
  demoMode: boolean;
}

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

// Direkte fil-opplastning til Cloudflare R2 via presigned PUT-URL.
// Faller tilbake til URL-input hvis R2 ikke er konfigurert på backend.

export default function ProfilePage({ demoMode }: ProfilePageProps) {
  const [talent, setTalent] = useState<RoleRoomTalent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const t = await roleRoomTalentsService.fetchMyTalent();
      setTalent(t);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <CircularProgress size={20} sx={{ color: palette.accentBright }} />
        <Typography sx={{ color: palette.textSecondary }}>Henter profil…</Typography>
      </Box>
    );
  }

  if (demoMode) {
    return (
      <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.2rem', mb: 1 }}>
            Min profil (demo)
          </Typography>
          <Typography sx={{ color: palette.textMuted, lineHeight: 1.6 }}>
            I demo-modus ser du en eksempel-profil for Ingrid Nilsen.
            Logg inn med din egen konto for å lage din profil.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (!talent) {
    return (
      <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
        <Box sx={cardSx}>
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.3rem' }}>
              La oss bygge profilen din
            </Typography>
            <Typography sx={{ color: palette.textSecondary, lineHeight: 1.65 }}>
              Det tar ca 5 minutter. Du kan hoppe over felter og fylle inn senere.
              Casting-byråer ser kun det du eksplisitt deler — du kontrollerer alt.
            </Typography>
            <Stack direction="row" spacing={1.4} flexWrap="wrap" useFlexGap>
              <Chip label="Steg 1: Bio" sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 2: Headshot" sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 3: Showreel + CV" sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 4: Ferdigheter + språk" sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.accentBright }} />
            </Stack>
            <Button
              onClick={() => setWizardOpen(true)}
              startIcon={<AddIcon />}
              sx={{
                alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700,
                px: 2.4, py: 1.1, borderRadius: radius.sm,
                background: palette.accentGradient, color: '#fff',
              }}
            >
              Sett opp profil
            </Button>
          </Stack>
        </Box>
        <OnboardingWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          onDone={(t) => { setTalent(t); setWizardOpen(false); setSuccess('Profil opprettet! Du kan nå invitere partnere.'); }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1080, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15 }}>
            Min profil
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem', mt: 0.6 }}>
            Du eier denne profilen. Casting-byråer ser kun det du eksplisitt gir tilgang til.
          </Typography>
        </Box>
        <Button
          startIcon={<EditIcon />}
          onClick={() => setEditing(true)}
          sx={{
            textTransform: 'none', fontWeight: 700, px: 2.4, py: 1.1, borderRadius: radius.sm,
            background: palette.accentGradient, color: '#fff',
          }}
        >
          Rediger
        </Button>
      </Stack>

      {success ? <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert> : null}

      {/* Hero — headshot + navn */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }}>
          <Avatar
            src={talent.headshot_url ?? undefined}
            sx={{ width: 120, height: 120, bgcolor: 'rgba(168,85,247,0.18)', color: palette.accentBright }}
          >
            {talent.headshot_url ? null : <PersonOutlineIcon sx={{ fontSize: 56 }} />}
          </Avatar>
          <Stack spacing={0.6} sx={{ flexGrow: 1 }}>
            <Typography sx={{ color: palette.textPrimary, fontSize: '1.6rem', fontWeight: 800 }}>
              {talent.display_name}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.95rem' }}>
              {talent.city ? `${talent.city}, ${talent.country ?? 'NO'}` : 'By ikke satt'}
              {talent.playing_age_min && talent.playing_age_max
                ? ` · spille-alder ${talent.playing_age_min}–${talent.playing_age_max}`
                : ''}
            </Typography>
            {talent.bio ? (
              <Typography sx={{ color: palette.textSecondary, mt: 1, lineHeight: 1.5 }}>{talent.bio}</Typography>
            ) : null}
          </Stack>
        </Stack>
      </Box>

      {/* Media */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Media</Typography>
        <Stack spacing={1.2}>
          <MediaRow label="Headshot" url={talent.headshot_url} />
          <MediaRow label="Showreel" url={talent.showreel_url} />
          <MediaRow label="CV" url={talent.resume_url} />
        </Stack>
      </Box>

      {/* Ferdigheter & språk */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Ferdigheter</Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.7} useFlexGap>
          {(talent.skills ?? []).map((s, i) => (
            <Chip key={i} label={typeof s === 'string' ? s : s.label} size="small"
              sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.textPrimary }} />
          ))}
          {(talent.skills ?? []).length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>Ingen ferdigheter lagt inn ennå</Typography>
          ) : null}
        </Stack>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mt: 2, mb: 1 }}>Språk</Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.7} useFlexGap>
          {(talent.languages ?? []).map((l, i) => (
            <Chip
              key={i}
              label={`${l.label} ${l.level ? `(${l.level})` : ''}`}
              size="small"
              sx={{ bgcolor: 'rgba(168,85,247,0.14)', color: palette.textPrimary }}
            />
          ))}
          {(talent.languages ?? []).length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>Ingen språk lagt inn ennå</Typography>
          ) : null}
        </Stack>
      </Box>

      {/* Rediger-dialog */}
      <ProfileEditDialog
        open={editing}
        onClose={() => setEditing(false)}
        talent={talent}
        onSaved={(t) => { setTalent(t); setEditing(false); setSuccess('Profil oppdatert.'); }}
        onError={(msg) => setError(msg)}
      />
    </Box>
  );
}

function MediaRow({ label, url }: { label: string; url: string | null }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center"
      sx={{ p: 1.4, borderRadius: radius.sm, border: `1px solid ${palette.borderSubtle}`, bgcolor: palette.bgCardElevated }}>
      <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>{label}</Typography>
      {url ? (
        <Stack direction="row" spacing={1} alignItems="center">
          <CheckCircleIcon sx={{ color: palette.success, fontSize: 16 }} />
          <Typography component="a" href={url} target="_blank" rel="noreferrer"
            sx={{ color: palette.accentBright, fontSize: '0.85rem', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
            Åpne
          </Typography>
        </Stack>
      ) : (
        <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>Mangler</Typography>
      )}
    </Stack>
  );
}

// ──────────────────────────────────────────────────────────────────
// Onboarding-wizard — 4 steg
// ──────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  onDone: (t: RoleRoomTalent) => void;
}

function OnboardingWizard({ open, onClose, onDone }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: '',
    city: '',
    playing_age_min: '' as number | '',
    playing_age_max: '' as number | '',
    bio: '',
    headshot_url: '',
    showreel_url: '',
    resume_url: '',
    skills: '',
    languages: '',
  });

  const reset = () => {
    setStep(0);
    setForm({ display_name: '', city: '', playing_age_min: '', playing_age_max: '', bio: '', headshot_url: '', showreel_url: '', resume_url: '', skills: '', languages: '' });
    setError(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    // Først opprett, så oppdater med all data
    const created = await roleRoomTalentsService.createMyTalent({
      display_name: form.display_name || undefined,
    });
    if ('error' in created) {
      setError(created.error);
      setSaving(false);
      return;
    }
    const skills = form.skills.split(',').map((s) => ({ id: s.trim().toLowerCase().replace(/\s+/g, '_'), label: s.trim() })).filter((s) => s.label);
    const languages = form.languages.split(',').map((s) => {
      const [label, level] = s.split('|').map((p) => p.trim());
      return { code: label?.slice(0, 3).toLowerCase() ?? '', label: label ?? '', level };
    }).filter((l) => l.label);
    const updated = await roleRoomTalentsService.updateMyTalent({
      display_name: form.display_name || undefined,
      city: form.city || undefined,
      playing_age_min: form.playing_age_min || undefined,
      playing_age_max: form.playing_age_max || undefined,
      bio: form.bio || undefined,
      headshot_url: form.headshot_url || undefined,
      showreel_url: form.showreel_url || undefined,
      resume_url: form.resume_url || undefined,
      skills,
      languages,
    });
    setSaving(false);
    if ('error' in updated) {
      setError(updated.error);
      return;
    }
    onDone(updated);
    reset();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800, borderBottom: `1px solid ${palette.borderSubtle}` }}>
        Sett opp profil
      </DialogTitle>
      <DialogContent sx={{ pt: 2.4 }}>
        <Stepper activeStep={step} sx={{ mb: 3, '& .MuiStepLabel-label': { color: palette.textMuted, fontSize: '0.78rem' }, '& .MuiStepLabel-label.Mui-active': { color: palette.textPrimary }, '& .MuiStepIcon-root': { color: 'rgba(168,85,247,0.3)' }, '& .MuiStepIcon-root.Mui-active': { color: palette.accent } }}>
          <Step><StepLabel>Hvem er du</StepLabel></Step>
          <Step><StepLabel>Bio</StepLabel></Step>
          <Step><StepLabel>Media</StepLabel></Step>
          <Step><StepLabel>Ferdigheter</StepLabel></Step>
        </Stepper>

        {step === 0 ? (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              Vi trenger bare det aller mest grunnleggende for å starte.
            </Typography>
            <TextField label="Visningsnavn" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} fullWidth size="small" placeholder="Eks: Irlin Berg" />
            <TextField label="By" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} fullWidth size="small" placeholder="Eks: Oslo" />
            <Stack direction="row" spacing={1.4}>
              <TextField label="Spille-alder fra" type="number" value={form.playing_age_min} onChange={(e) => setForm({ ...form, playing_age_min: e.target.value ? Number(e.target.value) : '' })} fullWidth size="small" />
              <TextField label="til" type="number" value={form.playing_age_max} onChange={(e) => setForm({ ...form, playing_age_max: e.target.value ? Number(e.target.value) : '' })} fullWidth size="small" />
            </Stack>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
              Spille-alder = aldersspennet du kan spille på film/teater. Vanligvis ditt ekte alder ± 5 år.
            </Typography>
          </Stack>
        ) : null}

        {step === 1 ? (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              Skriv en kort bio som casting kan lese på 30 sekunder. Hva er du best på? Hvor har du jobbet?
            </Typography>
            <TextField
              label="Bio"
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              multiline
              minRows={5}
              fullWidth
              placeholder="Eks: Klassisk-utdannet skuespiller med fokus på moderne drama. Tre år på Nationaltheatret, sist sett i 'Nytt teater'-produksjonen Vinterland. Snakker norsk, engelsk, fransk."
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
              {form.bio.length}/600 tegn
            </Typography>
          </Stack>
        ) : null}

        {step === 2 ? (
          <Stack spacing={2.4}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              Last opp filer direkte — vi streamer dem til lagring i EU/EEA. Du kan hoppe over enkeltfiler og legge dem til senere.
            </Typography>
            <MediaUploader
              kind="headshot"
              label="Headshot"
              helperText="JPG/PNG/WebP — bilde av deg fra brystet og opp"
              value={form.headshot_url}
              onChange={(url) => setForm({ ...form, headshot_url: url ?? '' })}
            />
            <MediaUploader
              kind="showreel"
              label="Showreel"
              helperText="MP4/MOV/WebM — kort video som viser ditt arbeid"
              value={form.showreel_url}
              onChange={(url) => setForm({ ...form, showreel_url: url ?? '' })}
            />
            <MediaUploader
              kind="resume"
              label="CV"
              helperText="PDF med dine roller, utdanning, agent"
              value={form.resume_url}
              onChange={(url) => setForm({ ...form, resume_url: url ?? '' })}
            />
          </Stack>
        ) : null}

        {step === 3 ? (
          <Stack spacing={2}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem' }}>
              Det siste — hva kan du? Skill og språk hjelper casting å filtrere.
            </Typography>
            <TextField
              label="Ferdigheter"
              value={form.skills}
              onChange={(e) => setForm({ ...form, skills: e.target.value })}
              fullWidth size="small"
              placeholder="hesteridning, klassisk ballett, scenekamp, sang"
              helperText="Komma-separert. Hver verdi blir en chip."
            />
            <TextField
              label="Språk"
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              fullWidth size="small"
              placeholder="Norsk|native, Engelsk|flytende, Fransk|intermediate"
              helperText="Komma-separert. Bruk | for nivå: Norsk|native"
            />
          </Stack>
        ) : null}

        {error ? <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert> : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4, borderTop: `1px solid ${palette.borderSubtle}` }}>
        <Button onClick={onClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>Avbryt</Button>
        {step > 0 ? (
          <Button onClick={() => setStep(step - 1)} sx={{ color: palette.textPrimary, textTransform: 'none' }}>Tilbake</Button>
        ) : null}
        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
          >
            Neste
          </Button>
        ) : (
          <Button
            onClick={() => void handleSubmit()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={14} /> : null}
            sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}
          >
            Lagre profil
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────
// Rediger-dialog (eksisterende profil)
// ──────────────────────────────────────────────────────────────────

interface ProfileEditDialogProps {
  open: boolean;
  onClose: () => void;
  talent: RoleRoomTalent;
  onSaved: (t: RoleRoomTalent) => void;
  onError: (msg: string) => void;
}

function ProfileEditDialog({ open, onClose, talent, onSaved, onError }: ProfileEditDialogProps) {
  const [form, setForm] = useState({
    display_name: talent.display_name,
    city: talent.city ?? '',
    bio: talent.bio ?? '',
    playing_age_min: talent.playing_age_min ?? '' as number | '',
    playing_age_max: talent.playing_age_max ?? '' as number | '',
    headshot_url: talent.headshot_url ?? '',
    showreel_url: talent.showreel_url ?? '',
    resume_url: talent.resume_url ?? '',
    availability_status: talent.availability_status,
    skills: (talent.skills ?? []).map((s) => (typeof s === 'string' ? s : s.label)).join(', '),
    languages: (talent.languages ?? []).map((l) => `${l.label}${l.level ? `|${l.level}` : ''}`).join(', '),
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const skills = form.skills.split(',').map((s) => ({ id: s.trim().toLowerCase().replace(/\s+/g, '_'), label: s.trim() })).filter((s) => s.label);
    const languages = form.languages.split(',').map((s) => {
      const [label, level] = s.split('|').map((p) => p.trim());
      return { code: label?.slice(0, 3).toLowerCase() ?? '', label: label ?? '', level };
    }).filter((l) => l.label);
    const updated = await roleRoomTalentsService.updateMyTalent({
      display_name: form.display_name,
      city: form.city || undefined,
      bio: form.bio || undefined,
      playing_age_min: form.playing_age_min || undefined,
      playing_age_max: form.playing_age_max || undefined,
      headshot_url: form.headshot_url || undefined,
      showreel_url: form.showreel_url || undefined,
      resume_url: form.resume_url || undefined,
      availability_status: form.availability_status,
      skills,
      languages,
    });
    setSaving(false);
    if ('error' in updated) {
      onError(updated.error);
      return;
    }
    onSaved(updated);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: `1px solid ${palette.border}` } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Rediger profil</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1.2 }}>
          <TextField label="Visningsnavn" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} fullWidth size="small" />
          <TextField label="By" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} fullWidth size="small" />
          <Stack direction="row" spacing={1.4}>
            <TextField label="Spille-alder fra" type="number" value={form.playing_age_min} onChange={(e) => setForm({ ...form, playing_age_min: e.target.value ? Number(e.target.value) : '' })} fullWidth size="small" />
            <TextField label="til" type="number" value={form.playing_age_max} onChange={(e) => setForm({ ...form, playing_age_max: e.target.value ? Number(e.target.value) : '' })} fullWidth size="small" />
          </Stack>
          <TextField label="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} multiline minRows={4} fullWidth />

          <MediaUploader
            kind="headshot"
            label="Headshot"
            value={form.headshot_url}
            onChange={(url) => setForm({ ...form, headshot_url: url ?? '' })}
          />
          <MediaUploader
            kind="showreel"
            label="Showreel"
            value={form.showreel_url}
            onChange={(url) => setForm({ ...form, showreel_url: url ?? '' })}
          />
          <MediaUploader
            kind="resume"
            label="CV"
            value={form.resume_url}
            onChange={(url) => setForm({ ...form, resume_url: url ?? '' })}
          />
          <TextField select label="Tilgjengelighet" value={form.availability_status} onChange={(e) => setForm({ ...form, availability_status: e.target.value as RoleRoomTalent['availability_status'] })} fullWidth size="small">
            <MenuItem value="open">Tilgjengelig</MenuItem>
            <MenuItem value="limited">Begrenset</MenuItem>
            <MenuItem value="unavailable">Ikke tilgjengelig</MenuItem>
          </TextField>
          <TextField label="Ferdigheter (komma-separert)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} fullWidth size="small" />
          <TextField label="Språk (komma-separert, bruk | for nivå)" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} fullWidth size="small" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4 }}>
        <Button onClick={onClose} sx={{ color: palette.textMuted, textTransform: 'none' }}>Avbryt</Button>
        <Button onClick={() => void handleSave()} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : null}
          sx={{ textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm, background: palette.accentGradient, color: '#fff' }}>
          Lagre endringer
        </Button>
      </DialogActions>
    </Dialog>
  );
}
