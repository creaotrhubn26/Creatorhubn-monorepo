/**
 * ClientEconomyTiktokSection.tsx
 *
 * Klient-vendt TikTok-oversikt vist i Client Economy.
 *
 * Producer ser HELE Role Room Agent (alle 12 scope-grupper + producer-
 * interne handlinger som sync, opplaste, sende test-events).
 *
 * KLIENT ser bare de 3 panelene som handler om RESULTATER for hans
 * egen virksomhet:
 *   1. Attribution — "Hva har annonsene tjent inn?"
 *   2. Leads — "Hvilke kunder har sendt inn skjema?"
 *   3. Linked Accounts — "Hvilke TikTok-kontoer er koblet til?" (transparens)
 *
 * Producer-interne paneler (Audiences, Creatives, Creators, Plugins,
 * CRM Events) er SKJULT fra klienten — de hører til producer's
 * arbeidsflyt, ikke klient-rapportering.
 */

import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import MusicNoteOutlinedIcon from '@mui/icons-material/MusicNoteOutlined';
import ClientTiktokAttributionPanel from './ClientTiktokAttributionPanel';
import ClientTiktokLeadsPanel from './ClientTiktokLeadsPanel';
import ClientTiktokLinkedAccountsPanel from './ClientTiktokLinkedAccountsPanel';
import ClientTiktokSpendPanel from './ClientTiktokSpendPanel';

interface Props {
  /** Prosjektet klienten ser sin Economy-tab for. */
  clientProjectId: string;
}

interface ConfigStub {
  id: string;
  tiktok_pixel_id: string | null;
  tiktok_advertiser_id: string | null;
}

const palette = {
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  tiktok: '#ff0050',
};

export default function ClientEconomyTiktokSection({ clientProjectId }: Props) {
  const [config, setConfig] = useState<ConfigStub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!clientProjectId) return;
    setLoading(true);
    fetch(`/api/role-room/ads-configs/by-project?clientProjectId=${encodeURIComponent(clientProjectId)}`, {
      credentials: 'include',
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled) return;
        const cfg = data?.configs?.[0];
        if (cfg) setConfig(cfg);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Kunne ikke laste TikTok-config'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientProjectId]);

  // Skjul seksjonen helt hvis ingen TikTok er satt opp ennå
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: palette.tiktok }} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>;
  }

  if (!config || (!config.tiktok_pixel_id && !config.tiktok_advertiser_id)) {
    // Ikke vis seksjonen i det hele tatt før producer har koblet TikTok
    return null;
  }

  return (
    <Box sx={{ mt: 3 }}>
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
            TikTok-oversikt
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.94rem' }}>
            Resultater og henvendelser fra deres TikTok-annonser.
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2}>
        {/* 1. Spend — "Hva har vi brukt?" */}
        <ClientTiktokSpendPanel configId={config.id} advertiserId={config.tiktok_advertiser_id} />

        {/* 2. Attribution — "Hva har vi tjent tilbake?" */}
        <ClientTiktokAttributionPanel configId={config.id} advertiserId={config.tiktok_advertiser_id} />

        {/* 3. Leads — hva kommer inn? */}
        <ClientTiktokLeadsPanel configId={config.id} advertiserId={config.tiktok_advertiser_id} />

        {/* 4. Linked Accounts — transparens */}
        <ClientTiktokLinkedAccountsPanel configId={config.id} advertiserId={config.tiktok_advertiser_id} />
      </Stack>
    </Box>
  );
}
