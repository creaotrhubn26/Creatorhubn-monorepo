/**
 * ScenesPanel — «Scener & gameplay»: sceneliste (venstre) + scenekort (høyre).
 *
 * Progressive disclosure: lista viser bare det som trengs for å velge
 * (kode, tittel, status, ansvarlig, frist); alt annet bor i kortets faner.
 * «Ny scene» foreslår neste kode og sier fra FØR lagring om koden er i bruk.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, List, ListItemButton, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon } from '@mui/icons-material';
import { narrativeColors } from '../narrativeTheme';
import type { NarrativeGraph, NarrativeSceneStatus, NarrativeSceneSummary } from '../narrativeTypes';
import { NarrativeApiError } from '../narrativeService';
import { useNarrativeScenes } from './useNarrativeScenes';
import {
  SCENE_STATUS_COLORS, SCENE_STATUS_LABELS, filterScenes, formatShortDate, isDuplicateCode, isOverdue, isValidSceneCode, normalizeSceneCode,
} from './sceneOps';
import { SceneStatusChip, sceneFieldSx } from './sceneUi';
import { MemberAvatar, useMembersLite } from '../components/MemberPicker';
import { SceneCard } from './SceneCard';
import { ImportDocumentDialog } from './ImportDocumentDialog';

export interface ScenesPanelProps {
  projectId: string;
  graph: NarrativeGraph;
  /** Bumpes av workspacet ved sanntids-push (kind = 'scene'). */
  refreshKey: number;
  onJumpToElement: (elementId: string) => void;
  onNotice: (message: string, severity: 'error' | 'warning' | 'success') => void;
}

function readUrl(name: string): string | null {
  try { return new URLSearchParams(window.location.search).get(name); } catch { return null; }
}
function writeUrl(name: string, value: string | null): void {
  try {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
    window.history.replaceState({}, '', url.toString());
  } catch { /* ignore */ }
}

const STATUS_FILTERS: Array<NarrativeSceneStatus | 'all'> = ['all', 'idea', 'in_progress', 'in_review', 'changes_requested', 'approved', 'implemented'];

export function ScenesPanel({ projectId, graph, refreshKey, onJumpToElement, onNotice }: ScenesPanelProps) {
  const scenes = useNarrativeScenes(projectId, { refreshKey, initialSelectedId: readUrl('scene') });
  const { members } = useMembersLite(projectId);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<NarrativeSceneStatus | 'all'>('all');
  const visible = useMemo(() => filterScenes(scenes.scenes, { query, status }), [scenes.scenes, query, status]);

  useEffect(() => { writeUrl('scene', scenes.selectedId); }, [scenes.selectedId]);

  // ─── Fase 8b: manusimport ──────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);

  // ─── Ny scene ──────────────────────────────────────────────────────
  const [newOpen, setNewOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const existingCodes = useMemo(() => scenes.scenes.map((s) => s.code), [scenes.scenes]);
  const codeDuplicate = isDuplicateCode(newCode, existingCodes);
  const codeInvalid = newCode.trim() !== '' && !isValidSceneCode(newCode);
  const codeHelp = codeDuplicate ? `«${normalizeSceneCode(newCode)}» er allerede i bruk.` : codeInvalid ? '1–3 bokstaver + 1–4 sifre, f.eks. S12 eller B3.' : 'Foreslått automatisk — kan endres.';
  const canCreate = !creating && !codeDuplicate && !codeInvalid;

  const openNew = useCallback(() => {
    setNewCode(scenes.nextCode);
    setNewTitle('');
    setCreateError(null);
    setNewOpen(true);
  }, [scenes.nextCode]);

  const submitNew = useCallback(async () => {
    if (!canCreate) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await scenes.createScene({ code: newCode.trim() ? normalizeSceneCode(newCode) : null, title: newTitle.trim() });
      setNewOpen(false);
      scenes.select(created.id);
      onNotice(`Scene ${created.code} opprettet.`, 'success');
    } catch (err) {
      if (err instanceof NarrativeApiError && err.code === 'duplicate_code') setCreateError('Koden ble tatt i bruk av noen andre akkurat nå — velg en annen.');
      else setCreateError(err instanceof Error ? err.message : 'Kunne ikke opprette scenen.');
    } finally {
      setCreating(false);
    }
  }, [canCreate, scenes, newCode, newTitle, onNotice]);

  const renderRow = (s: NarrativeSceneSummary) => {
    const assignee = s.assigneeUserId ? memberById.get(s.assigneeUserId) ?? { displayName: s.assigneeUserId, profileImageUrl: null } : null;
    const overdue = isOverdue(s.dueAt, s.status);
    const selected = s.id === scenes.selectedId;
    return (
      <ListItemButton
        key={s.id}
        selected={selected}
        onClick={() => scenes.select(s.id)}
        data-testid={`narrative-scene-row-${s.id}`}
        sx={{
          borderRadius: 1.5, mb: 0.5, alignItems: 'flex-start', gap: 1, py: 1,
          borderLeft: `3px solid ${selected ? narrativeColors.accent : 'transparent'}`,
          '&.Mui-selected': { bgcolor: 'rgba(34,197,94,0.08)' },
          '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: narrativeColors.accent, letterSpacing: 0.5, flexShrink: 0 }}>{s.code}</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: narrativeColors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || 'Uten tittel'}</Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
            <SceneStatusChip status={s.status} />
            {s.taskCounts.total > 0 ? <Typography sx={{ fontSize: 11, color: narrativeColors.textDim }}>{s.taskCounts.done}/{s.taskCounts.total} oppgaver</Typography> : null}
            {s.dueAt ? <Typography sx={{ fontSize: 11, color: overdue ? narrativeColors.error : narrativeColors.textDim, fontWeight: overdue ? 700 : 400 }} data-testid={overdue ? `narrative-scene-overdue-${s.id}` : undefined}>{overdue ? 'Forfalt ' : ''}{formatShortDate(s.dueAt)}</Typography> : null}
          </Stack>
        </Box>
        {assignee ? <Tooltip title={assignee.displayName}><Box><MemberAvatar member={assignee} size={24} /></Box></Tooltip> : null}
      </ListItemButton>
    );
  };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 150px)', color: narrativeColors.text }} data-testid="narrative-scenes-panel">
      {/* ── Liste ─────────────────────────────────────────────────────── */}
      <Box sx={{ width: 320, flexShrink: 0, borderRight: `1px solid ${narrativeColors.borderStrong}`, bgcolor: narrativeColors.bgPanel, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${narrativeColors.borderStrong}` }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14, flex: 1 }}>Scener <Typography component="span" sx={{ fontSize: 12, color: narrativeColors.textDim }}>({scenes.scenes.length})</Typography></Typography>
            <Tooltip title="Importer manus (Word/PDF/Markdown) — vises som diff før noe skrives">
              <Button size="small" variant="outlined" onClick={() => setImportOpen(true)} data-testid="narrative-import-open" sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent, minWidth: 0, px: 1 }}>Importer</Button>
            </Tooltip>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openNew} data-testid="narrative-scene-new" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>Ny scene</Button>
          </Stack>
          <TextField
            size="small" fullWidth placeholder="Søk kode, tittel, lokasjon" value={query} onChange={(e) => setQuery(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: narrativeColors.textDim }} /></InputAdornment> }}
            inputProps={{ 'data-testid': 'narrative-scenes-search' }} sx={sceneFieldSx}
          />
          <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: 'wrap' }} useFlexGap>
            {STATUS_FILTERS.map((f) => {
              const active = status === f;
              const color = f === 'all' ? narrativeColors.accent : SCENE_STATUS_COLORS[f];
              return (
                <Chip
                  key={f} size="small" label={f === 'all' ? 'Alle' : SCENE_STATUS_LABELS[f]} onClick={() => setStatus(f)} data-testid={`narrative-scenes-filter-${f}`}
                  sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: active ? `${color}33` : 'transparent', color: active ? color : narrativeColors.textDim, border: `1px solid ${active ? color : narrativeColors.borderStrong}` }}
                />
              );
            })}
          </Stack>
        </Box>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
          {scenes.loading && scenes.scenes.length === 0 ? (
            <Stack spacing={1} data-testid="narrative-scenes-loading">{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={52} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />)}</Stack>
          ) : scenes.error ? (
            <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => void scenes.reload()} data-testid="narrative-scenes-retry">Prøv igjen</Button>} data-testid="narrative-scenes-error">{scenes.error}</Alert>
          ) : scenes.scenes.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }} data-testid="narrative-scenes-empty">
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Ingen scener ennå</Typography>
              <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, mt: 0.5, mb: 1.5 }}>En scene samler lokasjon, utfordring, spillmekanikk, storyboard, oppgaver og review — koblet til elementene i Story Graph.</Typography>
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openNew} sx={{ color: narrativeColors.accent, borderColor: narrativeColors.accent }}>Opprett første scene</Button>
            </Box>
          ) : visible.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: narrativeColors.textDim, p: 2, textAlign: 'center' }} data-testid="narrative-scenes-nomatch">Ingen scener matcher søket.</Typography>
          ) : (
            <List dense disablePadding>{visible.map(renderRow)}</List>
          )}
        </Box>
      </Box>

      {/* ── Kort ──────────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {!scenes.selectedId ? (
          <Box sx={{ p: 6, textAlign: 'center', color: narrativeColors.textDim }} data-testid="narrative-scene-none">
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: narrativeColors.text }}>Velg en scene</Typography>
            <Typography sx={{ fontSize: 12, mt: 0.5 }}>…eller opprett en ny for å komme i gang.</Typography>
          </Box>
        ) : scenes.detailError && !scenes.detail ? (
          <Box sx={{ p: 4 }}>
            <Alert severity="error" action={<Button size="small" color="inherit" onClick={() => void scenes.reloadDetail()}>Prøv igjen</Button>} data-testid="narrative-scene-error">{scenes.detailError}</Alert>
          </Box>
        ) : !scenes.detail ? (
          <Box sx={{ p: 3 }} data-testid="narrative-scene-loading">
            <Skeleton variant="text" width={280} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
            <Skeleton variant="rounded" height={220} sx={{ bgcolor: 'rgba(255,255,255,0.06)', mt: 2 }} />
          </Box>
        ) : (
          <SceneCard projectId={projectId} graph={graph} detail={scenes.detail} scenes={scenes} onJumpToElement={onJumpToElement} onNotice={onNotice} />
        )}
      </Box>

      {/* ── Manusimport (Fase 8b) ─────────────────────────────────────── */}
      <ImportDocumentDialog
        open={importOpen} projectId={projectId} onClose={() => setImportOpen(false)}
        onApplied={(result) => {
          void scenes.reload();
          onNotice(`Manus importert: ${result.createdSceneIds.length} nye og ${result.updatedSceneIds.length} oppdaterte scener.`, 'success');
        }}
      />

      {/* ── Ny scene-dialog ───────────────────────────────────────────── */}
      <Dialog open={newOpen} onClose={() => !creating && setNewOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { bgcolor: narrativeColors.bgPanel, color: narrativeColors.text, border: `1px solid ${narrativeColors.borderStrong}` }, 'data-testid': 'narrative-scene-new-dialog' } as never}>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 800 }}>Ny scene</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <TextField
              size="small" label="Kode" value={newCode} autoFocus
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              error={codeDuplicate || codeInvalid} helperText={codeHelp}
              inputProps={{ 'data-testid': 'narrative-scene-new-code', maxLength: 7 }} sx={sceneFieldSx}
            />
            <TextField
              size="small" label="Tittel" value={newTitle} placeholder="F.eks. Skogpassasjen"
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void submitNew(); } }}
              inputProps={{ 'data-testid': 'narrative-scene-new-title', maxLength: 300 }} sx={sceneFieldSx}
            />
            {createError ? <Alert severity="error" data-testid="narrative-scene-new-error">{createError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)} disabled={creating} sx={{ color: narrativeColors.textDim }}>Avbryt</Button>
          <Button variant="contained" onClick={() => void submitNew()} disabled={!canCreate} data-testid="narrative-scene-new-submit" sx={{ bgcolor: narrativeColors.accent, color: '#04140a', fontWeight: 700, '&:hover': { bgcolor: narrativeColors.accentDark } }}>
            {creating ? 'Oppretter…' : 'Opprett'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
