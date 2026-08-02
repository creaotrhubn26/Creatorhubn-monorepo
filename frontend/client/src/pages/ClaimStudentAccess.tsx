/**
 * ClaimStudentAccess.tsx — student løser inn faglærer-invitasjonen.
 *
 * Landes på /role-room/student/claim?token=<inviteToken>. Kaller claim →
 * lagrer isolert studentsesjon-token → sender videre til «Min side»
 * (?mode=student). Selvstendig side (som AcceptTesterInvite).
 */

import { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Button, Stack } from '@mui/material';
import { School as StudentIcon, CheckCircle as DoneIcon, ErrorOutline as ErrorIcon } from '@mui/icons-material';
import { educationStudentViewService } from '@/components/role-room/education/educationStudentViewService';

const ACCENT = '#8B5CF6';

export default function ClaimStudentAccess() {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [studentName, setStudentName] = useState<string | null>(null);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim();
    if (!token) { setState('error'); setMessage('Mangler invitasjonslenke.'); return; }
    let cancelled = false;
    void educationStudentViewService.claim(token)
      .then((student) => {
        if (cancelled) return;
        setStudentName(student?.name ?? null);
        setState('ok');
        // Kort pause så bruker ser bekreftelsen, deretter inn i Min side.
        window.setTimeout(() => { window.location.href = '/?mode=student'; }, 1400);
      })
      .catch((e) => {
        if (cancelled) return;
        setState('error');
        setMessage(e instanceof Error ? e.message : 'Kunne ikke løse inn invitasjonen.');
      });
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
        {state === 'loading' && (
          <>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Aktiverer studenttilgangen din…</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Et øyeblikk.</Typography>
          </>
        )}
        {state === 'ok' && (
          <>
            <Stack direction="row" spacing={1} alignItems="center">
              <StudentIcon sx={{ color: ACCENT }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Velkommen{studentName ? `, ${studentName}` : ''}!</Typography>
            </Stack>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>Tar deg til Min side…</Typography>
          </>
        )}
        {state === 'error' && (
          <>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Kunne ikke logge inn</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>{message}</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Be faglæreren din om en ny invitasjonslenke.</Typography>
            <Button variant="outlined" onClick={() => { window.location.href = '/'; }}
              sx={{ mt: 1, borderColor: 'rgba(139,92,246,0.5)', color: '#e9d5ff', textTransform: 'none' }}>
              Til forsiden
            </Button>
          </>
        )}
      </Stack>
    </Box>
  );
}
