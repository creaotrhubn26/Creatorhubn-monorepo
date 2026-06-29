// @ts-nocheck
/**
 * MoodboardTab — design #5, dark CreatorHub.
 * Stats + kategori-pills + opplastbart moodboard-rutenett + Mood details (høyre)
 * + Fargepalett / Stilnotater / Må fanges / Referanser delt med teamet.
 * Alle bilde-flater bruker WsImageGrid (legg til / last opp).
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, TextField, Avatar, IconButton, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import Close from '@mui/icons-material/Close';
import Add from '@mui/icons-material/Add';
import AutoAwesome from '@mui/icons-material/AutoAwesome';
import { apiRequest } from '@/lib/queryClient';
import Image from '@mui/icons-material/Image';
import Star from '@mui/icons-material/Star';
import Palette from '@mui/icons-material/Palette';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Search from '@mui/icons-material/Search';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsImageGrid, WsModal } from '../ui';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { useProjectImages } from '../useProjectImages';

const CATS = [{ key: 'alle', label: 'Alle 86' }, { key: 'forb', label: 'Forberedelser 12' }, { key: 'vielse', label: 'Vielse 14' }, { key: 'portrett', label: 'Portretter 16' }, { key: 'golden', label: 'Golden hour 10' }, { key: 'detaljer', label: 'Detaljer 12' }, { key: 'fest', label: 'Fest 14' }];
const PALETTE = [['Elfenben', '#F6F2EB'], ['Champagne', '#EAD9C1'], ['Salvie', '#A6B49A'], ['Sand', '#DCC9B1'], ['Mørk grønn', '#2E4A3B'], ['Gull', '#D4A017']];
const STYLE_NOTES = ['Mykt naturlig lys', 'Varme hudtoner', 'Romantisk og tidløst', 'Dokumentarisk + editorial miks', 'Fokus på følelser og nærhet'];
const CAPTURE = [['Ringer og detaljer', true], ['First look reaksjon', true], ['Slør i motlys', true], ['Reaksjoner under vielsen', true], ['Borddetaljer og dekk', false]];

const MoodboardTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [cat, setCat] = useState('alle');
  const mood = useProjectImages(projectId, 'moodboard');
  const shared = useProjectImages(projectId, 'moodboard-shared');
  const isReal = projectId && projectId !== 'sample';
  const [meta, setMeta] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [search, setSearch] = useState('');
  const [genNotes, setGenNotes] = useState(false);
  // AI konsept-generering (tekst→bilde) + kreditt
  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [conceptBusy, setConceptBusy] = useState(false);
  const [conceptStatus, setConceptStatus] = useState('');
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (id: string) => { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId: id } }); if (r?.url) window.location.href = r.url; } catch (e: any) { window.alert(e?.message || 'Feil'); } };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`).then((r: any) => setAiCfg(r || null)).catch(() => {});
    loadCredits();
    try { const p = new URLSearchParams(window.location.search); if (p.get('ai_credits') === 'ok' && p.get('cs')) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } }).then(() => { loadCredits(); window.alert('Kreditter lagt til ✓'); }).catch(() => {}).finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); }); } } catch { /* */ }
    // eslint-disable-next-line
  }, [projectId]);
  const generateConcept = async () => {
    if (!conceptPrompt.trim() || conceptBusy) return;
    setConceptBusy(true); setConceptStatus('Genererer…');
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/concept-image`, { method: 'POST', body: { prompt: conceptPrompt.trim() } });
      if (!r?.jobId) throw new Error('Kunne ikke starte');
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        if (s.status === 'completed') { setConceptStatus('✓ Lagt i moodboardet'); mood.reload && mood.reload(); loadCredits(); break; }
        if (s.status === 'failed') { setConceptStatus('Feilet'); break; }
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('kreditt') || msg.includes('insufficient')) { setConceptOpen(false); setBuyOpen(true); }
      else window.alert(e?.message || 'Konsept-generering feilet');
      setConceptStatus('');
    } finally { setConceptBusy(false); }
  };
  const loadMeta = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {}); };
  const generateNotes = async () => {
    if (!isReal || genNotes) return;
    setGenNotes(true);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/generate-notes`, { method: 'POST', body: {} }); setMeta((m: any) => ({ ...(m || {}), style: r.styleDirection, notes: r.notes, mustCapture: r.mustCapture })); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke generere notater — last opp referansebilder først.'); }
    finally { setGenNotes(false); }
  };
  const extractPalette = async () => {
    if (!isReal || extracting) return;
    setExtracting(true);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/extract-palette`, { method: 'POST', body: {} }); setMeta((m: any) => ({ ...(m || {}), palette: r.palette })); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke trekke ut farger — last opp referansebilder først.'); }
    finally { setExtracting(false); }
  };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {});
  }, [projectId, isReal]);
  // Ekte prosjekt → ekte meta (tomt = tom-tilstand). Mock kun på /workspace/sample.
  const pal = isReal ? (meta?.palette || []).map((p: any) => [p.name || p[0] || '', p.hex || p[1] || p]) : PALETTE;
  const notes = isReal ? (meta?.notes || []) : STYLE_NOTES;
  const capture = isReal ? (meta?.mustCapture || []).map((c: any) => [c.label || c[0] || c, c.done ?? c[1] ?? false]) : CAPTURE;
  const refCount = isReal ? mood.images.length : 86;
  const styleDir = isReal ? (meta?.style || '—') : 'Romantisk / Editorial';
  // Kategori-tellere + filtrering + søk (ekte data).
  const catCount = (mood.images || []).reduce((m: any, im: any) => { if (im.category) m[im.category] = (m[im.category] || 0) + 1; return m; }, {});
  const realCats = isReal
    ? [{ key: 'alle', label: `Alle ${mood.images.length}` }, ...CATS.filter((c) => c.key !== 'alle').map((c) => ({ key: c.key, label: `${c.label.replace(/\s*\d+$/, '')} ${catCount[c.key] || 0}` }))]
    : CATS;
  const q = search.trim().toLowerCase();
  const gridImages = isReal
    ? mood.images.filter((im: any) => (cat === 'alle' || im.category === cat) && (!q || (im.label || '').toLowerCase().includes(q)))
    : mood.images;
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Moodboard</Typography>
          <Stack direction="row" spacing={1}>
            {isReal && aiCfg?.enabled && aiCfg?.whitelisted && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={() => { setConceptPrompt(''); setConceptStatus(''); setConceptOpen(true); }} sx={{ color: ws.accentContrast, bgcolor: ws.accent, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Generer konsept</Button>}
            {isReal && <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => setEditOpen(true)} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>Rediger</Button>}
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<Image sx={{ fontSize: 20 }} />} label="Antall referanser" value={refCount} sub={isReal ? 'i moodboardet' : '+12 denne uken'} />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Stil retning" value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>{styleDir}</Typography>} sub="Mykt, varmt, tidløst" />
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Palette sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>Fargepalett</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{pal.map(([n, c]) => <Box key={n} sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} />)}</Stack>
            <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.75 }}>{pal.length} farger{(!meta?.palette || !meta.palette.length) && isReal ? ' · eksempel' : ''}</Typography>
          </WsCard>
          <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Godkjent av kunde" value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>Delvis</Typography>} sub="Sist oppdatert 23. mai" />
        </Box>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <WsPills items={realCats} value={cat} onChange={setCat} />
          </Stack>
          <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Søk i moodboardet…" InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: ws.textFaint, mr: 1 }} /> }} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          {isReal && cat !== 'alle' && <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 1 }}>Nye opplastinger her merkes «{cat}».</Typography>}
          <WsImageGrid columns={4} addLabel="Last opp bilde" images={gridImages} onUpload={(f: any) => mood.onUpload(f, cat === 'alle' ? undefined : cat)} />
        </WsCard>

        {/* Fargepalett + Stilnotater + Må fanges */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Fargepalett</Typography>
              {isReal && <Button size="small" startIcon={<Palette sx={{ fontSize: 15 }} />} onClick={extractPalette} disabled={extracting} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{extracting ? 'Trekker ut…' : 'Auto fra referanser'}</Button>}
            </Stack>
            <Stack spacing={0.75}>{pal.map(([n, c]) => <Stack key={`${n}${c}`} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography></Stack>)}</Stack>
            {(!meta?.palette || !meta.palette.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>Eksempel-palett — trykk «Auto fra referanser» for å trekke ut ekte farger.</Typography>}
          </WsCard>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Stilnotater</Typography>
              {isReal && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={generateNotes} disabled={genNotes} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{genNotes ? 'Analyserer…' : 'AI fra referanser'}</Button>}
            </Stack>
            <Stack spacing={0.75}>{notes.map((s) => <Typography key={s} sx={{ fontSize: 12.5, color: ws.textDim }}>· {s}</Typography>)}</Stack>
            {(!meta?.notes || !meta.notes.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>Eksempel — trykk «AI fra referanser» for å generere fra bildene.</Typography>}
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Må fanges</Typography>
            <Stack spacing={0.75}>{capture.map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5, color: ws.text }}>{t}</Typography></Stack>)}</Stack>
          </WsCard>
        </Box>

        <WsCard>
          <WsSectionTitle title="Referanser delt med teamet" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
          <WsImageGrid columns={7} addLabel="Del bilde" images={shared.images} onUpload={shared.onUpload} />
        </WsCard>
      </Box>

      {/* Mood details (høyre) */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard>
          <WsSectionTitle title="Mood details" />
          <WsImageGrid columns={1} ratio="4 / 3" addLabel="Last opp hovedbilde" allowAdd />
          <Stack direction="row" spacing={0.5} sx={{ my: 1.25, flexWrap: 'wrap', gap: 0.5 }}>
            <WsTag label="Golden hour" tone="amber" /><WsTag label="Portretter" tone="accent" /><WsTag label="Kritisk stil" tone="red" />
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.5 }}>Ønsker varme toner, mykt motlys og rolig, emosjonell komposisjon. Fokus på naturlige bevegelser og nærhet.</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>NOTATER</Typography>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            {['Bruk lengre brennvidde (85mm+)', 'Mykt motlys – unngå hardt sollys', 'Naturlige interaksjoner', 'Ton ned farger i etterarbeid'].map((n) => <Typography key={n} sx={{ fontSize: 12, color: ws.textDim }}>· {n}</Typography>)}
          </Stack>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>ANSVARLIGE</Typography>
          <Stack direction="row" spacing={1}>
            {['Daniel (Foto)', 'Emma (Video)'].map((p) => <Stack key={p} direction="row" spacing={0.5} alignItems="center"><Avatar sx={{ width: 20, height: 20, fontSize: 9 }}>{p[0]}</Avatar><Typography sx={{ fontSize: 11.5 }}>{p}</Typography><CheckCircle sx={{ fontSize: 13, color: ws.green }} /></Stack>)}
          </Stack>
        </WsCard>
      </Box>

      <MetaEditDialog open={editOpen} onClose={() => setEditOpen(false)} projectId={projectId} meta={meta} onSaved={() => { setEditOpen(false); loadMeta(); }} />

      {/* AI konsept-generering (tekst→bilde) */}
      <WsModal open={conceptOpen} onClose={() => { if (!conceptBusy) setConceptOpen(false); }} title="Generer konsept-bilde (AI)" maxWidth="sm">
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Beskriv stemningen/scenen, så genererer Nano Banana 2 et referansebilde rett inn i moodboardet.</Typography>
          <TextField value={conceptPrompt} onChange={(e) => setConceptPrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder="f.eks. romantisk editorial bryllup, varmt motlys, myke filmtoner" disabled={conceptBusy} />
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {['Varmt golden hour-motlys', 'Editorial fine-art, dempede toner', 'Moody og filmatisk', 'Lyst og luftig, naturlig'].map((p) => <Box key={p} onClick={() => setConceptPrompt(p)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{p}</Box>)}
          </Stack>
          {conceptBusy && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} sx={{ color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>{conceptStatus}</Typography></Stack>}
          {!conceptBusy && conceptStatus && <Typography sx={{ fontSize: 12, color: ws.green }}>{conceptStatus}</Typography>}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>~$0,06/bilde{credits?.billingMode === 'credits' ? <> · saldo ${(credits?.balanceUsd ?? 0).toFixed(2)} · <Box component="span" onClick={() => { setConceptOpen(false); setBuyOpen(true); }} sx={{ color: ws.accent, cursor: 'pointer', fontWeight: 700 }}>Kjøp</Box></> : null}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setConceptOpen(false)} disabled={conceptBusy} sx={{ color: ws.textDim, textTransform: 'none' }}>Lukk</Button>
              <Button variant="contained" disabled={!conceptPrompt.trim() || conceptBusy} onClick={generateConcept} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{conceptBusy ? 'Genererer…' : 'Generer'}</Button>
            </Stack>
          </Stack>
        </Stack>
      </WsModal>
      <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={buyPack} />
    </Stack>
  );
};

const MetaEditDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; meta: any; onSaved: () => void }> = ({ open, onClose, projectId, meta, onSaved }) => {
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [must, setMust] = useState('');
  const [palette, setPalette] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setStyle(meta?.style || '');
    setNotes((meta?.notes || []).join('\n'));
    setMust((meta?.mustCapture || []).map((m: any) => (m.label || m[0] || m)).join('\n'));
    setPalette((meta?.palette || []).map((p: any) => ({ name: p.name || p[0] || '', hex: p.hex || p[1] || '#cccccc' })));
  }, [open, meta]);
  const setColor = (i: number, k: string, v: string) => setPalette((p) => p.map((c, j) => j === i ? { ...c, [k]: v } : c));
  const addColor = () => setPalette((p) => [...p, { name: '', hex: '#cccccc' }]);
  const removeColor = (i: number) => setPalette((p) => p.filter((_, j) => j !== i));
  const save = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, {
        method: 'PUT',
        body: { style: style.trim(), notes: notes.split('\n').map((s) => s.trim()).filter(Boolean), mustCapture: must.split('\n').map((s) => ({ label: s.trim(), done: false })).filter((x) => x.label), palette: palette.filter((c) => c.hex).map((c) => ({ name: c.name.trim() || c.hex, hex: c.hex })) },
      });
      onSaved();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Rediger moodboard</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label="Stil retning" value={style} onChange={(e) => setStyle(e.target.value)} fullWidth size="small" placeholder="f.eks. Romantisk / Editorial" />
          <TextField label="Stilnotater (én per linje)" value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={4} size="small" />
          <TextField label="Må fanges (én per linje)" value={must} onChange={(e) => setMust(e.target.value)} fullWidth multiline minRows={3} size="small" />
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.textDim, mb: 0.75 }}>Fargepalett</Typography>
            <Stack spacing={0.75}>
              {palette.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#cccccc'} onChange={(e) => setColor(i, 'hex', e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <TextField value={c.name} onChange={(e) => setColor(i, 'name', e.target.value)} size="small" placeholder="Navn" sx={{ flex: 1 }} />
                  <TextField value={c.hex} onChange={(e) => setColor(i, 'hex', e.target.value)} size="small" sx={{ width: 110 }} />
                  <IconButton size="small" onClick={() => removeColor(i)}><Close sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={addColor} sx={{ alignSelf: 'flex-start', color: ws.accent, textTransform: 'none' }}>Legg til farge</Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{busy ? 'Lagrer…' : 'Lagre'}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoodboardTab;
