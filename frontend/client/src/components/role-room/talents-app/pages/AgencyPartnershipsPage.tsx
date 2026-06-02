/**
 * AgencyPartnershipsPage.tsx
 *
 * Byrå-admins kontrollpanel for partnership-systemet.
 *
 * Tre faner:
 *   1. Tilgjengelighet — godta vilkår, slå på discoverability, pause, stenge.
 *      Pause-anbefaling-dialog ved stenging.
 *   2. Mine partnerships — liste over alle partnerships byrået er part i.
 *      Per partnership: pause/unpause, revoke (med pause-anbefaling).
 *   3. Innkommende invitasjoner — prosjekt-invitasjoner fra produksjonsteam.
 *      Aksepter/avslå.
 *
 * Tilgjengelig via /talents/partnerships (kun meningsfull for agency-admin —
 * service-laget returnerer 403 ellers).
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
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

const ProposeTalentsDialog = lazy(() => import('../components/ProposeTalentsDialog'));

import { palette, radius } from '../theme';
import {
  acceptTerms,
  agencyDashboard,
  closeAvailability,
  CURRENT_PARTNERSHIP_TERMS_VERSION,
  enableAvailability,
  getAvailability,
  incomingInvitations,
  listMine,
  pauseAvailability,
  pausePartnership,
  respondToPartnership,
  respondToProjectInvitation,
  revokePartnership,
  unpauseAvailability,
  unpausePartnership,
  type AgencyDashboard,
  type AvailabilityState,
  type AvailabilityStatus,
  type ConsequenceWarning,
  type Partnership,
  type ProjectInvitation,
} from '../../services/roleRoomPartnershipsService';

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

const STATE_BADGE: Record<AvailabilityState, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Ikke startet', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  needs_profile: { label: 'Fullfør profil', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  needs_terms: { label: 'Godta vilkår', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  needs_terms_update: { label: 'Godta oppdaterte vilkår', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  disabled: { label: 'Ikke aktivert', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
  active: { label: 'Aktiv', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  paused: { label: 'Pauset', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  closed: { label: 'Stengt', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
};

const STATUS_BADGE: Record<Partnership['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'Venter', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  accepted: { label: 'Akseptert', color: '#34d399', bg: 'rgba(52,211,153,0.15)' },
  declined: { label: 'Avslått', color: '#f87171', bg: 'rgba(248,113,113,0.15)' },
  revoked: { label: 'Avsluttet', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

export default function AgencyPartnershipsPage() {
  const [tab, setTab] = useState<'overview' | 'availability' | 'mine' | 'incoming'>('overview');
  const [dashboard, setDashboard] = useState<AgencyDashboard | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus | null>(null);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Pause-anbefaling-dialog
  const [pauseDialog, setPauseDialog] = useState<{
    title: string;
    warning: ConsequenceWarning;
    onConfirm: (reason: string) => Promise<void>;
    onPauseInstead: () => Promise<void>;
  } | null>(null);
  const [pauseDialogReason, setPauseDialogReason] = useState('');

  // Foreslå-talenter-dialog (åpnes fra accepted prosjekt-invitasjoner)
  const [proposeDialog, setProposeDialog] = useState<ProjectInvitation | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [avail, mine, inc, dash] = await Promise.all([
        getAvailability().catch((e) => {
          throw new Error(`Tilgjengelighet: ${e instanceof Error ? e.message : String(e)}`);
        }),
        listMine('agency').catch(() => ({ partnerships: [] })),
        incomingInvitations().catch(() => ({ invitations: [] })),
        agencyDashboard().catch(() => null),
      ]);
      setAvailability(avail);
      setPartnerships(mine.partnerships);
      setInvitations(inc.invitations);
      setDashboard(dash);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Klarte ikke å laste data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const doAction = useCallback(async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setInfo(okMsg);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handlingen feilet');
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const handleCloseAvailability = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await closeAvailability(); // første kall — uten confirm
      setInfo('Stenging fullført'); // vil normalt ikke nås
      await reload();
    } catch (e) {
      const w = (e as Error & { warning?: ConsequenceWarning }).warning;
      if (w) {
        setPauseDialog({
          title: 'Stenge byrået helt?',
          warning: w,
          onConfirm: async (reason: string) => {
            await closeAvailability({ confirm: true, acknowledge_consequences: true, reason });
            setPauseDialog(null);
            setInfo('Byrået er stengt.');
            await reload();
          },
          onPauseInstead: async () => {
            await pauseAvailability('Stengning vurdert — pauset midlertidig i stedet');
            setPauseDialog(null);
            setInfo('Pauset midlertidig i stedet for å stenge.');
            await reload();
          },
        });
      } else {
        setError(e instanceof Error ? e.message : 'Stenging feilet');
      }
    } finally {
      setBusy(false);
    }
  }, [reload]);

  const handleRevokePartnership = useCallback(async (p: Partnership) => {
    setBusy(true);
    setError(null);
    try {
      await revokePartnership(p.id); // første kall
      setInfo('Partnership avsluttet');
      await reload();
    } catch (e) {
      const w = (e as Error & { warning?: ConsequenceWarning }).warning;
      if (w) {
        setPauseDialog({
          title: `Avslutte samarbeid med ${p.production_name || 'produksjonsteam'}?`,
          warning: w,
          onConfirm: async (reason: string) => {
            await revokePartnership(p.id, { confirm: true, acknowledge_consequences: true, reason });
            setPauseDialog(null);
            setInfo('Partnership avsluttet');
            await reload();
          },
          onPauseInstead: async () => {
            await pausePartnership(p.id, 'Pauset i stedet for å avslutte');
            setPauseDialog(null);
            setInfo('Pauset midlertidig i stedet for å avslutte');
            await reload();
          },
        });
      } else {
        setError(e instanceof Error ? e.message : 'Kunne ikke avslutte');
      }
    } finally {
      setBusy(false);
    }
  }, [reload]);

  // Demo-modus deteksjon — alle requests har ?demo=1 i URL
  const isDemoMode = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('demo') === '1';

  return (
    <Box sx={{ p: 3, maxWidth: 960, mx: 'auto' }}>
      {isDemoMode ? (
        <Box
          sx={{
            mb: 2.4,
            p: 1.4,
            borderRadius: radius.sm,
            border: '1px solid rgba(168,85,247,0.42)',
            bgcolor: 'rgba(168,85,247,0.10)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.4,
          }}
        >
          <ScienceOutlinedIcon sx={{ color: palette.accentBright, fontSize: 24 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
              Demo-modus
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
              Du ser Stella Casting-demo. Alle endringer berører kun demo-data og kan trygt prøves ut.
            </Typography>
          </Box>
        </Box>
      ) : null}
      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, mb: 0.6 }}>
        Partnerships
      </Typography>
      <Typography sx={{ color: palette.textMuted, mb: 2.4 }}>
        Styr hvem som kan samarbeide med byrået ditt og under hvilke vilkår.
      </Typography>

      {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert> : null}
      {info ? <Alert severity="success" onClose={() => setInfo(null)} sx={{ mb: 2 }}>{info}</Alert> : null}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2.4, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab value="overview" label="Oversikt" />
        <Tab value="availability" label="Tilgjengelighet" />
        <Tab value="mine" label={`Mine partnerships (${partnerships.length})`} />
        <Tab value="incoming" label={`Innkommende (${invitations.length})`} />
      </Tabs>

      {loading && !availability ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                ...cardSx,
                height: 88,
                background: `linear-gradient(90deg, ${palette.bgCard} 0%, ${palette.bgCardElevated} 50%, ${palette.bgCard} 100%)`,
                backgroundSize: '200% 100%',
                animation: 'skeletonPulse 1.4s ease-in-out infinite',
                '@keyframes skeletonPulse': {
                  '0%': { backgroundPosition: '200% 0' },
                  '100%': { backgroundPosition: '-200% 0' },
                },
              }}
            />
          ))}
        </Stack>
      ) : null}

      {tab === 'overview' ? (
        <OverviewTab
          dashboard={dashboard}
          availability={availability}
          onJumpTab={(t) => setTab(t)}
        />
      ) : null}

      {tab === 'availability' && availability ? (
        <AvailabilityTab
          status={availability}
          busy={busy}
          onAcceptTerms={() => doAction(() => acceptTerms(CURRENT_PARTNERSHIP_TERMS_VERSION), 'Vilkår godtatt.')}
          onEnable={() => doAction(() => enableAvailability(), 'Discoverability slått på.')}
          onPause={(r) => doAction(() => pauseAvailability(r), 'Pauset.')}
          onUnpause={() => doAction(() => unpauseAvailability(), 'Gjenopptatt.')}
          onClose={handleCloseAvailability}
        />
      ) : null}

      {tab === 'mine' ? (
        <MinePartnershipsTab
          partnerships={partnerships}
          busy={busy}
          onRespond={(id, accept) => doAction(() => respondToPartnership(id, accept), accept ? 'Akseptert.' : 'Avslått.')}
          onPause={(id) => doAction(() => pausePartnership(id), 'Pauset.')}
          onUnpause={(id) => doAction(() => unpausePartnership(id), 'Gjenopptatt.')}
          onRevoke={handleRevokePartnership}
        />
      ) : null}

      {tab === 'incoming' ? (
        <IncomingInvitationsTab
          invitations={invitations}
          busy={busy}
          onRespond={(invId, accept) => doAction(
            () => respondToProjectInvitation(invId, accept),
            accept ? 'Prosjekt-invitasjon akseptert.' : 'Prosjekt-invitasjon avslått.',
          )}
          onProposeTalents={(inv) => setProposeDialog(inv)}
        />
      ) : null}

      {proposeDialog ? (
        <Suspense fallback={null}>
          <ProposeTalentsDialog
            open
            invitationId={proposeDialog.id}
            projectName={proposeDialog.project_name}
            roleIds={proposeDialog.role_ids}
            onClose={() => setProposeDialog(null)}
          />
        </Suspense>
      ) : null}

      {/* Pause-anbefaling-dialog (felles for både close og revoke) */}
      {pauseDialog ? (
        <Dialog
          open
          onClose={() => !busy && setPauseDialog(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { bgcolor: palette.bgCard, color: palette.textPrimary, borderRadius: radius.lg, border: '1px solid #fb923c' } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 1 }}>
            <WarningAmberOutlinedIcon /> {pauseDialog.title}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="warning" icon={<PauseCircleOutlineIcon />}>
                <strong>Vi anbefaler pause i stedet.</strong>
                <Box sx={{ mt: 1, fontSize: '0.88rem', lineHeight: 1.5 }}>
                  {pauseDialog.warning.recommendation_reason}
                </Box>
              </Alert>
              <Box sx={{ ...cardSx, p: 1.8 }}>
                <Typography sx={{ fontSize: '0.78rem', color: palette.textMuted, fontWeight: 700, mb: 1, textTransform: 'uppercase' }}>
                  Konsekvenser ved avslutning
                </Typography>
                <Stack spacing={0.6}>
                  {Object.entries(pauseDialog.warning.consequences).map(([k, v]) => (
                    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>
                        {humanizeKey(k)}
                      </Typography>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.85rem' }}>
                        {typeof v === 'boolean' ? (v ? 'Ja' : 'Nei') : String(v)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <TextField
                fullWidth
                size="small"
                label="Begrunnelse (valgfri — lagres i audit-log)"
                value={pauseDialogReason}
                onChange={(e) => setPauseDialogReason(e.target.value)}
                multiline
                minRows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.4, gap: 1, flexWrap: 'wrap' }}>
            <Button
              onClick={() => { setPauseDialog(null); setPauseDialogReason(''); }}
              disabled={busy}
              sx={{ color: palette.textMuted, textTransform: 'none' }}
            >
              Avbryt
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              startIcon={<PauseCircleOutlineIcon />}
              onClick={() => { void pauseDialog.onPauseInstead(); setPauseDialogReason(''); }}
              disabled={busy}
              sx={{
                textTransform: 'none', fontWeight: 700, px: 2.4, borderRadius: radius.sm,
                bgcolor: '#fb923c', color: '#1c1917',
                '&:hover': { bgcolor: '#ea580c' },
              }}
            >
              Pause i stedet (anbefalt)
            </Button>
            <Button
              startIcon={<LockOutlinedIcon />}
              onClick={() => { void pauseDialog.onConfirm(pauseDialogReason); setPauseDialogReason(''); }}
              disabled={busy}
              sx={{
                textTransform: 'none', fontWeight: 600, px: 2,
                color: '#f87171', border: '1px solid #f87171',
                '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
              }}
            >
              Avslutt likevel
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
}

function humanizeKey(k: string): string {
  return k
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (s) => s.toUpperCase())
    .replace('Will', 'vil')
    .replace('Be', 'bli');
}

// ── Availability-fanen ─────────────────────────────────────────────
// ── Oversikts-fane (Phase 9.7) ────────────────────────────────────
function OverviewTab(props: {
  dashboard: AgencyDashboard | null;
  availability: AvailabilityStatus | null;
  onJumpTab: (t: 'overview' | 'availability' | 'mine' | 'incoming') => void;
}) {
  const { dashboard, availability } = props;
  if (!dashboard) {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center' }}>
        <Typography sx={{ color: palette.textMuted }}>
          Dashboard ikke tilgjengelig. Slå på discoverability for å begynne å samle data.
        </Typography>
      </Box>
    );
  }
  const stateBadge = availability ? STATE_BADGE[availability.state] : null;
  const KPI = ({ label, value, color, onClick, tooltip }: {
    label: string;
    value: number | string;
    color?: string;
    onClick?: () => void;
    tooltip?: string;
  }) => (
    <Tooltip title={tooltip ?? ''} arrow placement="top" enterDelay={500}>
      <Box
        onClick={onClick}
        sx={{
          ...cardSx,
          p: 1.8,
          textAlign: 'center',
          flex: 1,
          minWidth: 120,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'border-color 0.18s, transform 0.18s',
          '&:hover': onClick ? {
            borderColor: palette.accentBright,
            transform: 'translateY(-2px)',
          } : undefined,
        }}
      >
        <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: color ?? palette.textPrimary, lineHeight: 1 }}>
          {value}
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );

  // Smart "Hva nå?"-anbefaling basert på dashboard-state. Velger den
  // viktigste handlingen brukeren bør gjøre nest, basert på prioritert
  // hierarki: pending invitasjoner > akseptere partnerships > foreslå
  // talenter > inngenting.
  const nextActionHint = (() => {
    const inv = dashboard.project_invitations;
    const pa = dashboard.partnerships;
    const tp = dashboard.talent_proposals;
    if (inv.pending > 0) {
      return {
        text: `Du har ${inv.pending} prosjekt-invitasjon${inv.pending > 1 ? 'er' : ''} som venter svar`,
        cta: 'Åpne Innkommende',
        action: () => props.onJumpTab('incoming'),
      };
    }
    if (pa.pending > 0) {
      return {
        text: `Du har ${pa.pending} partnership-forespørsel${pa.pending > 1 ? 'er' : ''} som venter svar`,
        cta: 'Åpne Mine partnerships',
        action: () => props.onJumpTab('mine'),
      };
    }
    if (inv.accepted > 0 && tp.pending === 0 && tp.accepted === 0) {
      return {
        text: `Du har ${inv.accepted} aktivt prosjekt — start med å foreslå talenter`,
        cta: 'Åpne Innkommende',
        action: () => props.onJumpTab('incoming'),
      };
    }
    if (availability?.state === 'disabled') {
      return {
        text: 'Slå på discoverability for å bli funnet av produksjonsselskaper',
        cta: 'Åpne Tilgjengelighet',
        action: () => props.onJumpTab('availability'),
      };
    }
    return null;
  })();
  return (
    <Stack spacing={2}>
      {/* "Hva nå?"-handling-kort — smart neste-handling basert på state */}
      {nextActionHint ? (
        <Box
          onClick={nextActionHint.action}
          sx={{
            ...cardSx,
            cursor: 'pointer',
            border: '1px solid rgba(168,85,247,0.42)',
            background: 'linear-gradient(135deg, rgba(168,85,247,0.10) 0%, rgba(217,70,239,0.06) 100%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            transition: 'transform 0.18s, border-color 0.18s',
            '&:hover': {
              borderColor: palette.accentBright,
              transform: 'translateY(-2px)',
            },
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(168,85,247,0.18)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <HandshakeOutlinedIcon sx={{ color: palette.accentBright }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Neste handling
            </Typography>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.0rem', mt: 0.2 }}>
              {nextActionHint.text}
            </Typography>
          </Box>
          <Button
            size="small"
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              background: palette.accentGradient,
              color: '#fff',
              px: 2,
              boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
              '&:hover': {
                background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
              },
            }}
          >
            {nextActionHint.cta} →
          </Button>
        </Box>
      ) : null}

      {/* Status-badge øverst */}
      {availability && stateBadge ? (
        <Box sx={{ ...cardSx, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Tilgjengelighets-status
            </Typography>
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem', mt: 0.4 }}>
              {availability.agency.name}
            </Typography>
          </Box>
          <Chip
            label={stateBadge.label}
            sx={{ bgcolor: stateBadge.bg, color: stateBadge.color, fontWeight: 700, borderRadius: radius.sm, cursor: 'pointer' }}
            onClick={() => props.onJumpTab('availability')}
          />
        </Box>
      ) : null}

      {/* Partnership-KPI-er — klikkbare hopper til Mine partnerships */}
      <Box>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1, letterSpacing: 0.4 }}>
          Partnerships
        </Typography>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
          <KPI
            label="Aktive"
            value={dashboard.partnerships.active}
            color="#34d399"
            tooltip="Akseptert + ikke pauset eller avsluttet"
            onClick={() => props.onJumpTab('mine')}
          />
          <KPI
            label="Venter svar"
            value={dashboard.partnerships.pending}
            color="#fbbf24"
            tooltip="Forslag som ikke er besvart av motparten"
            onClick={() => props.onJumpTab('mine')}
          />
          <KPI
            label="Pauset"
            value={dashboard.partnerships.paused}
            color="#fb923c"
            tooltip="Akseptert men midlertidig pauset — nye invitasjoner blokkeres"
            onClick={() => props.onJumpTab('mine')}
          />
          <KPI
            label="Avsluttet"
            value={dashboard.partnerships.revoked}
            color="#9ca3af"
            tooltip="Revokert av enten byrå eller produksjon"
            onClick={() => props.onJumpTab('mine')}
          />
        </Stack>
      </Box>

      {/* Prosjekt-invitasjoner — klikkbare hopper til Innkommende */}
      <Box>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1, letterSpacing: 0.4 }}>
          Prosjekt-invitasjoner
        </Typography>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
          <KPI
            label="Venter svar"
            value={dashboard.project_invitations.pending}
            color="#fbbf24"
            tooltip="Prosjekter du må akseptere/avslå"
            onClick={() => props.onJumpTab('incoming')}
          />
          <KPI
            label="Aktive"
            value={dashboard.project_invitations.accepted}
            color="#34d399"
            tooltip="Prosjekter du jobber på nå — kan foreslå talenter"
            onClick={() => props.onJumpTab('incoming')}
          />
          <KPI
            label="Lukket"
            value={dashboard.project_invitations.closed}
            color="#9ca3af"
            tooltip="Avslått, revokert eller utløpt"
            onClick={() => props.onJumpTab('incoming')}
          />
        </Stack>
      </Box>

      {/* Talent-forslag */}
      <Box>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1, letterSpacing: 0.4 }}>
          Talent-forslag · akseptrate {dashboard.talent_proposals.accept_rate_percent ?? '—'}%
        </Typography>
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', gap: 1.2 }}>
          <KPI label="Venter" value={dashboard.talent_proposals.pending} color="#fbbf24" />
          <KPI label="Akseptert" value={dashboard.talent_proposals.accepted} color="#34d399" />
          <KPI label="Avslått" value={dashboard.talent_proposals.declined} color="#f87171" />
          <KPI label="Trukket" value={dashboard.talent_proposals.withdrawn} color="#9ca3af" />
        </Stack>
      </Box>

      {/* Talent-pool */}
      <Box sx={cardSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Byråets talent-pool
            </Typography>
            <Typography sx={{ color: palette.textPrimary, fontSize: '1.4rem', fontWeight: 800, mt: 0.4 }}>
              {dashboard.talent_pool_size} talenter med consent
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Siste aktivitet */}
      {dashboard.recent_activity.length > 0 ? (
        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1.4, letterSpacing: 0.4 }}>
            Siste aktivitet
          </Typography>
          <Stack spacing={0.8}>
            {dashboard.recent_activity.slice(0, 8).map((a, idx) => (
              <Stack key={idx} direction="row" alignItems="center" spacing={1} sx={{ fontSize: '0.85rem' }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 600, minWidth: 180 }}>
                  {humanizeAction(a.action)}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', flex: 1 }} noWrap>
                  {a.actor_name ?? 'System'}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>
                  {fmtDate(a.created_at)}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

function humanizeAction(action: string): string {
  const m: Record<string, string> = {
    proposed: 'Partnership foreslått',
    accepted: 'Partnership akseptert',
    declined: 'Partnership avslått',
    revoked: 'Partnership avsluttet',
    paused: 'Partnership pauset',
    unpaused: 'Partnership gjenopptatt',
    project_invited: 'Prosjekt-invitasjon mottatt',
    project_invitation_accepted: 'Prosjekt akseptert',
    project_invitation_declined: 'Prosjekt avslått',
    talent_proposed: 'Talent foreslått',
    talent_proposal_accepted: 'Talent-forslag akseptert',
    talent_proposal_declined: 'Talent-forslag avslått',
    talent_proposal_withdrawn: 'Talent-forslag trukket',
    candidate_status_changed: 'Kandidat-status endret',
  };
  return m[action] ?? action;
}

function AvailabilityTab(props: {
  status: AvailabilityStatus;
  busy: boolean;
  onAcceptTerms: () => Promise<void>;
  onEnable: () => Promise<void>;
  onPause: (reason?: string) => Promise<void>;
  onUnpause: () => Promise<void>;
  onClose: () => Promise<void>;
}) {
  const { status, busy } = props;
  const badge = STATE_BADGE[status.state];
  const [pauseReason, setPauseReason] = useState('');
  const [showPauseField, setShowPauseField] = useState(false);

  return (
    <Stack spacing={2}>
      {/* State-card */}
      <Box sx={cardSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary, fontSize: '1.1rem' }}>
              {status.agency.name}
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mt: 0.4 }}>
              Status for partnership-tilgjengelighet
            </Typography>
          </Box>
          <Chip
            label={badge.label}
            sx={{ bgcolor: badge.bg, color: badge.color, fontWeight: 700, borderRadius: radius.sm }}
          />
        </Stack>

        {/* Progress-stigen — viser hvilke steg som er gjort */}
        <Stack spacing={1}>
          <StepRow done={status.profile_complete} label="Profil komplett (logo + kontakt-e-post)" />
          <StepRow done={status.terms_accepted && status.terms_version_current} label={`Partnership-vilkår godtatt (v${CURRENT_PARTNERSHIP_TERMS_VERSION})`} />
          <StepRow done={status.enabled && !status.paused} label="Discoverability slått på" />
        </Stack>
      </Box>

      {/* Action-cards basert på state */}
      {status.state === 'closed' ? (
        <Alert severity="error" icon={<LockOutlinedIcon />}>
          Byrået ble stengt {fmtDate(status.closed_at)}. Kontakt support for å gjenåpne.
        </Alert>
      ) : null}

      {status.state === 'needs_profile' ? (
        <Alert severity="warning">
          Fullfør byrå-profilen (logo + kontakt-e-post) før du går videre.
          Du kan redigere profil i instillinger.
        </Alert>
      ) : null}

      {(status.state === 'needs_terms' || status.state === 'needs_terms_update') ? (
        <Box sx={cardSx}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
            <GavelOutlinedIcon sx={{ color: '#fbbf24' }} />
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
              Godta partnership-vilkårene
            </Typography>
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', mb: 1.4, lineHeight: 1.6 }}>
            Du må godta gjeldende vilkår (versjon {CURRENT_PARTNERSHIP_TERMS_VERSION}) før byrået kan inngå partnerships
            med produksjonsselskaper. Vilkårene regulerer dataflyt, oppsigelsesrett og
            ansvar for talent-consent.
            {' '}
            <Box component="a" href="/legal/partnership-terms" sx={{ color: palette.accentBright }}>Les vilkårene</Box>.
          </Typography>
          <Button
            disabled={busy}
            onClick={() => void props.onAcceptTerms()}
            sx={primaryBtnSx}
          >
            Godta vilkår v{CURRENT_PARTNERSHIP_TERMS_VERSION}
          </Button>
        </Box>
      ) : null}

      {status.state === 'disabled' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 700, color: palette.textPrimary, mb: 1 }}>
            Slå på discoverability
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', mb: 1.4, lineHeight: 1.6 }}>
            Når du slår på blir byrået synlig for produksjonsselskaper i Role Room. De kan
            da sende deg forespørsler om partnership. Du kan pause eller stenge når som helst.
          </Typography>
          <Button
            disabled={busy}
            onClick={() => void props.onEnable()}
            startIcon={<VisibilityOutlinedIcon />}
            sx={primaryBtnSx}
          >
            Slå på
          </Button>
        </Box>
      ) : null}

      {status.state === 'paused' ? (
        <Box sx={cardSx}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <PauseCircleOutlineIcon sx={{ color: '#fb923c' }} />
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>Pauset siden {fmtDate(status.paused_at)}</Typography>
          </Stack>
          {status.paused_reason ? (
            <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 1.4 }}>
              «{status.paused_reason}»
            </Typography>
          ) : null}
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 1.4, lineHeight: 1.6 }}>
            Eksisterende partnerships fortsetter. Nye forespørsler og prosjekt-invitasjoner blokkeres.
          </Typography>
          <Button
            disabled={busy}
            onClick={() => void props.onUnpause()}
            startIcon={<PlayCircleOutlineIcon />}
            sx={primaryBtnSx}
          >
            Gjenoppta
          </Button>
        </Box>
      ) : null}

      {status.state === 'active' ? (
        <Box sx={cardSx}>
          <Typography sx={{ fontWeight: 700, color: palette.textPrimary, mb: 1 }}>
            Pause midlertidig
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', mb: 1.4, lineHeight: 1.6 }}>
            Pause blokkerer nye partnership-forespørsler og prosjekt-invitasjoner uten å avslutte
            eksisterende samarbeid. Bruk dette hvis dere har full kapasitet eller skal være borte en periode.
          </Typography>
          {showPauseField ? (
            <Stack spacing={1.2}>
              <TextField
                size="small"
                fullWidth
                placeholder="Begrunnelse (valgfri)"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
                multiline
                minRows={2}
              />
              <Stack direction="row" spacing={1}>
                <Button disabled={busy} onClick={() => { setShowPauseField(false); setPauseReason(''); }} sx={secondaryBtnSx}>
                  Avbryt
                </Button>
                <Button
                  disabled={busy}
                  onClick={async () => { await props.onPause(pauseReason || undefined); setShowPauseField(false); setPauseReason(''); }}
                  startIcon={<PauseCircleOutlineIcon />}
                  sx={primaryBtnSx}
                >
                  Pause nå
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Button
              disabled={busy}
              onClick={() => setShowPauseField(true)}
              startIcon={<PauseCircleOutlineIcon />}
              sx={{ ...primaryBtnSx, bgcolor: '#fb923c', color: '#1c1917', '&:hover': { bgcolor: '#ea580c' } }}
            >
              Pause
            </Button>
          )}
        </Box>
      ) : null}

      {/* Steng-card — bare synlig hvis ikke allerede stengt */}
      {status.state !== 'closed' && status.profile_complete ? (
        <Box sx={{ ...cardSx, borderColor: '#f87171' }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1 }}>
            <LockOutlinedIcon sx={{ color: '#f87171' }} />
            <Typography sx={{ fontWeight: 700, color: '#f87171' }}>Stenge permanent</Typography>
          </Stack>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 1.4, lineHeight: 1.6 }}>
            Revoker ALLE partnerships og prosjekt-invitasjoner umiddelbart. Talentene dine forsvinner
            fra produksjonsselskapenes registre. Kan kun gjenåpnes av support.
            Vi anbefaler pause i stedet — alle relasjoner beholdes.
          </Typography>
          <Button
            disabled={busy}
            onClick={() => void props.onClose()}
            startIcon={<LockOutlinedIcon />}
            sx={{
              textTransform: 'none', fontWeight: 600, px: 2, py: 1, borderRadius: radius.sm,
              color: '#f87171', border: '1px solid #f87171',
              '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
            }}
          >
            Stenge…
          </Button>
        </Box>
      ) : null}
    </Stack>
  );
}

// ── Mine partnerships-fanen ────────────────────────────────────────
function MinePartnershipsTab(props: {
  partnerships: Partnership[];
  busy: boolean;
  onRespond: (id: string, accept: boolean) => Promise<void>;
  onPause: (id: string) => Promise<void>;
  onUnpause: (id: string) => Promise<void>;
  onRevoke: (p: Partnership) => Promise<void>;
}) {
  if (props.partnerships.length === 0) {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center', py: 5 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'rgba(168,85,247,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <HandshakeOutlinedIcon sx={{ fontSize: 32, color: palette.accentBright }} />
        </Box>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem', mb: 0.6 }}>
          Ingen partnerships ennå
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', maxWidth: 380, mx: 'auto' }}>
          Slå på discoverability i Tilgjengelighets-fanen for å bli funnet av produksjonsselskaper.
        </Typography>
      </Box>
    );
  }
  return (
    <Stack spacing={1.2}>
      {props.partnerships.map((p) => {
        const badge = STATUS_BADGE[p.status];
        const isPaused = !!p.paused_at;
        return (
          <Box key={p.id} sx={cardSx}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
                  {p.production_name || 'Produksjonsteam'}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                  {p.production_email}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.8}>
                {isPaused ? (
                  <Chip
                    size="small"
                    label="Pauset"
                    sx={{ bgcolor: 'rgba(251,146,60,0.15)', color: '#fb923c', fontWeight: 700 }}
                  />
                ) : null}
                <Chip
                  size="small"
                  label={badge.label}
                  sx={{ bgcolor: badge.bg, color: badge.color, fontWeight: 700 }}
                />
              </Stack>
            </Stack>

            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1.4 }}>
              Foreslått {fmtDate(p.proposed_at)} av {p.proposed_by === 'agency' ? 'byrået' : 'produksjon'}.
              {p.responded_at ? ` Svart ${fmtDate(p.responded_at)}.` : ''}
              {p.message ? ` Melding: «${p.message}»` : ''}
            </Typography>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {p.status === 'pending' && p.proposed_by === 'production' ? (
                <>
                  <Button
                    size="small"
                    disabled={props.busy}
                    onClick={() => void props.onRespond(p.id, true)}
                    startIcon={<CheckCircleOutlineIcon />}
                    sx={primaryBtnSx}
                  >
                    Aksepter
                  </Button>
                  <Button
                    size="small"
                    disabled={props.busy}
                    onClick={() => void props.onRespond(p.id, false)}
                    startIcon={<CancelOutlinedIcon />}
                    sx={secondaryBtnSx}
                  >
                    Avslå
                  </Button>
                </>
              ) : null}
              {p.status === 'accepted' && !isPaused ? (
                <Button
                  size="small"
                  disabled={props.busy}
                  onClick={() => void props.onPause(p.id)}
                  startIcon={<PauseCircleOutlineIcon />}
                  sx={secondaryBtnSx}
                >
                  Pause
                </Button>
              ) : null}
              {p.status === 'accepted' && isPaused ? (
                <Button
                  size="small"
                  disabled={props.busy}
                  onClick={() => void props.onUnpause(p.id)}
                  startIcon={<PlayCircleOutlineIcon />}
                  sx={primaryBtnSx}
                >
                  Gjenoppta
                </Button>
              ) : null}
              {p.status === 'accepted' || p.status === 'pending' ? (
                <Button
                  size="small"
                  disabled={props.busy}
                  onClick={() => void props.onRevoke(p)}
                  startIcon={<LockOutlinedIcon />}
                  sx={dangerBtnSx}
                >
                  Avslutt
                </Button>
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}

// ── Innkommende invitasjoner ───────────────────────────────────────
function IncomingInvitationsTab(props: {
  invitations: ProjectInvitation[];
  busy: boolean;
  onRespond: (invId: string, accept: boolean) => Promise<void>;
  onProposeTalents: (inv: ProjectInvitation) => void;
}) {
  if (props.invitations.length === 0) {
    return (
      <Box sx={{ ...cardSx, textAlign: 'center', py: 5 }}>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: 'rgba(168,85,247,0.12)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 32, color: palette.accentBright }} />
        </Box>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1.05rem', mb: 0.6 }}>
          Ingen prosjekt-invitasjoner ennå
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', maxWidth: 380, mx: 'auto' }}>
          Når produksjonsselskaper inviterer byrået ditt til et casting-prosjekt, dukker invitasjonen opp her.
        </Typography>
      </Box>
    );
  }
  const pending = props.invitations.filter((i) => i.status === 'pending');
  const accepted = props.invitations.filter((i) => i.status === 'accepted');
  return (
    <Stack spacing={2}>
      {pending.length > 0 ? (
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1, letterSpacing: 0.4 }}>
            Venter på svar ({pending.length})
          </Typography>
          <Stack spacing={1.2}>
            {pending.map((i) => (
              <Box key={i.id} sx={cardSx}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: palette.textPrimary, fontSize: '1.05rem' }}>
                      {i.project_name}
                    </Typography>
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                      {i.project_type} · {fmtDate(i.start_date)} → {fmtDate(i.end_date)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={`Utløper ${fmtDate(i.expires_at)}`}
                    sx={{ bgcolor: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 700 }}
                  />
                </Stack>
                {i.notes ? (
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1.2 }}>
                    «{i.notes}»
                  </Typography>
                ) : null}
                {Array.isArray(i.role_ids) && i.role_ids.length > 0 ? (
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1.2 }}>
                    {i.role_ids.length} valgte roller å foreslå talenter til
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <Button size="small" disabled={props.busy} onClick={() => void props.onRespond(i.id, true)} startIcon={<CheckCircleOutlineIcon />} sx={primaryBtnSx}>
                    Aksepter
                  </Button>
                  <Button size="small" disabled={props.busy} onClick={() => void props.onRespond(i.id, false)} startIcon={<CancelOutlinedIcon />} sx={secondaryBtnSx}>
                    Avslå
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}

      {accepted.length > 0 ? (
        <Box>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', mb: 1, letterSpacing: 0.4 }}>
            Aktive prosjekter — du kan foreslå talenter ({accepted.length})
          </Typography>
          <Stack spacing={1.2}>
            {accepted.map((i) => (
              <Box key={i.id} sx={{ ...cardSx, borderColor: 'rgba(52,211,153,0.32)' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700, color: palette.textPrimary, fontSize: '1.05rem' }}>
                      {i.project_name}
                    </Typography>
                    <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                      {i.project_type} · {fmtDate(i.start_date)} → {fmtDate(i.end_date)}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    icon={<CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                    label="Aktiv"
                    sx={{
                      bgcolor: 'rgba(52,211,153,0.16)',
                      color: '#34d399',
                      fontWeight: 700,
                      '& .MuiChip-icon': { color: '#34d399' },
                    }}
                  />
                </Stack>
                {Array.isArray(i.role_ids) && i.role_ids.length > 0 ? (
                  <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mb: 1.2 }}>
                    {i.role_ids.length} valgte roller å foreslå talenter til
                  </Typography>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    onClick={() => props.onProposeTalents(i)}
                    startIcon={<HandshakeOutlinedIcon />}
                    sx={primaryBtnSx}
                  >
                    Foreslå talenter
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}

// ── Step-row + button-styles ───────────────────────────────────────
function StepRow({ done, label }: { done: boolean; label: string }) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          bgcolor: done ? 'rgba(52,211,153,0.15)' : 'rgba(156,163,175,0.15)',
          border: `1px solid ${done ? '#34d399' : palette.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? <CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#34d399' }} /> : null}
      </Box>
      <Typography sx={{ color: done ? palette.textPrimary : palette.textMuted, fontSize: '0.9rem' }}>
        {label}
      </Typography>
    </Stack>
  );
}

const primaryBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 700,
  px: 2,
  py: 1,
  borderRadius: radius.sm,
  bgcolor: palette.accentBright,
  color: '#0c0a09',
  '&:hover': { bgcolor: palette.accent },
};
const secondaryBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 600,
  px: 2,
  py: 1,
  borderRadius: radius.sm,
  color: palette.textPrimary,
  border: `1px solid ${palette.borderStrong}`,
  '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
};
const dangerBtnSx = {
  textTransform: 'none' as const,
  fontWeight: 600,
  px: 2,
  py: 1,
  borderRadius: radius.sm,
  color: '#f87171',
  border: '1px solid #f87171',
  '&:hover': { bgcolor: 'rgba(248,113,113,0.1)' },
};
