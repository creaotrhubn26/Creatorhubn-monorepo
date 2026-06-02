/**
 * ProposeTalentsDialog.tsx
 *
 * Bryå-siden av talent-foreslåelse-flyten. Brukes fra
 * AgencyPartnershipsPage når byrå-admin klikker "Foreslå talenter" på en
 * akseptert prosjekt-invitasjon.
 *
 * To-pane:
 *   1. Søk + liste over proposable talenter (fra byråets eget register)
 *      med "Foreslå"-knapp per talent
 *   2. Mine forslag (med status + trekke-knapp på pending)
 *
 * Backend: roleRoomPartnershipsService.proposableTalents,
 * proposeTalent, listTalentProposals, withdrawTalentProposal.
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
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import HandshakeOutlinedIcon from '@mui/icons-material/HandshakeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { palette, radius } from '../theme';
import {
  listTalentProposals,
  proposableTalents,
  proposeTalent,
  withdrawTalentProposal,
  type ProposableTalent,
  type TalentProposal,
} from '../../services/roleRoomPartnershipsService';

interface Props {
  open: boolean;
  invitationId: string;
  projectName: string;
  onClose: () => void;
  /** Roller produksjon har valgt i invitasjonen — viser navn ved foreslåelse. */
  roleIds?: string[] | null;
}

const STATUS_BADGE: Record<TalentProposal['status'], { label: string; color: string; bg: string }> = {
  pending: { label: 'Venter', color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' },
  accepted: { label: 'Akseptert', color: '#34d399', bg: 'rgba(52,211,153,0.16)' },
  declined: { label: 'Avslått', color: '#f87171', bg: 'rgba(248,113,113,0.16)' },
  withdrawn: { label: 'Trukket', color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
};

function ageLine(t: ProposableTalent | TalentProposal): string {
  const lo = t.playing_age_min;
  const hi = t.playing_age_max;
  if (lo && hi) return `Spille-alder ${lo}–${hi}`;
  if (lo) return `Spille-alder fra ${lo}`;
  if (hi) return `Spille-alder opp til ${hi}`;
  return '';
}

export default function ProposeTalentsDialog({ open, invitationId, projectName, onClose }: Props) {
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [q, setQ] = useState('');
  const [talents, setTalents] = useState<ProposableTalent[]>([]);
  const [proposals, setProposals] = useState<TalentProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Per-talent: åpne foreslåelse-dialog med notes-felt
  const [pendingTalent, setPendingTalent] = useState<ProposableTalent | null>(null);
  const [agencyNotes, setAgencyNotes] = useState('');

  // Bulk-select (Phase 9.8)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkNotes, setBulkNotes] = useState('');

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const loadTalents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await proposableTalents(invitationId, q || undefined);
      setTalents(r.talents);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke hente talenter');
    } finally {
      setLoading(false);
    }
  }, [invitationId, q]);

  const loadProposals = useCallback(async () => {
    try {
      const r = await listTalentProposals(invitationId);
      setProposals(r.proposals);
    } catch (e) {
      console.error('list proposals failed', e);
    }
  }, [invitationId]);

  useEffect(() => {
    if (!open) return;
    if (tab === 'discover') void loadTalents();
    else void loadProposals();
  }, [open, tab, loadTalents, loadProposals]);

  // Debounce på q
  useEffect(() => {
    if (!open || tab !== 'discover') return;
    const id = setTimeout(() => void loadTalents(), 250);
    return () => clearTimeout(id);
  }, [q, open, tab, loadTalents]);

  // Initial load av begge — så badge på fanen er korrekt
  useEffect(() => {
    if (open) void loadProposals();
  }, [open, loadProposals]);

  const handlePropose = useCallback(async () => {
    if (!pendingTalent) return;
    setBusy(true);
    setError(null);
    try {
      await proposeTalent(invitationId, {
        talent_id: pendingTalent.id,
        agency_notes: agencyNotes || undefined,
      });
      setInfo(`${pendingTalent.display_name} er foreslått.`);
      setPendingTalent(null);
      setAgencyNotes('');
      await Promise.all([loadTalents(), loadProposals()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke foreslå');
    } finally {
      setBusy(false);
    }
  }, [pendingTalent, invitationId, agencyNotes, loadTalents, loadProposals]);

  const handleBulkPropose = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { bulkProposeTalents } = await import('../../services/roleRoomPartnershipsService');
      const result = await bulkProposeTalents(invitationId, {
        talent_ids: Array.from(selectedIds),
        agency_notes: bulkNotes || undefined,
      });
      const failedMsg = result.failed > 0 ? ` (${result.failed} kunne ikke foreslås)` : '';
      setInfo(`${result.succeeded} talenter foreslått${failedMsg}.`);
      setSelectedIds(new Set());
      setBulkDialogOpen(false);
      setBulkNotes('');
      await Promise.all([loadTalents(), loadProposals()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk-foreslåelse feilet');
    } finally {
      setBusy(false);
    }
  }, [selectedIds, invitationId, bulkNotes, loadTalents, loadProposals]);

  const handleWithdraw = useCallback(async (proposalId: string) => {
    setBusy(true);
    setError(null);
    try {
      await withdrawTalentProposal(proposalId);
      setInfo('Forslag trukket.');
      await Promise.all([loadProposals(), loadTalents()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke trekke forslag');
    } finally {
      setBusy(false);
    }
  }, [loadProposals, loadTalents]);

  const pendingCount = useMemo(
    () => proposals.filter((p) => p.status === 'pending').length,
    [proposals],
  );

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: palette.bgCard,
          color: palette.textPrimary,
          border: `1px solid ${palette.border}`,
          borderRadius: radius.lg,
          minHeight: 600,
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <HandshakeOutlinedIcon sx={{ color: palette.accentBright }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Foreslå talenter</Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
              Til {projectName}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} disabled={busy} sx={{ color: palette.textPrimary }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.4 }}>{error}</Alert> : null}
        {info ? <Alert severity="success" onClose={() => setInfo(null)} sx={{ mb: 1.4 }}>{info}</Alert> : null}

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
        >
          <Tab value="discover" label="Finn talent" />
          <Tab value="mine" label={`Mine forslag${pendingCount > 0 ? ` (${pendingCount})` : ''}`} />
        </Tabs>

        {tab === 'discover' ? (
          <Stack spacing={1.4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Søk talenter i ditt register…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: palette.accentBright, fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
            />
            {loading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : talents.length === 0 ? (
              <Typography sx={{ color: palette.textMuted, textAlign: 'center', py: 4 }}>
                Ingen talenter funnet. Bare talenter som har gitt byrået ditt aktiv consent vises.
              </Typography>
            ) : (
              <>
                {selectedIds.size > 0 ? (
                  <Box
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: `1px solid ${palette.accentBright}`,
                      bgcolor: 'rgba(168,85,247,0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1.4,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
                      {selectedIds.size} valgte talenter
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => setSelectedIds(new Set())}
                        sx={{ textTransform: 'none', color: palette.textMuted }}
                      >
                        Fjern valg
                      </Button>
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() => { setBulkDialogOpen(true); setBulkNotes(''); }}
                        startIcon={<HandshakeOutlinedIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          bgcolor: palette.accentBright,
                          color: '#0c0a09',
                          '&:hover': { bgcolor: palette.accent },
                        }}
                      >
                        Foreslå alle valgte
                      </Button>
                    </Stack>
                  </Box>
                ) : null}
                <Stack spacing={0.8}>
                  {talents.map((t) => {
                    const isSelected = selectedIds.has(t.id);
                    return (
                      <Box
                        key={t.id}
                        sx={{
                          p: 1.4,
                          borderRadius: 2,
                          border: `1px solid ${isSelected ? palette.accentBright : palette.border}`,
                          bgcolor: isSelected ? 'rgba(168,85,247,0.08)' : 'rgba(0,0,0,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.4,
                          cursor: t.already_proposed ? 'default' : 'pointer',
                        }}
                        onClick={() => { if (!t.already_proposed) toggleSelected(t.id); }}
                      >
                        {!t.already_proposed ? (
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: 0.6,
                              border: `1.5px solid ${isSelected ? palette.accentBright : palette.borderStrong}`,
                              bgcolor: isSelected ? palette.accentBright : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {isSelected ? <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#0c0a09' }} /> : null}
                          </Box>
                        ) : (
                          <Box sx={{ width: 22, flexShrink: 0 }} />
                        )}
                        <Avatar src={t.headshot_url ?? undefined} sx={{ width: 44, height: 44 }}>
                          {t.display_name?.charAt(0) ?? '?'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
                            {t.display_name}
                          </Typography>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                            {[t.city, ageLine(t), t.gender].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        {t.already_proposed ? (
                          <Chip
                            size="small"
                            label="Allerede foreslått"
                            sx={{ bgcolor: 'rgba(156,163,175,0.18)', color: '#9ca3af', fontWeight: 600 }}
                          />
                        ) : (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); setPendingTalent(t); setAgencyNotes(''); }}
                            startIcon={<HandshakeOutlinedIcon />}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              bgcolor: palette.accentBright,
                              color: '#0c0a09',
                              '&:hover': { bgcolor: palette.accent },
                            }}
                          >
                            Foreslå
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              </>
            )}
          </Stack>
        ) : null}

        {tab === 'mine' ? (
          <Stack spacing={1}>
            {proposals.length === 0 ? (
              <Typography sx={{ color: palette.textMuted, textAlign: 'center', py: 4 }}>
                Ingen forslag sendt ennå.
              </Typography>
            ) : (
              proposals.map((p) => {
                const badge = STATUS_BADGE[p.status];
                return (
                  <Box
                    key={p.id}
                    sx={{
                      p: 1.4,
                      borderRadius: 2,
                      border: `1px solid ${palette.border}`,
                      bgcolor: 'rgba(0,0,0,0.18)',
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1.4}>
                      <Avatar src={p.headshot_url ?? undefined} sx={{ width: 40, height: 40 }}>
                        {p.display_name?.charAt(0) ?? '?'}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
                          {p.display_name}
                        </Typography>
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                          {[p.city, ageLine(p), p.role_name].filter(Boolean).join(' · ')}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        icon={
                          p.status === 'pending' ? <HourglassEmptyOutlinedIcon sx={{ fontSize: 14 }} /> :
                          p.status === 'accepted' ? <CheckCircleOutlineIcon sx={{ fontSize: 14 }} /> :
                          p.status === 'declined' ? <CancelOutlinedIcon sx={{ fontSize: 14 }} /> :
                          <RemoveCircleOutlineIcon sx={{ fontSize: 14 }} />
                        }
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
                      <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 1, fontStyle: 'italic', pl: 7 }}>
                        Din kommentar: «{p.agency_notes}»
                      </Typography>
                    ) : null}
                    {p.production_notes ? (
                      <Typography sx={{ color: '#c4b5fd', fontSize: '0.78rem', mt: 0.8, pl: 7 }}>
                        Produksjon: «{p.production_notes}»
                      </Typography>
                    ) : null}
                    {p.status === 'pending' ? (
                      <Stack direction="row" justifyContent="flex-end" sx={{ mt: 0.8 }}>
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={() => void handleWithdraw(p.id)}
                          startIcon={<RemoveCircleOutlineIcon />}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            color: palette.textMuted,
                            '&:hover': { color: palette.textPrimary, bgcolor: 'rgba(255,255,255,0.04)' },
                          }}
                        >
                          Trekk
                        </Button>
                      </Stack>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Stack>
        ) : null}

        {/* Sub-dialog: bekreft + legg til notes per talent */}
        {pendingTalent ? (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${palette.border}` }}>
            <Divider sx={{ mb: 1.6 }} />
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary, mb: 1.2 }}>
              Foreslå {pendingTalent.display_name}
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Hvorfor passer denne talenten? (valgfri)"
              value={agencyNotes}
              onChange={(e) => setAgencyNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder="F.eks. 'Har tidligere spilt i lignende produksjon, snakker flytende fransk…'"
              sx={{ mb: 1.4 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                disabled={busy}
                onClick={() => { setPendingTalent(null); setAgencyNotes(''); }}
                sx={{ textTransform: 'none', color: palette.textMuted }}
              >
                Avbryt
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                disabled={busy}
                onClick={() => void handlePropose()}
                startIcon={busy ? <CircularProgress size={14} /> : <HandshakeOutlinedIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: palette.accentBright,
                  color: '#0c0a09',
                  '&:hover': { bgcolor: palette.accent },
                }}
              >
                Send forslag
              </Button>
            </Stack>
          </Box>
        ) : null}

        {/* Bulk-dialog */}
        {bulkDialogOpen ? (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${palette.border}` }}>
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary, mb: 1.2 }}>
              Foreslå {selectedIds.size} talenter
            </Typography>
            <TextField
              fullWidth
              size="small"
              label="Felles begrunnelse for alle (valgfri)"
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder="F.eks. 'Alle har spilt i lignende drama tidligere'"
              sx={{ mb: 1.4 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                disabled={busy}
                onClick={() => { setBulkDialogOpen(false); setBulkNotes(''); }}
                sx={{ textTransform: 'none', color: palette.textMuted }}
              >
                Avbryt
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                disabled={busy}
                onClick={() => void handleBulkPropose()}
                startIcon={busy ? <CircularProgress size={14} /> : <HandshakeOutlinedIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: palette.accentBright,
                  color: '#0c0a09',
                  '&:hover': { bgcolor: palette.accent },
                }}
              >
                Foreslå {selectedIds.size}
              </Button>
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
