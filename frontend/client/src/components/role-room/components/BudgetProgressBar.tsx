/**
 * BudgetProgressBar — faktisk-vs-godkjent som visuell bar. Flommer forbi 100%
 * ved overforbruk (rødt skravert overflow-segment) — adressererer adversarial-
 * funnet «over-budsjett usynlig fordi baren klippes til 100%». Status alltid
 * ikon-FORM + tekst (aldri farge alene). Brukes på fasekort + kategori-rader.
 */
import { Box, Stack, Typography, LinearProgress } from '@mui/material';
import {
  CheckCircleOutline as UnderIcon,
  WarningAmberOutlined as NearIcon,
  ErrorOutline as OverIcon,
  RemoveCircleOutline as PendingIcon,
} from '@mui/icons-material';

type BudgetProgressBarProps = {
  approved: number;
  actual: number;
  /** Kompakt variant (mindre tekst) for tette rader. */
  dense?: boolean;
};

export default function BudgetProgressBar({ approved, actual, dense = false }: BudgetProgressBarProps) {
  const hasRef = approved > 0;
  if (!hasRef) {
    return (
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.6 }}>
        <PendingIcon sx={{ fontSize: 13, color: 'rgba(226,232,240,0.6)' }} />
        <Typography sx={{ color: 'rgba(226,232,240,0.62)', fontSize: '11px' }}>Ikke godkjent ennå</Typography>
      </Stack>
    );
  }
  const pct = Math.round((actual / approved) * 100);
  const over = actual > approved;
  const near = !over && pct >= 90;
  const tone = over
    ? { c: '#f87171', label: `Over budsjett (${pct}%)`, Icon: OverIcon, bar: '#f87171' }
    : near
      ? { c: '#fbbf24', label: `Nær grensen (${pct}%)`, Icon: NearIcon, bar: '#fbbf24' }
      : { c: '#86efac', label: `Under budsjett (${pct}%)`, Icon: UnderIcon, bar: '#34d399' };
  const ToneIcon = tone.Icon;

  const fillPct = Math.min(100, pct);
  const overflowPct = over ? Math.min(40, pct - 100) : 0;

  return (
    <Box sx={{ mt: 0.7 }}>
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', height: 6 }}>
        <LinearProgress
          variant="determinate"
          value={fillPct}
          aria-label={tone.label}
          sx={{
            flex: over ? `0 0 ${100 / (100 + overflowPct) * 100}%` : 1,
            height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.16)',
            '& .MuiLinearProgress-bar': { borderRadius: 3, backgroundColor: tone.bar },
          }}
        />
        {over ? (
          <Box
            aria-hidden
            sx={{
              height: 6, ml: 0.4, borderRadius: 3,
              flex: `0 0 ${overflowPct / (100 + overflowPct) * 100}%`,
              background: 'repeating-linear-gradient(45deg, #ef4444 0 5px, rgba(239,68,68,0.5) 5px 10px)',
            }}
          />
        ) : null}
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.4 }}>
        <ToneIcon sx={{ fontSize: dense ? 12 : 13, color: tone.c }} />
        <Typography sx={{ color: tone.c, fontSize: dense ? '10.5px' : '11px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {tone.label}
        </Typography>
      </Stack>
    </Box>
  );
}
