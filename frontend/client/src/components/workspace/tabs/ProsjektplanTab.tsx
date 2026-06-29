// @ts-nocheck
/**
 * ProsjektplanTab — design #2 (Gantt/Prosjektplan), dark CreatorHub.
 * Tidslinje (Gantt) med faser + oppgave-bars + høyre sidebar
 * (Prosjektinformasjon / Milepæler / Ressursallokering / Hurtighandlinger)
 * + Faseoversikt-tabell.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Box, Stack, Typography, Button, Switch, Avatar, AvatarGroup, IconButton, Menu, MenuItem } from '@mui/material';
import { useLocation } from 'wouter';
import FilterList from '@mui/icons-material/FilterList';
import Add from '@mui/icons-material/Add';
import Flag from '@mui/icons-material/Flag';
import UploadFile from '@mui/icons-material/UploadFile';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsSectionTitle, WsBar, WsPills, WsTag, WsTable } from '../ui';

const PHASE_COLORS = [ws.accent, ws.blue, ws.green, ws.amber, ws.roleAnnet];
const STATUS_LABEL: Record<string, [string, string]> = { in_progress: ['I gang', 'accent'], pågår: ['I gang', 'accent'], completed: ['Ferdig', 'green'], done: ['Ferdig', 'green'], pending: ['Kommende', 'neutral'], planned: ['Kommende', 'neutral'] };

const WEEKS = ['UKE 33', 'UKE 34', 'UKE 35', 'UKE 36', 'UKE 37', 'UKE 38', 'UKE 39', 'UKE 40'];
const PHASES = [
  { name: '1. Forproduksjon', dot: ws.accent, count: '6 oppgaver', bars: [
    { label: 'Kickoff & brief', start: 0, span: 1.4, color: ws.accent },
    { label: 'Location scout', start: 0.6, span: 1.8, color: ws.accent },
    { label: 'Shotlist & planlegging', start: 1, span: 2.6, color: ws.accent },
    { label: 'Utstyrssjekk', start: 1.4, span: 2.8, color: ws.accent },
  ] },
  { name: '2. Produksjon', dot: ws.blue, count: '5 oppgaver', bars: [
    { label: 'Opptaksdag (14. sep)', start: 3.4, span: 1.6, color: ws.blue },
    { label: 'Backup & import', start: 4.4, span: 1.0, color: ws.blue },
  ] },
  { name: '3. Etterproduksjon', dot: ws.green, count: '7 oppgaver', bars: [
    { label: 'Råklipp', start: 0.2, span: 1.6, color: ws.green },
    { label: 'Fargekorrigering', start: 2.0, span: 2.4, color: ws.green },
    { label: 'Lydmix', start: 4.0, span: 1.6, color: ws.green },
    { label: 'Grafikk & titler', start: 4.8, span: 1.8, color: ws.green },
    { label: 'Finpuss', start: 5.6, span: 1.6, color: ws.green },
  ] },
  { name: '4. Leveranse', dot: ws.amber, count: '4 oppgaver', bars: [
    { label: 'Klientgjennomgang', start: 4.0, span: 1.8, color: ws.amber },
    { label: 'Revisjoner', start: 5.0, span: 1.8, color: ws.amber },
    { label: 'Endelig godkjenning', start: 5.8, span: 1.6, color: ws.amber },
    { label: 'Leveranse', start: 6.6, span: 1.2, color: ws.amber },
  ] },
];

const INFO = [
  ['Klient', 'Sara & Amir'], ['Prosjekttype', 'Bryllup – Foto & Video'], ['Dato', '14. september 2024'],
  ['Lokasjon', 'Oslo, Norge'], ['Tidssone', 'CET (Oslo)'], ['Prosjektleder', 'Thomas Qazi'],
];
const MILESTONES = [
  ['Forproduksjon ferdig', '1. sep 2024', ws.accent], ['Opptaksdag', '14. sep 2024', ws.blue],
  ['Klar for levering', '5. okt 2024', ws.green], ['Prosjekt levert', '20. okt 2024', ws.amber],
];
const RESOURCES = [['Foto', 6, ws.roleFoto], ['Video', 6, ws.roleVideo], ['Lyd', 2, ws.roleLyd], ['Drone', 2, ws.roleDrone], ['Annet', 2, ws.roleAnnet]];

const ProsjektplanTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [view, setView] = useState('tidslinje');
  const colW = 100 / WEEKS.length;
  const isReal = projectId && projectId !== 'sample';
  const [detail, setDetail] = useState<any | null>(null);
  const [msAll, setMsAll] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [, navigate] = useLocation();
  const [filterMenu, setFilterMenu] = useState<null | HTMLElement>(null);
  const [onlyUpcoming, setOnlyUpcoming] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const ms = onlyUpcoming ? msAll.filter((m: any) => { const d = new Date(m.dueDate || m.scheduledDate || m.createdAt); return isNaN(d.getTime()) || d.getTime() >= Date.now(); }) : msAll;

  const loadMs = () => { if (isReal) apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}/milestones`).then((r: any) => setMsAll(Array.isArray(r?.milestones) ? r.milestones : [])).catch(() => {}); };

  const addMilestone = async () => {
    if (!isReal) return;
    const title = window.prompt('Tittel på milepæl:'); if (!title?.trim()) return;
    const date = window.prompt('Dato (ÅÅÅÅ-MM-DD), valgfritt:') || '';
    try {
      await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones`, { method: 'POST', body: { title: title.trim(), dueDate: date.trim() || null, category: 'Milepæler' } });
      loadMs();
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til milepæl'); }
  };

  const importPlan = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let n = 0;
      for (const line of lines) {
        const [title, date] = line.split(/[;,\t]/).map((x) => (x || '').trim());
        if (!title || /tittel|title/i.test(title)) continue; // hopp over header
        await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/milestones`, { method: 'POST', body: { title, dueDate: date || null, category: 'Importert' } });
        n++;
      }
      loadMs();
      window.alert(`${n} milepæl${n === 1 ? '' : 'er'} importert.`);
    } catch (e: any) { window.alert(e?.message || 'Kunne ikke importere planen'); }
  };

  useEffect(() => {
    if (!isReal) return;
    apiRequest(`/api/photographer/projects/${encodeURIComponent(projectId)}`).then((r: any) => setDetail(r?.project || null)).catch(() => {});
    loadMs();
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/team/members`).then((r: any) => setMembers(Array.isArray(r?.members) ? r.members : [])).catch(() => {});
  }, [projectId, isReal]);

  // Prosjektinformasjon — ekte prosjekt viser ekte detaljer (manglende = «—»), mock kun på /sample.
  const infoRows = isReal ? [
    ['Klient', detail?.clientName || '—'], ['Prosjekttype', detail?.projectType || '—'],
    ['Dato', detail?.eventDate ? new Date(detail.eventDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
    ['Lokasjon', detail?.location || '—'], ['Status', detail?.status || '—'],
  ] : INFO;
  // Milepæler
  const msList = isReal
    ? ms.slice(0, 8).map((m: any, i: number) => [m.title, (m.dueDate || m.scheduledDate) ? new Date(m.dueDate || m.scheduledDate).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', PHASE_COLORS[i % PHASE_COLORS.length]])
    : MILESTONES;
  // Ressursallokering fra crew-roller
  const roleCount: Record<string, number> = {};
  members.forEach((m: any) => { const k = m.crewRole || 'annet'; roleCount[k] = (roleCount[k] || 0) + 1; });
  const ROLE_LABEL: Record<string, [string, string]> = { fotograf: ['Foto', ws.roleFoto], videograf: ['Video', ws.roleVideo], lyd: ['Lyd', ws.roleLyd], editor: ['Editor', ws.blue], begge: ['Foto+Video', ws.roleFoto], assistent: ['Assistent', ws.roleAnnet] };
  const resources = isReal ? Object.entries(roleCount).map(([k, v]) => [ROLE_LABEL[k]?.[0] || k, v, ROLE_LABEL[k]?.[1] || ws.roleAnnet]) : RESOURCES;
  const total = resources.reduce((s, r) => s + r[1], 0);
  // Faser fra milestones gruppert på kategori; Gantt-bars posisjonert på dato.
  const dates = ms.map((m: any) => new Date(m.dueDate || m.scheduledDate || m.createdAt)).filter((d) => !isNaN(d.getTime()));
  const minT = dates.length ? Math.min(...dates.map((d) => d.getTime())) : 0;
  const maxT = dates.length ? Math.max(...dates.map((d) => d.getTime())) : 1;
  const span = Math.max(1, maxT - minT);
  const cats = [...new Set(ms.map((m: any) => m.category || 'Milepæler'))];
  const realPhases = (isReal && ms.length) ? cats.map((cat, ci) => ({
    name: cat, dot: PHASE_COLORS[ci % PHASE_COLORS.length], count: `${ms.filter((m: any) => (m.category || 'Milepæler') === cat).length} milepæler`,
    bars: ms.filter((m: any) => (m.category || 'Milepæler') === cat).map((m: any) => {
      const d = new Date(m.dueDate || m.scheduledDate || m.createdAt).getTime();
      const start = ((d - minT) / span) * (WEEKS.length - 1);
      return { label: m.title, start, span: 1.2, color: PHASE_COLORS[ci % PHASE_COLORS.length] };
    }),
  })) : null;
  const phases = isReal ? (realPhases || []) : PHASES;
  // Faseoversikt
  const faseRows = (isReal && ms.length) ? cats.map((cat, ci) => {
    const items = ms.filter((m: any) => (m.category || 'Milepæler') === cat);
    const doneN = items.filter((m: any) => m.status === 'completed' || m.status === 'done').length;
    const avg = items.length ? Math.round(items.reduce((s: number, m: any) => s + (Number(m.progress) || 0), 0) / items.length) : 0;
    const dts = items.map((m: any) => new Date(m.dueDate || m.scheduledDate)).filter((d) => !isNaN(d.getTime()));
    const frist = dts.length ? new Date(Math.max(...dts.map((d) => d.getTime()))).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '—';
    const st = doneN === items.length ? ['Ferdig', 'green'] : avg > 0 ? ['I gang', 'accent'] : ['Kommende', 'neutral'];
    return { name: cat, st, avg, count: `${doneN} av ${items.length}`, frist };
  }) : null;

  return (
    <Stack direction="row" spacing={2.5} sx={{ alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Prosjektplan</Typography>
            <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Planlegg, organiser og hold oversikt over hele produksjonen.</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" startIcon={<FilterList sx={{ fontSize: 16 }} />} onClick={(e) => setFilterMenu(e.currentTarget)} sx={{ color: ws.textDim, textTransform: 'none' }}>Filter</Button>
            <Menu anchorEl={filterMenu} open={!!filterMenu} onClose={() => setFilterMenu(null)} PaperProps={{ sx: { bgcolor: ws.panel, color: ws.text, border: `1px solid ${ws.border}` } }}>
              <MenuItem onClick={() => { setOnlyUpcoming(false); setFilterMenu(null); }}>Alle milepæler</MenuItem>
              <MenuItem onClick={() => { setOnlyUpcoming(true); setFilterMenu(null); }}>Kun kommende</MenuItem>
            </Menu>
            <Stack direction="row" alignItems="center"><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Vis milepæler</Typography><Switch size="small" defaultChecked /></Stack>
          </Stack>
        </Stack>

        <WsCard sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <WsPills items={[{ key: 'tidslinje', label: 'Tidslinje' }, { key: 'liste', label: 'Liste' }, { key: 'kalender', label: 'Kalender' }, { key: 'fase', label: 'Fasevisning' }]} value={view} onChange={setView} />
            <Typography sx={{ fontSize: 12, color: ws.textFaint }}>Oktober 2024</Typography>
          </Stack>

          {/* Uke-header */}
          <Box sx={{ display: 'flex', pl: '180px', borderBottom: `1px solid ${ws.border}`, pb: 0.5, mb: 1 }}>
            {WEEKS.map((w, i) => (
              <Box key={w} sx={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <Typography sx={{ fontSize: 10.5, color: i === 4 ? ws.accent : ws.textFaint, fontWeight: i === 4 ? 800 : 500 }}>{w}</Typography>
                {i === 4 && <Box sx={{ position: 'absolute', top: 18, left: '50%', width: 1, height: 220, bgcolor: ws.accentBorder }}><WsTag label="I DAG" tone="accent" /></Box>}
              </Box>
            ))}
          </Box>

          {/* Faser + bars */}
          <Stack spacing={1.5}>
            {phases.map((ph) => (
              <Box key={ph.name}>
                <Stack direction="row">
                  <Box sx={{ width: 180, flexShrink: 0, pr: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ph.dot }} /><Typography sx={{ fontSize: 13, fontWeight: 700 }}>{ph.name}</Typography></Stack>
                    <Typography sx={{ fontSize: 11, color: ws.textFaint, pl: 2 }}>{ph.count}</Typography>
                  </Box>
                  <Box sx={{ flex: 1, position: 'relative', minHeight: ph.bars.length * 26 }}>
                    {/* grid-linjer */}
                    {WEEKS.map((_, i) => <Box key={i} sx={{ position: 'absolute', left: `${i * colW}%`, top: 0, bottom: 0, width: '1px', bgcolor: ws.borderSoft }} />)}
                    {ph.bars.map((b, bi) => (
                      <Box key={bi} sx={{ position: 'absolute', top: bi * 26, left: `${b.start * colW}%`, width: `${b.span * colW}%`, height: 20, borderRadius: 1, bgcolor: b.color, opacity: 0.9, display: 'flex', alignItems: 'center', px: 1, overflow: 'hidden' }}>
                        <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: '#0a0a0a' }}>{b.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        </WsCard>

        {/* Faseoversikt */}
        <WsCard>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.5 }}>Faseoversikt</Typography>
          <WsTable
            columns={['Fase', 'Status', 'Fremdrift', '', 'Oppgaver', 'Frist']}
            rows={(faseRows || [
              { name: '1. Forproduksjon', st: ['I gang', 'accent'], avg: 83, count: '5 av 6', frist: '1. sep' },
              { name: '2. Produksjon', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 5', frist: '14. sep' },
              { name: '3. Etterproduksjon', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 7', frist: '5. okt' },
              { name: '4. Leveranse', st: ['Kommende', 'neutral'], avg: 0, count: '0 av 4', frist: '20. okt' },
            ]).map((r) => [
              r.name, <WsTag label={r.st[0]} tone={r.st[1]} />, <Box sx={{ width: 120 }}><WsBar value={r.avg} /></Box>, `${r.avg}%`, r.count, r.frist,
            ])}
          />
        </WsCard>
      </Box>

      {/* Høyre sidebar */}
      <Box sx={{ width: 300, flexShrink: 0 }}>
        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title="Prosjektinformasjon" action={<Button size="small" onClick={() => navigate(`/workspace/${projectId}/avtaler`)} sx={{ color: ws.accent, textTransform: 'none' }}>Rediger</Button>} />
          <Stack spacing={1}>
            {infoRows.map(([k, v]) => <Stack key={k} direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{k}</Typography><Typography sx={{ fontSize: 12.5, fontWeight: 600 }}>{v}</Typography></Stack>)}
          </Stack>
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <WsSectionTitle title="Milepæler" action={<Button size="small" startIcon={<Add sx={{ fontSize: 14 }} />} onClick={addMilestone} disabled={!isReal} sx={{ color: ws.accent, textTransform: 'none' }}>Legg til</Button>} />
          <Stack spacing={1.25}>
            {msList.map(([t, d, c]) => <Stack key={t} direction="row" spacing={1} alignItems="center"><Flag sx={{ fontSize: 15, color: c }} /><Typography sx={{ fontSize: 12.5, flex: 1 }}>{t}</Typography><Typography sx={{ fontSize: 11.5, color: ws.textFaint }}>{d}</Typography></Stack>)}
          </Stack>
        </WsCard>

        <WsCard sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1.5 }}>Ressursallokering</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative', width: 96, height: 96 }}>
              <svg width={96} height={96} viewBox="0 0 96 96">
                {(() => { let a = -90; const r = 40, cx = 48, cy = 48, C = 2 * Math.PI * r; return resources.map(([n, v, c], i) => { const frac = v / (total || 1); const dash = C * frac; const el = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth={12} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-C * ((a + 90) / 360)} transform={`rotate(-90 ${cx} ${cy})`} />; a += frac * 360; return el; }); })()}
              </svg>
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Typography sx={{ fontSize: 20, fontWeight: 800 }}>{total}</Typography><Typography sx={{ fontSize: 10, color: ws.textDim }}>Totalt</Typography></Box>
            </Box>
            <Stack spacing={0.5} sx={{ flex: 1 }}>
              {resources.map(([n, v, c]) => <Stack key={n} direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c }} /><Typography sx={{ fontSize: 12, flex: 1 }}>{n}</Typography><Typography sx={{ fontSize: 12, fontWeight: 700 }}>{v}</Typography></Stack>)}
            </Stack>
          </Stack>
        </WsCard>

        <WsCard>
          <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 1 }}>Hurtighandlinger</Typography>
          <Stack spacing={1}>
            <Button fullWidth size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={() => navigate(`/workspace/${projectId}/oppgaver`)} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>Ny oppgave</Button>
            <Button fullWidth size="small" startIcon={<Flag sx={{ fontSize: 15 }} />} onClick={addMilestone} disabled={!isReal} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>Ny milepæl</Button>
            <Button fullWidth size="small" startIcon={<UploadFile sx={{ fontSize: 15 }} />} onClick={() => fileInput.current?.click()} disabled={!isReal} sx={{ justifyContent: 'flex-start', color: ws.text, border: `1px solid ${ws.border}`, textTransform: 'none' }}>Importer plan</Button>
            <input ref={fileInput} type="file" accept=".csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importPlan(f); e.target.value = ''; }} />
          </Stack>
        </WsCard>
      </Box>
    </Stack>
  );
};

export default ProsjektplanTab;
