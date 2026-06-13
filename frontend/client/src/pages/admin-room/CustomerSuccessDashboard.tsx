/**
 * CustomerSuccessDashboard.tsx
 *
 * Wave M2 — Customer Success Manager-dashboard.
 *
 * Viser:
 *   - 4 hovedtall (totalt · green/yellow/red · snittscore · renewals 30d)
 *   - Liste av kunder sortert ROD-først (de som trenger oppmerksomhet)
 *   - Per-kunde-card: health-bar + subscores + raw signaler + dialog for
 *     interaksjons-logg
 *   - Renewals-pipeline-knapp (åpner dialog med kommende fornyelser)
 */

import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress,
  MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

interface CustomerHealth {
  userId: string;
  email: string;
  displayName: string | null;
  businessName: string | null;
  overallScore: number;
  tier: 'green' | 'yellow' | 'red';
  loginScore: number;
  featureScore: number;
  billingScore: number;
  engagementScore: number;
  signals: {
    daysSinceLogin: number | null;
    activeProjects30d: number;
    featuresUsed30d: number;
    stripeStatus: string | null;
    daysToRenewal: number | null;
  };
}

interface DashboardSummary {
  totalCustomers: number;
  tierCounts: { green: number; yellow: number; red: number };
  avgScore: number;
  upcomingRenewals30d: number;
  openFollowups: number;
  recentChurnSignals: number;
  customers: CustomerHealth[];
  generatedAt: string;
}

interface Interaction {
  id: string;
  interactionType: string;
  subject: string | null;
  body: string | null;
  sentiment: string | null;
  followUpAt: string | null;
  followUpCompleted: boolean;
  expansionValueNok: number | null;
  churnRiskLevel: string | null;
  occurredAt: string;
}

const TIER_META = {
  green: { color: '#34d399', bg: 'rgba(52,211,153,0.18)', label: 'GREEN' },
  yellow: { color: '#fbbf24', bg: 'rgba(251,191,36,0.18)', label: 'YELLOW' },
  red: { color: '#f87171', bg: 'rgba(248,113,113,0.18)', label: 'RED' },
};

const INTERACTION_TYPES = [
  { value: 'email_in', label: 'E-post inn' },
  { value: 'email_out', label: 'E-post ut' },
  { value: 'call', label: 'Samtale' },
  { value: 'meeting', label: 'Møte' },
  { value: 'support_ticket', label: 'Support-sak' },
  { value: 'note', label: 'Notat' },
  { value: 'qbr', label: 'QBR' },
  { value: 'churn_signal', label: 'Churn-signal' },
  { value: 'expansion_signal', label: 'Expansion-signal' },
];

const palette = {
  bg: '#150b2e',
  bgSubtle: 'rgba(168,85,247,0.04)',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#8b7ec4',
  accent: '#c084fc',
};

export default function CustomerSuccessDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [interactionsFor, setInteractionsFor] = useState<CustomerHealth | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [addOpen, setAddOpen] = useState(false);

  // Add interaction form state
  const [form, setForm] = useState({
    interactionType: 'note',
    subject: '',
    body: '',
    sentiment: '',
    followUpAt: '',
    expansionValueNok: '',
    churnRiskLevel: '',
  });

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin-room/customer-success/dashboard', { credentials: 'include' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      setData(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const openCustomer = async (c: CustomerHealth) => {
    setInteractionsFor(c);
    try {
      const r = await fetch(`/api/admin-room/customers/${c.userId}/interactions`, {
        credentials: 'include',
      });
      if (r.ok) {
        const body = await r.json();
        setInteractions(body.interactions ?? []);
      }
    } catch (e) {
      // noop
    }
  };

  const submitInteraction = async () => {
    if (!interactionsFor) return;
    try {
      const body: Record<string, unknown> = {
        interactionType: form.interactionType,
        subject: form.subject || undefined,
        body: form.body || undefined,
        sentiment: form.sentiment || undefined,
        followUpAt: form.followUpAt || undefined,
        expansionValueNok: form.expansionValueNok ? Number(form.expansionValueNok) : undefined,
        churnRiskLevel: form.churnRiskLevel || undefined,
      };
      const r = await fetch(`/api/admin-room/customers/${interactionsFor.userId}/interactions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        setAddOpen(false);
        setForm({ interactionType: 'note', subject: '', body: '', sentiment: '', followUpAt: '', expansionValueNok: '', churnRiskLevel: '' });
        await openCustomer(interactionsFor);
      }
    } catch (e) {
      // noop
    }
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}` }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress sx={{ color: palette.accent }} />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}` }}>
        <CardContent><Alert severity="error">{error ?? 'Ingen data'}</Alert></CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
      <CardContent>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.4,
              bgcolor: 'rgba(168,85,247,0.12)',
              border: `1px solid ${palette.borderStrong}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FavoriteBorderOutlinedIcon sx={{ color: palette.accent, fontSize: 24 }} />
            </Box>
            <Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: palette.textPrimary }}>
                Customer Success
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                Helse · fornyelse · interaksjoner
              </Typography>
            </Stack>
          </Stack>
          <Tooltip title="Oppdater">
            <IconButton onClick={fetchDashboard} sx={{ color: palette.textSecondary }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Hovedtall */}
        <Stack direction="row" spacing={1.4} sx={{ mb: 3 }}>
          {[
            { label: 'Total kunder', value: data.totalCustomers, color: palette.accent },
            { label: 'Snitt-score', value: data.avgScore, color: palette.accent },
            { label: 'Røde', value: data.tierCounts.red, color: '#f87171' },
            { label: 'Renewals 30d', value: data.upcomingRenewals30d, color: '#fbbf24' },
            { label: 'Åpne follow-ups', value: data.openFollowups, color: '#60a5fa' },
            { label: 'Churn-signaler 30d', value: data.recentChurnSignals, color: '#fb923c' },
          ].map((k) => (
            <Box key={k.label} sx={{
              flex: 1, p: 1.6, borderRadius: 1.4,
              bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
            }}>
              <Typography sx={{ fontSize: '0.66rem', color: palette.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {k.label}
              </Typography>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: k.color, lineHeight: 1.1, mt: 0.4 }}>
                {k.value}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Tier-bar */}
        <Box sx={{ mb: 3, p: 1.6, borderRadius: 1.4, bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}` }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: palette.textPrimary, mb: 1 }}>
            Helsefordeling
          </Typography>
          <Stack direction="row" spacing={0.6}>
            {[
              { tier: 'green' as const, count: data.tierCounts.green },
              { tier: 'yellow' as const, count: data.tierCounts.yellow },
              { tier: 'red' as const, count: data.tierCounts.red },
            ].map((t) => {
              const meta = TIER_META[t.tier];
              const total = data.tierCounts.green + data.tierCounts.yellow + data.tierCounts.red;
              const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
              return (
                <Box key={t.tier} sx={{
                  flex: t.count, minWidth: 60,
                  p: 1, borderRadius: 1,
                  bgcolor: meta.bg, border: `1px solid ${meta.color}55`,
                  textAlign: 'center',
                }}>
                  <Typography sx={{ fontSize: '0.74rem', color: meta.color, fontWeight: 700 }}>
                    {meta.label}
                  </Typography>
                  <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: meta.color, lineHeight: 1.2 }}>
                    {t.count}
                  </Typography>
                  <Typography sx={{ fontSize: '0.66rem', color: meta.color }}>
                    {pct}%
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        {/* Kunde-liste */}
        <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: palette.textPrimary, mb: 1.4 }}>
          Trenger oppmerksomhet ({data.customers.length})
        </Typography>
        {data.customers.length === 0 ? (
          <Alert severity="info" sx={{ fontSize: '0.84rem' }}>
            Ingen kunder å vise. Kunder lastes inn fra users-tabellen — sjekk at dashboard-endpointet returnerer riktig.
          </Alert>
        ) : (
          <Stack spacing={0.8}>
            {data.customers.map((c) => {
              const meta = TIER_META[c.tier];
              return (
                <Box key={c.userId} sx={{
                  p: 1.4, borderRadius: 1.2,
                  bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
                  display: 'flex', alignItems: 'center', gap: 1.4,
                  cursor: 'pointer',
                  '&:hover': { borderColor: palette.borderStrong, bgcolor: 'rgba(168,85,247,0.08)' },
                }} onClick={() => openCustomer(c)}>
                  <GroupOutlinedIcon sx={{ color: meta.color, fontSize: 22 }} />
                  <Stack sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" spacing={0.8}>
                      <Typography sx={{ fontSize: '0.92rem', fontWeight: 700, color: palette.textPrimary }}>
                        {c.businessName || c.displayName || c.email}
                      </Typography>
                      <Chip
                        size="small" label={meta.label}
                        sx={{ bgcolor: meta.bg, color: meta.color, fontWeight: 700, fontSize: '0.66rem', height: 18 }}
                      />
                    </Stack>
                    <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted }}>
                      {c.email} · {c.signals.daysSinceLogin === null ? 'aldri logget inn' : `sist innlogget ${c.signals.daysSinceLogin}d siden`} · {c.signals.activeProjects30d} aktive prosjekt · {c.signals.stripeStatus || 'ingen Stripe'}
                    </Typography>
                    <Box sx={{ mt: 0.4 }}>
                      <LinearProgress
                        variant="determinate" value={c.overallScore}
                        sx={{
                          height: 4, borderRadius: 2,
                          bgcolor: 'rgba(168,85,247,0.10)',
                          '& .MuiLinearProgress-bar': { bgcolor: meta.color, borderRadius: 2 },
                        }}
                      />
                    </Box>
                  </Stack>
                  <Stack alignItems="center" spacing={0.2}>
                    <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: meta.color, lineHeight: 1 }}>
                      {c.overallScore}
                    </Typography>
                    <Typography sx={{ fontSize: '0.62rem', color: palette.textMuted }}>
                      L{c.loginScore} F{c.featureScore} B{c.billingScore} E{c.engagementScore}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>

      {/* Customer detail + interactions dialog */}
      <Dialog open={!!interactionsFor} onClose={() => setInteractionsFor(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {interactionsFor?.businessName || interactionsFor?.displayName || interactionsFor?.email}
          <Button
            startIcon={<AddOutlinedIcon />} onClick={() => setAddOpen(true)}
            size="small" variant="contained"
            sx={{ bgcolor: palette.accent, fontWeight: 700 }}
          >
            Legg til
          </Button>
        </DialogTitle>
        <DialogContent>
          {interactionsFor && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {(['loginScore','featureScore','billingScore','engagementScore'] as const).map((k) => {
                  const label = k.replace('Score', '').replace(/^./, (s) => s.toUpperCase());
                  return (
                    <Chip
                      key={k}
                      label={`${label}: ${interactionsFor[k]}`}
                      size="small"
                      sx={{ bgcolor: 'rgba(168,85,247,0.18)', color: palette.accent, fontWeight: 700 }}
                    />
                  );
                })}
              </Stack>
            </Box>
          )}
          {interactions.length === 0 ? (
            <Alert severity="info">Ingen interaksjoner logget ennå.</Alert>
          ) : (
            <Stack spacing={0.8}>
              {interactions.map((i) => (
                <Box key={i.id} sx={{
                  p: 1.2, borderRadius: 1,
                  bgcolor: palette.bgSubtle, border: `1px solid ${palette.border}`,
                }}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <HistoryOutlinedIcon sx={{ fontSize: 14, color: palette.textMuted }} />
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: palette.textPrimary }}>
                        {INTERACTION_TYPES.find((t) => t.value === i.interactionType)?.label ?? i.interactionType}
                      </Typography>
                      {i.churnRiskLevel && (
                        <Chip size="small" label={`Churn: ${i.churnRiskLevel}`} sx={{
                          bgcolor: 'rgba(248,113,113,0.18)', color: '#f87171', fontWeight: 700, height: 16, fontSize: '0.62rem',
                        }} />
                      )}
                    </Stack>
                    <Typography sx={{ fontSize: '0.7rem', color: palette.textMuted }}>
                      {new Date(i.occurredAt).toLocaleString('nb-NO')}
                    </Typography>
                  </Stack>
                  {i.subject && (
                    <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: palette.textPrimary }}>
                      {i.subject}
                    </Typography>
                  )}
                  {i.body && (
                    <Typography sx={{ fontSize: '0.76rem', color: palette.textSecondary, whiteSpace: 'pre-wrap', mt: 0.4 }}>
                      {i.body}
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInteractionsFor(null)}>Lukk</Button>
        </DialogActions>
      </Dialog>

      {/* Add-interaction dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Legg til interaksjon</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Select
              size="small" fullWidth value={form.interactionType}
              onChange={(e) => setForm({ ...form, interactionType: e.target.value })}
            >
              {INTERACTION_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </Select>
            <TextField
              size="small" fullWidth label="Subject"
              value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <TextField
              size="small" fullWidth label="Body" multiline rows={4}
              value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
            <Stack direction="row" spacing={1}>
              <Select
                size="small" fullWidth displayEmpty
                value={form.sentiment} onChange={(e) => setForm({ ...form, sentiment: e.target.value })}
              >
                <MenuItem value="">Sentiment (valgfritt)</MenuItem>
                <MenuItem value="positive">Positive</MenuItem>
                <MenuItem value="neutral">Neutral</MenuItem>
                <MenuItem value="negative">Negative</MenuItem>
                <MenuItem value="mixed">Mixed</MenuItem>
              </Select>
              <Select
                size="small" fullWidth displayEmpty
                value={form.churnRiskLevel} onChange={(e) => setForm({ ...form, churnRiskLevel: e.target.value })}
              >
                <MenuItem value="">Churn-risk (valgfritt)</MenuItem>
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField
                size="small" fullWidth type="datetime-local" label="Follow-up"
                InputLabelProps={{ shrink: true }}
                value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })}
              />
              <TextField
                size="small" fullWidth label="Expansion-verdi NOK" type="number"
                value={form.expansionValueNok} onChange={(e) => setForm({ ...form, expansionValueNok: e.target.value })}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Avbryt</Button>
          <Button onClick={submitInteraction} variant="contained" sx={{ bgcolor: palette.accent }}>
            Lagre
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
