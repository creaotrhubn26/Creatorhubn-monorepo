/**
 * SelfTapeScriptCard — manus med highlighted aktiv linje
 *
 * Parser markdown med pattern: **CHARACTER**\nDialog\n
 * Marker en av linjene som "aktiv" via spesielle markører
 * (i fase B: hardkodet til "highlight 3. linje" som matcher mockup).
 */
import { Box, Stack, Typography } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { useMemo } from 'react';

import { palette, radius } from '../../theme';

interface Props {
  sceneLabel: string | null;
  sidesPages: number | null;
  sidesContent: string | null;
}

interface ScriptLine {
  character: string;
  dialog: string;
}

function parseScript(md: string | null): ScriptLine[] {
  if (!md) return [];
  const lines: ScriptLine[] = [];
  // Format: **NAME**\nDialog text\n\n**NAME**\n...
  const blocks = md.split(/\n\s*\n/);
  for (const block of blocks) {
    const match = block.match(/^\*\*([^*]+)\*\*\s*\n([\s\S]+)$/);
    if (match) {
      lines.push({ character: match[1].trim(), dialog: match[2].trim() });
    }
  }
  return lines;
}

export default function SelfTapeScriptCard({ sceneLabel, sidesPages, sidesContent }: Props) {
  const lines = useMemo(() => parseScript(sidesContent), [sidesContent]);
  // Fase B: highlight 3. linje (matcher mockup #15 — "You said a lot of things...")
  const highlightIndex = 2;

  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.4,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '1rem' }}>
          Manus / scene
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.4}
          sx={{ color: palette.accentBright, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
        >
          Se hele manus
          <ArrowForwardOutlinedIcon sx={{ fontSize: 14 }} />
        </Stack>
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ color: palette.textPrimary, fontSize: '1.05rem', fontWeight: 700 }}>
          {sceneLabel ?? '—'}
        </Typography>
        <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem' }}>
          {sidesPages ? `${sidesPages} sider` : ''}
        </Typography>
      </Stack>

      {lines.length === 0 ? (
        <Typography sx={{ color: palette.textMuted, fontSize: '0.88rem', fontStyle: 'italic' }}>
          Ingen manus lastet inn for denne scenen.
        </Typography>
      ) : (
        <Stack spacing={1.6} sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {lines.map((line, idx) => {
            const isActive = idx === highlightIndex;
            return (
              <Box
                key={idx}
                sx={{
                  px: isActive ? 2 : 0,
                  py: isActive ? 1.4 : 0,
                  borderLeft: isActive ? `3px solid ${palette.accentBright}` : 'none',
                  borderRadius: isActive ? `0 ${radius.sm} ${radius.sm} 0` : 0,
                  bgcolor: isActive ? 'rgba(168,85,247,0.16)' : 'transparent',
                }}
              >
                <Typography
                  sx={{
                    color: palette.textMuted,
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    letterSpacing: 0.1,
                    textTransform: 'uppercase',
                  }}
                >
                  {line.character}
                </Typography>
                <Typography
                  sx={{
                    color: palette.textPrimary,
                    fontSize: '0.94rem',
                    lineHeight: 1.5,
                    mt: 0.4,
                  }}
                >
                  {line.dialog}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
