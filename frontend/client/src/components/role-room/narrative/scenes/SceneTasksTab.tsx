/**
 * SceneTasksTab — sjekkliste per scene: avkryssing (optimistisk), ansvarlig,
 * frist (rød når forfalt), «Ny oppgave» på én linje.
 */

import React, { useMemo, useState } from 'react';
import { Box, Button, Checkbox, IconButton, LinearProgress, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeSceneDetail } from '../narrativeTypes';
import type { UseNarrativeScenesResult } from './useNarrativeScenes';
import { EmptyHint, sceneFieldSx } from './sceneUi';
import { dateInputToIso, formatShortDate, isOverdue, taskProgress } from './sceneOps';
import { MemberAvatar, MemberPicker, useMembersLite } from '../components/MemberPicker';

export function SceneTasksTab({ projectId, detail, scenes }: { projectId: string; detail: NarrativeSceneDetail; scenes: UseNarrativeScenesResult }) {
  const { members } = useMembersLite(projectId);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [due, setDue] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const progress = taskProgress(detail.tasks);

  const add = async () => {
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    setError(null);
    try {
      await scenes.addTask({ title: t, assigneeUserId: assignee, dueAt: dateInputToIso(due) });
      setTitle('');
      setDue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke legge til oppgaven.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 820 }}>
      {detail.tasks.length > 0 ? (
        <Box>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }}>{progress.done} av {progress.total} ferdig</Typography>
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim }} data-testid="narrative-scene-task-progress">{progress.pct}%</Typography>
          </Stack>
          <LinearProgress variant="determinate" value={progress.pct} sx={{ height: 6, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { bgcolor: narrativeColors.accent } }} />
        </Box>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flexWrap: 'wrap' }} useFlexGap>
        <TextField
          size="small" label="Ny oppgave" placeholder="F.eks. Lys-pass på skogen" value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }}
          error={!!error} helperText={error ?? undefined}
          inputProps={{ 'data-testid': 'narrative-scene-task-title', maxLength: 300 }} sx={{ ...sceneFieldSx, flex: 1, minWidth: 240 }}
        />
        <Box sx={{ minWidth: 200 }}><MemberPicker projectId={projectId} value={assignee} onChange={setAssignee} testId="narrative-scene-task-assignee" /></Box>
        <TextField size="small" type="date" label="Frist" value={due} onChange={(e) => setDue(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ 'data-testid': 'narrative-scene-task-due' }} sx={{ ...sceneFieldSx, width: 160 }} />
        <Button variant="contained" disabled={!title.trim() || adding} onClick={() => void add()} data-testid="narrative-scene-task-add" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>
          {adding ? 'Legger til…' : 'Legg til'}
        </Button>
      </Stack>

      {detail.tasks.length === 0 ? (
        <EmptyHint title="Ingen oppgaver ennå" body="Oppgaver er det konkrete arbeidet som må gjøres før scenen kan gå til review: lys, lyd, dialog, assets." testId="narrative-scene-tasks-empty" />
      ) : (
        <Stack spacing={0.5} data-testid="narrative-scene-task-list">
          {detail.tasks.map((t) => {
            const done = t.status === 'done';
            const overdue = isOverdue(t.dueAt, t.status);
            const assigneeMember = t.assigneeUserId ? memberById.get(t.assigneeUserId) ?? { displayName: t.assigneeUserId, profileImageUrl: null } : null;
            return (
              <Stack key={t.id} direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5, borderRadius: 1.5, bgcolor: narrativeColors.bgPanel, border: `1px solid ${narrativeColors.borderStrong}` }} data-testid={`narrative-scene-task-${t.id}`} data-status={t.status}>
                <Checkbox
                  size="small" checked={done}
                  onChange={(e) => void scenes.patchTask(t.id, { status: e.target.checked ? 'done' : 'todo' })}
                  inputProps={{ 'aria-label': `Merk «${t.title}» som ${done ? 'ikke ferdig' : 'ferdig'}`, 'data-testid': `narrative-scene-task-toggle-${t.id}` } as never}
                  sx={{ color: narrativeColors.textDim, '&.Mui-checked': { color: narrativeColors.accent } }}
                />
                <Typography sx={{ flex: 1, fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? narrativeColors.textDim : narrativeColors.text }}>{t.title}</Typography>
                {t.dueAt ? <Typography sx={{ fontSize: 11, color: overdue ? narrativeColors.error : narrativeColors.textDim, fontWeight: overdue ? 700 : 400 }}>{overdue ? 'Forfalt ' : ''}{formatShortDate(t.dueAt)}</Typography> : null}
                {assigneeMember ? <Tooltip title={assigneeMember.displayName}><Box><MemberAvatar member={assigneeMember} size={22} /></Box></Tooltip> : null}
                <Tooltip title="Slett oppgave"><IconButton size="small" onClick={() => void scenes.deleteTask(t.id)} sx={{ color: narrativeColors.textDim, '&:hover': { color: narrativeColors.error } }} aria-label="Slett oppgave"><DeleteIcon sx={{ fontSize: 15 }} /></IconButton></Tooltip>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
