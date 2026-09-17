/**
 * SelfTapeAlmostReadyCard — indigo gradient CTA-card under takes-strip.
 *
 * "Snart klar til å sendes" + sjekkliste + primær CTA.
 */
import { Box, Stack, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';

import { radius } from '../../theme';

interface ChecklistItem {
  label: string;
  done: boolean;
}

interface Props {
  checklist: ChecklistItem[];
  onSubmit: () => void;
}

export default function SelfTapeAlmostReadyCard({ checklist, onSubmit }: Props) {
  const remaining = checklist.filter((c) => !c.done).length;
  const allDone = remaining === 0;
  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 60%, #818cf8 100%)',
        borderRadius: radius.lg,
        p: 2.4,
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(99, 102, 241,0.32)',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <RocketLaunchOutlinedIcon fontSize="small" />
        <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>
          {allDone ? 'Klar til å sendes' : 'Snart klar til å sendes'}
        </Typography>
      </Stack>
      <Typography sx={{ opacity: 0.92, fontSize: '0.86rem', mb: 1.6 }}>
        {allDone
          ? 'Alle sjekkpunkter er oppfylt. Send self-tapen til ditt valgte mål.'
          : `${remaining} sjekkpunkt${remaining === 1 ? '' : 'er'} igjen før du sender.`}
      </Typography>
      <Stack spacing={0.6} sx={{ mb: 1.8 }}>
        {checklist.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={1}>
            {item.done
              ? <CheckCircleIcon sx={{ fontSize: 16, color: '#fff' }} />
              : <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }} />
            }
            <Typography sx={{ fontSize: '0.84rem', opacity: item.done ? 1 : 0.85 }}>
              {item.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Box
        component="button"
        onClick={onSubmit}
        disabled={!allDone}
        sx={{
          width: '100%',
          bgcolor: allDone ? '#fff' : 'rgba(255,255,255,0.32)',
          color: allDone ? '#4338ca' : 'rgba(255,255,255,0.8)',
          border: 'none',
          cursor: allDone ? 'pointer' : 'not-allowed',
          py: 1.2,
          borderRadius: radius.sm,
          fontWeight: 800,
          fontSize: '0.9rem',
          fontFamily: 'inherit',
          '&:hover': allDone ? { bgcolor: '#eef2ff' } : undefined,
        }}
      >
        Send self-tapen
      </Box>
    </Box>
  );
}
