/**
 * MarketingSegmentsTab.tsx
 *
 * Admin Room-flate for «målrettet markedsføring»-broen: definer segmenter fra
 * Tier-1/ICP-CRM, forhåndsvis medlemstall, og materialiser til Google/Meta/
 * LinkedIn-audiences — og se refresh-status per audience.
 *
 * Bruker marketingSegmentsApi (adminRoomApi, Bearer-auth).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  marketingSegmentsApi,
  type MarketingAudiencePlatform,
  type MarketingSegment,
} from '../../../services/adminRoomApi';

const TIERS = ['T1', 'T2', 'T3'] as const;
const SEGMENT_OPTIONS = [
  'casting_director',
  'producer',
  'director',
  'press',
  'nfi',
  'nsf',
  'dp',
  'sound',
  'editor',
  'first_ad',
] as const;
const STATUS_OPTIONS = ['cold', 'warm', 'hot', 'contacted', 'replied', 'meeting', 'won', 'lost'] as const;

const PLATFORMS: Array<{ value: MarketingAudiencePlatform; label: string; accountLabel: string; hint: string }> = [
  { value: 'google_customer_match', label: 'Google Customer Match', accountLabel: 'Google Ads customer-ID', hint: '10 sifre' },
  { value: 'meta_custom_audience', label: 'Meta Custom Audience', accountLabel: 'Meta ad account-ID', hint: 'act_XXXXXXXXX' },
  { value: 'linkedin_matched_audience', label: 'LinkedIn Matched Audience', accountLabel: 'LinkedIn ad account-URN', hint: 'urn:li:sponsoredAccount:X' },
];

const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

function statusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'synced') return 'success';
  if (status === 'failed') return 'error';
  if (status === 'pending') return 'warning';
  return 'default';
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function MarketingSegmentsTab() {
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [tiers, setTiers] = useState<string[]>(['T1']);
  const [segs, setSegs] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // Preview + materialize dialogs
  const [preview, setPreview] = useState<{ id: string; total: number; sample: string[]; note?: string } | null>(null);
  const [materialize, setMaterialize] = useState<{ segment: MarketingSegment } | null>(null);
  const [platform, setPlatform] = useState<MarketingAudiencePlatform>('google_customer_match');
  const [accountId, setAccountId] = useState('');
  const [materializeResult, setMaterializeResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSegments(await marketingSegmentsApi.list());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetCreate = () => {
    setName('');
    setTiers(['T1']);
    setSegs([]);
    setStatuses([]);
    setCreateOpen(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setBusy('create');
    try {
      await marketingSegmentsApi.create({
        name: name.trim(),
        source: 'industry_targets',
        filters: { tiers, segments: segs, statuses },
      });
      resetCreate();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async (id: string) => {
    setBusy(`preview-${id}`);
    try {
      const r = await marketingSegmentsApi.preview(id);
      setPreview({ id, ...r });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleMaterialize = async () => {
    if (!materialize) return;
    setBusy('materialize');
    setMaterializeResult(null);
    try {
      const body: Parameters<typeof marketingSegmentsApi.materialize>[1] = { platform };
      if (platform === 'google_customer_match') body.customerId = accountId.trim();
      else if (platform === 'meta_custom_audience') body.adAccountId = accountId.trim();
      else body.adAccountUrn = accountId.trim();
      const r = await marketingSegmentsApi.materialize(materialize.segment.id, body);
      setMaterializeResult(
        r.ok
          ? `✓ ${r.memberCount} medlemmer lastet opp til ${PLATFORM_LABEL[r.platform] ?? r.platform}.`
          : `✗ Feilet: ${r.error ?? 'ukjent'}${r.note ? ` — ${r.note}` : ''}`,
      );
      await load();
    } catch (err) {
      setMaterializeResult(`✗ ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(`delete-${id}`);
    try {
      await marketingSegmentsApi.remove(id);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const activePlatform = useMemo(() => PLATFORMS.find((p) => p.value === platform), [platform]);

  return (
    <Box sx={{ p: 3, maxWidth: 980, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Målgrupper
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Definer segmenter fra Tier-1/ICP-CRM og materialiser dem til synkroniserte ad-audiences på Google, Meta og LinkedIn.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => setCreateOpen(true)}>
          Nytt segment
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : segments.length === 0 ? (
        <Alert severity="info">Ingen segmenter ennå. Lag ett fra Tier-1/ICP-kontaktene dine.</Alert>
      ) : (
        <Stack spacing={1.5}>
          {segments.map((s) => (
            <Card key={s.id} variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={700}>{s.name}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                      {(s.filters.tiers ?? []).map((t) => (
                        <Chip key={t} size="small" label={t} />
                      ))}
                      {(s.filters.segments ?? []).map((g) => (
                        <Chip key={g} size="small" variant="outlined" label={g} />
                      ))}
                      {(s.filters.statuses ?? []).map((st) => (
                        <Chip key={st} size="small" variant="outlined" color="info" label={st} />
                      ))}
                      {(s.filters.tiers ?? []).length === 0 &&
                        (s.filters.segments ?? []).length === 0 &&
                        (s.filters.statuses ?? []).length === 0 && (
                          <Chip size="small" variant="outlined" label="alle" />
                        )}
                    </Stack>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Forhåndsvis medlemstall">
                      <span>
                        <IconButton
                          size="small"
                          disabled={busy === `preview-${s.id}`}
                          onClick={() => handlePreview(s.id)}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Materialiser til en ad-audience">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          setMaterialize({ segment: s });
                          setAccountId('');
                          setMaterializeResult(null);
                        }}
                      >
                        <CloudUploadOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Slett segment">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={busy === `delete-${s.id}`}
                          onClick={() => handleDelete(s.id)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </Stack>

                {preview?.id === s.id && (
                  <Alert severity="info" sx={{ mt: 1 }} onClose={() => setPreview(null)}>
                    {preview.note ?? `${preview.total} medlemmer med e-post`}
                    {preview.sample.length > 0 && ` — f.eks. ${preview.sample.join(', ')}`}
                  </Alert>
                )}

                {(s.audiences ?? []).length > 0 && (
                  <>
                    <Divider sx={{ my: 1 }} />
                    <Stack spacing={0.5}>
                      {(s.audiences ?? []).map((a) => (
                        <Stack key={a.platform} direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" sx={{ minWidth: 220 }}>
                            {PLATFORM_LABEL[a.platform] ?? a.platform}
                          </Typography>
                          <Chip size="small" color={statusColor(a.status)} label={a.status} />
                          <Typography variant="body2" color="text.secondary">
                            {a.memberCount} medlemmer
                            {a.lastSyncedAt ? ` · synket ${String(a.lastSyncedAt).slice(0, 10)}` : ''}
                          </Typography>
                          {a.lastError && (
                            <Typography variant="caption" color="error">
                              {a.lastError}
                            </Typography>
                          )}
                        </Stack>
                      ))}
                    </Stack>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={resetCreate} fullWidth maxWidth="sm">
        <DialogTitle>Nytt segment (fra Tier-1/ICP-CRM)</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Navn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography variant="subtitle2" gutterBottom>
            Tier
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mb: 2 }}>
            {TIERS.map((t) => (
              <Chip
                key={t}
                label={t}
                color={tiers.includes(t) ? 'primary' : 'default'}
                onClick={() => setTiers(toggle(tiers, t))}
              />
            ))}
          </Stack>
          <Typography variant="subtitle2" gutterBottom>
            Segment (rolle)
          </Typography>
          <Stack direction="row" sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
            {SEGMENT_OPTIONS.map((g) => (
              <Chip
                key={g}
                label={g}
                size="small"
                variant={segs.includes(g) ? 'filled' : 'outlined'}
                color={segs.includes(g) ? 'primary' : 'default'}
                onClick={() => setSegs(toggle(segs, g))}
              />
            ))}
          </Stack>
          <Typography variant="subtitle2" gutterBottom>
            Status
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {STATUS_OPTIONS.map((st) => (
              <Chip
                key={st}
                label={st}
                size="small"
                variant={statuses.includes(st) ? 'filled' : 'outlined'}
                color={statuses.includes(st) ? 'info' : 'default'}
                onClick={() => setStatuses(toggle(statuses, st))}
              />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Tomme filtre = hele Tier-1/ICP-listen (kun kontakter med e-post materialiseres).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetCreate}>Avbryt</Button>
          <Button variant="contained" disabled={!name.trim() || busy === 'create'} onClick={handleCreate}>
            Opprett
          </Button>
        </DialogActions>
      </Dialog>

      {/* Materialize dialog */}
      <Dialog open={Boolean(materialize)} onClose={() => setMaterialize(null)} fullWidth maxWidth="sm">
        <DialogTitle>Materialiser «{materialize?.segment.name}»</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1, mb: 2 }}>
            <InputLabel id="platform-label">Plattform</InputLabel>
            <Select
              labelId="platform-label"
              label="Plattform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as MarketingAudiencePlatform)}
            >
              {PLATFORMS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label={activePlatform?.accountLabel}
            placeholder={activePlatform?.hint}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Laster opp hashede e-poster. Krever at du er koblet til plattformen (OAuth).
          </Typography>
          {materializeResult && (
            <Alert severity={materializeResult.startsWith('✓') ? 'success' : 'error'} sx={{ mt: 2 }}>
              {materializeResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaterialize(null)}>Lukk</Button>
          <Button
            variant="contained"
            disabled={!accountId.trim() || busy === 'materialize'}
            onClick={handleMaterialize}
          >
            Materialiser
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default MarketingSegmentsTab;
