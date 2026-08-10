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

import { useEffect, useState, useMemo } from 'react';
import { Alert, Box, Chip, Stack, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import { useT } from '../../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

interface State {
  acceptedAt: string | null;
  revokedAt: string | null;
  permissions: Record<string, 'approved' | 'rejected' | 'pending'>;
  needsReaccept: boolean;
}

const buildACTION_LABEL = (t: TFn): Record<string, string> => ({
  // TikTok
  audience_upload: t('tiktokScopeGate.s004'),
  crm_event_sync: t('tiktokScopeGate.s015'),
  plugin_install: t('tiktokScopeGate.s000'),
  creator_invitation: t('tiktokScopeGate.s007'),
  tiktok_audience_upload: t('tiktokScopeGate.s004'),
  tiktok_crm_event_sync: t('tiktokScopeGate.s015'),
  tiktok_plugin_install: t('tiktokScopeGate.s000'),
  tiktok_creator_invitation: t('tiktokScopeGate.s007'),
  // Meta
  meta_audience_upload: t('tiktokScopeGate.s001'),
  meta_capi_sync: t('tiktokScopeGate.s014'),
  meta_lead_sync: t('tiktokScopeGate.s006'),
  // LinkedIn
  linkedin_audience_upload: t('tiktokScopeGate.s003'),
  linkedin_capi_sync: t('tiktokScopeGate.s013'),
  linkedin_lead_sync: t('tiktokScopeGate.s005'),
  // Google
  google_customer_match: t('tiktokScopeGate.s002'),
  google_offline_conversions: t('tiktokScopeGate.s016'),
  google_enhanced_conversions: 'Enhanced Conversions (Google)',
});

export default function TiktokScopePermissionGate({
  configId,
  action,
  children,
}: {
  configId: string;
  action: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  const ACTION_LABEL = useMemo(() => buildACTION_LABEL(t), [t]);
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
            label={t('tiktokScopeGate.s008')}
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
    ? t('tiktokScopeGate.s011')
    : status === 'rejected'
      ? t('tiktokScopeGate.s010')
      : t('tiktokScopeGate.s012');

  return (
    <Box>
      <Alert
        severity="warning"
        icon={<LockOutlinedIcon />}
        sx={{ mb: 1.4, borderRadius: 1.4, fontWeight: 600 }}
      >
        <Stack spacing={0.6}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.94rem' }}>
            {t('tiktokScopeGate.s009')} {ACTION_LABEL[action]}
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
