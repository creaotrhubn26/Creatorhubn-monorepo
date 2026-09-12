/**
 * ClientAdsCrmEventsPanel.tsx
 *
 * Plattform-agnostisk CAPI events-panel. Server-side conversion events
 * sendt til Meta / LinkedIn / Google på vegne av klient.
 *
 * Speil av ClientTiktokCrmEventsPanel men med en `platform`-prop som styrer:
 *   - Hvilken backend-endepunkt som brukes
 *   - Hvilket plattform-spesifikt felt som kreves
 *     (pixelId | conversionUrn | customerId+conversionActionResource)
 *   - Hvilken eventName som er gyldig (Meta-standard / vilkårlig / vilkårlig)
 *   - Farge + plattform-navn
 *
 * Bestemor-vennlig UX: sammendrag-tall først, én primær CTA (Send test-event),
 * tabell over siste leveranser med farget status-chip.
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Select, Stack, TextField, Typography, Switch, FormControlLabel,
} from '@mui/material';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

type Platform = 'meta' | 'linkedin' | 'google';

interface PlatformConfig {
  name: string;
  color: string;
  bg: string;
  border: string;
  listEndpoint: (cid: string) => string;
  sendEndpoint: (cid: string) => string;
  /** Felter som vises i Send-dialogen utenom universelle (email, value, currency) */
  targetField: 'pixelId' | 'conversionUrn' | 'customerId+conversionActionResource';
  targetLabel: string;
  helpText: string;
  defaultEventNames: string[];
}

const PLATFORM_META: Record<Platform, PlatformConfig> = {
  meta: {
    name: 'Meta CAPI',
    color: '#1877f2',
    bg: 'rgba(24,119,242,0.06)',
    border: 'rgba(24,119,242,0.30)',
    listEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/meta/capi-events`,
    sendEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/meta/send-capi-event`,
    targetField: 'pixelId',
    targetLabel: 'Meta Pixel-ID',
    helpText: 'Pixel som er provisionert for klienten i fanen "Sporing".',
    defaultEventNames: ['Lead', 'CompleteRegistration', 'Purchase', 'AddToCart', 'Subscribe', 'StartTrial'],
  },
  linkedin: {
    name: 'LinkedIn Conversions API',
    color: '#0a66c2',
    bg: 'rgba(10,102,194,0.06)',
    border: 'rgba(10,102,194,0.30)',
    listEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/linkedin/capi-events`,
    sendEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/linkedin/send-capi-event`,
    targetField: 'conversionUrn',
    targetLabel: 'Conversion URN',
    helpText: 'URN-en til Conversion Rule, f.eks. urn:lla:llaPartnerConversion:12345678',
    defaultEventNames: ['Lead', 'Sign-Up', 'Purchase', 'Download', 'Add-to-Cart'],
  },
  google: {
    name: 'Google Offline Conversions',
    color: '#fbbc05',
    bg: 'rgba(251,188,5,0.06)',
    border: 'rgba(251,188,5,0.30)',
    listEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/google/capi-events`,
    sendEndpoint: (cid) => `/api/admin-room/agent/ads/configs/${cid}/google/send-capi-event`,
    targetField: 'customerId+conversionActionResource',
    targetLabel: 'Customer ID + ConversionAction-resource',
    helpText: 'Customer ID (10 sifre uten bindestreker) + customers/X/conversionActions/Y.',
    defaultEventNames: ['Lead', 'Purchase', 'Sign-Up', 'Trial Start', 'Subscribe'],
  },
};

const palette = {
  bg: '#150b2e',
  border: 'rgba(168,85,247,0.18)',
  borderStrong: 'rgba(168,85,247,0.32)',
  textPrimary: '#f5f3ff',
  textSecondary: '#c4b5fd',
  textMuted: '#94a3b8',
  accent: '#c084fc',
};

const STATUS_LABEL: Record<string, { txt: string; color: string; bg: string }> = {
  delivered: { txt: 'SENDT', color: '#34d399', bg: 'rgba(52,211,153,0.18)' },
  pending: { txt: 'PÅ VEI', color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  retrying: { txt: 'PRØVER PÅ NYTT', color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' },
  failed: { txt: 'FEILET', color: '#f87171', bg: 'rgba(248,113,113,0.18)' },
};

interface CapiEvent {
  id: string;
  eventName: string;
  eventTime: string;
  eventValue: number | null;
  eventCurrency: string;
  deliveryStatus: 'pending' | 'delivered' | 'failed' | 'retrying';
  deliveredAt: string | null;
  attemptCount: number;
  lastError: string | null;
}

export default function ClientAdsCrmEventsPanel({
  configId,
  platform,
}: {
  configId: string;
  platform: Platform;
}) {
  const meta = PLATFORM_META[platform];

  const [events, setEvents] = useState<CapiEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [testOpen, setTestOpen] = useState(false);
  const [target1, setTarget1] = useState('');                    // pixelId | conversionUrn | customerId
  const [target2, setTarget2] = useState('');                    // (google only) conversionActionResource
  const [eventName, setEventName] = useState(meta.defaultEventNames[0]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState<string>('');
  const [currency, setCurrency] = useState('NOK');
  const [enhanced, setEnhanced] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch(meta.listEndpoint(configId), { credentials: 'include' });
      if (r.status === 412) {
        const body = await r.json();
        setError(body.error ?? 'Klient har ikke godkjent denne handlingen.');
      } else if (!r.ok) {
        setError(`HTTP ${r.status}`);
      } else {
        const body = await r.json();
        setEvents(body.events ?? []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { refresh(); }, [configId, platform]);

  const handleSendTest = async () => {
    if (!eventName) return;
    setSending(true);
    setSendResult(null);
    try {
      const body: Record<string, unknown> = {
        eventName,
        email: email || undefined,
        phone: phone || undefined,
        value: value ? Number(value) : undefined,
        currency,
        eventSourceUrl: 'https://creatorhubn.com/test-capi',
      };
      if (meta.targetField === 'pixelId') body.pixelId = target1;
      if (meta.targetField === 'conversionUrn') body.conversionUrn = target1;
      if (meta.targetField === 'customerId+conversionActionResource') {
        body.customerId = target1;
        body.conversionActionResource = target2;
        body.enhancedConversions = enhanced;
      }
      const r = await fetch(meta.sendEndpoint(configId), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const respBody = await r.json();
      if (!r.ok) {
        setSendResult({ ok: false, text: respBody.error ?? `HTTP ${r.status}` });
      } else {
        setSendResult({ ok: true, text: 'Sendt! Sjekker leveransestatus...' });
        setTimeout(() => { refresh(); }, 1200);
      }
    } catch (e) {
      setSendResult({ ok: false, text: String(e) });
    } finally {
      setSending(false);
    }
  };

  const summary = {
    delivered: events.filter((e) => e.deliveryStatus === 'delivered').length,
    failed: events.filter((e) => e.deliveryStatus === 'failed').length,
    pending: events.filter((e) => e.deliveryStatus === 'pending' || e.deliveryStatus === 'retrying').length,
  };

  if (loading) {
    return (
      <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 2 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} sx={{ color: meta.color }} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${meta.border}`, borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.2, bgcolor: meta.bg,
              border: `1px solid ${meta.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SwapVertOutlinedIcon sx={{ color: meta.color, fontSize: 20 }} />
            </Box>
            <Stack>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: palette.textPrimary }}>
                {meta.name}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: palette.textSecondary }}>
                Server-side konverteringer sendt til {meta.name.split(' ')[0]}
              </Typography>
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              onClick={refresh}
              disabled={refreshing}
              startIcon={refreshing ? <CircularProgress size={14} /> : <RefreshOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ color: palette.textSecondary, fontSize: '0.78rem' }}
            >
              Oppdater
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setTestOpen(true)}
              startIcon={<SendOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{
                bgcolor: meta.color, fontWeight: 700, fontSize: '0.78rem',
                '&:hover': { bgcolor: meta.color, filter: 'brightness(1.1)' },
              }}
            >
              Send test-event
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="warning" sx={{ mb: 2, fontSize: '0.84rem' }}>
            {error}
          </Alert>
        )}

        {/* Sammendrag-bokser */}
        <Stack direction="row" spacing={1.4} sx={{ mb: 2 }}>
          {[
            { label: 'Sendt OK', n: summary.delivered, color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
            { label: 'Underveis', n: summary.pending, color: '#60a5fa', bg: 'rgba(96,165,250,0.10)' },
            { label: 'Feilet', n: summary.failed, color: '#f87171', bg: 'rgba(248,113,113,0.10)' },
          ].map((b) => (
            <Box key={b.label} sx={{
              flex: 1, p: 1.6, borderRadius: 1.4,
              bgcolor: b.bg, border: `1px solid ${b.color}33`,
            }}>
              <Typography sx={{ fontSize: '0.74rem', color: palette.textMuted, fontWeight: 600 }}>
                {b.label}
              </Typography>
              <Typography sx={{ fontSize: '1.8rem', fontWeight: 800, color: b.color, lineHeight: 1.1 }}>
                {b.n}
              </Typography>
            </Box>
          ))}
        </Stack>

        {/* Liste */}
        {events.length === 0 ? (
          <Alert severity="info" sx={{ fontSize: '0.84rem' }}>
            Ingen events sendt ennå. Bruk "Send test-event" for å verifisere oppsettet, eller la systemet
            automatisk sende konverteringer fra CRM-en når kundene gjør et kjøp.
          </Alert>
        ) : (
          <Stack spacing={0.8}>
            {events.slice(0, 10).map((ev) => {
              const status = STATUS_LABEL[ev.deliveryStatus] ?? STATUS_LABEL.pending;
              return (
                <Box key={ev.id} sx={{
                  p: 1.4, borderRadius: 1.2,
                  bgcolor: 'rgba(168,85,247,0.04)',
                  border: `1px solid ${palette.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 1.4,
                }}>
                  <Stack direction="row" alignItems="center" spacing={1.4} sx={{ flex: 1, minWidth: 0 }}>
                    {ev.deliveryStatus === 'delivered'
                      ? <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 18 }} />
                      : ev.deliveryStatus === 'failed'
                        ? <ErrorOutlineOutlinedIcon sx={{ color: '#f87171', fontSize: 18 }} />
                        : <CircularProgress size={14} sx={{ color: '#60a5fa' }} />
                    }
                    <Stack sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: palette.textPrimary }}>
                        {ev.eventName}
                        {ev.eventValue !== null && (
                          <Box component="span" sx={{ ml: 1, color: meta.color, fontWeight: 600 }}>
                            — {ev.eventValue.toLocaleString('nb-NO')} {ev.eventCurrency}
                          </Box>
                        )}
                      </Typography>
                      <Typography sx={{ fontSize: '0.72rem', color: palette.textMuted }}>
                        {new Date(ev.eventTime).toLocaleString('nb-NO')}
                        {ev.attemptCount > 1 && ` · ${ev.attemptCount} forsøk`}
                      </Typography>
                      {ev.lastError && ev.deliveryStatus === 'failed' && (
                        <Typography sx={{ fontSize: '0.72rem', color: '#f87171', mt: 0.4 }}>
                          {ev.lastError.slice(0, 160)}
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                  <Chip
                    label={status.txt}
                    size="small"
                    sx={{
                      bgcolor: status.bg, color: status.color,
                      fontWeight: 700, fontSize: '0.68rem',
                    }}
                  />
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>

      {/* Test-event dialog */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Send test-konvertering til {meta.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
              {meta.helpText}
            </Alert>

            <TextField
              label={meta.targetField === 'customerId+conversionActionResource' ? 'Customer ID' : meta.targetLabel}
              value={target1}
              onChange={(e) => setTarget1(e.target.value)}
              size="small"
              fullWidth
            />
            {meta.targetField === 'customerId+conversionActionResource' && (
              <TextField
                label="ConversionAction-resource"
                placeholder="customers/1234567890/conversionActions/9876543"
                value={target2}
                onChange={(e) => setTarget2(e.target.value)}
                size="small"
                fullWidth
              />
            )}

            <Select
              size="small"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              fullWidth
            >
              {meta.defaultEventNames.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>

            <TextField
              label="E-post (hashes før sending)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              size="small"
              fullWidth
              type="email"
            />
            <TextField
              label="Telefon (valgfritt, hashes før sending)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1.4}>
              <TextField
                label="Verdi"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                size="small"
                type="number"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Valuta"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                size="small"
                sx={{ width: 100 }}
              />
            </Stack>

            {platform === 'google' && (
              <FormControlLabel
                control={<Switch checked={enhanced} onChange={(e) => setEnhanced(e.target.checked)} />}
                label="Enhanced Conversions (bruk user_identifiers i stedet for gclid)"
              />
            )}

            {sendResult && (
              <Alert severity={sendResult.ok ? 'success' : 'error'} sx={{ fontSize: '0.82rem' }}>
                {sendResult.text}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)} sx={{ color: palette.textSecondary }}>
            Lukk
          </Button>
          <Button
            onClick={handleSendTest}
            variant="contained"
            disabled={sending || !target1 || (meta.targetField === 'customerId+conversionActionResource' && !target2) || !eventName}
            startIcon={sending ? <CircularProgress size={14} /> : <SendOutlinedIcon sx={{ fontSize: 16 }} />}
            sx={{
              bgcolor: meta.color, fontWeight: 700,
              '&:hover': { bgcolor: meta.color, filter: 'brightness(1.1)' },
            }}
          >
            Send event
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
