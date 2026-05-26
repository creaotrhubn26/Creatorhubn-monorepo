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
import {
  industryTargetsApi,
  newsletterApi,
  INDUSTRY_SEGMENT_LABELS,
  INDUSTRY_STATUS_LABELS,
  INDUSTRY_TIER_LABELS,
  INDUSTRY_ENGAGEMENT_KIND_LABELS,
  type IndustryEngagementKind,
  type IndustrySegment,
  type IndustryStatus,
  type IndustryTarget,
  type IndustryTargetInput,
  type IndustryTargetStats,
  type IndustryTier,
  type NewsletterSignup,
  type NewsletterTotals,
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
              <TableCell sx={{ color: 'rgba(226,232,240,0.85)', fontWeight: 700 }}>Antall</TableCell>
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
                  <TableCell sx={{ color: '#fff', fontWeight: 700 }}>{target.engagement_count}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => setEngagementTarget(target)} title="Logg engagement">
                        <BoltIcon fontSize="small" sx={{ color: '#fcd34d' }} />
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
    </Box>
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
  onClose: () => void;
  onSaved: () => void;
}

function TargetDrawer({ open, initial, onClose, onSaved }: TargetDrawerProps) {
  const [form, setForm] = useState<IndustryTargetInput>({});
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
      });
    } else {
      setForm({ tier: 'T2', segment: 'producer', status: 'cold' });
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
      if (initial) {
        await industryTargetsApi.patch(initial.id, form);
      } else {
        await industryTargetsApi.create(form);
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

export default IndustryTargetsTab;
