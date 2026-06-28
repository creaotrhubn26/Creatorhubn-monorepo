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
import { WsCard, WsTag, WsImageGrid } from '../ui';
import { useProjectImages } from '../useProjectImages';
import { useCaptureRealtime } from '../useCaptureRealtime';

const LIB = [['Alle medier', 2487], ['Bilder', 1732], ['Videoer', 624], ['Lyd', 98], ['Dokumenter', 33]];
const FOLDERS = [['01_Brief', 12], ['02_Shotlists', 8], ['03_Photo_RAW', 1732], ['04_Video_A_Cam', 214], ['05_Video_B_Cam', 186], ['06_Drone', 67], ['07_Audio', 98], ['08_Selects', 156], ['09_Client_Review', 23], ['10_Final_Delivery', 0]];
const QUICK = [['Unrated', 1205], ['Favoritter', 156], ['For Edit', 312], ['Client Review', 23], ['Highlights', 48], ['Audio Issues', 4]];

const MediaTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [lib, setLib] = useState('Alle medier');
  const [assets, setAssets] = useState<any[]>([]);
  const [cull, setCull] = useState<any>({});
  const [filter, setFilter] = useState('alle');
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
    const name = window.prompt('Mappenavn:'); if (!name) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders`, { method: 'POST', body: { name: name.trim() } }); loadFolders(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke opprette mappe'); }
  };
  const applyTemplate = async (key: string) => {
    setTplMenu(null);
    try { const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/apply-template`, { method: 'POST', body: { template: key } }); setFolders(Array.isArray(r?.folders) ? r.folders : []); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke bruke mal'); }
  };
  const delFolder = async (id: string) => {
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media-folders/${id}`, { method: 'DELETE' }); loadFolders(); } catch { /* */ }
  };
  const folderList = (isReal && folders.length) ? folders.map((f) => [f.name, f.id]) : FOLDERS.map(([n]) => [n, null]);

  useEffect(() => {
    if (!isReal) return;
    const fetchMedia = () => {
      if (document.hidden) return;
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`)
        .then((r: any) => { setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); })
        .catch(() => {});
    };
    fetchMedia();
    const t = setInterval(fetchMedia, 25000); // poll-fallback
    return () => clearInterval(t);
  }, [projectId, isReal]);

  // Talenotater — fotografens innspilte voice-memos på bilder (capture_reviews).
  const [voiceNotes, setVoiceNotes] = useState<any[]>([]);
  const loadVoice = () => { if (!isReal) return; apiRequest(`/api/projects/${encodeURIComponent(projectId)}/voice-notes`).then((r: any) => setVoiceNotes(Array.isArray(r?.notes) ? r.notes : [])).catch(() => {}); };
  useEffect(() => { loadVoice(); /* eslint-disable-next-line */ }, [projectId, isReal]);

  // Sanntid: refetch media INSTANT når iPad skyter/culler (WS).
  const { live: capLive } = useCaptureRealtime(projectId, () => {
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`).then((r: any) => { setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); }).catch(() => {});
    loadVoice();
  });

  // Cull-aware items: rating + pick (flagged_for_client) fra iPad-culling.
  const matchFilter = (a: any) => {
    if (filter === 'unrated') return !a.rating;
    if (filter === 'favoritter') return (a.rating || 0) >= 4;
    if (filter === 'highlights') return !!a.flaggedForClient;
    return true;
  };
  const captureItems = assets.filter((a) => a.previewUrl && matchFilter(a)).map((a) => ({ id: a.id, url: a.previewUrl, label: a.filename, rating: a.rating || 0, flag: !!a.flaggedForClient }));
  const gridImages = isReal ? [...captureItems, ...(filter === 'alle' ? web.images : [])] : [];

  // Hurtigfiltre med EKTE tall fra cull-stats.
  const QUICK_REAL = [
    { key: 'alle', label: 'Alle', n: cull.total ?? 0 },
    { key: 'unrated', label: 'Uten rating', n: cull.unrated ?? 0 },
    { key: 'favoritter', label: 'Favoritter', n: cull.favorites ?? 0 },
    { key: 'highlights', label: 'Highlights (klient)', n: cull.highlights ?? 0 },
  ];

  return (
    <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
      {/* Bibliotek-sidebar */}
      <Box sx={{ width: 220, flexShrink: 0 }}>
        <WsCard pad={1.25}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, mb: 1 }}>MEDIA-BIBLIOTEK</Typography>
          <Stack spacing={0.25} sx={{ mb: 1.5 }}>
            {LIB.map(([n, c]) => (
              <Stack key={n} direction="row" onClick={() => setLib(n)} sx={{ px: 1, py: 0.75, borderRadius: 1.5, cursor: 'pointer', alignItems: 'center', bgcolor: lib === n ? ws.accentSoft : 'transparent', '&:hover': { bgcolor: lib === n ? ws.accentSoft : 'rgba(255,255,255,0.04)' } }}>
                <Typography sx={{ fontSize: 13, flex: 1, color: lib === n ? ws.accent : ws.text, fontWeight: lib === n ? 700 : 500 }}>{n}</Typography>
                <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography>
              </Stack>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint }}>MAPPER</Typography>
            {isReal && (
              <Stack direction="row" spacing={0.25}>
                <IconButton size="small" title="Bruk mal" onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.textDim, p: 0.25 }}><AutoAwesomeMotion sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" title="Ny mappe" onClick={newFolder} sx={{ color: ws.textDim, p: 0.25 }}><CreateNewFolder sx={{ fontSize: 16 }} /></IconButton>
              </Stack>
            )}
          </Stack>
          {isReal && folders.length === 0 && (
            <Box sx={{ px: 1, py: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mb: 0.75 }}>Ingen mapper. Bruk en mal eller lag egne.</Typography>
              <Button size="small" startIcon={<AutoAwesomeMotion sx={{ fontSize: 14 }} />} onClick={(e) => setTplMenu(e.currentTarget)} sx={{ color: ws.accent, textTransform: 'none', fontSize: 12 }}>Bruk mal</Button>
            </Box>
          )}
          <Stack spacing={0.25}>
            {folderList.map(([n, id]) => (
              <Stack key={id || n} direction="row" alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1, '&:hover .delf': { opacity: 1 } }}>
                <Typography sx={{ fontSize: 12.5, flex: 1, color: ws.textDim }}>📁 {n}</Typography>
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
              <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{lib}</Typography>
              {capLive && <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 10.5, color: ws.green, fontWeight: 700 }}>SANNTID</Typography></Stack>}
            </Stack>
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>
              {isReal ? `${cull.total ?? 0} bilder · ${cull.favorites ?? 0} valgt · ${cull.highlights ?? 0} highlights` : '2 487 elementer'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField size="small" placeholder="Søk media…" InputProps={{ startAdornment: <Search sx={{ fontSize: 16, color: ws.textFaint, mr: 0.5 }} /> }} sx={{ width: 200, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
            <Button size="small" variant="contained" startIcon={<CloudUpload sx={{ fontSize: 16 }} />} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Last opp</Button>
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

        <WsImageGrid columns={4} addLabel="Last opp media" images={gridImages} onUpload={web.onUpload}
          onSelect={(im) => setSelAsset(assets.find((a) => a.id === im.id) || { filename: im.label, previewUrl: im.url, rating: im.rating, flaggedForClient: im.flag })} />
      </Box>

      {/* Asset-detaljer */}
      <Box sx={{ width: 280, flexShrink: 0 }}>
        {(() => {
          const det = selAsset || (isReal ? null : { filename: 'A7IV_1234.CR3', flaggedForClient: true });
          if (!det) return (
            <WsCard><Typography sx={{ fontSize: 12.5, color: ws.textDim, py: 3, textAlign: 'center' }}>Klikk et bilde for å se detaljer.</Typography></WsCard>
          );
          const meta = isReal
            ? [['Filtype', det.mime || '—'], ['Størrelse', det.sizeBytes ? `${Math.round(det.sizeBytes / 1024 / 1024)} MB` : '—'], ['Rating', det.rating ? '★'.repeat(det.rating) : '–'], ['Status', det.state || '—']]
            : [['Filtype', 'RAW Image'], ['Kamera', 'Sony A7IV'], ['Objektiv', '85mm f/1.4 GM'], ['Størrelse', '45 MB'], ['ISO', '800']];
          return (
            <WsCard>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 700 }}>{det.filename || 'Bilde'}</Typography>
                {det.flaggedForClient && <Star sx={{ fontSize: 16, color: ws.amber }} />}
              </Stack>
              {det.previewUrl
                ? <Box sx={{ aspectRatio: '4 / 3', borderRadius: `${ws.radiusSm}px`, background: `center/cover no-repeat url(${det.previewUrl})`, border: `1px solid ${ws.borderSoft}` }} />
                : <WsImageGrid columns={1} ratio="4 / 3" allowAdd={false} />}
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                {meta.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography></Stack>)}
              </Stack>
              {det.flaggedForClient && <><Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mt: 1.5, mb: 0.5 }}>LABELS</Typography><Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}><WsTag label="Highlights" tone="amber" /></Stack></>}
              {det.previewUrl && <Button fullWidth size="small" variant="contained" onClick={() => window.open(det.previewUrl, '_blank')} sx={{ mt: 1.5, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Åpne / last ned</Button>}
            </WsCard>
          );
        })()}

        {/* Talenotater — fotografens innspilte voice-memos (Capture-appen) */}
        {(isReal ? voiceNotes.length > 0 : true) && (
          <WsCard sx={{ mt: 2 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 14 }}>🎙️</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Talenotater</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ fontSize: 11, color: ws.textFaint }}>{isReal ? voiceNotes.length : 2} fra fotograf</Typography>
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
                      : <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🖼️</Box>}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600 }}>{n.filename || 'Bilde'}</Typography>
                      <Typography sx={{ fontSize: 10, color: ws.textFaint }}>{n.durationSeconds ? `${n.durationSeconds}s` : ''} talenotat</Typography>
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
    </Stack>
  );
};

export default MediaTab;
