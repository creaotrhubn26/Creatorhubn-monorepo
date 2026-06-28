// @ts-nocheck
/**
 * GenerativeAiAdminPanel — admin-styring for generativ AI (fal).
 *
 * Aktiver/deaktiver, bytt billing-modus (gratis-whitelist ↔ metered), sett
 * dagstak/whitelist/inkludert-kvote — alt fra dashbordet, ingen env-redigering.
 * Metered-modus aktiverer den sovende Stripe-metering-hooken (krever i tillegg
 * at STRIPE_OVERAGE_GENAI_*-env er satt på backend — vises som status her).
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Switch, Button, TextField, Select, MenuItem, Chip, CircularProgress, Divider, Alert } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';

const GenerativeAiAdminPanel: React.FC = () => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    apiRequest('/api/admin/generative-ai-settings')
      .then((r: any) => { setData(r || null); setForm({ ...(r?.settings || {}), whitelist: (r?.settings?.whitelist || []).join('\n') }); })
      .catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const body = {
        enabled: !!form.enabled,
        billingMode: form.billingMode,
        dailyCapUsd: Number(form.dailyCapUsd),
        includedQuota: Number(form.includedQuota || 0),
        whitelist: String(form.whitelist || '').split('\n').map((s: string) => s.trim()).filter(Boolean),
      };
      const r: any = await apiRequest('/api/admin/generative-ai-settings', { method: 'PUT', body });
      setData((d: any) => ({ ...d, settings: r.settings }));
      setSavedAt(Date.now());
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); }
    finally { setSaving(false); }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;

  const meterReady = data?.meterConfigured;
  const metered = form.billingMode === 'metered';

  return (
    <Box sx={{ maxWidth: 760 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Generativ AI</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Styr generative AI-funksjoner (Nano Banana 2-redigering m.fl. via fal). Aktiver, sett budsjett og bestem hvem som får tilgang.
      </Typography>

      {!data?.falConfigured && <Alert severity="warning" sx={{ mb: 2 }}>FAL_KEY mangler på backend — generering er utilgjengelig til den settes.</Alert>}

      <Box sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography sx={{ fontWeight: 700 }}>Aktivert</Typography>
            <Typography variant="caption" color="text.secondary">Hovedbryter — skrur av/på all generativ AI.</Typography>
          </Box>
          <Switch checked={!!form.enabled} onChange={(e) => setForm((f: any) => ({ ...f, enabled: e.target.checked }))} />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography sx={{ fontWeight: 700, mb: 1 }}>Tilgang & fakturering</Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">Modus</Typography>
            <Select fullWidth size="small" value={form.billingMode || 'free_whitelist'} onChange={(e) => setForm((f: any) => ({ ...f, billingMode: e.target.value }))} sx={{ mt: 0.5 }}>
              <MenuItem value="free_whitelist">Gratis — kun whitelist (pilot)</MenuItem>
              <MenuItem value="metered">Metered — fakturer pr bruk (Stripe)</MenuItem>
            </Select>
            {metered && !meterReady && <Alert severity="info" sx={{ mt: 1 }}>Metered-modus er valgt, men Stripe-måleren er ikke konfigurert ennå. Sett env <b>STRIPE_OVERAGE_GENAI_METER_EVENT_NAME</b> (+ måler/pris i Stripe) på backend — så begynner metering automatisk. Til da er hooken sovende (no-op).</Alert>}
            {metered && meterReady && <Alert severity="success" sx={{ mt: 1 }}>Stripe-måler konfigurert — metering er aktiv.</Alert>}
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">Global dagstak (USD) — sikkerhets-bryter mot løpsk kostnad</Typography>
            <TextField type="number" size="small" value={form.dailyCapUsd ?? 20} onChange={(e) => setForm((f: any) => ({ ...f, dailyCapUsd: e.target.value }))} sx={{ mt: 0.5, width: 160 }} />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>Brukt i dag: ${(data?.spentTodayUsd ?? 0).toFixed(2)}</Typography>
          </Box>

          {metered && (
            <Box>
              <Typography variant="caption" color="text.secondary">Inkludert kvote pr bruker/mnd (overage faktureres)</Typography>
              <TextField type="number" size="small" value={form.includedQuota ?? 0} onChange={(e) => setForm((f: any) => ({ ...f, includedQuota: e.target.value }))} sx={{ mt: 0.5, width: 160 }} />
            </Box>
          )}

          <Box>
            <Typography variant="caption" color="text.secondary">Whitelist (én e-post pr linje) — super_admin har alltid tilgang</Typography>
            <TextField multiline minRows={3} fullWidth size="small" value={form.whitelist || ''} onChange={(e) => setForm((f: any) => ({ ...f, whitelist: e.target.value }))} sx={{ mt: 0.5 }} placeholder={'daniel@creatorhubn.com\nola@kunde.no'} />
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">Tilgjengelige modeller:</Typography>
          {(data?.models || []).map((m: any) => <Chip key={m.key} size="small" label={`${m.label} · ~$${m.estCostUsd}`} />)}
        </Stack>

        <Stack direction="row" justifyContent="flex-end" alignItems="center" spacing={1.5} sx={{ mt: 2 }}>
          {savedAt && <Typography variant="caption" color="success.main">Lagret ✓</Typography>}
          <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Lagrer…' : 'Lagre innstillinger'}</Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default GenerativeAiAdminPanel;
