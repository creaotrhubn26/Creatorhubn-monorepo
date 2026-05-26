import { useEffect, useState } from 'react';
import { Alert, Avatar, Box, Chip, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckCircleIcon,
  Facebook as FacebookIcon,
  Instagram as InstagramIcon,
  LinkedIn as LinkedInIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import roleRoomAgentService, {
  type RoleRoomGrantedAssets,
} from '../../services/roleRoomAgentService';

/**
 * Shown to the content producer at login: a clear overview of which Pages /
 * ad accounts / Company Pages the CLIENT has granted them ADMIN access to,
 * across Meta and LinkedIn. Admin access is the headline; lower access levels
 * are listed underneath so the producer always knows the exact boundary of
 * what they may touch on the client's behalf.
 */

const CARD_SX = {
  p: 1.4,
  borderRadius: 2,
  bgcolor: 'rgba(15,23,42,0.55)',
  border: '1px solid rgba(148,163,184,0.16)',
} as const;

const LABEL = { color: '#e2e8f0', fontWeight: 700, fontSize: '0.92rem' } as const;
const SUBTLE = { color: 'rgba(226,232,240,0.66)', fontSize: '0.8rem' } as const;

function platformIcon(platform: 'meta' | 'linkedin', assetType: string) {
  if (platform === 'linkedin') {
    return assetType === 'organization' ? <LinkedInIcon sx={{ fontSize: 18, color: '#38bdf8' }} /> : <CampaignIcon sx={{ fontSize: 18, color: '#38bdf8' }} />;
  }
  return assetType.includes('instagram')
    ? <InstagramIcon sx={{ fontSize: 18, color: '#e879f9' }} />
    : <FacebookIcon sx={{ fontSize: 18, color: '#60a5fa' }} />;
}

export default function GrantedAssetsCard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RoleRoomGrantedAssets | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await roleRoomAgentService.fetchGrantedAdsAssets();
        if (!cancelled) setData(result);
      } catch {
        if (!cancelled) setError('Klarte ikke å hente tilgangsoversikten.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const metaConnected = data?.platforms.meta.connected;
  const linkedinConnected = data?.platforms.linkedin.connected;
  const noConnections = !loading && !metaConnected && !linkedinConnected;

  return (
    <Stack spacing={1} sx={CARD_SX}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <AdminIcon sx={{ fontSize: 18, color: '#86efac' }} />
        <Typography sx={LABEL}>Din admin-tilgang fra kunden</Typography>
        {data?.hasAdminAccess && (
          <Chip
            size="small"
            icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
            label={`${data.adminAssets.length} med admin`}
            sx={{
              fontWeight: 700,
              color: '#86efac',
              bgcolor: 'rgba(134,239,172,0.08)',
              border: '1px solid rgba(134,239,172,0.3)',
            }}
          />
        )}
      </Stack>

      {loading && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
          <CircularProgress size={14} sx={{ color: 'rgba(226,232,240,0.6)' }} />
          <Typography sx={SUBTLE}>Henter tilgang …</Typography>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {noConnections && (
        <Typography sx={SUBTLE}>
          Ingen annonsekontoer er koblet ennå. Når kunden gir deg admin-tilgang til en Facebook/Instagram-side
          eller LinkedIn-konto, vises de her.
        </Typography>
      )}

      {/* Admin assets — the headline list */}
      {data && data.adminAssets.length > 0 && (
        <Stack spacing={0.75}>
          {data.adminAssets.map((a) => (
            <Stack
              key={`${a.platform}:${a.id}`}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                p: 0.9,
                borderRadius: 1.5,
                bgcolor: 'rgba(134,239,172,0.06)',
                border: '1px solid rgba(134,239,172,0.22)',
              }}
            >
              <Avatar
                src={a.logoUrl || undefined}
                alt={a.name || ''}
                sx={{ width: 28, height: 28, bgcolor: 'rgba(15,23,42,0.6)' }}
              >
                {platformIcon(a.platform, a.assetType)}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.85rem' }} noWrap>
                  {a.name || a.id}
                </Typography>
                <Typography sx={{ color: 'rgba(226,232,240,0.6)', fontSize: '0.72rem' }} noWrap>
                  {a.platform === 'meta' ? 'Meta' : 'LinkedIn'} · {a.assetType.replace('+', ' + ')}
                </Typography>
              </Box>
              <Chip
                size="small"
                label={a.accessSummary}
                sx={{
                  fontWeight: 700,
                  color: '#86efac',
                  bgcolor: 'rgba(134,239,172,0.1)',
                  border: '1px solid rgba(134,239,172,0.3)',
                }}
              />
            </Stack>
          ))}
        </Stack>
      )}

      {/* Connected but no admin anywhere — make the limitation explicit */}
      {data && !loading && (metaConnected || linkedinConnected) && data.adminAssets.length === 0 && (
        <Alert severity="warning" sx={{ '& .MuiAlert-message': { fontSize: '0.78rem' } }}>
          Du er koblet til, men har ikke fått <strong>admin</strong>-tilgang til noen sider ennå. Be kunden gi deg
          admin (MANAGE / ACCOUNT_MANAGER) så du kan publisere og drifte annonser.
        </Alert>
      )}

      {/* Non-admin (limited) Meta pages, listed for transparency */}
      {metaConnected && (data?.platforms.meta.pages?.some((p) => !p.isAdmin)) && (
        <Box>
          <Typography sx={{ ...SUBTLE, mb: 0.5 }}>Begrenset tilgang (Meta):</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {data!.platforms.meta.pages!
              .filter((p) => !p.isAdmin)
              .map((p) => (
                <Tooltip key={p.id} title={p.accessLabels.join(', ') || 'Begrenset'}>
                  <Chip
                    size="small"
                    label={p.name}
                    sx={{
                      color: 'rgba(226,232,240,0.8)',
                      bgcolor: 'rgba(148,163,184,0.08)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      fontSize: '0.72rem',
                    }}
                  />
                </Tooltip>
              ))}
          </Stack>
        </Box>
      )}

      {/* Non-admin (limited) LinkedIn assets */}
      {linkedinConnected && (data?.platforms.linkedin.assets?.some((a) => !a.isAdmin)) && (
        <Box>
          <Typography sx={{ ...SUBTLE, mb: 0.5 }}>Begrenset tilgang (LinkedIn):</Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {data!.platforms.linkedin.assets!
              .filter((a) => !a.isAdmin)
              .map((a) => (
                <Tooltip key={a.id} title={a.roleLabel}>
                  <Chip
                    size="small"
                    label={a.name || a.id}
                    sx={{
                      color: 'rgba(226,232,240,0.8)',
                      bgcolor: 'rgba(148,163,184,0.08)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      fontSize: '0.72rem',
                    }}
                  />
                </Tooltip>
              ))}
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
