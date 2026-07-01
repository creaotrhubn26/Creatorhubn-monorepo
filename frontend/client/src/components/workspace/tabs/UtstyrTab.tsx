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
import { WsCard, WsTag } from '../ui';

const isMusic = (p?: string) => ['music_producer', 'music-producer', 'musician', 'music'].includes(String(p || '').toLowerCase());
const fmtKr = (n?: number) => (n && n > 0 ? `${Math.round(n).toLocaleString('nb-NO')} kr` : '—');
const CATS_MUSIC = ['Mikrofon', 'Lydkort / interface', 'Studiomonitor', 'Hodetelefoner', 'MIDI / keyboard', 'Preamp / kompressor', 'Instrument', 'Kabler / tilbehør', 'Annet'];
const CATS_VISUAL = ['Kamera', 'Objektiv', 'Blits / lys', 'Stativ / rigg', 'Lyd', 'Drone', 'Minnekort / lagring', 'Tilbehør', 'Annet'];
const ti = { '& .MuiOutlinedInput-root': { fontSize: 13.5, color: ws.text, bgcolor: ws.panel, '& fieldset': { borderColor: ws.borderSoft }, '&:hover fieldset': { borderColor: ws.accentBorder }, '&.Mui-focused fieldset': { borderColor: ws.accent } }, '& input::placeholder': { color: ws.textFaint, opacity: 1 }, '& .MuiInputLabel-root': { color: ws.textDim } };

const gearValue = (it: any) => it?.specifications?.marketValueNok || it?.settings?.specifications?.marketValueNok || it?.currentValue || it?.current_value || 0;

const UtstyrTab: React.FC<{ projectId: string; profession?: string; userId?: string }> = ({ profession, userId }) => {
  const music = isMusic(profession);
  const cats = music ? CATS_MUSIC : CATS_VISUAL;
  const [items, setItems] = useState<any[]>([]);
  const [firmware, setFirmware] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ name: '', brand: '', model: '', category: cats[0], condition: 'excellent' });
  const [val, setVal] = useState<any | null>(null);   // markedsverdi-resultat
  const [valBusy, setValBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!userId) { setLoading(false); return; }
    apiRequest(`/api/equipment/inventory?userId=${encodeURIComponent(userId)}`)
      .then((r: any) => setItems(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    apiRequest(`/api/equipment/firmware-updates/${encodeURIComponent(userId)}`)
      .then((r: any) => setFirmware(Array.isArray(r) ? r : (r?.updates || r?.data || [])))
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
    if (!form.brand.trim() || !form.model.trim() || !userId) { window.alert('Merke og modell er påkrevd.'); return; }
    setSaving(true);
    try {
      await apiRequest(`/api/equipment/inventory`, {
        method: 'POST',
        body: {
          userId, profession: profession || null,
          name: form.name || `${form.brand} ${form.model}`, brand: form.brand, model: form.model,
          category: form.category, condition: form.condition,
          specifications: { marketValueNok: val?.nok || null, valueSource: val?.source || null, valueNote: val?.note || null },
        },
      });
      setOpen(false); setForm({ name: '', brand: '', model: '', category: cats[0], condition: 'excellent' }); setVal(null);
      load();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); }
    finally { setSaving(false); }
  };

  const totalValue = items.reduce((s, it) => s + (gearValue(it) || 0), 0);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress sx={{ color: ws.accent }} /></Box>;

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{music ? 'Studio-utstyr' : 'Utstyr'}</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Registrer utstyret ditt, få markedsverdi automatisk, og hold styr på vedlikehold & firmware.{totalValue ? ` Samlet verdi: ${fmtKr(totalValue)}.` : ''}</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setOpen(true)} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Legg til utstyr</Button>
      </Stack>

      {/* Firmware / vedlikehold */}
      {firmware.length > 0 && (
        <WsCard sx={{ mb: 2, borderColor: ws.accentBorder }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
            <SystemUpdateAlt sx={{ fontSize: 18, color: ws.accent }} />
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Firmware-oppdateringer tilgjengelig</Typography>
            <WsTag label={`${firmware.length}`} tone="amber" />
          </Stack>
          <Stack spacing={0.75}>
            {firmware.slice(0, 8).map((f: any, i: number) => {
              const dev = [f.deviceBrand, f.deviceModel].filter(Boolean).join(' ') || f.deviceName || f.name || f.model || 'Enhet';
              return (
                <Stack key={f.id || i} direction="row" alignItems="center" spacing={1.25} sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }} noWrap>{dev}</Typography>
                    <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{f.currentVersion || 'Ukjent'} → <b style={{ color: ws.accent }}>{f.latestVersion || 'ny'}</b>{f.description ? ` · ${f.description}` : ''}</Typography>
                  </Box>
                  {f.downloadUrl && <Button size="small" href={f.downloadUrl} target="_blank" rel="noopener" sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700, flexShrink: 0 }}>Last ned</Button>}
                  <WsTag label={f.priority === 'high' ? 'Viktig' : 'Oppdatering'} tone={f.priority === 'high' ? 'red' : 'amber'} />
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
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Ingen utstyr registrert</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim, textAlign: 'center', maxWidth: 440 }}>Legg til {music ? 'mikrofoner, lydkort, monitorer …' : 'kameraer, objektiver, lys …'} — så henter vi markedsverdien automatisk.</Typography>
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
                  <Typography sx={{ fontSize: 11.5, color: ws.textFaint }} noWrap>{[it.brand, it.category].filter(Boolean).join(' · ')}</Typography>
                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                    {gearValue(it) > 0 && <WsTag label={`≈ ${fmtKr(gearValue(it))}`} tone="green" />}
                    {it.condition && <WsTag label={it.condition} tone="neutral" />}
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
          <Typography sx={{ fontSize: 16, fontWeight: 800 }}>Legg til utstyr</Typography>
          <IconButton onClick={() => setOpen(false)} sx={{ color: ws.textDim }}><Close /></IconButton>
        </Stack>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1.5}>
              <TextField size="small" label="Merke" placeholder={music ? 'Neumann' : 'Canon'} value={form.brand} onChange={(e) => { setForm({ ...form, brand: e.target.value }); setVal(null); }} fullWidth sx={ti} />
              <TextField size="small" label="Modell" placeholder={music ? 'U 87 Ai' : 'R5'} value={form.model} onChange={(e) => { setForm({ ...form, model: e.target.value }); setVal(null); }} fullWidth sx={ti} />
            </Stack>
            <TextField size="small" select label="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} fullWidth sx={ti}>
              {cats.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>

            {/* Markedsverdi */}
            <Box sx={{ p: 1.5, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PriceCheck sx={{ color: ws.accent, fontSize: 19 }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Markedsverdi</Typography>
                </Stack>
                <Button size="small" disabled={valBusy || (!form.brand && !form.model)} onClick={fetchValue} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 700 }}>{valBusy ? 'Henter…' : 'Hent verdi'}</Button>
              </Stack>
              {val && (val.nok ? (
                <Box sx={{ mt: 0.75 }}>
                  <Typography sx={{ fontSize: 20, fontWeight: 800, color: ws.accent }}>≈ {fmtKr(val.nok)}</Typography>
                  <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>
                    {val.source === 'katalog' ? `Fra katalog${val.supplier ? ` (${val.supplier})` : ''}` : `AI-estimat${val.confidence ? ` · ${val.confidence} sikkerhet` : ''}`}
                    {val.newNok && val.usedNok ? ` · ny ${fmtKr(val.newNok)} / brukt ${fmtKr(val.usedNok)}` : ''}{val.note ? ` · ${val.note}` : ''}
                  </Typography>
                </Box>
              ) : <Typography sx={{ fontSize: 12, color: ws.textDim, mt: 0.75 }}>Fant ingen verdi. Fyll inn merke + modell og prøv igjen.</Typography>)}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: ws.textDim, textTransform: 'none' }}>Avbryt</Button>
          <Button onClick={save} disabled={saving || !form.brand.trim() || !form.model.trim()} variant="contained" sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{saving ? 'Lagrer…' : 'Legg til'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UtstyrTab;
