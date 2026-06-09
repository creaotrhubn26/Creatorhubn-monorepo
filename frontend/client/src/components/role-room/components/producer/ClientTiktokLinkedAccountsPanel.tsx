/**
 * ClientTiktokLinkedAccountsPanel.tsx
 *
 * Bestemor-vennlig: "Hvilke TikTok-kontoer er koblet til reklamen?"
 *
 * Backend: GET /api/admin-room/agent/ads/configs/:id/tiktok/linked-accounts
 */

import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Stack, Typography,
} from '@mui/material';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
  tiktok: '#ff0050',
};

interface LinkedAccount {
  tiktokAccountId: string;
  handle: string | null;
  displayName: string | null;
  accountRole: string;
  permissions: string[];
  accountStatus: string;
  followerCount: number | null;
  avatarUrl: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  BRAND: 'Egen merkevarekonto',
  KLIENT_BRAND: 'Klientens merkevarekonto',
  SPARK_ADS_DELEGATION: 'Lånt fra skaper (Spark Ads)',
};

const STATUS_LABEL: Record<string, { txt: string; bg: string; color: string }> = {
  active: { txt: 'AKTIV', bg: 'rgba(52,211,153,0.18)', color: '#34d399' },
  delegated: { txt: 'DELEGERT', bg: 'rgba(96,165,250,0.18)', color: '#60a5fa' },
  pending: { txt: 'AVVENTER', bg: 'rgba(251,191,36,0.18)', color: '#fbbf24' },
  revoked: { txt: 'AVSLUTTET', bg: 'rgba(148,163,184,0.18)', color: '#94a3b8' },
  expired: { txt: 'UTLØPT', bg: 'rgba(248,113,113,0.18)', color: '#f87171' },
};

export default function ClientTiktokLinkedAccountsPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveConfigId = isOwnAccount ? 'self' : configId;

  useEffect(() => {
    if (advertiserId || isOwnAccount) return;
    fetch(`/api/admin-room/agent/ads/configs/${configId}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.config?.tiktok_advertiser_id) setAdvertiserId(d.config.tiktok_advertiser_id);
      })
      .catch(() => {});
  }, [configId, advertiserId, isOwnAccount]);

  const load = async () => {
    if (!advertiserId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/linked-accounts?advertiserId=${advertiserId}`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Henting feilet');
      setAccounts(d.accounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (advertiserId) load(); /* eslint-disable-next-line */ }, [advertiserId]);

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AccountCircleOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              TikTok-kontoer koblet til reklamen
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Egne kontoer + skaper-kontoer som har gitt lov til å bli boostet.
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        <Box sx={{
          bgcolor: 'rgba(255,0,80,0.06)',
          border: `1px solid rgba(255,0,80,0.20)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
            {accounts.length}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            {accounts.length === 0 ? 'ingen kontoer koblet ennå' : accounts.length === 1 ? 'konto koblet' : 'kontoer koblet'}
          </Typography>
        </Box>

        <Button
          onClick={load}
          disabled={loading || !advertiserId}
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshOutlinedIcon />}
          sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}
        >
          {loading ? 'Oppdaterer…' : 'Oppdater oversikten'}
        </Button>

        {accounts.length > 0 ? (
          <Stack spacing={1.2} sx={{ mt: 2.4 }}>
            {accounts.map((a) => {
              const status = STATUS_LABEL[a.accountStatus] ?? STATUS_LABEL.active;
              return (
                <Box key={a.tiktokAccountId} sx={{
                  bgcolor: 'rgba(168,85,247,0.04)',
                  border: `1px solid ${palette.border}`,
                  borderRadius: 1.4,
                  p: 1.6,
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.6}>
                    <Avatar src={a.avatarUrl ?? undefined} sx={{ width: 48, height: 48 }}>
                      {a.displayName?.[0] ?? a.handle?.[0] ?? '?'}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.96rem' }}>
                        @{a.handle ?? a.tiktokAccountId}
                      </Typography>
                      {a.displayName ? (
                        <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem' }}>
                          {a.displayName}
                        </Typography>
                      ) : null}
                      <Stack direction="row" spacing={1.2} sx={{ mt: 0.6 }}>
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.76rem' }}>
                          {ROLE_LABEL[a.accountRole] ?? a.accountRole}
                        </Typography>
                        {a.followerCount ? (
                          <Typography sx={{ color: palette.textMuted, fontSize: '0.76rem' }}>
                            · 👥 {a.followerCount.toLocaleString('nb-NO')}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Box>
                    <Chip
                      label={status.txt}
                      size="small"
                      sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.68rem' }}
                    />
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}
