// @ts-nocheck
/**
 * TeamTab — design #8 (Team), dark CreatorHub.
 * Medlemskort (rolle/ansvar/tilgang/sist aktiv) + Rolleoversikt + Teamets
 * framdrift + Nøkkelinformasjon + Godkjenninger + Team-notater. Mapper til
 * project_team_members-backend (wires i delings-fasen).
 */
import React from 'react';
import { Box, Stack, Typography, Avatar, Button, IconButton } from '@mui/material';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import MailOutline from '@mui/icons-material/MailOutline';
import Phone from '@mui/icons-material/Phone';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Lock from '@mui/icons-material/Lock';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsBar, WsTag, WsTable } from '../ui';

const MEMBERS = [
  { name: 'Thomas Qazi', role: 'Fotograf', tone: 'accent', star: true, online: true, ansvar: ['Hovedfotograf', 'Shotlist foto', 'Redigering bilder'], aktiv: 'Nå' },
  { name: 'Daniel Hansen', role: 'Videograf', tone: 'green', star: true, online: true, ansvar: ['Hovedvideograf', 'Produksjonskart', 'Drone & B-roll'], aktiv: '2 min siden' },
  { name: 'Julie Nordvik', role: 'Editor', tone: 'blue', online: true, ansvar: ['Videoredigering', 'Fargegradering', 'Leveranser'], aktiv: 'Nå' },
  { name: 'Marcus Lunde', role: 'Lydtekniker', tone: 'amber', online: true, ansvar: ['Lydopptak', 'Lydredigering', 'Mix'], aktiv: '5 min siden' },
  { name: 'Nora Berg', role: 'Assistent', tone: 'neutral', ansvar: ['Assistent foto', 'BTS & mobil', 'Utstyr & logistikk'], aktiv: '45 min siden' },
];
const ROLES = [['Fotograf', 2, ws.roleFoto], ['Videograf', 2, ws.roleVideo], ['Editor', 1, ws.blue], ['Lyd', 1, ws.roleLyd], ['Assistent', 2, ws.roleAnnet]];
const PROGRESS = [['Brief gjennomgått', 7, 8, ws.green], ['Shotlist bekreftet', 6, 8, ws.accent], ['Produksjonskart klart', 8, 8, ws.green], ['Utstyrssjekk', 5, 8, ws.amber], ['Leveranseplan bekreftet', 7, 8, ws.blue]];
const TASKS = [['Oppdater shotlist', 'Thomas', 'Gjort', 'green'], ['Bekreft drone tillatelse', 'Daniel', 'Venter', 'amber'], ['Fargeprofil godkjenning', 'Julie', 'Pågår', 'blue'], ['Utstyrssjekk', 'Nora', 'Gjort', 'green'], ['Backup lydplan', 'Marcus', 'Pågår', 'blue']];

const TeamTab: React.FC<{ projectId: string }> = () => {
  const totalRoles = ROLES.reduce((s, r) => s + r[1], 0);
  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Team <Typography component="span" sx={{ color: ws.textDim }}>{MEMBERS.length}</Typography></Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Alle teammedlemmer og roller i dette prosjektet.</Typography>
          </Box>
        </Stack>

        {/* Medlemskort */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
          {MEMBERS.map((m) => (
            <WsCard key={m.name} pad={1.75}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar sx={{ width: 46, height: 46, fontSize: 16 }}>{m.name[0]}</Avatar>
                  {m.online && <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: '50%', bgcolor: ws.green, border: `2px solid ${ws.panelSolid}` }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>{m.name}{m.star ? ' ⭐' : ''}</Typography>
                  <Box sx={{ mt: 0.25 }}><WsTag label={m.role} tone={m.tone} /></Box>
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>ANSVAR</Typography>
              <Stack spacing={0.25} sx={{ mb: 1.25 }}>
                {m.ansvar.map((a) => <Typography key={a} sx={{ fontSize: 12, color: ws.textDim }}>· {a}</Typography>)}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={0.25}>
                  <IconButton size="small" sx={{ color: ws.textDim }}><ChatBubbleOutline sx={{ fontSize: 16 }} /></IconButton>
                  <IconButton size="small" sx={{ color: ws.textDim }}><MailOutline sx={{ fontSize: 16 }} /></IconButton>
                  <IconButton size="small" sx={{ color: ws.textDim }}><Phone sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>Sist aktiv: {m.aktiv}</Typography>
              </Stack>
            </WsCard>
          ))}
          {/* Inviter-kort */}
          <Box sx={{ border: `1.5px dashed ${ws.border}`, borderRadius: `${ws.radius}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, cursor: 'pointer', color: ws.textDim, '&:hover': { borderColor: ws.accentBorder, color: ws.accent } }}>
            <PersonAdd sx={{ fontSize: 28, mb: 1 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Inviter medlem</Typography>
          </Box>
        </Box>

        {/* Rolleoversikt + Framdrift + Nøkkelinfo */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Rolleoversikt</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ position: 'relative', width: 84, height: 84 }}>
                <svg width={84} height={84} viewBox="0 0 84 84">
                  {(() => { let a = 0; const r = 34, cx = 42, cy = 42, C = 2 * Math.PI * r; return ROLES.map(([n, v, c], i) => { const frac = v / totalRoles; const dash = C * frac; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={11} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-C * (a / 360)} transform={`rotate(-90 ${cx} ${cy})`} />; a += frac * 360; return el; }); })()}
                </svg>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 18, fontWeight: 800 }}>{totalRoles}</Typography><Typography sx={{ fontSize: 9, color: ws.textDim }}>Totalt</Typography></Box>
              </Box>
              <Stack spacing={0.4} sx={{ flex: 1 }}>
                {ROLES.map(([n, v, c]) => <Stack key={n} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} /><Typography sx={{ fontSize: 11.5, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{v}</Typography></Stack>)}
              </Stack>
            </Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Teamets framdrift</Typography>
            <Stack spacing={1.1}>
              {PROGRESS.map(([t, n, d, c]) => (
                <Box key={t}>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{t}</Typography><Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{n}/{d} · {Math.round(n / d * 100)}%</Typography></Stack>
                  <WsBar value={n / d * 100} color={c} height={5} />
                </Box>
              ))}
            </Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Nøkkelinformasjon</Typography>
            <Stack spacing={1}>
              {[['Tidssone', 'CET (Oslo)'], ['Språk', 'Norsk'], ['Arbeidstider', '08:00 – 22:00'], ['Kommunikasjon', 'Chat + Notater'], ['Fildeling', 'Synkronisert'], ['Sist oppdatert', 'I dag, 10:24']].map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{v}</Typography></Stack>)}
            </Stack>
          </WsCard>
        </Box>

        {/* Godkjenninger */}
        <WsCard>
          <WsSectionTitle title="Godkjenninger & dokumenter" />
          <WsTable
            columns={['Dokument', 'Status', 'Ansvarlig', 'Oppdatert']}
            rows={[
              ['Kontrakt', <WsTag label="Godkjent" tone="green" />, 'Sara & Amir', '28. aug 2024'],
              ['Shotlist', <WsTag label="Godkjent" tone="green" />, 'Thomas Qazi', '01. sep 2024'],
              ['Produksjonskart', <WsTag label="Godkjent" tone="green" />, 'Daniel Hansen', '05. sep 2024'],
              ['Leveranseplan', <WsTag label="Venter på godkjenning" tone="amber" />, 'Julie Nordvik', '–'],
              ['Location tillatelse (Drone)', <WsTag label="Venter på godkjenning" tone="amber" />, 'Daniel Hansen', '–'],
            ]}
          />
        </WsCard>
      </Box>

      {/* Høyre: Chat + Oppgaver + Milepæler */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title="Oppgaver" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
          <Stack spacing={1}>
            {TASKS.map(([t, who, st, tone]) => (
              <Stack key={t} direction="row" alignItems="center" spacing={1}><Box sx={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${ws.textFaint}` }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{t}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{who}</Typography><WsTag label={st} tone={tone} /></Stack>
            ))}
          </Stack>
        </WsCard>
        <WsCard>
          <WsSectionTitle title="Kommende milepæler" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
          <Stack spacing={1.25}>
            {[['12', 'SEP', 'Location scout', 'Torsdag 12. sep 10:00'], ['14', 'SEP', 'Produksjonsdag', 'Lørdag 14. sep 09:00'], ['21', 'SEP', 'Teaser levering', 'Lørdag 21. sep 18:00']].map(([d, mo, t, sub]) => (
              <Stack key={t} direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ width: 40, textAlign: 'center', bgcolor: ws.accentSoft, borderRadius: 1.5, py: 0.5 }}><Typography sx={{ fontSize: 15, fontWeight: 800, color: ws.accent, lineHeight: 1 }}>{d}</Typography><Typography sx={{ fontSize: 9, color: ws.accent }}>{mo}</Typography></Box>
                <Box><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{t}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{sub}</Typography></Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>
      </Box>
    </Stack>
  );
};

export default TeamTab;
