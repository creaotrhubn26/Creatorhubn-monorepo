/**
 * SettingsPage.tsx — Innstillinger
 *
 * Phase 3 MVP: språk, varsler-preferanser (placeholder), data-eksport,
 * slett konto. Mer kommer.
 */

import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import ShieldIcon from '@mui/icons-material/Shield';
import { useState } from 'react';

import { palette, radius } from '../theme';

const cardSx = {
  bgcolor: palette.bgCard,
  border: `1px solid ${palette.border}`,
  borderRadius: radius.lg,
  p: 2.4,
};

export default function SettingsPage() {
  const [language, setLanguage] = useState('nb-NO');
  const [info, setInfo] = useState<string | null>(null);

  return (
    <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
      <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: palette.textPrimary, lineHeight: 1.15, mb: 3 }}>
        Innstillinger
      </Typography>

      {info ? <Alert severity="info" onClose={() => setInfo(null)} sx={{ mb: 2 }}>{info}</Alert> : null}

      <Stack spacing={2}>
        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1.4 }}>Språk</Typography>
          <TextField
            select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            fullWidth size="small"
            helperText="Endring krever ny innlogging for å oppdatere hele UI."
          >
            <MenuItem value="nb-NO">Norsk (bokmål)</MenuItem>
            <MenuItem value="en-NO">English (Norway)</MenuItem>
          </TextField>
        </Box>

        <Box sx={cardSx}>
          <Typography sx={{ color: palette.textPrimary, fontWeight: 700, mb: 1 }}>Mine data (GDPR)</Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.85rem', mb: 1.4, lineHeight: 1.5 }}>
            Du har full rett til dine egne data. Last ned alt, eller slett kontoen og alt blir borte for godt.
          </Typography>
          <Stack direction="row" spacing={1.2}>
            <Button
              startIcon={<DownloadIcon />}
              onClick={() => setInfo('Data-eksport tar 24 timer. Vi sender en lenke på e-post når den er klar.')}
              sx={{
                textTransform: 'none', fontWeight: 600, px: 2, py: 1,
                borderRadius: radius.sm, color: palette.textPrimary, border: `1px solid ${palette.borderStrong}`,
                '&:hover': { bgcolor: 'rgba(168,85,247,0.08)' },
              }}
            >
              Last ned mine data
            </Button>
            <Button
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setInfo('Konto-sletting er endelig og kan ikke angres. Send en e-post til support@theroleroom.com med "Slett kontoen min" — vi bekrefter innen 24 timer.')}
              sx={{
                textTransform: 'none', fontWeight: 600, px: 2, py: 1,
                borderRadius: radius.sm, color: '#f87171', border: '1px solid #f87171',
                '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' },
              }}
            >
              Slett konto
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ pt: 1, color: palette.textMuted, fontSize: '0.82rem' }}>
          <ShieldIcon sx={{ fontSize: 18, color: palette.success }} />
          <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem' }}>
            EU/EEA-lagring. ISO 27001-policy. <Box component="a" href="/privacy" sx={{ color: palette.accentBright }}>Personvern</Box>.
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
