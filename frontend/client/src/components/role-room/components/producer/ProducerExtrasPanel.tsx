import type { ReactNode } from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { Groups as GroupsIcon } from '@mui/icons-material';

interface ProducerExtrasPanelProps {
  children: ReactNode;
}

export default function ProducerExtrasPanel({ children }: ProducerExtrasPanelProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: { xs: 1.5, md: 2 },
        borderRadius: 2,
        border: '1px solid rgba(148,163,184,0.22)',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(27, 18, 44,0.82) 100%)',
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
        <Stack direction="row" spacing={1} alignItems="center">
          <GroupsIcon sx={{ color: '#93a4dc' }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
            Statister / medvirkende
          </Typography>
        </Stack>
        <Chip
          size="small"
          label="Kandidatmodus: statister"
          sx={{
            bgcolor: 'rgba(147, 164, 220,0.18)',
            color: '#dfe4f3',
            border: '1px solid rgba(147, 164, 220,0.35)',
          }}
        />
      </Stack>
      <Typography sx={{ color: 'rgba(203,213,225,0.88)' }}>
        Denne visningen bruker kandidatmodulen, men terminologi og arbeidsflyt er rettet mot statister og medvirkende.
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

