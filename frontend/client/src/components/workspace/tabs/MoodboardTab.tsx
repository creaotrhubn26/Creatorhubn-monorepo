// @ts-nocheck
/**
 * MoodboardTab — design #5, dark CreatorHub.
 * Stats + kategori-pills + opplastbart moodboard-rutenett + Mood details (høyre)
 * + Fargepalett / Stilnotater / Må fanges / Referanser delt med teamet.
 * Alle bilde-flater bruker WsImageGrid (legg til / last opp).
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, TextField, Avatar, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import Edit from '@mui/icons-material/Edit';
import { apiRequest } from '@/lib/queryClient';
import Image from '@mui/icons-material/Image';
import Star from '@mui/icons-material/Star';
import Palette from '@mui/icons-material/Palette';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Search from '@mui/icons-material/Search';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsImageGrid } from '../ui';
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
  const loadMeta = () => { if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {}); };
  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`).then((r: any) => setMeta(r?.meta || null)).catch(() => {});
  }, [projectId, isReal]);
  // Ekte meta m/ sample-fallback.
  const pal = (meta?.palette && meta.palette.length) ? meta.palette.map((p: any) => [p.name || p[0] || '', p.hex || p[1] || p]) : PALETTE;
  const notes = (meta?.notes && meta.notes.length) ? meta.notes : STYLE_NOTES;
  const capture = (meta?.mustCapture && meta.mustCapture.length) ? meta.mustCapture.map((c: any) => [c.label || c[0] || c, c.done ?? c[1] ?? false]) : CAPTURE;
  const refCount = isReal ? mood.images.length : 86;
  const styleDir = meta?.style || 'Romantisk / Editorial';
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Moodboard</Typography>
          {isReal && <Button size="small" startIcon={<Edit sx={{ fontSize: 15 }} />} onClick={() => setEditOpen(true)} sx={{ color: ws.text, textTransform: 'none', border: `1px solid ${ws.border}` }}>Rediger</Button>}
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<Image sx={{ fontSize: 20 }} />} label="Antall referanser" value={refCount} sub={isReal ? 'i moodboardet' : '+12 denne uken'} />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Stil retning" value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>{styleDir}</Typography>} sub="Mykt, varmt, tidløst" />
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Palette sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>Fargepalett</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{pal.map(([n, c]) => <Box key={n} sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} />)}</Stack>
            <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.75 }}>6 farger</Typography>
          </WsCard>
          <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Godkjent av kunde" value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>Delvis</Typography>} sub="Sist oppdatert 23. mai" />
        </Box>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <WsPills items={CATS} value={cat} onChange={setCat} />
          </Stack>
          <TextField fullWidth size="small" placeholder="Søk i moodboardet…" InputProps={{ startAdornment: <Search sx={{ fontSize: 18, color: ws.textFaint, mr: 1 }} /> }} sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          <WsImageGrid columns={4} addLabel="Last opp bilde" images={mood.images} onUpload={mood.onUpload} />
        </WsCard>

        {/* Fargepalett + Stilnotater + Må fanges */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Fargepalett</Typography>
            <Stack spacing={0.75}>{pal.map(([n, c]) => <Stack key={n} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: c }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography></Stack>)}</Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Stilnotater</Typography>
            <Stack spacing={0.75}>{notes.map((s) => <Typography key={s} sx={{ fontSize: 12.5, color: ws.textDim }}>· {s}</Typography>)}</Stack>
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
    </Stack>
  );
};

const MetaEditDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; meta: any; onSaved: () => void }> = ({ open, onClose, projectId, meta, onSaved }) => {
  const [style, setStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [must, setMust] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setStyle(meta?.style || '');
    setNotes((meta?.notes || []).join('\n'));
    setMust((meta?.mustCapture || []).map((m: any) => (m.label || m[0] || m)).join('\n'));
  }, [open, meta]);
  const save = async () => {
    setBusy(true);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/moodboard-meta`, {
        method: 'PUT',
        body: { style: style.trim(), notes: notes.split('\n').map((s) => s.trim()).filter(Boolean), mustCapture: must.split('\n').map((s) => ({ label: s.trim(), done: false })).filter((x) => x.label), palette: meta?.palette || [] },
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
