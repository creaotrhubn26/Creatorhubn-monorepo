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
  Divider,
  IconButton,
  Link as MuiLink,
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
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useCallback, useEffect, useState } from 'react';

import roleRoomTalentsService, {
  type TalentProfileLinkKey, type RoleRoomTalent, type TalentAvailabilityWindow } from '../../services/roleRoomTalentsService';
import MediaUploader from '../components/MediaUploader';
import { palette, radius } from '../theme';
import { OPEN_WIZARD_KEY } from '../components/TalentsHowItWorksCard';
import PhysicalAttributesSection, { type PhysicalForm } from '../components/PhysicalAttributesSection';
import CastingPhotosSection from '../components/CastingPhotosSection';
import { REQUIRED_PHOTO_KINDS, type RequiredPhotoKind } from '../../../../../../shared/talent-physical-vocabulary';
import TalentProfileHero from '../components/TalentProfileHero';
import IdentityVerificationCard from '../components/IdentityVerificationCard';
import SelfTapeSharedList from '../components/selftape/SelfTapeSharedList';

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

const AVAILABILITY_LABEL: Record<string, string> = {
  open: 'Tilgjengelig', limited: 'Begrenset', unavailable: 'Ikke tilgjengelig',
};

/** Antall hele dager siden et ISO-tidspunkt (null hvis mangler). */
function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** Ferskhets-tekst + om signalet regnes som utdatert (> 30 dager). */
function availabilityFreshness(iso: string | null | undefined): { text: string; stale: boolean } {
  const d = daysSince(iso);
  if (d === null) return { text: 'Aldri bekreftet', stale: true };
  if (d <= 0) return { text: 'Bekreftet i dag', stale: false };
  if (d === 1) return { text: 'Bekreftet i går', stale: false };
  return { text: `Bekreftet for ${d} dager siden`, stale: d > 30 };
}

function formatWindow(w: TalentAvailabilityWindow): string {
  const label = w.status === 'open' ? 'Åpen' : 'Begrenset';
  return `${label}: ${w.startDate} – ${w.endDate}${w.notes ? ` · ${w.notes}` : ''}`;
}

export default function ProfilePage({ demoMode }: ProfilePageProps) {
  const [talent, setTalent] = useState<RoleRoomTalent | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleConfirmAvailability = useCallback(async () => {
    setConfirming(true);
    const updated = await roleRoomTalentsService.confirmMyAvailability();
    setConfirming(false);
    if ('error' in updated) { setError(updated.error); return; }
    setTalent(updated);
    setSuccess('Tilgjengelighet bekreftet.');
  }, []);

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

  // Krediteringer teller med i profilstyrken, så hero-en trenger antallet.
  const [creditCount, setCreditCount] = useState(0);
  useEffect(() => {
    if (demoMode) return;
    void roleRoomTalentsService.fetchMyCredits().then((rows) => setCreditCount(rows.length));
  }, [demoMode]);

  // Selvregistreringen oppretter en draft-rad med navn og e-post, så `talent`
  // er IKKE null for en fersk skuespiller. Det som avgjør om hen trenger
  // wizarden er om profilen har innhold — ellers møtte hen en profilside full
  // av «Mangler» uten noen vei videre.
  const harProfilInnhold = Boolean(
    talent && (talent.bio || talent.headshot_url || talent.showreel_url || talent.city),
  );

  // Kom hen hit fra «Sett opp profilen» på Hjem, skal wizarden åpne seg selv —
  // ellers måtte skuespilleren finne den samme knappen om igjen.
  //
  // Selvregistrering oppretter en draft-rad med navn og e-post, så `talent` er
  // IKKE null for en fersk skuespiller. Vi ser på om profilen har innhold, ikke
  // om raden finnes — ellers landet hen på en profilside full av «Mangler»
  // uten noen vei videre.
  useEffect(() => {
    if (loading || demoMode || harProfilInnhold) return;
    try {
      if (window.sessionStorage.getItem(OPEN_WIZARD_KEY) !== '1') return;
      window.sessionStorage.removeItem(OPEN_WIZARD_KEY);
      setWizardOpen(true);
    } catch {
      // Ingen sessionStorage — knappen på siden fungerer fortsatt.
    }
  }, [demoMode, harProfilInnhold, loading]);

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

  // `!talent` er med for at TypeScript skal smalne typen under.
  if (!talent || !harProfilInnhold) {
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
              <Chip label="Steg 1: Bio" sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 2: Headshot" sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 3: Showreel + CV" sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright }} />
              <Chip label="Steg 4: Ferdigheter + språk" sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright }} />
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
          onDone={(t) => { setTalent(t); setWizardOpen(false); setSuccess('Profilen er lagret. Du er fortsatt usynlig for byråer til du deler den.'); }}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1080, mx: 'auto' }}>
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

      <TalentProfileHero
        talent={talent}
        creditCount={creditCount}
        onEdit={() => setEditing(true)}
        onShare={() => { window.location.href = '/talents/partners'; }}
      />

      <IdentityVerificationCard
        verified={talent.identity_verified === true}
        verifiedAt={talent.identity_verified_at}
        demoMode={demoMode}
      />

      {/* Media */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Media</Typography>
        <Stack spacing={1.2}>
          <MediaRow label="Headshot" url={talent.headshot_url} />
          <MediaRow label="Showreel" url={talent.showreel_url} />
          <MediaRow label="Showreel 2" url={talent.showreel_url_2} />
          <MediaRow label="«Om meg»-video" url={talent.about_video_url} />
          <MediaRow label="CV" url={talent.resume_url} />
        </Stack>
      </Box>

      {/* Castingbilder: tre faste typer. Mangler vises som tomme rammer, ikke
          som fravær — ellers oppdager man først at settet er ufullstendig når
          et byrå avviser profilen. */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>Castingbilder</Typography>
          <Chip
            size="small"
            label={`${REQUIRED_PHOTO_KINDS.filter((k: { id: RequiredPhotoKind }) => talent.casting_photos?.[k.id]).length}/${REQUIRED_PHOTO_KINDS.length}`}
            sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.accentBright, fontWeight: 700 }}
          />
        </Stack>
        <Stack direction="row" spacing={1.6} flexWrap="wrap" useFlexGap>
          {REQUIRED_PHOTO_KINDS.map((kind) => {
            const url = talent.casting_photos?.[kind.id];
            return (
              <Box key={kind.id} sx={{ width: 150 }}>
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '3 / 4',
                    borderRadius: radius.md,
                    border: `1px ${url ? 'solid' : 'dashed'} ${url ? palette.border : palette.borderStrong}`,
                    bgcolor: palette.bgCardElevated,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {url ? (
                    <Box component="img" src={url} alt={kind.no} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>Mangler</Typography>
                  )}
                </Box>
                <Typography sx={{ color: palette.textSecondary, fontSize: '0.8rem', mt: 0.6, lineHeight: 1.35 }}>
                  {kind.no}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Lenkene casting-byråer spør om */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Lenker</Typography>
        {talent.drama_school ? (
          <Stack direction="row" justifyContent="space-between" sx={{ py: 0.9, borderBottom: `1px solid ${palette.borderSubtle}` }}>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem' }}>Dramaskole</Typography>
            <Typography sx={{ color: palette.textPrimary, fontSize: '0.9rem' }}>{talent.drama_school}</Typography>
          </Stack>
        ) : null}
        {LINK_FIELDS.map((field) => {
          const url = talent.profile_links?.[field.key];
          return (
            <Stack
              key={field.key}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
              sx={{ py: 0.9, borderBottom: `1px solid ${palette.borderSubtle}`, '&:last-of-type': { borderBottom: 'none' } }}
            >
              <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem' }}>{field.label}</Typography>
              {url ? (
                <MuiLink
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ color: palette.accentBright, fontSize: '0.88rem', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {url.replace(/^https?:\/\//, '')}
                </MuiLink>
              ) : (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', fontStyle: 'italic' }}>Mangler</Typography>
              )}
            </Stack>
          );
        })}
      </Box>

      {/* Ferdigheter & språk */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Ferdigheter</Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.7} useFlexGap>
          {(talent.skills ?? []).map((s, i) => (
            <Chip key={i} label={typeof s === 'string' ? s : s.label} size="small"
              sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.textPrimary }} />
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
              sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.textPrimary }}
            />
          ))}
          {(talent.languages ?? []).length === 0 ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>Ingen språk lagt inn ennå</Typography>
          ) : null}
        </Stack>
      </Box>

      {/* Tilgjengelighet: status + vinduer + ferskhets-stempel */}
      {(() => {
        const fresh = availabilityFreshness(talent.availability_confirmed_at);
        const windows = talent.availability_windows ?? [];
        return (
          <Box sx={{ ...cardSx, mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
              <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>Tilgjengelighet</Typography>
              <Chip
                size="small"
                label={fresh.text}
                sx={{
                  bgcolor: fresh.stale ? palette.warningBg : palette.successBg,
                  color: fresh.stale ? palette.warning : palette.success,
                  fontWeight: 600, fontSize: '0.72rem',
                }}
              />
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={0.7} useFlexGap sx={{ mb: windows.length ? 1.2 : 0 }}>
              <Chip size="small" label={AVAILABILITY_LABEL[talent.availability_status] ?? talent.availability_status}
                sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.textPrimary, fontWeight: 600 }} />
              {talent.willing_to_travel ? (
                <Chip size="small" label="Kan reise" sx={{ bgcolor: 'rgba(75, 61, 143,0.14)', color: palette.textPrimary }} />
              ) : null}
            </Stack>
            {windows.length > 0 ? (
              <Stack spacing={0.6} sx={{ mb: 1 }}>
                {windows.map((w, i) => (
                  <Typography key={i} sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                    • {formatWindow(w)}
                  </Typography>
                ))}
              </Stack>
            ) : (
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1 }}>
                Ingen konkrete vinduer lagt inn. Legg til perioder i «Rediger profil» så produsenter ser når du er ledig.
              </Typography>
            )}
            {fresh.stale ? (
              <Alert severity="warning" sx={{ mb: 1, py: 0.2, fontSize: '0.8rem' }}>
                Tilgjengeligheten din er utdatert. Bekreft at den fortsatt stemmer så produsenter kan stole på den.
              </Alert>
            ) : null}
            <Button
              onClick={() => void handleConfirmAvailability()}
              disabled={confirming}
              size="small"
              startIcon={confirming ? <CircularProgress size={13} /> : <CheckCircleIcon fontSize="small" />}
              sx={{ textTransform: 'none', fontWeight: 700, color: palette.accent }}
            >
              Bekreft at dette stemmer
            </Button>
          </Box>
        );
      })()}

      {/* Mine delte self-tapes (GDPR-oversikt + revoke) */}
      <Box sx={{ ...cardSx, mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700 }}>
            Mine delte self-tapes
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
            Du kan trekke tilbake tilgangen når som helst
          </Typography>
        </Stack>
        <SelfTapeSharedList />
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
    // Selvregistreringen har allerede opprettet en draft-rad; da svarer
    // create 409. Det er ikke en feil her — vi går rett videre til update og
    // lar den avgjøre om noe faktisk gikk galt.
    await roleRoomTalentsService.createMyTalent({
      display_name: form.display_name || undefined,
    });
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
        <Stepper activeStep={step} sx={{ mb: 3, '& .MuiStepLabel-label': { color: palette.textMuted, fontSize: '0.78rem' }, '& .MuiStepLabel-label.Mui-active': { color: palette.textPrimary }, '& .MuiStepIcon-root': { color: 'rgba(75, 61, 143,0.3)' }, '& .MuiStepIcon-root.Mui-active': { color: palette.accent } }}>
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

/** Lenkene casting-byråer ber om, i den rekkefølgen skjemaene deres bruker. */
const LINK_FIELDS: Array<{ key: TalentProfileLinkKey; label: string; placeholder: string }> = [
  { key: 'agency_website', label: 'Byråets nettside', placeholder: 'https://…' },
  { key: 'agency_profile', label: 'Byrå-profil (lenke til deg hos byrået)', placeholder: 'https://…' },
  { key: 'website', label: 'Egen nettside', placeholder: 'https://…' },
  { key: 'imdb', label: 'IMDb (eller annen CV-lenke)', placeholder: 'https://imdb.com/name/…' },
  { key: 'wikipedia', label: 'Wikipedia', placeholder: 'https://no.wikipedia.org/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'additional', label: 'Annen lenke', placeholder: 'https://…' },
];

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
    showreel_url_2: talent.showreel_url_2 ?? '',
    about_video_url: talent.about_video_url ?? '',
    drama_school: talent.drama_school ?? '',
    links: { ...(talent.profile_links ?? {}) } as Record<string, string>,
    castingPhotos: { ...(talent.casting_photos ?? {}) } as Record<string, string>,
    physical: {
      height_cm: talent.height_cm ?? ('' as number | ''),
      hair_color: talent.hair_color ?? '',
      eye_color: talent.eye_color ?? '',
      ethnicity: talent.ethnicity ?? '',
      ethnicityConsent: talent.ethnicity_consent === true,
      attributes: { ...(talent.physical_attributes ?? {}) },
    } as PhysicalForm,
    availability_status: talent.availability_status,
    windows: (talent.availability_windows ?? []) as TalentAvailabilityWindow[],
    skills: (talent.skills ?? []).map((s) => (typeof s === 'string' ? s : s.label)).join(', '),
    languages: (talent.languages ?? []).map((l) => `${l.label}${l.level ? `|${l.level}` : ''}`).join(', '),
  });
  const [saving, setSaving] = useState(false);

  const addWindow = () => setForm((f) => ({ ...f, windows: [...f.windows, { status: 'open', startDate: '', endDate: '', notes: '' }] }));
  const removeWindow = (idx: number) => setForm((f) => ({ ...f, windows: f.windows.filter((_, i) => i !== idx) }));
  const patchWindow = (idx: number, patch: Partial<TalentAvailabilityWindow>) =>
    setForm((f) => ({ ...f, windows: f.windows.map((w, i) => (i === idx ? { ...w, ...patch } : w)) }));

  const handleSave = async () => {
    setSaving(true);
    const skills = form.skills.split(',').map((s) => ({ id: s.trim().toLowerCase().replace(/\s+/g, '_'), label: s.trim() })).filter((s) => s.label);
    const languages = form.languages.split(',').map((s) => {
      const [label, level] = s.split('|').map((p) => p.trim());
      return { code: label?.slice(0, 3).toLowerCase() ?? '', label: label ?? '', level };
    }).filter((l) => l.label);
    // Samtykket til særlig kategori går gjennom sitt eget endepunkt, så det
    // kan trekkes uten å røre resten av profilen — og verdien slettes
    // server-side i samme spørring.
    if (form.physical.ethnicityConsent !== (talent.ethnicity_consent === true)) {
      await roleRoomTalentsService.setEthnicityConsent(form.physical.ethnicityConsent);
    }
    const updated = await roleRoomTalentsService.updateMyTalent({
      display_name: form.display_name,
      city: form.city || undefined,
      bio: form.bio || undefined,
      playing_age_min: form.playing_age_min || undefined,
      playing_age_max: form.playing_age_max || undefined,
      headshot_url: form.headshot_url || undefined,
      showreel_url: form.showreel_url || undefined,
      resume_url: form.resume_url || undefined,
      showreel_url_2: form.showreel_url_2 || undefined,
      about_video_url: form.about_video_url || undefined,
      drama_school: form.drama_school || undefined,
      // Tomme felter sendes ikke — serveren dropper dem uansett, men da
      // slipper vi å overskrive en lenke med tom streng ved et uhell.
      profile_links: Object.fromEntries(
        Object.entries(form.links).filter(([, url]) => url.trim()),
      ) as Record<string, string>,
      height_cm: form.physical.height_cm || undefined,
      hair_color: form.physical.hair_color || null,
      eye_color: form.physical.eye_color || null,
      // Etnisitet lagres kun når samtykket står på. Selve samtykke-flagget
      // settes gjennom sitt eget endepunkt like over.
      ethnicity: form.physical.ethnicityConsent ? form.physical.ethnicity || null : null,
      physical_attributes: form.physical.attributes,
      casting_photos: form.castingPhotos,
      availability_status: form.availability_status,
      // Behold kun gyldige vinduer (begge datoer satt, start ≤ slutt).
      availability_windows: form.windows
        .filter((w) => w.startDate && w.endDate && w.startDate <= w.endDate)
        .map((w) => ({ status: w.status, startDate: w.startDate, endDate: w.endDate, notes: w.notes?.trim() || undefined })),
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
          <CastingPhotosSection
            locale={typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'no'}
            value={form.castingPhotos}
            onChange={(next) => setForm({ ...form, castingPhotos: next })}
          />

          {/* Feltene casting-byråer spør om. Rekkefølgen følger skjemaene
              deres, så det er lett å fylle ut fra en byrå-forespørsel. */}
          <TextField label="Showreel 2 (lenke)" value={form.showreel_url_2} onChange={(e) => setForm({ ...form, showreel_url_2: e.target.value })} fullWidth size="small" placeholder="https://vimeo.com/…" />
          <TextField label="«Om meg»-video (lenke)" value={form.about_video_url} onChange={(e) => setForm({ ...form, about_video_url: e.target.value })} fullWidth size="small" placeholder="https://…" />
          <TextField label="Dramaskole" value={form.drama_school} onChange={(e) => setForm({ ...form, drama_school: e.target.value })} fullWidth size="small" placeholder="Teaterhøgskolen, LAMDA …" />

          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.8 }}>Lenker</Typography>
            <Stack spacing={1.4}>
              {LINK_FIELDS.map((field) => (
                <TextField
                  key={field.key}
                  label={field.label}
                  value={form.links[field.key] ?? ''}
                  onChange={(e) => setForm({ ...form, links: { ...form.links, [field.key]: e.target.value } })}
                  fullWidth
                  size="small"
                  placeholder={field.placeholder}
                />
              ))}
            </Stack>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 1 }}>
              Byrå-lenkene deles kun med partnere du har gitt kontaktinfo-tilgang. De øvrige følger profilen din.
            </Typography>
          </Box>

          <PhysicalAttributesSection
            locale={typeof window !== 'undefined' && window.location.pathname.startsWith('/en') ? 'en' : 'no'}
            form={form.physical}
            onChange={(next) => setForm({ ...form, physical: next })}
          />
          <TextField select label="Tilgjengelighet" value={form.availability_status} onChange={(e) => setForm({ ...form, availability_status: e.target.value as RoleRoomTalent['availability_status'] })} fullWidth size="small">
            <MenuItem value="open">Tilgjengelig</MenuItem>
            <MenuItem value="limited">Begrenset</MenuItem>
            <MenuItem value="unavailable">Ikke tilgjengelig</MenuItem>
          </TextField>

          {/* Tilgjengelighets-vinduer: konkrete åpne/begrensede datoperioder.
              Deles kun med partnere som har fått 'availability'-samtykke. */}
          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Tilgjengelighets-vinduer</Typography>
              <Button onClick={addWindow} size="small" startIcon={<AddIcon fontSize="small" />}
                sx={{ textTransform: 'none', color: palette.accent }}>Legg til</Button>
            </Stack>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mb: 1 }}>
              Vis produsenter når du faktisk er ledig. Deles kun med partnere du har gitt tilgjengelighets-tilgang.
            </Typography>
            <Stack spacing={1}>
              {form.windows.length === 0 ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.8rem', fontStyle: 'italic' }}>
                  Ingen vinduer lagt til ennå.
                </Typography>
              ) : form.windows.map((w, idx) => (
                <Box key={idx} sx={{ border: `1px solid ${palette.border}`, borderRadius: radius.sm, p: 1.2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <TextField select label="Type" value={w.status} size="small" sx={{ minWidth: 120 }}
                      onChange={(e) => patchWindow(idx, { status: e.target.value as TalentAvailabilityWindow['status'] })}>
                      <MenuItem value="open">Åpen</MenuItem>
                      <MenuItem value="limited">Begrenset</MenuItem>
                    </TextField>
                    <Box sx={{ flex: 1 }} />
                    <IconButton onClick={() => removeWindow(idx)} size="small" sx={{ color: palette.textMuted }} aria-label="Fjern vindu">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={1}>
                    <TextField label="Fra" type="date" value={w.startDate} size="small" fullWidth InputLabelProps={{ shrink: true }}
                      onChange={(e) => patchWindow(idx, { startDate: e.target.value })} />
                    <TextField label="Til" type="date" value={w.endDate} size="small" fullWidth InputLabelProps={{ shrink: true }}
                      error={Boolean(w.startDate && w.endDate && w.startDate > w.endDate)}
                      onChange={(e) => patchWindow(idx, { endDate: e.target.value })} />
                  </Stack>
                  <TextField label="Notat (valgfritt)" value={w.notes ?? ''} size="small" fullWidth sx={{ mt: 1 }}
                    onChange={(e) => patchWindow(idx, { notes: e.target.value })} />
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider sx={{ borderColor: palette.border }} />
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
