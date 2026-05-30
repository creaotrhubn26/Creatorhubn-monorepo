/**
 * AgencyPortalView.tsx
 *
 * B2B2Talent Phase 1.5 — partner-perspektivet. Når en agency-user
 * (Stella Casting, NSF, produksjonsselskap) logger inn, ser de:
 *   - Liste over alle talents agency-en har consent fra
 *   - Detaljvisning av én talent (felter maskert per scope)
 *   - Egen agency-profil (admin kan redigere)
 *
 * Dark-theme palett matcher TalentPortalView for visuell konsistens.
 */

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkIcon from '@mui/icons-material/Link';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useCallback, useEffect, useMemo, useState } from 'react';

import roleRoomTalentsService, {
  type RoleRoomAgencyOrg,
  type RoleRoomMaskedTalent,
} from '../services/roleRoomTalentsService';

const SURFACE = 'rgba(7, 13, 26, 0.72)';
const BORDER = 'rgba(125, 211, 252, 0.14)';
const TEXT_PRIMARY = 'rgba(241, 245, 249, 0.96)';
const TEXT_SECONDARY = 'rgba(191, 219, 254, 0.74)';
const TEXT_MUTED = 'rgba(148, 163, 184, 0.78)';
const ACCENT = '#7dd3fc';
const SUCCESS = '#34d399';

const cardSx = {
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
  bgcolor: SURFACE,
  p: { xs: 2.2, md: 2.8 },
};

const SCOPE_LABELS: Record<string, string> = {
  basic_profile: 'Basis',
  media_portfolio: 'Media',
  contact_info: 'Kontakt',
  demographics: 'Demografi',
  availability: 'Tilgjengelighet',
  audition_invitations: 'Audition-invites',
  self_tape_review: 'Self-tape',
  full_profile: 'Full profil',
};

interface AgencyPortalViewProps {
  onClose?: () => void;
}

export default function AgencyPortalView(_props: AgencyPortalViewProps) {
  const [agency, setAgency] = useState<RoleRoomAgencyOrg | null>(null);
  const [agencyRole, setAgencyRole] = useState<'admin' | 'member' | null>(null);
  const [talents, setTalents] = useState<RoleRoomMaskedTalent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTalent, setSelectedTalent] = useState<RoleRoomMaskedTalent | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agencyResult, talentsResult] = await Promise.all([
        roleRoomTalentsService.fetchMyAgency(),
        roleRoomTalentsService.fetchAgencyTalents(),
      ]);
      setAgency(agencyResult.agency);
      setAgencyRole(agencyResult.agencyRole);
      setTalents(talentsResult.talents);
    } catch (err) {
      setError(`Klarte ikke å laste: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    if (!search.trim()) return talents;
    const q = search.trim().toLowerCase();
    return talents.filter((t) => {
      const name = (t.display_name || '').toLowerCase();
      const city = (t.city || '').toLowerCase();
      return name.includes(q) || city.includes(q);
    });
  }, [talents, search]);

  const handleOpenTalent = useCallback(async (talent: RoleRoomMaskedTalent) => {
    setLoadingDetail(true);
    const result = await roleRoomTalentsService.fetchAgencyTalent(talent.id);
    setLoadingDetail(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setSelectedTalent(result);
  }, []);

  if (loading) {
    return (
      <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack alignItems="center" spacing={1.5}>
          <CircularProgress sx={{ color: ACCENT }} />
          <Typography sx={{ color: TEXT_SECONDARY }}>Henter agency-portal…</Typography>
        </Stack>
      </Box>
    );
  }

  if (!agency) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Box sx={cardSx}>
          <Stack spacing={1.5}>
            <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 800, fontSize: '1.2rem' }}>
              Din konto er ikke koblet til en agency
            </Typography>
            <Typography sx={{ color: TEXT_SECONDARY, lineHeight: 1.6 }}>
              For å se talents må kontoen din være medlem av en agency (Stella Casting, Norsk
              Skuespillersenter, produksjonsselskap, etc.). Ta kontakt med Creatorhub
              for å bli koblet til riktig organisasjon.
            </Typography>
            <Button
              variant="outlined"
              href="mailto:support@theroleroom.com?subject=Kobling%20til%20agency"
              sx={{ alignSelf: 'flex-start', borderRadius: 999, color: TEXT_PRIMARY, borderColor: BORDER }}
            >
              Kontakt support
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack spacing={2.4}>
        {/* Agency-header */}
        <Box sx={cardSx}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                src={agency.logo_url || undefined}
                sx={{ width: 56, height: 56, bgcolor: 'rgba(125,211,252,0.16)', color: ACCENT, fontWeight: 800 }}
              >
                {agency.name.slice(0, 2).toUpperCase()}
              </Avatar>
              <Stack spacing={0.4}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 800, fontSize: '1.3rem' }}>
                    {agency.name}
                  </Typography>
                  {agency.verified ? (
                    <VerifiedIcon sx={{ color: ACCENT, fontSize: 20 }} titleAccess="Verifisert" />
                  ) : null}
                </Stack>
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.88rem' }}>
                  {agency.about || 'Agency-portal i The Role Room'}
                </Typography>
                {agencyRole ? (
                  <Chip
                    size="small"
                    label={agencyRole === 'admin' ? 'Du er admin' : 'Du er medlem'}
                    sx={{
                      alignSelf: 'flex-start',
                      bgcolor: agencyRole === 'admin' ? `${SUCCESS}22` : 'rgba(125,211,252,0.16)',
                      color: agencyRole === 'admin' ? SUCCESS : ACCENT,
                      fontWeight: 600,
                      height: 22,
                    }}
                  />
                ) : null}
              </Stack>
            </Stack>
            <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
              <Typography sx={{ color: ACCENT, fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}>
                {talents.length}
              </Typography>
              <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem' }}>
                Talents med aktiv consent
              </Typography>
            </Stack>
          </Stack>
        </Box>

        {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

        {/* Søk */}
        <Box sx={{ ...cardSx, py: 1.4 }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk etter navn eller by"
            fullWidth
            size="small"
            InputProps={{
              sx: { color: TEXT_PRIMARY, borderRadius: 2 },
            }}
          />
        </Box>

        {/* Talent-grid */}
        {filtered.length === 0 ? (
          <Box sx={cardSx}>
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <PersonOutlineIcon sx={{ color: TEXT_MUTED, fontSize: 48 }} />
              <Typography sx={{ color: TEXT_SECONDARY, fontWeight: 600 }}>
                {talents.length === 0
                  ? 'Ingen talents har gitt agency-en din tilgang ennå'
                  : 'Ingen treff for søket'}
              </Typography>
              {talents.length === 0 ? (
                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem', textAlign: 'center', maxWidth: 480 }}>
                  Talents må gi {agency.name} eksplisitt tilgang via sin Talent-portal før
                  dere kan se profilene deres. Bruk lenken under for å sende inn forespørsel.
                </Typography>
              ) : null}
            </Stack>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 1.5,
            }}
          >
            {filtered.map((t) => (
              <TalentCard key={t.id} talent={t} onOpen={() => void handleOpenTalent(t)} />
            ))}
          </Box>
        )}
      </Stack>

      {/* Talent-detalj-dialog */}
      <Dialog
        open={!!selectedTalent}
        onClose={() => setSelectedTalent(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#0a1222', color: TEXT_PRIMARY } }}
      >
        {selectedTalent ? (
          <>
            <DialogTitle sx={{ borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton onClick={() => setSelectedTalent(null)} size="small" sx={{ color: TEXT_PRIMARY }}>
                <ArrowBackIcon />
              </IconButton>
              <Typography sx={{ fontWeight: 800, flex: 1 }}>{selectedTalent.display_name}</Typography>
              {loadingDetail ? <CircularProgress size={18} sx={{ color: ACCENT }} /> : null}
            </DialogTitle>
            <DialogContent dividers sx={{ borderColor: BORDER }}>
              <TalentDetail talent={selectedTalent} />
            </DialogContent>
          </>
        ) : null}
      </Dialog>
    </Box>
  );
}

interface TalentCardProps {
  talent: RoleRoomMaskedTalent;
  onOpen: () => void;
}

function TalentCard({ talent, onOpen }: TalentCardProps) {
  const scopes = talent.granted_scopes || [];
  return (
    <Box
      onClick={onOpen}
      sx={{
        ...cardSx,
        p: 0,
        cursor: 'pointer',
        transition: 'all 0.15s',
        overflow: 'hidden',
        '&:hover': {
          borderColor: ACCENT,
          transform: 'translateY(-2px)',
        },
      }}
    >
      {talent.headshot_url ? (
        <Box
          sx={{
            width: '100%',
            aspectRatio: '4/5',
            backgroundImage: `url(${talent.headshot_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            aspectRatio: '4/5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(15, 23, 42, 0.5)',
          }}
        >
          <PersonOutlineIcon sx={{ color: TEXT_MUTED, fontSize: 56 }} />
        </Box>
      )}
      <Box sx={{ p: 1.5 }}>
        <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 700, fontSize: '0.98rem' }}>
          {talent.display_name}
        </Typography>
        {talent.city ? (
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem' }}>{talent.city}</Typography>
        ) : null}
        <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
          {scopes.slice(0, 3).map((s) => (
            <Chip
              key={s}
              size="small"
              label={SCOPE_LABELS[s] ?? s}
              sx={{
                bgcolor: 'rgba(125, 211, 252, 0.12)',
                color: ACCENT,
                height: 18,
                fontSize: '0.7rem',
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

interface TalentDetailProps {
  talent: RoleRoomMaskedTalent;
}

function TalentDetail({ talent }: TalentDetailProps) {
  const scopes = talent.granted_scopes || [];
  const hasMedia = scopes.includes('media_portfolio') || scopes.includes('full_profile');
  const hasContact = scopes.includes('contact_info') || scopes.includes('full_profile');
  const hasDemographics = scopes.includes('demographics') || scopes.includes('full_profile');
  const hasAvailability = scopes.includes('availability') || scopes.includes('full_profile');

  return (
    <Stack spacing={2.4} sx={{ py: 1.5 }}>
      {talent.bio ? (
        <Typography sx={{ color: TEXT_PRIMARY, lineHeight: 1.6 }}>{talent.bio}</Typography>
      ) : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {scopes.map((s) => (
          <Chip
            key={s}
            label={SCOPE_LABELS[s] ?? s}
            size="small"
            sx={{
              bgcolor: 'rgba(125, 211, 252, 0.16)',
              color: ACCENT,
              fontWeight: 600,
            }}
          />
        ))}
      </Stack>

      {hasMedia ? (
        <Box>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
            Media
          </Typography>
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            {talent.headshot_url ? (
              <Button href={talent.headshot_url} target="_blank" startIcon={<LinkIcon />} variant="outlined" sx={{ borderColor: BORDER, color: TEXT_PRIMARY }}>
                Headshot
              </Button>
            ) : null}
            {talent.showreel_url ? (
              <Button href={talent.showreel_url} target="_blank" startIcon={<LinkIcon />} variant="outlined" sx={{ borderColor: BORDER, color: TEXT_PRIMARY }}>
                Showreel
              </Button>
            ) : null}
            {talent.resume_url ? (
              <Button href={talent.resume_url} target="_blank" startIcon={<LinkIcon />} variant="outlined" sx={{ borderColor: BORDER, color: TEXT_PRIMARY }}>
                CV
              </Button>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {hasContact ? (
        <Box>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
            Kontakt
          </Typography>
          <Stack spacing={0.4}>
            {talent.email ? <Typography sx={{ color: TEXT_PRIMARY }}>{talent.email}</Typography> : null}
            {talent.phone ? <Typography sx={{ color: TEXT_PRIMARY }}>{talent.phone}</Typography> : null}
            {talent.agency_name ? (
              <Typography sx={{ color: TEXT_SECONDARY }}>Representeres av {talent.agency_name}</Typography>
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {hasDemographics ? (
        <Box>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
            Demografi
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {talent.age_range ? <Field label="Alder" value={talent.age_range} /> : null}
            {talent.gender ? <Field label="Kjønn" value={talent.gender} /> : null}
            {talent.height_cm ? <Field label="Høyde" value={`${talent.height_cm} cm`} /> : null}
            {talent.hair_color ? <Field label="Hår" value={talent.hair_color} /> : null}
            {talent.eye_color ? <Field label="Øyne" value={talent.eye_color} /> : null}
          </Stack>
        </Box>
      ) : null}

      {hasAvailability ? (
        <Box>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
            Tilgjengelighet
          </Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            {talent.availability_status ? (
              <Chip
                label={talent.availability_status}
                size="small"
                sx={{
                  bgcolor: talent.availability_status === 'open' ? `${SUCCESS}22` : 'rgba(148,163,184,0.2)',
                  color: talent.availability_status === 'open' ? SUCCESS : TEXT_SECONDARY,
                  textTransform: 'capitalize',
                  fontWeight: 600,
                }}
              />
            ) : null}
            {typeof talent.willing_to_travel === 'boolean' ? (
              <Chip
                label={talent.willing_to_travel ? 'Vil reise' : 'Kun lokalt'}
                size="small"
                sx={{ bgcolor: 'rgba(125,211,252,0.12)', color: ACCENT, fontWeight: 600 }}
              />
            ) : null}
          </Stack>
        </Box>
      ) : null}

      {Array.isArray(talent.skills) && talent.skills.length > 0 ? (
        <Box>
          <Typography sx={{ color: TEXT_MUTED, fontSize: '0.78rem', letterSpacing: '0.18em', textTransform: 'uppercase', mb: 1 }}>
            Ferdigheter
          </Typography>
          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
            {talent.skills.map((s, i) => (
              <Chip
                key={i}
                label={typeof s === 'string' ? s : s.label}
                size="small"
                sx={{ bgcolor: 'rgba(15,23,42,0.6)', color: TEXT_PRIMARY }}
              />
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ color: TEXT_MUTED, fontSize: '0.72rem' }}>{label}</Typography>
      <Typography sx={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}
