// @ts-nocheck
/**
 * TeamTab — design #8 (Team), dark CreatorHub.
 * Medlemskort (rolle/ansvar/tilgang/sist aktiv) + Rolleoversikt + Teamets
 * framdrift + Nøkkelinformasjon + Godkjenninger. Ekte prosjekter er wiret mot
 * project_team_members / team-sync / contract / quotes / deliverables /
 * split-sheet; /workspace/sample viser demo-data.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Avatar, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress } from '@mui/material';
import { useLocation } from 'wouter';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import MailOutline from '@mui/icons-material/MailOutline';
import Phone from '@mui/icons-material/Phone';
import PersonAdd from '@mui/icons-material/PersonAdd';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsBar, WsTag, WsTable } from '../ui';
import WorkspaceSplitSheet from '../WorkspaceSplitSheet';
import { useWsLocale, makeT, wsDateLocale, type WsDict } from '../wsLocale';
import { CREW_ROLE_CATALOG, crewRoleDef } from '@shared/crew-roles';
import { crewIcon } from '../crewIcons';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab). Dynamiske
// strenger (roller/status lagret i state) er selv-nøklet på norsk, slik at
// state forblir norsk (stabile nøkler for ROLE_COLORS m.m.) og oversettes
// først ved render.
const T: WsDict = {
  subtitle: { no: 'Alle teammedlemmer og roller i dette prosjektet.', en: 'All team members and roles in this project.' },
  respHeading: { no: 'ANSVAR', en: 'RESPONSIBILITIES' },
  lastActive: { no: 'Sist aktiv:', en: 'Last active:' },
  inviteMember: { no: 'Inviter medlem', en: 'Invite member' },
  roleOverview: { no: 'Rolleoversikt', en: 'Role overview' },
  total: { no: 'Totalt', en: 'Total' },
  teamProgress: { no: 'Teamets framdrift', en: 'Team progress' },
  noProgress: { no: 'Ingen framdriftsdata ennå — legg til oppgaver og sjekkpunkter.', en: 'No progress data yet — add tasks and checkpoints.' },
  keyInfo: { no: 'Nøkkelinformasjon', en: 'Key information' },
  'Tidssone': { no: 'Tidssone', en: 'Time zone' },
  'Språk': { no: 'Språk', en: 'Language' },
  'Norsk': { no: 'Norsk', en: 'Norwegian' },
  'Arbeidstider': { no: 'Arbeidstider', en: 'Working hours' },
  'Kommunikasjon': { no: 'Kommunikasjon', en: 'Communication' },
  'Chat + Notater': { no: 'Chat + Notater', en: 'Chat + Notes' },
  'Fildeling': { no: 'Fildeling', en: 'File sharing' },
  'Synkronisert': { no: 'Synkronisert', en: 'Synced' },
  'Sist oppdatert': { no: 'Sist oppdatert', en: 'Last updated' },
  approvalsTitle: { no: 'Godkjenninger & dokumenter', en: 'Approvals & documents' },
  'Dokument': { no: 'Dokument', en: 'Document' },
  'Ansvarlig': { no: 'Ansvarlig', en: 'Responsible' },
  'Oppdatert': { no: 'Oppdatert', en: 'Updated' },
  'Kontrakt': { no: 'Kontrakt', en: 'Contract' },
  'Signert': { no: 'Signert', en: 'Signed' },
  'Venter på signering': { no: 'Venter på signering', en: 'Awaiting signature' },
  quoteWord: { no: 'Tilbud', en: 'Quote' },
  'Akseptert': { no: 'Akseptert', en: 'Accepted' },
  'Avslått': { no: 'Avslått', en: 'Declined' },
  'Sendt': { no: 'Sendt', en: 'Sent' },
  'Utkast': { no: 'Utkast', en: 'Draft' },
  'Leveranseplan': { no: 'Leveranseplan', en: 'Delivery plan' },
  'Levert': { no: 'Levert', en: 'Delivered' },
  deliveredOf: { no: '{n} av {d} levert', en: '{n} of {d} delivered' },
  completePct: { no: 'Komplett (100 %)', en: 'Complete (100 %)' },
  incompletePct: { no: 'Ufullstendig ({n} %)', en: 'Incomplete ({n} %)' },
  participants: { no: 'deltakere', en: 'participants' },
  tasksTitle: { no: 'Oppgaver', en: 'Tasks' },
  seeAll: { no: 'Se alle', en: 'See all' },
  milestonesTitle: { no: 'Kommende milepæler', en: 'Upcoming milestones' },
  // Roller (CREW_ROLES-labels m.fl. — value-nøklene til API-et røres ikke)
  'Fotograf': { no: 'Fotograf', en: 'Photographer' },
  'Videograf': { no: 'Videograf', en: 'Videographer' },
  'Lydtekniker': { no: 'Lydtekniker', en: 'Sound engineer' },
  'Foto + Video': { no: 'Foto + Video', en: 'Photo + Video' },
  'Assistent': { no: 'Assistent', en: 'Assistant' },
  'Eier': { no: 'Eier', en: 'Owner' },
  'Medlem': { no: 'Medlem', en: 'Member' },
  'Lyd': { no: 'Lyd', en: 'Sound' },
  // Medlems-strenger lagret i state (norsk) — oversettes ved render
  'Prosjekteier': { no: 'Prosjekteier', en: 'Project owner' },
  'Lesetilgang': { no: 'Lesetilgang', en: 'View access' },
  'Redigeringstilgang': { no: 'Redigeringstilgang', en: 'Edit access' },
  'Nå': { no: 'Nå', en: 'Now' },
  'Aktiv': { no: 'Aktiv', en: 'Active' },
  'Venter på aksept': { no: 'Venter på aksept', en: 'Awaiting acceptance' },
  'Gjort': { no: 'Gjort', en: 'Done' },
  'Pågår': { no: 'Pågår', en: 'In progress' },
  'Venter': { no: 'Venter', en: 'Waiting' },
  // Inviter-dialog
  emailRequired: { no: 'E-post påkrevd', en: 'Email required' },
  inviteFailed: { no: 'Invitering feilet', en: 'Invitation failed' },
  inviteTitle: { no: 'Inviter teammedlem', en: 'Invite team member' },
  inviteInfo: {
    no: 'Medlemmet får e-post med lenke til workspacet. Profesjonen styrer hvilke verktøy de får (videograf → videograf-funksjoner).',
    en: 'The member receives an email with a link to the workspace. The profession determines which tools they get (videographer → videographer features).',
  },
  nameLabel: { no: 'Navn', en: 'Name' },
  emailLabel: { no: 'E-post', en: 'Email' },
  teamRoleLabel: { no: 'Rolle i teamet', en: 'Role in the team' },
  accessLabel: { no: 'Tilgang', en: 'Access' },
  canEdit: { no: 'Kan redigere', en: 'Can edit' },
  viewOnly: { no: 'Kun lese', en: 'View only' },
  cancel: { no: 'Avbryt', en: 'Cancel' },
  sending: { no: 'Sender…', en: 'Sending…' },
  sendInvite: { no: 'Send invitasjon', en: 'Send invitation' },
};

// Crew-roller kommer fra den delte katalogen (crew-roles.ts) — invite-dialogen
// tilbyr HELE katalogen så blandede team (foto + musikkprodusent på samme
// event) kan inviteres med riktig rolle. Ukjente nøkler får generisk visning.
const crewTone = (c: string) => crewRoleDef(c).tone;
const crewLabel = (c: string) => crewRoleDef(c).label;

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

const TeamTab: React.FC<{ projectId: string; profession?: string; userId?: string; projectName?: string; lastUpdated?: string | null }> = ({ projectId, profession, userId, projectName, lastUpdated }) => {
  // Utenlandske partner-vendors får engelsk — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [, navigate] = useLocation();
  const totalRoles = ROLES.reduce((s, r) => s + r[1], 0);
  const [real, setReal] = useState<any[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [boardTasks, setBoardTasks] = useState<any[] | null>(null);
  const [milestones, setMilestones] = useState<any[] | null>(null);
  const [teamSync, setTeamSync] = useState<any | null>(null);
  const [contract, setContract] = useState<any | null>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [splitShares, setSplitShares] = useState<{ shares: any[]; total: number } | null>(null);
  const isRealP = projectId && projectId !== 'sample';
  useEffect(() => {
    if (!isRealP) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`).then((r: any) => setBoardTasks(Array.isArray(r?.tasks) ? r.tasks : [])).catch(() => {});
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}/milestones`).then((r: any) => setMilestones(Array.isArray(r?.milestones) ? r.milestones : [])).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team-sync`).then((r: any) => setTeamSync(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/contract`).then((r: any) => setContract(r || null)).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/quotes`).then((r: any) => setQuotes(Array.isArray(r?.quotes) ? r.quotes : [])).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/deliverables`).then((r: any) => setDeliverables(Array.isArray(r?.deliverables) ? r.deliverables : [])).catch(() => {});
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/split-sheet`).then((r: any) => setSplitShares(r && Array.isArray(r.shares) ? r : null)).catch(() => {});
  }, [projectId, isRealP]);

  const load = async () => {
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`);
      setIsOwner(!!r?.isOwner);
      const list = Array.isArray(r?.members) ? r.members : [];
      // Inkluder eier øverst hvis vi har den
      const owner = r?.owner ? [{ name: r.owner.name, role: 'Eier', tone: 'accent', online: true, ansvar: ['Prosjekteier'], aktiv: 'Nå', star: true }] : [];
      const mapped = list.filter((m: any) => m.status !== 'revoked').map((m: any) => ({
        name: m.name || m.email, role: crewLabel(m.crewRole), roleKey: m.crewRole || null, tone: crewTone(m.crewRole),
        online: m.status === 'active', ansvar: [m.role === 'viewer' ? 'Lesetilgang' : 'Redigeringstilgang', m.email],
        aktiv: m.status === 'active' ? 'Aktiv' : 'Venter på aksept',
      }));
      const combined = [...owner, ...mapped];
      setReal(combined.length > 0 ? combined : null); // tom → behold sample-demo
    } catch { setReal(null); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  // Ekte prosjekt → ekte data (tomt = tom-tilstand). Mock kun på /workspace/sample.
  const displayMembers = isRealP ? (real || []) : MEMBERS;

  // Oppgaver (høyre) fra ekte board-tasks.
  const taskList = isRealP
    ? (boardTasks || []).slice(0, 6).map((bt) => [bt.title, '', bt.status === 'done' ? t('Gjort') : bt.status === 'in_progress' ? t('Pågår') : t('Venter'), bt.status === 'done' ? 'green' : bt.status === 'in_progress' ? 'blue' : 'amber'])
    : TASKS;
  // Kommende milepæler fra ekte milestones.
  const MO = locale === 'en'
    ? ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    : ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'];
  const upcoming = (milestones || []).filter((m: any) => { const d = m.dueDate || m.scheduledDate; return d && new Date(d) >= new Date(Date.now() - 864e5); }).slice(0, 3);
  const msList = isRealP
    ? upcoming.map((m: any) => { const d = new Date(m.dueDate || m.scheduledDate); return [String(d.getDate()), MO[d.getMonth()], m.title, d.toLocaleDateString(wsDateLocale(locale), { weekday: 'long', day: 'numeric', month: 'short' })]; })
    : [['12', 'SEP', 'Location scout', 'Torsdag 12. sep 10:00'], ['14', 'SEP', 'Produksjonsdag', 'Lørdag 14. sep 09:00'], ['21', 'SEP', 'Teaser levering', 'Lørdag 21. sep 18:00']];

  // Rolleoversikt fra ekte medlemmer.
  const ROLE_COLORS: Record<string, string> = { Fotograf: ws.roleFoto, Eier: ws.roleFoto, Videograf: ws.roleVideo, Editor: ws.blue, Lydtekniker: ws.roleLyd, Lyd: ws.roleLyd, Assistent: ws.roleAnnet };
  const roleCounts: Record<string, number> = {};
  displayMembers.forEach((m: any) => { const k = m.role || 'Medlem'; roleCounts[k] = (roleCounts[k] || 0) + 1; });
  const teamRoles = isRealP ? Object.entries(roleCounts).map(([n, v]) => [n, v, ROLE_COLORS[n] || ws.roleAnnet]) : ROLES;
  const teamTotalRoles = isRealP ? displayMembers.length : totalRoles;

  // Teamets framdrift — ekte readiness fra team-sync (verdi «n/d»); demo kun på sample.
  const parseFrac = (v: any) => { const m = /^(\d+)\s*\/\s*(\d+)$/.exec(String(v || '')); return m && Number(m[2]) > 0 ? [Number(m[1]), Number(m[2])] : null; };
  const progressRows = isRealP
    ? (Array.isArray(teamSync?.readiness) ? teamSync.readiness : []).map((x: any) => {
        const [n, d] = parseFrac(x.value) || [x.done ? 1 : 0, 1];
        return [x.label, n, d, x.done ? ws.green : ws.amber];
      })
    : PROGRESS;

  // Godkjenninger & dokumenter — ekte kontrakt/tilbud/leveranser/split-sheet; demo kun på sample.
  const fmtDate = (d: any) => { if (!d) return '–'; const t = new Date(d); return Number.isFinite(t.getTime()) ? t.toLocaleDateString(wsDateLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; };
  const deliveredCount = deliverables.filter((d: any) => d.status === 'delivered' || d.status === 'done').length;
  const splitTotal = splitShares ? Math.round(splitShares.total) : 0;
  const approvalRows = isRealP
    ? [
        ...(contract?.hasContract ? [[
          t('Kontrakt'),
          <WsTag label={contract.isSigned ? t('Signert') : t('Venter på signering')} tone={contract.isSigned ? 'green' : 'amber'} />,
          contract.signerName || contract.clientName || '–',
          fmtDate(contract.signedAt),
        ]] : []),
        ...quotes.slice(0, 3).map((q: any) => [
          q.title || `${t('quoteWord')} ${q.quoteNumber || ''}`.trim(),
          <WsTag
            label={q.status === 'accepted' ? t('Akseptert') : q.status === 'declined' ? t('Avslått') : q.status === 'sent' ? t('Sendt') : t('Utkast')}
            tone={q.status === 'accepted' ? 'green' : q.status === 'declined' ? 'red' : q.status === 'sent' ? 'amber' : 'neutral'}
          />,
          q.clientName || '–',
          fmtDate(q.createdAt),
        ]),
        ...(deliverables.length ? [[
          t('Leveranseplan'),
          <WsTag label={deliveredCount === deliverables.length ? t('Levert') : t('deliveredOf').replace('{n}', String(deliveredCount)).replace('{d}', String(deliverables.length))} tone={deliveredCount === deliverables.length ? 'green' : 'amber'} />,
          '–',
          '–',
        ]] : []),
        ...(splitShares && splitShares.shares.length ? [[
          'Split sheet',
          <WsTag label={splitTotal === 100 ? t('completePct') : t('incompletePct').replace('{n}', String(splitTotal))} tone={splitTotal === 100 ? 'green' : 'amber'} />,
          `${splitShares.shares.length} ${t('participants')}`,
          '–',
        ]] : []),
      ]
    : [
        ['Kontrakt', <WsTag label="Godkjent" tone="green" />, 'Sara & Amir', '28. aug 2024'],
        ['Shotlist', <WsTag label="Godkjent" tone="green" />, 'Thomas Qazi', '01. sep 2024'],
        ['Produksjonskart', <WsTag label="Godkjent" tone="green" />, 'Daniel Hansen', '05. sep 2024'],
        ['Leveranseplan', <WsTag label="Venter på godkjenning" tone="amber" />, 'Julie Nordvik', '–'],
        ['Location tillatelse (Drone)', <WsTag label="Venter på godkjenning" tone="amber" />, 'Daniel Hansen', '–'],
      ];

  // Nøkkelinformasjon — «Sist oppdatert» fra prosjektet (skjules uten data på ekte prosjekter).
  const keyInfo = [
    [t('Tidssone'), 'CET (Oslo)'], [t('Språk'), t('Norsk')], [t('Arbeidstider'), '08:00 – 22:00'],
    [t('Kommunikasjon'), t('Chat + Notater')], [t('Fildeling'), t('Synkronisert')],
    ...(isRealP ? (lastUpdated ? [[t('Sist oppdatert'), fmtDate(lastUpdated)]] : []) : [[t('Sist oppdatert'), 'I dag, 10:24']]),
  ];

  return (
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Team <Typography component="span" sx={{ color: ws.textDim }}>{displayMembers.length}</Typography></Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subtitle')}</Typography>
          </Box>
        </Stack>

        {/* Medlemskort */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(3, 1fr)' }, gap: 1.5, mb: 2 }}>
          {displayMembers.map((m) => (
            <WsCard key={m.name} pad={1.75}>
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                <Box sx={{ position: 'relative' }}>
                  <Avatar sx={{ width: 46, height: 46, fontSize: 16 }}>{m.name[0]}</Avatar>
                  {m.online && <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: '50%', bgcolor: ws.green, border: `2px solid ${ws.panelSolid}` }} />}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 14, fontWeight: 700 }}>{m.name}{m.star ? ' ⭐' : ''}</Typography>
                  <Box sx={{ mt: 0.25 }}><WsTag label={m.roleKey ? (locale === 'en' ? crewRoleDef(m.roleKey).labelEn : crewRoleDef(m.roleKey).label) : t(m.role)} tone={m.tone} /></Box>
                </Box>
              </Stack>
              <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ws.textFaint, mb: 0.5 }}>{t('respHeading')}</Typography>
              <Stack spacing={0.25} sx={{ mb: 1.25 }}>
                {m.ansvar.map((a) => <Typography key={a} sx={{ fontSize: 12, color: ws.textDim }}>· {t(a)}</Typography>)}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={0.25}>
                  <IconButton size="small" sx={{ color: ws.textDim }}><ChatBubbleOutline sx={{ fontSize: 16 }} /></IconButton>
                  <IconButton size="small" sx={{ color: ws.textDim }}><MailOutline sx={{ fontSize: 16 }} /></IconButton>
                  <IconButton size="small" sx={{ color: ws.textDim }}><Phone sx={{ fontSize: 16 }} /></IconButton>
                </Stack>
                <Typography sx={{ fontSize: 10.5, color: ws.textFaint }}>{t('lastActive')} {t(m.aktiv)}</Typography>
              </Stack>
            </WsCard>
          ))}
          {/* Inviter-kort */}
          <Box onClick={() => setInviteOpen(true)} sx={{ border: `1.5px dashed ${ws.border}`, borderRadius: `${ws.radius}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, cursor: 'pointer', color: ws.textDim, '&:hover': { borderColor: ws.accentBorder, color: ws.accent } }}>
            <PersonAdd sx={{ fontSize: 28, mb: 1 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{t('inviteMember')}</Typography>
          </Box>
        </Box>

        {/* Rolleoversikt + Framdrift + Nøkkelinfo */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2, mb: 2 }}>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('roleOverview')}</Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ position: 'relative', width: 84, height: 84 }}>
                <svg width={84} height={84} viewBox="0 0 84 84">
                  {(() => { let a = 0; const r = 34, cx = 42, cy = 42, C = 2 * Math.PI * r; return teamRoles.map(([n, v, c], i) => { const frac = v / (teamTotalRoles || 1); const dash = C * frac; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={11} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-C * (a / 360)} transform={`rotate(-90 ${cx} ${cy})`} />; a += frac * 360; return el; }); })()}
                </svg>
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 18, fontWeight: 800 }}>{teamTotalRoles}</Typography><Typography sx={{ fontSize: 9, color: ws.textDim }}>{t('total')}</Typography></Box>
              </Box>
              <Stack spacing={0.4} sx={{ flex: 1 }}>
                {teamRoles.map(([n, v, c]) => <Stack key={n} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} /><Typography sx={{ fontSize: 11.5, flex: 1 }}>{t(n)}</Typography><Typography sx={{ fontSize: 11.5, fontWeight: 700 }}>{v}</Typography></Stack>)}
              </Stack>
            </Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('teamProgress')}</Typography>
            <Stack spacing={1.1}>
              {progressRows.length === 0 && (
                <Typography sx={{ fontSize: 12, color: ws.textFaint }}>{t('noProgress')}</Typography>
              )}
              {progressRows.map(([t, n, d, c]) => (
                <Box key={t}>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12, color: ws.textDim }}>{t}</Typography><Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{n}/{d} · {Math.round(n / d * 100)}%</Typography></Stack>
                  <WsBar value={n / d * 100} color={c} height={5} />
                </Box>
              ))}
            </Stack>
          </WsCard>
          <WsCard>
            <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>{t('keyInfo')}</Typography>
            <Stack spacing={1}>
              {keyInfo.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{v}</Typography></Stack>)}
            </Stack>
          </WsCard>
        </Box>

        {/* Godkjenninger — skjules på ekte prosjekter uten dokumenter */}
        {approvalRows.length > 0 && (
          <WsCard sx={{ mb: 2 }}>
            <WsSectionTitle title={t('approvalsTitle')} />
            <WsTable
              columns={[t('Dokument'), 'Status', t('Ansvarlig'), t('Oppdatert')]}
              rows={approvalRows}
            />
          </WsCard>
        )}

        <WorkspaceSplitSheet projectId={projectId} profession={profession} userId={userId} projectName={projectName} />
      </Box>

      {/* Høyre: Chat + Oppgaver + Milepæler */}
      <Box sx={{ width: { xs: '100%', lg: 300 }, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title={t('tasksTitle')} action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/oppgaver`)} sx={{ color: ws.accent, textTransform: 'none' }}>{t('seeAll')}</Button>} />
          <Stack spacing={1}>
            {taskList.map(([t, who, st, tone]) => (
              <Stack key={t} direction="row" alignItems="center" spacing={1}><Box sx={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${ws.textFaint}` }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{t}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{who}</Typography><WsTag label={st} tone={tone} /></Stack>
            ))}
          </Stack>
        </WsCard>
        <WsCard>
          <WsSectionTitle title={t('milestonesTitle')} action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/prosjektplan`)} sx={{ color: ws.accent, textTransform: 'none' }}>{t('seeAll')}</Button>} />
          <Stack spacing={1.25}>
            {msList.map(([d, mo, t, sub]) => (
              <Stack key={t} direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ width: 40, textAlign: 'center', bgcolor: ws.accentSoft, borderRadius: 1.5, py: 0.5 }}><Typography sx={{ fontSize: 15, fontWeight: 800, color: ws.accent, lineHeight: 1 }}>{d}</Typography><Typography sx={{ fontSize: 9, color: ws.accent }}>{mo}</Typography></Box>
                <Box><Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{t}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{sub}</Typography></Box>
              </Stack>
            ))}
          </Stack>
        </WsCard>
      </Box>

      <InviteMemberDialog open={inviteOpen} onClose={() => setInviteOpen(false)} projectId={projectId} onInvited={() => { setInviteOpen(false); load(); }} />
    </Stack>
  );
};

const InviteMemberDialog: React.FC<{ open: boolean; onClose: () => void; projectId: string; onInvited: () => void }> = ({ open, onClose, projectId, onInvited }) => {
  const locale = useWsLocale();
  const t = makeT(T, locale);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [crewRole, setCrewRole] = useState('fotograf');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) { setError(t('emailRequired')); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/invite`, {
        method: 'POST',
        body: { email: email.trim(), name: name.trim(), crewRole, role },
      });
      setEmail(''); setName('');
      onInvited();
    } catch (e: any) { setError(e?.message || t('inviteFailed')); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('inviteTitle')}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{t('inviteInfo')}</Typography>
          <TextField label={t('nameLabel')} value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <TextField label={t('emailLabel')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" required />
          <TextField select label={t('teamRoleLabel')} value={crewRole} onChange={(e) => setCrewRole(e.target.value)} fullWidth size="small">
            {CREW_ROLE_CATALOG.map((r) => <MenuItem key={r.key} value={r.key} sx={{ gap: 1 }}>{crewIcon(r.icon, { fontSize: 16 })} {locale === 'en' ? r.labelEn : r.label}</MenuItem>)}
          </TextField>
          <TextField select label={t('accessLabel')} value={role} onChange={(e) => setRole(e.target.value)} fullWidth size="small">
            <MenuItem value="member">{t('canEdit')}</MenuItem>
            <MenuItem value="viewer">{t('viewOnly')}</MenuItem>
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>{t('cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !email.trim()} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? t('sending') : t('sendInvite')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamTab;
