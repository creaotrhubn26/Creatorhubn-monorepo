// @ts-nocheck
/**
 * TeamTab — design #8 (Team), dark CreatorHub.
 * Medlemskort (rolle/ansvar/tilgang/sist aktiv) + Rolleoversikt + Teamets
 * framdrift + Nøkkelinformasjon + Godkjenninger + Team-notater. Mapper til
 * project_team_members-backend (wires i delings-fasen).
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Avatar, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Alert, CircularProgress } from '@mui/material';
import ChatBubbleOutline from '@mui/icons-material/ChatBubbleOutline';
import MailOutline from '@mui/icons-material/MailOutline';
import Phone from '@mui/icons-material/Phone';
import PersonAdd from '@mui/icons-material/PersonAdd';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsBar, WsTag, WsTable } from '../ui';

const CREW_ROLES = [
  { value: 'fotograf', label: 'Fotograf', tone: 'accent' },
  { value: 'videograf', label: 'Videograf', tone: 'green' },
  { value: 'editor', label: 'Editor', tone: 'blue' },
  { value: 'lyd', label: 'Lydtekniker', tone: 'amber' },
  { value: 'begge', label: 'Foto + Video', tone: 'accent' },
  { value: 'assistent', label: 'Assistent', tone: 'neutral' },
];
const crewTone = (c: string) => CREW_ROLES.find((r) => r.value === c)?.tone || 'neutral';
const crewLabel = (c: string) => CREW_ROLES.find((r) => r.value === c)?.label || c || 'Medlem';

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

const TeamTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const totalRoles = ROLES.reduce((s, r) => s + r[1], 0);
  const [real, setReal] = useState<any[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [boardTasks, setBoardTasks] = useState<any[] | null>(null);
  const [milestones, setMilestones] = useState<any[] | null>(null);
  const isRealP = projectId && projectId !== 'sample';
  useEffect(() => {
    if (!isRealP) return;
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`).then((r: any) => setBoardTasks(Array.isArray(r?.tasks) ? r.tasks : [])).catch(() => {});
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}/milestones`).then((r: any) => setMilestones(Array.isArray(r?.milestones) ? r.milestones : [])).catch(() => {});
  }, [projectId, isRealP]);

  const load = async () => {
    try {
      const r: any = await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`);
      setIsOwner(!!r?.isOwner);
      const list = Array.isArray(r?.members) ? r.members : [];
      // Inkluder eier øverst hvis vi har den
      const owner = r?.owner ? [{ name: r.owner.name, role: 'Eier', tone: 'accent', online: true, ansvar: ['Prosjekteier'], aktiv: 'Nå', star: true }] : [];
      const mapped = list.filter((m: any) => m.status !== 'revoked').map((m: any) => ({
        name: m.name || m.email, role: crewLabel(m.crewRole), tone: crewTone(m.crewRole),
        online: m.status === 'active', ansvar: [m.role === 'viewer' ? 'Lesetilgang' : 'Redigeringstilgang', m.email],
        aktiv: m.status === 'active' ? 'Aktiv' : 'Venter på aksept',
      }));
      const combined = [...owner, ...mapped];
      setReal(combined.length > 0 ? combined : null); // tom → behold sample-demo
    } catch { setReal(null); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const displayMembers = real || MEMBERS;

  // Oppgaver (høyre) fra ekte board-tasks.
  const taskList = (boardTasks && boardTasks.length)
    ? boardTasks.slice(0, 6).map((t) => [t.title, '', t.status === 'done' ? 'Gjort' : t.status === 'in_progress' ? 'Pågår' : 'Venter', t.status === 'done' ? 'green' : t.status === 'in_progress' ? 'blue' : 'amber'])
    : TASKS;
  // Kommende milepæler fra ekte milestones.
  const MO = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'];
  const upcoming = (milestones || []).filter((m: any) => { const d = m.dueDate || m.scheduledDate; return d && new Date(d) >= new Date(Date.now() - 864e5); }).slice(0, 3);
  const msList = upcoming.length
    ? upcoming.map((m: any) => { const d = new Date(m.dueDate || m.scheduledDate); return [String(d.getDate()), MO[d.getMonth()], m.title, d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' })]; })
    : [['12', 'SEP', 'Location scout', 'Torsdag 12. sep 10:00'], ['14', 'SEP', 'Produksjonsdag', 'Lørdag 14. sep 09:00'], ['21', 'SEP', 'Teaser levering', 'Lørdag 21. sep 18:00']];

  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Team <Typography component="span" sx={{ color: ws.textDim }}>{displayMembers.length}</Typography></Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Alle teammedlemmer og roller i dette prosjektet.</Typography>
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
          <Box onClick={() => setInviteOpen(true)} sx={{ border: `1.5px dashed ${ws.border}`, borderRadius: `${ws.radius}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 180, cursor: 'pointer', color: ws.textDim, '&:hover': { borderColor: ws.accentBorder, color: ws.accent } }}>
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
        <WsCard sx={{ mb: 2 }}>
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

        <SplitSheetCard projectId={projectId} members={displayMembers} isReal={!!real || (projectId && projectId !== 'sample')} />
      </Box>

      {/* Høyre: Chat + Oppgaver + Milepæler */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title="Oppgaver" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
          <Stack spacing={1}>
            {taskList.map(([t, who, st, tone]) => (
              <Stack key={t} direction="row" alignItems="center" spacing={1}><Box sx={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${ws.textFaint}` }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{t}</Typography><Typography sx={{ fontSize: 11, color: ws.textFaint }}>{who}</Typography><WsTag label={st} tone={tone} /></Stack>
            ))}
          </Stack>
        </WsCard>
        <WsCard>
          <WsSectionTitle title="Kommende milepæler" action={<Button size="small" sx={{ color: ws.accent, textTransform: 'none' }}>Se alle</Button>} />
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
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [crewRole, setCrewRole] = useState('fotograf');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) { setError('E-post påkrevd'); return; }
    setBusy(true); setError(null);
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/invite`, {
        method: 'POST',
        body: { email: email.trim(), name: name.trim(), crewRole, role },
      });
      setEmail(''); setName('');
      onInvited();
    } catch (e: any) { setError(e?.message || 'Invitering feilet'); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Inviter teammedlem</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Medlemmet får e-post med lenke til workspacet. Profesjonen styrer hvilke verktøy de får (videograf → videograf-funksjoner).</Typography>
          <TextField label="Navn" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" />
          <TextField label="E-post" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth size="small" required />
          <TextField select label="Rolle i teamet" value={crewRole} onChange={(e) => setCrewRole(e.target.value)} fullWidth size="small">
            {CREW_ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
          </TextField>
          <TextField select label="Tilgang" value={role} onChange={(e) => setRole(e.target.value)} fullWidth size="small">
            <MenuItem value="member">Kan redigere</MenuItem>
            <MenuItem value="viewer">Kun lese</MenuItem>
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Avbryt</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !email.trim()} startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}>{busy ? 'Sender…' : 'Send invitasjon'}</Button>
      </DialogActions>
    </Dialog>
  );
};

const SplitSheetCard: React.FC<{ projectId: string; members: any[]; isReal: boolean }> = ({ projectId, members, isReal }) => {
  const [shares, setShares] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isReal) {
      // demo: seed jevn fordeling fra medlemmer
      const n = members.length || 1;
      const even = Math.floor(100 / n);
      setShares(members.map((m, i) => ({ name: m.name, role: m.role, percent: i === 0 ? 100 - even * (n - 1) : even })));
      return;
    }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/split-sheet`)
      .then((r: any) => {
        if (Array.isArray(r?.shares) && r.shares.length > 0) setShares(r.shares.map((s: any) => ({ name: s.name, role: s.role, email: s.email, percent: s.percent })));
        else setShares(members.map((m) => ({ name: m.name, role: m.role, percent: 0 })));
      })
      .catch(() => setShares(members.map((m) => ({ name: m.name, role: m.role, percent: 0 }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, isReal]);

  const total = shares.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const valid = Math.round(total) === 100;

  const setPct = (i: number, v: string) => {
    const pct = Math.max(0, Math.min(100, Number(v) || 0));
    setShares((p) => p.map((x, idx) => (idx === i ? { ...x, percent: pct } : x)));
    setSaved(false);
  };
  const split = () => { const n = shares.length || 1; const even = Math.floor(100 / n); setShares((p) => p.map((x, i) => ({ ...x, percent: i === 0 ? 100 - even * (n - 1) : even }))); setSaved(false); };
  const save = async () => {
    if (!isReal) { window.alert('Lagres når prosjektet er ekte (ikke demo).'); return; }
    if (!valid) { window.alert(`Fordelingen må summere til 100 % (nå: ${total}%).`); return; }
    setSaving(true);
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/split-sheet`, { method: 'PUT', body: { shares } }); setSaved(true); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke lagre'); } finally { setSaving(false); }
  };

  return (
    <WsCard>
      <WsSectionTitle title="Split sheet — honorar-fordeling" action={<Button size="small" onClick={split} sx={{ color: ws.accent, textTransform: 'none' }}>Del likt</Button>} />
      <Typography sx={{ fontSize: 12, color: ws.textDim, mb: 1.5 }}>Hvor stor andel av prosjekt-honoraret hvert teammedlem får. Må summere til 100 %.</Typography>
      <Stack spacing={1}>
        {shares.map((s, i) => (
          <Stack key={i} direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>{s.name}</Typography>
              {s.role && <Typography noWrap sx={{ fontSize: 11, color: ws.textFaint }}>{s.role}</Typography>}
            </Box>
            <Box sx={{ flex: 1.5 }}><WsBar value={Number(s.percent) || 0} /></Box>
            <TextField type="number" size="small" value={s.percent} onChange={(e) => setPct(i, e.target.value)}
              InputProps={{ endAdornment: <Typography sx={{ fontSize: 12, color: ws.textDim }}>%</Typography> }}
              sx={{ width: 88, '& .MuiOutlinedInput-root': { bgcolor: ws.panelInput, fontSize: 13 } }} />
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${ws.border}` }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Sum:</Typography>
          <WsTag label={`${total} %`} tone={valid ? 'green' : 'red'} />
        </Stack>
        <Button variant="contained" size="small" onClick={save} disabled={saving || !valid}
          sx={{ bgcolor: ws.accent, color: ws.accentContrast, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: ws.accentHover } }}>
          {saving ? 'Lagrer…' : saved ? 'Lagret ✓' : 'Lagre fordeling'}
        </Button>
      </Stack>
    </WsCard>
  );
};

export default TeamTab;
