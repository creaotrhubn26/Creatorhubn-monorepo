/**
 * InjuryRecoveryCard — rehab-seksjon for en skadeoppføring i Skadelogg-fanen
 * (DanceWorkspace "injuries"). Porter overlay-designet fra Post Agent
 * (rr-dance-skadelogg) til en ekte komponent: REHABILITERING-fremdrift +
 * 4-stegs tidslinje (Akutt → Behandling → Opptrening → Retur) + dato-chips.
 *
 * Steg/prosent leses fra entry.stage / entry.progressPercent (migrasjon 0152).
 * Når de er NULL, UTLEDES de av status + entry/expectedReturn-datoer, slik at
 * eksisterende oppføringer (uten eksplisitt steg) også får et pent rehab-løp.
 */

import * as React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HealingOutlinedIcon from '@mui/icons-material/HealingOutlined';
import FitnessCenterOutlinedIcon from '@mui/icons-material/FitnessCenterOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import MonitorHeartOutlinedIcon from '@mui/icons-material/MonitorHeartOutlined';
import { danceFlowColors } from './danceFlowTheme';
import { INJURY_STAGES, type InjuryLogEntry, type InjuryStage } from './dancerInjuryLogService';

const STAGE_META: Record<InjuryStage, { label: string; Icon: typeof HealingOutlinedIcon }> = {
  acute: { label: 'Akutt', Icon: ReportProblemOutlinedIcon },
  treatment: { label: 'Behandling', Icon: HealingOutlinedIcon },
  retraining: { label: 'Opptrening', Icon: FitnessCenterOutlinedIcon },
  return: { label: 'Retur', Icon: VerifiedOutlinedIcon },
};

const ACCENT = danceFlowColors.lavender;
const SUCCESS = danceFlowColors.successDark;
const MUTED = 'rgba(229,231,235,0.55)';

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Utled aktivt steg-indeks når entry.stage ikke er satt. */
function deriveStageIndex(entry: InjuryLogEntry): number {
  if (entry.stage) return INJURY_STAGES.indexOf(entry.stage);
  if (entry.status === 'resolved') return 3;
  if (entry.status === 'healing') return 2;
  return 0;
}

/** Utled rehab-prosent når entry.progressPercent ikke er satt. */
function deriveProgress(entry: InjuryLogEntry): number {
  if (entry.progressPercent != null) return clamp(entry.progressPercent);
  if (entry.status === 'resolved') return 100;
  if (entry.entryDate && entry.expectedReturnDate) {
    const start = new Date(entry.entryDate).getTime();
    const end = new Date(entry.expectedReturnDate).getTime();
    const now = Date.now();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      return clamp(((now - start) / (end - start)) * 100);
    }
  }
  return entry.status === 'healing' ? 60 : 20;
}

function fmt(date: string | null, opts: Intl.DateTimeFormatOptions): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('nb-NO', opts);
}

export interface InjuryRecoveryCardProps {
  entry: InjuryLogEntry;
  /** Callback for «Øvingslogg»-lenken (bytt til øvingslogg-fanen). */
  onOpenLog?: () => void;
}

export function InjuryRecoveryCard({ entry, onOpenLog }: InjuryRecoveryCardProps): React.ReactElement {
  const stageIndex = deriveStageIndex(entry);
  const progress = deriveProgress(entry);
  const isResolved = entry.status === 'resolved';
  const barColor = isResolved ? SUCCESS : ACCENT;

  return (
    <Box
      data-testid={`injury-recovery-${entry.id}`}
      sx={{ mt: 1.75, pt: 1.75, borderTop: `1px solid ${danceFlowColors.borderStrong}` }}
    >
      {/* Rehabilitering-fremdrift */}
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography
          sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: ACCENT,
          }}
        >
          Rehabilitering
        </Typography>
        <Typography sx={{ fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
          {progress}%
        </Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(167,139,250,0.14)', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%', width: `${progress}%`, borderRadius: 999,
            background: isResolved
              ? `linear-gradient(90deg, ${danceFlowColors.successPrimary}, ${SUCCESS})`
              : `linear-gradient(90deg, ${danceFlowColors.lavenderDeep}, ${ACCENT})`,
            transition: 'width 240ms ease',
          }}
        />
      </Box>

      {/* 4-stegs tidslinje */}
      <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
        {INJURY_STAGES.map((stage, i) => {
          const meta = STAGE_META[stage];
          const done = isResolved || i < stageIndex;
          const current = !isResolved && i === stageIndex;
          const active = done || current;
          const ringColor = done ? barColor : current ? ACCENT : 'rgba(167,139,250,0.22)';
          return (
            <Stack key={stage} alignItems="center" spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'grid', placeItems: 'center',
                  bgcolor: active ? 'rgba(167,139,250,0.16)' : 'rgba(167,139,250,0.05)',
                  border: `1.5px solid ${ringColor}`,
                  boxShadow: current ? `0 0 0 4px rgba(167,139,250,0.12)` : 'none',
                }}
              >
                <meta.Icon sx={{ fontSize: 20, color: active ? '#fff' : MUTED }} />
              </Box>
              <Typography
                sx={{
                  fontSize: 12, fontWeight: current ? 800 : 600,
                  color: active ? '#fff' : MUTED, textAlign: 'center',
                }}
              >
                {meta.label}
              </Typography>
            </Stack>
          );
        })}
      </Stack>

      {/* Dato-footer + øvingslogg */}
      <Stack
        direction="row" alignItems="center" spacing={2.5}
        sx={{ mt: 2, pt: 1.5, borderTop: `1px solid ${danceFlowColors.borderStrong}`, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <EventOutlinedIcon sx={{ fontSize: 18, color: ACCENT }} />
          <Box>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase' }}>
              Registrert
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {fmt(entry.entryDate, { day: 'numeric', month: 'long' })}
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1}>
          <EventAvailableOutlinedIcon sx={{ fontSize: 18, color: isResolved ? SUCCESS : MUTED }} />
          <Box>
            <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase' }}>
              {isResolved ? 'Friskmeldt' : 'Forventet retur'}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: isResolved ? SUCCESS : '#fff' }}>
              {fmt(isResolved ? entry.resolvedDate : entry.expectedReturnDate, { day: 'numeric', month: 'long' })}
            </Typography>
          </Box>
        </Stack>

        {onOpenLog ? (
          <Stack
            direction="row" alignItems="center" spacing={0.75}
            onClick={onOpenLog}
            sx={{ ml: 'auto', cursor: 'pointer', color: ACCENT, '&:hover': { color: danceFlowColors.lavenderLight } }}
          >
            <MonitorHeartOutlinedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Øvingslogg
            </Typography>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
