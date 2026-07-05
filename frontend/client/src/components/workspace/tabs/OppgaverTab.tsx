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
import { useWsLocale, makeT, type WsDict } from '../wsLocale';
import { crewRoleDef, CREW_ROLE_CATALOG } from '@shared/crew-roles';
import { crewIcon } from '../crewIcons';

// Lokal no/en-ordbok for fanen (samme mønster som OppdragTab).
const T: WsDict = {
  title: { no: 'Oppgaver', en: 'Tasks' },
  subtitle: { no: 'Samme oppgaver som Samkjøringsboardet — synker mellom flatene.', en: 'The same tasks as the coordination board — they sync between the two views.' },
  statTotal: { no: 'Totalt', en: 'Total' },
  statTodo: { no: 'Å gjøre', en: 'To do' },
  statInProgress: { no: 'Pågår', en: 'In progress' },
  statDone: { no: 'Ferdig', en: 'Done' },
  noTasks: { no: 'Ingen oppgaver', en: 'No tasks' },
  addTask: { no: 'Legg til', en: 'Add' },
  sampleOnly: { no: 'Lagres når prosjektet er ekte.', en: 'Saved once the project is real.' },
  promptNewTask: { no: 'Ny oppgave:', en: 'New task:' },
  addFailed: { no: 'Kunne ikke legge til', en: 'Could not add' },
};

// Statusverdiene (key) sendes til API-et og forblir uendret — kun etikettene oversettes.
const COLUMNS = [
  { key: 'todo', label: { no: 'Å gjøre', en: 'To do' }, tone: 'neutral' },
  { key: 'in_progress', label: { no: 'Pågår', en: 'In progress' }, tone: 'amber' },
  { key: 'done', label: { no: 'Ferdig', en: 'Done' }, tone: 'green' },
];
// Crew-roller fra den delte katalogen (crew-roles.ts) — dekker alle
// kategorienes roller + ukjente nøkler med generisk visning (blandede team).
const crewTag = (c: string, locale: 'no' | 'en') => {
  const d = crewRoleDef(c || 'begge');
  return { icon: crewIcon(d.icon), label: locale === 'en' ? d.labelEn : d.label, tone: d.tone };
};

const SAMPLE = [
  { id: 's1', title: 'Oppdater shotlist', crewRole: 'fotograf', status: 'done' },
  { id: 's2', title: 'Bekreft drone-tillatelse', crewRole: 'videograf', status: 'todo' },
  { id: 's3', title: 'Fargeprofil godkjenning', crewRole: 'editor', status: 'in_progress' },
  { id: 's4', title: 'Utstyrssjekk', crewRole: 'begge', status: 'todo' },
  { id: 's5', title: 'Backup lydplan', crewRole: 'lyd', status: 'in_progress' },
  { id: 's6', title: 'Highlight-klipp', crewRole: 'editor', status: 'todo' },
];

const OppgaverTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  // Utenlandske partner-vendors får engelsk UI — locale fra WsLocaleProvider.
  const locale = useWsLocale();
  const t = makeT(T, locale);
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
    if (!isReal) { window.alert(t('sampleOnly')); return; }
    const title = window.prompt(t('promptNewTask')); if (!title) return;
    try { await apiRequest(`/api/projects/${encodeURIComponent(projectId)}/board-tasks`, { method: 'POST', body: { title: title.trim(), crewRole, status: col } }); load(); }
    catch (e: any) { window.alert(e?.message || t('addFailed')); }
  };

  const byCol = (key: string) => tasks.filter((t) => (t.status || 'todo') === key);
  const doneCount = byCol('done').length;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-end" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 20, fontWeight: 800 }}>{t('title')}</Typography>
          <Typography sx={{ fontSize: 12.5, color: ws.textDim }}>{t('subtitle')}</Typography>
        </Box>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <WsStat label={t('statTotal')} value={tasks.length} />
        <WsStat label={t('statTodo')} value={byCol('todo').length} tone={ws.panelAlt} />
        <WsStat label={t('statInProgress')} value={byCol('in_progress').length} tone={ws.amberSoft} />
        <WsStat label={t('statDone')} value={doneCount} sub={tasks.length ? `${Math.round((doneCount / tasks.length) * 100)}%` : '0%'} tone={ws.greenSoft} />
      </Box>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
        {COLUMNS.map((col, ci) => (
          <Box key={col.key} sx={{ flex: 1, minWidth: 0 }}>
            <WsCard sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: ws[col.tone] || ws.textFaint }} />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{col.label[locale] || col.label.no}</Typography>
                  <Typography sx={{ fontSize: 12, color: ws.textFaint }}>{byCol(col.key).length}</Typography>
                </Stack>
                <IconButton size="small" onClick={(e) => setAddMenu({ el: e.currentTarget, col: col.key })} sx={{ color: ws.textDim }}><Add fontSize="small" /></IconButton>
              </Stack>
              <Stack spacing={1}>
                {byCol(col.key).map((task) => {
                  const cr = crewTag(task.crewRole, locale);
                  return (
                    <Box key={task.id} sx={{ p: 1.25, borderRadius: `${ws.radiusSm}px`, bgcolor: ws.panel, border: `1px solid ${ws.borderSoft}` }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, mb: 0.75 }}>{task.title}</Typography>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <WsTag icon={cr.icon} label={cr.label} tone={cr.tone} />
                        <Stack direction="row" spacing={0.25}>
                          {ci > 0 && <IconButton size="small" onClick={() => move(task, -1)} sx={{ color: ws.textFaint }}><ArrowBack sx={{ fontSize: 15 }} /></IconButton>}
                          {ci < COLUMNS.length - 1 && <IconButton size="small" onClick={() => move(task, 1)} sx={{ color: ws.textDim }}><ArrowForward sx={{ fontSize: 15 }} /></IconButton>}
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
                {byCol(col.key).length === 0 && <Typography sx={{ fontSize: 12, color: ws.textFaint, textAlign: 'center', py: 2 }}>{t('noTasks')}</Typography>}
                <Button size="small" startIcon={<Add sx={{ fontSize: 15 }} />} onClick={(e) => setAddMenu({ el: e.currentTarget, col: col.key })} sx={{ color: ws.textDim, textTransform: 'none', justifyContent: 'flex-start' }}>{t('addTask')}</Button>
              </Stack>
            </WsCard>
          </Box>
        ))}
      </Stack>

      <Menu open={!!addMenu} anchorEl={addMenu?.el} onClose={() => setAddMenu(null)}>
        {CREW_ROLE_CATALOG.map((c) => <MenuItem key={c.key} onClick={() => add(addMenu?.col, c.key)} sx={{ gap: 1, fontSize: 13 }}>{crewIcon(c.icon, { fontSize: 16 })} {locale === 'en' ? c.labelEn : c.label}</MenuItem>)}
      </Menu>
    </Box>
  );
};

export default OppgaverTab;
