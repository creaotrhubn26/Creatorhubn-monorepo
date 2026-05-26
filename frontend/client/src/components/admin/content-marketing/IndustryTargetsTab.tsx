import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import CircularProgress from '@mui/material/CircularProgress';
import {
  industryTargetsApi,
  newsletterApi,
  outreachApi,
  INDUSTRY_SEGMENT_LABELS,
  INDUSTRY_STATUS_LABELS,
  INDUSTRY_TIER_LABELS,
  INDUSTRY_ENGAGEMENT_KIND_LABELS,
  type IndustryEngagementKind,
  type IndustrySegment,
  type IndustryStatus,
  type IndustryTarget,
  type IndustryTargetInput,
  type IndustryTargetProduction,
  type IndustryTargetStats,
  type IndustryTier,
  type NewsletterSignup,
  type NewsletterTotals,
  type OutreachTemplate,
  type OutreachPersonalizedResult,
} from '../../../services/adminRoomApi';

/**
 * Tier-1 industry-CRM + newsletter-stats — operativsystemet bak
 * Content Marketing-planens prinsipp om mental availability hos
 * 500 personer i norsk filmbransje.
 *
 * Tab inneholder:
 *  - Newsletter-stats (signups attributed to social/per source)
 *  - Targets-tabell med tier/segment/status-filter
 *  - Drawer for opprette/redigere target
 *  - Engagement-quick-log (1-klikk for å registrere kommentar/DM/møte)
 */

const TIERS: IndustryTier[] = ['T1', 'T2', 'T3'];
const STATUS_COLORS: Record<IndustryStatus, string> = {
  cold: '#64748b',
  warm: '#fbbf24',
  engaged: '#34d399',
  advocate: '#a78bfa',
  paused: '#475569',
};
const TIER_COLORS: Record<IndustryTier, string> = {
  T1: '#f472b6',
  T2: '#a78bfa',
  T3: '#64748b',
};

export function IndustryTargetsTab() {
  const [targets, setTargets] = useState<IndustryTarget[]>([]);
  const [stats, setStats] = useState<IndustryTargetStats | null>(null);
  const [newsletterTotals, setNewsletterTotals] = useState<NewsletterTotals | null>(null);
  const [newsletterBySource, setNewsletterBySource] = useState<Array<{ source: string; count: number }>>([]);
  const [recentSignups, setRecentSignups] = useState<NewsletterSignup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<IndustryTier | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IndustryStatus | 'all'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<IndustryTarget | null>(null);
  const [engagementTarget, setEngagementTarget] = useState<IndustryTarget | null>(null);
  const [outreachTarget, setOutreachTarget] = useState<IndustryTarget | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [targetItems, targetStats, nsStats, nsSignups] = await Promise.all([
        industryTargetsApi.list({
          tier: tierFilter === 'all' ? undefined : tierFilter,
          status: statusFilter === 'all' ? undefined : statusFilter,
        }),
        industryTargetsApi.stats(),
        newsletterApi.stats().catch(() => null),
        newsletterApi.recentSignups(20).catch(() => []),
      ]);
      setTargets(targetItems);
      setStats(targetStats);
      if (nsStats) {
        setNewsletterTotals(nsStats.totals);
        setNewsletterBySource(nsStats.bySource);
      }
      setRecentSignups(nsSignups);
    } catch (err) {
      setError((err as Error).message || 'Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  }, [tierFilter, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function handleAdd() {
    setEditingTarget(null);
    setDrawerOpen(true);
  }
  function handleEdit(target: IndustryTarget) {
    setEditingTarget(target);
    setDrawerOpen(true);
  }
  async function handleDelete(target: IndustryTarget) {
    if (!window.confirm(`Slette "${target.full_name}" fra CRM?`)) return;
    try {
      await industryTargetsApi.remove(target.id);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function handleLogEngagement(target: IndustryTarget, kind: IndustryEngagementKind) {
    try {
      await industryTargetsApi.logEngagement(target.id, { kind, direction: 'outbound' });
      await refresh();
      setEngagementTarget(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const tier1Comments = stats?.tier1CommentsLast30d ?? 0;
  const tier1CommentTarget = 5;
  const askReadyCount = targets.filter((t) => (t.ask_readiness ?? 0) === 3).length;

  async function handleSetAskReadiness(target: IndustryTarget, next: number) {
    try {
      await industryTargetsApi.patch(target.id, { askReadiness: next });
      // Optimistisk oppdatering uten full refresh — beholder filter/scroll-tilstand
      setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, ask_readiness: next } : t)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
            Tier-1 CRM — de 500 i norsk filmbransje
          </Typography>
          <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.88rem' }}>
            Operativsystem for engagement-rytmen i Content Marketing-planen. T1 = svar samme dag,
            T2 = ukentlig touchpoint, T3 = månedlig.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          Ny target
        </Button>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <OutreachWeek1Checklist />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(6, 1fr)' }, gap: 1.5, mb: 3 }}>
        <StatCard label="Targets totalt" value={stats?.totals.total ?? 0} accent="#a78bfa" />
        <StatCard label="T1 (daglig)" value={stats?.totals.tier_t1 ?? 0} accent="#f472b6" />
        <StatCard label="Engasjerte" value={stats?.totals.engaged ?? 0} accent="#34d399" />
        <StatCard
          label="T1-kommentarer 30d"
          value={`${tier1Comments} / ${tier1CommentTarget}`}
          accent={tier1Comments >= tier1CommentTarget ? '#22c55e' : '#fbbf24'}
          hint={`Plan-mål: ${tier1CommentTarget}/mnd`}
        />
        <StatCard
          label="Klar for ask"
          value={askReadyCount}
          accent={askReadyCount > 0 ? '#22d3ee' : '#64748b'}
          hint="Touch 1+2 ferdig"
        />
        <StatCard
          label="Newsletter total"
          value={newsletterTotals?.total ?? 0}
          accent="#22d3ee"
          hint={`${newsletterTotals?.confirmed ?? 0} bekreftet`}
        />
        <StatCard
          label="Newsletter 30d"
          value={newsletterTotals?.new_last_30d ?? 0}
          accent={(newsletterTotals?.new_last_30d ?? 0) >= 30 ? '#22c55e' : '#fbbf24'}
          hint="Plan-mål 2026: 30/mnd"
        />
      </Box>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Tier</InputLabel>
          <Select
            label="Tier"
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as IndustryTier | 'all')}
          >
            <MenuItem value="all">Alle tiers</MenuItem>
            {TIERS.map((t) => (
              <MenuItem key={t} value={t}>{INDUSTRY_TIER_LABELS[t]}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IndustryStatus | 'all')}
          >
            <MenuItem value="all">Alle statuser</MenuItem>
            {(Object.keys(INDUSTRY_STATUS_LABELS) as IndustryStatus[]).map((s) => (
              <MenuItem key={s} value={s}>{INDUSTRY_STATUS_LABELS[s]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <TableContainer component={Paper} sx={{ bgcolor: 'rgba(15,23,42,0.5)', mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Navn</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Tier</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Segment</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Status</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Sist engasjert</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700, width: 140 }} title="3-touch-regel fra Outreach Plan">3-touch</TableCell>
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700, width: 220 }}>Handlinger</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'center', py: 4 }}>
                  Laster…
                </TableCell>
              </TableRow>
            ) : targets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'center', py: 4 }}>
                  Ingen targets enda. Start med 10 navn fra LinkedIn — fokuser på T1 først.
                </TableCell>
              </TableRow>
            ) : (
              targets.map((target) => (
                <TableRow key={target.id} hover>
                  <TableCell sx={{ color: '#fff' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{target.full_name}</Typography>
                      {target.role_title || target.company ? (
                        <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.78rem' }}>
                          {[target.role_title, target.company].filter(Boolean).join(' · ')}
                        </Typography>
                      ) : null}
                      {target.referred_by_id ? (() => {
                        const referrer = targets.find((t) => t.id === target.referred_by_id);
                        return referrer ? (
                          <Chip
                            label={`Via ${referrer.full_name} · G${target.referral_generation ?? 1}`}
                            size="small"
                            sx={{
                              mt: 0.5,
                              height: 18,
                              bgcolor: 'rgba(244,114,182,0.16)',
                              color: '#f9a8d4',
                              fontSize: '0.66rem',
                              fontWeight: 700,
                            }}
                          />
                        ) : null;
                      })() : null}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={target.tier}
                      size="small"
                      sx={{ bgcolor: `${TIER_COLORS[target.tier]}22`, color: TIER_COLORS[target.tier], fontWeight: 800, fontSize: '0.72rem' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>
                    {INDUSTRY_SEGMENT_LABELS[target.segment]}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={INDUSTRY_STATUS_LABELS[target.status].split(' — ')[0]}
                      size="small"
                      sx={{ bgcolor: `${STATUS_COLORS[target.status]}22`, color: STATUS_COLORS[target.status], fontWeight: 700, fontSize: '0.72rem' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.78rem' }}>
                    {target.last_engaged_at
                      ? new Date(target.last_engaged_at).toLocaleDateString('nb-NO', { year: 'numeric', month: 'short', day: 'numeric' })
                      : <span style={{ opacity: 0.45 }}>—</span>}
                  </TableCell>
                  <TableCell>
                    <TouchCadence
                      value={target.ask_readiness ?? 0}
                      onChange={(next) => handleSetAskReadiness(target, next)}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => setEngagementTarget(target)} title="Logg engagement">
                        <BoltIcon fontSize="small" sx={{ color: '#fcd34d' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => setOutreachTarget(target)} title="Generér personlig outreach (Claude)">
                        <AutoAwesomeIcon fontSize="small" sx={{ color: '#22d3ee' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEdit(target)} title="Rediger">
                        <EditOutlinedIcon fontSize="small" sx={{ color: '#c4b5fd' }} />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDelete(target)} title="Slett">
                        <DeleteOutlineIcon fontSize="small" sx={{ color: 'rgba(248,113,113,0.85)' }} />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 4 }}>
        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem', mb: 1.5 }}>
          Newsletter signups — siste 90 dager per kilde
        </Typography>
        {newsletterBySource.length === 0 ? (
          <Typography sx={{ color: 'rgba(203,213,225,0.6)', fontSize: '0.85rem' }}>
            Ingen påmeldinger registrert enda. Påmeldinger fra pillar-sider havner her med source-tag.
          </Typography>
        ) : (
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
            {newsletterBySource.map((row) => (
              <Chip
                key={row.source}
                label={`${row.source}: ${row.count}`}
                size="small"
                sx={{ bgcolor: 'rgba(34,211,238,0.15)', color: '#67e8f9', fontWeight: 700 }}
              />
            ))}
          </Stack>
        )}

        {recentSignups.length > 0 ? (
          <TableContainer component={Paper} sx={{ bgcolor: 'rgba(15,23,42,0.5)' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Når</TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>E-post</TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Source</TableCell>
                  <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentSignups.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ color: 'rgba(203,213,225,0.75)', fontSize: '0.78rem' }}>
                      {new Date(row.created_at).toLocaleString('nb-NO')}
                    </TableCell>
                    <TableCell sx={{ color: '#fff', fontSize: '0.85rem' }}>{row.email}</TableCell>
                    <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontSize: '0.82rem' }}>{row.source}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.status}
                        size="small"
                        sx={{
                          bgcolor: row.status === 'confirmed' ? 'rgba(34,197,94,0.18)' : 'rgba(251,191,36,0.18)',
                          color: row.status === 'confirmed' ? '#bbf7d0' : '#fde68a',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}
      </Box>

      <TargetDrawer
        open={drawerOpen}
        initial={editingTarget}
        allTargets={targets}
        onClose={() => setDrawerOpen(false)}
        onSaved={async () => {
          setDrawerOpen(false);
          await refresh();
        }}
      />

      <Dialog
        open={engagementTarget !== null}
        onClose={() => setEngagementTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Logg engagement</span>
          <IconButton size="small" onClick={() => setEngagementTarget(null)}>
            <CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(203,213,225,0.85)', fontSize: '0.85rem', mb: 1.5 }}>
            {engagementTarget?.full_name}
          </Typography>
          <Stack spacing={0.5}>
            {(Object.keys(INDUSTRY_ENGAGEMENT_KIND_LABELS) as IndustryEngagementKind[]).map((kind) => (
              <Button
                key={kind}
                variant="outlined"
                onClick={() => engagementTarget && handleLogEngagement(engagementTarget, kind)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600, color: '#c4b5fd', borderColor: 'rgba(167,139,250,0.3)' }}
              >
                {INDUSTRY_ENGAGEMENT_KIND_LABELS[kind]}
              </Button>
            ))}
          </Stack>
        </DialogContent>
      </Dialog>

      <OutreachDialog
        target={outreachTarget}
        onClose={() => setOutreachTarget(null)}
        onError={setError}
      />
    </Box>
  );
}

// ── Week-1 onboarding-checklist fra Outreach Plan side 11 ───────────
// Persisteres til localStorage så Daniel beholder progresjonen ved
// reload. "Skjul"-knapp ved bunnen setter hidden=true permanent.

const WEEK1_STORAGE_KEY = 'roleroom-outreach-week1-v1';
const WEEK1_DAYS: Array<{ day: string; label: string; action: string }> = [
  { day: 'Mon', label: 'Foundation', action: 'Bygg CRM. List 15 CDs + 30 produsenter. Finn én felles kontakt per target.' },
  { day: 'Tue', label: 'LinkedIn-rytme', action: 'Sett opp LinkedIn-engagement — 30 min/dag på substantive kommentarer mot Tier-1 targets.' },
  { day: 'Wed', label: 'Første CD-DM', action: 'Skriv personaliserte DM-er til topp 5 CDs. Send 1 (bruk AI-utkast på en target).' },
  { day: 'Thu', label: 'Første produsent-mail', action: 'Skriv personaliserte mailer til topp 5 produsenter. Send 1.' },
  { day: 'Fri', label: 'Første møte', action: 'Kaffe eller møte booket med 1 CD eller 1 produsent. Hvis ingen møter — meldingen er feil, skriv om.' },
  { day: 'Sat', label: 'Rushprint-utkast', action: 'Skriv guest-artikkel (1.200 ord). Topic-forslag: AI-klausuler, casting-tid-data, eller barne-compliance.' },
  { day: 'Sun', label: 'Hvile', action: 'Norsk forretningskultur respekterer arbeidsfri. Outreach på søndag signaliserer desperasjon.' },
];

function loadWeek1State(): { done: boolean[]; hidden: boolean } {
  if (typeof window === 'undefined') return { done: Array(7).fill(false), hidden: false };
  try {
    const raw = window.localStorage.getItem(WEEK1_STORAGE_KEY);
    if (!raw) return { done: Array(7).fill(false), hidden: false };
    const parsed = JSON.parse(raw);
    return {
      done: Array.isArray(parsed.done) && parsed.done.length === 7 ? parsed.done.map(Boolean) : Array(7).fill(false),
      hidden: !!parsed.hidden,
    };
  } catch {
    return { done: Array(7).fill(false), hidden: false };
  }
}

function saveWeek1State(state: { done: boolean[]; hidden: boolean }): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEEK1_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage kan være blokkert — gi opp stille */
  }
}

function OutreachWeek1Checklist() {
  const [state, setState] = useState(loadWeek1State);

  function toggle(idx: number) {
    const next = { ...state, done: state.done.map((d, i) => (i === idx ? !d : d)) };
    setState(next);
    saveWeek1State(next);
  }

  function hideForever() {
    const next = { ...state, hidden: true };
    setState(next);
    saveWeek1State(next);
  }

  if (state.hidden) return null;

  const doneCount = state.done.filter(Boolean).length;
  const allDone = doneCount === 7;

  return (
    <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.28)', position: 'relative' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.25}>
          <RocketLaunchIcon sx={{ color: '#22d3ee', fontSize: 22 }} />
          <Box>
            <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1rem' }}>
              Outreach Plan · Uke 1-handlingsliste
              {allDone ? <Chip label="Ferdig!" size="small" sx={{ ml: 1.5, height: 18, bgcolor: 'rgba(34,197,94,0.2)', color: '#86efac', fontWeight: 700, fontSize: '0.66rem' }} /> : null}
            </Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.8rem' }}>
              {doneCount} / 7 fullført · Per dokumentet: "Hvis null møter etter fredag — meldingen er feil, skriv om"
            </Typography>
          </Box>
        </Stack>
        <Button size="small" onClick={hideForever} sx={{ textTransform: 'none', color: 'rgba(203,213,225,0.55)', fontSize: '0.74rem' }}>
          Skjul permanent
        </Button>
      </Stack>
      <Stack spacing={0.75}>
        {WEEK1_DAYS.map((row, idx) => {
          const done = state.done[idx];
          return (
            <Stack
              key={row.day}
              direction="row"
              spacing={1.25}
              alignItems="flex-start"
              onClick={() => toggle(idx)}
              sx={{
                cursor: 'pointer',
                p: 0.75,
                borderRadius: 1,
                opacity: done ? 0.55 : 1,
                '&:hover': { bgcolor: 'rgba(34,211,238,0.06)' },
              }}
            >
              {done ? (
                <CheckBoxIcon fontSize="small" sx={{ color: '#22d3ee', mt: 0.25 }} />
              ) : (
                <CheckBoxOutlineBlankIcon fontSize="small" sx={{ color: 'rgba(148,163,184,0.55)', mt: 0.25 }} />
              )}
              <Box sx={{ minWidth: 48 }}>
                <Typography sx={{ color: done ? 'rgba(203,213,225,0.55)' : '#22d3ee', fontWeight: 800, fontSize: '0.74rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {row.day}
                </Typography>
                <Typography sx={{ color: 'rgba(203,213,225,0.5)', fontSize: '0.66rem' }}>{row.label}</Typography>
              </Box>
              <Typography
                sx={{
                  flex: 1,
                  color: done ? 'rgba(203,213,225,0.55)' : '#e2e8f0',
                  fontSize: '0.84rem',
                  lineHeight: 1.5,
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {row.action}
              </Typography>
            </Stack>
          );
        })}
      </Stack>
    </Paper>
  );
}

// ── Touch-cadence-dots: 3-touch-regel fra Outreach Plan ─────────────
// 0 = ingen touch ennå · 1 = engaged offentlig · 2 = ga value · 3 = klar for ask
const TOUCH_LABELS = [
  'Ingen touch ennå',
  'Touch 1 — engaged offentlig (kommentar, repost)',
  'Touch 2 — ga substantiv value (artikkel, stat, intro)',
  'Touch 3 — klar for ask (DM, mail, møte)',
];
const TOUCH_COLORS = ['#475569', '#fbbf24', '#a78bfa', '#22d3ee'];

function TouchCadence({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const clamped = Math.max(0, Math.min(3, value));
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {[1, 2, 3].map((step) => {
        const reached = step <= clamped;
        return (
          <Box
            key={step}
            onClick={() => onChange(clamped === step ? step - 1 : step)}
            title={TOUCH_LABELS[step]}
            sx={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              cursor: 'pointer',
              bgcolor: reached ? TOUCH_COLORS[step] : 'transparent',
              border: `2px solid ${reached ? TOUCH_COLORS[step] : 'rgba(148,163,184,0.35)'}`,
              transition: 'all 0.18s ease',
              '&:hover': { transform: 'scale(1.18)', boxShadow: `0 0 0 3px ${TOUCH_COLORS[step]}33` },
            }}
          />
        );
      })}
      {clamped === 3 ? (
        <Chip
          label="ASK"
          size="small"
          sx={{
            ml: 0.75,
            height: 18,
            bgcolor: 'rgba(34,211,238,0.18)',
            color: '#22d3ee',
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
          }}
        />
      ) : null}
    </Stack>
  );
}

interface StatCardProps {
  label: string;
  value: number | string;
  accent: string;
  hint?: string;
}

function StatCard({ label, value, accent, hint }: StatCardProps) {
  return (
    <Box sx={{ p: 1.75, borderRadius: 2, bgcolor: `${accent}10`, border: `1px solid ${accent}30` }}>
      <Typography sx={{ color: accent, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#fff', fontSize: { xs: '1.1rem', md: '1.35rem' }, fontWeight: 800, lineHeight: 1.1 }}>
        {value}
      </Typography>
      {hint ? (
        <Typography sx={{ color: 'rgba(203,213,225,0.55)', fontSize: '0.7rem', mt: 0.5 }}>
          {hint}
        </Typography>
      ) : null}
    </Box>
  );
}

interface TargetDrawerProps {
  open: boolean;
  initial: IndustryTarget | null;
  allTargets: IndustryTarget[];
  onClose: () => void;
  onSaved: () => void;
}

// Hjelper: serialiser/parse recent_productions for textarea-input
// Format: én produksjon per linje, "Tittel (år) — rolle" — alle felt utenom tittel er valgfrie
function serializeProductions(items: IndustryTargetProduction[]): string {
  return items
    .map((p) => {
      let line = p.title;
      if (p.year) line += ` (${p.year})`;
      if (p.role) line += ` — ${p.role}`;
      return line;
    })
    .join('\n');
}

function parseProductions(text: string): IndustryTargetProduction[] {
  return text
    .split(/\r?\n/)
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      const yearMatch = line.match(/\((\d{4})\)/);
      const year = yearMatch ? Number(yearMatch[1]) : undefined;
      const withoutYear = line.replace(/\s*\(\d{4}\)/, '').trim();
      const [titlePart, ...rolePart] = withoutYear.split(/\s*[—–-]\s*/);
      const role = rolePart.length > 0 ? rolePart.join(' — ').trim() : undefined;
      const production: IndustryTargetProduction = { title: titlePart.trim() };
      if (year !== undefined) production.year = year;
      if (role) production.role = role;
      return production;
    });
}

function TargetDrawer({ open, initial, allTargets, onClose, onSaved }: TargetDrawerProps) {
  const [form, setForm] = useState<IndustryTargetInput>({});
  const [productionsText, setProductionsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        fullName: initial.full_name,
        roleTitle: initial.role_title,
        company: initial.company,
        segment: initial.segment,
        tier: initial.tier,
        status: initial.status,
        linkedinUrl: initial.linkedin_url,
        instagramHandle: initial.instagram_handle,
        email: initial.email,
        phone: initial.phone,
        city: initial.city,
        notes: initial.notes,
        nextAction: initial.next_action,
        nextActionDue: initial.next_action_due,
        recentProductions: initial.recent_productions ?? [],
        mutualConnection: initial.mutual_connection ?? '',
        referredById: initial.referred_by_id ?? null,
        referralGeneration: initial.referral_generation ?? 0,
        unionMembership: initial.union_membership ?? '',
        crewSpecialty: initial.crew_specialty ?? '',
        reelUrl: initial.reel_url ?? '',
      });
      setProductionsText(serializeProductions(initial.recent_productions ?? []));
    } else {
      setForm({ tier: 'T2', segment: 'producer', status: 'cold' });
      setProductionsText('');
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    if (!form.fullName?.trim()) {
      setError('Navn er påkrevd');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: IndustryTargetInput = {
        ...form,
        recentProductions: parseProductions(productionsText),
      };
      if (initial) {
        await industryTargetsApi.patch(initial.id, payload);
      } else {
        await industryTargetsApi.create(payload);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{initial ? 'Rediger target' : 'Ny target'}</span>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <TextField label="Fullt navn" size="small" fullWidth value={form.fullName ?? ''} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Tittel / rolle" size="small" sx={{ flex: 1 }} value={form.roleTitle ?? ''} onChange={(e) => setForm((p) => ({ ...p, roleTitle: e.target.value }))} />
            <TextField label="Selskap" size="small" sx={{ flex: 1 }} value={form.company ?? ''} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Tier</InputLabel>
              <Select label="Tier" value={form.tier ?? 'T2'} onChange={(e) => setForm((p) => ({ ...p, tier: e.target.value as IndustryTier }))}>
                {TIERS.map((t) => <MenuItem key={t} value={t}>{INDUSTRY_TIER_LABELS[t]}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Segment</InputLabel>
              <Select label="Segment" value={form.segment ?? 'producer'} onChange={(e) => setForm((p) => ({ ...p, segment: e.target.value as IndustrySegment }))}>
                {(Object.keys(INDUSTRY_SEGMENT_LABELS) as IndustrySegment[]).map((s) => (
                  <MenuItem key={s} value={s}>{INDUSTRY_SEGMENT_LABELS[s]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={form.status ?? 'cold'} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as IndustryStatus }))}>
                {(Object.keys(INDUSTRY_STATUS_LABELS) as IndustryStatus[]).map((s) => (
                  <MenuItem key={s} value={s}>{INDUSTRY_STATUS_LABELS[s].split(' — ')[0]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="LinkedIn URL" size="small" sx={{ flex: 1 }} value={form.linkedinUrl ?? ''} onChange={(e) => setForm((p) => ({ ...p, linkedinUrl: e.target.value }))} />
            <TextField label="Instagram-handle" size="small" sx={{ flex: 1 }} value={form.instagramHandle ?? ''} onChange={(e) => setForm((p) => ({ ...p, instagramHandle: e.target.value }))} />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="E-post" size="small" sx={{ flex: 1 }} value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <TextField label="By" size="small" sx={{ flex: 1 }} value={form.city ?? ''} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
          </Stack>
          <TextField label="Neste handling" size="small" fullWidth value={form.nextAction ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextAction: e.target.value }))} />
          <TextField label="Frist neste handling" size="small" type="date" InputLabelProps={{ shrink: true }} fullWidth value={form.nextActionDue ?? ''} onChange={(e) => setForm((p) => ({ ...p, nextActionDue: e.target.value || null }))} />
          <TextField label="Notater" size="small" multiline minRows={3} fullWidth value={form.notes ?? ''} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />

          {/* Outreach Plan-info — driver Claude-personalisering */}
          <Box sx={{ pt: 1.5, borderTop: '1px solid rgba(148,163,184,0.18)' }}>
            <Typography sx={{ color: '#22d3ee', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', mb: 1.5 }}>
              Outreach-fakta · brukes av AI-personalisering
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Siste produksjoner"
                size="small"
                multiline
                minRows={3}
                fullWidth
                value={productionsText}
                onChange={(e) => setProductionsText(e.target.value)}
                placeholder={'Én per linje. Format: "Tittel (år) — rolle"\nEks:\nSentimental Value (2025) — casting director\nThe Worst Person in the World (2021)'}
                helperText="Claude bruker disse til å henvise spesifikt til arbeidet deres i personlige meldinger."
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Mutual connection (hvem kan introdusere deg?)"
                size="small"
                fullWidth
                value={form.mutualConnection ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, mutualConnection: e.target.value }))}
                placeholder="Eks: Maria Hansen (Stella), Anders Berg (NFI)"
              />
              <FormControl size="small" fullWidth>
                <InputLabel>Warm-intro fra (referral-kilde)</InputLabel>
                <Select
                  label="Warm-intro fra (referral-kilde)"
                  value={form.referredById ?? ''}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    const referrer = v ? allTargets.find((t) => t.id === v) : null;
                    const inferredGen = referrer ? Math.max(1, (referrer.referral_generation ?? 0) + 1) : 0;
                    setForm((p) => ({ ...p, referredById: v, referralGeneration: inferredGen }));
                  }}
                >
                  <MenuItem value=""><em>(Cold target — ingen intro)</em></MenuItem>
                  {allTargets
                    .filter((t) => t.id !== initial?.id)
                    .map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.full_name}{t.company ? ` · ${t.company}` : ''}{t.referral_generation ? ` · G${t.referral_generation}` : ''}
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              {/* Crew-spesifikke felter (migrasjon 174) */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Fagforening</InputLabel>
                  <Select
                    label="Fagforening"
                    value={form.unionMembership ?? ''}
                    onChange={(e) => setForm((p) => ({ ...p, unionMembership: e.target.value || null }))}
                  >
                    <MenuItem value=""><em>(ukjent / ikke relevant)</em></MenuItem>
                    <MenuItem value="filmforbund">Norsk Filmforbund (crew)</MenuItem>
                    <MenuItem value="nsf">NSF (skuespillere)</MenuItem>
                    <MenuItem value="ingen">Ikke fagforeningsmedlem</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Crew-spesialisering"
                  size="small"
                  sx={{ flex: 1 }}
                  value={form.crewSpecialty ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, crewSpecialty: e.target.value }))}
                  placeholder="Eks: dokumentar, drama, kommersiell"
                />
              </Stack>
              <TextField
                label="Reel / portefølje-URL"
                size="small"
                fullWidth
                value={form.reelUrl ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, reelUrl: e.target.value }))}
                placeholder="https://vimeo.com/... eller https://nettside.no"
                helperText="Kritisk for DP/regissør-outreach — de svarer ikke uten å kunne sjekke reel."
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Avbryt</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#7c3aed' }}>
          {saving ? 'Lagrer…' : initial ? 'Lagre endringer' : 'Opprett target'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Outreach-dialog: target + template → Claude → personlig melding ──

const SEGMENT_TO_OUTREACH_SEGMENTS: Partial<Record<IndustrySegment, Array<OutreachTemplate['segment']>>> = {
  casting_director: ['casting_director'],
  producer: ['producer'],
  press: ['press'],
  nsf: ['union'],
  nfi: ['institution'],
  skuda: ['institution'],
  agency: ['agency'],
};

function OutreachDialog({ target, onClose, onError }: { target: IndustryTarget | null; onClose: () => void; onError: (msg: string) => void }) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [extraContext, setExtraContext] = useState('');
  const [result, setResult] = useState<OutreachPersonalizedResult | null>(null);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Last templates når dialog åpnes
  useEffect(() => {
    if (!target) {
      setTemplates([]);
      setSelectedTemplateId('');
      setExtraContext('');
      setResult(null);
      return;
    }
    setLoadingTemplates(true);
    outreachApi
      .listTemplates()
      .then((items) => {
        setTemplates(items);
        // Auto-velg en relevant template basert på target.segment
        const preferred = SEGMENT_TO_OUTREACH_SEGMENTS[target.segment] ?? [];
        const match = items.find((t) => preferred.includes(t.segment) && t.is_default);
        if (match) setSelectedTemplateId(match.id);
      })
      .catch((err) => onError((err as Error).message))
      .finally(() => setLoadingTemplates(false));
  }, [target, onError]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  async function handleGenerate() {
    if (!target || !selectedTemplate) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await outreachApi.personalize({
        targetId: target.id,
        templateId: selectedTemplate.id,
        extraContext: extraContext.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.personalized);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      onError('Kunne ikke kopiere — prøv manuelt');
    }
  }

  if (!target) return null;

  const recentProductions = target.recent_productions ?? [];

  return (
    <Dialog open={target !== null} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { bgcolor: 'rgba(2,6,23,0.96)', color: '#e2e8f0' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon sx={{ color: '#22d3ee' }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>AI-personalisert outreach</Typography>
            <Typography sx={{ color: 'rgba(203,213,225,0.65)', fontSize: '0.78rem' }}>
              {target.full_name}{target.role_title ? ` — ${target.role_title}` : ''}{target.company ? `, ${target.company}` : ''}
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" sx={{ color: 'rgba(226,232,240,0.7)' }} /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* Target-fakta-summary */}
          <Box sx={{ p: 1.75, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.14)' }}>
            <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75, fontWeight: 700 }}>
              Fakta Claude bruker
            </Typography>
            <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ rowGap: 0.5 }}>
              <Chip size="small" label={INDUSTRY_SEGMENT_LABELS[target.segment]} sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd', fontWeight: 600, fontSize: '0.72rem' }} />
              {target.city ? <Chip size="small" label={target.city} sx={{ bgcolor: 'rgba(34,211,238,0.15)', color: '#67e8f9', fontWeight: 600, fontSize: '0.72rem' }} /> : null}
              {target.mutual_connection ? <Chip size="small" label={`Via: ${target.mutual_connection}`} sx={{ bgcolor: 'rgba(244,114,182,0.16)', color: '#f9a8d4', fontWeight: 600, fontSize: '0.72rem' }} /> : null}
              {recentProductions.length === 0 ? (
                <Chip size="small" label="Ingen produksjoner registrert" sx={{ bgcolor: 'rgba(239,68,68,0.15)', color: '#fca5a5', fontWeight: 600, fontSize: '0.72rem' }} />
              ) : (
                recentProductions.slice(0, 3).map((p) => (
                  <Chip key={p.title} size="small" label={p.year ? `${p.title} (${p.year})` : p.title} sx={{ bgcolor: 'rgba(52,211,153,0.15)', color: '#86efac', fontWeight: 600, fontSize: '0.72rem' }} />
                ))
              )}
            </Stack>
            {recentProductions.length === 0 ? (
              <Typography sx={{ color: 'rgba(252,165,165,0.85)', fontSize: '0.74rem', mt: 1 }}>
                Tips: Legg til siste produksjoner i target-redigering for at Claude skal kunne henvise spesifikt til arbeidet deres.
              </Typography>
            ) : null}
          </Box>

          {/* Template-velger */}
          <FormControl fullWidth size="small" disabled={loadingTemplates || generating}>
            <InputLabel sx={{ color: 'rgba(203,213,225,0.7)' }}>Velg mal</InputLabel>
            <Select
              value={selectedTemplateId}
              label="Velg mal"
              onChange={(e) => { setSelectedTemplateId(e.target.value); setResult(null); }}
              sx={{ color: '#fff', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' } }}
            >
              {templates.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.title}{t.is_default ? ' · Plan-anbefalt' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedTemplate ? (
            <Box>
              <Typography sx={{ color: 'rgba(203,213,225,0.7)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75, fontWeight: 700 }}>
                Mal-skjelett
              </Typography>
              <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.12)', fontSize: '0.82rem', lineHeight: 1.55, color: 'rgba(203,213,225,0.78)', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto' }}>
                {selectedTemplate.body}
              </Box>
            </Box>
          ) : null}

          {/* Ekstra kontekst */}
          <TextField
            label="Ekstra kontekst (valgfri)"
            placeholder='F.eks. "Hun delte en Rushprint-artikkel om barneskuespillere i forrige uke — referer til det"'
            size="small"
            multiline
            minRows={2}
            maxRows={5}
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value)}
            disabled={generating}
            InputLabelProps={{ sx: { color: 'rgba(203,213,225,0.7)' } }}
            InputProps={{
              sx: {
                color: '#fff',
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.3)' },
              },
            }}
          />

          {/* Generér-knapp + resultat */}
          {!result ? (
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={!selectedTemplate || generating}
              startIcon={generating ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <AutoAwesomeIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#22d3ee', color: '#0a0a0f', '&:hover': { bgcolor: '#06b6d4' } }}
            >
              {generating ? 'Claude jobber …' : 'Generér personlig melding'}
            </Button>
          ) : (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem' }}>
                  Ferdig melding · {result.templateChannel === 'dm' ? 'LinkedIn-DM' : result.templateChannel === 'email' ? 'Mail' : result.templateChannel}
                </Typography>
                <Button size="small" startIcon={<ContentCopyIcon fontSize="small" />} onClick={handleCopy} sx={{ textTransform: 'none', color: copied ? '#86efac' : '#22d3ee', fontWeight: 700 }}>
                  {copied ? 'Kopiert ✓' : 'Kopier'}
                </Button>
              </Stack>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.3)', whiteSpace: 'pre-wrap', fontSize: '0.92rem', lineHeight: 1.65, color: 'rgba(229,231,235,0.95)' }}>
                {result.personalized}
              </Box>
              {result.unresolvedPlaceholders.length > 0 ? (
                <Alert severity="warning" sx={{ mt: 1.5, bgcolor: 'rgba(251,191,36,0.1)', color: '#fde68a', '& .MuiAlert-icon': { color: '#fbbf24' } }}>
                  Uerstattede plassholdere: {result.unresolvedPlaceholders.join(', ')}. Fyll inn manuelt før sending.
                </Alert>
              ) : null}
              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1.5 }}>
                <Button onClick={() => { setResult(null); }} sx={{ textTransform: 'none', color: 'rgba(203,213,225,0.7)' }}>
                  Generér på nytt
                </Button>
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

export default IndustryTargetsTab;
