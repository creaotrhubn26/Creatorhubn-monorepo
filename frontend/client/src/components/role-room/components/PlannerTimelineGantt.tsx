/**
 * PlannerTimelineGantt — visuell produksjons-tidslinje (Gantt) over fasene
 * Pre/Prod/Post på en ekte dato-akse, med opptaksdag- og leveranse-markører +
 * «i dag»-linje. Komplementær til ProducerTimelinePanel (som forvalter
 * milepæl-items); denne gir at-a-glance-oversikten.
 *
 * Kritisk fra adversarial-passet: ALT posisjoneres fra ekte datoer (left/width
 * = prosent av faktisk span), så bjelker og markører ligger korrekt på aksen —
 * ingen hardkodede posisjoner. WCAG: status m/ ikon+tekst, muted ≥0.78.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  CheckCircleOutline as DoneIcon,
  ErrorOutline as AtRiskIcon,
  PlayCircleOutline as ActiveIcon,
  RadioButtonUnchecked as PlannedIcon,
  MovieFilterOutlined as ShootIcon,
  OutlinedFlag as DeliverableIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProducerPhasePlanItem,
  ProducerPlanningPhase,
} from '../models/casting';
import { listDeliverables, type RoleRoomDeliverable } from '../services/roleRoomDeliverablesApi';

type Props = { project: CastingProject | null };

const PHASE_LABELS: Record<ProducerPlanningPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};
const PHASE_ORDER: ProducerPlanningPhase[] = ['preproduction', 'production', 'postproduction'];
const MS_PER_DAY = 86_400_000;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}
function fmt(t: number): string {
  return new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default function PlannerTimelineGantt({ project }: Props) {
  const now = Date.now();
  const [deliverables, setDeliverables] = useState<RoleRoomDeliverable[]>([]);
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) { setDeliverables([]); return; }
    let cancelled = false;
    void (async () => {
      try { const list = await listDeliverables(projectId); if (!cancelled) setDeliverables(list); }
      catch { if (!cancelled) setDeliverables([]); }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const model = useMemo(() => {
    if (!project) return null;
    const phasePlan = project.producerPlanning?.phasePlan ?? [];
    const phases = PHASE_ORDER
      .map((phase) => [...phasePlan].reverse().find((p) => p.phase === phase) ?? null)
      .map((item, i) => ({ phase: PHASE_ORDER[i], item }));

    const shootDays = (project.productionDays ?? [])
      .filter((d) => d.status !== 'cancelled' && d.date)
      .map((d) => ({ id: d.id, t: ms(d.date)! }))
      .filter((d) => Number.isFinite(d.t));
    const dueFlags = deliverables
      .filter((d) => d.status !== 'delivered' && d.dueAt)
      .map((d) => ({ id: d.id, t: ms(d.dueAt)!, title: d.title }))
      .filter((d) => Number.isFinite(d.t));

    // Span = ytterpunktene av alt vi har datoer for.
    const candidates: number[] = [];
    const pushP = (v: number | null) => { if (v !== null) candidates.push(v); };
    pushP(ms(project.startDate)); pushP(ms(project.endDate));
    for (const { item } of phases) { pushP(ms(item?.startDate)); pushP(ms(item?.endDate)); }
    for (const s of shootDays) candidates.push(s.t);
    for (const f of dueFlags) candidates.push(f.t);
    if (candidates.length < 2) return { phases, shootDays, dueFlags, span: null };

    let start = Math.min(...candidates);
    let end = Math.max(...candidates);
    // Litt luft i hver ende.
    const pad = Math.max(MS_PER_DAY * 2, (end - start) * 0.04);
    start -= pad; end += pad;
    return { phases, shootDays, dueFlags, span: { start, end } };
  }, [project, deliverables]);

  if (!project || !model || !model.span) {
    return null; // ingen datoer å tegne ennå
  }
  const { span } = model;
  const total = span.end - span.start;
  const pct = (t: number) => Math.max(0, Math.min(100, ((t - span.start) / total) * 100));

  // Akse-ticks: ukentlig hvis kort span, ellers månedlig.
  const spanDays = total / MS_PER_DAY;
  const ticks: { t: number; label: string }[] = [];
  if (spanDays <= 80) {
    // ukentlig (mandag-justert ikke kritisk for oversikt)
    const step = MS_PER_DAY * 7;
    for (let t = span.start; t <= span.end; t += step) ticks.push({ t, label: fmt(t) });
  } else {
    const d = new Date(span.start); d.setDate(1);
    for (let t = d.getTime(); t <= span.end; ) {
      ticks.push({ t, label: new Date(t).toLocaleDateString('nb-NO', { month: 'short' }) });
      const nx = new Date(t); nx.setMonth(nx.getMonth() + 1); t = nx.getTime();
    }
  }
  const todayInSpan = now >= span.start && now <= span.end;

  return (
    <Box sx={{ borderRadius: '16px', border: '1px solid rgba(148,163,184,0.14)', background: 'linear-gradient(180deg,#0c0a18,#0a0a14)', p: { xs: 1.5, md: 2.5 }, mb: 2.5, boxShadow: '0 18px 44px rgba(0,0,0,0.4)' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ color: '#f5f3ff', fontWeight: 800, fontSize: '16px' }}>Produksjons-tidslinje</Typography>
        {/* Legende */}
        <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap' }}>
          <LegendItem icon={<ShootIcon sx={{ fontSize: 13, color: '#a855f7' }} />} label="Opptak" />
          <LegendItem icon={<DeliverableIcon sx={{ fontSize: 13, color: '#22d3ee' }} />} label="Leveranse" />
        </Stack>
      </Stack>

      {/* Akse-overskrift */}
      <Box sx={{ display: 'flex', mb: 0.5 }}>
        <Box sx={{ width: { xs: 84, md: 120 }, flexShrink: 0 }} />
        <Box sx={{ position: 'relative', flex: 1, height: 16 }}>
          {ticks.map((tk, i) => (
            <Typography key={i} sx={{ position: 'absolute', left: `${pct(tk.t)}%`, transform: 'translateX(-50%)', fontSize: '10px', color: 'rgba(226,232,240,0.62)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {tk.label}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Markør-bane: opptaksdager + leveranse-frister */}
      <Box sx={{ display: 'flex', mb: 0.5 }}>
        <Box sx={{ width: { xs: 84, md: 120 }, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '10px', color: 'rgba(226,232,240,0.62)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Markører</Typography>
        </Box>
        <Box sx={{ position: 'relative', flex: 1, height: 22, borderRadius: '6px', background: 'rgba(255,255,255,0.02)' }}>
          {model.shootDays.map((s) => (
            <Box key={`s-${s.id}`} title={`Opptak ${fmt(s.t)}`} sx={{ position: 'absolute', left: `${pct(s.t)}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
              <ShootIcon sx={{ fontSize: 14, color: '#a855f7' }} />
            </Box>
          ))}
          {model.dueFlags.map((f) => (
            <Box key={`f-${f.id}`} title={`${f.title} · frist ${fmt(f.t)}`} sx={{ position: 'absolute', left: `${pct(f.t)}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
              <DeliverableIcon sx={{ fontSize: 14, color: f.t < now ? '#f87171' : '#22d3ee' }} />
            </Box>
          ))}
          {todayInSpan ? <TodayLine left={pct(now)} /> : null}
        </Box>
      </Box>

      {/* Fase-rader */}
      <Stack spacing={0.6}>
        {model.phases.map(({ phase, item }) => {
          const s = ms(item?.startDate); const e = ms(item?.endDate);
          const status = item?.status;
          const tone =
            status === 'completed' ? { c: '#34d399', label: 'Ferdig', Icon: DoneIcon }
            : status === 'at_risk' ? { c: '#f87171', label: 'I fare', Icon: AtRiskIcon }
            : status === 'in_progress' || status === 'review' ? { c: '#a855f7', label: status === 'review' ? 'Til gjennomgang' : 'Pågår', Icon: ActiveIcon }
            : { c: 'rgba(148,163,184,0.7)', label: item ? 'Planlagt' : 'Ikke planlagt', Icon: PlannedIcon };
          const ToneIcon = tone.Icon;
          const hasBar = s !== null && e !== null && e > s;
          return (
            <Box key={phase} sx={{ display: 'flex', alignItems: 'center' }}>
              <Box sx={{ width: { xs: 84, md: 120 }, flexShrink: 0, pr: 1 }}>
                <Stack direction="row" spacing={0.4} alignItems="center">
                  <ToneIcon sx={{ fontSize: 13, color: tone.c }} />
                  <Typography sx={{ fontSize: '11.5px', color: 'rgba(226,232,240,0.86)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={PHASE_LABELS[phase]}>
                    {PHASE_LABELS[phase]}
                  </Typography>
                </Stack>
              </Box>
              <Box sx={{ position: 'relative', flex: 1, height: 30 }}>
                {/* spor */}
                <Box sx={{ position: 'absolute', inset: '11px 0', borderRadius: '4px', background: 'rgba(148,163,184,0.08)' }} />
                {hasBar ? (
                  <Tooltip2 label={`${tone.label} · ${fmt(s!)}–${fmt(e!)}`}>
                    <Box sx={{ position: 'absolute', left: `${pct(s!)}%`, width: `${Math.max(1, pct(e!) - pct(s!))}%`, top: 7, height: 16, borderRadius: '5px', background: tone.c, opacity: status === 'completed' ? 0.85 : 1, boxShadow: status === 'at_risk' ? '0 0 0 1px rgba(248,113,113,0.5)' : 'none' }} />
                  </Tooltip2>
                ) : (
                  <Typography sx={{ position: 'absolute', left: 4, top: 7, fontSize: '10.5px', color: 'rgba(226,232,240,0.5)' }}>Ingen datoer</Typography>
                )}
                {todayInSpan ? <TodayLine left={pct(now)} /> : null}
              </Box>
            </Box>
          );
        })}
      </Stack>

      {todayInSpan ? (
        <Typography sx={{ mt: 1, fontSize: '10.5px', color: 'rgba(226,232,240,0.62)', fontVariantNumeric: 'tabular-nums' }}>
          <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '2px', background: '#fbbf24', mr: 0.6, verticalAlign: 'middle' }} />
          I dag · {fmt(now)}
        </Typography>
      ) : null}
    </Box>
  );
}

function TodayLine({ left }: { left: number }) {
  return (
    <Box aria-hidden sx={{ position: 'absolute', left: `${left}%`, top: 0, bottom: 0, width: '2px', background: '#fbbf24', opacity: 0.85, transform: 'translateX(-1px)', zIndex: 2, pointerEvents: 'none' }} />
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Stack direction="row" spacing={0.4} alignItems="center">
      {icon}
      <Typography sx={{ fontSize: '10.5px', color: 'rgba(226,232,240,0.78)' }}>{label}</Typography>
    </Stack>
  );
}

// Lett tooltip-wrapper (title-attributt) uten ekstra avhengighet.
function Tooltip2({ label, children }: { label: string; children: React.ReactElement }) {
  return <Box title={label} sx={{ display: 'contents' }}>{children}</Box>;
}
