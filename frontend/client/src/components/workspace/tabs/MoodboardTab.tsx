// @ts-nocheck
/**
 * MoodboardTab — design #5, dark CreatorHub.
 * Stats + kategori-pills + opplastbart moodboard-rutenett + Mood details (høyre)
 * + Fargepalett / Stilnotater / Må fanges / Referanser delt med teamet.
 * Alle bilde-flater bruker WsImageGrid (legg til / last opp).
 */
import React, { useState } from 'react';
import { Box, Stack, Typography, Button, TextField, Avatar } from '@mui/material';
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
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>Moodboard</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<Image sx={{ fontSize: 20 }} />} label="Antall referanser" value="86" sub="+12 denne uken" />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Stil retning" value={<Typography sx={{ fontSize: 15, fontWeight: 800 }}>Romantisk / Editorial</Typography>} sub="Mykt, varmt, tidløst" />
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Palette sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 12, color: ws.textDim }}>Fargepalett</Typography></Stack>
            <Stack direction="row" spacing={0.5}>{PALETTE.map(([n, c]) => <Box key={n} sx={{ width: 22, height: 22, borderRadius: 1, bgcolor: c, border: `1px solid ${ws.borderSoft}` }} />)}</Stack>
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
            <Stack spacing={0.75}>{PALETTE.map(([n, c]) => <Stack key={n} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: c }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{c}</Typography></Stack>)}</Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Stilnotater</Typography>
            <Stack spacing={0.75}>{STYLE_NOTES.map((s) => <Typography key={s} sx={{ fontSize: 12.5, color: ws.textDim }}>· {s}</Typography>)}</Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Må fanges</Typography>
            <Stack spacing={0.75}>{CAPTURE.map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5, color: ws.text }}>{t}</Typography></Stack>)}</Stack>
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
    </Stack>
  );
};

export default MoodboardTab;
