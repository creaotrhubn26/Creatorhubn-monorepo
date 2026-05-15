/**
 * RehearsalPlannerConnected — wraps RehearsalPlanner with backend wiring.
 *
 * - Fetches the active choreography (synced via the same localStorage key
 *   as ChoreographyBuilderConnected) and its segments.
 * - Loads the most recent rehearsal for that choreography, or creates
 *   one if none exist.
 * - Pipes the planner's `onChange` through a 1.5s debounced PATCH to
 *   `/api/dance/rehearsals/:id`. When a segmentReview transitions to
 *   `outcome: 'approved'`, the backend ALSO bumps the corresponding
 *   choreography_segment.approval = 'approved' atomically. Slice 7's
 *   key payoff: koreografen markerer "godkjent" én gang i prøveloggen,
 *   og timelinen oppdaterer seg ved neste lasting.
 *
 * Dancers + formations are sourced from the project so puck/initials
 * match the rest of the dance vertical.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  CloudDone as SavedIcon,
  CloudOff as ErrorIcon,
  CloudSync as SavingIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { RehearsalPlanner } from './RehearsalPlanner';
import {
  listRehearsals,
  createRehearsal,
  patchRehearsal,
  recordToRehearsal,
  rehearsalToPatch,
  type RehearsalRecord,
} from './danceRehearsalService';
import {
  listChoreographies,
  getChoreography,
  createChoreography,
} from './choreographyService';
import {
  listFormations,
  recordToFormation,
} from './danceFormationService';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';
import type { Choreography } from './choreographyTypes';
import type { Rehearsal } from './rehearsalTypes';
import type { Dancer, Formation } from './formationTypes';
import { getInitials } from './dancerProfile';

const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const AUTOSAVE_DEBOUNCE_MS = 1500;
const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#a855f7', '#f43f5e',
];

export interface RehearsalPlannerConnectedProps {
  /** Når null, henter wrapperen koreografier på tvers av prosjekter. */
  projectId: string | null;
  onOpenDancerProfile?: (dancerId: string) => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ReadyState {
  phase: 'ready';
  choreography: Choreography;
  rehearsal: Rehearsal;
  rehearsalRecord: RehearsalRecord;
  dancers: Dancer[];
  formations: Formation[];
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string }
  | ReadyState;

function activeIdStorageKey(projectId: string | null): string {
  return `dance.activeChoreographyId.${projectId ?? 'no-project'}`;
}

function loadStoredActiveChoreographyId(projectId: string | null): string | null {
  try { return window.localStorage.getItem(activeIdStorageKey(projectId)); }
  catch { return null; }
}

function profilesToDancers(profiles: DancerProfile[]): Dancer[] {
  return profiles.map((p, idx) => {
    const name = p.displayName ?? p.dancerId;
    return {
      id: p.dancerId,
      name,
      initials: getInitials(name),
      color: PALETTE[idx % PALETTE.length],
      role: p.primaryStyle ?? undefined,
    };
  });
}

function defaultRehearsalScheduledAt(): string {
  // Next Saturday at 18:00 — friendly default for "ny prøve".
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + ((6 - now.getDay() + 7) % 7 || 7));
  next.setHours(18, 0, 0, 0);
  return next.toISOString();
}

export function RehearsalPlannerConnected({
  projectId,
  onOpenDancerProfile,
}: RehearsalPlannerConnectedProps): React.ReactElement {
  const [state, setState] = React.useState<LoadState>({ phase: 'loading' });
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = React.useRef<Rehearsal | null>(null);

  const initialLoad = React.useCallback(async (): Promise<void> => {
    setState({ phase: 'loading' });
    try {
      // 1) Resolve the active choreography (matching Slice 2 selector).
      const headers = await listChoreographies(projectId ?? undefined);
      let choreography: Choreography;
      if (headers.length > 0) {
        const stored = loadStoredActiveChoreographyId(projectId);
        const targetId = stored && headers.some((h) => h.id === stored)
          ? stored
          : headers[0].id;
        choreography = await getChoreography(targetId);
      } else {
        // Auto-create a "Nytt stykke" so the planner is usable from a blank
        // project without forcing the user to bounce to the Pieces tab.
        choreography = await createChoreography({
          title: 'Nytt stykke',
          totalDurationSec: 180,
          projectId: projectId ?? null,
        });
      }

      // 2) Resolve dancers + formations in parallel.
      const [profiles, formationRecords] = await Promise.all([
        listDancerProfiles(projectId ?? undefined),
        listFormations(projectId ?? undefined),
      ]);
      const dancers = profilesToDancers(profiles);
      const formations: Formation[] = formationRecords
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(recordToFormation);

      // 3) Resolve the active rehearsal (most recent for this choreography).
      const existingRehearsals = await listRehearsals({
        choreographyId: choreography.id,
        limit: 50,
      });
      let activeRecord: RehearsalRecord;
      if (existingRehearsals.length > 0) {
        activeRecord = existingRehearsals[0];
      } else {
        activeRecord = await createRehearsal({
          choreographyId: choreography.id,
          title: 'Prøve 1',
          scheduledAt: defaultRehearsalScheduledAt(),
          estimatedMinutes: 90,
          status: 'planned',
          projectId: projectId ?? null,
        });
      }

      setState({
        phase: 'ready',
        choreography,
        rehearsal: recordToRehearsal(activeRecord),
        rehearsalRecord: activeRecord,
        dancers,
        formations,
      });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Kunne ikke laste prøvelogg',
      });
    }
  }, [projectId]);

  React.useEffect(() => {
    void initialLoad();
  }, [initialLoad]);

  // ─── Debounced autosave ───────────────────────────────────────
  const flushPatch = React.useCallback(async (): Promise<void> => {
    const pending = pendingPatchRef.current;
    pendingPatchRef.current = null;
    if (!pending) return;
    if (state.phase !== 'ready') return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const updated = await patchRehearsal(pending.id, rehearsalToPatch(pending));
      // Adopt server-side state — covers updated_at + any normalization.
      setState((prev) => {
        if (prev.phase !== 'ready' || prev.rehearsal.id !== updated.id) return prev;
        return {
          ...prev,
          rehearsal: recordToRehearsal(updated),
          rehearsalRecord: updated,
        };
      });
      // After a successful save, re-fetch the choreography in case any
      // segment reviews flipped approval. Don't block the UI on this.
      void getChoreography(updated.choreographyId)
        .then((fresh) => {
          setState((prev) => {
            if (prev.phase !== 'ready' || prev.choreography.id !== fresh.id) return prev;
            return { ...prev, choreography: fresh };
          });
        })
        .catch(() => { /* ignore — non-critical */ });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre');
    }
  }, [state]);

  const handleRehearsalChange = React.useCallback(
    (next: Rehearsal): void => {
      if (state.phase !== 'ready') return;
      // Update local state optimistically so the UI feels snappy.
      setState((prev) => {
        if (prev.phase !== 'ready') return prev;
        return { ...prev, rehearsal: next };
      });
      pendingPatchRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushPatch();
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [state, flushPatch],
  );

  React.useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // Force-flush pending changes on unmount so navigating away doesn't
  // drop the last edit.
  React.useEffect(() => {
    return () => {
      if (pendingPatchRef.current) {
        void flushPatch();
      }
    };
    // We intentionally only run this on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.phase === 'loading') {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ minHeight: 320, color: PURPLE_LIGHT }}
      >
        <CircularProgress size={28} sx={{ color: PURPLE }} />
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)' }}>
          Laster prøvelogg…
        </Typography>
      </Stack>
    );
  }

  if (state.phase === 'error') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void initialLoad()}>
              Prøv igjen
            </Button>
          }
        >
          {state.message}
        </Alert>
      </Box>
    );
  }

  if (state.phase === 'empty') {
    return (
      <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ minHeight: 320 }}>
        <Typography sx={{ fontWeight: 700 }}>Ingen koreografier i prosjektet ennå.</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => void initialLoad()}
          sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none' }}
        >
          Last på nytt
        </Button>
      </Stack>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ position: 'absolute', top: 12, right: 16, zIndex: 5 }}
      >
        {saveStatus === 'saving' ? (
          <Chip
            icon={<SavingIcon sx={{ fontSize: 16 }} />}
            label="Lagrer…"
            size="small"
            sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 600 }}
          />
        ) : null}
        {saveStatus === 'saved' ? (
          <Chip
            icon={<SavedIcon sx={{ fontSize: 16 }} />}
            label="Lagret"
            size="small"
            sx={{ bgcolor: 'rgba(16,185,129,0.18)', color: '#10b981', fontWeight: 600 }}
          />
        ) : null}
        {saveStatus === 'error' ? (
          <Chip
            icon={<ErrorIcon sx={{ fontSize: 16 }} />}
            label={saveError ?? 'Lagring feilet'}
            size="small"
            sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#fca5a5', fontWeight: 600 }}
          />
        ) : null}
      </Stack>
      <RehearsalPlanner
        // Force remount when active rehearsal id changes so internal state
        // resets cleanly.
        key={state.rehearsal.id}
        rehearsal={state.rehearsal}
        choreography={state.choreography}
        dancers={state.dancers}
        formations={state.formations}
        onChange={handleRehearsalChange}
        onOpenDancerProfile={onOpenDancerProfile}
      />
    </Box>
  );
}

export default RehearsalPlannerConnected;
