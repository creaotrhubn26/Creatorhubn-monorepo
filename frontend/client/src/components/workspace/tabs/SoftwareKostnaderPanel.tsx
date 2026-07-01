// @ts-nocheck
/**
 * SoftwareKostnaderPanel — programvare- & abonnement-kostnader i workspace.
 * To kilder: (1) «Skann e-post» → Gmail/Outlook-kvitteringer parses av AI →
 * forslag du godkjenner; (2) manuell registrering. Regner ut månedlig/årlig forbruk +
 * kategori-fordeling + kommende fornyelser. Backend: /api/software/*.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, Dialog, DialogContent, DialogActions, IconButton, TextField, MenuItem, CircularProgress } from '@mui/material';
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import Close from '@mui/icons-material/Close';
import Check from '@mui/icons-material/Check';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag } from '../ui';

const fmtKr = (n?: number) => (n && n > 0 ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '—');
const CYCLE_LABEL = { monthly: 'mnd', yearly: 'år', engang: 'engang', unknown: '' };
const CATS = ['DAW', 'Plugin / instrument', 'Samplepakke / lydbibliotek', 'Redigeringsprogramvare', 'Foto-software', 'Video-software', 'Skylagring', 'AI-verktøy', 'Produktivitet', 'Annet'];
const daysUntil = (iso?: string) => { if (!iso) return null; try { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); } catch { return null; } };
const ti = { '& .MuiOutlinedInput-root': { fontSize: 13.5, color: ws.text, bgcolor: ws.panel, '& fieldset': { borderColor: ws.borderSoft }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ws.accent } }, '& input::placeholder': { color: ws.textFaint, opacity: 1 }, '& .MuiInputLabel-root': { color: ws.textDim } };

const line = (r: any) => {
  const name = [r.vendor, r.product].filter(Boolean).join(' · ') || r.product || r.vendor || 'Ukjent';
  const amt = r.amount_nok ? `${fmtKr(Number(r.amount_nok))}${r.is_subscription && CYCLE_LABEL[r.billing_cycle] ? `/${CYCLE_LABEL[r.billing_cycle]}` : ''}` : '—';
  return { name, amt };
};

const SoftwareKostnaderPanel: React.FC<{ userId?: string }> = ({ userId }) => {
  const [data, setData] = useState<any>({ confirmed: [], suggestions: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ tone: string; text: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ vendor: '', product: '', category: CATS[0], amount: '', currency: 'NOK', billingCycle: 'monthly', isSubscription: true, renewalDate: '' });
  const [outlook, setOutlook] = useState<any>({ configured: false, connected: false, email: null });

  const load = () => {
    apiRequest('/api/software/expenses')
      .then((r: any) => setData({ confirmed: r?.confirmed || [], suggestions: r?.suggestions || [], summary: r?.summary || null }))
      .catch(() => setData({ confirmed: [], suggestions: [], summary: null }))
      .finally(() => setLoading(false));
  };
  const loadOutlook = () => {
    apiRequest('/api/creatorhub/microsoft/status')
      .then((r: any) => setOutlook({ configured: !!r?.configured, connected: !!r?.connected, email: r?.email || null }))
      .catch(() => setOutlook({ configured: false, connected: false, email: null }));
  };
  useEffect(() => {
    load(); loadOutlook();
    // Etter Outlook-OAuth redirecter backend til ?outlook=connected — vis kvittering.
    try {
      const p = new URLSearchParams(window.location.search).get('outlook');
      if (p === 'connected') setScanMsg({ tone: 'green', text: 'Outlook koblet til. Trykk «Skann e-post» for å hente kvitteringer.' });
      else if (p && p !== 'connected') setScanMsg({ tone: 'amber', text: 'Outlook-tilkobling ble ikke fullført. Prøv igjen.' });
    } catch { /* */ }
    /* eslint-disable-next-line */
  }, [userId]);

  const connectOutlook = async () => {
    try {
      const r: any = await apiRequest('/api/creatorhub/microsoft/oauth/url');
      if (r?.url) window.location.href = r.url;
      else setScanMsg({ tone: 'amber', text: 'Outlook-integrasjon er ikke konfigurert på serveren ennå.' });
    } catch (e: any) { setScanMsg({ tone: 'red', text: e?.message || 'Kunne ikke starte Outlook-tilkobling.' }); }
  };
  const disconnectOutlook = async () => {
    try { await apiRequest('/api/creatorhub/microsoft/disconnect', { method: 'POST', body: {} }); loadOutlook(); } catch { /* */ }
  };

  const scan = async () => {
    setScanning(true); setScanMsg(null);
    try {
      const r: any = await apiRequest('/api/software/scan-receipts', { method: 'POST', body: {} });
      const map: any = {
        no_credentials: { tone: 'amber', text: 'Ingen e-post koblet. Koble til Google eller Outlook for å skanne kvitteringer.' },
        no_scope: { tone: 'amber', text: 'Mangler lesetilgang til Gmail. Koble til Google på nytt og godkjenn lesetilgang.' },
        ai_unconfigured: { tone: 'amber', text: 'AI-parsing er ikke konfigurert på serveren ennå.' },
        failed: { tone: 'red', text: r?.message || 'Skanning feilet. Prøv igjen.' },
        ok: { tone: r?.created ? 'green' : 'neutral', text: r?.message || 'Skann fullført.' },
      };
      setScanMsg(map[r?.status] || { tone: 'neutral', text: r?.message || 'Skann fullført.' });
      if (r?.status === 'ok') load();
    } catch (e: any) { setScanMsg({ tone: 'red', text: e?.message || 'Skanning feilet.' }); }
    finally { setScanning(false); }
  };

  const approve = async (id: number) => { setBusyId(id); try { await apiRequest(`/api/software/expenses/${id}`, { method: 'PATCH', body: { status: 'bekreftet' } }); load(); } catch (e: any) { window.alert(e?.message || 'Feilet'); } finally { setBusyId(null); } };
  const reject = async (id: number) => { setBusyId(id); try { await apiRequest(`/api/software/expenses/${id}`, { method: 'DELETE' }); load(); } catch (e: any) { window.alert(e?.message || 'Feilet'); } finally { setBusyId(null); } };

  const saveManual = async () => {
    if (!form.vendor.trim() && !form.product.trim()) { window.alert('Fyll inn leverandør eller produkt.'); return; }
    setSaving(true);
    try {
      await apiRequest('/api/software/expenses', { method: 'POST', body: {
        vendor: form.vendor, product: form.product, category: form.category,
        amount: form.amount === '' ? null : Number(form.amount), currency: form.currency,
        billingCycle: form.isSubscription ? form.billingCycle : 'engang', isSubscription: form.isSubscription,
        renewalDate: form.isSubscription ? (form.renewalDate || null) : null,
      } });
      setOpen(false); setForm({ vendor: '', product: '', category: CATS[0], amount: '', currency: 'NOK', billingCycle: 'monthly', isSubscription: true, renewalDate: '' });
      load();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); }
    finally { setSaving(false); }
  };

  if (loading) return <WsCard sx={{ mb: 2 }}><Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} sx={{ color: ws.accent }} /></Box></WsCard>;

  const sum = data.summary || { monthlyNok: 0, yearlyNok: 0, subscriptionCount: 0, byCategory: {} };
  const cats = Object.entries(sum.byCategory || {}).sort((a: any, b: any) => b[1] - a[1]);
  const nothing = data.confirmed.length === 0 && data.suggestions.length === 0;

  return (
    <WsCard sx={{ mb: 2 }}>
      {/* Header + skann/manuell */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: nothing ? 1 : 1.5 }}>
        <Typography sx={{ fontSize: 15 }}>💳</Typography>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Programvare & abonnement</Typography>
        <Box sx={{ flex: 1 }} />
        {sum.monthlyNok > 0 && <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Løpende: <b style={{ color: ws.accent }}>{fmtKr(sum.monthlyNok)}/mnd</b> ≈ {fmtKr(sum.yearlyNok)}/år</Typography>}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: nothing ? 0 : 1.5 }}>
        <Button size="small" variant="contained" disabled={scanning} startIcon={scanning ? <CircularProgress size={14} sx={{ color: ws.accentContrast }} /> : <MarkEmailReadOutlined />}
          onClick={scan} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
          {scanning ? 'Skanner e-post…' : 'Skann e-post for kvitteringer'}
        </Button>
        <Button size="small" startIcon={<AddCircleOutline />} onClick={() => setOpen(true)} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>Legg til manuelt</Button>
        <Box sx={{ flex: 1 }} />
        {outlook.configured && (outlook.connected
          ? <Stack direction="row" alignItems="center" spacing={0.5}><WsTag label={`Outlook: ${outlook.email || 'koblet'}`} tone="green" /><IconButton size="small" onClick={disconnectOutlook} title="Koble fra Outlook" sx={{ color: ws.textFaint }}><Close sx={{ fontSize: 14 }} /></IconButton></Stack>
          : <Button size="small" onClick={connectOutlook} sx={{ color: ws.textDim, textTransform: 'none', fontWeight: 700, border: `1px solid ${ws.borderSoft}` }}>Koble til Outlook</Button>)}
      </Stack>

      {scanMsg && (
        <Box sx={{ mb: nothing ? 0 : 1.5, p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${scanMsg.tone === 'red' ? '#7f1d1d' : scanMsg.tone === 'green' ? '#14532d' : ws.borderSoft}` }}>
          <Typography sx={{ fontSize: 12, color: scanMsg.tone === 'red' ? '#fca5a5' : scanMsg.tone === 'green' ? '#86efac' : ws.textDim }}>{scanMsg.text}</Typography>
        </Box>
      )}

      {nothing && !scanMsg && (
        <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Skann e-posten din for kvitteringer fra Adobe, Splice, Native Instruments m.fl. — eller legg inn manuelt. Vi samler, kategoriserer og regner ut månedskostnaden din.</Typography>
      )}

      {/* Forslag til gjennomgang */}
      {data.suggestions.length > 0 && (
        <Box sx={{ mb: data.confirmed.length ? 1.75 : 0 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.amber, mb: 0.75 }}>📥 Funnet i e-post — til gjennomgang ({data.suggestions.length})</Typography>
          <Stack spacing={0.6}>
            {data.suggestions.map((r: any) => { const l = line(r); return (
              <Stack key={r.id} direction="row" alignItems="center" spacing={1} sx={{ p: 0.85, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.accentBorder}` }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }} noWrap>{l.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }} noWrap>{r.category} · {l.amt}{r.confidence ? ` · ${r.confidence} sikkerhet` : ''}</Typography>
                </Box>
                <IconButton size="small" disabled={busyId === r.id} onClick={() => approve(r.id)} title="Godkjenn" sx={{ color: '#86efac', border: '1px solid #14532d' }}><Check sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" disabled={busyId === r.id} onClick={() => reject(r.id)} title="Avvis" sx={{ color: ws.textDim, border: `1px solid ${ws.borderSoft}` }}><Close sx={{ fontSize: 16 }} /></IconButton>
              </Stack>
            ); })}
          </Stack>
        </Box>
      )}

      {/* Bekreftede kostnader */}
      {data.confirmed.length > 0 && (
        <>
          <Stack spacing={0.5}>
            {data.confirmed.map((r: any) => { const l = line(r); const d = r.is_subscription ? daysUntil(r.renewal_date) : null; return (
              <Stack key={r.id} direction="row" alignItems="center" spacing={1} sx={{ p: 0.85, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700 }} noWrap>{l.name}</Typography>
                  <Typography sx={{ fontSize: 11, color: ws.textFaint }} noWrap>{r.category}{r.source === 'email' ? ' · fra e-post' : ''}</Typography>
                </Box>
                <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{l.amt}</Typography>
                {r.is_subscription && r.renewal_date && <WsTag label={d != null && d <= 7 ? `Fornyes om ${d} d` : `Fornyes ${new Date(r.renewal_date).toLocaleDateString('nb-NO', { day: '2-digit', month: 'short' })}`} tone={d != null && d <= 7 ? 'red' : 'neutral'} />}
                {!r.is_subscription && <WsTag label="Engangskjøp" tone="neutral" />}
                <IconButton size="small" disabled={busyId === r.id} onClick={() => reject(r.id)} title="Fjern" sx={{ color: ws.textFaint }}><Close sx={{ fontSize: 15 }} /></IconButton>
              </Stack>
            ); })}
          </Stack>
          {cats.length > 0 && (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1.25 }}>
              {cats.map(([c, v]: any) => <WsTag key={c} label={`${c}: ${fmtKr(v)}/mnd`} tone="neutral" />)}
            </Stack>
          )}
        </>
      )}

      {/* Manuell registrering */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Legg til programvare / abonnement</Typography>
          <IconButton onClick={() => setOpen(false)} sx={{ color: ws.textDim }}><Close /></IconButton>
        </Stack>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" label="Leverandør" placeholder="Adobe" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} fullWidth sx={ti} />
              <TextField size="small" label="Produkt / plan" placeholder="Creative Cloud" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} fullWidth sx={ti} />
            </Stack>
            <TextField size="small" select label="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth sx={ti}>
              {CATS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={1}>
              {[[true, 'Abonnement'], [false, 'Engangskjøp']].map(([v, l]: any) => (
                <button key={String(v)} onClick={() => setForm({ ...form, isSubscription: v })}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1px solid ${form.isSubscription === v ? ws.accentBorder : ws.border}`, background: form.isSubscription === v ? ws.accentSoft : 'transparent', color: form.isSubscription === v ? ws.accent : ws.textDim }}>{l}</button>
              ))}
            </Stack>
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" type="number" label="Beløp" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} fullWidth sx={ti} />
              <TextField size="small" select label="Valuta" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} sx={{ ...ti, width: 110 }}>
                {['NOK', 'USD', 'EUR', 'GBP', 'SEK', 'DKK'].map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
              {form.isSubscription && (
                <TextField size="small" select label="Fakturering" value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} sx={{ ...ti, width: 130 }}>
                  <MenuItem value="monthly">Månedlig</MenuItem>
                  <MenuItem value="yearly">Årlig</MenuItem>
                </TextField>
              )}
            </Stack>
            {form.isSubscription && (
              <TextField size="small" type="date" label="Fornyes" InputLabelProps={{ shrink: true }} value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} sx={ti} />
            )}
            {form.currency !== 'NOK' && <Typography sx={{ fontSize: 11, color: ws.textFaint }}>Beløp regnes om til NOK (tilnærmet kurs) for oversikten.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button onClick={saveManual} disabled={saving} variant="contained" sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{saving ? 'Lagrer…' : 'Legg til'}</Button>
        </DialogActions>
      </Dialog>
    </WsCard>
  );
};

export default SoftwareKostnaderPanel;
