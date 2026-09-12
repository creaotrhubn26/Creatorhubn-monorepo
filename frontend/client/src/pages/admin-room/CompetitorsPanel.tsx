/**
 * CompetitorsPanel — konkurrent-monitor i Marketing Cockpit.
 *
 * - Liste tracked konkurrent-Pages (Norwedfilm, etc.) med siste fan_count,
 *   post-aktivitet, kategori.
 * - Add-form: Page ID + nickname.
 * - Per row: "Snapshot now"-knapp som fetcher fresh data + viser diff.
 * - Klikk row → vis 30-dagers fan_count-trend (sparkline).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Stack,
  Typography, TextField, IconButton, Tooltip, Divider, Switch, FormControlLabel,
  ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import FacebookIcon from '@mui/icons-material/Facebook';
import InstagramIcon from '@mui/icons-material/Instagram';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlat';
import GroupIcon from '@mui/icons-material/Group';

interface LatestSnapshot {
  fan_count: number | null;
  name: string | null;
  category: string | null;
  website: string | null;
  recent_post_count_7d: number | null;
  recent_post_count_30d: number | null;
  snapshot_at: string;
  fetch_error: string | null;
  picture_url: string | null;
}

interface Competitor {
  id: number;
  pageId: string;
  nickname: string;
  category: string | null;
  notes: string | null;
  active: boolean;
  addedAt: string;
  autoSnapshot: boolean;
  lastSnapshotAt: string | null;
  accountType: 'facebook' | 'instagram';
  igUsername: string | null;
  latestSnapshot: LatestSnapshot | null;
}

interface Snapshot {
  id: number;
  snapshotAt: string;
  fanCount: number | null;
  recentPostCount7d: number | null;
  recentPostCount30d: number | null;
}

const PANEL_SX = {
  background: 'rgba(2,6,23,0.42)',
  border: '1px solid rgba(148,163,184,0.18)',
  color: '#e2e8f0',
} as const;

function FanCountTrend({ snapshots }: { snapshots: Snapshot[] }) {
  // Simple sparkline using inline SVG. Width 200, height 40.
  const points = snapshots.filter((s) => typeof s.fanCount === 'number');
  if (points.length < 2) {
    return (
      <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>
        Trenger ≥2 snapshots for trend (har {points.length})
      </Typography>
    );
  }
  const values = points.map((p) => p.fanCount!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 280, H = 50;
  const pts = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p.fanCount! - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const deltaColor = delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#94a3b8';
  return (
    <Box>
      <svg width={W} height={H} style={{ overflow: 'visible' }}>
        <polyline points={pts} fill="none" stroke={deltaColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => {
          const x = (i / (points.length - 1)) * W;
          const y = H - ((p.fanCount! - min) / range) * H;
          return <circle key={i} cx={x} cy={y} r={2} fill={deltaColor} />;
        })}
      </svg>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>
          {first} → {last}
        </Typography>
        <Chip
          size="small"
          label={`${delta > 0 ? '+' : ''}${delta}`}
          sx={{ background: `${deltaColor}26`, color: deltaColor, fontSize: '0.65rem', height: 16 }}
        />
      </Stack>
    </Box>
  );
}

function CompetitorRow({
  competitor, onSnapshot, onDelete, onToggleAuto, snapshots, snapshotsLoading, snapshotBusy, autoToggleBusy,
}: {
  competitor: Competitor;
  onSnapshot: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onToggleAuto: (id: number, next: boolean) => Promise<void>;
  snapshots: Snapshot[];
  snapshotsLoading: boolean;
  snapshotBusy: boolean;
  autoToggleBusy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const fan = competitor.latestSnapshot?.fan_count;
  return (
    <Box sx={{ borderBottom: '1px solid rgba(148,163,184,0.10)' }} data-testid={`competitor-row-${competitor.id}`}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
        <Avatar
          src={competitor.latestSnapshot?.picture_url || undefined}
          alt={competitor.nickname}
          sx={{
            width: 32, height: 32,
            background: 'rgba(2,6,23,0.6)',
            border: '1px solid rgba(148,163,184,0.18)',
            fontSize: '0.78rem',
            color: '#e2e8f0',
          }}
        >
          {competitor.latestSnapshot?.picture_url ? null : <GroupIcon sx={{ color: '#a78bfa', fontSize: 18 }} />}
        </Avatar>
        <Stack sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography sx={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.92rem' }}>
              {competitor.nickname}
            </Typography>
            {competitor.category && (
              <Chip label={competitor.category} size="small"
                sx={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', height: 16, fontSize: '0.6rem' }} />
            )}
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            {competitor.accountType === 'instagram'
              ? <InstagramIcon sx={{ fontSize: 12, color: '#ec4899' }} />
              : <FacebookIcon sx={{ fontSize: 12, color: '#60a5fa' }} />}
            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>
              {competitor.accountType === 'instagram'
                ? `@${competitor.igUsername || '?'}`
                : `Page ID: ${competitor.pageId}`}
              · {competitor.latestSnapshot?.snapshot_at
                ? `Sist snapshot: ${new Date(competitor.latestSnapshot.snapshot_at).toLocaleString('nb-NO')}`
                : 'Aldri snapshot'}
            </Typography>
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>fan_count</Typography>
            <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>
              {typeof fan === 'number' ? fan : '—'}
            </Typography>
          </Stack>
          <Stack alignItems="flex-end">
            <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>posts/7d</Typography>
            <Typography sx={{ fontWeight: 700, color: '#e2e8f0', fontSize: '1rem' }}>
              {competitor.latestSnapshot?.recent_post_count_7d ?? '—'}
            </Typography>
          </Stack>
          <Tooltip title={expanded ? 'Skjul trend' : 'Vis 30-d trend'}>
            <IconButton size="small" onClick={() => setExpanded((v) => !v)}
              data-testid={`competitor-expand-${competitor.id}`}>
              {expanded ? <TrendingFlatIcon sx={{ fontSize: 16, color: '#7dd3fc' }} />
                : <TrendingUpIcon sx={{ fontSize: 16, color: '#7dd3fc' }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title={competitor.autoSnapshot ? 'Auto-snapshot ON (1×/døgn)' : 'Auto-snapshot OFF — kun manuell'}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={competitor.autoSnapshot}
                  onChange={(e) => void onToggleAuto(competitor.id, e.target.checked)}
                  disabled={autoToggleBusy}
                  data-testid={`competitor-auto-toggle-${competitor.id}`}
                />
              }
              label={<Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.6)' }}>auto</Typography>}
              sx={{ m: 0 }}
            />
          </Tooltip>
          <Tooltip title="Hent nytt snapshot fra Meta API (manuell)">
            <IconButton size="small" onClick={() => void onSnapshot(competitor.id)}
              disabled={snapshotBusy} data-testid={`competitor-snapshot-${competitor.id}`}>
              {snapshotBusy ? <CircularProgress size={14} /> : <RefreshIcon sx={{ fontSize: 16, color: '#fbbf24' }} />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Fjern fra liste">
            <IconButton size="small" onClick={() => void onDelete(competitor.id)}
              data-testid={`competitor-delete-${competitor.id}`}>
              <DeleteOutlineIcon sx={{ fontSize: 16, color: '#f87171' }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {expanded && (
        <Box sx={{ pl: 5, pb: 1.5 }} data-testid={`competitor-trend-${competitor.id}`}>
          {snapshotsLoading ? <CircularProgress size={20} /> :
            snapshots.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.5)' }}>Henter trend…</Typography>
            ) : <FanCountTrend snapshots={snapshots} />}
        </Box>
      )}
    </Box>
  );
}

export default function CompetitorsPanel() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addAccountType, setAddAccountType] = useState<'facebook' | 'instagram'>('instagram');
  const [addPageId, setAddPageId] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [snapshotBusy, setSnapshotBusy] = useState<number | null>(null);
  const [snapshotData, setSnapshotData] = useState<Record<number, Snapshot[]>>({});
  const [snapshotLoading, setSnapshotLoading] = useState<Record<number, boolean>>({});
  const [autoToggleBusy, setAutoToggleBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error' | 'info'; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/role-room/marketing-cockpit/competitors?brandKey=theroleroom', { credentials: 'include' });
      if (!r.ok) throw new Error(`Status ${r.status}`);
      const d = await r.json();
      setCompetitors(Array.isArray(d.competitors) ? d.competitors : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = useCallback(async () => {
    if (!addPageId.trim() || !addNickname.trim()) {
      setNotice({ kind: 'error', msg: addAccountType === 'facebook' ? 'Page ID + nickname påkrevd.' : 'IG-handle + nickname påkrevd.' });
      return;
    }
    setAddBusy(true);
    try {
      const payload: Record<string, unknown> = {
        brandKey: 'theroleroom',
        accountType: addAccountType,
        nickname: addNickname.trim(),
      };
      if (addAccountType === 'facebook') {
        payload.pageId = addPageId.trim();
      } else {
        payload.igUsername = addPageId.trim().replace(/^@/, '');
      }
      const r = await fetch('/api/role-room/marketing-cockpit/competitors', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({ kind: 'success', msg: `Lagt til "${addNickname.trim()}" som ${addAccountType.toUpperCase()}. Klikk refresh-ikon for å hente første snapshot.` });
        setAddPageId(''); setAddNickname('');
        await load();
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Add failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setAddBusy(false);
    }
  }, [addAccountType, addPageId, addNickname, load]);

  const handleSnapshot = useCallback(async (id: number) => {
    setSnapshotBusy(id);
    try {
      const r = await fetch(`/api/role-room/marketing-cockpit/competitors/${id}/snapshot`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const d = await r.json();
      if (d.ok) {
        const diffMsg = d.diff
          ? ` Δ fans: ${d.diff.fanCountDelta > 0 ? '+' : ''}${d.diff.fanCountDelta}, Δ posts/7d: ${d.diff.postCount7dDelta > 0 ? '+' : ''}${d.diff.postCount7dDelta}`
          : ' (første snapshot)';
        setNotice({ kind: 'success', msg: `Snapshot tatt for ${d.snapshot.name}.${diffMsg}` });
        await load();
        // Refresh in-memory snapshots-cache if expanded.
        if (snapshotData[id]) await loadSnapshots(id);
      } else {
        setNotice({ kind: 'error', msg: d.fetchError || d.error || 'Snapshot failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setSnapshotBusy(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, snapshotData]);

  const handleToggleAuto = useCallback(async (id: number, next: boolean) => {
    setAutoToggleBusy(id);
    // Optimistic update so the Switch reflects immediately.
    setCompetitors((cs) => cs.map((c) => c.id === id ? { ...c, autoSnapshot: next } : c));
    try {
      const r = await fetch(`/api/role-room/marketing-cockpit/competitors/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSnapshot: next }),
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({
          kind: 'success',
          msg: next
            ? 'Auto-snapshot på. Worker tar nytt snapshot innen 1 time, deretter daglig.'
            : 'Auto-snapshot av. Bare manuelle snapshots fra nå.',
        });
      } else {
        // Rollback optimistic update
        setCompetitors((cs) => cs.map((c) => c.id === id ? { ...c, autoSnapshot: !next } : c));
        setNotice({ kind: 'error', msg: d.error || 'Toggle failed' });
      }
    } catch (err) {
      setCompetitors((cs) => cs.map((c) => c.id === id ? { ...c, autoSnapshot: !next } : c));
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setAutoToggleBusy(null);
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    if (!confirm('Slett konkurrent fra liste? Alle snapshots beholdes i DB.')) return;
    try {
      const r = await fetch(`/api/role-room/marketing-cockpit/competitors/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const d = await r.json();
      if (d.ok) {
        setNotice({ kind: 'success', msg: 'Konkurrent fjernet.' });
        await load();
      } else {
        setNotice({ kind: 'error', msg: d.error || 'Delete failed' });
      }
    } catch (err) {
      setNotice({ kind: 'error', msg: err instanceof Error ? err.message : String(err) });
    }
  }, [load]);

  const loadSnapshots = useCallback(async (id: number) => {
    setSnapshotLoading((s) => ({ ...s, [id]: true }));
    try {
      const r = await fetch(`/api/role-room/marketing-cockpit/competitors/${id}/snapshots?days=30`, { credentials: 'include' });
      const d = await r.json();
      if (d.ok) {
        setSnapshotData((s) => ({ ...s, [id]: Array.isArray(d.snapshots) ? d.snapshots : [] }));
      }
    } catch { /* ignore */ }
    finally {
      setSnapshotLoading((s) => ({ ...s, [id]: false }));
    }
  }, []);

  // Auto-load snapshots when a row is expanded.
  // We rely on the data-testid pattern; expand handler is local to CompetitorRow.
  // We can preemptively load for all competitors lazily — but to keep it cheap,
  // we let each row trigger via useEffect on expanded-state.
  // Simpler: load all competitor histories on first mount.
  useEffect(() => {
    competitors.forEach((c) => { if (!snapshotData[c.id]) void loadSnapshots(c.id); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors.length]);

  return (
    <Card sx={PANEL_SX} data-testid="panel-competitors">
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <GroupIcon sx={{ color: '#a78bfa', fontSize: 20 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e2e8f0' }}>Konkurrent-monitor</Typography>
          <Chip label={`${competitors.length} tracked`} size="small"
            sx={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd', fontSize: '0.65rem', height: 18 }} />
          <Button size="small" startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}
            data-testid="competitors-refresh"
            sx={{ ml: 'auto', color: '#7dd3fc' }}>
            {loading ? 'Henter…' : 'Refresh'}
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
        {notice && (
          <Alert severity={notice.kind} sx={{ mb: 1 }} onClose={() => setNotice(null)} data-testid="competitors-notice">
            {notice.msg}
          </Alert>
        )}

        {/* Add-form */}
        <Stack spacing={1} sx={{ mb: 1.5 }} data-testid="competitors-add-form">
          <ToggleButtonGroup
            value={addAccountType}
            exclusive
            onChange={(_, v) => v && setAddAccountType(v)}
            size="small"
            data-testid="competitor-type-toggle"
            sx={{ '& .MuiToggleButton-root': {
              color: 'rgba(203,213,225,0.6)', textTransform: 'none',
              '&.Mui-selected': { background: 'rgba(168,85,247,0.25)', color: '#c4b5fd' },
            } }}
          >
            <ToggleButton value="instagram">
              <InstagramIcon sx={{ fontSize: 16, mr: 0.5, color: '#ec4899' }} /> Instagram-handle
            </ToggleButton>
            <ToggleButton value="facebook">
              <FacebookIcon sx={{ fontSize: 16, mr: 0.5, color: '#60a5fa' }} /> Facebook Page-ID
            </ToggleButton>
          </ToggleButtonGroup>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField size="small"
              placeholder={addAccountType === 'facebook' ? 'Page ID (15+ digits)' : '@username (e.g. studiobinder)'}
              value={addPageId}
              onChange={(e) => setAddPageId(e.target.value)} data-testid="competitor-page-id-input"
              sx={{ flex: 2, '& .MuiInputBase-root': { color: '#e2e8f0' } }} />
            <TextField size="small" placeholder="Nickname (e.g. StudioBinder)" value={addNickname}
              onChange={(e) => setAddNickname(e.target.value)} data-testid="competitor-nickname-input"
              sx={{ flex: 2, '& .MuiInputBase-root': { color: '#e2e8f0' } }} />
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => void handleAdd()}
              disabled={addBusy} data-testid="competitor-add-button"
              sx={{ background: 'rgba(168,85,247,0.25)', color: '#c4b5fd',
                '&:hover': { background: 'rgba(168,85,247,0.4)' } }}>
              {addBusy ? '…' : 'Legg til'}
            </Button>
          </Stack>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(148,163,184,0.18)', my: 1 }} />

        {competitors.length === 0 && !loading ? (
          <Typography variant="body2" sx={{ color: 'rgba(203,213,225,0.5)', textAlign: 'center', py: 2 }}>
            Ingen konkurrenter tracket. Legg til en Page-ID over for å starte.
          </Typography>
        ) : (
          <Box>
            {competitors.map((c) => (
              <CompetitorRow
                key={c.id}
                competitor={c}
                onSnapshot={handleSnapshot}
                onDelete={handleDelete}
                onToggleAuto={handleToggleAuto}
                snapshots={snapshotData[c.id] || []}
                snapshotsLoading={snapshotLoading[c.id] || false}
                snapshotBusy={snapshotBusy === c.id}
                autoToggleBusy={autoToggleBusy === c.id}
              />
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
