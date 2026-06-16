/**
 * ResearchRefinePanel — «Forbedre research på kunden» (porter rs-refine).
 * Etter at en research-runde er kjørt kan brukeren skrive hva agenten bør
 * justere; et nytt søk kjøres og kundeprofilen oppdateres. Ren UI — kaller
 * onRefine(instruksjon), som re-trigger research med instruksjonen lagt til
 * konteksten.
 */

import * as React from 'react';
import { Box, Stack, Typography, Button, TextField, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import TuneIcon from '@mui/icons-material/Tune';
import RefreshIcon from '@mui/icons-material/Refresh';
import DifferenceIcon from '@mui/icons-material/Difference';

const ACCENT = '#a78bfa';
const GRAD = 'linear-gradient(135deg, #a855f7, #d946ef)';
const INK = '#f5f3ff';
const MUTED = 'rgba(226,232,240,0.62)';

export interface ResearchRefinePanelProps {
  onRefine: (instruction: string) => void;
  generating?: boolean;
}

export default function ResearchRefinePanel({ onRefine, generating }: ResearchRefinePanelProps): React.ReactElement {
  const [text, setText] = React.useState('');
  const run = (): void => { if (text.trim() && !generating) { onRefine(text.trim()); setText(''); } };

  return (
    <Box sx={{
      position: 'relative', borderRadius: 3, p: { xs: 2, md: 2.4 }, mb: 1.5, overflow: 'hidden',
      border: '1px solid rgba(167,139,250,0.22)',
      background: 'radial-gradient(120% 90% at 8% -10%, rgba(168,85,247,0.16), transparent 55%), linear-gradient(180deg, #0a0a14 0%, #120a26 100%)',
    }}>
      <Stack direction="row" alignItems="center" spacing={1.1} sx={{ mb: 1 }}>
        <Box sx={{ width: 28, height: 28, borderRadius: 1.3, display: 'grid', placeItems: 'center', background: GRAD }}>
          <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Research</Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800, color: INK, lineHeight: 1.15 }}>Forbedre research på kunden</Typography>
        </Box>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: MUTED, lineHeight: 1.5, mb: 1.4 }}>
        Fortell agenten hva som bør justeres, så kjører den et nytt søk og oppdaterer kundeprofilen. Du trenger ikke kunne noe teknisk — skriv som du ville sagt det høyt.
      </Typography>

      <Stack direction="row" alignItems="center" spacing={0.6} sx={{ mb: 0.7 }}>
        <TuneIcon sx={{ fontSize: 15, color: ACCENT }} />
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>Hva bør agenten endre?</Typography>
      </Stack>
      <TextField
        fullWidth multiline minRows={2} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="F.eks. «Se nærmere på prisnivået deres og sammenlign med de to nærmeste konkurrentene.»"
        sx={{
          mb: 1.4,
          '& .MuiOutlinedInput-root': { color: INK, fontSize: 13.5, '& fieldset': { borderColor: 'rgba(167,139,250,0.3)' } },
          '& textarea::placeholder': { color: 'rgba(226,232,240,0.45)' },
        }}
      />

      <Stack direction="row" alignItems="center" spacing={1.2}>
        <Button onClick={run} disabled={generating || !text.trim()} variant="contained" disableElevation
          startIcon={generating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <RefreshIcon />}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2, background: GRAD, color: '#fff', '&:hover': { background: GRAD, filter: 'brightness(1.06)' }, '&.Mui-disabled': { background: 'rgba(168,85,247,0.25)', color: 'rgba(245,243,255,0.5)' } }}>
          {generating ? 'Kjører nytt søk…' : 'Generer på nytt'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <DifferenceIcon sx={{ fontSize: 15, color: MUTED }} />
          <Typography sx={{ fontSize: 11, color: MUTED }}>Endringer markeres mot forrige profil</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
