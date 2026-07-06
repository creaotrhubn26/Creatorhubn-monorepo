// @ts-nocheck
/**
 * MediaTab — design #6 (Media library), dark CreatorHub.
 * Bibliotek-sidebar (typer/mapper) + opplastbart asset-rutenett + asset-detaljer.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, TextField, IconButton, Menu, MenuItem } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Search from '@mui/icons-material/Search';
import Star from '@mui/icons-material/Star';
import CreateNewFolder from '@mui/icons-material/CreateNewFolder';
import AutoAwesomeMotion from '@mui/icons-material/AutoAwesomeMotion';
import Close from '@mui/icons-material/Close';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { wsIcon } from '../crewIcons';
import { WsCard, WsTag, WsImageGrid, WsModal, WsErrorState } from '../ui';
import AiBuyCreditsModal from '../AiBuyCreditsModal';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab). Selv-nøklede
// oppslag (LIB-kategorier) beholder norsk som stabil nøkkel/state-verdi.
const T: WsDict = {
  'Alle medier': { no: 'Alle medier', en: 'All media' },
  'Bilder': { no: 'Bilder', en: 'Photos' },
  'Videoer': { no: 'Videoer', en: 'Videos' },
  'Lyd': { no: 'Lyd', en: 'Audio' },
  'Dokumenter': { no: 'Dokumenter', en: 'Documents' },
  folderPrompt: { no: 'Mappenavn:', en: 'Folder name:' },
  folderCreateFailed: { no: 'Kunne ikke opprette mappe', en: 'Could not create folder' },
  templateFailed: { no: 'Kunne ikke bruke mal', en: 'Could not apply template' },
  mediaLibrary: { no: 'MEDIA-BIBLIOTEK', en: 'MEDIA LIBRARY' },
  foldersHeading: { no: 'MAPPER', en: 'FOLDERS' },
  useTemplate: { no: 'Bruk mal', en: 'Use template' },
  newFolder: { no: 'Ny mappe', en: 'New folder' },
  noFolders: { no: 'Ingen mapper. Bruk en mal eller lag egne.', en: 'No folders. Use a template or create your own.' },
  live: { no: 'SANNTID', en: 'LIVE' },
  imagesWord: { no: 'bilder', en: 'images' },
  selectedWord: { no: 'valgt', en: 'selected' },
  searchMedia: { no: 'Søk media…', en: 'Search media…' },
  upload: { no: 'Last opp', en: 'Upload' },
  uploadMedia: { no: 'Last opp media', en: 'Upload media' },
  filterAll: { no: 'Alle', en: 'All' },
  filterUnrated: { no: 'Uten rating', en: 'Unrated' },
  filterFavorites: { no: 'Favoritter', en: 'Favorites' },
  filterHighlights: { no: 'Highlights (klient)', en: 'Highlights (client)' },
  clickDetails: { no: 'Klikk et bilde for å se detaljer.', en: 'Click an image to see details.' },
  image: { no: 'Bilde', en: 'Image' },
  fileType: { no: 'Filtype', en: 'File type' },
  size: { no: 'Størrelse', en: 'Size' },
  openDownload: { no: 'Åpne / last ned', en: 'Open / download' },
  sending: { no: 'Sender…', en: 'Sending…' },
  sendToEnhance: { no: 'Send til AI-forbedring', en: 'Send to AI enhancement' },
  aiCullTitle: { no: 'AI-cull-forslag', en: 'AI cull suggestions' },
  keep: { no: 'Behold', en: 'Keep' },
  weak: { no: 'Svak', en: 'Weak' },
  reject: { no: 'Forkast', en: 'Reject' },
  dupOne: { no: 'duplikat-klynge oppdaget', en: 'duplicate cluster detected' },
  dupMany: { no: 'duplikat-klynger oppdaget', en: 'duplicate clusters detected' },
  suggestedRejects: { no: 'FORESLÅTT FORKASTET', en: 'SUGGESTED REJECTS' },
  aiEnhanceTitle: { no: 'AI-forbedring', en: 'AI enhancement' },
  doneWord: { no: 'ferdig', en: 'done' },
  enhanceAll: { no: '✨ Forbedre alle klient-markerte', en: '✨ Enhance all client picks' },
  enhancingNow: { no: 'forbedres nå…', en: 'enhancing now…' },
  failedWord: { no: 'feilet', en: 'failed' },
  statusDone: { no: 'Ferdig', en: 'Done' },
  statusFailed: { no: 'Feilet', en: 'Failed' },
  statusRunning: { no: 'Kjører', en: 'Running' },
  beforeAfterShort: { no: 'Før/Etter', en: 'Before/After' },
  voiceNotesTitle: { no: 'Talenotater', en: 'Voice notes' },
  fromPhotographer: { no: 'fra fotograf', en: 'from photographer' },
  voiceNoteWord: { no: 'talenotat', en: 'voice note' },
  beforeAfterTitle: { no: 'Før / Etter', en: 'Before / After' },
  beforeWord: { no: 'Før', en: 'Before' },
  afterWord: { no: 'Etter', en: 'After' },
  beforeUpper: { no: 'FØR', en: 'BEFORE' },
  afterUpper: { no: 'ETTER', en: 'AFTER' },
  downloadEnhanced: { no: 'Last ned forbedret', en: 'Download enhanced' },
  enhanceSent: { no: 'Sendte {n} bilde(r) til AI-forbedring.', en: 'Sent {n} image(s) for AI enhancement.' },
  enhanceFailed: { no: 'Kunne ikke sende til AI-forbedring', en: 'Could not send to AI enhancement' },
  creditsAdded: { no: 'Kreditter lagt til ✓', en: 'Credits added ✓' },
  error: { no: 'Feil', en: 'Error' },
  loadError: { no: 'Kunne ikke laste media. Sjekk tilkoblingen og prøv igjen.', en: 'Could not load media. Check your connection and try again.' },
};

const LIB = [['Alle medier', 2487], ['Bilder', 1732], ['Videoer', 624], ['Lyd', 98], ['Dokumenter', 33]];
const FOLDERS = [['01_Brief', 12], ['02_Shotlists', 8], ['03_Photo_RAW', 1732], ['04_Video_A_Cam', 214], ['05_Video_B_Cam', 186], ['06_Drone', 67], ['07_Audio', 98], ['08_Selects', 156], ['09_Client_Review', 23], ['10_Final_Delivery', 0]];
const QUICK = [['Unrated', 1205], ['Favoritter', 156], ['For Edit', 312], ['Client Review', 23], ['Highlights', 48], ['Audio Issues', 4]];

const MediaTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Utenlandske partner-vendors får engelsk — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [lib, setLib] = useState('Alle medier');
  const [assets, setAssets] = useState<any[]>([]);
  const [cull, setCull] = useState<any>({});
  const [loadErr, setLoadErr] = useState(false);
  const [filter, setFilter] = useState('alle');
  const [q, setQ] = useState('');
  const web = useProjectImages(projectId, 'media');
  const isReal = projectId && projectId !== 'sample';
  const [selAsset, setSelAsset] = useState<any | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplMenu, setTplMenu] = useState<any>(null);

  const loadFolders = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`)
      .then((r: any) => { setFolders(Array.isArray(r?.folders) ? r.folders : []); setTemplates(Array.isArray(r?.templates) ? r.templates : []); })
      .catch(() => {});
  };
  useEffect(() => { loadFolders(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  const newFolder = async () => {
    const name = window.prompt(t('folderPrompt')); if (!name) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`, { method: 'POST', body: { name: name.trim() } }); loadFolders(); }
    catch (e: any) { window.alert(e?.message || t('folderCreateFailed')); }
  };
  const applyTemplate = async (key: string) => {
    setTplMenu(null);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/apply-template`, { method: 'POST', body: { template: key } }); setFolders(Array.isArray(r?.folders) ? r.folders : []); }
    catch (e: any) { window.alert(e?.message || t('templateFailed')); }
  };
  const delFolder = async (id: string) => {
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/${id}`, { method: 'DELETE' }); loadFolders(); } catch { /* */ }
  };
  const folderList = isReal ? folders.map((f) => [f.name, f.id]) : FOLDERS.map(([n]) => [n, null]);

  // Primær-last (media-assets). Stabil ref så feil-state kan re-fetche via onRetry.
  const reloadMedia = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`)
      .then((r: any) => { setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); setLoadErr(false); })
      .catch(() => setLoadErr(true));
  };
  useEffect(() => {
    if (!isReal) return;
    const fetchMedia = () => { if (document.hidden) return; reloadMedia(); };
    fetchMedia();
    const t = setInterval(fetchMedia, 25000); // poll-fallback
    return () => clearInterval(t);
  }, [projectId, isReal]);

  // Talenotater — fotografens innspilte voice-memos på bilder (capture_reviews).
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const loadVoice = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/voice-notes`).then((r: any) => setVoiceNotes(Array.isArray(r?.notes) ? r.notes : [])).catch(() => {}); };
  useEffect(() => { loadVoice(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  // AI-forbedring (photo_enhancement_jobs) + AI-cull-forslag (classifySession).
  const [enhance, setEnhance] = useState<any | null>(null);
  const [cullAi, setCullAi] = useState<any | null>(null);
  const [beforeAfter, setBeforeAfter] = useState<any | null>(null); // valgt enhance-jobb → Før/Etter-modal
  const [baPos, setBaPos] = useState(50); // slider-posisjon 0–100
  const loadAi = () => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/enhance-status`).then((r: any) => setEnhance(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/cull-suggestions`).then((r: any) => setCullAi(r || null)).catch(() => {});
  };
  useEffect(() => { loadAi(); /* eslint-disable-next-line */ }, [projectId, isReal]);
  const [enhancing, setEnhancing] = useState(false);
  // Kreditt (for «Send til AI-forbedring»)
  const [credits, setCredits] = useState<any | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const loadCredits = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits`).then((r: any) => setCredits(r || null)).catch(() => {}); };
  const buyPack = async (id: string) => { try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/checkout`, { method: 'POST', body: { packId: id } }); if (r?.url) window.location.href = r.url; } catch (e: any) { window.alert(e?.message || t('error')); } };
  useEffect(() => {
    if (!isReal) return;
    loadCredits();
    try { const p = new URLSearchParams(window.location.search); if (p.get('ai_credits') === 'ok' && p.get('cs')) { apiRequest(`/api/projects/${encodeURIComponent(projectId)}/ai/credits/confirm`, { method: 'POST', body: { sessionId: p.get('cs') } }).then(() => { loadCredits(); window.alert(t('creditsAdded')); }).catch(() => {}).finally(() => { const u = new URL(window.location.href); u.searchParams.delete('ai_credits'); u.searchParams.delete('cs'); window.history.replaceState({}, '', u.toString()); }); } } catch { /* */ }
    // eslint-disable-next-line
  }, [projectId]);
  const triggerEnhance = async (assetIds?: string[]) => {
    if (!isReal || enhancing) return;
    setEnhancing(true);
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/enhance-picks`, { method: 'POST', body: assetIds?.length ? { assetIds } : {} });
      window.alert(`${t('enhanceSent').replace('{n}', String(r?.queued ?? 0))}${r?.failures?.length ? ` (${r.failures.length} ${t('failedWord')})` : ''}`);
      loadAi(); loadCredits();
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('kreditt') || msg.includes('insufficient')) setBuyOpen(true);
      else window.alert(e?.message || t('enhanceFailed'));
    }
    finally { setEnhancing(false); }
  };

  // Sanntid: refetch media INSTANT når iPad skyter/culler (WS).
  const { live: capLive } = useCaptureRealtime(projectId, () => {
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`).then((r: any) => { setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); }).catch(() => {});
    loadVoice();
    loadAi();
  });

  // Cull-aware items: rating + pick (flagged_for_client) fra iPad-culling.
  const matchFilter = (a: any) => {
    if (filter === 'unrated') return !a.rating;
    if (filter === 'favoritter') return (a.rating || 0) >= 4;
    if (filter === 'highlights') return !!a.flaggedForClient;
    return true;
  };
  const captureItems = assets.filter((a) => a.previewUrl && matchFilter(a)).map((a) => ({ id: a.id, url: a.previewUrl, label: a.filename, rating: a.rating || 0, flag: !!a.flaggedForClient }));
  const gridImages = (isReal ? [...captureItems, ...(filter === 'alle' ? web.images : [])] : [])
    .filter((im: any) => !q || String(im.label || '').toLowerCase().includes(q.toLowerCase()));

  // Hurtigfiltre med EKTE tall fra cull-stats.
  const QUICK_REAL = [
    { key: 'alle', label: t('filterAll'), n: cull.total ?? 0 },
    { key: 'unrated', label: t('filterUnrated'), n: cull.unrated ?? 0 },
    { key: 'favoritter', label: t('filterFavorites'), n: cull.favorites ?? 0 },
    { key: 'highlights', label: t('filterHighlights'), n: cull.highlights ?? 0 },
  ];

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
      {/* Bibliotek-sidebar */}
      <Box sx={{ width: { xs: '100%', lg: 220 }, flexShrink: 0 }}>
        <WsCard pad={1.25}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, mb: 1 }}>{t('mediaLibrary')}</Typography>
          <Stack spacing={0.25} sx={{ mb: 1.5 }}>
            {LIB.map(([n, c]) => (
              <Stack key={n} direction="row" onClick={() => setLib(n)} sx={{ px: 1, py: 0.75, borderRadius: 1.5, cursor: 'pointer', alignItems: 'center', bgcolor: lib === n ? ws.accentSoft : 'transparent', '&:hover': { bgcolor: lib === n ? ws.accentSoft : 'rgba(255,255,255,0.04)' } }}>
                <Typography sx={{ fontSize: 13, flex: 1, color: lib === n ? ws.accent : ws.text, fontWeight: lib === n ? 700 : 500 }}>{t(n)}</Typography>
                <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint }}>{t('foldersHeading')}</Typography>
            {isReal && (
              <Stack direction="row" spacing={0.25}>
                <IconButton size="small" title={t('useTemplate')} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.textDim, p: 0.25 }}><AutoAwesomeMotion sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" title={t('newFolder')} onClick={newFolder} sx={{ color: ws.textDim, p: 0.25 }}><CreateNewFolder sx={{ fontSize: 16 }} /></IconButton>
              </Stack>
            )}
          </Stack>
          {isReal && folders.length === 0 && (
            <Box sx={{ px: 1, py: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 0.75 }}>{t('noFolders')}</Typography>
              <Button size="small" startIcon={<AutoAwesomeMotion sx={{ fontSize: 14 }} />} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.accent, textTransform: 'none', fontSize: 12 }}>{t('useTemplate')}</Button>
            </Box>
          )}
          <Stack spacing={0.25}>
            {folderList.map(([n, id]) => (
              <Stack key={id || n} direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1, '&:hover .delf': { opacity: 1 } }}>
                <Typography sx={{ fontSize: 12.5, flex: 1, color: ws.textDim, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>{wsIcon('Folder', { fontSize: 14 })}{n}</Typography>
                {id && <IconButton className="delf" size="small" onClick={() => delFolder(id)} sx={{ opacity: 0, color: ws.textFaint, p: 0.1 }}><Close sx={{ fontSize: 13 }} /></IconButton>}
              </Stack>
            ))}
          </Stack>
          <Menu open={!!tplMenu} anchorEl={tplMenu} onClose={() => setTplMenu(null)}>
            {templates.map((t) => <MenuItem key={t.key} onClick={() => applyTemplate(t.key)}>{t.label} <Typography component="span" sx={{ ml: 1, fontSize: 11, color: ws.textFaint }}>({t.count})</Typography></MenuItem>)}
          </Menu>
        </WsCard>
      </Box>

      {/* Asset-grid */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{t(lib)}</Typography>
              {capLive && <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700 }}>{t('live')}</Typography></Stack>}
            </Stack>
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>
              {isReal ? `${cull.total ?? 0} ${t('imagesWord')} · ${cull.favorites ?? 0} ${t('selectedWord')} · ${cull.highlights ?? 0} highlights` : '2 487 elementer'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" placeholder={t('searchMedia')} value={q} onChange={(e) => setQ(e.target.value)} InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: ws.textFaint, mr: 0.5 }} /> }} sx={{ width: 200, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
            <Button component="label" size="small" variant="contained" startIcon={<CloudUpload sx={{ fontSize: 16 }} />} disabled={!isReal} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
              {t('upload')}
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) web.onUpload(f); e.target.value = ''; }} />
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={0.75} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
          {isReal
            ? QUICK_REAL.map((q) => (
                <Box key={q.key} onClick={() => setFilter(q.key)} sx={{
                  px: 1.25, py: 0.4, borderRadius: 2, cursor: 'pointer', fontSize: 12, fontWeight: filter === q.key ? 700 : 500,
                  color: filter === q.key ? ws.accent : ws.textDim, bgcolor: filter === q.key ? ws.accentSoft : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === q.key ? ws.accentBorder : 'transparent'}`,
                }}>{q.label} {q.n}</Box>
              ))
            : QUICK.map(([n, c]) => <WsTag key={n} label={`${n} ${c}`} tone="neutral" />)}
        </Stack>

        {isReal && loadErr && assets.length === 0
          ? <WsErrorState message={t('loadError')} onRetry={reloadMedia} />
          : <WsImageGrid columns={4} addLabel={t('uploadMedia')} images={gridImages} onUpload={web.onUpload}
              onSelect={(im) => setSelAsset(assets.find((a) => a.id === im.id) || { filename: im.label, previewUrl: im.url, rating: im.rating, flaggedForClient: im.flag })} />}
      </Box>

      {/* Asset-detaljer */}
      <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
        {(() => {
          const det = selAsset || (isReal ? null : { filename: 'A7IV_1234.CR3', flaggedForClient: true });
          if (!det) return (
            <WsCard><Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, textAlign: 'center' }}>{t('clickDetails')}</Typography></WsCard>
          );
          const meta = isReal
            ? [[t('fileType'), det.mime || '—'], [t('size'), det.sizeBytes ? `${Math.round(det.sizeBytes / 1024 / 1024)} MB` : '—'], ['Rating', det.rating ? '★'.repeat(det.rating) : '–'], ['Status', det.state || '—']]
            : [['Filtype', 'RAW Image'], ['Kamera', 'Sony A7IV'], ['Objektiv', '85mm f/1.4 GM'], ['Størrelse', '45 MB'], ['ISO', '800']];
          return (
            <WsCard>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700 }}>{det.filename || t('image')}</Typography>
                {det.flaggedForClient && <Star sx={{ fontSize: 16, color: ws.amber }} />}
              </Stack>
              {det.previewUrl
                ? <Box sx={{ aspectRatio: '4 / 3', borderRadius: `${ws.radiusSm}px`, background: `center/cover no-repeat url(${det.previewUrl})`, border: `1px solid ${ws.borderSoft}` }} />
                : <WsImageGrid columns={1} ratio="4 / 3" allowAdd={false} />}
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                {meta.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography></Stack>)}
              </Stack>
              {det.flaggedForClient && <><Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mt: 1.5, mb: 0.5 }}>LABELS</Typography><Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}><WsTag label="Highlights" tone="amber" /></Stack></>}
              {det.previewUrl && <Button fullWidth size="small" variant="contained" onClick={() => window.open(det.previewUrl, '_blank')} sx={{ mt: 1.5, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('openDownload')}</Button>}
              {isReal && det.id && <Button fullWidth size="small" variant="outlined" disabled={enhancing} onClick={() => triggerEnhance([det.id])} startIcon={wsIcon('AutoAwesome', { fontSize: 15 })} sx={{ mt: 1, color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600, '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft } }}>{enhancing ? t('sending') : t('sendToEnhance')}</Button>}
            </WsCard>
          );
        })()}

        {/* AI-cull-forslag — samme cull-motor som iPad (classifySession) */}
        {(isReal ? cullAi?.hasAssets : true) && (() => {
          const c = isReal ? (cullAi?.counts || {}) : { hero: 18, keep: 96, weak: 31, reject: 12, duplicates: 4 };
          const tot = isReal ? (cullAi?.total || 0) : 157;
          const rej = isReal ? (cullAi?.reject || []) : [{ assetId: 'r1', filename: 'A7IV_1090.CR3', reasons: ['soft focus', 'eyes closed'], thumbUrl: null }];
          const buckets = [['Hero', c.hero || 0, ws.amber], [t('keep'), c.keep || 0, ws.green], [t('weak'), c.weak || 0, ws.textDim], [t('reject'), c.reject || 0, ws.red]];
          return (
            <WsCard sx={{ mt: 2 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                {wsIcon('SmartToy', { fontSize: 15, color: ws.textDim })}
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('aiCullTitle')}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{tot} {t('imagesWord')}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1 }}>
                {buckets.map(([label, n, col]: any) => (
                  <Box key={label} sx={{ flex: 1, textAlign: 'center', py: 0.65, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: col }}>{n}</Typography>
                    <Typography sx={{ fontSize: 9.5, color: ws.textFaint }}>{label}</Typography>
                  </Box>
                ))}
              </Stack>
              {(c.duplicates || 0) > 0 && <Typography sx={{ fontSize: 10.5, color: ws.textFaint, mb: 0.5 }}>{c.duplicates} {(c.duplicates || 0) > 1 ? t('dupMany') : t('dupOne')}</Typography>}
              {rej.length > 0 && <>
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: ws.textFaint, mt: 0.5, mb: 0.5 }}>{t('suggestedRejects')}</Typography>
                <Stack spacing={0.5}>
                  {rej.slice(0, 3).map((s: any) => (
                    <Stack key={s.assetId} direction="row" spacing={1} alignItems="center">
                      {s.thumbUrl
                        ? <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${s.thumbUrl})`, flexShrink: 0 }} />
                        : <Box sx={{ width: 26, height: 26, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontSize: 11, fontWeight: 600 }}>{s.filename || s.assetId}</Typography>
                        <Typography noWrap sx={{ fontSize: 10, color: ws.red }}>{(s.reasons || []).slice(0, 2).join(', ')}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </>}
            </WsCard>
          );
        })()}

        {/* AI-forbedring — photo_enhancement_jobs (GFPGAN/Real-ESRGAN) */}
        {(isReal ? enhance?.hasJobs : true) && (() => {
          const s = isReal ? (enhance?.summary || {}) : { total: 12, done: 9, running: 2, failed: 1 };
          const jobs = isReal ? (enhance?.jobs || []) : [{ id: 'e1', photoId: 'A7IV_1188', model: 'gfpgan', status: 'completed', thumbUrl: null }];
          return (
            <WsCard sx={{ mt: 2 }}>
              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                {wsIcon('AutoAwesome', { fontSize: 15, color: ws.accent })}
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('aiEnhanceTitle')}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700 }}>{s.done || 0}/{s.total || 0} {t('doneWord')}</Typography>
              </Stack>
              {isReal && <Button fullWidth size="small" variant="outlined" disabled={enhancing} onClick={() => triggerEnhance()} sx={{ mb: 1, color: ws.accent, borderColor: ws.accentBorder, textTransform: 'none', fontWeight: 600, fontSize: 11.5, '&:hover': { borderColor: ws.accent, bgcolor: ws.accentSoft } }}>{enhancing ? t('sending') : t('enhanceAll')}</Button>}
              {(s.running || 0) > 0 && <Typography sx={{ fontSize: 10.5, color: ws.amber, mb: 0.75 }}>⏳ {s.running} {t('enhancingNow')}{(s.failed || 0) > 0 ? ` · ${s.failed} ${t('failedWord')}` : ''}</Typography>}
              <Stack spacing={0.5}>
                {jobs.slice(0, 4).map((j: any) => {
                  const canCompare = !!(j.originalUrl && j.enhancedUrl);
                  return (
                  <Stack key={j.id} direction="row" spacing={1} alignItems="center" onClick={() => { if (canCompare) { setBaPos(50); setBeforeAfter(j); } }} sx={{ p: 0.65, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, cursor: canCompare ? 'pointer' : 'default', '&:hover': canCompare ? { bgcolor: 'rgba(255,255,255,0.06)' } : undefined }}>
                    {(j.thumbUrl || j.enhancedUrl)
                      ? <Box sx={{ width: 26, height: 26, borderRadius: 0.75, background: `center/cover no-repeat url(${j.thumbUrl || j.enhancedUrl})`, flexShrink: 0 }} />
                      : <Box sx={{ width: 26, height: 26, borderRadius: 0.75, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.accent }}>{wsIcon('AutoAwesome', { fontSize: 15 })}</Box>}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 11, fontWeight: 600 }}>{j.photoId || j.id}{canCompare && <Typography component="span" sx={{ fontSize: 9.5, color: ws.accent, ml: 0.5 }}>{t('beforeAfterShort')} ›</Typography>}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{j.model || 'AI'}{j.processingMs ? ` · ${(j.processingMs / 1000).toFixed(1)}s` : ''}</Typography>
                    </Box>
                    <WsTag label={j.status === 'completed' || j.status === 'done' ? t('statusDone') : j.status === 'failed' || j.status === 'error' ? t('statusFailed') : t('statusRunning')} tone={j.status === 'completed' || j.status === 'done' ? 'green' : j.status === 'failed' || j.status === 'error' ? 'red' : 'amber'} />
                  </Stack>
                  );
                })}
              </Stack>
            </WsCard>
          );
        })()}

        {/* Talenotater — fotografens innspilte voice-memos (Capture-appen) */}
        {(isReal ? voiceNotes.length > 0 : true) && (
          <WsCard sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
              {wsIcon('SettingsVoice', { fontSize: 15, color: ws.textDim })}
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('voiceNotesTitle')}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{isReal ? voiceNotes.length : 2} {t('fromPhotographer')}</Typography>
            </Stack>
            <Stack spacing={1}>
              {(isReal ? voiceNotes : [
                { id: 's1', filename: 'A7IV_1188.CR3', comment: 'Hero-bilde — prioriter denne i redigering', durationSeconds: 8, thumbUrl: null },
                { id: 's2', filename: 'A7IV_1241.CR3', comment: 'Fiks refleksen i vinduet bak', durationSeconds: 5, thumbUrl: null },
              ]).map((n: any) => (
                <Box key={n.id} sx={{ p: 1, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panelAlt, border: `1px solid ${ws.borderSoft}` }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    {n.thumbUrl
                      ? <Box sx={{ width: 28, height: 28, borderRadius: 1, background: `center/cover no-repeat url(${n.thumbUrl})`, flexShrink: 0 }} />
                      : <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ws.textDim }}>{wsIcon('Image', { fontSize: 15 })}</Box>}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600 }}>{n.filename || t('image')}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{n.durationSeconds ? `${n.durationSeconds}s` : ''} {t('voiceNoteWord')}</Typography>
                    </Box>
                  </Stack>
                  {n.comment && <Typography sx={{ fontSize: 11.5, color: ws.textDim, mb: n.audioUrl ? 0.5 : 0 }}>«{n.comment}»</Typography>}
                  {n.audioUrl && <audio controls preload="none" src={n.audioUrl} style={{ width: '100%', height: 32 }} />}
                </Box>
              ))}
            </Stack>
          </WsCard>
        )}
      </Box>

      {/* Før/Etter — interaktiv AI-forbedring-sammenligning */}
      <WsModal open={!!beforeAfter} onClose={() => setBeforeAfter(null)} title={`${t('beforeAfterTitle')} — ${beforeAfter?.photoId || t('aiEnhanceTitle')}`} maxWidth="md">
        {beforeAfter && (
          <Box>
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '3 / 2', borderRadius: `${ws.radiusSm}px`, overflow: 'hidden', userSelect: 'none', bgcolor: '#000' }}>
              {/* Etter (full, under) */}
              <Box component="img" src={beforeAfter.enhancedUrl} alt={t('afterWord')} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              {/* Før (klippet av slider-posisjon, over) */}
              <Box sx={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${100 - baPos}% 0 0)` }}>
                <Box component="img" src={beforeAfter.originalUrl} alt={t('beforeWord')} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              {/* Skille-linje */}
              <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${baPos}%`, width: '2px', bgcolor: ws.accent, boxShadow: '0 0 8px rgba(0,0,0,0.6)', transform: 'translateX(-1px)' }} />
              {/* Etiketter */}
              <Box sx={{ position: 'absolute', top: 8, left: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: 700, color: '#fff' }}>{t('beforeUpper')}</Box>
              <Box sx={{ position: 'absolute', top: 8, right: 8, px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,140,0,0.85)', fontSize: 11, fontWeight: 700, color: ws.accentContrast }}>{t('afterUpper')}</Box>
            </Box>
            <Box sx={{ px: 1, mt: 2 }}>
              <input type="range" min={0} max={100} value={baPos} onChange={(e) => setBaPos(Number(e.target.value))} style={{ width: '100%', accentColor: ws.accent }} />
            </Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5, px: 0.5 }}>
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>
                {beforeAfter.model || 'AI'}{beforeAfter.type ? ` · ${beforeAfter.type}` : ''}{beforeAfter.processingMs ? ` · ${(beforeAfter.processingMs / 1000).toFixed(1)}s` : ''}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={() => window.open(beforeAfter.originalUrl, '_blank')} sx={{ color: ws.textDim, textTransform: 'none' }}>Original</Button>
                <Button size="small" variant="contained" onClick={() => window.open(beforeAfter.enhancedUrl, '_blank')} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>{t('downloadEnhanced')}</Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </WsModal>
      <AiBuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} credits={credits} onBuy={buyPack} />
    </Stack>
  );
};

export default MediaTab;
