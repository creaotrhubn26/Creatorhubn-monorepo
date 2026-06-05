/**
 * SelfTapeAIFeedbackCard — 5 kategorier (Eye line / Pacing / Sound /
 * Lighting / Performance) med grade-badges og fritekst-`note`.
 *
 * Fase B: render kun lagret feedback (status='ready').
 * Fase D: knapp for å re-trigge Claude Opus 4.7.
 */
import { Box, Stack, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import MicNoneOutlinedIcon from '@mui/icons-material/MicNoneOutlined';
import WbIncandescentOutlinedIcon from '@mui/icons-material/WbIncandescentOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutline';

import { palette, radius } from '../../theme';
import type { SelftapeAIFeedback } from '../../../services/roleRoomSelfTapesService';

interface Props {
  feedback: SelftapeAIFeedback | null;
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

export default function SelfTapeAIFeedbackCard({ feedback }: Props) {
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
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <AutoAwesomeOutlinedIcon sx={{ color: palette.accentBright, fontSize: 'small' }} />
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.95rem' }}>
            AI-feedback
          </Typography>
        </Stack>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.84rem' }}>
          {feedback?.status === 'generating'
            ? 'AI-en analyserer takeen din nå …'
            : 'Spill inn en take for å motta detaljert tilbakemelding fra AI-en.'}
        </Typography>
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
        <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>
          {feedback.model_version ?? 'Claude Opus 4.7'}
        </Typography>
      </Stack>

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
