/**
 * PlannerProjectOverview — pris-nivå «kommando/kontroll»-header for det aktive
 * prosjektet i Planner → Oversikt-fanen. Data-drevet fra CastingProject
 * (producerPlanning.phasePlan, producerWorkflowMeta, productionDays,
 * producerWorkflowStatus). Bygd mot bygge-spec'en fra det adversariale design-
 * passet:
 *   - Ekte datoer avledet fra Date (ukedag + «om N dager» beregnet, ikke hardkodet).
 *   - WCAG AA: muted tekst ≥ rgba(…,0.78), labels ≥0.80, info-tekst ≥12px.
 *   - Status formidles med ikon-FORM + tekst, aldri farge alene.
 *   - Ekte <button> med :focus-visible, klikkbare flater ≥44px.
 *   - Fremdrifts-bar-fyll = den faktiske beregnede prosenten.
 *   - Heltalls type-skala, dempet glød.
 *
 * Vises kun i content-producer-modus (casting-modus beholder DashboardPanel
 * urørt). Cross-prosjekt-kommandosenter hører hjemme i prosjekt-velgeren og
 * bygges separat.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, LinearProgress, Button } from '@mui/material';
import {
  CheckCircleOutline as OnTrackIcon,
  WarningAmberOutlined as AttentionIcon,
  HourglassEmptyOutlined as WaitingIcon,
  ErrorOutline as AtRiskIcon,
  EventOutlined as EventIcon,
  MovieFilterOutlined as ShootIcon,
  FlagOutlined as MilestoneIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import type {
  CastingProject,
  ProducerPhasePlanItem,
  ProducerPlanningPhase,
} from '../models/casting';
import {
  listDeliverables,
  type RoleRoomDeliverable,
} from '../services/roleRoomDeliverablesApi';
import { LocalShippingOutlined as DeliveryIcon } from '@mui/icons-material';

type PlannerProjectOverviewProps = {
  project: CastingProject | null;
  /** Naviger til en fane-indeks (gjenbruker panelets navigateToTab). */
  onNavigateToTab?: (tabIndex: number) => void;
  /** Fane-indekser for CTA-er (Godkjenning, Kalender, Levering). */
  approvalTabIndex?: number;
  deliveryTabIndex?: number;
  calendarTabIndex?: number;
};

type Health = 'on_track' | 'needs_attention' | 'waiting' | 'at_risk';

const PHASE_LABELS: Record<ProducerPlanningPhase, string> = {
  preproduction: 'Pre-produksjon',
  production: 'Produksjon',
  postproduction: 'Post-produksjon',
};
const PHASE_ORDER: ProducerPlanningPhase[] = ['preproduction', 'production', 'postproduction'];

const HEALTH_META: Record<Health, { label: string; color: string; bg: string; border: string; Icon: typeof OnTrackIcon }> = {
  on_track: { label: 'På sporet', color: '#86efac', bg: 'rgba(34,197,94,0.14)', border: 'rgba(52,211,153,0.4)', Icon: OnTrackIcon },
  needs_attention: { label: 'Trenger oppmerksomhet', color: '#fde68a', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.4)', Icon: AttentionIcon },
  waiting: { label: 'Venter på klient', color: '#bfdbfe', bg: 'rgba(59,130,246,0.16)', border: 'rgba(96,165,250,0.4)', Icon: WaitingIcon },
  at_risk: { label: 'I fare', color: '#fca5a5', bg: 'rgba(239,68,68,0.14)', border: 'rgba(248,113,113,0.42)', Icon: AtRiskIcon },
};

const MS_PER_DAY = 86_400_000;

/** Antall hele dager fra i dag til en ISO-dato (negativt = passert). */
function daysUntil(iso: string | undefined | null, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(t); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday.getTime()) / MS_PER_DAY);
}

/** Menneskelig «om N dager» avledet fra faktisk dato — aldri hardkodet. */
function relativeDayLabel(iso: string | undefined | null, now: number): string {
  const d = daysUntil(iso, now);
  if (d === null) return '';
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d === -1) return 'i går';
  if (d > 1) return `om ${d} dager`;
  return `${Math.abs(d)} dager siden`;
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Dato-basert fremdrift for én fase (0–100). */
function phaseProgress(item: ProducerPhasePlanItem, now: number): number {
  if (item.status === 'completed') return 100;
  const start = item.startDate ? new Date(item.startDate).getTime() : NaN;
  const end = item.endDate ? new Date(item.endDate).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return item.status === 'in_progress' || item.status === 'review' ? 50 : 0;
  }
  return clampPct(((now - start) / (end - start)) * 100);
}

export default function PlannerProjectOverview({
  project,
  onNavigateToTab,
  approvalTabIndex,
  calendarTabIndex,
  deliveryTabIndex,
}: PlannerProjectOverviewProps) {
  // Én «nå» for hele komponenten → alle nedtellinger deler samme referanse
  // (unngår at ulike rader impliserer ulike «nå»-tider, jf. kritikken).
  const now = Date.now();

  // Kommende leveranser fra den strukturerte leveranse-modellen (mig 291).
  const [deliverables, setDeliverables] = useState<RoleRoomDeliverable[]>([]);
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) { setDeliverables([]); return; }
    let cancelled = false;
    void (async () => {
      try {
        const list = await listDeliverables(projectId);
        if (!cancelled) setDeliverables(list);
      } catch {
        if (!cancelled) setDeliverables([]);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  const upcomingDeliverables = useMemo(
    () => deliverables
      .filter((d) => d.status !== 'delivered')
      .sort((a, b) => {
        if (a.dueAt && b.dueAt) return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return 0;
      }),
    [deliverables],
  );

  const model = useMemo(() => {
    if (!project) return null;
    const phasePlan = project.producerPlanning?.phasePlan ?? [];
    const meta = project.producerWorkflowMeta;
    const pending = meta?.pendingReviews ?? 0;
    const changes = meta?.changesRequestedReviews ?? 0;

    // Faser i fast Pre→Prod→Post-rekkefølge; bruk siste matchende plan-item.
    const phases = PHASE_ORDER.map((phase) => {
      const item = [...phasePlan].reverse().find((p) => p.phase === phase);
      return { phase, item };
    });

    const atRisk = phasePlan.some((p) => p.status === 'at_risk');

    // Helse avledet (ingen enkelt-felt finnes): rekkefølge etter alvorlighet.
    const health: Health = atRisk
      ? 'at_risk'
      : pending > 0 || changes > 0
        ? 'needs_attention'
        : project.producerWorkflowStatus === 'awaiting_client'
          ? 'waiting'
          : 'on_track';

    // Neste milepæl = første ikke-fullførte plan-item med sluttdato.
    const nextMilestone = phasePlan
      .filter((p) => p.status !== 'completed' && p.endDate)
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0] ?? null;

    // Opptaksdager denne uka (i dag .. +7 dager, ikke avlyst).
    const shootDays = (project.productionDays ?? [])
      .filter((d) => {
        if (d.status === 'cancelled' || !d.date) return false;
        const dd = daysUntil(d.date, now);
        return dd !== null && dd >= 0 && dd <= 7;
      })
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());

    const deliveryDays = daysUntil(project.endDate, now);

    return { health, phases, nextMilestone, shootDays, pending, changes, deliveryDays };
  }, [project, now]);

  if (!project || !model) return null;

  const hm = HEALTH_META[model.health];
  const HealthIcon = hm.Icon;
  const statusLabelMap: Record<NonNullable<CastingProject['producerWorkflowStatus']>, string> = {
    planning: 'Planlegging',
    awaiting_client: 'Venter på klient',
    changes_requested: 'Endringer ønsket',
    approved: 'Godkjent',
  };
  const workflowLabel = project.producerWorkflowStatus
    ? statusLabelMap[project.producerWorkflowStatus]
    : 'Klar for arbeid';

  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: '1px solid rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg,#0c0a18,#0a0a14)',
        p: { xs: 2, md: 2.5 },
        mb: 2.5,
        boxShadow: '0 18px 44px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Helse-header ─────────────────────────────────────────── */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1.5}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              color: '#f5f3ff', fontWeight: 800, fontSize: '18px', lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: '100%', md: 520 },
            }}
            title={project.name}
          >
            {project.name}
          </Typography>
          <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '13px', mt: 0.4 }}>
            {workflowLabel}
            {project.endDate ? (
              <>
                {' · '}Levering {formatDate(project.endDate)}
                {model.deliveryDays !== null ? (
                  <Box component="span" sx={{ color: model.deliveryDays < 0 ? '#fca5a5' : 'rgba(226,232,240,0.78)' }}>
                    {' · '}
                    {model.deliveryDays < 0 ? `${Math.abs(model.deliveryDays)} dager over` : `${model.deliveryDays} dager igjen`}
                  </Box>
                ) : null}
              </>
            ) : null}
          </Typography>
        </Box>
        {/* Helse-pill: ikon-form + tekst + farge (aldri farge alene) */}
        <Stack
          direction="row" spacing={0.8} alignItems="center"
          sx={{ px: 1.2, py: 0.7, borderRadius: '999px', background: hm.bg, border: `1px solid ${hm.border}`, flexShrink: 0 }}
        >
          <HealthIcon sx={{ fontSize: 18, color: hm.color }} />
          <Typography sx={{ color: hm.color, fontWeight: 700, fontSize: '13px' }}>{hm.label}</Typography>
        </Stack>
      </Stack>

      {/* ── Fase-fremdrift (horisontal scroll-snap på telefon) ────── */}
      <Box
        sx={{
          mt: 2, gap: 1.5,
          display: { xs: 'flex', sm: 'grid' },
          gridTemplateColumns: { sm: 'repeat(3, 1fr)' },
          overflowX: { xs: 'auto', sm: 'visible' },
          scrollSnapType: { xs: 'x mandatory', sm: 'none' },
          pb: { xs: 0.5, sm: 0 },
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {model.phases.map(({ phase, item }) => {
          const pct = item ? phaseProgress(item, now) : 0;
          const status = item?.status;
          const tone =
            status === 'completed' ? { c: '#86efac', label: 'Ferdig', Icon: OnTrackIcon }
            : status === 'at_risk' ? { c: '#fca5a5', label: 'I fare', Icon: AtRiskIcon }
            : status === 'in_progress' || status === 'review' ? { c: '#c4b5fd', label: status === 'review' ? 'Til gjennomgang' : 'Pågår', Icon: WaitingIcon }
            : { c: 'rgba(226,232,240,0.66)', label: item ? 'Planlagt' : 'Ikke planlagt', Icon: EventIcon };
          const ToneIcon = tone.Icon;
          return (
            <Box
              key={phase}
              sx={{
                p: 1.4, borderRadius: '12px',
                border: '1px solid rgba(148,163,184,0.12)',
                background: 'rgba(255,255,255,0.02)',
                minWidth: { xs: 232, sm: 'auto' },
                scrollSnapAlign: { xs: 'start', sm: 'none' },
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {PHASE_LABELS[phase]}
                </Typography>
                <Stack direction="row" spacing={0.4} alignItems="center">
                  <ToneIcon sx={{ fontSize: 14, color: tone.c }} />
                  <Typography sx={{ color: tone.c, fontSize: '11px', fontWeight: 700 }}>{tone.label}</Typography>
                </Stack>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={pct}
                aria-label={`${PHASE_LABELS[phase]}: ${pct}% fullført`}
                sx={{
                  height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.16)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundColor: status === 'at_risk' ? '#f87171' : status === 'completed' ? '#34d399' : '#a855f7',
                  },
                }}
              />
              <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '11px', mt: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                {pct}% {item?.endDate ? `· frist ${formatDate(item.endDate)}` : ''}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* ── Bunn-rad: neste milepæl · opptak · leveranser · hva haster ── */}
      <Box
        sx={{
          mt: 2, display: 'grid', gap: 1.5,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        {/* Neste milepæl */}
        <InfoTile
          icon={<MilestoneIcon sx={{ fontSize: 16, color: '#22d3ee' }} />}
          label="Neste milepæl"
        >
          {model.nextMilestone ? (
            <>
              <Typography sx={{ color: '#f5f3ff', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={model.nextMilestone.title || PHASE_LABELS[model.nextMilestone.phase]}>
                {model.nextMilestone.title || PHASE_LABELS[model.nextMilestone.phase]}
              </Typography>
              <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(model.nextMilestone.endDate)} · {relativeDayLabel(model.nextMilestone.endDate, now)}
              </Typography>
            </>
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '12px' }}>Ingen planlagte milepæler ennå</Typography>
          )}
        </InfoTile>

        {/* Opptaksdager denne uka */}
        <InfoTile
          icon={<ShootIcon sx={{ fontSize: 16, color: '#a855f7' }} />}
          label="Opptak denne uka"
          action={calendarTabIndex !== undefined && onNavigateToTab ? { label: 'Kalender', onClick: () => onNavigateToTab(calendarTabIndex) } : undefined}
        >
          {model.shootDays.length > 0 ? (
            <Stack spacing={0.3}>
              {model.shootDays.slice(0, 2).map((d) => (
                <Typography key={d.id} sx={{ color: '#f5f3ff', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(d.date!).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })} · {relativeDayLabel(d.date, now)}
                </Typography>
              ))}
              {model.shootDays.length > 2 ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '11.5px' }}>+{model.shootDays.length - 2} flere</Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '12px' }}>Ingen opptak planlagt denne uka</Typography>
          )}
        </InfoTile>

        {/* Hva haster nå (godkjenninger som venter) */}
        <InfoTile
          icon={<AttentionIcon sx={{ fontSize: 16, color: model.pending + model.changes > 0 ? '#fbbf24' : '#86efac' }} />}
          label="Venter på godkjenning"
          action={model.pending + model.changes > 0 && approvalTabIndex !== undefined && onNavigateToTab
            ? { label: 'Gå til godkjenning', onClick: () => onNavigateToTab(approvalTabIndex), primary: true }
            : undefined}
        >
          {model.pending + model.changes > 0 ? (
            <Typography sx={{ color: '#f5f3ff', fontSize: '12.5px', fontVariantNumeric: 'tabular-nums' }}>
              {model.pending > 0 ? `${model.pending} til godkjenning` : ''}
              {model.pending > 0 && model.changes > 0 ? ' · ' : ''}
              {model.changes > 0 ? `${model.changes} med endringsønske` : ''}
            </Typography>
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '12px' }}>Ingenting venter — alt er ajour</Typography>
          )}
        </InfoTile>

        {/* Kommende leveranser (fra leveranse-modellen) */}
        <InfoTile
          icon={<DeliveryIcon sx={{ fontSize: 16, color: '#a855f7' }} />}
          label="Kommende leveranser"
          action={deliveryTabIndex !== undefined && onNavigateToTab
            ? { label: 'Leveranser', onClick: () => onNavigateToTab(deliveryTabIndex) }
            : undefined}
        >
          {upcomingDeliverables.length > 0 ? (
            <Stack spacing={0.3}>
              {upcomingDeliverables.slice(0, 2).map((d) => {
                const dd = daysUntil(d.dueAt, now);
                const overdue = dd !== null && dd < 0;
                return (
                  <Box key={d.id}>
                    <Typography sx={{ color: '#f5f3ff', fontSize: '12.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.title}>
                      {d.title}
                    </Typography>
                    {d.dueAt ? (
                      <Typography sx={{ color: overdue ? '#fca5a5' : 'rgba(226,232,240,0.78)', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDate(d.dueAt)} · {relativeDayLabel(d.dueAt, now)}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
              {upcomingDeliverables.length > 2 ? (
                <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '11.5px' }}>+{upcomingDeliverables.length - 2} flere</Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography sx={{ color: 'rgba(226,232,240,0.66)', fontSize: '12px' }}>Ingen åpne leveranser</Typography>
          )}
        </InfoTile>
      </Box>
    </Box>
  );
}

function InfoTile({
  icon, label, children, action,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void; primary?: boolean };
}) {
  return (
    <Box
      sx={{
        p: 1.4, borderRadius: '12px',
        border: '1px solid rgba(148,163,184,0.12)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex', flexDirection: 'column', gap: 0.8,
      }}
    >
      <Stack direction="row" spacing={0.6} alignItems="center">
        {icon}
        <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ flex: 1 }}>{children}</Box>
      {action ? (
        <Button
          onClick={action.onClick}
          endIcon={<ArrowIcon sx={{ fontSize: 16 }} />}
          sx={{
            alignSelf: 'flex-start', textTransform: 'none', fontWeight: 700, fontSize: '12px',
            minHeight: 44, px: 1.2, borderRadius: '10px',
            color: action.primary ? '#fff' : '#c4b5fd',
            background: action.primary ? 'linear-gradient(135deg,#a855f7,#d946ef)' : 'transparent',
            '&:hover': { background: action.primary ? 'linear-gradient(135deg,#9333ea,#c026d3)' : 'rgba(168,85,247,0.1)' },
            '&:focus-visible': { outline: '2px solid #22d3ee', outlineOffset: 2 },
          }}
        >
          {action.label}
        </Button>
      ) : null}
    </Box>
  );
}
