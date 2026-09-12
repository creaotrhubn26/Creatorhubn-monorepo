/**
 * ClaimCensorAccess.tsx — ekstern sensor løser inn sensor-lenken.
 * /role-room/censor/claim?token=<inviteToken> → claim → sensor-visning.
 */

import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button, Stack } from '@mui/material';
import { FactCheck as CensorIcon, CheckCircle as DoneIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { educationCensorService } from '@/components/role-room/education/educationCensorService';

const ACCENT = '#8B5CF6';

export default function ClaimCensorAccess() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [cohortName, setCohortName] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim();
    if (!token) { setState('error'); setMessage('Mangler sensor-lenke.'); return; }
    let cancelled = false;
    void educationCensorService.claim(token)
      .then((r) => {
        if (cancelled) return;
        setCohortName(r.cohortName);
        setState('ok');
        window.setTimeout(() => { window.location.href = '/role-room/censor'; }, 1400);
      })
      .catch((e) => { if (!cancelled) { setState('error'); setMessage(e instanceof Error ? e.message : 'Kunne ikke logge inn.'); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Stack spacing={2} alignItems="center" sx={{ maxWidth: 440, textAlign: 'center' }}>
        <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(139,92,246,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
          {state === 'loading' ? <CircularProgress sx={{ color: ACCENT }} />
            : state === 'ok' ? <DoneIcon sx={{ fontSize: 40, color: '#10b981' }} />
            : <ErrorIcon sx={{ fontSize: 40, color: '#ef4444' }} />}
        </Box>
        {state === 'loading' && <Typography variant="h6" sx={{ fontWeight: 800 }}>Aktiverer sensor-tilgang…</Typography>}
        {state === 'ok' && (
          <>
            <Stack direction="row" spacing={1} alignItems="center"><CensorIcon sx={{ color: ACCENT }} /><Typography variant="h6" sx={{ fontWeight: 800 }}>Velkommen, sensor</Typography></Stack>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{cohortName ? `Kull: ${cohortName}. ` : ''}Tar deg til sensuren…</Typography>
          </>
        )}
        {state === 'error' && (
          <>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Kunne ikke logge inn</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{message}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Be faglærer om en ny sensor-lenke.</Typography>
          </>
        )}
      </Stack>
    </Box>
  );
}
