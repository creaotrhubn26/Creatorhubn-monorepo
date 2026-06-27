// @ts-nocheck
/**
 * MediaTab — design #6 (Media library), dark CreatorHub.
 * Bibliotek-sidebar (typer/mapper) + opplastbart asset-rutenett + asset-detaljer.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, TextField } from '@mui/material';
import CloudUpload from '@mui/icons-material/CloudUpload';
import Search from '@mui/icons-material/Search';
import Star from '@mui/icons-material/Star';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsTag, WsImageGrid } from '../ui';
import { useProjectImages } from '../useProjectImages';

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

  useEffect(() => {
    if (!isReal) return;
    const fetchMedia = () => {
      if (document.hidden) return;
      apiRequest(`/api/projects/${encodeURIComponent(projectId)}/media`)
        .then((r: any) => { setAssets(Array.isArray(r?.assets) ? r.assets : []); setCull(r?.cullStats || {}); })
        .catch(() => {});
    };
    fetchMedia();
    const t = setInterval(fetchMedia, 25000); // live: reflekter culling fra iPad
    return () => clearInterval(t);
  }, [projectId, isReal]);

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
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: ws.textFaint, mb: 1 }}>MAPPER</Typography>
          <Stack spacing={0.25}>
            {FOLDERS.map(([n, c]) => <Stack key={n} direction="row" sx={{ px: 1, py: 0.5 }}><Typography sx={{ fontSize: 12.5, flex: 1, color: ws.textDim }}>📁 {n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography></Stack>)}
          </Stack>
        </WsCard>
      </Box>

      {/* Asset-grid */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography sx={{ fontSize: 18, fontWeight: 800 }}>{lib}</Typography>
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

        <WsImageGrid columns={4} addLabel="Last opp media" images={gridImages} onUpload={web.onUpload} />
      </Box>

      {/* Asset-detaljer */}
      <Box sx={{ width: 280, flexShrink: 0 }}>
        <WsCard>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>A7IV_1234.CR3</Typography>
            <Star sx={{ fontSize: 16, color: ws.amber }} />
          </Stack>
          <WsImageGrid columns={1} ratio="4 / 3" allowAdd={false} />
          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {[['Filtype', 'RAW Image'], ['Kamera', 'Sony A7IV'], ['Objektiv', '85mm f/1.4 GM'], ['Dato', '14. sep 2024, 09:15'], ['Størrelse', '45 MB'], ['ISO', '800'], ['Blender', 'f/1.4']].map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12, fontWeight: 600 }}>{v}</Typography></Stack>)}
          </Stack>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mt: 1.5, mb: 0.5 }}>LABELS</Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}><WsTag label="For Edit" tone="accent" /><WsTag label="Highlights" tone="amber" /><WsTag label="Details" tone="blue" /></Stack>
          <Button fullWidth size="small" variant="contained" sx={{ mt: 1.5, bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Last ned</Button>
        </WsCard>
      </Box>
    </Stack>
  );
};

export default MediaTab;
