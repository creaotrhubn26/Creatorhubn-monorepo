/**
 * LeadMapMarketplaceCard.tsx
 *
 * Promo-kort for Lead Map som modul, mounted i Marketplace-apper-tabben i
 * AdminDashboard. Viser tier-priser + stats (aktive subs, MRR), og lar admin
 * raskt hoppe til entitlements-tab eller pricing-tab.
 */

import React, { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Chip, IconButton, Stack, Typography,
  LinearProgress,
} from '@mui/material';
import {
  Map as MapIcon,
  TrendingUp as TrendingUpIcon,
  Settings as SettingsIcon,
  Verified as EntitlementIcon,
  ArrowBackIos as PrevIcon,
  ArrowForwardIos as NextIcon,
} from '@mui/icons-material';
import { AdminButton } from './design-system';

interface LeadMapStats {
  activeSubscribers: number;
  trialUsers: number;
  monthlyRevenueNok: number;
}

const TIER_PRICING = [
  { label: 'Discover', priceNok: 299, perks: '50 leads/mnd' },
  { label: 'Pro',      priceNok: 599, perks: '250 leads + 50 AI-pitcher' },
  { label: 'Agency',   priceNok: 1490, perks: 'Ubegrenset · multi-tenant' },
];

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('rr_bearer') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Ekte skjermbilder (PNG) lagres i frontend/client/public/ og refereres
 * absolutt fra root. Bildene fanges av
 * scripts/capture-lead-map-previews.mjs (Playwright).
 */
const PREVIEWS: Array<{ src: string; caption: string }> = [
  {
    src: '/lead-map-preview-1.png',
    caption: 'Kart-vy: Carto Dark Matter med fargekodede status-pins',
  },
  {
    src: '/lead-map-preview-2.png',
    caption: 'Pin-popup: status, AI-pitch og besøk-historikk på ett klikk',
  },
  {
    src: '/lead-map-preview-3.png',
    caption: 'Site Discovery: Claude foreslår 15 lookalike-queries',
  },
];

interface Props {
  onJumpToEntitlements?: () => void;
  onJumpToPricing?: () => void;
}

export default function LeadMapMarketplaceCard({
  onJumpToEntitlements, onJumpToPricing,
}: Props) {
  const [stats, setStats] = useState<LeadMapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Auto-rotér hvert 5s (pause ved hover håndteres via CSS)
  useEffect(() => {
    const id = setInterval(() => setPreviewIdx((i) => (i + 1) % PREVIEWS.length), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/admin/lead-map/entitlements', {
          credentials: 'include', headers: authHeaders(),
        });
        if (!r.ok || cancelled) return;
        const body = await r.json();
        const rows = (Array.isArray(body.entitlements) ? body.entitlements : []) as Array<{
          tier: 'discover'|'pro'|'agency'; status: string; revoked_at: string|null;
        }>;
        const activeRows = rows.filter((r) => r.status === 'active' && !r.revoked_at);
        const tierPrice: Record<string, number> = { discover: 299, pro: 599, agency: 1490 };
        if (!cancelled) {
          setStats({
            activeSubscribers: activeRows.length,
            trialUsers: rows.filter((r) => r.status === 'trial' && !r.revoked_at).length,
            monthlyRevenueNok: activeRows.reduce((s, r) => s + (tierPrice[r.tier] ?? 0), 0),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <Card sx={{
      bgcolor: 'rgba(251, 191, 36, 0.05)',
      border: '1px solid rgba(251, 191, 36, 0.25)',
      position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{
        position: 'absolute', top: 0, right: 0,
        bgcolor: '#fbbf24', color: '#0a0a0f', px: 1.5, py: 0.4,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
        borderBottomLeftRadius: 6,
      }}>
        PROMOTERT
      </Box>

      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <Box sx={{
            bgcolor: '#fbbf24', borderRadius: 1.5, p: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MapIcon sx={{ color: '#0a0a0f' }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              Lead Map
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Geografisk CRM · Role Room Agent
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body2" sx={{ mb: 2 }}>
          Multi-tenant modul som lar produsenter visualisere leads på et kart,
          oppdage lookalikes via Claude + Google Places, og pitche dem med AI.
          Live i 3 tier — auto-billing via Stripe.
        </Typography>

        {/* Skjermbilder fra grensesnittet (carousel) */}
        <Box sx={{
          position: 'relative', mb: 2,
          borderRadius: 2, overflow: 'hidden',
          border: '1px solid rgba(251, 191, 36, 0.2)',
          bgcolor: '#0a0e18',
          aspectRatio: '16 / 9',
        }}>
          {/* Selve bildet */}
          <Box
            component="img"
            src={PREVIEWS[previewIdx].src}
            alt={PREVIEWS[previewIdx].caption}
            loading="lazy"
            sx={{
              display: 'block',
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top center',
            }}
            onError={(e) => {
              // Fallback hvis PNG mangler — viser tekstinstruks i stedet
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
              const sib = img.nextElementSibling as HTMLElement | null;
              if (sib) sib.style.display = 'flex';
            }}
          />
          <Box sx={{
            display: 'none', position: 'absolute', inset: 0,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', textAlign: 'center', p: 2,
            color: '#8a93a3',
          }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#fbbf24' }}>
              Skjermbilde mangler
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              Kjør <code>node scripts/capture-lead-map-previews.mjs</code> for å fange
              ekte skjermbilder fra Lead Map-grensesnittet til /public.
            </Typography>
          </Box>

          {/* Caption */}
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            bgcolor: 'rgba(10, 14, 24, 0.85)', color: '#fff',
            px: 1.5, py: 0.75,
            fontSize: 11, fontWeight: 600,
          }}>
            {PREVIEWS[previewIdx].caption}
          </Box>

          {/* Prev/Next */}
          <IconButton
            size="small"
            onClick={() => setPreviewIdx((i) => (i - 1 + PREVIEWS.length) % PREVIEWS.length)}
            sx={{
              position: 'absolute', top: '50%', left: 4, transform: 'translateY(-50%)',
              bgcolor: 'rgba(10, 14, 24, 0.7)', color: '#fff',
              '&:hover': { bgcolor: 'rgba(10, 14, 24, 0.95)' },
            }}
          >
            <PrevIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setPreviewIdx((i) => (i + 1) % PREVIEWS.length)}
            sx={{
              position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%)',
              bgcolor: 'rgba(10, 14, 24, 0.7)', color: '#fff',
              '&:hover': { bgcolor: 'rgba(10, 14, 24, 0.95)' },
            }}
          >
            <NextIcon sx={{ fontSize: 14 }} />
          </IconButton>

          {/* Dots */}
          <Stack direction="row" spacing={0.5} sx={{
            position: 'absolute', top: 8, right: 8,
          }}>
            {PREVIEWS.map((_, i) => (
              <Box key={i}
                onClick={() => setPreviewIdx(i)}
                sx={{
                  width: i === previewIdx ? 18 : 6, height: 6, borderRadius: 3,
                  bgcolor: i === previewIdx ? '#fbbf24' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', transition: 'width 0.2s',
                }}
              />
            ))}
          </Stack>
        </Box>

        {/* KPI-stripe */}
        {loading ? (
          <LinearProgress sx={{ mb: 2 }} />
        ) : stats ? (
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Box sx={{ flex: 1, textAlign: 'center', py: 1, bgcolor: 'rgba(52, 211, 153, 0.08)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Aktive subs
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#34d399' }}>
                {stats.activeSubscribers}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', py: 1, bgcolor: 'rgba(96, 165, 250, 0.08)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Trials
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#60a5fa' }}>
                {stats.trialUsers}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, textAlign: 'center', py: 1, bgcolor: 'rgba(251, 191, 36, 0.08)', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                MRR (NOK)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: '#fbbf24' }}>
                {stats.monthlyRevenueNok.toLocaleString('nb-NO')}
              </Typography>
            </Box>
          </Stack>
        ) : null}

        {/* Tier-rad */}
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {TIER_PRICING.map((t) => (
            <Chip
              key={t.label}
              icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
              label={`${t.label} · ${t.priceNok} kr/mnd · ${t.perks}`}
              size="small"
              sx={{ bgcolor: 'rgba(251, 191, 36, 0.12)', color: '#fbbf24', fontSize: 11 }}
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={1}>
          <AdminButton
            tone="primary"
            size="small" startIcon={<EntitlementIcon />}
            onClick={onJumpToEntitlements}
          >
            Administrer entitlements
          </AdminButton>
          <AdminButton
            tone="ghost"
            size="small" startIcon={<SettingsIcon />}
            onClick={onJumpToPricing}
          >
            Priser & Stripe
          </AdminButton>
        </Stack>
      </CardContent>
    </Card>
  );
}
