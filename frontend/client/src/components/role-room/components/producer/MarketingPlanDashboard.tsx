/**
 * MarketingPlanDashboard — «ved et blikk»-oversikt øverst i Markedsplan-fanen.
 * Porter mp-dashboard-overlay-designet: Agent-merke, tittel «Strategi for
 * <måned>», mål- + periode-chip, fire KPI-fliser, pillar-rad og kalender-
 * sammendrag.
 *
 * Datakilder (ekte):
 *  - Rekkevidde + Engasjement → fetchKpiSummary (role_room_kpi_snapshots)
 *  - Nye følgere + Leads      → plan.strategy.kpiTargets (vist som «mål» til
 *    en live-kilde kobles på — vi dikter ikke opp tall)
 *  - Pillarer                 → plan.pillars
 *  - Kalender-sammendrag      → posts (planlagte + hyppigste time)
 */

import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Chip, Tooltip } from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  Flag as FlagIcon,
  DateRange as DateRangeIcon,
  Visibility as VisibilityIcon,
  Favorite as FavoriteIcon,
  GroupAdd as GroupAddIcon,
  Handshake as HandshakeIcon,
  Category as CategoryIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type MarketingPlan,
  type MarketingPlanPost,
} from '../../services/roleRoomAgentService';

const ACCENT = '#a855f7';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

type KpiSummary = NonNullable<Awaited<ReturnType<typeof roleRoomAgentService.fetchKpiSummary>>>;

interface MarketingPlanDashboardProps {
  plan: MarketingPlan;
  posts: MarketingPlanPost[];
}

function fmtNo(n: number): string {
  const neg = n < 0;
  const v = Math.abs(Math.round(n));
  return (neg ? '-' : '') + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Kompakt tall: 320 000 → «320k», 1 200 000 → «1,2M».
function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}M`;
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k`;
  return fmtNo(n);
}

function monthName(d: Date): string {
  return d.toLocaleDateString('nb-NO', { month: 'long' });
}

// Summér en eller flere metrikker på tvers av plattformer fra KPI-summary.
function aggregateMetric(
  summary: KpiSummary['summary'],
  metrics: string[],
): { value: number; deltaPct: number | null } | null {
  const rows = summary.filter((s) => metrics.includes(s.metric));
  if (rows.length === 0) return null;
  const value = rows.reduce((acc, s) => acc + (Number(s.latestValue) || 0), 0);
  const deltas = rows.map((s) => s.deltaPct).filter((d): d is number => typeof d === 'number');
  const deltaPct = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return { value, deltaPct };
}

function findTarget(plan: MarketingPlan, pattern: RegExp): number | null {
  const hit = plan.strategy?.kpiTargets?.find((k) => pattern.test(k.metric));
  return hit ? hit.target : null;
}

export default function MarketingPlanDashboard({ plan, posts }: MarketingPlanDashboardProps) {
  const [kpi, setKpi] = useState<KpiSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void roleRoomAgentService.fetchKpiSummary(plan.id, plan.horizonDays || 30)
      .then((r) => { if (!cancelled) setKpi(r); })
      .catch(() => { if (!cancelled) setKpi(null); });
    return () => { cancelled = true; };
  }, [plan.id, plan.horizonDays]);

  // Periode + tittel-måned. Aktiv plan har startDate; ellers «30 dager».
  const { periodLabel, titleMonth } = useMemo(() => {
    if (plan.startDate) {
      const start = new Date(plan.startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + (plan.horizonDays || 30) - 1);
      const sameMonth = start.getMonth() === end.getMonth();
      const label = sameMonth
        ? `${start.getDate()}.–${end.getDate()}. ${monthName(end)} ${end.getFullYear()}`
        : `${start.getDate()}. ${monthName(start)} – ${end.getDate()}. ${monthName(end)} ${end.getFullYear()}`;
      return { periodLabel: label, titleMonth: monthName(start) };
    }
    return { periodLabel: `${plan.horizonDays || 30} dager`, titleMonth: null as string | null };
  }, [plan.startDate, plan.horizonDays]);

  // Mål-chip: foretrekk følger-mål, ellers første KPI-mål.
  const goal = useMemo(() => {
    const followers = plan.strategy?.kpiTargets?.find((k) => /follow|følger/i.test(k.metric));
    const pick = followers ?? plan.strategy?.kpiTargets?.[0] ?? null;
    if (!pick) return null;
    return `Mål: ${fmtNo(pick.target)} ${pick.metric.replace(/_/g, ' ')}`;
  }, [plan.strategy]);

  // Fire KPI-fliser. Rekkevidde/Engasjement = ekte; Følgere/Leads = mål.
  const tiles = useMemo(() => {
    const summary = kpi?.summary ?? [];
    const reach = aggregateMetric(summary, ['reach', 'impressions']);
    const engagement =
      aggregateMetric(summary, ['engagement']) ?? aggregateMetric(summary, ['likes', 'comments', 'shares', 'saves']);
    const followerTarget = findTarget(plan, /follow|følger/i);
    const leadTarget = findTarget(plan, /lead/i);

    return [
      {
        key: 'reach', label: 'Rekkevidde', icon: <VisibilityIcon sx={{ fontSize: 17, color: '#fff' }} />,
        value: reach ? fmtCompact(reach.value) : '—', delta: reach?.deltaPct ?? null, isGoal: false,
      },
      {
        key: 'engagement', label: 'Engasjement', icon: <FavoriteIcon sx={{ fontSize: 17, color: '#fff' }} />,
        value: engagement ? fmtCompact(engagement.value) : '—', delta: engagement?.deltaPct ?? null, isGoal: false,
      },
      {
        key: 'followers', label: 'Nye følgere', icon: <GroupAddIcon sx={{ fontSize: 17, color: '#fff' }} />,
        value: followerTarget != null ? fmtNo(followerTarget) : '—', delta: null, isGoal: followerTarget != null,
      },
      {
        key: 'leads', label: 'Leads', icon: <HandshakeIcon sx={{ fontSize: 17, color: '#fff' }} />,
        value: leadTarget != null ? fmtNo(leadTarget) : '—', delta: null, isGoal: leadTarget != null,
      },
    ];
  }, [kpi, plan]);

  // Kalender-sammendrag: antall planlagte + hyppigste publiseringstime.
  const calendar = useMemo(() => {
    const planned = posts.filter((p) => p.dayOffset != null || p.scheduledFor != null).length;
    const hours = new Map<number, number>();
    for (const p of posts) {
      if (!p.scheduledFor) continue;
      const h = new Date(p.scheduledFor).getHours();
      hours.set(h, (hours.get(h) ?? 0) + 1);
    }
    let bestHour: number | null = null;
    let max = 0;
    for (const [h, c] of hours) if (c > max) { max = c; bestHour = h; }
    return { planned, bestHour };
  }, [posts]);

  const kpiColors = [
    { c1: '#a855f7', c2: '#7c3aed' },
    { c1: '#d946ef', c2: '#a21caf' },
    { c1: '#8b5cf6', c2: '#6d28d9' },
    { c1: '#c026d3', c2: '#86198f' },
  ];

  return (
    <Box
      sx={{
        position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.5 }, overflow: 'hidden',
        border: '1px solid rgba(167,139,250,0.2)',
        background:
          'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.20), transparent 55%), radial-gradient(110% 80% at 100% 114%, rgba(217,70,239,0.14), transparent 50%), linear-gradient(180deg, #0a0a14 0%, #100923 55%, #1a0f2e 100%)',
        boxShadow: '0 18px 48px rgba(124,58,237,0.26)',
      }}
    >
      {/* Agent-merke */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.4 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.4, display: 'grid', placeItems: 'center', background: GRAD, boxShadow: '0 6px 16px rgba(168,85,247,0.45)' }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 12.5, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #c4b5fd, #f0abfc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Agent
        </Typography>
      </Stack>

      {/* Header: tittel + periode/mål */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} alignItems={{ md: 'flex-end' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, fontSize: 11, color: ACCENT, mb: 0.4 }}>
            Markedsplan
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: 24, color: INK, letterSpacing: '-0.4px', lineHeight: 1.06 }}>
            {titleMonth ? <>Strategi for <Box component="span" sx={{ background: GRAD, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{titleMonth}</Box></> : 'Strategi'}
          </Typography>
        </Box>
        <Stack alignItems={{ md: 'flex-end' }} spacing={1}>
          <Chip
            size="small" icon={<DateRangeIcon sx={{ fontSize: 15, color: `${ACCENT} !important` }} />} label={periodLabel}
            sx={{ bgcolor: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.28)', color: '#c4b5fd', fontWeight: 600, fontSize: 12 }}
          />
          {goal ? (
            <Chip
              size="small" icon={<FlagIcon sx={{ fontSize: 14, color: '#6ee7b7 !important' }} />} label={goal}
              sx={{ bgcolor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(110,231,183,0.30)', color: '#6ee7b7', fontWeight: 700, fontSize: 11.5 }}
            />
          ) : null}
        </Stack>
      </Stack>

      {/* 4 KPI-fliser */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.2, mb: 2 }}>
        {tiles.map((t, i) => {
          const up = t.delta == null ? null : t.delta >= 0;
          return (
            <Box key={t.key} sx={{ position: 'relative', p: 1.4, borderRadius: 2.2, border: '1px solid rgba(148,163,184,0.14)', bgcolor: 'rgba(15,23,42,0.5)', overflow: 'hidden' }}>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: 1.2, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${kpiColors[i].c1}, ${kpiColors[i].c2})`, boxShadow: `0 6px 14px ${kpiColors[i].c1}55` }}>
                  {t.icon}
                </Box>
                <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 600 }}>{t.label}</Typography>
              </Stack>
              <Stack direction="row" alignItems="baseline" spacing={0.7}>
                <Typography sx={{ fontSize: 22, fontWeight: 800, color: INK, lineHeight: 1 }}>{t.value}</Typography>
                {t.isGoal ? (
                  <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.06em' }}>mål</Typography>
                ) : up != null ? (
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: up ? '#34d399' : '#f87171' }}>
                    {up ? '+' : ''}{Math.round(t.delta as number)}%
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          );
        })}
      </Box>

      {/* Pillar-rad + kalender-sammendrag */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.4} alignItems={{ sm: 'center' }} justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <CategoryIcon sx={{ fontSize: 17, color: ACCENT }} />
          <Typography sx={{ fontSize: 12.5, color: MUTED, fontWeight: 600, flexShrink: 0 }}>Innholdspillarer</Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
            {plan.pillars.slice(0, 5).map((p) => (
              <Tooltip key={p.id} title={p.name}>
                <Chip size="small" label={p.name} sx={{ height: 20, fontSize: 11, bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff', maxWidth: 140 }} />
              </Tooltip>
            ))}
          </Stack>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ flexShrink: 0 }}>
          <ScheduleIcon sx={{ fontSize: 16, color: ACCENT }} />
          <Typography sx={{ fontSize: 12.5, color: MUTED }}>
            {calendar.planned} innlegg planlagt
            {calendar.bestHour != null ? <> · beste tid kl. {calendar.bestHour}</> : null}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
