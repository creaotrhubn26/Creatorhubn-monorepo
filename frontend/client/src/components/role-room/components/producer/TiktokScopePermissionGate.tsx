/**
 * TiktokScopePermissionGate.tsx
 *
 * Producer-side banner som viser klientens permission-status for en
 * spesifikk handling. Wrap'er paneler som krever klient-godkjenning
 * (Audience, CRM, Plugin, Creator).
 *
 * Hvis godkjent: viser kun innholdet.
 * Hvis ikke: viser et tydelig banner + dimmer innholdet.
 */

import { useEffect, useState } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';

interface State {
  acceptedAt: string | null;
  revokedAt: string | null;
  permissions: Record<string, 'approved' | 'rejected' | 'pending'>;
  needsReaccept: boolean;
}

const ACTION_LABEL: Record<string, string> = {
  audience_upload: 'Bygge målgrupper fra e-postlister',
  crm_event_sync: 'Sende konverteringer til TikTok',
  plugin_install: 'Binde nettside/butikk til TikTok',
  creator_invitation: 'Invitere creators',
};

export default function TiktokScopePermissionGate({
  configId,
  action,
  children,
}: {
  configId: string;
  action: 'audience_upload' | 'crm_event_sync' | 'plugin_install' | 'creator_invitation';
  children: React.ReactNode;
}) {
  const [state, setState] = useState<State | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/role-room/ads-configs/${configId}/permissions`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setState(d); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [configId]);

  if (!loaded) return <>{children}</>;
  const status = state?.permissions?.[action];
  const accepted = !!state?.acceptedAt && !state?.revokedAt && !state?.needsReaccept;
  const isApproved = accepted && status === 'approved';

  if (isApproved) {
    return (
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 5 }}>
          <Chip
            icon={<VerifiedUserOutlinedIcon sx={{ color: '#34d399 !important', fontSize: 16 }} />}
            label="Klient har godkjent"
            size="small"
            sx={{ bgcolor: 'rgba(52,211,153,0.18)', color: '#34d399', fontWeight: 700, fontSize: '0.72rem' }}
          />
        </Box>
        {children}
      </Box>
    );
  }

  // Ikke godkjent — vis banner + dimmet innhold
  const reason = !accepted
    ? 'Klienten har ikke akseptert vilkårene ennå. Be klient gå til Client Economy → "Tillatelser og vilkår" og slå på denne handlingen.'
    : status === 'rejected'
      ? 'Klienten har eksplisitt avvist denne handlingen. Du kan ikke kjøre den før klienten skrur den på.'
      : 'Klienten har ikke gitt tillatelse til denne handlingen ennå.';

  return (
    <Box>
      <Alert
        severity="warning"
        icon={<LockOutlinedIcon />}
        sx={{ mb: 1.4, borderRadius: 1.4, fontWeight: 600 }}
      >
        <Stack spacing={0.6}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.94rem' }}>
            Klient-godkjenning kreves: {ACTION_LABEL[action]}
          </Typography>
          <Typography sx={{ fontSize: '0.84rem' }}>
            {reason}
          </Typography>
        </Stack>
      </Alert>
      <Box sx={{ opacity: 0.45, pointerEvents: 'none', filter: 'grayscale(0.4)' }}>
        {children}
      </Box>
    </Box>
  );
}
