/**
 * AddonsPanel — Frilansdanser-utvidelse via à la carte moduler.
 *
 * Viser alle aktive add-ons + brukerens egne abonnement. CTA: "Start trial"
 * (gir trial_days tilgang uten Stripe), eller "Aktivér" (Stripe checkout —
 * placeholder for nå). Aktive add-ons kan kanselleres med "Stopp".
 *
 * Krever at brukerens plan har 'addon_eligible'-feature (Frilanser Pro).
 */

import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import {
  CheckCircleOutlineOutlined as CheckIcon,
  AutoAwesomeOutlined as AddonIcon,
  StopOutlined as StopIcon,
} from '@mui/icons-material';
import * as svc from './danceAddonService';
import { useDancePlanGate } from './useDancePlanGate';
import type { DanceAddon, DanceAddonSubscription } from './danceAddonService';

const PURPLE_BRIGHT = '#8b5cf6';
const PURPLE_DEEP   = '#4c1d95';
const PURPLE_LIGHT  = '#a78bfa';
const TEXT_DIM      = 'rgba(229,231,235,0.78)';
const TEXT_MUTED    = 'rgba(229,231,235,0.50)';
const PANEL_BORDER  = 'rgba(167,139,250,0.18)';

export const AddonsPanel: React.FC = () => {
  const gate = useDancePlanGate();
  const [addons, setAddons] = React.useState<DanceAddon[]>([]);
  const [active, setActive] = React.useState<DanceAddonSubscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, mine] = await Promise.all([
        svc.listAddons('dance_freelance'),
        svc.listMyActiveAddons(),
      ]);
      setAddons(list);
      setActive(mine);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke laste add-ons');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const eligible = gate.has('addon_eligible');
  const activeBySlug = React.useMemo(
    () => new Map(active.map((s) => [s.addonSlug, s])),
    [active],
  );

  const startTrial = async (slug: string) => {
    setBusy(slug);
    setError(null);
    try {
      await svc.startAddonTrial(slug);
      await refresh();
      await gate.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg === 'no_trial_available'
        ? 'Denne modulen har ingen prøveperiode — abonnement må kjøpes.'
        : msg === 'already_active'
          ? 'Du har allerede denne aktiv.'
          : msg);
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (slug: string) => {
    if (!window.confirm('Stopp denne modulen ved slutten av perioden?')) return;
    setBusy(slug);
    setError(null);
    try {
      await svc.cancelAddon(slug);
      await refresh();
      await gate.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke stoppe');
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: PURPLE_LIGHT }} />
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ p: { xs: 1.5, md: 2.5 }, maxWidth: 980, mx: 'auto' }}>
      {/* ── Header ── */}
      <Box>
        <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
          MODULER · LEGG TIL VED BEHOV
        </Typography>
        <Typography sx={{ fontSize: { xs: 22, md: 26 }, fontWeight: 700, color: 'rgba(237,233,254,0.95)', mt: 0.5 }}>
          Utvid kontoen din med ekstra moduler
        </Typography>
        <Typography sx={{ fontSize: 13, color: TEXT_DIM, mt: 1, maxWidth: 640 }}>
          Aktiver bare det du trenger. Modulene legger seg additivt over Frilansdanser-planen
          din — du beholder alt du allerede har, og kan stoppe når som helst.
        </Typography>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {!eligible ? (
        <Alert severity="info" sx={{ bgcolor: 'rgba(139,92,246,0.10)', color: 'rgba(237,233,254,0.92)' }}>
          For å aktivere moduler trenger du <strong>Frilansdanser Pro</strong>-planen.
          Oppgrader fra <Box component="a" href="?tab=pricing" sx={{ color: PURPLE_LIGHT, textDecoration: 'underline' }}>prisingsiden</Box>.
        </Alert>
      ) : null}

      {/* ── Grid med add-ons ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        {addons.map((a) => {
          const sub = activeBySlug.get(a.slug);
          const isActiveStatus = sub && (sub.status === 'trialing' || sub.status === 'active' || sub.status === 'comp');
          const isCanceledFuture = sub?.status === 'canceled' && sub.cancelAtPeriodEnd;
          return (
            <Card
              key={a.slug}
              sx={{
                bgcolor: isActiveStatus ? 'rgba(139,92,246,0.10)' : 'rgba(15,12,28,0.62)',
                border: `1px solid ${isActiveStatus ? 'rgba(167,139,250,0.36)' : PANEL_BORDER}`,
                borderRadius: 2,
                position: 'relative',
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
                  <AddonIcon sx={{ fontSize: 28, color: PURPLE_LIGHT, mt: 0.25 }} />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontSize: 16, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
                        {a.name}
                      </Typography>
                      {a.isFeatured ? (
                        <Chip label="Anbefalt" size="small" sx={{ bgcolor: PURPLE_BRIGHT, color: '#fff', fontWeight: 700, height: 18, fontSize: 10 }} />
                      ) : null}
                      {isActiveStatus ? (
                        <Chip
                          label={sub!.status === 'trialing' ? `Trial — ${sub!.trialEndAt ? new Date(sub!.trialEndAt).toLocaleDateString('nb-NO') : ''}` : 'Aktiv'}
                          size="small"
                          icon={<CheckIcon sx={{ fontSize: 14 }} />}
                          sx={{ bgcolor: 'rgba(34,197,94,0.18)', color: '#22c55e', fontWeight: 700, height: 20, fontSize: 11 }}
                        />
                      ) : null}
                      {isCanceledFuture ? (
                        <Chip label="Avsluttes" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontWeight: 700, height: 18, fontSize: 10 }} />
                      ) : null}
                    </Stack>
                    <Typography sx={{ fontSize: 12, color: TEXT_DIM, mt: 0.75, lineHeight: 1.5 }}>
                      {a.description}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ pl: 5, mb: 2 }}>
                  <Stack spacing={0.5}>
                    {a.featureFlags.slice(0, 4).map((f) => (
                      <Stack key={f} direction="row" spacing={1} alignItems="center">
                        <CheckIcon sx={{ fontSize: 14, color: PURPLE_LIGHT }} />
                        <Typography sx={{ fontSize: 11, color: TEXT_MUTED, fontFamily: 'monospace' }}>
                          {f}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>

                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography sx={{ fontSize: 12, color: TEXT_MUTED }}>
                    {a.monthlyPriceKr != null
                      ? `kr ${a.monthlyPriceKr}/mnd`
                      : a.trialDays > 0
                        ? `${a.trialDays} dagers gratis trial`
                        : 'Kontakt oss'}
                  </Typography>
                  {isActiveStatus && !isCanceledFuture ? (
                    <Button
                      size="small"
                      onClick={() => cancel(a.slug)}
                      disabled={busy === a.slug}
                      startIcon={<StopIcon />}
                      sx={{ textTransform: 'none', color: '#f87171', fontSize: 12 }}
                    >
                      Stopp
                    </Button>
                  ) : !isActiveStatus && eligible ? (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => startTrial(a.slug)}
                      disabled={busy === a.slug || a.trialDays === 0}
                      sx={{
                        bgcolor: PURPLE_BRIGHT,
                        '&:hover': { bgcolor: PURPLE_DEEP },
                        textTransform: 'none',
                        fontWeight: 600,
                      }}
                    >
                      {busy === a.slug
                        ? 'Aktiverer…'
                        : a.trialDays > 0
                          ? `Start trial (${a.trialDays}d)`
                          : 'Aktivér'}
                    </Button>
                  ) : null}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Stack>
  );
};

export default AddonsPanel;
