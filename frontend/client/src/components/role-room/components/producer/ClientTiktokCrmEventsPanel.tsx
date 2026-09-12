/**
 * ClientTiktokCrmEventsPanel.tsx
 *
 * Bestemor-vennlig UI: viser hvilke kunde-handlinger (registrering,
 * betaling) som er sendt til TikTok så algoritmen kan optimalisere
 * annonsene mot ekte salg — ikke bare klikk på siden.
 *
 * Designprinsipper:
 *   - Sammendrag-tall først: "X handlinger sendt"
 *   - Test-knapp for å sende et test-event manuelt
 *   - Liste over siste events med klar status
 *
 * Backend:
 *   GET  /api/admin-room/agent/ads/configs/:id/tiktok/crm-events
 *   POST /api/admin-room/agent/ads/configs/:id/tiktok/sync-crm-event
 */

import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, MenuItem,
  Select, Stack, TextField, Typography,
} from '@mui/material';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
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

interface CrmEvent {
  id: string;
  event_name: string;
  event_time: string;
  event_source: string | null;
  event_value: number | null;
  event_currency: string | null;
  delivery_status: 'pending' | 'delivered' | 'failed' | 'retrying';
  delivered_at: string | null;
  attempt_count: number;
  last_error: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  TRIAL_START: 'Prøveperiode startet',
  PAID_SIGNUP: 'Betalt registrering',
  LEAD_QUALIFIED: 'Lead kvalifisert',
  CUSTOMER_CONVERTED: 'Kunde konvertert',
  CHURN: 'Avbestilling',
};

const STATUS_LABEL: Record<string, { txt: string; color: string; bg: string }> = {
  delivered: { txt: 'SENDT', color: '#34d399', bg: 'rgba(52,211,153,0.18)' },
  pending: { txt: 'PÅ VEI', color: '#60a5fa', bg: 'rgba(96,165,250,0.18)' },
  retrying: { txt: 'PRØVER PÅ NYTT', color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' },
  failed: { txt: 'FEILET', color: '#f87171', bg: 'rgba(248,113,113,0.18)' },
};

export default function ClientTiktokCrmEventsPanel({
  configId,
  advertiserId: providedAdvertiserId,
  isOwnAccount = false,
}: {
  configId: string;
  advertiserId?: string | null;
  isOwnAccount?: boolean;
}) {
  const [advertiserId, setAdvertiserId] = useState<string>(providedAdvertiserId ?? '');
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testEvent, setTestEvent] = useState('TRIAL_START');
  const [testEmail, setTestEmail] = useState('');
  const [testValue, setTestValue] = useState('');
  const [sending, setSending] = useState(false);

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
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/crm-events`, { credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Kunne ikke hente events');
      setEvents(d.events ?? []);
      setSummary(d.summary ?? {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Henting feilet');
    } finally {
      setLoading(false);
    }
  };

  const sendTestEvent = async () => {
    if (!advertiserId || !testEmail) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin-room/agent/ads/configs/${effectiveConfigId}/tiktok/sync-crm-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          advertiserId,
          eventName: testEvent,
          eventSource: 'manual_test',
          rawEmail: testEmail,
          eventValue: testValue ? parseFloat(testValue) : undefined,
          eventCurrency: 'NOK',
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Send feilet');
      setTestOpen(false);
      setTestEmail('');
      setTestValue('');
      setTimeout(load, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send feilet');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId]);

  const total7d = (summary.delivered ?? 0) + (summary.pending ?? 0) + (summary.retrying ?? 0) + (summary.failed ?? 0);

  return (
    <Card sx={{ bgcolor: palette.bg, border: `1px solid ${palette.borderStrong}`, color: palette.textPrimary }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 2 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 1.4,
            bgcolor: 'rgba(255,0,80,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SwapVertOutlinedIcon sx={{ color: palette.tiktok, fontSize: 26 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
              Kunde-handlinger sendt til TikTok
            </Typography>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.92rem' }}>
              Når noen betaler eller registrerer seg, sender vi det videre så TikTok lærer hva som virker.
            </Typography>
          </Box>
        </Stack>

        {/* Bestemor-sammendrag */}
        <Box sx={{
          bgcolor: 'rgba(255,0,80,0.06)',
          border: `1px solid rgba(255,0,80,0.20)`,
          borderRadius: 1.6,
          p: 2.2,
          mb: 2,
        }}>
          <Typography sx={{ fontSize: '2.2rem', fontWeight: 800, color: palette.tiktok, lineHeight: 1 }}>
            {summary.delivered ?? 0}
          </Typography>
          <Typography sx={{ color: palette.textSecondary, fontSize: '1rem', mt: 0.5 }}>
            handlinger sendt vellykket siste uke
          </Typography>
          {total7d > 0 ? (
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
              {summary.pending ? (
                <Chip size="small" label={`${summary.pending} på vei`} sx={{ bgcolor: STATUS_LABEL.pending.bg, color: STATUS_LABEL.pending.color, fontWeight: 700 }} />
              ) : null}
              {summary.retrying ? (
                <Chip size="small" label={`${summary.retrying} prøver på nytt`} sx={{ bgcolor: STATUS_LABEL.retrying.bg, color: STATUS_LABEL.retrying.color, fontWeight: 700 }} />
              ) : null}
              {summary.failed ? (
                <Chip size="small" label={`${summary.failed} feilet`} sx={{ bgcolor: STATUS_LABEL.failed.bg, color: STATUS_LABEL.failed.color, fontWeight: 700 }} />
              ) : null}
            </Stack>
          ) : null}
        </Box>

        {error ? <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.6 }}>{error}</Alert> : null}

        {/* Primær handling */}
        <Stack direction="row" spacing={1.4} sx={{ mb: 2 }}>
          <Button
            onClick={() => setTestOpen(true)}
            disabled={!advertiserId}
            startIcon={<SendOutlinedIcon />}
            sx={{
              background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.96rem',
              px: 3, py: 1.2,
              borderRadius: 1.6,
              '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
            }}
          >
            Send testhandling
          </Button>
          <Button
            onClick={load}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshOutlinedIcon />}
            sx={{ color: palette.accent, textTransform: 'none', fontWeight: 600 }}
          >
            Oppdater liste
          </Button>
        </Stack>

        {/* Events-liste */}
        {events.length > 0 ? (
          <Box>
            <Typography sx={{ color: palette.textSecondary, fontSize: '0.84rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 1.2 }}>
              Siste hendelser
            </Typography>
            <Stack spacing={0.8}>
              {events.slice(0, 12).map((ev) => {
                const status = STATUS_LABEL[ev.delivery_status] ?? STATUS_LABEL.pending;
                return (
                  <Box key={ev.id} sx={{
                    bgcolor: 'rgba(168,85,247,0.04)',
                    border: `1px solid ${palette.border}`,
                    borderRadius: 1.2,
                    p: 1.4,
                  }}>
                    <Stack direction="row" alignItems="center" spacing={1.4}>
                      {ev.delivery_status === 'delivered' ? (
                        <CheckCircleOutlineIcon sx={{ color: '#34d399', fontSize: 20 }} />
                      ) : ev.delivery_status === 'failed' ? (
                        <ErrorOutlineOutlinedIcon sx={{ color: '#f87171', fontSize: 20 }} />
                      ) : (
                        <CircularProgress size={16} sx={{ color: '#60a5fa' }} />
                      )}
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: palette.textPrimary, fontWeight: 700, fontSize: '0.92rem' }}>
                          {EVENT_LABEL[ev.event_name] ?? ev.event_name}
                          {ev.event_value ? ` · ${ev.event_value} ${ev.event_currency ?? 'NOK'}` : ''}
                        </Typography>
                        <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem' }}>
                          {new Date(ev.event_time).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {ev.event_source && ev.event_source !== 'manual' ? ` · ${ev.event_source}` : ''}
                        </Typography>
                        {ev.last_error ? (
                          <Typography sx={{ color: '#fda4af', fontSize: '0.74rem', mt: 0.4 }}>
                            Feil: {ev.last_error.slice(0, 80)}
                          </Typography>
                        ) : null}
                      </Box>
                      <Chip
                        label={status.txt}
                        size="small"
                        sx={{ bgcolor: status.bg, color: status.color, fontWeight: 700, fontSize: '0.66rem' }}
                      />
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
            {events.length > 12 ? (
              <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 1.4, textAlign: 'center' }}>
                + {events.length - 12} flere
              </Typography>
            ) : null}
          </Box>
        ) : !loading ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.92rem' }}>
              Ingen handlinger sendt ennå.
            </Typography>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.82rem', mt: 0.6 }}>
              Send en test eller koble Stripe/CRM-webhooks så fyrer hendelsene automatisk.
            </Typography>
          </Box>
        ) : null}
      </CardContent>

      {/* Test-dialog */}
      <Dialog open={testOpen} onClose={() => setTestOpen(false)} PaperProps={{ sx: { bgcolor: palette.bg, color: palette.textPrimary } }}>
        <DialogTitle sx={{ color: palette.textPrimary, fontWeight: 800 }}>Send testhandling til TikTok</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: palette.textSecondary, fontSize: '0.9rem', mb: 2 }}>
            Velg hvilken handling som skjedde, og oppgi e-posten til personen.
          </Typography>
          <Stack spacing={2}>
            <Select
              size="small"
              value={testEvent}
              onChange={(e) => setTestEvent(e.target.value)}
              sx={{ color: palette.textPrimary, '& fieldset': { borderColor: palette.borderStrong } }}
              fullWidth
            >
              {Object.entries(EVENT_LABEL).map(([key, label]) => (
                <MenuItem key={key} value={key}>{label}</MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              label="E-postadresse"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="kunde@example.no"
              InputProps={{ sx: { color: palette.textPrimary } }}
              InputLabelProps={{ sx: { color: palette.textMuted } }}
            />
            <TextField
              size="small"
              type="number"
              label="Verdi (kr, valgfritt)"
              value={testValue}
              onChange={(e) => setTestValue(e.target.value)}
              InputProps={{ sx: { color: palette.textPrimary } }}
              InputLabelProps={{ sx: { color: palette.textMuted } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestOpen(false)} sx={{ color: palette.textMuted, textTransform: 'none' }}>
            Avbryt
          </Button>
          <Button
            onClick={sendTestEvent}
            disabled={!testEmail || sending}
            startIcon={sending ? <CircularProgress size={16} /> : <SendOutlinedIcon />}
            sx={{
              background: 'linear-gradient(135deg, #ff0050 0%, #d946ef 100%)',
              color: '#fff', textTransform: 'none', fontWeight: 700,
              '&:hover': { background: 'linear-gradient(135deg, #cc003c 0%, #b537cc 100%)' },
            }}
          >
            {sending ? 'Sender…' : 'Send til TikTok'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
