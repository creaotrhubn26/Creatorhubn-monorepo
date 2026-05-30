/**
 * TalentConsentsSection.tsx
 *
 * "Mine tilganger" — talenten ser hvilke partnere som har tilgang til
 * profilen sin (per scope), kan gi nye tilganger, og trekke gamle.
 *
 * Phase 1 MVP: ingen partner-search ennå (det krever at partneren har
 * registrert seg). Vi viser eksisterende consents + lar talenten manuelt
 * legge til (med partner_ref-input — typisk Stella Casting business-id).
 *
 * Designet matcher TalentPortalView's dark-theme-palett.
 */

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomTalent,
  type RoleRoomTalentConsent,
  type RoleRoomTalentConsentScope,
  type RoleRoomTalentPartnerType,
} from '../services/roleRoomTalentsService';

const SURFACE = 'rgba(7, 13, 26, 0.72)';
const BORDER = 'rgba(125, 211, 252, 0.14)';
const TEXT_PRIMARY = 'rgba(241, 245, 249, 0.96)';
const TEXT_SECONDARY = 'rgba(191, 219, 254, 0.74)';
const TEXT_MUTED = 'rgba(148, 163, 184, 0.78)';
const ACCENT = '#7dd3fc';
const SUCCESS = '#34d399';
const DANGER = '#f87171';

const PARTNER_TYPE_LABELS: Record<RoleRoomTalentPartnerType, string> = {
  stella_casting: 'Stella Casting',
  skuespillersenter: 'Norsk Skuespillersenter',
  production_company: 'Produksjonsselskap',
  caster_individual: 'Individuell caster',
  workshop_provider: 'Workshop-arrangør',
};

const SCOPE_LABELS: Record<RoleRoomTalentConsentScope, { title: string; help: string }> = {
  basic_profile: {
    title: 'Basis-profil',
    help: 'Navn, by, land — det aller minste.',
  },
  media_portfolio: {
    title: 'Media-portfolio',
    help: 'Headshot, showreel, CV.',
  },
  contact_info: {
    title: 'Kontaktinformasjon',
    help: 'E-post, telefon — så de kan ta direkte kontakt.',
  },
  demographics: {
    title: 'Demografi',
    help: 'Alder, kjønn, høyde, hår-/øyenfarge.',
  },
  availability: {
    title: 'Tilgjengelighet',
    help: 'Status (open/limited/unavailable) og noter.',
  },
  audition_invitations: {
    title: 'Audition-invitasjoner',
    help: 'Lar partneren sende deg auditions direkte.',
  },
  self_tape_review: {
    title: 'Self-tape-vurdering',
    help: 'Partneren kan se og kommentere på self tapes du sender.',
  },
  full_profile: {
    title: 'Full profil',
    help: 'Alt over — én samtykke for hele profilen.',
  },
};

const PARTNER_TYPE_OPTIONS = Object.entries(PARTNER_TYPE_LABELS) as Array<
  [RoleRoomTalentPartnerType, string]
>;
const SCOPE_OPTIONS = Object.entries(SCOPE_LABELS) as Array<
  [RoleRoomTalentConsentScope, { title: string; help: string }]
>;

const cardSx = {
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
  bgcolor: SURFACE,
  p: { xs: 2.2, md: 2.8 },
};

interface GrantFormState {
  partner_type: RoleRoomTalentPartnerType;
  partner_ref: string;
  partner_display_name: string;
  scope: RoleRoomTalentConsentScope;
  expires_at: string;
  notes: string;
}

const EMPTY_FORM: GrantFormState = {
  partner_type: 'stella_casting',
  partner_ref: '',
  partner_display_name: '',
  scope: 'basic_profile',
  expires_at: '',
  notes: '',
};

export default function TalentConsentsSection() {
  const [talent, setTalent] = useState<RoleRoomTalent | null>(null);
  const [consents, setConsents] = useState<RoleRoomTalentConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<GrantFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, c] = await Promise.all([
        roleRoomTalentsService.fetchMyTalent(),
        roleRoomTalentsService.fetchMyConsents(),
      ]);
      setTalent(t);
      setConsents(c);
    } catch (err) {
      setError(`Klarte ikke å laste samtykker: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeConsents = useMemo(
    () => consents.filter((c) => c.status === 'granted'),
    [consents],
  );
  const revokedConsents = useMemo(
    () => consents.filter((c) => c.status !== 'granted'),
    [consents],
  );

  const handleCreateProfile = useCallback(async () => {
    setCreatingProfile(true);
    setError(null);
    const result = await roleRoomTalentsService.createMyTalent({});
    setCreatingProfile(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setTalent(result);
    setSuccess('Profil opprettet. Du kan nå gi partnere tilgang.');
  }, []);

  const handleGrant = useCallback(async () => {
    if (!form.partner_ref.trim()) {
      setError('Du må fylle inn partner-ID (eks. Stella-business-ID eller e-post).');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await roleRoomTalentsService.grantConsent({
      partner_type: form.partner_type,
      partner_ref: form.partner_ref.trim(),
      partner_display_name: form.partner_display_name.trim() || undefined,
      scope: form.scope,
      expires_at: form.expires_at || undefined,
      notes: form.notes.trim() || undefined,
    });
    setSaving(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSuccess(
      `Tilgang gitt til ${form.partner_display_name || PARTNER_TYPE_LABELS[form.partner_type]} (${SCOPE_LABELS[form.scope].title}).`,
    );
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    void reload();
  }, [form, reload]);

  const handleRevoke = useCallback(
    async (consent: RoleRoomTalentConsent) => {
      if (
        !window.confirm(
          `Trekke tilgangen "${SCOPE_LABELS[consent.scope].title}" fra ${
            consent.partner_display_name || PARTNER_TYPE_LABELS[consent.partner_type]
          }?`,
        )
      ) {
        return;
      }
      setError(null);
      const result = await roleRoomTalentsService.revokeConsent(consent.id);
      if (!result.ok) {
        setError(result.error || 'Kunne ikke trekke samtykke.');
        return;
      }
      setSuccess('Tilgang trukket.');
      void reload();
    },
    [reload],
  );

  if (loading) {
    return (
      <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <CircularProgress size={20} sx={{ color: ACCENT }} />
        <Typography sx={{ color: TEXT_SECONDARY }}>Henter dine tilganger…</Typography>
      </Box>
    );
  }

  if (!talent) {
    return (
      <Box sx={cardSx}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <ShieldOutlinedIcon sx={{ color: ACCENT }} />
            <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: '1.05rem' }}>
              Du har ikke en talent-profil ennå
            </Typography>
          </Stack>
          <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
            For å gi partnere (Stella Casting, Norsk Skuespillersenter, produsenter, castere)
            tilgang til deg, må vi opprette en talent-profil. Du kontrollerer alt selv —
            ingen ser noe før du eksplisitt gir tilgang.
          </Typography>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button
            variant="contained"
            onClick={() => void handleCreateProfile()}
            disabled={creatingProfile}
            startIcon={creatingProfile ? <CircularProgress size={16} /> : null}
            sx={{
              alignSelf: 'flex-start',
              borderRadius: 999,
              px: 2.4,
              bgcolor: ACCENT,
              color: '#031522',
              fontWeight: 700,
              '&:hover': { bgcolor: '#bae6fd' },
            }}
          >
            Opprett talent-profil
          </Button>
        </Stack>
      </Box>
    );
  }

  return (
    <Stack spacing={2.2}>
      <Box sx={cardSx}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={1.5}
        >
          <Stack direction="row" spacing={1.2} alignItems="center">
            <ShieldOutlinedIcon sx={{ color: ACCENT }} />
            <Stack spacing={0.3}>
              <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: '1.1rem' }}>
                Mine tilganger
              </Typography>
              <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem' }}>
                Du eier profilen din. Disse partnerne har den tilgangen du har gitt dem.
              </Typography>
            </Stack>
          </Stack>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => {
              setForm(EMPTY_FORM);
              setError(null);
              setDialogOpen(true);
            }}
            sx={{
              borderRadius: 999,
              px: 2.4,
              bgcolor: ACCENT,
              color: '#031522',
              fontWeight: 700,
              '&:hover': { bgcolor: '#bae6fd' },
            }}
          >
            Gi en partner tilgang
          </Button>
        </Stack>
      </Box>

      {success ? <Alert severity="success" onClose={() => setSuccess(null)}>{success}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      <Box sx={cardSx}>
        <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700, mb: 1.5 }}>
          Aktive tilganger ({activeConsents.length})
        </Typography>
        {activeConsents.length === 0 ? (
          <Typography sx={{ color: TEXT_MUTED }}>
            Ingen partnere har tilgang ennå. Du må gi en tilgang for at en partner skal kunne se profilen.
          </Typography>
        ) : (
          <Stack spacing={1.2}>
            {activeConsents.map((c) => (
              <ConsentRow key={c.id} consent={c} onRevoke={() => void handleRevoke(c)} />
            ))}
          </Stack>
        )}
      </Box>

      {revokedConsents.length > 0 ? (
        <Box sx={cardSx}>
          <Typography sx={{ color: TEXT_SECONDARY, fontWeight: 600, mb: 1.5, fontSize: '0.92rem' }}>
            Tidligere tilganger ({revokedConsents.length})
          </Typography>
          <Stack spacing={1}>
            {revokedConsents.map((c) => (
              <ConsentRow key={c.id} consent={c} muted />
            ))}
          </Stack>
        </Box>
      ) : null}

      <GrantConsentDialog
        open={dialogOpen}
        form={form}
        saving={saving}
        onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
        onClose={() => setDialogOpen(false)}
        onSubmit={() => void handleGrant()}
      />
    </Stack>
  );
}

interface ConsentRowProps {
  consent: RoleRoomTalentConsent;
  onRevoke?: () => void;
  muted?: boolean;
}

function ConsentRow({ consent, onRevoke, muted = false }: ConsentRowProps) {
  const scopeLabel = SCOPE_LABELS[consent.scope]?.title ?? consent.scope;
  const partnerLabel = consent.partner_display_name || PARTNER_TYPE_LABELS[consent.partner_type] || consent.partner_type;
  const statusColor = consent.status === 'granted' ? SUCCESS : consent.status === 'revoked' ? DANGER : TEXT_MUTED;
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{
        p: 1.4,
        borderRadius: 2,
        border: `1px solid ${BORDER}`,
        bgcolor: muted ? 'rgba(15, 23, 42, 0.32)' : 'rgba(15, 23, 42, 0.5)',
        opacity: muted ? 0.78 : 1,
      }}
    >
      <Stack spacing={0.4}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700 }}>{partnerLabel}</Typography>
          <Chip
            size="small"
            label={scopeLabel}
            sx={{
              bgcolor: 'rgba(125, 211, 252, 0.16)',
              color: ACCENT,
              fontWeight: 600,
              height: 22,
            }}
          />
          <Chip
            size="small"
            label={consent.status}
            sx={{
              bgcolor: `${statusColor}22`,
              color: statusColor,
              fontWeight: 600,
              height: 22,
              textTransform: 'capitalize',
            }}
          />
        </Stack>
        <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>
          Ref: {consent.partner_ref}
          {consent.expires_at ? ` · utløper ${new Date(consent.expires_at).toLocaleDateString('nb-NO')}` : ''}
          {consent.status === 'revoked' && consent.revoked_at
            ? ` · trukket ${new Date(consent.revoked_at).toLocaleDateString('nb-NO')}`
            : ''}
        </Typography>
        {consent.notes ? (
          <Typography sx={{ color: TEXT_SECONDARY, fontSize: '0.85rem' }}>{consent.notes}</Typography>
        ) : null}
      </Stack>
      {onRevoke ? (
        <Tooltip title="Trekk denne tilgangen">
          <IconButton onClick={onRevoke} size="small" sx={{ color: DANGER }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : null}
    </Stack>
  );
}

interface GrantConsentDialogProps {
  open: boolean;
  form: GrantFormState;
  saving: boolean;
  onChange: (patch: Partial<GrantFormState>) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function GrantConsentDialog({ open, form, saving, onChange, onClose, onSubmit }: GrantConsentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Gi en partner tilgang</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
            Velg hvilken partner som skal få se profilen din, og hva slags informasjon de skal kunne se.
            Du kan trekke tilgangen når som helst.
          </Typography>
          <TextField
            select
            label="Partner-type"
            value={form.partner_type}
            onChange={(e) => onChange({ partner_type: e.target.value as RoleRoomTalentPartnerType })}
            fullWidth
          >
            {PARTNER_TYPE_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>
          <TextField
            label="Partner-ID eller e-post"
            value={form.partner_ref}
            onChange={(e) => onChange({ partner_ref: e.target.value })}
            placeholder="eks. stella-12345 eller kari@castingco.no"
            helperText="Spør partneren om hva deres ID er, eller bruk e-postadressen deres."
            fullWidth
          />
          <TextField
            label="Visningsnavn (valgfritt)"
            value={form.partner_display_name}
            onChange={(e) => onChange({ partner_display_name: e.target.value })}
            placeholder="eks. Stella Casting AS"
            fullWidth
          />
          <TextField
            select
            label="Hva får de tilgang til?"
            value={form.scope}
            onChange={(e) => onChange({ scope: e.target.value as RoleRoomTalentConsentScope })}
            helperText={SCOPE_LABELS[form.scope]?.help ?? ''}
            fullWidth
          >
            {SCOPE_OPTIONS.map(([value, { title }]) => (
              <MenuItem key={value} value={value}>{title}</MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Utløpsdato (valgfritt)"
            value={form.expires_at}
            onChange={(e) => onChange({ expires_at: e.target.value })}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Noter (valgfritt)"
            value={form.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            multiline
            minRows={2}
            placeholder="eks. Kun for Frost-prosjektet høst 2026"
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Avbryt</Button>
        <Button
          onClick={onSubmit}
          disabled={saving}
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          Gi tilgang
        </Button>
      </DialogActions>
    </Dialog>
  );
}
