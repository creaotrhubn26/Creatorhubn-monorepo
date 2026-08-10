/**
 * ChoreographyBuilderConnected — wraps the pure ChoreographyBuilder with
 * backend wiring AND a multi-choreography selector.
 *
 * Header bar: select active piece + "Nytt stykke" / "Dupliser" / "Slett".
 * The selected id is persisted in localStorage per project so reload
 * restores the user's last view.
 *
 * The plain ChoreographyBuilder stays storage-agnostic so it can keep
 * running in tests/demo with a fixture.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  ContentCopy as DuplicateIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { ChoreographyBuilder } from './ChoreographyBuilder';
import {
  createChoreography,
  deleteChoreography,
  getChoreography,
  listChoreographies,
  replaceSegments,
  updateChoreographyHeader,
  uploadChoreographyMusic,
  type ChoreographyHeader,
} from './choreographyService';
import type { Choreography } from './choreographyTypes';
import { useT } from '../../../i18n';
type TFn = ReturnType<typeof useT>['t'];

const PURPLE = danceFlowColors.lavenderDark;
const PURPLE_SOFT = 'rgba(139,92,246,0.18)';

export interface ChoreographyBuilderConnectedProps {
  /** Når null, jobber bygget mot eierens "frie" koreografier (project_id IS NULL). */
  projectId: string | null;
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; choreography: Choreography };

interface SavedHeader {
  title: string;
  choreographer: string | null;
  musicTitle: string | null;
  bpm: number | null;
  musicalKey: string | null;
  totalDurationSec: number;
}

function activeIdStorageKey(projectId: string | null): string {
  return `dance.activeChoreographyId.${projectId ?? 'no-project'}`;
}

function loadStoredActiveId(projectId: string | null): string | null {
  try {
    return window.localStorage.getItem(activeIdStorageKey(projectId));
  } catch {
    return null;
  }
}

function saveStoredActiveId(projectId: string | null, id: string | null): void {
  try {
    if (id) window.localStorage.setItem(activeIdStorageKey(projectId), id);
    else window.localStorage.removeItem(activeIdStorageKey(projectId));
  } catch {
    /* ignore — private mode etc. */
  }
}

function snapshotHeader(c: Choreography): SavedHeader {
  return {
    title: c.title,
    choreographer: c.choreographer ?? null,
    musicTitle: c.musicTitle ?? null,
    bpm: c.bpm ?? null,
    musicalKey: c.musicalKey ?? null,
    totalDurationSec: c.totalDurationSec,
  };
}

export function ChoreographyBuilderConnected({
  projectId,
}: ChoreographyBuilderConnectedProps): React.ReactElement {
  const { t } = useT();
  const [headers, setHeaders] = React.useState<ChoreographyHeader[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const lastSavedHeaderRef = React.useRef<SavedHeader | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createTitle, setCreateTitle] = React.useState('');
  const [createBusy, setCreateBusy] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [duplicateBusy, setDuplicateBusy] = React.useState(false);

  // ─── Initial load: list headers + restore active ─────────────────
  const refreshHeaders = React.useCallback(async (): Promise<ChoreographyHeader[]> => {
    return listChoreographies(projectId ?? undefined);
  }, [projectId]);

  const loadActive = React.useCallback(
    async (id: string): Promise<void> => {
      setState({ phase: 'loading' });
      try {
        const choreography = await getChoreography(id);
        lastSavedHeaderRef.current = snapshotHeader(choreography);
        setActiveId(id);
        saveStoredActiveId(projectId, id);
        setState({ phase: 'ready', choreography });
      } catch (err) {
        setState({
          phase: 'error',
          message: err instanceof Error ? err.message : t('choreoBuilderConn.s005'),
        });
      }
    },
    [projectId],
  );

  const initialLoad = React.useCallback(async (): Promise<void> => {
    setState({ phase: 'loading' });
    try {
      const list = await refreshHeaders();
      setHeaders(list);
      if (list.length === 0) {
        setActiveId(null);
        setState({ phase: 'empty' });
        return;
      }
      const stored = loadStoredActiveId(projectId);
      const target = stored && list.some((h) => h.id === stored) ? stored : list[0].id;
      await loadActive(target);
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : t('choreoBuilderConn.s006'),
      });
    }
  }, [projectId, refreshHeaders, loadActive]);

  React.useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  // Reload header list when active record's title/duration changes
  // (so the dropdown stays in sync without a full refetch).
  const updateHeaderInList = React.useCallback(
    (patched: { id: string } & Partial<ChoreographyHeader>) => {
      setHeaders((prev) =>
        prev.map((h) =>
          h.id === patched.id
            ? {
                ...h,
                title: patched.title ?? h.title,
                choreographer: patched.choreographer ?? h.choreographer,
                totalDurationSec: patched.totalDurationSec ?? h.totalDurationSec,
                segmentCount: patched.segmentCount ?? h.segmentCount,
                updatedAt: new Date().toISOString(),
              }
            : h,
        ),
      );
    },
    [],
  );

  // ─── Music upload handler ──────────────────────────────────────
  const handleUploadMusic = React.useCallback(
    async (file: File): Promise<Choreography> => {
      if (state.phase !== 'ready') {
        throw new Error(t('choreoBuilderConn.s001'));
      }
      const id = state.choreography.id;
      const updated = await uploadChoreographyMusic(id, file);
      lastSavedHeaderRef.current = snapshotHeader(updated);
      // Replace local state so the new musicUrl + storageKey + title surface
      // in the builder immediately.
      setState({ phase: 'ready', choreography: updated });
      updateHeaderInList({
        id: updated.id,
        title: updated.title,
        choreographer: updated.choreographer ?? null,
        totalDurationSec: updated.totalDurationSec,
        segmentCount: updated.segments.length,
      });
      return updated;
    },
    [state, updateHeaderInList],
  );

  // ─── Autosave handler ──────────────────────────────────────────
  const handleAutosave = React.useCallback(
    async (next: Choreography): Promise<void> => {
      await replaceSegments(next.id, next.segments);

      const last = lastSavedHeaderRef.current;
      const candidate = snapshotHeader(next);
      if (
        !last ||
        last.title !== candidate.title ||
        last.choreographer !== candidate.choreographer ||
        last.musicTitle !== candidate.musicTitle ||
        last.bpm !== candidate.bpm ||
        last.musicalKey !== candidate.musicalKey ||
        last.totalDurationSec !== candidate.totalDurationSec
      ) {
        await updateChoreographyHeader(next.id, candidate);
        lastSavedHeaderRef.current = candidate;
        updateHeaderInList({
          id: next.id,
          title: candidate.title,
          choreographer: candidate.choreographer,
          totalDurationSec: candidate.totalDurationSec,
          segmentCount: next.segments.length,
        });
      } else {
        updateHeaderInList({ id: next.id, segmentCount: next.segments.length });
      }
    },
    [updateHeaderInList],
  );

  // ─── Selector / actions ────────────────────────────────────────
  const handleSwitch = (id: string): void => {
    if (id === activeId) return;
    void loadActive(id);
  };

  const openCreate = (): void => {
    setCreateTitle(t('choreoBuilderConn.s010'));
    setCreateError(null);
    setCreateOpen(true);
  };

  const submitCreate = async (): Promise<void> => {
    const title = createTitle.trim();
    if (!title) {
      setCreateError(t('choreoBuilderConn.s017'));
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    try {
      const created = await createChoreography({
        title,
        totalDurationSec: 180,
        projectId: projectId ?? null,
      });
      setCreateOpen(false);
      setCreateTitle('');
      // Insert into header list at the top, switch active.
      const newHeader: ChoreographyHeader = {
        id: created.id,
        ownerUserId: '', // unknown to client; not used in UI
        projectId: created.projectId ?? null,
        title: created.title,
        choreographer: created.choreographer ?? null,
        totalDurationSec: created.totalDurationSec,
        segmentCount: created.segments.length,
        updatedAt: new Date().toISOString(),
      };
      setHeaders((prev) => [newHeader, ...prev]);
      lastSavedHeaderRef.current = snapshotHeader(created);
      setActiveId(created.id);
      saveStoredActiveId(projectId, created.id);
      setState({ phase: 'ready', choreography: created });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : t('choreoBuilderConn.s007'));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDuplicate = async (): Promise<void> => {
    if (state.phase !== 'ready') return;
    const source = state.choreography;
    setDuplicateBusy(true);
    try {
      // Create with a "Kopi av …" title.
      const copy = await createChoreography({
        title: `Kopi av ${source.title}`,
        choreographer: source.choreographer ?? null,
        musicTitle: source.musicTitle ?? null,
        bpm: source.bpm ?? null,
        musicalKey: source.musicalKey ?? null,
        totalDurationSec: source.totalDurationSec,
        projectId: projectId ?? null,
      });
      // Replicate segments via replaceSegments so the duplicate has content.
      if (source.segments.length > 0) {
        await replaceSegments(copy.id, source.segments);
      }
      const fresh = await getChoreography(copy.id);
      const newHeader: ChoreographyHeader = {
        id: fresh.id,
        ownerUserId: '',
        projectId: fresh.projectId ?? null,
        title: fresh.title,
        choreographer: fresh.choreographer ?? null,
        totalDurationSec: fresh.totalDurationSec,
        segmentCount: fresh.segments.length,
        updatedAt: new Date().toISOString(),
      };
      setHeaders((prev) => [newHeader, ...prev]);
      lastSavedHeaderRef.current = snapshotHeader(fresh);
      setActiveId(fresh.id);
      saveStoredActiveId(projectId, fresh.id);
      setState({ phase: 'ready', choreography: fresh });
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err instanceof Error ? err.message : t('choreoBuilderConn.s004'));
    } finally {
      setDuplicateBusy(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (state.phase !== 'ready') return;
    const id = state.choreography.id;
    const title = state.choreography.title;
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('choreoBuilderConn.p00', { v0: title }))) return;
    setDeleteBusy(true);
    try {
      await deleteChoreography(id);
      const remaining = headers.filter((h) => h.id !== id);
      setHeaders(remaining);
      saveStoredActiveId(projectId, null);
      if (remaining.length === 0) {
        setActiveId(null);
        setState({ phase: 'empty' });
      } else {
        await loadActive(remaining[0].id);
      }
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(err instanceof Error ? err.message : t('choreoBuilderConn.s008'));
    } finally {
      setDeleteBusy(false);
    }
  };

  // ─── Render header bar (always visible above builder) ──────────
  const renderHeaderBar = (): React.ReactElement => (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1.5,
        py: 1,
        bgcolor: '#0d0d10',
        borderBottom: `1px solid ${PURPLE_SOFT}`,
        flexWrap: 'wrap',
        gap: 1,
      }}
    >
      <Typography
        sx={{
          fontSize: 10,
          letterSpacing: 2,
          color: danceFlowColors.lavender,
          fontWeight: 700,
          mr: 0.5,
        }}
      >
        STYKKE
      </Typography>
      {headers.length > 0 ? (
        <TextField
          select
          size="small"
          value={activeId ?? ''}
          onChange={(e) => handleSwitch(e.target.value)}
          sx={{
            minWidth: 220,
            '& .MuiInputBase-root': {
              bgcolor: 'rgba(139,92,246,0.08)',
              color: '#fff',
              fontWeight: 600,
            },
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: PURPLE_SOFT,
            },
            '& .MuiSvgIcon-root': { color: danceFlowColors.lavender },
          }}
          data-testid="choreography-selector"
        >
          {headers.map((h) => (
            <MenuItem key={h.id} value={h.id} data-testid={`piece-item-${h.id}`}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                <span style={{ flex: 1 }}>{h.title}</span>
                <Chip
                  size="small"
                  label={`${h.segmentCount} seg`}
                  sx={{ height: 18, fontSize: 11, bgcolor: 'rgba(139,92,246,0.12)' }}
                />
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.6)' }}>
          {t('choreoBuilderConn.s002')}
        </Typography>
      )}
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={openCreate}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          color: '#fff',
          bgcolor: PURPLE,
          '&:hover': { bgcolor: danceFlowColors.lavenderDeep },
        }}
        data-testid="choreography-new"
      >
        {t('choreoBuilderConn.s010')}
      </Button>
      {state.phase === 'ready' ? (
        <>
          <Tooltip title="Dupliser stykket">
            <span>
              <IconButton
                size="small"
                onClick={() => void handleDuplicate()}
                disabled={duplicateBusy}
                sx={{ color: danceFlowColors.lavender }}
                data-testid="choreography-duplicate"
              >
                <DuplicateIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('choreoBuilderConn.s015')}>
            <span>
              <IconButton
                size="small"
                onClick={() => void handleDelete()}
                disabled={deleteBusy}
                sx={{ color: danceFlowColors.errorStrong }}
                data-testid="choreography-delete"
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      ) : null}
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption" sx={{ color: 'text.disabled' }}>
        {headers.length} {headers.length === 1 ? 'stykke' : 'stykker'} {t('choreoBuilderConn.s018')}
      </Typography>
    </Stack>
  );

  // ─── Body render ──────────────────────────────────────────────
  let body: React.ReactElement;
  if (state.phase === 'loading') {
    body = (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ minHeight: 240, color: danceFlowColors.lavender }}
      >
        <CircularProgress size={28} sx={{ color: PURPLE }} />
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)' }}>
          {t('choreoBuilderConn.s009')}
        </Typography>
      </Stack>
    );
  } else if (state.phase === 'error') {
    body = (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void initialLoad()}>
              {t('choreoBuilderConn.s014')}
            </Button>
          }
        >
          {state.message}
        </Alert>
      </Box>
    );
  } else if (state.phase === 'empty') {
    body = (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ minHeight: 320, p: 4, color: 'rgba(229,231,235,0.85)' }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }}>
          {t('choreoBuilderConn.s003')}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)', textAlign: 'center', maxWidth: 480 }}>
          {t('choreoBuilderConn.s012')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{
            bgcolor: PURPLE,
            '&:hover': { bgcolor: danceFlowColors.lavenderDeep },
            textTransform: 'none',
            fontWeight: 600,
          }}
          data-testid="choreography-empty-cta"
        >
          {t('choreoBuilderConn.s013')}
        </Button>
      </Stack>
    );
  } else {
    body = (
      <ChoreographyBuilder
        // Force remount when active id changes so internal state resets.
        key={state.choreography.id}
        initialChoreography={state.choreography}
        onAutosave={handleAutosave}
        onUploadMusic={handleUploadMusic}
      />
    );
  }

  return (
    <Box>
      {renderHeaderBar()}
      {body}
      <Dialog
        open={createOpen}
        onClose={createBusy ? undefined : () => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t('choreoBuilderConn.s010')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('choreoBuilderConn.s016')}
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              autoFocus
              fullWidth
              size="small"
              data-testid="choreography-new-title"
            />
            {createError ? <Alert severity="error">{createError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={createBusy}>
            {t('choreoBuilderConn.s000')}
          </Button>
          <Button
            onClick={() => void submitCreate()}
            variant="contained"
            disabled={createBusy}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: danceFlowColors.lavenderDeep } }}
            data-testid="choreography-new-submit"
          >
            {createBusy ? 'Oppretter…' : t('choreoBuilderConn.s011')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChoreographyBuilderConnected;
