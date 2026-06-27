// @ts-nocheck
/**
 * ProduksjonskartTab — design #3 (Production Map), dark CreatorHub.
 * Dagens fokus / Crew / Vær / Team Sync + tid-for-tid-tabell (Foto/Video/Lyd)
 * + Live koordinering (høyre) + Kritiske øyeblikk / Referanser.
 */
import React, { useState } from 'react';
import { Box, Stack, Typography, Avatar, AvatarGroup, IconButton, Button, TextField } from '@mui/material';
import Groups from '@mui/icons-material/Groups';
import Cloud from '@mui/icons-material/Cloud';
import Sync from '@mui/icons-material/Sync';
import CenterFocusStrong from '@mui/icons-material/CenterFocusStrong';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import Tune from '@mui/icons-material/Tune';
import CheckCircle from '@mui/icons-material/CheckCircle';
import NotificationsActive from '@mui/icons-material/NotificationsActive';
import Send from '@mui/icons-material/Send';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsRing, WsPills, WsTag, WsTable, WsImageGrid } from '../ui';

const ROWS = [
  { tid: '08:00 – 10:00', moment: 'Forberedelser', sub: 'Brud & brudgom', foto: ['Detaljer', 'Getting Ready'], video: ['A-cam', 'B-roll'], lyd: ['Lav mic', 'Room tone'], ansvarlig: 'Daniel (Foto)', status: ['Ferdig', 'green'], notat: 'Brud hjemme · Backm på hotell' },
  { tid: '10:30 – 11:00', moment: 'First look', sub: 'Parportretter', foto: ['Portretter', 'Detaljer'], video: ['A-cam', 'Slow motion'], lyd: ['Lav mic'], ansvarlig: 'Emma (Video)', status: ['Ferdig', 'green'], notat: 'Intimt øyeblikk · Privat location' },
  { tid: '12:15 – 13:00', moment: 'Vielse', sub: 'Seremoni', foto: ['Seremoni', 'Reaksjoner'], video: ['A-cam', 'B-cam'], lyd: ['Lav mic', 'Backup rec'], ansvarlig: 'Daniel (Foto)', status: ['Kritisk', 'red'], notat: 'Kirken · Lyd sjekk 11:30', active: true },
  { tid: '13:00 – 13:45', moment: 'Familiebilder', sub: 'Gruppebilder', foto: ['Gruppebilder', 'Portretter'], video: ['B-roll', 'Oversikter'], lyd: ['Lav mic'], ansvarlig: 'Lukas (Editor)', status: ['Pågår', 'amber'], notat: 'Storfamilie · Effektiv flyt' },
  { tid: '16:30 – 17:30', moment: 'Golden hour', sub: 'Parportretter', foto: ['Portretter', 'Kreative shots'], video: ['Cinematics', 'B-roll'], lyd: ['Lav mic', 'Vindbeskyttelse'], ansvarlig: 'Emma (Video)', status: ['Planlagt', 'blue'], notat: 'Golden hour flyttet til 18:15' },
  { tid: '19:30 – 20:45', moment: 'Taler', sub: 'Toast & taler', foto: ['Taler', 'Reaksjoner'], video: ['A-cam', 'B-cam'], lyd: ['Lav mic', 'Backup rec'], ansvarlig: 'Daniel (Foto)', status: ['Planlagt', 'blue'], notat: '3 taler bekreftet' },
];

const UPDATES = [
  { who: 'Marcus (Lyd)', t: '10:12', msg: 'Groom mic sjekket og klar. Backup recorder testet.' },
  { who: 'Daniel (Foto)', t: '10:14', msg: 'Objektiver klare. Har med 85mm & 35mm.' },
  { who: 'Emma (Video)', t: '10:15', msg: 'Batterier byttet på begge kameraer.' },
  { who: 'Lukas (Editor)', t: '10:16', msg: 'SSD-er formatert og klare for backup.' },
];
const ALERTS = [
  { tone: 'red', title: 'Drone permit godkjent', t: '10:05', sub: 'Gyldig til 22:00 i dag.' },
  { tone: 'amber', title: 'Golden hour flyttet', t: '10:10', sub: 'Ny tid 18:15 pga. skyer.' },
  { tone: 'blue', title: 'Transport til location 2', t: '09:50', sub: 'Avreise 15:30 fra kirken.' },
];

const ProduksjonskartTab: React.FC<{ projectId: string }> = () => {
  const [view, setView] = useState('timeline');
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 800, mb: 2 }}>Production Map</Typography>

        {/* Topp-kort */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><CenterFocusStrong sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Dagens fokus</Typography></Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box><Typography sx={{ fontSize: 16, fontWeight: 800 }}>Vielse</Typography><Typography sx={{ fontSize: 12, color: ws.textDim }}>12:15 – 13:00</Typography><Box sx={{ mt: 0.5 }}><WsTag label="Kritisk moment" tone="accent" /></Box></Box>
              <Box sx={{ width: 64, ml: 'auto' }}><WsImageGrid columns={1} ratio="4 / 3" addLabel="Bilde" /></Box>
            </Stack>
          </WsCard>
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Groups sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Crew på location</Typography></Stack>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>6 <Typography component="span" sx={{ fontSize: 14, color: ws.textDim }}>/ 8</Typography></Typography>
            <Typography sx={{ fontSize: 11.5, color: ws.textDim, mb: 1 }}>teammedlemmer</Typography>
            <AvatarGroup max={5} sx={{ justifyContent: 'flex-start', '& .MuiAvatar-root': { width: 24, height: 24, fontSize: 10, border: `2px solid ${ws.panelSolid}` } }}>
              {['M', 'D', 'E', 'L', 'N'].map((x, i) => <Avatar key={i}>{x}</Avatar>)}
            </AvatarGroup>
          </WsCard>
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Cloud sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Vær & logistikk</Typography></Stack>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>17 °C</Typography>
            <Typography sx={{ fontSize: 12, color: ws.textDim }}>Delvis skyet</Typography>
            <Typography sx={{ fontSize: 11.5, color: ws.textFaint, mt: 0.5 }}>☀ Solnedgang 21:42</Typography>
          </WsCard>
          <WsCard pad={1.75}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><Sync sx={{ fontSize: 18, color: ws.accent }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Team Sync</Typography></Stack>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <WsRing value={82} size={70} thickness={8} label="82%" />
              <Box><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Synkronisert</Typography><Typography sx={{ fontSize: 11, color: ws.textDim }}>Sist oppdatert 10:14</Typography></Box>
            </Stack>
          </WsCard>
        </Box>

        {/* Tabell-kort */}
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <WsPills items={[{ key: 'timeline', label: 'Timeline' }, { key: 'board', label: 'Board' }, { key: 'kart', label: 'Kart' }]} value={view} onChange={setView} />
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" sx={{ color: ws.textDim }}><ChevronLeft fontSize="small" /></IconButton>
              <Typography sx={{ fontSize: 13, color: ws.text }}>Lørdag 24. mai 2025</Typography>
              <IconButton size="small" sx={{ color: ws.textDim }}><ChevronRight fontSize="small" /></IconButton>
              <Button size="small" startIcon={<Tune sx={{ fontSize: 15 }} />} sx={{ color: ws.textDim, textTransform: 'none' }}>Filtre</Button>
            </Stack>
          </Stack>
          <WsTable
            columns={['Tid', 'Moment', 'Foto', 'Video', 'Lyd', 'Ansvarlig', 'Status', 'Notater']}
            rows={ROWS.map((r) => [
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{r.active && <Box sx={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: `6px solid ${ws.accent}` }} />}<Typography sx={{ fontSize: 12.5, fontWeight: r.active ? 800 : 600, color: r.active ? ws.accent : ws.text }}>{r.tid}</Typography></Box>,
              <Box><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{r.moment}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{r.sub}</Typography></Box>,
              <Stack spacing={0.25}>{r.foto.map((x) => <WsTag key={x} label={x} tone="accent" />)}</Stack>,
              <Stack spacing={0.25}>{r.video.map((x) => <WsTag key={x} label={x} tone="blue" />)}</Stack>,
              <Stack spacing={0.25}>{r.lyd.map((x) => <WsTag key={x} label={x} tone="amber" />)}</Stack>,
              <Stack direction="row" spacing={0.5} alignItems="center"><Avatar sx={{ width: 22, height: 22, fontSize: 10 }}>{r.ansvarlig[0]}</Avatar><Typography sx={{ fontSize: 12 }}>{r.ansvarlig}</Typography></Stack>,
              <WsTag label={r.status[0]} tone={r.status[1]} />,
              <Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{r.notat}</Typography>,
            ])}
          />
        </WsCard>

        {/* Bunn: Kritiske øyeblikk + Referanser */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <WsCard>
            <WsSectionTitle title="Kritiske øyeblikk" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <Stack spacing={1}>
              {[['12:15', 'Vielse', 'Kritisk', 'red'], ['16:30', 'Golden hour', 'Høy', 'amber'], ['20:15', 'Første dans', 'Høy', 'amber']].map(([t, m, lvl, tone]) => (
                <Stack key={t} direction="row" spacing={1} alignItems="center"><Typography sx={{ fontSize: 12, color: ws.textDim, width: 44 }}>{t}</Typography><Typography sx={{ fontSize: 13, flex: 1 }}>{m}</Typography><WsTag label={lvl} tone={tone} /></Stack>
              ))}
            </Stack>
          </WsCard>
          <WsCard>
            <WsSectionTitle title="Referanser & shots" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={4} addLabel="Legg til" />
          </WsCard>
        </Box>
      </Box>

      {/* Live koordinering (høyre) */}
      <Box sx={{ width: 320, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Live koordinering</Typography>
            <Stack direction="row" spacing={0.5} alignItems="center"><Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: ws.green }} /><Typography sx={{ fontSize: 11, color: ws.green }}>Live</Typography></Stack>
          </Stack>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 1 }}>TEAM UPDATES</Typography>
          <Stack spacing={1.5}>
            {UPDATES.map((u, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <Avatar sx={{ width: 28, height: 28, fontSize: 11 }}>{u.who[0]}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="baseline"><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{u.who}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{u.t}</Typography><CheckCircle sx={{ fontSize: 13, color: ws.green, ml: 'auto' }} /></Stack>
                  <Typography sx={{ fontSize: 12, color: ws.textDim }}>{u.msg}</Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}><NotificationsActive sx={{ fontSize: 17, color: ws.amber }} /><Typography sx={{ fontSize: 14, fontWeight: 700 }}>Varsler & viktige notater</Typography></Stack>
          <Stack spacing={1.25}>
            {ALERTS.map((a, i) => (
              <Stack key={i} direction="row" spacing={1}>
                <Box sx={{ width: 6, borderRadius: 3, bgcolor: ws[a.tone] }} />
                <Box sx={{ flex: 1 }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{a.title}</Typography><Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{a.t}</Typography></Stack><Typography sx={{ fontSize: 11.5, color: ws.textDim }}>{a.sub}</Typography></Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>

        <WsCard>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>Hurtignotat</Typography>
          <TextField fullWidth size="small" multiline minRows={2} placeholder="Skriv en rask notat…" sx={{ '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button size="small" variant="contained" startIcon={<Send sx={{ fontSize: 15 }} />} sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>Legg til</Button>
          </Stack>
        </WsCard>
      </Box>
    </Stack>
  );
};

export default ProduksjonskartTab;
