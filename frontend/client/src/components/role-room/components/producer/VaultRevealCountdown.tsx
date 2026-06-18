/**
 * VaultRevealCountdown — synlig nedtelling + «Lås nå» for et åpnet vault-secret.
 * Vault v2: et avslørt secret skal ikke ligge synlig ubegrenset. Komponenten
 * teller ned fra reveal_ttl_seconds (fra opprettelses-tidspunktet revealedAt) og
 * kaller onLock automatisk ved 0 — og lar produsenten låse umiddelbart.
 *
 * Rører IKKE reveal/MFA-logikken; den bare auto-skjuler det allerede-viste.
 */
import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, Typography, Button, LinearProgress } from '@mui/material';
import { LockClockOutlined as CountdownIcon, LockOutlined as LockIcon } from '@mui/icons-material';

export default function VaultRevealCountdown({
  revealedAt,
  ttlSeconds = 300,
  onLock,
}: {
  revealedAt?: string | null;
  ttlSeconds?: number | null;
  onLock: () => void;
}) {
  const ttl = Math.max(30, Math.min(3600, ttlSeconds || 300));
  const startMs = useMemo(() => {
    const t = revealedAt ? Date.parse(revealedAt) : Number.NaN;
    return Number.isFinite(t) ? t : Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealedAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const elapsed = Math.floor((now - startMs) / 1000);
  const remaining = Math.max(0, ttl - elapsed);

  useEffect(() => {
    if (remaining <= 0) onLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const mm = String(Math.floor(remaining / 60)).padStart(1, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const pct = Math.max(0, Math.min(100, (remaining / ttl) * 100));
  const urgent = remaining <= 30;

  return (
    <Box sx={{ mt: 0.6 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CountdownIcon sx={{ fontSize: 16, color: urgent ? '#fca5a5' : '#fcd34d' }} />
        <Typography sx={{ color: urgent ? '#fca5a5' : 'rgba(254,240,138,0.92)', fontSize: '0.74rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          Låses automatisk om {mm}:{ss}
        </Typography>
        <Button
          onClick={onLock} size="small" startIcon={<LockIcon sx={{ fontSize: 15 }} />}
          sx={{ ml: 'auto', textTransform: 'none', fontWeight: 700, minHeight: 34, color: '#fff', background: 'rgba(239,68,68,0.85)', '&:hover': { background: '#ef4444' } }}
        >
          Lås nå
        </Button>
      </Stack>
      <LinearProgress
        variant="determinate" value={pct}
        sx={{ mt: 0.5, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.18)',
          '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: urgent ? '#ef4444' : '#fcd34d' } }}
      />
      <Typography sx={{ color: 'rgba(254,240,138,0.7)', fontSize: '0.7rem', mt: 0.4 }}>
        Midlertidig innsyn — aldri logget eller bufret. Roter tilgangen ved behov.
      </Typography>
    </Box>
  );
}
