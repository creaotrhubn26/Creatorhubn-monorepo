/**
 * SelfTapeSubmissionHistory — kompakt liste av tidligere submissions.
 *
 * Mockup #15: "Vist 12. mai" / "Shortlistet 8. mai" med varighet og
 * status-pille.
 */
import { Box, Stack, Typography } from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import StarRateRoundedIcon from '@mui/icons-material/StarRateRounded';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';

import { palette, radius } from '../../theme';

export interface SubmissionHistoryEntry {
  id: string;
  event_type: 'viewed' | 'shortlisted' | 'submitted' | string;
  target_label: string;
  occurred_at: string;
}

interface Props {
  entries: SubmissionHistoryEntry[];
}

function iconForEvent(type: string) {
  if (type === 'shortlisted') return StarRateRoundedIcon;
  if (type === 'viewed') return VisibilityOutlinedIcon;
  return SendOutlinedIcon;
}

function colorForEvent(type: string): string {
  if (type === 'shortlisted') return '#fbbf24';
  if (type === 'viewed') return '#60a5fa';
  return palette.accentBright;
}

function labelForEvent(type: string): string {
  if (type === 'shortlisted') return 'Shortlistet';
  if (type === 'viewed') return 'Vist';
  if (type === 'submitted') return 'Sendt';
  return type;
}

function formatRelative(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'i dag';
  if (diffDays === 1) return 'i går';
  if (diffDays < 7) return `for ${diffDays} dager siden`;
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}

export default function SelfTapeSubmissionHistory({ entries }: Props) {
  if (entries.length === 0) return null;
  return (
    <Box
      sx={{
        bgcolor: palette.bgCard,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.lg,
        p: 2.2,
      }}
    >
      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem', mb: 1.4 }}>
        Aktivitet
      </Typography>
      <Stack spacing={1.2}>
        {entries.map((e) => {
          const Icon = iconForEvent(e.event_type);
          const color = colorForEvent(e.event_type);
          return (
            <Stack key={e.id} direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  bgcolor: `${color}28`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ color, fontSize: 14 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ color: palette.textPrimary, fontWeight: 600, fontSize: '0.86rem' }} noWrap>
                  {labelForEvent(e.event_type)} · {e.target_label}
                </Typography>
                <Typography sx={{ color: palette.textMuted, fontSize: '0.74rem' }}>
                  {formatRelative(e.occurred_at)}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
