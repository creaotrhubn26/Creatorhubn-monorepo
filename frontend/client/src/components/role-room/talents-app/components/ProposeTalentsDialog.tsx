/**
 * ProposeTalentsDialog.tsx
 *
 * Byrå-siden av talent-foreslåelse-flyten. Brukes fra
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

import { useT } from '../../../../i18n';
import { palette, radius } from '../theme';
import {
  listTalentProposals,
  proposableTalents,
  proposeTalent,
  withdrawTalentProposal,
  type ProposableTalent,
  type TalentProposal,
} from '../../services/roleRoomPartnershipsService';

type TFunc = ReturnType<typeof useT>['t'];

interface Props {
  open: boolean;
  invitationId: string;
  projectName: string;
  onClose: () => void;
  /** Roller produksjon har valgt i invitasjonen — viser navn ved foreslåelse. */
  roleIds?: string[] | null;
}

function ageLine(t: TFunc, item: ProposableTalent | TalentProposal): string {
  const lo = item.playing_age_min;
  const hi = item.playing_age_max;
  if (lo && hi) return t('propTalents.ageRange', { lo, hi });
  if (lo) return t('propTalents.ageFrom', { lo });
  if (hi) return t('propTalents.ageUpTo', { hi });
  return '';
}

export default function ProposeTalentsDialog({ open, invitationId, projectName, onClose }: Props) {
  const { t } = useT();
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

  const STATUS_BADGE = useMemo<Record<TalentProposal['status'], { label: string; color: string; bg: string }>>(
    () => ({
      pending: { label: t('propTalents.statusPending'), color: '#fbbf24', bg: 'rgba(251,191,36,0.16)' },
      accepted: { label: t('propTalents.statusAccepted'), color: '#34d399', bg: 'rgba(52,211,153,0.16)' },
      declined: { label: t('propTalents.statusDeclined'), color: '#f87171', bg: 'rgba(248,113,113,0.16)' },
      withdrawn: { label: t('propTalents.statusWithdrawn'), color: '#9ca3af', bg: 'rgba(156,163,175,0.15)' },
    }),
    [t],
  );

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
      setError(e instanceof Error ? e.message : t('propTalents.loadTalentsError'));
    } finally {
      setLoading(false);
    }
  }, [invitationId, q, t]);

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
      setInfo(t('propTalents.proposedToast', { name: pendingTalent.display_name }));
      setPendingTalent(null);
      setAgencyNotes('');
      await Promise.all([loadTalents(), loadProposals()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('propTalents.proposeError'));
    } finally {
      setBusy(false);
    }
  }, [pendingTalent, invitationId, agencyNotes, loadTalents, loadProposals, t]);

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
      const failedMsg = result.failed > 0 ? t('propTalents.bulkFailedSuffix', { n: result.failed }) : '';
      setInfo(t('propTalents.bulkSuccessToast', { n: result.succeeded, suffix: failedMsg }));
      setSelectedIds(new Set());
      setBulkDialogOpen(false);
      setBulkNotes('');
      await Promise.all([loadTalents(), loadProposals()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('propTalents.bulkProposeError'));
    } finally {
      setBusy(false);
    }
  }, [selectedIds, invitationId, bulkNotes, loadTalents, loadProposals, t]);

  const handleWithdraw = useCallback(async (proposalId: string) => {
    setBusy(true);
    setError(null);
    try {
      await withdrawTalentProposal(proposalId);
      setInfo(t('propTalents.withdrawSuccessToast'));
      await Promise.all([loadProposals(), loadTalents()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('propTalents.withdrawError'));
    } finally {
      setBusy(false);
    }
  }, [loadProposals, loadTalents, t]);

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
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{t('propTalents.dialogTitle')}</Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
              {t('propTalents.toProject', { name: projectName })}
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
          <Tab value="discover" label={t('propTalents.discoverTab')} />
          <Tab
            value="mine"
            label={`${t('propTalents.myProposalsTab')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
          />
        </Tabs>

        {tab === 'discover' ? (
          <Stack spacing={1.4}>
            <TextField
              fullWidth
              size="small"
              placeholder={t('propTalents.searchPlaceholder')}
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
                {t('propTalents.noTalentsFound')}
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
                      {t('propTalents.selectedCount', { n: selectedIds.size })}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        onClick={() => setSelectedIds(new Set())}
                        sx={{ textTransform: 'none', color: palette.textMuted }}
                      >
                        {t('propTalents.clearSelection')}
                      </Button>
                      <Button
                        size="small"
                        disabled={busy}
                        onClick={() => { setBulkDialogOpen(true); setBulkNotes(''); }}
                        startIcon={<HandshakeOutlinedIcon />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          background: palette.accentGradient,
                          color: '#fff',
                          boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                            boxShadow: '0 6px 18px rgba(168,85,247,0.52)',
                          },
                        }}
                      >
                        {t('propTalents.proposeAllSelected')}
                      </Button>
                    </Stack>
                  </Box>
                ) : null}
                <Stack spacing={0.8}>
                  {talents.map((talent) => {
                    const isSelected = selectedIds.has(talent.id);
                    return (
                      <Box
                        key={talent.id}
                        sx={{
                          p: 1.4,
                          borderRadius: 2,
                          border: `1px solid ${isSelected ? palette.accentBright : palette.border}`,
                          bgcolor: isSelected ? 'rgba(168,85,247,0.08)' : 'rgba(0,0,0,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.4,
                          cursor: talent.already_proposed ? 'default' : 'pointer',
                        }}
                        onClick={() => { if (!talent.already_proposed) toggleSelected(talent.id); }}
                      >
                        {!talent.already_proposed ? (
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
                        <Avatar src={talent.headshot_url ?? undefined} sx={{ width: 52, height: 52, border: `1px solid ${palette.borderSubtle}` }}>
                          {talent.display_name?.charAt(0) ?? '?'}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 700, color: palette.textPrimary }}>
                            {talent.display_name}
                          </Typography>
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
                            {[talent.city, ageLine(t, talent), talent.gender].filter(Boolean).join(' · ')}
                          </Typography>
                        </Box>
                        {talent.already_proposed ? (
                          <Chip
                            size="small"
                            icon={<CheckCircleOutlineIcon sx={{ fontSize: 14, color: '#34d399 !important' }} />}
                            label={t('propTalents.proposedChip')}
                            sx={{
                              bgcolor: 'rgba(52,211,153,0.16)',
                              color: '#34d399',
                              fontWeight: 700,
                              border: '1px solid rgba(52,211,153,0.32)',
                            }}
                          />
                        ) : (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={(e) => { e.stopPropagation(); setPendingTalent(talent); setAgencyNotes(''); }}
                            startIcon={<HandshakeOutlinedIcon />}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 700,
                              background: palette.accentGradient,
                              color: '#fff',
                              boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                                boxShadow: '0 6px 18px rgba(168,85,247,0.52)',
                              },
                            }}
                          >
                            {t('propTalents.proposeButton')}
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
                {t('propTalents.noProposalsYet')}
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
                          {[p.city, ageLine(t, p), p.role_name].filter(Boolean).join(' · ')}
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
                        {t('propTalents.yourComment', { note: p.agency_notes })}
                      </Typography>
                    ) : null}
                    {p.production_notes ? (
                      <Typography sx={{ color: '#c4b5fd', fontSize: '0.78rem', mt: 0.8, pl: 7 }}>
                        {t('propTalents.productionComment', { note: p.production_notes })}
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
                          {t('propTalents.withdrawButton')}
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
              {t('propTalents.proposeNameHeading', { name: pendingTalent.display_name })}
            </Typography>
            <TextField
              fullWidth
              size="small"
              label={t('propTalents.notesLabel')}
              value={agencyNotes}
              onChange={(e) => setAgencyNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder={t('propTalents.notesPlaceholder')}
              sx={{ mb: 1.4 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                disabled={busy}
                onClick={() => { setPendingTalent(null); setAgencyNotes(''); }}
                sx={{ textTransform: 'none', color: palette.textMuted }}
              >
                {t('propTalents.cancel')}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                disabled={busy}
                onClick={() => void handlePropose()}
                startIcon={busy ? <CircularProgress size={14} /> : <HandshakeOutlinedIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  background: palette.accentGradient,
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                    boxShadow: '0 6px 18px rgba(168,85,247,0.52)',
                  },
                }}
              >
                {t('propTalents.sendProposal')}
              </Button>
            </Stack>
          </Box>
        ) : null}

        {/* Bulk-dialog */}
        {bulkDialogOpen ? (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${palette.border}` }}>
            <Typography sx={{ fontWeight: 700, color: palette.textPrimary, mb: 1.2 }}>
              {t('propTalents.proposeCountHeading', { n: selectedIds.size })}
            </Typography>
            <TextField
              fullWidth
              size="small"
              label={t('propTalents.bulkNotesLabel')}
              value={bulkNotes}
              onChange={(e) => setBulkNotes(e.target.value)}
              multiline
              minRows={2}
              placeholder={t('propTalents.bulkNotesPlaceholder')}
              sx={{ mb: 1.4 }}
            />
            <Stack direction="row" spacing={1}>
              <Button
                disabled={busy}
                onClick={() => { setBulkDialogOpen(false); setBulkNotes(''); }}
                sx={{ textTransform: 'none', color: palette.textMuted }}
              >
                {t('propTalents.cancel')}
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                disabled={busy}
                onClick={() => void handleBulkPropose()}
                startIcon={busy ? <CircularProgress size={14} /> : <HandshakeOutlinedIcon />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  background: palette.accentGradient,
                  color: '#fff',
                  boxShadow: '0 4px 14px rgba(168,85,247,0.38)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)',
                    boxShadow: '0 6px 18px rgba(168,85,247,0.52)',
                  },
                }}
              >
                {t('propTalents.proposeCountButton', { n: selectedIds.size })}
              </Button>
            </Stack>
          </Box>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
