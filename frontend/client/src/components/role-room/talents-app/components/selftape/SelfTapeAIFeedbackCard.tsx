/**
 * SelfTapeAIFeedbackCard — 5 kategorier (Eye line / Pacing / Sound /
 * Lighting / Performance) med grade-badges og fritekst-`note`.
 *
 * Fase B: render kun lagret feedback (status='ready').
 * Fase D: knapp for å re-trigge Claude Opus 4.7.
 */
import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import WbIncandescentOutlinedIcon from '@mui/icons-material/WbIncandescentOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { useState } from 'react';

import { palette, radius } from '../../theme';
import {
  regenerateFeedback,
  type SelftapeAIFeedback,
  type SelftapeTake,
} from '../../../services/roleRoomSelfTapesService';

interface Props {
  feedback: SelftapeAIFeedback | null;
  currentTake: SelftapeTake | null;
  onRegenerated: () => Promise<void> | void;
}

const POSITIVE_GRADES = new Set(['great', 'good', 'excellent']);
const WARN_GRADES = new Set(['fair']);
const BAD_GRADES = new Set(['needs work', 'needs_work', 'poor']);

function gradeTone(grade: string | null | undefined): { bg: string; fg: string; label: string } {
  if (!grade) return { bg: 'rgba(168,85,247,0.16)', fg: palette.accentBright, label: '—' };
  const v = grade.toLowerCase();
  if (POSITIVE_GRADES.has(v)) return { bg: 'rgba(52,211,153,0.16)', fg: '#34d399', label: grade };
  if (WARN_GRADES.has(v)) return { bg: 'rgba(251,191,36,0.18)', fg: '#fbbf24', label: grade };
  if (BAD_GRADES.has(v)) return { bg: 'rgba(248,113,113,0.18)', fg: '#f87171', label: 'trenger arbeid' };
  return { bg: 'rgba(168,85,247,0.16)', fg: palette.accentBright, label: grade };
}

function Grade({ grade }: { grade: string | null | undefined }) {
  if (!grade) return null;
  const tone = gradeTone(grade);
  return (
    <Box
      sx={{
        display: 'inline-block',
        bgcolor: tone.bg,
        color: tone.fg,
        fontWeight: 700,
        fontSize: '0.7rem',
        px: 1,
        py: 0.3,
        borderRadius: 999,
        textTransform: 'capitalize',
      }}
    >
      {tone.label}
    </Box>
  );
}

interface CategoryDef {
  key: 'eye_line' | 'pacing' | 'sound' | 'lighting' | 'performance';
  label: string;
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'eye_line', label: 'Øye-linje', Icon: VisibilityOutlinedIcon },
  { key: 'pacing', label: 'Tempo', Icon: SpeedOutlinedIcon },
  { key: 'sound', label: 'Lyd', Icon: MicNoneOutlinedIcon },
  { key: 'lighting', label: 'Lyssetting', Icon: WbIncandescentOutlinedIcon },
  { key: 'performance', label: 'Spilling', Icon: StarOutlineIcon },
];

export default function SelfTapeAIFeedbackCard({ feedback, currentTake, onRegenerated }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!currentTake) return;
    setBusy(true);
    setErr(null);
    try {
      await regenerateFeedback(currentTake.id);
      await onRegenerated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Regenerate feilet');
    } finally {
      setBusy(false);
    }
  };

  const canRegenerate = !!currentTake && !busy && feedback?.status !== 'generating';

  if (!feedback || feedback.status !== 'ready') {
    return (
      <Box
        sx={{
          bgcolor: palette.bgCard,
          border: `1px dashed ${palette.borderSubtle}`,
          borderRadius: radius.lg,
          p: 2.4,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AutoAwesomeOutlinedIcon sx={{ color: palette.accentBright, fontSize: 'small' }} />
            <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>
              AI-feedback
            </Typography>
          </Stack>
          {currentTake && feedback?.status !== 'generating' ? (
            <Box
              component="button"
              onClick={handleRegenerate}
              disabled={!canRegenerate}
              sx={{
                background: palette.accentGradient,
                color: '#fff',
                border: 'none',
                cursor: canRegenerate ? 'pointer' : 'not-allowed',
                px: 1.2,
                py: 0.4,
                borderRadius: radius.sm,
                fontWeight: 700,
                fontSize: '0.74rem',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.4,
                '&:hover': canRegenerate ? { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' } : undefined,
              }}
            >
              {busy
                ? <CircularProgress size={10} sx={{ color: '#fff' }} />
                : <AutoAwesomeOutlinedIcon sx={{ fontSize: 12 }} />}
              Kjør analyse
            </Box>
          ) : null}
        </Stack>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
          {feedback?.status === 'generating'
            ? 'AI-en analyserer takeen din nå …'
            : currentTake
              ? 'Trykk «Kjør analyse» for å få detaljert tilbakemelding fra Claude Opus 4.7.'
              : 'Spill inn en take for å motta detaljert tilbakemelding fra AI-en.'}
        </Typography>
        {err ? <Typography sx={{ color: '#f87171', fontSize: '0.78rem', mt: 1 }}>{err}</Typography> : null}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.6 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeOutlinedIcon sx={{ color: palette.accentBright, fontSize: 'small' }} />
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
            AI-feedback
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>
            {feedback.model_version ?? 'Claude Opus 4.7'}
          </Typography>
          {canRegenerate ? (
            <Box
              component="button"
              onClick={handleRegenerate}
              disabled={busy}
              title="Kjør analysen på nytt"
              sx={{
                background: 'transparent',
                color: palette.textMuted,
                border: 'none',
                cursor: 'pointer',
                p: 0.4,
                lineHeight: 0,
                '&:hover': { color: palette.accentBright },
              }}
            >
              {busy
                ? <CircularProgress size={12} sx={{ color: palette.accentBright }} />
                : <RefreshOutlinedIcon sx={{ fontSize: 14 }} />}
            </Box>
          ) : null}
        </Stack>
      </Stack>
      {err ? (
        <Typography sx={{ color: '#f87171', fontSize: '0.78rem', mb: 1 }}>{err}</Typography>
      ) : null}

      <Stack spacing={1.6}>
        {CATEGORIES.map(({ key, label, Icon }) => {
          const block = feedback[key];
          if (!block) return null;
          return (
            <Box key={key}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Icon sx={{ color: palette.textMuted, fontSize: 'small' }} />
                  <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.88rem' }}>
                    {label}
                  </Typography>
                </Stack>
                <Grade grade={block.grade} />
              </Stack>
              {block.note ? (
                <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', lineHeight: 1.5, pl: 3.4 }}>
                  {block.note}
                </Typography>
              ) : null}
            </Box>
          );
        })}
      </Stack>

      {feedback.overall_grade ? (
        <Box
          sx={{
            mt: 2,
            pt: 1.6,
            borderTop: `1px solid ${palette.borderSubtle}`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Totalt
            </Typography>
            <Grade grade={feedback.overall_grade} />
          </Stack>
        </Box>
      ) : null}
    </Box>
  );
}
