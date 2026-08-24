// @ts-nocheck
/**
 * UtstyrTab — utstyr/gear i workspace (ws-design). Gjenbruker de eksisterende
 * equipment-backendene (/api/equipment/inventory, /search, /firmware-updates).
 * Musikkprodusent legger inn gear og får MARKEDSVERDI: katalog-søk først, ellers
 * AI-estimat (/api/equipment/estimate-value) — så «Bock mikrofon» → hva den koster.
 * Vedlikehold/firmware: viser enheter med tilgjengelig firmware-oppdatering.
 */
import React, { useEffect, useState } from 'react';
import { Box, Stack, Typography, Button, Dialog, DialogContent, DialogActions, IconButton, TextField, MenuItem, CircularProgress } from '@mui/material';
import Inventory2 from '@mui/icons-material/Inventory2';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import SystemUpdateAlt from '@mui/icons-material/SystemUpdateAlt';
import Close from '@mui/icons-material/Close';
import PriceCheck from '@mui/icons-material/PriceCheck';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsTag, wsAlert } from '../ui';
import SoftwareKostnaderPanel from './SoftwareKostnaderPanel';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab). Kategori-VERDIENE
// (sendes til API-et) er uendret — kun visningen oversettes via CAT_EN.
const T: WsDict = {
  titleMusic: { no: 'Studio-utstyr', en: 'Studio equipment' },
  title: { no: 'Utstyr', en: 'Inventory' },
  subRegister: { no: 'Registrer', en: 'Register' },
  subItemsMusic: { no: 'utstyr, programvare (DAW) og plugins', en: 'gear, software (DAW) and plugins' },
  subItems: { no: 'utstyr og programvare', en: 'gear and software' },
  subRest: { no: ', få markedsverdi automatisk, og hold styr på vedlikehold & firmware.', en: ', get market value automatically, and keep track of maintenance & firmware.' },
  totalValue: { no: 'Samlet verdi:', en: 'Total value:' },
  addEquipment: { no: 'Legg til utstyr', en: 'Add equipment' },
  brandModelRequired: { no: 'Merke og modell er påkrevd.', en: 'Brand and model are required.' },
  couldNotSave: { no: 'Kunne ikke lagre', en: 'Could not save' },
  equipLicenses: { no: 'Utstyrs-lisenser', en: 'Equipment licenses' },
  recurring: { no: 'Løpende:', en: 'Recurring:' },
  perMonth: { no: 'mnd', en: 'mo' },
  perYear: { no: 'år', en: 'yr' },
  renewsIn: { no: 'Fornyes om', en: 'Renews in' },
  renews: { no: 'Fornyes', en: 'Renews' },
  renewal: { no: 'fornyelse', en: 'renewal' },
  renewals: { no: 'fornyelser', en: 'renewals' },
  within30: { no: 'innen 30 dager.', en: 'within 30 days.' },
  firmwareAvail: { no: 'Firmware-oppdateringer tilgjengelig', en: 'Firmware updates available' },
  device: { no: 'Enhet', en: 'Device' },
  unknown: { no: 'Ukjent', en: 'Unknown' },
  newVersion: { no: 'ny', en: 'new' },
  download: { no: 'Last ned', en: 'Download' },
  important: { no: 'Viktig', en: 'Important' },
  update: { no: 'Oppdatering', en: 'Update' },
  emptyTitle: { no: 'Ingen utstyr registrert', en: 'No equipment registered' },
  add: { no: 'Legg til', en: 'Add' },
  emptyMusicItems: { no: 'mikrofoner, lydkort, monitorer …', en: 'microphones, audio interfaces, monitors …' },
  emptyVisualItems: { no: 'kameraer, objektiver, lys …', en: 'cameras, lenses, lights …' },
  emptyRest: { no: '— så henter vi markedsverdien automatisk.', en: '— and we will fetch the market value automatically.' },
  reklamasjon: { no: 'Reklamasjon', en: 'Consumer warranty' },
  garanti: { no: 'Garanti', en: 'Warranty' },
  receipt: { no: '📄 Kvittering', en: '📄 Receipt' },
  category: { no: 'Kategori', en: 'Category' },
  vendor: { no: 'Leverandør', en: 'Vendor' },
  brand: { no: 'Merke', en: 'Brand' },
  nameVersion: { no: 'Navn / versjon', en: 'Name / version' },
  model: { no: 'Modell', en: 'Model' },
  marketValue: { no: 'Markedsverdi', en: 'Market value' },
  fetching: { no: 'Henter…', en: 'Fetching…' },
  getValue: { no: 'Hent verdi', en: 'Get value' },
  fromCatalog: { no: 'Fra katalog', en: 'From catalog' },
  aiEstimate: { no: 'AI-estimat', en: 'AI estimate' },
  confidence: { no: 'sikkerhet', en: 'confidence' },
  used: { no: 'brukt', en: 'used' },
  noValue: { no: 'Fant ingen verdi. Fyll inn merke + modell og prøv igjen.', en: 'No value found. Enter brand + model and try again.' },
  license: { no: 'Lisens', en: 'License' },
  perpetual: { no: 'Eierlisens', en: 'Perpetual license' },
  subscription: { no: 'Abonnement', en: 'Subscription' },
  billing: { no: 'Fakturering', en: 'Billing' },
  monthly: { no: 'Månedlig', en: 'Monthly' },
  yearly: { no: 'Årlig', en: 'Yearly' },
  costKr: { no: 'Kostnad (kr)', en: 'Cost (kr)' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  saving: { no: 'Lagrer…', en: 'Saving…' },
};
// Engelske visningsnavn for kategori-verdiene (verdiene lagres uendret).
const CAT_EN: Record<string, string> = {
  'Mikrofon': 'Microphone', 'Lydkort / interface': 'Audio interface', 'Studiomonitor': 'Studio monitor', 'Hodetelefoner': 'Headphones', 'MIDI / keyboard': 'MIDI / keyboard', 'Preamp / kompressor': 'Preamp / compressor', 'Instrument': 'Instrument', 'DAW (programvare)': 'DAW (software)', 'Plugin': 'Plugin', 'Virtuelt instrument': 'Virtual instrument', 'Samplepakke / lydbibliotek': 'Sample pack / sound library', 'Kabler / tilbehør': 'Cables / accessories', 'Annet': 'Other',
  'Kamera': 'Camera', 'Objektiv': 'Lens', 'Blits / lys': 'Flash / lighting', 'Stativ / rigg': 'Tripod / rig', 'Lyd': 'Audio', 'Drone': 'Drone', 'Minnekort / lagring': 'Memory card / storage', 'Redigeringsprogramvare': 'Editing software', 'Plugin / preset': 'Plugin / preset', 'LUT / fargepakke': 'LUT / color pack', 'Skylagring / tjeneste': 'Cloud storage / service', 'Tilbehør': 'Accessories',
};

const isMusic = (p?: string) => ['music_producer', 'music-producer', 'musician', 'music'].includes(String(p || '').toLowerCase());
const fmtKr = (n?: number) => (n && n > 0 ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '—');
const CATS_MUSIC = ['Mikrofon', 'Lydkort / interface', 'Studiomonitor', 'Hodetelefoner', 'MIDI / keyboard', 'Preamp / kompressor', 'Instrument', 'DAW (programvare)', 'Plugin', 'Virtuelt instrument', 'Samplepakke / lydbibliotek', 'Kabler / tilbehør', 'Annet'];
const CATS_VISUAL = ['Kamera', 'Objektiv', 'Blits / lys', 'Stativ / rigg', 'Lyd', 'Drone', 'Minnekort / lagring', 'Redigeringsprogramvare', 'Plugin / preset', 'LUT / fargepakke', 'Skylagring / tjeneste', 'Tilbehør', 'Annet'];
const SOFTWARE_CATS = new Set(['DAW (programvare)', 'Plugin', 'Virtuelt instrument', 'Samplepakke / lydbibliotek', 'Redigeringsprogramvare', 'Plugin / preset', 'LUT / fargepakke', 'Skylagring / tjeneste']);
const ti = { '& .MuiOutlinedInput-root': { fontSize: 13.5, color: ws.text, bgcolor: ws.panel, '& fieldset': { borderColor: ws.borderSoft }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ws.accent } }, '& input::placeholder': { color: ws.textFaint, opacity: 1 }, '& .MuiInputLabel-root': { color: ws.textDim } };

const specOf = (it: any) => it?.specifications || it?.settings?.specifications || {};
const gearValue = (it: any) => specOf(it).marketValueNok || it?.currentValue || it?.current_value || 0;
const monthlyOf = (it: any) => { const s = specOf(it); if (s.licenseType !== 'subscription' || !s.subscriptionCost) return 0; return s.billingCycle === 'yearly' ? Number(s.subscriptionCost) / 12 : Number(s.subscriptionCost); };
const daysUntil = (iso?: string) => { if (!iso) return null; try { return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000); } catch { return null; } };
// Garanti/reklamasjon/kvittering ligger under specifications (det inventar-API-et
// eksponerer). Reklamasjonsrett: eksplisitt dato, ellers kjøpsdato + 5 år.
const reklamOf = (it: any) => {
  const s = specOf(it); if (s.reklamasjonExpiry) return s.reklamasjonExpiry;
  const pd = s.purchaseDate || it?.purchase_date || it?.purchaseDate; if (!pd) return null;
  try { const d = new Date(pd); if (isNaN(d.getTime())) return null; d.setFullYear(d.getFullYear() + 5); return d.toISOString().slice(0, 10); } catch { return null; }
};
const warrantyOf = (it: any) => specOf(it).warrantyExpiry || it?.warranty_expiry || it?.warrantyExpiry || null;
const receiptOf = (it: any) => specOf(it).receiptEmailId || null;
// Kort «N år / N mnd igjen» fra dager-til-utløp.
const leftLabel = (iso?: string, locale: 'no' | 'en' = 'no') => {
  const d = daysUntil(iso); if (d == null) return null; if (d < 0) return locale === 'en' ? 'expired' : 'utløpt';
  if (d >= 365) return locale === 'en' ? `${Math.floor(d / 365)} yr left` : `${Math.floor(d / 365)} år igjen`;
  if (d >= 60) return locale === 'en' ? `${Math.round(d / 30)} mo left` : `${Math.round(d / 30)} mnd igjen`;
  return locale === 'en' ? `${d} d left` : `${d} d igjen`;
};

const UtstyrTab: React.FC<{ projectId: string; profession?: string; userId?: string }> = ({ profession, userId }) => {
  const music = isMusic(profession);
  const cats = music ? CATS_MUSIC : CATS_VISUAL;
  const [items, setItems] = useState<any[]>([]);
  const [firmware, setFirmware] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', brand: '', model: '', category: cats[0], condition: 'excellent', licenseType: 'perpetual', billingCycle: 'monthly', subCost: '', renewalDate: '' });
  const [val, setVal] = useState<any | null>(null);   // markedsverdi-resultat
  const [valBusy, setValBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  // Utenlandske partner-vendors får engelsk UI (WsLocaleProvider i TeamWorkspacePage).
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const dl = wsDateLocale(locale);
  const catLabel = (c?: string) => (locale === 'en' ? (CAT_EN[c] || c) : c);

  const load = () => {
    if (!userId) { setLoading(false); return; }
    apiRequest(`/api/equipment/inventory?userId=${encodeURIComponent(userId)}`)
      .then((r: any) => setItems(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    apiRequest(`/api/equipment/firmware-updates/${encodeURIComponent(userId)}`)
      .then((r: any) => {
        const arr = Array.isArray(r) ? r : (r?.updates || r?.data || []);
        // Firmware gjelder hardware — filtrer bort programvare/plugins (får generisk 1.0.0).
        setFirmware(arr.filter((f: any) => !SOFTWARE_CATS.has(f.deviceType || f.category)));
      })
      .catch(() => setFirmware([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const fetchValue = async () => {
    const q = [form.brand, form.model].filter(Boolean).join(' ').trim() || form.name;
    if (!q) return;
    setValBusy(true); setVal(null);
    try {
      // 1) katalog-søk (foto/video-tungt) — bruk pris hvis treff
      const c: any = await apiRequest(`/api/equipment/search?q=${encodeURIComponent(q)}&limit=1`).catch(() => null);
      const hit = c?.data?.[0];
      if (hit?.priceNOK) { setVal({ nok: hit.priceNOK, source: 'katalog', note: `${hit.brand || ''} ${hit.model || ''}`.trim(), supplier: hit.norwegianSupplier }); return; }
      // 2) AI-estimat (musikk/studio-gear som mangler i katalogen)
      const a: any = await apiRequest(`/api/equipment/estimate-value`, { method: 'POST', body: { name: form.name, brand: form.brand, model: form.model, category: form.category } });
      if (a?.estimatedNok) setVal({ nok: a.estimatedNok, newNok: a.newNok, usedNok: a.usedNok, source: 'ai', note: a.note, confidence: a.confidence });
      else setVal({ nok: null, source: 'none' });
    } catch { setVal({ nok: null, source: 'none' }); }
    finally { setValBusy(false); }
  };

  const save = async () => {
    if (!form.brand.trim() || !form.model.trim() || !userId) { wsAlert(t('brandModelRequired')); return; }
    setSaving(true);
    try {
      await apiRequest(`/api/equipment/inventory`, {
        method: 'POST',
        body: {
          userId, profession: profession || null,
          name: form.name || `${form.brand} ${form.model}`, brand: form.brand, model: form.model,
          category: form.category, condition: form.condition,
          specifications: {
            marketValueNok: val?.nok || null, valueSource: val?.source || null, valueNote: val?.note || null,
            licenseType: form.licenseType,
            ...(form.licenseType === 'subscription' ? { billingCycle: form.billingCycle, subscriptionCost: Number(form.subCost) || null, renewalDate: form.renewalDate || null } : {}),
          },
        },
      });
      setOpen(false); setForm({ name: '', brand: '', model: '', category: cats[0], condition: 'excellent', licenseType: 'perpetual', billingCycle: 'monthly', subCost: '', renewalDate: '' }); setVal(null);
      load();
    } catch (e: any) { wsAlert(e?.message || t('couldNotSave')); }
    finally { setSaving(false); }
  };

  const totalValue = items.reduce((s, it) => s + (gearValue(it) || 0), 0);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{music ? t('titleMusic') : t('title')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subRegister')} {music ? t('subItemsMusic') : t('subItems')}{t('subRest')}{totalValue ? ` ${t('totalValue')} ${fmtKr(totalValue)}.` : ''}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpen(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('addEquipment')}</Button>
      </Stack>

      {/* Programvare & abonnement — Gmail-kvittering-skann + manuell + kostnadsoversikt */}
      <SoftwareKostnaderPanel userId={userId} onEquipmentChange={load} />

      {/* Utstyrs-lisenser — abonnement knyttet til registrert utstyr */}
      {(() => {
        const subs = items.filter((it) => specOf(it).licenseType === 'subscription');
        if (subs.length === 0) return null;
        const monthly = items.reduce((s, it) => s + monthlyOf(it), 0);
        const upcoming = subs.map((it) => ({ it, d: daysUntil(specOf(it).renewalDate) })).filter((x) => x.d != null && x.d <= 30).sort((a, b) => (a.d as number) - (b.d as number));
        return (
          <WsCard sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              {wsIcon('CreditCard', { fontSize: 16, color: ws.textDim })}
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{t('equipLicenses')}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('recurring')} <b style={{ color: ws.accent }}>{fmtKr(monthly)}/{t('perMonth')}</b> ≈ {fmtKr(monthly * 12)}/{t('perYear')}</Typography>
            </Stack>
            <Stack spacing={0.5}>
              {subs.map((it) => {
                const s = specOf(it); const d = daysUntil(s.renewalDate);
                return (
                  <Stack key={it.id} direction="row" alignItems="center" spacing={1} sx={{ p: 0.85, borderRadius: 1, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                    <Typography sx={{ fontSize: 12.5, fontWeight: 700, flex: 1 }} noWrap>{it.name || `${it.brand} ${it.model}`}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{fmtKr(Number(s.subscriptionCost))}/{s.billingCycle === 'yearly' ? t('perYear') : t('perMonth')}</Typography>
                    {s.renewalDate && <WsTag label={d != null && d <= 7 ? `${t('renewsIn')} ${d} d` : `${t('renews')} ${new Date(s.renewalDate).toLocaleDateString(dl, { day: '2-digit', month: 'short' })}`} tone={d != null && d <= 7 ? 'red' : 'neutral'} />}
                  </Stack>
                );
              })}
            </Stack>
            {upcoming.length > 0 && <Typography sx={{ fontSize: 11.5, color: ws.amber, mt: 1, display: 'inline-flex', alignItems: 'center', gap: 0.4 }}>{wsIcon('WarningAmber', { fontSize: 13 })}{upcoming.length} {upcoming.length === 1 ? t('renewal') : t('renewals')} {t('within30')}</Typography>}
          </WsCard>
        );
      })()}

      {/* Firmware / vedlikehold */}
      {firmware.length > 0 && (
        <WsCard sx={{ mb: 2, borderColor: ws.accentBorder }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <SystemUpdateAlt sx={{ fontSize: 18, color: ws.accent }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{t('firmwareAvail')}</Typography>
            <WsTag label={`${firmware.length}`} tone="amber" />
          </Stack>
          <Stack spacing={0.75}>
            {firmware.slice(0, 8).map((f: any, i: number) => {
              const dev = [f.deviceBrand, f.deviceModel].filter(Boolean).join(' ') || f.deviceName || f.name || f.model || t('device');
              return (
                <Stack key={f.id || i} direction="row" alignItems="center" spacing={1.25} sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{dev}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{f.currentVersion || t('unknown')} → <b style={{ color: ws.accent }}>{f.latestVersion || t('newVersion')}</b>{f.description ? ` · ${f.description}` : ''}</Typography>
                  </Box>
                  {f.downloadUrl && <Button size="small" href={f.downloadUrl} target="_blank" rel="noopener" sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>{t('download')}</Button>}
                  <WsTag label={f.priority === 'high' ? t('important') : t('update')} tone={f.priority === 'high' ? 'red' : 'amber'} />
                </Stack>
              );
            })}
          </Stack>
        </WsCard>
      )}

      {/* Inventar */}
      {items.length === 0 ? (
        <WsCard>
          <Stack alignItems="center" sx={{ py: 5 }} spacing={1}>
            <Inventory2 sx={{ fontSize: 36, color: ws.textFaint }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{t('emptyTitle')}</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 440 }}>{t('add')} {music ? t('emptyMusicItems') : t('emptyVisualItems')} {t('emptyRest')}</Typography>
          </Stack>
        </WsCard>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          {items.map((it: any) => (
            <WsCard key={it.id}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ width: 52, height: 52, borderRadius: 1.5, bgcolor: ws.panelAlt, flexShrink: 0, backgroundImage: it.imageUrl ? `url(${it.imageUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {!it.imageUrl && <Inventory2 sx={{ color: ws.textFaint, fontSize: 22 }} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>{it.name || `${it.brand} ${it.model}`}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{[it.brand, catLabel(it.category)].filter(Boolean).join(' · ')}</Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {gearValue(it) > 0 && <WsTag label={`≈ ${fmtKr(gearValue(it))}`} tone="green" />}
                    {it.condition && <WsTag label={it.condition} tone="neutral" />}
                    {(() => { const rk = reklamOf(it); const l = leftLabel(rk, locale); return rk ? <WsTag label={`${t('reklamasjon')}: ${l}`} tone={l === 'utløpt' || l === 'expired' ? 'neutral' : 'amber'} /> : null; })()}
                    {(() => { const w = warrantyOf(it); const l = leftLabel(w, locale); return w ? <WsTag label={`${t('garanti')}: ${l}`} tone={l === 'utløpt' || l === 'expired' ? 'neutral' : 'green'} /> : null; })()}
                    {receiptOf(it) && <WsTag label={t('receipt')} tone="neutral" />}
                  </Stack>
                </Box>
              </Stack>
            </WsCard>
          ))}
        </Box>
      )}

      {/* Legg til utstyr + markedsverdi */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: ws.panelSolid, backgroundImage: 'none', border: `1px solid ${ws.border}`, borderRadius: `${ws.radius}px` } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pt: 2, pb: 0.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>{t('addEquipment')}</Typography>
          <IconButton onClick={() => setOpen(false)} sx={{ color: ws.textDim }}><Close /></IconButton>
        </Stack>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField size="small" select label={t('category')} value={form.category} onChange={(e) => { setForm({ ...form, category: e.target.value }); setVal(null); }} fullWidth sx={ti}>
              {cats.map((c) => <MenuItem key={c} value={c}>{catLabel(c)}</MenuItem>)}
            </TextField>
            {(() => { const sw = SOFTWARE_CATS.has(form.category); return (
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" label={sw ? t('vendor') : t('brand')} placeholder={sw ? (music ? 'FabFilter' : 'Adobe') : (music ? 'Neumann' : 'Canon')} value={form.brand} onChange={(e) => { setForm({ ...form, brand: e.target.value }); setVal(null); }} fullWidth sx={ti} />
              <TextField size="small" label={sw ? t('nameVersion') : t('model')} placeholder={sw ? (music ? 'Pro-Q 3' : 'Lightroom') : (music ? 'U 87 Ai' : 'R5')} value={form.model} onChange={(e) => { setForm({ ...form, model: e.target.value }); setVal(null); }} fullWidth sx={ti} />
            </Stack>
            ); })()}

            {/* Markedsverdi */}
            <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PriceCheck sx={{ color: ws.accent, fontSize: 19 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('marketValue')}</Typography>
                </Stack>
                <Button size="small" disabled={valBusy || (!form.brand && !form.model)} onClick={fetchValue} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>{valBusy ? t('fetching') : t('getValue')}</Button>
              </Stack>
              {val && (val.nok ? (
                <Box sx={{ mt: 0.75 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: ws.accent }}>≈ {fmtKr(val.nok)}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>
                    {val.source === 'katalog' ? `${t('fromCatalog')}${val.supplier ? ` (${val.supplier})` : ''}` : `${t('aiEstimate')}${val.confidence ? ` · ${val.confidence} ${t('confidence')}` : ''}`}
                    {val.newNok && val.usedNok ? ` · ${t('newVersion')} ${fmtKr(val.newNok)} / ${t('used')} ${fmtKr(val.usedNok)}` : ''}{val.note ? ` · ${val.note}` : ''}
                  </Typography>
                </Box>
              ) : <Typography sx={{ fontSize: 12, color: ws.textDim, mt: 0.75 }}>{t('noValue')}</Typography>)}
            </Box>

            {/* Lisens / abonnement (kun programvare/plugins) */}
            {SOFTWARE_CATS.has(form.category) && (
              <Box>
                <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 0.5 }}>{t('license')}</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: form.licenseType === 'subscription' ? 1.25 : 0 }}>
                  {[['perpetual', t('perpetual')], ['subscription', t('subscription')]].map(([v, l]) => (
                    <button key={v} onClick={() => setForm({ ...form, licenseType: v })}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, border: `1px solid ${form.licenseType === v ? ws.accentBorder : ws.border}`, background: form.licenseType === v ? ws.accentSoft : 'transparent', color: form.licenseType === v ? ws.accent : ws.textDim }}>{l}</button>
                  ))}
                </Stack>
                {form.licenseType === 'subscription' && (
                  <Stack direction="row" spacing={1.5}>
                    <TextField size="small" select label={t('billing')} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} sx={{ ...ti, width: 130 }}>
                      <MenuItem value="monthly">{t('monthly')}</MenuItem>
                      <MenuItem value="yearly">{t('yearly')}</MenuItem>
                    </TextField>
                    <TextField size="small" type="number" label={t('costKr')} value={form.subCost} onChange={(e) => setForm({ ...form, subCost: e.target.value })} fullWidth sx={ti} />
                    <TextField size="small" type="date" label={t('renews')} InputLabelProps={{ shrink: true }} value={form.renewalDate} onChange={(e) => setForm({ ...form, renewalDate: e.target.value })} sx={{ ...ti, width: 150 }} />
                  </Stack>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('cancel')}</Button>
          <Button onClick={save} disabled={saving || !form.brand.trim() || !form.model.trim()} variant="contained" sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{saving ? t('saving') : t('add')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtstyrTab;
