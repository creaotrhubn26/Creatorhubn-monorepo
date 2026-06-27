// @ts-nocheck
/**
 * ShotlistTab — design #4, dark CreatorHub.
 * Stats + kategori-pills + shot-tabell + Shot detaljer (høyre, opplastbart bilde
 * + samtale) + Referanser & inspirasjon (opplastbart) + Må huskes.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, Avatar, TextField } from '@mui/material';
import { apiRequest } from '@/lib/queryClient';
import PhotoCameraBack from '@mui/icons-material/PhotoCameraBack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Star from '@mui/icons-material/Star';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsStat, WsPills, WsTag, WsTable, WsImageGrid } from '../ui';
import { useProjectImages } from '../useProjectImages';

const CATS = [{ key: 'alle', label: 'Alle (68)' }, { key: 'forb', label: 'Forberedelser (10)' }, { key: 'vielse', label: 'Vielse (14)' }, { key: 'portrett', label: 'Portretter (10)' }, { key: 'fam', label: 'Familiebilder (8)' }, { key: 'golden', label: 'Golden hour (6)' }, { key: 'taler', label: 'Taler (7)' }, { key: 'fest', label: 'Fest (13)' }];
const SHOTS = [
  ['Kritisk', 'red', 'Ringer og detaljer', 'Detaljer', 'Brudens suite', 'Ferdig', 'green'],
  ['Høy', 'amber', 'Brudekjole hanging shot', 'Detaljer', 'Brudens suite', 'Planlagt', 'blue'],
  ['Normal', 'neutral', 'Makeup & hår detaljer', 'Forberedelse', 'Brudens suite', 'Planlagt', 'blue'],
  ['Kritisk', 'red', 'First look reaksjon', 'Vielse', 'Hage', 'Ferdig', 'green'],
  ['Kritisk', 'red', 'Brud inngang', 'Vielse', 'Kirken', 'Pågår', 'amber'],
  ['Kritisk', 'red', 'Ring exchange', 'Vielse', 'Kirken', 'Klar', 'accent'],
  ['Høy', 'amber', 'Portrett av paret', 'Portretter', 'Parkområdet', 'Klar', 'accent'],
];
const SAMTALE = [
  { who: 'Daniel (Foto)', t: '10:12', msg: 'Jeg tar 85mm fra fronten, Emma kan ta siden for reaksjoner? 👍' },
  { who: 'Emma (Video)', t: '10:15', msg: 'Yes! Jeg tar slow motion på siste steg i kirken. ✨' },
  { who: 'Lukas (Editor)', t: '10:18', msg: 'Perfekt! Husk å få med gjestene som reiser seg også.' },
];

const PRIO_TONE: Record<string, string> = { kritisk: 'red', critical: 'red', høy: 'amber', high: 'amber', normal: 'neutral', lav: 'neutral', low: 'neutral' };
const STATUS_TONE: Record<string, string> = { ferdig: 'green', done: 'green', completed: 'green', pågår: 'amber', in_progress: 'amber', klar: 'accent', ready: 'accent', planlagt: 'blue', planned: 'blue' };

const ShotlistTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [cat, setCat] = useState('alle');
  const [real, setReal] = useState<{ shots: any[]; meta: any } | null>(null);
  const refs = useProjectImages(projectId, 'references');

  useEffect(() => {
    if (!projectId || projectId === 'sample') return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/shot-list`)
      .then((r: any) => { const shots = Array.isArray(r?.shots) ? r.shots : []; if (shots.length) setReal({ shots, meta: r.shotList || {} }); })
      .catch(() => {});
  }, [projectId]);

  // Ekte shots → tabell-rader (fleksibel felt-mapping mot wizard-shapen).
  const realRows = real ? real.shots.slice(0, 12).map((s: any) => {
    const title = s.name || s.title || s.shot || s.description || 'Shot';
    const prio = (s.priority || s.prio || 'normal').toString();
    const status = (s.status || 'planlagt').toString();
    const kat = s.category || s.kategori || s.phase || '—';
    const loc = s.location || s.lokasjon || '—';
    return [prio, PRIO_TONE[prio.toLowerCase()] || 'neutral', title, kat, loc, status, STATUS_TONE[status.toLowerCase()] || 'blue'];
  }) : null;
  const rows = realRows || SHOTS;

  const total = real ? (real.meta.totalShots ?? real.shots.length) : 68;
  const done = real ? (real.meta.completedShots ?? 0) : 21;
  const critical = real ? (real.meta.criticalShots ?? 0) : 12;
  const mangler = real ? Math.max(0, critical - (real.meta.completedCriticalShots ?? 0)) : 5;
  const donePct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>Shotlist</Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsStat icon={<PhotoCameraBack sx={{ fontSize: 20 }} />} label="Totalt antall shots" value={total} sub="100% planlagt" />
          <WsStat icon={<CheckCircle sx={{ fontSize: 20 }} />} label="Fullført" value={done} sub={`${donePct}% av totalen`} tone={ws.greenSoft} />
          <WsStat icon={<Star sx={{ fontSize: 20 }} />} label="Kritiske øyeblikk" value={critical} sub={`Av totalt ${total}`} tone={ws.amberSoft} />
          <WsStat icon={<ErrorOutline sx={{ fontSize: 20 }} />} label="Mangler" value={mangler} sub="Må dekkes" tone={ws.redSoft} />
        </Box>

        <WsCard>
          <Box sx={{ mb: 1.5 }}><WsPills items={CATS} value={cat} onChange={setCat} /></Box>
          <WsTable
            columns={['Prioritet', 'Shot', 'Kategori', 'Foto', 'Video', 'Lokasjon', 'Ansvarlig', 'Status']}
            rows={rows.map((s) => [
              <WsTag label={s[0]} tone={s[1]} />,
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s[2]}</Typography>,
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{s[3]}</Typography>,
              <WsTag label="Foto" tone="accent" />,
              <WsTag label="Video" tone="blue" />,
              <Typography sx={{ fontSize: 12, color: ws.textDim }}>{s[4]}</Typography>,
              <Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>D</Avatar>,
              <WsTag label={s[5]} tone={s[6]} />,
            ])}
          />
          <Stack alignItems="center" sx={{ mt: 1 }}><Button size="small" sx={{ color: ws.textDim, textTransform: 'none' }}>Vis 44 flere shots ▾</Button></Stack>
        </WsCard>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mt: 2 }}>
          <WsCard>
            <WsSectionTitle title="Referanser & inspirasjon" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={5} addLabel="Legg til referanse" images={refs.images} onUpload={refs.onUpload} />
          </WsCard>
          <WsCard>
            <WsSectionTitle title="Må huskes" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Rediger</Button>} />
            <Stack spacing={0.75}>
              {[['Batterier ladet', true], ['Backup kort formatert', true], ['Lydopptaker testet', false], ['Reflektor / diffuser', false], ['Ekstra linser med', false]].map(([t, ok]) => <Stack key={t} direction="row" spacing={0.75} alignItems="center"><CheckCircle sx={{ fontSize: 16, color: ok ? ws.green : ws.textFaint }} /><Typography sx={{ fontSize: 12.5 }}>{t}</Typography></Stack>)}
            </Stack>
          </WsCard>
        </Box>
      </Box>

      {/* Shot detaljer (høyre) */}
      <Box sx={{ width: 320, flexShrink: 0 }}>
        <WsCard>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Shot detaljer</Typography>
            <WsTag label="2 av 68" tone="neutral" />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><WsTag label="Kritisk" tone="red" /><Typography sx={{ fontSize: 15, fontWeight: 700, flex: 1 }}>Brud inngang</Typography><WsTag label="Vielse" tone="accent" /></Stack>
          <WsImageGrid columns={1} ratio="4 / 3" addLabel="Last opp referanse" />
          <Typography sx={{ fontSize: 12.5, color: ws.textDim, my: 1.25 }}>Bruden går ned midtgangen. Fokus på reaksjonene til brudgommen og gjestene.</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>UTSTYR & INNSTILLINGER</Typography>
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {['Foto: 85mm f/1.4', '4K 25fps', '50mm', 'Gimbal'].map((x) => <WsTag key={x} label={x} tone="neutral" />)}
          </Stack>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>SAMTALE</Typography>
          <Stack spacing={1.25} sx={{ mb: 1 }}>
            {SAMTALE.map((m, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <Avatar sx={{ width: 24, height: 24, fontSize: 10 }}>{m.who[0]}</Avatar>
                <Box sx={{ flex: 1 }}><Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{m.who}</Typography><Typography sx={{ fontSize: 10, color: ws.textFaint }}>{m.t}</Typography></Stack><Typography sx={{ fontSize: 12, color: ws.textDim }}>{m.msg}</Typography></Box>
              </Stack>
            ))}
          </Stack>
          <TextField fullWidth size="small" placeholder="Skriv en kommentar…" sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
        </WsCard>
      </Box>
    </Stack>
  );
};

export default ShotlistTab;
