/**
 * PlannerProjectHealthBadge — kompakt helse/fase/neste-milepæl-indikator for
 * et prosjekt. Drysses inn i prosjekt-velger-kortene så velgeren blir et
 * helse-bevisst «kommandosenter» (du ser hvert prosjekts tilstand når du
 * velger). Avleder samme helse-logikk som PlannerProjectOverview.
 *
 * Bygge-spec: status m/ ikon-FORM + tekst (aldri farge alene), ekte datoer /
 * «om N dager», muted ≥0.78.
 */
import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  CheckCircleOutline as OnTrackIcon,
  WarningAmberOutlined as AttentionIcon,
  HourglassEmptyOutlined as WaitingIcon,
  ErrorOutline as AtRiskIcon,
} from '@mui/icons-material';
import type { CastingProject, ProducerPlanningPhase } from '../models/casting';

type Health = 'on_track' | 'needs_attention' | 'waiting' | 'at_risk';

const PHASE_SHORT: Record<ProducerPlanningPhase, string> = {
  preproduction: 'Pre',
  production: 'Prod',
  postproduction: 'Post',
};
const HEALTH_META: Record<Health, { label: string; color: string; Icon: typeof OnTrackIcon }> = {
  on_track: { label: 'På sporet', color: '#86efac', Icon: OnTrackIcon },
  needs_attention: { label: 'Oppmerksomhet', color: '#fde68a', Icon: AttentionIcon },
  waiting: { label: 'Venter på klient', color: '#bfdbfe', Icon: WaitingIcon },
  at_risk: { label: 'I fare', color: '#fca5a5', Icon: AtRiskIcon },
};
const MS_PER_DAY = 86_400_000;

function relDay(iso: string | undefined | null, now: number): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(t); b.setHours(0, 0, 0, 0);
  const d = Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
  if (d === 0) return 'i dag';
  if (d === 1) return 'i morgen';
  if (d > 1) return `om ${d} dager`;
  if (d === -1) return 'i går';
  return `${Math.abs(d)} dager siden`;
}

export default function PlannerProjectHealthBadge({ project }: { project: CastingProject }) {
  const now = Date.now();
  const model = useMemo(() => {
    const phasePlan = project.producerPlanning?.phasePlan ?? [];
    const meta = project.producerWorkflowMeta;
    const pending = (meta?.pendingReviews ?? 0) + (meta?.changesRequestedReviews ?? 0);
    const atRisk = phasePlan.some((p) => p.status === 'at_risk');
    const health: Health = atRisk
      ? 'at_risk'
      : pending > 0
        ? 'needs_attention'
        : project.producerWorkflowStatus === 'awaiting_client'
          ? 'waiting'
          : 'on_track';
    const activePhase = phasePlan.find((p) => p.status === 'in_progress')
      ?? phasePlan.find((p) => p.status !== 'completed')
      ?? null;
    const next = phasePlan
      .filter((p) => p.status !== 'completed' && p.endDate)
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0] ?? null;
    return { health, phase: activePhase?.phase ?? null, next };
  }, [project, now]);

  // Ingen produsent-planleggingsdata → ikke vis støy.
  if (!project.producerPlanning?.phasePlan?.length && !project.producerWorkflowMeta && !project.producerWorkflowStatus) {
    return null;
  }

  const hm = HEALTH_META[model.health];
  const HealthIcon = hm.Icon;

  return (
    <Stack direction="row" spacing={0.7} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      <Stack direction="row" spacing={0.35} alignItems="center" sx={{ px: 0.7, py: 0.2, borderRadius: '999px', background: `${hm.color}1f`, border: `1px solid ${hm.color}55` }}>
        <HealthIcon sx={{ fontSize: 13, color: hm.color }} />
        <Typography sx={{ color: hm.color, fontSize: '0.68rem', fontWeight: 700 }}>{hm.label}</Typography>
      </Stack>
      {model.phase ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '0.68rem', fontWeight: 600 }}>
          {PHASE_SHORT[model.phase]}
        </Typography>
      ) : null}
      {model.next?.endDate ? (
        <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
          Neste: {relDay(model.next.endDate, now)}{model.next.title ? ` · ${model.next.title}` : ''}
        </Typography>
      ) : null}
    </Stack>
  );
}
