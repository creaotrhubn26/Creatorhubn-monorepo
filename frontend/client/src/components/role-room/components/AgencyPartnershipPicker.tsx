/**
 * AgencyPartnershipPicker.tsx
 *
 * Produksjons-siden av agency↔production partnership-systemet.
 *
 * Plasseres i CastingPlannerPanel sin Kandidater-tab. Lar produksjonsteam-
 * eier:
 *   1. Se hvilke casting-byråer de har godkjent partnership med
 *   2. Foreslå nytt partnership (søk i discoverable-agencies)
 *   3. Invitere et byrå til DETTE spesifikke prosjektet (med valgte roller)
 *   4. Åpne talent-søk i konteksten av et godkjent partnership
 *
 * Daniels designprinsipp: byrå-valg er PROSJEKT-BASERT. Selv om man har
 * 5 byrå-partnerships totalt, må man eksplisitt velge hvilke som skal
 * jobbe med dette prosjektet (per-prosjekt scope, jf. migrate 222).
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
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SearchIcon from '@mui/icons-material/Search';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  discoverableAgencies,
  inviteProject,
  listInvitations,
  listMine,
  propose,
  type DiscoverableAgency,
  type Partnership,
  type ProjectInvitation,
} from '../services/roleRoomPartnershipsService';

interface Props {
  /** Aktivt casting-prosjekt — invitasjoner kobles til dette. */
  castingProjectId: string;
  castingProjectName?: string;
  /** Forhåndsvalgte roller å sende med invitasjonen (hvis brukeren ønsker). */
  defaultRoleIds?: string[];
}

const COLORS = {
  cardBg: 'rgba(2,6,23,0.72)',
  cardBorder: 'rgba(56,189,248,0.28)',
  accent: '#38bdf8',
  accentBg: 'rgba(56,189,248,0.14)',
  success: '#34d399',
  successBg: 'rgba(52,211,153,0.16)',
  warn: '#fbbf24',
  warnBg: 'rgba(251,191,36,0.16)',
  pause: '#fb923c',
  pauseBg: 'rgba(251,146,60,0.16)',
};

interface PartnershipForProject extends Partnership {
  invitation_for_project: ProjectInvitation | null;
}

export default function AgencyPartnershipPicker({
  castingProjectId,
  castingProjectName,
  defaultRoleIds,
}: Props) {
  const [partnerships, setPartnerships] = useState<PartnershipForProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Foreslå-ny-byrå-modal
  const [proposeOpen, setProposeOpen] = useState(false);

  // Invite-til-prosjekt-modal
  const [inviteTarget, setInviteTarget] = useState<PartnershipForProject | null>(null);
  const [inviteNotes, setInviteNotes] = useState('');

  const loadPartnerships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { partnerships: list } = await listMine('production');
      // Per partnership: hent invitasjoner og finn den for dette prosjektet
      const enriched: PartnershipForProject[] = await Promise.all(
        list
          .filter((p) => p.status === 'accepted' || p.status === 'pending')
          .map(async (p) => {
            if (p.status !== 'accepted') return { ...p, invitation_for_project: null };
            try {
              const { invitations } = await listInvitations(p.id);
              const match = invitations.find((i) => i.casting_project_id === castingProjectId) ?? null;
              return { ...p, invitation_for_project: match };
            } catch {
              return { ...p, invitation_for_project: null };
            }
          }),
      );
      setPartnerships(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Klarte ikke å hente byråer');
    } finally {
      setLoading(false);
    }
  }, [castingProjectId]);

  useEffect(() => {
    void loadPartnerships();
  }, [loadPartnerships]);

  const handleInvite = useCallback(async () => {
    if (!inviteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await inviteProject(inviteTarget.id, {
        casting_project_id: castingProjectId,
        role_ids: defaultRoleIds,
        notes: inviteNotes || undefined,
      });
      setInfo(`${inviteTarget.agency_name} er invitert til prosjektet.`);
      setInviteTarget(null);
      setInviteNotes('');
      await loadPartnerships();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke invitere');
    } finally {
      setBusy(false);
    }
  }, [inviteTarget, castingProjectId, defaultRoleIds, inviteNotes, loadPartnerships]);

  const openTalentSearch = useCallback((agencyType: string, agencyId: string) => {
    // Bevarer ?demo=1 ved navigasjon
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo') === '1' ? '&demo=1' : '';
    window.open(
      `/talents/registry?agency_type=${encodeURIComponent(agencyType)}&agency_id=${encodeURIComponent(agencyId)}${demo}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, []);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <CircularProgress size={22} sx={{ color: COLORS.accent }} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${COLORS.cardBorder}`,
        bgcolor: COLORS.cardBg,
        mb: 1.6,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
        <Stack direction="row" alignItems="center" spacing={1.2}>
          <HandshakeOutlinedIcon sx={{ color: COLORS.accent, fontSize: 22 }} />
          <Box>
            <Typography sx={{ color: '#e0f2fe', fontWeight: 700, fontSize: '0.95rem' }}>
              Casting-byråer for dette prosjektet
            </Typography>
            <Typography sx={{ color: 'rgba(186,230,253,0.78)', fontSize: '0.8rem' }}>
              {castingProjectName ? `${castingProjectName} · ` : ''}
              Velg hvilke byråer som skal jobbe på dette prosjektet — en og samme partnership kan brukes på flere prosjekter, men du må eksplisitt invitere per prosjekt.
            </Typography>
          </Box>
        </Stack>
        <Button
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => setProposeOpen(true)}
          size="small"
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            color: '#0f172a',
            bgcolor: COLORS.accent,
            px: 1.6,
            '&:hover': { bgcolor: '#0ea5e9' },
          }}
        >
          Foreslå nytt byrå
        </Button>
      </Stack>

      {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}
      {info ? <Alert severity="success" onClose={() => setInfo(null)} sx={{ mb: 1.4 }}>{info}</Alert> : null}

      {partnerships.length === 0 ? (
        <Box
          sx={{
            p: 2.2,
            borderRadius: 2,
            border: '1px dashed rgba(56,189,248,0.32)',
            bgcolor: 'rgba(2,6,23,0.55)',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#e0f2fe', fontWeight: 700, mb: 0.6, fontSize: '0.92rem' }}>
            Ingen partnerships ennå
          </Typography>
          <Typography sx={{ color: 'rgba(186,230,253,0.78)', fontSize: '0.84rem', mb: 1.4 }}>
            Foreslå samarbeid med et casting-byrå for å få tilgang til deres talent-register.
          </Typography>
          <Button
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setProposeOpen(true)}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: COLORS.accent, color: '#0f172a', '&:hover': { bgcolor: '#0ea5e9' } }}
          >
            Finn et byrå
          </Button>
        </Box>
      ) : (
        <Stack spacing={1.2}>
          {partnerships.map((p) => (
            <PartnershipRow
              key={p.id}
              partnership={p}
              busy={busy}
              onInviteToProject={() => setInviteTarget(p)}
              onOpenTalentSearch={() => openTalentSearch(p.agency_type, p.agency_org_id)}
            />
          ))}
        </Stack>
      )}

      {proposeOpen ? (
        <ProposePartnershipDialog
          open
          onClose={() => setProposeOpen(false)}
          onProposed={async () => {
            setProposeOpen(false);
            setInfo('Forslag sendt. Byrået må godkjenne før dere kan samarbeide.');
            await loadPartnerships();
          }}
        />
      ) : null}

      {inviteTarget ? (
        <Dialog
          open
          onClose={() => !busy && setInviteTarget(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.95)', color: '#e0f2fe', border: `1px solid ${COLORS.accent}` } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>
            Inviter {inviteTarget.agency_name} til {castingProjectName ?? 'dette prosjektet'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info" icon={<HandshakeOutlinedIcon />}>
                Byrået ser prosjektnavn, datoer og roller du har lagt inn.
                {Array.isArray(defaultRoleIds) && defaultRoleIds.length > 0
                  ? ` ${defaultRoleIds.length} valgte roller blir markert som høyt prioriterte.`
                  : ' Du kan velge spesifikke roller etter de har akseptert.'}
              </Alert>
              <TextField
                fullWidth
                size="small"
                label="Beskjed til byrået (valgfri)"
                value={inviteNotes}
                onChange={(e) => setInviteNotes(e.target.value)}
                multiline
                minRows={3}
                placeholder="F.eks. 'Vi ønsker spesielt etnisk diverse skuespillere 20-35 år'"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.4 }}>
            <Button onClick={() => setInviteTarget(null)} disabled={busy} sx={{ textTransform: 'none' }}>
              Avbryt
            </Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={14} /> : <CheckCircleOutlineIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: COLORS.accent, color: '#0f172a', '&:hover': { bgcolor: '#0ea5e9' } }}
            >
              Send invitasjon
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
}

// ── Row per partnership ───────────────────────────────────────────
function PartnershipRow(props: {
  partnership: PartnershipForProject;
  busy: boolean;
  onInviteToProject: () => void;
  onOpenTalentSearch: () => void;
}) {
  const { partnership: p } = props;
  const invited = p.invitation_for_project;
  const isPaused = !!p.paused_at;

  let statusChip: { label: string; color: string; bg: string; icon: React.ReactElement };
  if (p.status === 'pending') {
    statusChip = {
      label: 'Venter på byrå',
      color: COLORS.warn,
      bg: COLORS.warnBg,
      icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: 14 }} />,
    };
  } else if (isPaused) {
    statusChip = {
      label: `Pauset av ${p.paused_by_role === 'agency' ? 'byrået' : 'deg'}`,
      color: COLORS.pause,
      bg: COLORS.pauseBg,
      icon: <PauseCircleOutlineIcon sx={{ fontSize: 14 }} />,
    };
  } else if (invited) {
    if (invited.status === 'accepted') {
      statusChip = { label: 'Byrået jobber på dette prosjektet', color: COLORS.success, bg: COLORS.successBg, icon: <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> };
    } else if (invited.status === 'pending') {
      statusChip = { label: 'Venter på prosjekt-svar', color: COLORS.warn, bg: COLORS.warnBg, icon: <HourglassEmptyOutlinedIcon sx={{ fontSize: 14 }} /> };
    } else {
      statusChip = { label: `Invitasjon ${invited.status}`, color: '#9ca3af', bg: 'rgba(156,163,175,0.15)', icon: <CloseIcon sx={{ fontSize: 14 }} /> };
    }
  } else {
    statusChip = {
      label: 'Ikke invitert til dette prosjektet',
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.15)',
      icon: <AddCircleOutlineIcon sx={{ fontSize: 14 }} />,
    };
  }

  return (
    <Box
      sx={{
        p: 1.4,
        borderRadius: 2,
        border: '1px solid rgba(56,189,248,0.22)',
        bgcolor: 'rgba(2,6,23,0.5)',
        display: 'flex',
        alignItems: 'center',
        gap: 1.6,
        flexWrap: 'wrap',
      }}
    >
      <Avatar
        src={p.agency_logo_url ?? undefined}
        alt={p.agency_name}
        sx={{ width: 44, height: 44, bgcolor: '#0f172a', border: `1px solid ${COLORS.cardBorder}` }}
      >
        {p.agency_name?.charAt(0) ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <Typography sx={{ color: '#f0f9ff', fontWeight: 700 }}>{p.agency_name}</Typography>
          <Tooltip title="Verifisert byrå">
            <VerifiedOutlinedIcon sx={{ fontSize: 16, color: COLORS.accent }} />
          </Tooltip>
        </Stack>
        <Chip
          size="small"
          icon={statusChip.icon}
          label={statusChip.label}
          sx={{
            bgcolor: statusChip.bg,
            color: statusChip.color,
            fontWeight: 600,
            mt: 0.4,
            '& .MuiChip-icon': { color: statusChip.color },
          }}
        />
      </Box>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
        {p.status === 'accepted' && !isPaused && !invited ? (
          <Button
            size="small"
            startIcon={<HandshakeOutlinedIcon />}
            onClick={props.onInviteToProject}
            disabled={props.busy}
            sx={{ textTransform: 'none', fontWeight: 700, bgcolor: COLORS.accent, color: '#0f172a', '&:hover': { bgcolor: '#0ea5e9' } }}
          >
            Inviter til dette prosjektet
          </Button>
        ) : null}
        {p.status === 'accepted' && invited?.status === 'accepted' ? (
          <Button
            size="small"
            startIcon={<OpenInNewIcon />}
            onClick={props.onOpenTalentSearch}
            disabled={props.busy}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: '#e0f2fe',
              border: `1px solid ${COLORS.accent}`,
              '&:hover': { bgcolor: 'rgba(56,189,248,0.12)' },
            }}
          >
            Søk talenter
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}

// ── Foreslå partnership-dialog (med byrå-søk) ─────────────────────
function ProposePartnershipDialog(props: {
  open: boolean;
  onClose: () => void;
  onProposed: () => void;
}) {
  const [q, setQ] = useState('');
  const [agencies, setAgencies] = useState<DiscoverableAgency[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DiscoverableAgency | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { agencies: list } = await discoverableAgencies({ q });
      setAgencies(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Søk feilet');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce på 250ms ved tasting
  useEffect(() => {
    const id = setTimeout(() => void search(), 250);
    return () => clearTimeout(id);
  }, [q, search]);

  // Hent prod-user-id fra session via /me-cache hvis tilgjengelig.
  // Demo-modus: bruk demo-prod-user. Ellers fail og la backend håndtere.
  const productionUserId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') return '99999999-9999-9999-9999-999999999999';
    return undefined; // backend vil avvise med 403 hvis ikke matchende session
  }, []);

  const handlePropose = useCallback(async () => {
    if (!selected) return;
    if (!productionUserId) {
      setError('Logg inn som produksjonsteam-eier for å foreslå partnership');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await propose({
        agency_org_id: selected.id,
        production_user_id: productionUserId,
        message: message || undefined,
      });
      props.onProposed();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke sende forslag');
    } finally {
      setBusy(false);
    }
  }, [selected, productionUserId, message, props]);

  return (
    <Dialog
      open={props.open}
      onClose={() => !busy && props.onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e0f2fe', border: `1px solid ${COLORS.accent}`, minHeight: 560 } }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Foreslå samarbeid med casting-byrå
        <IconButton onClick={props.onClose} disabled={busy} sx={{ color: '#e0f2fe' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="Søk byrå…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: COLORS.accent, fontSize: 18 }} />
                </InputAdornment>
              ),
            }}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={22} sx={{ color: COLORS.accent }} /></Box>
          ) : (
            <Stack spacing={1}>
              {agencies.length === 0 ? (
                <Typography sx={{ color: 'rgba(186,230,253,0.7)', textAlign: 'center', py: 2 }}>
                  Ingen byråer funnet.
                </Typography>
              ) : (
                agencies.map((a) => {
                  const isSel = selected?.id === a.id;
                  return (
                    <Box
                      key={a.id}
                      onClick={() => setSelected(a)}
                      sx={{
                        p: 1.4,
                        borderRadius: 2,
                        border: `1px solid ${isSel ? COLORS.accent : 'rgba(56,189,248,0.2)'}`,
                        bgcolor: isSel ? COLORS.accentBg : 'rgba(2,6,23,0.5)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.4,
                        transition: 'border-color 0.15s, background-color 0.15s',
                        '&:hover': { borderColor: COLORS.accent, bgcolor: COLORS.accentBg },
                      }}
                    >
                      <Avatar src={a.logo_url ?? undefined} alt={a.name} sx={{ width: 40, height: 40, bgcolor: '#0f172a' }}>
                        {a.name.charAt(0)}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={0.6}>
                          <Typography sx={{ color: '#f0f9ff', fontWeight: 700 }}>{a.name}</Typography>
                          {a.verified ? <VerifiedOutlinedIcon sx={{ fontSize: 14, color: COLORS.accent }} /> : null}
                        </Stack>
                        {a.about ? (
                          <Typography sx={{ color: 'rgba(186,230,253,0.7)', fontSize: '0.78rem', mt: 0.2 }}>
                            {a.about}
                          </Typography>
                        ) : null}
                      </Box>
                      <Chip
                        size="small"
                        label={`${a.talent_pool_size} talenter`}
                        sx={{ bgcolor: COLORS.accentBg, color: COLORS.accent, fontWeight: 600 }}
                      />
                    </Box>
                  );
                })
              )}
            </Stack>
          )}
          {selected ? (
            <>
              <Divider sx={{ bgcolor: COLORS.cardBorder }} />
              <TextField
                fullWidth
                size="small"
                label={`Personlig melding til ${selected.name} (valgfri)`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                multiline
                minRows={2}
                placeholder="Si litt om hva slags samarbeid du ser for deg…"
              />
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.4 }}>
        <Button onClick={props.onClose} disabled={busy} sx={{ textTransform: 'none', color: 'rgba(186,230,253,0.8)' }}>
          Avbryt
        </Button>
        <Button
          onClick={() => void handlePropose()}
          disabled={!selected || busy}
          startIcon={busy ? <CircularProgress size={14} /> : <HandshakeOutlinedIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, bgcolor: COLORS.accent, color: '#0f172a', '&:hover': { bgcolor: '#0ea5e9' } }}
        >
          Send forslag
        </Button>
      </DialogActions>
    </Dialog>
  );
}
