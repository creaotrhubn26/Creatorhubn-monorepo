// @ts-nocheck
/**
 * OppgaverTab — full oppgave-kanban (Å gjøre / Pågår / Ferdig), dark CreatorHub.
 * Samme backend som Samkjøringsboardet (project_board_tasks) — oppgavene synker
 * mellom de to flatene. Flytt mellom kolonner (PATCH status), legg til (POST),
 * rolle-tag per oppgave. Sample-fallback i demo.
 */
import React, { useState, useEffect } from 'react';
import { Box, Stack, Typography, Button, IconButton, MenuItem, Menu } from '@mui/material';
import Add from '@mui/icons-material/Add';
import ArrowForward from '@mui/icons-material/ArrowForward';
import ArrowBack from '@mui/icons-material/ArrowBack';
import { apiRequest } from '@/lib/queryClient';
import { ws } from '../workspaceTheme';
import { WsCard, WsStat, WsTag } from '../ui';

const COLUMNS = [
  { key: 'todo', label: 'Å gjøre', tone: 'neutral' },
  { key: 'in_progress', label: 'Pågår', tone: 'amber' },
  { key: 'done', label: 'Ferdig', tone: 'green' },
];
const CREW = [
  { value: 'fotograf', label: '📷 Fotograf', tone: 'accent' },
  { value: 'videograf', label: '🎥 Videograf', tone: 'green' },
  { value: 'begge', label: '👥 Begge', tone: 'blue' },
  { value: 'editor', label: '🎬 Editor', tone: 'neutral' },
  { value: 'lyd', label: '🎧 Lyd', tone: 'amber' },
];
const crewTag = (c: string) => CREW.find((x) => x.value === c) || { label: c || 'Begge', tone: 'neutral' };

const SAMPLE = [
  { id: 's1', title: 'Oppdater shotlist', crewRole: 'fotograf', status: 'done' },
  { id: 's2', title: 'Bekreft drone-tillatelse', crewRole: 'videograf', status: 'todo' },
  { id: 's3', title: 'Fargeprofil godkjenning', crewRole: 'editor', status: 'in_progress' },
  { id: 's4', title: 'Utstyrssjekk', crewRole: 'begge', status: 'todo' },
  { id: 's5', title: 'Backup lydplan', crewRole: 'lyd', status: 'in_progress' },
  { id: 's6', title: 'Highlight-klipp', crewRole: 'editor', status: 'todo' },
];

const OppgaverTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const isReal = projectId && projectId !== 'sample';
  const [tasks, setTasks] = useState<any[]>([]);
  const [addMenu, setAddMenu] = useState<{ el: any; col: string } | null>(null);

  const load = () => {
    if (!isReal) { setTasks(SAMPLE); return; }
    apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`)
      .then((r: any) => setTasks(Array.isArray(r?.tasks) ? r.tasks : []))
      .catch(() => setTasks([]));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [projectId]);

  const move = async (t: any, dir: number) => {
    const idx = COLUMNS.findIndex((c) => c.key === (t.status || 'todo'));
    const next = COLUMNS[Math.max(0, Math.min(COLUMNS.length - 1, idx + dir))];
    if (!next || next.key === t.status) return;
    setTasks((p) => p.map((x) => (x.id === t.id ? { ...x, status: next.key } : x)));
    if (isReal) apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks/${t.id}`, { method: 'PATCH', body: { status: next.key } }).catch(load);
  };
  const add = async (col: string, crewRole: string) => {
    setAddMenu(null);
    if (!isReal) { window.alert('Lagres når prosjektet er ekte.'); return; }
    const title = window.prompt('Ny oppgave:'); if (!title) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`, { method: 'POST', body: { title: title.trim(), crewRole, status: col } }); load(); }
    catch (e: any) { window.alert(e?.message || 'Kunne ikke legge til'); }
  };

  const byCol = (key: string) => tasks.filter((t) => (t.status || 'todo') === key);
  const doneCount = byCol('done').length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>Oppgaver</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>Samme oppgaver som Samkjøringsboardet — synker mellom flatene.</Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat label="Totalt" value={tasks.length} />
        <WsStat label="Å gjøre" value={byCol('todo').length} tone={ws.panelAlt} />
        <WsStat label="Pågår" value={byCol('in_progress').length} tone={ws.amberSoft} />
        <WsStat label="Ferdig" value={doneCount} sub={tasks.length ? `${Math.round((doneCount / tasks.length) * 100)}%` : '0%'} tone={ws.greenSoft} />
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        {COLUMNS.map((col, ci) => (
          <Box key={col.key} sx={{ flex: 1, minWidth: 0 }}>
            <WsCard sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ws[col.tone] || ws.textFaint }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{col.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: ws.textFaint }}>{byCol(col.key).length}</Typography>
                </Stack>
                <IconButton size="small" onClick={(e) => setAddMenu({ el: e.currentTarget, col: col.key })} sx={{ color: ws.textDim }}><Add fontSize="small" /></IconButton>
              </Stack>
              <Stack spacing={1}>
                {byCol(col.key).map((t) => {
                  const cr = crewTag(t.crewRole);
                  return (
                    <Box key={t.id} sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panel, border: `1px solid ${ws.borderSoft}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>{t.title}</Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <WsTag label={cr.label} tone={cr.tone} />
                        <Stack direction="row" spacing={0.25}>
                          {ci > 0 && <IconButton size="small" onClick={() => move(t, -1)} sx={{ color: ws.textFaint }}><ArrowBack sx={{ fontSize: 15 }} /></IconButton>}
                          {ci < COLUMNS.length - 1 && <IconButton size="small" onClick={() => move(t, 1)} sx={{ color: ws.textDim }}><ArrowForward sx={{ fontSize: 15 }} /></IconButton>}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
                {byCol(col.key).length === 0 && <Typography sx={{ fontSize: 12, color: ws.textFaint, textAlign: 'center', py: 2 }}>Ingen oppgaver</Typography>}
                <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={(e) => setAddMenu({ el: e.currentTarget, col: col.key })} sx={{ color: ws.textDim, textTransform: 'none', justifyContent: 'flex-start' }}>Legg til</Button>
              </Stack>
            </WsCard>
          </Box>
        ))}
      </Stack>

      <Menu open={!!addMenu} anchorEl={addMenu?.el} onClose={() => setAddMenu(null)}>
        {CREW.map((c) => <MenuItem key={c.value} onClick={() => add(addMenu?.col, c.value)}>{c.label}</MenuItem>)}
      </Menu>
    </Box>
  );
};

export default OppgaverTab;
