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
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  generateConcept: { no: 'Generer konsept', en: 'Generate concept' },
  edit: { no: 'Rediger', en: 'Edit' },
  refCount: { no: 'Antall referanser', en: 'References' },
  inMoodboard: { no: 'i moodboardet', en: 'in the moodboard' },
  styleDirection: { no: 'Stil retning', en: 'Style direction' },
  styleSub: { no: 'Mykt, varmt, tidløst', en: 'Soft, warm, timeless' },
  palette: { no: 'Fargepalett', en: 'Color palette' },
  colors: { no: 'farger', en: 'colors' },
  sample: { no: 'eksempel', en: 'sample' },
  clientApproved: { no: 'Godkjent av kunde', en: 'Client approved' },
  partial: { no: 'Delvis', en: 'Partial' },
  lastUpdated: { no: 'Sist oppdatert 23. mai', en: 'Last updated 23 May' },
  searchPlaceholder: { no: 'Søk i moodboardet…', en: 'Search the moodboard…' },
  taggedAs: { no: 'Nye opplastinger her merkes', en: 'New uploads here are tagged' },
  uploadImage: { no: 'Last opp bilde', en: 'Upload image' },
  autoFromRefs: { no: 'Auto fra referanser', en: 'Auto from references' },
  extracting: { no: 'Trekker ut…', en: 'Extracting…' },
  samplePaletteHint: { no: 'Eksempel-palett — trykk «Auto fra referanser» for å trekke ut ekte farger.', en: 'Sample palette — click "Auto from references" to extract real colors.' },
  styleNotes: { no: 'Stilnotater', en: 'Style notes' },
  aiFromRefs: { no: 'AI fra referanser', en: 'AI from references' },
  analyzing: { no: 'Analyserer…', en: 'Analyzing…' },
  sampleNotesHint: { no: 'Eksempel — trykk «AI fra referanser» for å generere fra bildene.', en: 'Sample — click "AI from references" to generate from the images.' },
  mustCapture: { no: 'Må fanges', en: 'Must capture' },
  sharedRefs: { no: 'Referanser delt med teamet', en: 'References shared with the team' },
  seeAll: { no: 'Se alle', en: 'See all' },
  shareImage: { no: 'Del bilde', en: 'Share image' },
  uploadMain: { no: 'Last opp hovedbilde', en: 'Upload main image' },
  tagPortraits: { no: 'Portretter', en: 'Portraits' },
  tagCritical: { no: 'Kritisk stil', en: 'Critical style' },
  moodDesc: { no: 'Ønsker varme toner, mykt motlys og rolig, emosjonell komposisjon. Fokus på naturlige bevegelser og nærhet.', en: 'Wants warm tones, soft backlight and calm, emotional composition. Focus on natural movement and closeness.' },
  notesHeader: { no: 'NOTATER', en: 'NOTES' },
  note1: { no: 'Bruk lengre brennvidde (85mm+)', en: 'Use longer focal lengths (85mm+)' },
  note2: { no: 'Mykt motlys – unngå hardt sollys', en: 'Soft backlight – avoid harsh sunlight' },
  note3: { no: 'Naturlige interaksjoner', en: 'Natural interactions' },
  note4: { no: 'Ton ned farger i etterarbeid', en: 'Tone down colors in post' },
  responsible: { no: 'ANSVARLIGE', en: 'RESPONSIBLE' },
  person1: { no: 'Daniel (Foto)', en: 'Daniel (Photo)' },
  person2: { no: 'Emma (Video)', en: 'Emma (Video)' },
  conceptTitle: { no: 'Generer konsept-bilde (AI)', en: 'Generate concept image (AI)' },
  conceptDesc: { no: 'Beskriv stemningen/scenen, så genererer Nano Banana 2 et referansebilde rett inn i moodboardet.', en: 'Describe the mood/scene and Nano Banana 2 will generate a reference image straight into the moodboard.' },
  conceptPlaceholder: { no: 'f.eks. romantisk editorial bryllup, varmt motlys, myke filmtoner', en: 'e.g. romantic editorial wedding, warm backlight, soft film tones' },
  chip1: { no: 'Varmt golden hour-motlys', en: 'Warm golden hour backlight' },
  chip2: { no: 'Editorial fine-art, dempede toner', en: 'Editorial fine art, muted tones' },
  chip3: { no: 'Moody og filmatisk', en: 'Moody and cinematic' },
  chip4: { no: 'Lyst og luftig, naturlig', en: 'Bright and airy, natural' },
  perImage: { no: '~$0,06/bilde', en: '~$0.06/image' },
  balance: { no: 'saldo', en: 'balance' },
  buy: { no: 'Kjøp', en: 'Buy' },
  close: { no: 'Lukk', en: 'Close' },
  generating: { no: 'Genererer…', en: 'Generating…' },
  generate: { no: 'Generer', en: 'Generate' },
  error: { no: 'Feil', en: 'Error' },
  creditsAdded: { no: 'Kreditter lagt til ✓', en: 'Credits added ✓' },
  couldNotStart: { no: 'Kunne ikke starte', en: 'Could not start' },
  addedToMoodboard: { no: '✓ Lagt i moodboardet', en: '✓ Added to the moodboard' },
  failed: { no: 'Feilet', en: 'Failed' },
  conceptFailed: { no: 'Konsept-generering feilet', en: 'Concept generation failed' },
  notesFailed: { no: 'Kunne ikke generere notater — last opp referansebilder først.', en: 'Could not generate notes — upload reference images first.' },
  paletteFailed: { no: 'Kunne ikke trekke ut farger — last opp referansebilder først.', en: 'Could not extract colors — upload reference images first.' },
  allCat: { no: 'Alle', en: 'All' },
  editMoodboard: { no: 'Rediger moodboard', en: 'Edit moodboard' },
  stylePlaceholder: { no: 'f.eks. Romantisk / Editorial', en: 'e.g. Romantic / Editorial' },
  notesPerLine: { no: 'Stilnotater (én per linje)', en: 'Style notes (one per line)' },
  mustPerLine: { no: 'Må fanges (én per linje)', en: 'Must capture (one per line)' },
  namePlaceholder: { no: 'Navn', en: 'Name' },
  addColor: { no: 'Legg til farge', en: 'Add color' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  saving: { no: 'Lagrer…', en: 'Saving…' },
  save: { no: 'Lagre', en: 'Save' },
  couldNotSave: { no: 'Kunne ikke lagre', en: 'Could not save' },
};
// Kategori-etiketter for pills på ekte prosjekter (nøklene/verdiene er uendret).
const CAT_I18N: Record<string, { no: string; en: string }> = {
  forb: { no: 'Forberedelser', en: 'Preparations' }, vielse: { no: 'Vielse', en: 'Ceremony' }, portrett: { no: 'Portretter', en: 'Portraits' }, golden: { no: 'Golden hour', en: 'Golden hour' }, detaljer: { no: 'Detaljer', en: 'Details' }, fest: { no: 'Fest', en: 'Reception' },
};

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
  // Utenlandske partner-vendors får engelsk UI (WsLocaleProvider i TeamWorkspacePage).
  const locale = useWsLocale();
  const t = makeT(T, locale);
  // AI konsept-generering (tekst→bilde) + kreditt
  const [aiCfg, setAiCfg] = useState<any | null>(null);
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [conceptBusy, setConceptBusy] = useState(false);
  const [conceptStatus, setConceptStatus] = useState('');
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (id: string) => { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId: id } }); if (r?.url) window.location.href = r.url; } catch (e: any) { window.alert(e?.message || t('error')); } };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/config`).then((r: any) => setAiCfg(r || null)).catch(() => {});
    loadCredits();
    try { const p = new URLSearchParams(window.location.search); if (p.get('ai_credits') === 'ok' && p.get('cs')) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } }).then(() => { loadCredits(); window.alert(t('creditsAdded')); }).catch(() => {}).finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); }); } } catch { /* */ }
    // eslint-disable-next-line
  }, [projectId]);
  const generateConcept = async () => {
    if (!conceptPrompt.trim() || conceptBusy) return;
    setConceptBusy(true); setConceptStatus(t('generating'));
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/concept-image`, { method: 'POST', body: { prompt: conceptPrompt.trim() } });
      if (!r?.jobId) throw new Error(t('couldNotStart'));
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 2500));
        const s: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/jobs/${r.jobId}`);
        if (s.status === 'completed') { setConceptStatus(t('addedToMoodboard')); mood.reload && mood.reload(); loadCredits(); break; }
        if (s.status === 'failed') { setConceptStatus(t('failed')); break; }
      }
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('kreditt') || msg.includes('insufficient')) { setConceptOpen(false); setBuyOpen(true); }
      else window.alert(e?.message || t('conceptFailed'));
      setConceptStatus('');
    } finally { setConceptBusy(false); }
  };
  const loadMeta = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {}); };
  const generateNotes = async () => {
    if (!isReal || genNotes) return;
    setGenNotes(true);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/generate-notes`, { method: 'POST', body: {} }); setMeta((m: any) => ({ ...(m || {}), style: r.styleDirection, notes: r.notes, mustCapture: r.mustCapture })); }
    catch (e: any) { window.alert(e?.message || t('notesFailed')); }
    finally { setGenNotes(false); }
  };
  const extractPalette = async () => {
    if (!isReal || extracting) return;
    setExtracting(true);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta/extract-palette`, { method: 'POST', body: {} }); setMeta((m: any) => ({ ...(m || {}), palette: r.palette })); }
    catch (e: any) { window.alert(e?.message || t('paletteFailed')); }
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
    ? [{ key: 'alle', label: `${t('allCat')} ${mood.images.length}` }, ...CATS.filter((c) => c.key !== 'alle').map((c) => ({ key: c.key, label: `${CAT_I18N[c.key]?.[locale] || c.label.replace(/\s*\d+$/, '')} ${catCount[c.key] || 0}` }))]
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
            {isReal && aiCfg?.enabled && aiCfg?.whitelisted && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={() => { setConceptPrompt(''); setConceptStatus(''); setConceptOpen(true); }} sx={{ color: ws.accentContrast, bgcolor: ws.accent, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('generateConcept')}</Button>}
            {isReal && <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => setEditOpen(true)} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>{t('edit')}</Button>}
          </Stack>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<Image sx={{ fontSize: 20 }} />} label={t('refCount')} value={refCount} sub={isReal ? t('inMoodboard') : '+12 denne uken'} />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label={t('styleDirection')} value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>{styleDir}</Typography>} sub={t('styleSub')} />
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Palette sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>{t('palette')}</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{pal.map(([n, c]) => <Box key={n} sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} />)}</Stack>
            <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.75 }}>{pal.length} {t('colors')}{(!meta?.palette || !meta.palette.length) && isReal ? ` · ${t('sample')}` : ''}</Typography>
          </WsCard>
          <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label={t('clientApproved')} value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>{t('partial')}</Typography>} sub={t('lastUpdated')} />
        </Box>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <WsPills items={realCats} value={cat} onChange={setCat} />
          </Stack>
          <TextField fullWidth size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: ws.textFaint, mr: 1 }} /> }} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          {isReal && cat !== 'alle' && <Typography sx={{ fontSize: 11, color: ws.textFaint, mb: 1 }}>{t('taggedAs')} «{cat}».</Typography>}
          <WsImageGrid columns={4} addLabel={t('uploadImage')} images={gridImages} onUpload={(f: any) => mood.onUpload(f, cat === 'alle' ? undefined : cat)} />
        </WsCard>

        {/* Fargepalett + Stilnotater + Må fanges */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('palette')}</Typography>
              {isReal && <Button size="small" startIcon={<Palette sx={{ fontSize: 15 }} />} onClick={extractPalette} disabled={extracting} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{extracting ? t('extracting') : t('autoFromRefs')}</Button>}
            </Stack>
            <Stack spacing={0.75}>{pal.map(([n, c]) => <Stack key={`${n}${c}`} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography></Stack>)}</Stack>
            {(!meta?.palette || !meta.palette.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>{t('samplePaletteHint')}</Typography>}
          </WsCard>
          <WsCard>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{t('styleNotes')}</Typography>
              {isReal && <Button size="small" startIcon={<AutoAwesome sx={{ fontSize: 15 }} />} onClick={generateNotes} disabled={genNotes} sx={{ color: ws.accent, textTransform: 'none', fontWeight: 600, fontSize: 11.5 }}>{genNotes ? t('analyzing') : t('aiFromRefs')}</Button>}
            </Stack>
            <Stack spacing={0.75}>{notes.map((s) => <Typography key={s} sx={{ fontSize: 12.5, color: ws.textDim }}>· {s}</Typography>)}</Stack>
            {(!meta?.notes || !meta.notes.length) && isReal && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mt: 1 }}>{t('sampleNotesHint')}</Typography>}
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('mustCapture')}</Typography>
            <Stack spacing={0.75}>{capture.map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5, color: ws.text }}>{t}</Typography></Stack>)}</Stack>
          </WsCard>
        </Box>

        <WsCard>
          <WsSectionTitle title={t('sharedRefs')} action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>{t('seeAll')}</Button>} />
          <WsImageGrid columns={7} addLabel={t('shareImage')} images={shared.images} onUpload={shared.onUpload} />
        </WsCard>
      </Box>

      {/* Mood details (høyre) */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard>
          <WsSectionTitle title="Mood details" />
          <WsImageGrid columns={1} ratio="4 / 3" addLabel={t('uploadMain')} allowAdd />
          <Stack direction="row" spacing={0.5} sx={{ my: 1.25, flexWrap: 'wrap', gap: 0.5 }}>
            <WsTag label="Golden hour" tone="amber" /><WsTag label={t('tagPortraits')} tone="accent" /><WsTag label={t('tagCritical')} tone="red" />
          </Stack>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, mb: 1.5 }}>{t('moodDesc')}</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('notesHeader')}</Typography>
          <Stack spacing={0.5} sx={{ mb: 1.5 }}>
            {[t('note1'), t('note2'), t('note3'), t('note4')].map((n) => <Typography key={n} sx={{ fontSize: 12, color: ws.textDim }}>· {n}</Typography>)}
          </Stack>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('responsible')}</Typography>
          <Stack direction="row" spacing={1}>
            {[t('person1'), t('person2')].map((p) => <Stack key={p} direction="row" spacing={0.5} alignItems="center"><Avatar sx={{ width: 20, height: 20, fontSize: 9 }}>{p[0]}</Avatar><Typography sx={{ fontSize: 11.5 }}>{p}</Typography><CheckCircle sx={{ fontSize: 13, color: ws.green }} /></Stack>)}
          </Stack>
        </WsCard>
      </Box>

      <MetaEditDialog open={editOpen} onClose={() => setEditOpen(false)} projectId={projectId} meta={meta} onSaved={() => { setEditOpen(false); loadMeta(); }} />

      {/* AI konsept-generering (tekst→bilde) */}
      <WsModal open={conceptOpen} onClose={() => { if (!conceptBusy) setConceptOpen(false); }} title={t('conceptTitle')} maxWidth="sm">
        <Stack spacing={2}>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('conceptDesc')}</Typography>
          <TextField value={conceptPrompt} onChange={(e) => setConceptPrompt(e.target.value)} fullWidth multiline minRows={2} size="small" placeholder={t('conceptPlaceholder')} disabled={conceptBusy} />
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {[t('chip1'), t('chip2'), t('chip3'), t('chip4')].map((p) => <Box key={p} onClick={() => setConceptPrompt(p)} sx={{ px: 1, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 11, color: ws.accent, bgcolor: ws.accentSoft, border: `1px solid ${ws.accentBorder}` }}>{p}</Box>)}
          </Stack>
          {conceptBusy && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} sx={{ color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>{conceptStatus}</Typography></Stack>}
          {!conceptBusy && conceptStatus && <Typography sx={{ fontSize: 12, color: ws.green }}>{conceptStatus}</Typography>}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('perImage')}{credits?.billingMode === 'credits' ? <> · {t('balance')} ${(credits?.balanceUsd ?? 0).toFixed(2)} · <Box component="span" onClick={() => { setConceptOpen(false); setBuyOpen(true); }} sx={{ color: ws.accent, cursor: 'pointer', fontWeight: 700 }}>{t('buy')}</Box></> : null}</Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setConceptOpen(false)} disabled={conceptBusy} sx={{ color: ws.textDim, textTransform: 'none' }}>{t('close')}</Button>
              <Button variant="contained" disabled={!conceptPrompt.trim() || conceptBusy} onClick={generateConcept} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{conceptBusy ? t('generating') : t('generate')}</Button>
            </Stack>
          </Stack>
        </Stack>
      </WsModal>
      <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={buyPack} />
    </Stack>
  );
};

const MetaEditDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; meta: any; onSaved: () => void }> = ({ open, onClose, projectId, meta, onSaved }) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
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
    } catch (e: any) { window.alert(e?.message || t('couldNotSave')); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('editMoodboard')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <TextField label={t('styleDirection')} value={style} onChange={(e) => setStyle(e.target.value)} fullWidth size="small" placeholder={t('stylePlaceholder')} />
          <TextField label={t('notesPerLine')} value={notes} onChange={(e) => setNotes(e.target.value)} fullWidth multiline minRows={4} size="small" />
          <TextField label={t('mustPerLine')} value={must} onChange={(e) => setMust(e.target.value)} fullWidth multiline minRows={3} size="small" />
          <Box>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.textDim, mb: 0.75 }}>{t('palette')}</Typography>
            <Stack spacing={0.75}>
              {palette.map((c, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(c.hex) ? c.hex : '#cccccc'} onChange={(e) => setColor(i, 'hex', e.target.value)} style={{ width: 32, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                  <TextField value={c.name} onChange={(e) => setColor(i, 'name', e.target.value)} size="small" placeholder={t('namePlaceholder')} sx={{ flex: 1 }} />
                  <TextField value={c.hex} onChange={(e) => setColor(i, 'hex', e.target.value)} size="small" sx={{ width: 110 }} />
                  <IconButton size="small" onClick={() => removeColor(i)}><Close sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={addColor} sx={{ alignSelf: 'flex-start', color: ws.accent, textTransform: 'none' }}>{t('addColor')}</Button>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{busy ? t('saving') : t('save')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default MoodboardTab;
