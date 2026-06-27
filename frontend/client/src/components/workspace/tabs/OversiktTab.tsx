// @ts-nocheck
/**
 * OversiktTab — workspace-forsiden (design #1), dark CreatorHub.
 * Dagens tidslinje + Samkjøringsboard + Team Sync / Sjekkliste / Referanser
 * + Team Chat (høyre). Bruker prøvedata nå; wires mot ekte backend i wire-fasen.
 */
import React from 'react';
import { Box, Stack, Typography, Avatar, IconButton, Button, Chip } from '@mui/material';
import AccessTime from '@mui/icons-material/AccessTime';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import ViewKanban from '@mui/icons-material/ViewKanban';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import Warning from '@mui/icons-material/Warning';
import Add from '@mui/icons-material/Add';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsRing, WsBar, WsImageGrid } from '../ui';
import WorkspaceChatPanel from '../WorkspaceChatPanel';

const PHASES = [
  { icon: '🤍', label: 'Forberedelser', time: '08:00 – 10:00', color: ws.textDim },
  { icon: '💗', label: 'First look', time: '10:30 – 11:00', color: ws.red },
  { icon: '⛪', label: 'Vielse', time: '11:30 – 12:30', color: ws.accent, active: true },
  { icon: '🌅', label: 'Golden hour', time: '16:30 – 17:30', color: ws.amber },
  { icon: '🎙️', label: 'Taler', time: '19:00 – 20:00', color: ws.blue },
  { icon: '🎉', label: 'Fest', time: '20:30 – 00:00', color: ws.green },
];

const BOARD = [
  { role: 'Fotograf (Daniel)', icon: '📷', tasks: [
    { t: 'Detaljer: ringer & tilbehør', time: '07:30 – 08:00', done: true },
    { t: 'Forberedelser – candids', time: '08:00 – 10:00', done: true },
    { t: 'Portretter av brud & brudgom', time: '10:00 – 10:30', done: false },
    { t: 'Close-ups av ringer', time: '11:20 – 11:30', done: false },
  ]},
  { role: 'Videograf (Emma)', icon: '🎥', tasks: [
    { t: 'Etableringsbilder + lydsjekk', time: '07:30 – 08:30', done: true },
    { t: 'Forberedelser – video', time: '08:00 – 10:00', done: true },
    { t: 'First look – video', time: '10:30 – 11:00', done: false },
    { t: 'Vielse – flere vinkler', time: '11:30 – 12:30', done: false },
  ]},
  { role: 'Begge', icon: '👥', tasks: [
    { t: 'First look – reaksjoner', time: '10:30 – 11:00', done: true },
    { t: 'Vielse: inngang & første kyss', time: '11:30 – 12:30', done: false },
    { t: 'Gruppebilder familie', time: '13:00 – 13:45', done: false },
    { t: 'Golden hour – parbilder', time: '16:30 – 17:30', done: false },
  ]},
  { role: 'Editor (Lukas)', icon: '🎬', tasks: [
    { t: 'Råmateriale backup', time: 'Løpende', done: true },
    { t: 'Marker sterke øyeblikk', time: 'Løpende', done: false },
    { t: 'Highlight-klipp (2–3 min)', time: 'Etter festen', done: false },
    { t: 'Langfilm (20–30 min)', time: 'Levering', done: false },
  ]},
];

const SYNC_ITEMS = ['Brief lest', 'Lydplan', 'Backup plan', 'Kundeønsker gjennomgått'];
const CHECKLIST = [
  { t: 'Utstyr sjekket', ok: true },
  { t: 'Batterier & minnekort', ok: true },
  { t: 'Værmelding', ok: false },
  { t: 'Transport & parkering', ok: true },
  { t: 'Backup lokasjon', ok: false },
];

const RULER = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

const OversiktTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'stretch' }}>
      {/* ───────── Hovedkolonne ───────── */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Fremdrift */}
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 13, color: ws.textDim }}>Fremdrift</Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 800, color: ws.accent }}>68 %</Typography>
          <Box sx={{ flex: 1, maxWidth: 360 }}><WsBar value={68} /></Box>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>14 av 21 oppgaver fullført</Typography>
        </Stack>

        {/* Dagens tidslinje */}
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle
            icon={<AccessTime sx={{ fontSize: 18, color: ws.textDim }} />}
            title="Dagens tidslinje"
            action={
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button size="small" sx={{ color: ws.text, textTransform: 'none', minWidth: 0 }}>I dag</Button>
                <IconButton size="small" sx={{ color: ws.textDim }}><ChevronLeft fontSize="small" /></IconButton>
                <IconButton size="small" sx={{ color: ws.textDim }}><ChevronRight fontSize="small" /></IconButton>
              </Stack>
            }
          />
          {/* Ruler */}
          <Box sx={{ position: 'relative', mb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" sx={{ px: 0.5 }}>
              {RULER.map((t) => <Typography key={t} sx={{ fontSize: 11, color: ws.textFaint }}>{t}</Typography>)}
            </Stack>
            <Box sx={{ position: 'relative', height: 1, bgcolor: ws.border, mt: 0.5 }}>
              {/* now-marker ~12:15 → ((12.25-8)/14)*100 ≈ 30.4% */}
              <Box sx={{ position: 'absolute', left: '30.4%', top: -18, transform: 'translateX(-50%)' }}>
                <Chip size="small" label="12:15" sx={{ height: 18, bgcolor: ws.accent, color: ws.accentContrast, fontWeight: 800, fontSize: 11 }} />
                <Box sx={{ width: 1, height: 60, bgcolor: ws.accent, mx: 'auto', mt: 0.5, opacity: 0.6 }} />
              </Box>
            </Box>
          </Box>
          {/* Faser */}
          <Stack direction="row" spacing={1.25} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {PHASES.map((p) => (
              <Box key={p.label} sx={{
                minWidth: 150, p: 1.25, borderRadius: `${ws.radiusSm}px`,
                bgcolor: p.active ? ws.accentSoft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${p.active ? ws.accentBorder : ws.borderSoft}`,
              }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography sx={{ fontSize: 16 }}>{p.icon}</Typography>
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{p.label}</Typography>
                </Stack>
                <Typography sx={{ fontSize: 11.5, color: ws.textDim, mt: 0.5 }}>{p.time}</Typography>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Samkjøringsboard */}
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle icon={<ViewKanban sx={{ fontSize: 18, color: ws.textDim }} />} title="Samkjøringsboard" />
          <Stack direction="row" spacing={1.5} sx={{ overflowX: 'auto' }}>
            {BOARD.map((col) => (
              <Box key={col.role} sx={{ minWidth: 220, flex: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 14 }}>{col.icon}</Typography>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: ws.textDim }}>{col.role}</Typography>
                </Stack>
                <Stack spacing={1}>
                  {col.tasks.map((task, i) => (
                    <Box key={i} sx={{
                      p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${ws.borderSoft}`,
                    }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: ws.text }}>{task.t}</Typography>
                          <Typography sx={{ fontSize: 11, color: ws.textFaint, mt: 0.25 }}>{task.time}</Typography>
                        </Box>
                        {task.done
                          ? <CheckCircle sx={{ fontSize: 18, color: ws.green }} />
                          : <RadioButtonUnchecked sx={{ fontSize: 18, color: ws.textFaint }} />}
                      </Stack>
                    </Box>
                  ))}
                  <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} sx={{ color: ws.textDim, textTransform: 'none', justifyContent: 'flex-start' }}>
                    Legg til oppgave
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Bunn-rad: Team Sync / Sjekkliste / Referanser */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Samkjøring (Team Sync)</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <WsRing value={82} size={104} label="82%" sub="Klar" />
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                {SYNC_ITEMS.map((s) => (
                  <Stack key={s} direction="row" spacing={0.75} alignItems="center">
                    <CheckCircle sx={{ fontSize: 16, color: ws.green }} />
                    <Typography sx={{ fontSize: 12.5, color: ws.text }}>{s}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
            <Button fullWidth size="small" sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>Se detaljer</Button>
          </WsCard>

          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Sjekkliste</Typography>
            <Stack spacing={1}>
              {CHECKLIST.map((c) => (
                <Stack key={c.t} direction="row" spacing={0.75} alignItems="center">
                  {c.ok ? <CheckCircle sx={{ fontSize: 17, color: ws.green }} /> : <Warning sx={{ fontSize: 17, color: ws.amber }} />}
                  <Typography sx={{ fontSize: 12.5, color: ws.text }}>{c.t}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button fullWidth size="small" sx={{ mt: 1.5, color: ws.textDim, textTransform: 'none', border: `1px solid ${ws.border}` }}>Se alle</Button>
          </WsCard>

          <WsCard>
            <WsSectionTitle title="Referanser & shots" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
            <WsImageGrid columns={3} addLabel="Legg til referanse" />
          </WsCard>
        </Box>
      </Box>

      {/* ───────── Team Chat (høyre) ───────── */}
      <Box sx={{ width: 340, flexShrink: 0 }}>
        <WorkspaceChatPanel projectId={projectId} />
      </Box>
    </Stack>
  );
};

export default OversiktTab;
