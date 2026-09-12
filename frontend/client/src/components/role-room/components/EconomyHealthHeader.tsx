/**
 * EconomyHealthHeader — pris-nivå «økonomisk helse»-header øverst i Oversikt-
 * fanen i ProjectEconomyHub (innholdsprodusent-økonomi). Data-drevet fra hub-
 * ens ekte totaler (sum av phaseTotals + projectBudget), så sum-av-deler stemmer
 * per konstruksjon (adressererer data-blockerne fra adversarial-passet).
 *
 * Bygge-spec: 5-sek-test (trafikklys), bar-fyll = faktisk %, FLOMMER forbi
 * 100% ved overforbruk (rødt overflow-segment), WCAG AA (muted ≥0.78, ikon-
 * FORM + tekst aldri farge alene, tabular-nums), eksakt NOK, dempet glød.
 */
import { Box, Stack, Typography, LinearProgress } from '@mui/material';
import {
  CheckCircleOutline as OnTrackIcon,
  WarningAmberOutlined as AttentionIcon,
  ErrorOutline as OverIcon,
} from '@mui/icons-material';

type EconomyHealthHeaderProps = {
  /** Godkjent totalramme (kr). 0/ukjent → vis uten prosent. */
  budget: number;
  /** Sum faktisk forbruk (kr) — sum av phaseTotals.actual. */
  spent: number;
  /** Sum godkjent (kr) — sum av phaseTotals.approved. */
  approved: number;
  /** Antall ventende godkjenninger (driver helse → «trenger oppmerksomhet»). */
  pendingReviews?: number;
  currency?: string;
};

function formatKr(value: number, currency = 'NOK'): string {
  const rounded = Math.round(value);
  const grouped = Math.abs(rounded).toLocaleString('nb-NO');
  const sign = rounded < 0 ? '−' : '';
  return `${sign}${grouped} ${currency === 'NOK' ? 'kr' : currency}`;
}

export default function EconomyHealthHeader({
  budget, spent, approved, pendingReviews = 0, currency = 'NOK',
}: EconomyHealthHeaderProps) {
  const ramme = budget > 0 ? budget : approved;
  const hasRamme = ramme > 0;
  const utilization = hasRamme ? spent / ramme : 0;
  const pct = hasRamme ? Math.round(utilization * 100) : 0;
  const margin = ramme - spent;
  const overBudget = hasRamme && spent > ramme;

  // Helse: over budsjett → rød; ventende godkjenninger eller >90% → gul;
  // ellers grønn. Aldri farge alene — alltid ikon-form + tekst.
  const health: 'over' | 'attention' | 'ok' = overBudget
    ? 'over'
    : (pendingReviews > 0 || (hasRamme && utilization > 0.9))
      ? 'attention'
      : 'ok';
  const HEALTH = {
    over: { label: 'Over budsjett', color: '#fca5a5', bg: 'rgba(239,68,68,0.14)', border: 'rgba(248,113,113,0.42)', Icon: OverIcon },
    attention: { label: 'Trenger oppmerksomhet', color: '#fde68a', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.4)', Icon: AttentionIcon },
    ok: { label: 'Friskt', color: '#86efac', bg: 'rgba(34,197,94,0.14)', border: 'rgba(52,211,153,0.4)', Icon: OnTrackIcon },
  }[health];
  const HealthIcon = HEALTH.Icon;

  // Bar: fyll til min(100, pct); overflow-segment ut over 100 ved overforbruk.
  const fillPct = hasRamme ? Math.min(100, pct) : 0;
  const overflowPct = overBudget ? Math.min(40, pct - 100) : 0; // kapp visuelt på +40%

  return (
    <Box
      sx={{
        borderRadius: '16px',
        border: '1px solid rgba(148,163,184,0.14)',
        background: 'linear-gradient(180deg,#0c0a18,#0a0a14)',
        p: { xs: 2, md: 2.5 },
        mb: 2,
        boxShadow: '0 14px 36px rgba(0,0,0,0.4)',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Typography sx={{ color: 'rgba(226,232,240,0.82)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Prosjektets økonomiske helse
        </Typography>
        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ px: 1.2, py: 0.6, borderRadius: '999px', background: HEALTH.bg, border: `1px solid ${HEALTH.border}`, alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          <HealthIcon sx={{ fontSize: 18, color: HEALTH.color }} />
          <Typography sx={{ color: HEALTH.color, fontWeight: 700, fontSize: '13px' }}>{HEALTH.label}</Typography>
        </Stack>
      </Stack>

      {/* Nøkkeltall */}
      <Box sx={{ mt: 1.5, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
        <Metric label="Totalbudsjett" value={hasRamme ? formatKr(ramme, currency) : 'Ikke satt'} sub={budget > 0 ? 'Godkjent ramme' : approved > 0 ? 'Sum godkjent' : 'Sett en ramme for å spore'} />
        <Metric label="Brukt" value={formatKr(spent, currency)} sub={hasRamme ? `${pct}% av ramme` : 'faktisk forbruk'} valueColor={overBudget ? '#fca5a5' : '#f5f3ff'} />
        <Metric label="Margin igjen" value={formatKr(margin, currency)} sub={hasRamme ? (margin < 0 ? 'over rammen' : `${Math.max(0, 100 - pct)}% buffer`) : '—'} valueColor={margin < 0 ? '#fca5a5' : '#86efac'} />
      </Box>

      {/* Progress: fyll + overflow-segment ved overforbruk */}
      {hasRamme ? (
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', height: 8 }}>
            <LinearProgress
              variant="determinate"
              value={fillPct}
              aria-label={`Brukt ${pct}% av budsjettet`}
              sx={{
                flex: overBudget ? `0 0 ${100 / (100 + overflowPct) * 100}%` : 1,
                height: 8, borderRadius: 4, backgroundColor: 'rgba(148,163,184,0.16)',
                '& .MuiLinearProgress-bar': { borderRadius: 4, backgroundColor: overBudget ? '#f87171' : utilization > 0.9 ? '#fbbf24' : '#34d399' },
              }}
            />
            {overBudget ? (
              <Box
                aria-hidden
                sx={{
                  height: 8,
                  flex: `0 0 ${overflowPct / (100 + overflowPct) * 100}%`,
                  borderRadius: 4,
                  ml: 0.4,
                  background: 'repeating-linear-gradient(45deg, #ef4444 0 6px, rgba(239,68,68,0.5) 6px 12px)',
                }}
              />
            ) : null}
          </Box>
          <Typography sx={{ mt: 0.6, color: overBudget ? '#fca5a5' : 'rgba(226,232,240,0.78)', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
            {overBudget
              ? `${pct}% brukt · ${formatKr(spent - ramme, currency)} over rammen`
              : `${pct}% brukt · ${formatKr(margin, currency)} igjen`}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function Metric({ label, value, sub, valueColor = '#f5f3ff' }: { label: string; value: string; sub: string; valueColor?: string }) {
  return (
    <Box sx={{ p: 1.2, borderRadius: '12px', border: '1px solid rgba(148,163,184,0.12)', background: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ color: 'rgba(226,232,240,0.8)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ color: valueColor, fontSize: '20px', fontWeight: 800, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums', mt: 0.3 }}>{value}</Typography>
      <Typography sx={{ color: 'rgba(226,232,240,0.78)', fontSize: '11.5px', mt: 0.2 }}>{sub}</Typography>
    </Box>
  );
}
