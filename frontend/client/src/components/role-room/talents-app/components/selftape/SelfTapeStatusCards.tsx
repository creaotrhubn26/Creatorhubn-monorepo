/**
 * SelfTapeStatusCards — 3 sub-cards (Kamera / Lyd / Bilde-utsnitt).
 *
 * Leser fra `camera_check / audio_check / framing_check` som er
 * `Record<string, string>` fra AI-feedback.
 */
import { Box, Stack, Typography } from '@mui/material';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { palette, radius } from '../../theme';
import type { SelftapeAIFeedback } from '../../../services/roleRoomSelfTapesService';

interface Props {
  feedback: SelftapeAIFeedback | null;
}

const POSITIVE_VALUES = new Set([
  'great', 'good', 'clear', 'low', 'on mark', 'well lit', 'stable',
  'kraftig', 'klar', 'lav', 'god', 'stabil',
]);
const WARN_VALUES = new Set([
  'fair', 'could be better', 'medium', 'middels', 'kunne vært bedre',
]);
const BAD_VALUES = new Set([
  'poor', 'too dark', 'too noisy', 'høy', 'svak', 'mørk', 'støyete',
]);

function gradeColor(value: string | null | undefined): string {
  if (!value) return palette.textMuted;
  const v = value.toLowerCase();
  if (POSITIVE_VALUES.has(v)) return '#34d399';
  if (WARN_VALUES.has(v)) return '#fbbf24';
  if (BAD_VALUES.has(v)) return '#f87171';
  return palette.textPrimary;
}

function getRow(
  source: Record<string, string> | null | undefined,
  keys: string[],
): string {
  if (!source) return '—';
  for (const k of keys) {
    if (source[k]) return source[k];
  }
  return '—';
}

function isAllGood(source: Record<string, string> | null | undefined): boolean {
  if (!source) return false;
  const values = Object.values(source);
  if (values.length === 0) return false;
  return values.every((v) => POSITIVE_VALUES.has(v.toLowerCase()));
}

export default function SelfTapeStatusCards({ feedback }: Props) {
  const camera = feedback?.camera_check ?? null;
  const audio = feedback?.audio_check ?? null;
  const framing = feedback?.framing_check ?? null;

  return (
    <Stack direction="row" spacing={1.4} sx={{ flexWrap: 'wrap', gap: 1.4 }}>
      <StatusCard
        Icon={CameraAltOutlinedIcon}
        title="Kamera"
        allGood={isAllGood(camera)}
        rows={[
          ['Oppløsning', getRow(camera, ['resolution', 'oppløsning'])],
          ['Bilderate', getRow(camera, ['frame_rate', 'fps', 'bilderate'])],
          ['Stabilitet', getRow(camera, ['stability', 'stabilitet'])],
        ]}
      />
      <StatusCard
        Icon={GraphicEqOutlinedIcon}
        title="Lyd"
        allGood={isAllGood(audio)}
        rows={[
          ['Inngangsnivå', getRow(audio, ['input_level', 'level', 'inngangsnivå'])],
          ['Bakgrunnsstøy', getRow(audio, ['background_noise', 'noise', 'støy'])],
          ['Klarhet', getRow(audio, ['clarity', 'klarhet'])],
        ]}
      />
      <StatusCard
        Icon={CropFreeOutlinedIcon}
        title="Bilde-utsnitt"
        allGood={isAllGood(framing)}
        rows={[
          ['Hode-plass', getRow(framing, ['headroom', 'hodeplass'])],
          ['Øye-linje', getRow(framing, ['eye_line', 'øye-linje', 'eyeline'])],
          ['Lyssetting', getRow(framing, ['lighting', 'lyssetting'])],
        ]}
      />
    </Stack>
  );
}

function StatusCard({
  Icon, title, allGood, rows,
}: {
  Icon: React.ComponentType<{ sx?: object; fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>;
  title: string;
  allGood: boolean;
  rows: Array<[string, string]>;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 200,
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.4 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Icon sx={{ color: palette.textMuted, fontSize: 'small' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: palette.textPrimary }}>
            {title}
          </Typography>
        </Stack>
        {allGood ? (
          <Stack
            direction="row"
            spacing={0.6}
            alignItems="center"
            sx={{
              bgcolor: 'rgba(52,211,153,0.16)',
              color: '#34d399',
              fontWeight: 700,
              fontSize: '0.72rem',
              px: 1,
              py: 0.3,
              borderRadius: 999,
            }}
          >
            <CheckCircleOutlineIcon sx={{ fontSize: 12 }} />
            Alt OK
          </Stack>
        ) : null}
      </Stack>
      <Stack spacing={0.8}>
        {rows.map(([label, value]) => (
          <Stack key={label} direction="row" justifyContent="space-between">
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
              {label}
            </Typography>
            <Typography
              sx={{
                color: gradeColor(value),
                fontWeight: 600,
                fontSize: '0.82rem',
              }}
            >
              {value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
