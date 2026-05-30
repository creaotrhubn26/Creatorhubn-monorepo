/**
 * MarketingPlanWorkspace — Power BI-aktig dashboard for markedsplanen.
 *
 * Hektes inn som "marketing-plan"-surface i Arbeidsflate. Viser
 * planen i samme strukturerte oversiktsformat som Power BI:
 *   - Header med plan-status + horisont + total kost
 *   - 4 KPI-tiles: total / planlagt / publisert / dager igjen
 *   - Pillar-fordeling (horisontal bar chart)
 *   - Posts-distribusjon over tid (mini-tidslinje per uke)
 *   - Full posts-tabell med filter + sortering
 *   - "Endre plan"-knapp åpner avansert MarketingPlanPanel (eksisterende)
 *
 * Komponentet er lese-først; redigering skjer i den eksisterende
 * MarketingPlanPanel-modalen for å unngå duplisert form-logikk.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Chip,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  TextField, MenuItem, Tooltip,
} from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  TrendingUp as TrendingUpIcon,
  CalendarMonth as CalendarMonthIcon,
  RocketLaunch as RocketLaunchIcon,
  Edit as EditIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Lightbulb as LightbulbIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type MarketingPlan,
  type MarketingPlanPost,
  type MarketingPlanPillar,
  type PlanVersion,
} from '../../services/roleRoomAgentService';
import VersionPicker, { type VersionItem } from './VersionPicker';
import PostEditDialog from './PostEditDialog';
import MarketingPlanActivityFeed from './MarketingPlanActivityFeed';

interface Props {
  projectId: string;
  /** Klikk → åpne avansert plan-editor (MarketingPlanPanel-modal). */
  onOpenAdvancedEditor?: () => void;
}

const STATUS_LABELS: Record<MarketingPlanPost['status'], string> = {
  proposed: 'Forslag',
  scheduled: 'Planlagt',
  published: 'Publisert',
  skipped: 'Hoppet over',
};

const STATUS_COLORS: Record<MarketingPlanPost['status'], { bg: string; fg: string; icon: typeof CheckCircleIcon }> = {
  proposed: { bg: 'rgba(168,85,247,0.16)', fg: '#c084fc', icon: LightbulbIcon },
  scheduled: { bg: 'rgba(34,211,238,0.16)', fg: '#67e8f9', icon: ScheduleIcon },
  published: { bg: 'rgba(34,197,94,0.16)', fg: '#86efac', icon: CheckCircleIcon },
  skipped: { bg: 'rgba(148,163,184,0.14)', fg: '#94a3b8', icon: BlockIcon },
};

const FORMAT_LABELS: Record<MarketingPlanPost['format'], string> = {
  reel: 'Reel',
  carousel: 'Carousel',
  image: 'Bilde',
  story: 'Story',
  tiktok: 'TikTok',
  linkedin_post: 'LinkedIn',
  youtube_short: 'YT Short',
};

export function MarketingPlanWorkspace({ projectId, onOpenAdvancedEditor }: Props) {
  const [plan, setPlan] = useState<MarketingPlan | null>(null);
  const [posts, setPosts] = useState<MarketingPlanPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | MarketingPlanPost['status']>('all');
  const [pillarFilter, setPillarFilter] = useState<string>('all');
  const [planVersions, setPlanVersions] = useState<PlanVersion[]>([]);
  const [editingPost, setEditingPost] = useState<MarketingPlanPost | null>(null);
  const [activityNonce, setActivityNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await roleRoomAgentService.getMarketingPlan(projectId);
      setPlan(p);
      if (p?.id) {
        const [ps, vs] = await Promise.all([
          roleRoomAgentService.listMarketingPlanPosts(p.id),
          roleRoomAgentService.listPlanVersions(projectId).catch(() => []),
        ]);
        setPosts(ps);
        setPlanVersions(vs);
      } else {
        setPosts([]);
        setPlanVersions([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  // ── Aggregate metrics ────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = posts.length;
    const by: Record<MarketingPlanPost['status'], number> = {
      proposed: 0, scheduled: 0, published: 0, skipped: 0,
    };
    for (const p of posts) by[p.status]++;
    const startDate = plan?.startDate ? new Date(plan.startDate) : null;
    const horizon = plan?.horizonDays ?? 30;
    const endDate = startDate ? new Date(startDate.getTime() + horizon * 86400_000) : null;
    const daysRemaining = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400_000))
      : null;
    return { total, by, daysRemaining, horizon, startDate, endDate };
  }, [posts, plan]);

  // ── Pillar-fordeling ────────────────────────────────────────────
  const pillarDistribution = useMemo(() => {
    if (!plan) return [];
    const counts = new Map<string, number>();
    for (const p of posts) {
      const id = p.pillarId ?? '__none';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return plan.pillars.map(pillar => ({
      pillar,
      count: counts.get(pillar.id) ?? 0,
      pct: posts.length === 0 ? 0 : ((counts.get(pillar.id) ?? 0) / posts.length) * 100,
    }));
  }, [plan, posts]);

  // ── Posts per uke ─────────────────────────────────────────────
  const weeklyDistribution = useMemo(() => {
    if (!metrics.startDate || posts.length === 0) return [];
    const weeks = Math.ceil(metrics.horizon / 7);
    const buckets: Array<{ week: number; count: number; label: string }> = [];
    for (let i = 0; i < weeks; i++) {
      buckets.push({ week: i + 1, count: 0, label: `Uke ${i + 1}` });
    }
    for (const p of posts) {
      if (p.dayOffset == null) continue;
      const w = Math.floor(p.dayOffset / 7);
      if (w >= 0 && w < weeks) buckets[w].count++;
    }
    return buckets;
  }, [posts, metrics]);

  // ── Filtered posts for tabell ────────────────────────────────
  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (pillarFilter !== 'all' && p.pillarId !== pillarFilter) return false;
      return true;
    }).sort((a, b) => (a.dayOffset ?? 999) - (b.dayOffset ?? 999) || a.sortOrder - b.sortOrder);
  }, [posts, statusFilter, pillarFilter]);

  if (loading) {
    return (
      <Box sx={loadingSx}>
        <CircularProgress sx={{ color: '#ec4899' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={emptyStateSx}>
        <Typography color="error" sx={{ mb: 1 }}>{error}</Typography>
        <Button variant="outlined" onClick={() => void load()}>Prøv igjen</Button>
      </Box>
    );
  }

  if (!plan) {
    return (
      <Box sx={emptyStateSx}>
        <RocketLaunchIcon sx={{ fontSize: 48, color: 'rgba(236,72,153,0.6)' }} />
        <Typography sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.05rem', mt: 1.4 }}>
          Ingen markedsplan ennå
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.72)', fontSize: '0.88rem', mt: 0.6, maxWidth: 420, textAlign: 'center' }}>
          Generer en plan med 30 dagers innholdsforslag basert på research-en din.
          Planen blir tilgjengelig her med fullt dashboard og kalender.
        </Typography>
        {onOpenAdvancedEditor && (
          <Button variant="contained"
                  onClick={onOpenAdvancedEditor}
                  startIcon={<AutoAwesomeIcon />}
                  sx={{ mt: 2.4, bgcolor: '#ec4899', '&:hover': { bgcolor: '#db2777' } }}>
            Åpne markedsplan-generator
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box sx={containerSx} data-testid="marketing-plan-workspace">
      {/* ── Header ─────────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4}
             justifyContent="space-between" alignItems={{ md: 'flex-start' }}
             sx={{ mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
            <Typography sx={{ color: '#ec4899', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Markedsplan
            </Typography>
            <Chip size="small" label={plan.status.toUpperCase()}
                  sx={{
                    bgcolor: plan.status === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(168,85,247,0.2)',
                    color: plan.status === 'active' ? '#86efac' : '#c084fc',
                    fontWeight: 700, fontSize: '0.66rem',
                  }} />
          </Stack>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1.32rem', lineHeight: 1.2 }}>
            {plan.strategy.positioning.valueProp}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.84rem', mt: 0.3 }}>
            {metrics.horizon}-dagers horisont · {plan.pillars.length} pillars · Start{' '}
            {plan.startDate
              ? new Date(plan.startDate).toLocaleDateString('nb', { day: '2-digit', month: 'short' })
              : 'ikke satt'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.2}>
          <VersionPicker
            title="Plan-versjoner"
            versions={planVersions.map(v => ({
              id: v.id, versionNumber: v.versionNumber,
              label: v.label, isActive: v.isActive,
              generatedByKind: v.generatedByKind,
              generatedByName: v.generatedByName,
              createdAt: v.createdAt,
              previewText: v.valueProp,
              counts: [
                { label: 'pillars', value: v.pillarCount },
                { label: 'posts', value: v.postCount },
              ],
            } as VersionItem))}
            onActivate={(versionId) => roleRoomAgentService.activatePlanVersion(projectId, versionId)}
            onAfterActivate={() => {
              void load();
              setActivityNonce(n => n + 1);
            }}
          />
          {onOpenAdvancedEditor && (
            <Button variant="outlined"
                    onClick={onOpenAdvancedEditor}
                    startIcon={<EditIcon />}
                    sx={{
                      borderColor: 'rgba(236,72,153,0.4)',
                      color: '#ec4899',
                      '&:hover': { borderColor: '#ec4899', bgcolor: 'rgba(236,72,153,0.08)' },
                    }}>
              Endre plan
            </Button>
          )}
        </Stack>
      </Stack>

      {/* ── KPI-tiles ───────────────────────────────────────────── */}
      <Box sx={kpiGridSx} data-testid="kpi-tiles">
        <KpiTile label="Totalt posts" value={metrics.total}
                 icon={<RocketLaunchIcon />} color="#ec4899" />
        <KpiTile label="Publisert" value={metrics.by.published}
                 icon={<CheckCircleIcon />} color="#22c55e" />
        <KpiTile label="Planlagt" value={metrics.by.scheduled}
                 icon={<ScheduleIcon />} color="#22d3ee"
                 subtext={`${metrics.by.proposed} forslag`} />
        <KpiTile label="Dager igjen"
                 value={metrics.daysRemaining ?? '—'}
                 icon={<CalendarMonthIcon />} color="#f59e0b"
                 subtext={metrics.endDate
                   ? `Til ${metrics.endDate.toLocaleDateString('nb', { day: '2-digit', month: 'short' })}`
                   : undefined} />
      </Box>

      {/* ── Charts-rad ──────────────────────────────────────────── */}
      <Box sx={chartGridSx}>
        <ChartCard title="Pillar-fordeling"
                   subtitle={`${posts.length === 0 ? 'Ingen posts ennå' : `${posts.length} posts fordelt`}`}>
          <Stack spacing={1.2}>
            {pillarDistribution.length === 0 && (
              <Typography sx={mutedSx}>Generer posts for å se fordelingen.</Typography>
            )}
            {pillarDistribution.map(({ pillar, count, pct }) => (
              <PillarBar key={pillar.id}
                         name={pillar.name}
                         count={count}
                         pct={pct} />
            ))}
          </Stack>
        </ChartCard>

        <ChartCard title="Posts per uke"
                   subtitle={`${Math.ceil(metrics.horizon / 7)} uker total`}>
          {weeklyDistribution.length === 0 ? (
            <Typography sx={mutedSx}>Trenger startdato for å vise tidslinje.</Typography>
          ) : (
            <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 140 }}>
              {weeklyDistribution.map(w => {
                const maxCount = Math.max(1, ...weeklyDistribution.map(x => x.count));
                const h = (w.count / maxCount) * 100;
                return (
                  <Box key={w.week} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{
                      width: '70%',
                      height: `${Math.max(2, h)}%`,
                      bgcolor: w.count === 0 ? 'rgba(148,163,184,0.16)' : 'rgba(236,72,153,0.55)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 220ms ease',
                    }} />
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(226,232,240,0.6)', mt: 0.4 }}>
                      {w.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: '#f8fafc', fontWeight: 700 }}>
                      {w.count}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </ChartCard>
      </Box>

      <PostEditDialog
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={(updated) => {
          setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
          setEditingPost(null);
          setActivityNonce(n => n + 1);
        }}
      />

      {/* ── Posts-tabell ────────────────────────────────────────── */}
      <Box sx={tableCardSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
          <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '1rem' }}>
            Posts ({filteredPosts.length}{filteredPosts.length !== posts.length ? ` av ${posts.length}` : ''})
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField select size="small" value={statusFilter}
                       onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                       sx={selectSx}>
              <MenuItem value="all">Alle status</MenuItem>
              <MenuItem value="proposed">Forslag</MenuItem>
              <MenuItem value="scheduled">Planlagt</MenuItem>
              <MenuItem value="published">Publisert</MenuItem>
              <MenuItem value="skipped">Hoppet over</MenuItem>
            </TextField>
            <TextField select size="small" value={pillarFilter}
                       onChange={(e) => setPillarFilter(e.target.value)}
                       sx={selectSx}>
              <MenuItem value="all">Alle pillars</MenuItem>
              {plan.pillars.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>

        {posts.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={mutedSx}>
              Ingen posts generert ennå. Bruk "Endre plan" for å generere 30 posts basert på pillars.
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 480 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Dag</TableCell>
                  <TableCell sx={thSx}>Format</TableCell>
                  <TableCell sx={thSx}>Hook</TableCell>
                  <TableCell sx={thSx}>Pillar</TableCell>
                  <TableCell sx={thSx}>Plattform</TableCell>
                  <TableCell sx={thSx}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredPosts.map(post => {
                  const pillar = plan.pillars.find(p => p.id === post.pillarId);
                  return (
                    <PostRow key={post.id} post={post} pillar={pillar ?? null}
                              onEdit={() => setEditingPost(post)} />
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <MarketingPlanActivityFeed projectId={projectId} refreshNonce={activityNonce} />
    </Box>
  );
}

// ──────────────────── Subcomponents ────────────────────

function KpiTile({ label, value, icon, color, subtext }: {
  label: string; value: number | string; icon: React.ReactNode; color: string; subtext?: string;
}) {
  return (
    <Box sx={kpiTileSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Typography sx={{ color: 'rgba(226,232,240,0.7)', fontSize: '0.74rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        <Box sx={{ color, fontSize: 18, display: 'flex' }}>{icon}</Box>
      </Stack>
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '2.1rem', lineHeight: 1, mt: 0.6 }}>
        {value}
      </Typography>
      {subtext && (
        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem', mt: 0.4 }}>
          {subtext}
        </Typography>
      )}
    </Box>
  );
}

function ChartCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Box sx={chartCardSx}>
      <Typography sx={{ color: '#f8fafc', fontWeight: 800, fontSize: '0.96rem', mb: 0.2 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.76rem', mb: 1.4 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </Box>
  );
}

function PillarBar({ name, count, pct }: { name: string; count: number; pct: number }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.3 }}>
        <Typography sx={{ color: '#e2e8f0', fontSize: '0.84rem', fontWeight: 600 }}>
          {name}
        </Typography>
        <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.78rem', fontWeight: 700 }}>
          {count} <span style={{ color: 'rgba(226,232,240,0.5)' }}>· {pct.toFixed(0)}%</span>
        </Typography>
      </Stack>
      <Box sx={{ height: 8, bgcolor: 'rgba(148,163,184,0.12)', borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{
          width: `${pct}%`, height: '100%',
          bgcolor: '#ec4899',
          transition: 'width 240ms ease',
        }} />
      </Box>
    </Box>
  );
}

function PostRow({ post, pillar, onEdit }: {
  post: MarketingPlanPost;
  pillar: MarketingPlanPillar | null;
  onEdit: () => void;
}) {
  const statusCfg = STATUS_COLORS[post.status];
  const StatusIcon = statusCfg.icon;
  return (
    <TableRow hover
              onClick={onEdit}
              data-testid={`post-row-${post.id}`}
              sx={{
                cursor: 'pointer',
                '& td': { color: '#e2e8f0', borderBottom: '1px solid rgba(148,163,184,0.08)' },
                '&:hover': { bgcolor: 'rgba(236,72,153,0.08)' },
              }}>
      <TableCell sx={{ fontWeight: 700 }}>
        {post.dayOffset !== null ? post.dayOffset + 1 : '—'}
      </TableCell>
      <TableCell>
        <Chip size="small" label={FORMAT_LABELS[post.format]}
              sx={{ bgcolor: 'rgba(34,211,238,0.14)', color: '#67e8f9', fontSize: '0.7rem', height: 22 }} />
      </TableCell>
      <TableCell>
        <Tooltip title={post.hook} placement="top-start">
          <Typography sx={{ fontSize: '0.85rem', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {post.hook}
          </Typography>
        </Tooltip>
        {post.lastEditedAt && (
          <Typography sx={{ fontSize: '0.66rem', color: 'rgba(226,232,240,0.5)', mt: 0.15 }}>
            Sist endret {post.lastEditedByName
              ? `av ${post.lastEditedByName.split('@')[0]} `
              : ''}
            · {formatTimeAgo(post.lastEditedAt)}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.78)' }}>
          {pillar?.name ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(226,232,240,0.78)' }}>
          {post.primaryPlatform ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip size="small"
              icon={<StatusIcon sx={{ fontSize: 13, color: `${statusCfg.fg} !important` }} />}
              label={STATUS_LABELS[post.status]}
              sx={{
                bgcolor: statusCfg.bg, color: statusCfg.fg,
                fontSize: '0.7rem', height: 22, fontWeight: 700,
                '& .MuiChip-icon': { ml: 0.6 },
              }} />
      </TableCell>
    </TableRow>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'akkurat nå';
  if (min < 60) return `${min} min siden`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}t siden`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}d siden`;
  return new Date(iso).toLocaleDateString('nb', { day: '2-digit', month: 'short' });
}

// ──────────────────── Styling ────────────────────

const containerSx = {
  p: { xs: 2, md: 3 },
  background: 'radial-gradient(circle at top right, rgba(236,72,153,0.10) 0%, rgba(15,23,42,0.96) 36%, rgba(2,6,23,0.98) 100%)',
  borderRadius: 3,
  border: '1px solid rgba(236,72,153,0.16)',
  minHeight: 600,
};

const loadingSx = {
  display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 360,
};

const emptyStateSx = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minHeight: 360, p: 4, textAlign: 'center',
};

const kpiGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
  gap: 1.4, mb: 2,
};

const kpiTileSx = {
  p: 2, borderRadius: 2.2,
  bgcolor: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.14)',
};

const chartGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: 1.4, mb: 2,
};

const chartCardSx = {
  p: 2.2, borderRadius: 2.2,
  bgcolor: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.14)',
};

const tableCardSx = {
  p: 2.2, borderRadius: 2.2,
  bgcolor: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.14)',
};

const thSx = {
  color: 'rgba(226,232,240,0.78)',
  fontSize: '0.72rem',
  fontWeight: 800,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  borderBottom: '1px solid rgba(148,163,184,0.18)',
  bgcolor: 'rgba(2,6,23,0.9)',
};

const mutedSx = {
  color: 'rgba(226,232,240,0.6)',
  fontSize: '0.84rem',
};

const selectSx = {
  minWidth: 140,
  '& .MuiInputBase-root': {
    color: '#e2e8f0', fontSize: '0.82rem',
    bgcolor: 'rgba(15,23,42,0.6)',
  },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.2)' },
  '& .MuiSelect-icon': { color: 'rgba(226,232,240,0.6)' },
};

export default MarketingPlanWorkspace;
