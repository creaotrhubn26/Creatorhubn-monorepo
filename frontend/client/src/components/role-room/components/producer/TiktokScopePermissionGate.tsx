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
  // TikTok
  audience_upload: 'Bygge målgrupper fra e-postlister (TikTok)',
  crm_event_sync: 'Sende konverteringer til TikTok',
  plugin_install: 'Binde nettside/butikk til TikTok',
  creator_invitation: 'Invitere creators (TikTok)',
  tiktok_audience_upload: 'Bygge målgrupper fra e-postlister (TikTok)',
  tiktok_crm_event_sync: 'Sende konverteringer til TikTok',
  tiktok_plugin_install: 'Binde nettside/butikk til TikTok',
  tiktok_creator_invitation: 'Invitere creators (TikTok)',
  // Meta
  meta_audience_upload: 'Bygge Custom Audiences (Meta)',
  meta_capi_sync: 'Sende konverteringer til Meta (CAPI)',
  meta_lead_sync: 'Hente leads fra Meta Lead Ads',
  // LinkedIn
  linkedin_audience_upload: 'Bygge Matched Audiences (LinkedIn)',
  linkedin_capi_sync: 'Sende konverteringer til LinkedIn (CAPI)',
  linkedin_lead_sync: 'Hente leads fra LinkedIn Lead Gen Forms',
  // Google
  google_customer_match: 'Bygge Customer Match-målgrupper (Google)',
  google_offline_conversions: 'Sende offline-konverteringer til Google',
  google_enhanced_conversions: 'Enhanced Conversions (Google)',
};

export default function TiktokScopePermissionGate({
  configId,
  action,
  children,
}: {
  configId: string;
  action: string;
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
