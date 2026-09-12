/**
 * MarketingCockpitTiktokSection.tsx
 *
 * The Role Rooms egen TikTok-flyt i Admin Room → Marketing Cockpit.
 * Gjenbruker alle TikTok-panelene fra Role Room Agent, men:
 *   - configId='self' (Marketing Cockpit-modus i backend)
 *   - advertiserId hentet fra ROLE_ROOM_TIKTOK_ADVERTISER_ID env-var
 *   - viser ALT siden Daniel/admin er sin egen klient
 *
 * Pixel-installasjon på theroleroom.com er allerede dekket av
 * `ensureTiktokPixelLoaded` i frontend/client/index.html — dette
 * panelet handler om kampanje-styring + målgrupper + leads etc.
 */

import { useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import ClientTiktokSpendPanel from '../../role-room/components/producer/ClientTiktokSpendPanel';
import ClientTiktokAttributionPanel from '../../role-room/components/producer/ClientTiktokAttributionPanel';
import ClientTiktokLeadsPanel from '../../role-room/components/producer/ClientTiktokLeadsPanel';
import ClientTiktokAudiencesPanel from '../../role-room/components/producer/ClientTiktokAudiencesPanel';
import ClientTiktokCrmEventsPanel from '../../role-room/components/producer/ClientTiktokCrmEventsPanel';
import ClientTiktokCreatorsPanel from '../../role-room/components/producer/ClientTiktokCreatorsPanel';
import ClientTiktokCreativesPanel from '../../role-room/components/producer/ClientTiktokCreativesPanel';
import ClientTiktokLinkedAccountsPanel from '../../role-room/components/producer/ClientTiktokLinkedAccountsPanel';

interface SelfConfig {
  configId: string;
  tiktokAdvertiserId: string;
  brandHandle: string;
  brandName: string;
}

const palette = {
  tiktok: '#ff0050',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
};

export default function MarketingCockpitTiktokSection() {
  const [config, setConfig] = useState<SelfConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin-room/marketing-cockpit/tiktok-self-config', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled && d) setConfig(d); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
      <CircularProgress size={24} sx={{ color: palette.tiktok }} />
    </Box>;
  }

  if (error) return <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>;
  if (!config) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ borderColor: 'rgba(255,0,80,0.32)', mb: 2 }}>
        <Chip
          icon={<MusicNoteOutlinedIcon sx={{ color: '#ff0050 !important', fontSize: 16 }} />}
          label={`TIKTOK · ${config.brandName}`}
          size="small"
          sx={{
            background: 'rgba(255,0,80,0.18)',
            color: '#ff0050',
            fontSize: '0.72rem',
            fontWeight: 800,
            letterSpacing: 0.6,
          }}
        />
      </Divider>

      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
        <Box sx={{
          width: 48, height: 48, borderRadius: 1.6,
          bgcolor: 'rgba(255,0,80,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MusicNoteOutlinedIcon sx={{ color: palette.tiktok, fontSize: 28 }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1.3rem', color: palette.textPrimary }}>
            TikTok — vår egen markedsføring
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem' }}>
            Annonser + målgrupper + leads + tracking for {config.brandHandle}.
          </Typography>
          <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', mt: 0.4 }}>
            Advertiser ID {config.tiktokAdvertiserId}
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2}>
        {/* Resultater */}
        <ClientTiktokSpendPanel configId="self" advertiserId={config.tiktokAdvertiserId} />
        <ClientTiktokAttributionPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
        <ClientTiktokLeadsPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />

        {/* Verktøy — Daniel er sin egen klient, så ingen scope-gate behov */}
        <ClientTiktokAudiencesPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
        <ClientTiktokCrmEventsPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
        <ClientTiktokCreativesPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
        <ClientTiktokCreatorsPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
        <ClientTiktokLinkedAccountsPanel configId="self" advertiserId={config.tiktokAdvertiserId} isOwnAccount />
      </Stack>
    </Box>
  );
}
