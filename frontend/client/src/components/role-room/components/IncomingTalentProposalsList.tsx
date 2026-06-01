/**
 * IncomingTalentProposalsList.tsx
 *
 * Produksjon-siden av talent-foreslåelse-flyten. Plasseres i
 * CastingPlannerPanel Kandidater-tab (under AgencyPartnershipPicker) og
 * viser alle talent-forslag fra byråer for det aktive prosjektet på tvers
 * av invitasjoner.
 *
 * Per forslag: vis talent + byrå-kontekst + rolle (hvis valgt) + status.
 * Pending forslag: Aksepter/Avslå med valgfri tilbakemelding.
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useCallback, useEffect, useState } from 'react';

import {
  incomingTalentProposalsForProject,
  respondToTalentProposal,
  type TalentProposal,
} from '../services/roleRoomPartnershipsService';

interface Props {
  castingProjectId: string;
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
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.16)',
};

function ageLine(p: TalentProposal): string {
  const lo = p.playing_age_min;
  const hi = p.playing_age_max;
  if (lo && hi) return `Spille-alder ${lo}–${hi}`;
  if (lo) return `Spille-alder fra ${lo}`;
  if (hi) return `Spille-alder opp til ${hi}`;
  return '';
}

const STATUS_BADGE: Record<TalentProposal['status'], { label: string; color: string; bg: string; Icon: React.ComponentType<{ sx?: object }> }> = {
  pending: { label: 'Avventer svar', color: COLORS.warn, bg: COLORS.warnBg, Icon: HourglassEmptyOutlinedIcon },
  accepted: { label: 'Akseptert', color: COLORS.success, bg: COLORS.successBg, Icon: CheckCircleOutlineIcon },
  declined: { label: 'Avslått', color: COLORS.danger, bg: COLORS.dangerBg, Icon: CancelOutlinedIcon },
  withdrawn: { label: 'Trukket', color: '#9ca3af', bg: 'rgba(156,163,175,0.18)', Icon: RemoveCircleOutlineIcon },
};

export default function IncomingTalentProposalsList({ castingProjectId }: Props) {
  const [proposals, setProposals] = useState<TalentProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Respons-dialog (Aksepter eller Avslå)
  const [responseTarget, setResponseTarget] = useState<{ proposal: TalentProposal; accept: boolean } | null>(null);
  const [productionNotes, setProductionNotes] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await incomingTalentProposalsForProject(castingProjectId);
      setProposals(r.proposals);
    } catch (e) {
      // 403 hvis ikke prosjekt-eier — det er forventet for ikke-eiere
      setError(e instanceof Error ? e.message : 'Klarte ikke å hente forslag');
    } finally {
      setLoading(false);
    }
  }, [castingProjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRespond = useCallback(async () => {
    if (!responseTarget) return;
    setBusy(true);
    setError(null);
    try {
      await respondToTalentProposal(responseTarget.proposal.id, responseTarget.accept, productionNotes || undefined);
      setInfo(
        responseTarget.accept
          ? `${responseTarget.proposal.display_name} akseptert.`
          : `${responseTarget.proposal.display_name} avslått.`,
      );
      setResponseTarget(null);
      setProductionNotes('');
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke svare');
    } finally {
      setBusy(false);
    }
  }, [responseTarget, productionNotes, reload]);

  if (loading && proposals.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <CircularProgress size={20} sx={{ color: COLORS.accent }} />
      </Box>
    );
  }

  // Ikke vis hele blokken hvis ingen forslag (sparer plass)
  if (!loading && proposals.length === 0) return null;

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

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
        <Box>
          <Typography sx={{ color: '#e0f2fe', fontWeight: 700, fontSize: '0.95rem' }}>
            Talent-forslag fra byråer ({pendingCount} venter svar)
          </Typography>
          <Typography sx={{ color: 'rgba(186,230,253,0.78)', fontSize: '0.8rem' }}>
            Bryåer som har akseptert prosjekt-invitasjon foreslår talenter til rollene
          </Typography>
        </Box>
      </Stack>

      {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}
      {info ? <Alert severity="success" onClose={() => setInfo(null)} sx={{ mb: 1.4 }}>{info}</Alert> : null}

      <Stack spacing={1}>
        {proposals.map((p) => {
          const badge = STATUS_BADGE[p.status];
          const IconC = badge.Icon;
          return (
            <Box
              key={p.id}
              sx={{
                p: 1.4,
                borderRadius: 2,
                border: '1px solid rgba(56,189,248,0.22)',
                bgcolor: 'rgba(2,6,23,0.5)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.4} sx={{ flexWrap: 'wrap', gap: 1 }}>
                <Avatar src={p.headshot_url ?? undefined} sx={{ width: 48, height: 48, bgcolor: '#0f172a', border: `1px solid ${COLORS.cardBorder}` }}>
                  {p.display_name?.charAt(0) ?? '?'}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Typography sx={{ color: '#f0f9ff', fontWeight: 700 }}>{p.display_name}</Typography>
                  <Typography sx={{ color: 'rgba(186,230,253,0.78)', fontSize: '0.78rem' }}>
                    {[p.city, ageLine(p), p.gender].filter(Boolean).join(' · ')}
                  </Typography>
                  <Stack direction="row" spacing={0.6} sx={{ mt: 0.4, flexWrap: 'wrap', gap: 0.4 }}>
                    {p.agency_name ? (
                      <Chip
                        size="small"
                        avatar={
                          p.agency_logo_url ? (
                            <Avatar src={p.agency_logo_url} sx={{ width: 18, height: 18, bgcolor: '#0f172a' }}>
                              {p.agency_name.charAt(0)}
                            </Avatar>
                          ) : undefined
                        }
                        label={`fra ${p.agency_name}`}
                        sx={{ bgcolor: COLORS.accentBg, color: COLORS.accent, fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                      />
                    ) : null}
                    {p.role_name ? (
                      <Chip
                        size="small"
                        label={`Rolle: ${p.role_name}`}
                        sx={{ bgcolor: 'rgba(168,85,247,0.16)', color: '#c4b5fd', fontWeight: 600, fontSize: '0.7rem', height: 22 }}
                      />
                    ) : null}
                  </Stack>
                </Box>
                <Chip
                  size="small"
                  icon={<IconC sx={{ fontSize: 14 }} />}
                  label={badge.label}
                  sx={{
                    bgcolor: badge.bg,
                    color: badge.color,
                    fontWeight: 700,
                    '& .MuiChip-icon': { color: badge.color },
                  }}
                />
              </Stack>
              {p.agency_notes ? (
                <Typography sx={{ color: 'rgba(186,230,253,0.78)', fontSize: '0.78rem', mt: 1, fontStyle: 'italic', pl: 7 }}>
                  Bryåets kommentar: «{p.agency_notes}»
                </Typography>
              ) : null}
              {p.production_notes ? (
                <Typography sx={{ color: '#c4b5fd', fontSize: '0.78rem', mt: 0.6, pl: 7 }}>
                  Din tilbakemelding: «{p.production_notes}»
                </Typography>
              ) : null}
              {p.status === 'pending' ? (
                <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => { setResponseTarget({ proposal: p, accept: false }); setProductionNotes(''); }}
                    startIcon={<CancelOutlinedIcon />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      color: 'rgba(186,230,253,0.85)',
                      border: '1px solid rgba(186,230,253,0.32)',
                      '&:hover': { bgcolor: 'rgba(248,113,113,0.08)', color: '#fda4af' },
                    }}
                  >
                    Avslå
                  </Button>
                  <Button
                    size="small"
                    disabled={busy}
                    onClick={() => { setResponseTarget({ proposal: p, accept: true }); setProductionNotes(''); }}
                    startIcon={<CheckCircleOutlineIcon />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: COLORS.accent,
                      color: '#0f172a',
                      '&:hover': { bgcolor: '#0ea5e9' },
                    }}
                  >
                    Aksepter
                  </Button>
                </Stack>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      {responseTarget ? (
        <Dialog
          open
          onClose={() => !busy && setResponseTarget(null)}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.95)', color: '#e0f2fe', border: `1px solid ${responseTarget.accept ? COLORS.success : COLORS.danger}` } }}
        >
          <DialogTitle sx={{ fontWeight: 800 }}>
            {responseTarget.accept ? 'Aksepter' : 'Avslå'} {responseTarget.proposal.display_name}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity={responseTarget.accept ? 'success' : 'warning'}>
                {responseTarget.accept
                  ? 'Bryået varsles og talenten kan følges opp i prosjektet.'
                  : 'Bryået får beskjed om at talenten ikke er valgt denne gangen.'}
              </Alert>
              <TextField
                fullWidth
                size="small"
                label="Tilbakemelding til byrået (valgfri)"
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                multiline
                minRows={3}
                placeholder={
                  responseTarget.accept
                    ? 'F.eks. «Setter opp self-tape-økt i uke 24»'
                    : 'F.eks. «Vi går for en eldre profil til denne rollen»'
                }
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.4 }}>
            <Button onClick={() => setResponseTarget(null)} disabled={busy} sx={{ textTransform: 'none', color: 'rgba(186,230,253,0.8)' }}>
              Avbryt
            </Button>
            <Button
              onClick={() => void handleRespond()}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={14} /> : responseTarget.accept ? <CheckCircleOutlineIcon /> : <CancelOutlinedIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: responseTarget.accept ? COLORS.success : COLORS.danger,
                color: '#0f172a',
                '&:hover': { bgcolor: responseTarget.accept ? '#10b981' : '#ef4444' },
              }}
            >
              {responseTarget.accept ? 'Aksepter forslag' : 'Avslå forslag'}
            </Button>
          </DialogActions>
        </Dialog>
      ) : null}
    </Box>
  );
}
