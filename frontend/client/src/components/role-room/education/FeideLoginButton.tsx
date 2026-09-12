/**
 * FeideLoginButton.tsx — «Logg inn med Feide» (institusjons-innlogging).
 * Selvstendig: sjekker selv om Feide er konfigurert (env-gated backend) og
 * skjuler seg ellers. Navigerer til OIDC-login-endepunktet.
 */

import { useEffect, useState } from 'react';
import { Button, Box } from '@mui/material';

export function FeideLoginButton({ compact = false }: { compact?: boolean }) {
  const [configured, setConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/role-room/feide/status')
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d) => { if (!cancelled) setConfigured(Boolean(d?.configured)); })
      .catch(() => { /* skjul ved feil */ });
    return () => { cancelled = true; };
  }, []);

  if (!configured) return null;

  return (
    <Button
      fullWidth
      onClick={() => { window.location.href = '/api/role-room/feide/login'; }}
      sx={{
        textTransform: 'none', fontSize: { xs: '0.76rem', sm: '0.8rem' }, fontWeight: 500,
        borderRadius: '14px', minHeight: 48, py: { xs: 0.95, sm: 1.1 }, px: { xs: 1, sm: 1.5 },
        bgcolor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(240,235,255,0.85)', backdropFilter: 'blur(10px)', gap: 0.7, justifyContent: 'center',
        transition: 'all 0.25s ease',
        '&:hover': { bgcolor: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.22)', transform: 'translateY(-1px)' },
        '& .MuiButton-startIcon': { marginRight: 0.7, marginLeft: 0 },
      }}
      startIcon={
        <Box component="span" sx={{ width: 16, height: 16, borderRadius: '4px', bgcolor: '#1F3C88', color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>F</Box>
      }
    >
      {compact ? 'Feide' : 'Logg inn med Feide'}
    </Button>
  );
}

export default FeideLoginButton;
