/**
 * FormationViewConnected — wraps FormationView with backend persistence.
 *
 * On mount: fetch the project's formation list. If none exist, seed with
 * one empty starter formation so the editor is usable immediately.
 *
 * On change: debounce 1.2s, then call replaceFormations to atomic-replace
 * the (owner, project) scope. The save status is surfaced as a small
 * indicator pill at the top of the editor.
 *
 * Dancers are sourced from the project's dancer profiles, so the puck
 * names/colors match the rest of the dance vertical.
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  CloudDone as SavedIcon,
  CloudOff as ErrorIcon,
  CloudSync as SavingIcon,
} from '@mui/icons-material';
import { FormationView, type FormationViewHandle } from './FormationView';
import {
  listFormations,
  replaceFormations,
  recordToFormation,
  FormationVersionConflictError,
  type FormationRecord,
} from './danceFormationService';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';
import type { Dancer, Formation } from './formationTypes';
import { getInitials } from './dancerProfile';
import {
  listTimelineItems,
  createTimelineItem,
  patchTimelineItem,
  deleteTimelineItem,
  type TimelineItemRecord,
} from './danceTimelineItemService';
import TimelineItemModal from './TimelineItemModal';

const PURPLE = '#8b5cf6';
const AUTOSAVE_DEBOUNCE_MS = 1200;

export interface FormationViewConnectedProps {
  /** Når null, jobber editoren mot eierens "frie" formasjoner (project_id IS NULL). */
  projectId: string | null;
  /** Valgfri callback for double-click på en danser-puck. */
  onDancerClick?: (dancerId: string) => void;
  /** Phase 2: når true, skjul intern save-pill (FormationHeaderBar viser den). */
  hideSavePill?: boolean;
  /**
   * Phase 2 + audit A5: bobler opp save-status + lastSavedAt så parent
   * (DanceWorkspace) kan vise pill i header med 'Sist lagret kl 14:32'.
   */
  onSaveStatusChange?: (status: SaveStatus, error: string | null, lastSavedAt: number | null) => void;
  /** Phase 4: video-panel-slot videresendes til FormationView. */
  videoPanelSlot?: React.ReactNode;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface LoadState {
  phase: 'loading' | 'ready' | 'error';
  message?: string;
}

const PALETTE = [
  '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899',
  '#06b6d4', '#f97316', '#84cc16', '#a855f7', '#f43f5e',
];

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

function emptyStarterFormation(): Formation {
  return {
    id: `f-tmp-${Date.now()}`,
    name: 'Formasjon A',
    notes: 'Startformasjon — flytt dansere fra rosteren inn på scenen.',
    positions: [],
    createdAt: new Date().toISOString(),
  };
}

export function FormationViewConnected({
  projectId,
  onDancerClick,
  hideSavePill = false,
  onSaveStatusChange,
  videoPanelSlot,
}: FormationViewConnectedProps): React.ReactElement {
  const [load, setLoad] = React.useState<LoadState>({ phase: 'loading' });
  const [dancers, setDancers] = React.useState<Dancer[]>([]);
  const [initialFormations, setInitialFormations] = React.useState<Formation[] | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // G18: time-anchored notes + movements på timelinen.
  const [timelineItems, setTimelineItems] = React.useState<TimelineItemRecord[]>([]);
  const [modalOpen, setModalOpen] = React.useState<boolean>(false);
  const [modalEditing, setModalEditing] = React.useState<TimelineItemRecord | null>(null);
  const [modalDefaultStart, setModalDefaultStart] = React.useState<number>(0);
  // Audit A5: persistent timestamp som overlever 'saved'→'idle'-fade.
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);

  // Phase 2 + A5: bobler save-state + sist-lagret opp så header kan vise pillen.
  React.useEffect(() => {
    onSaveStatusChange?.(saveStatus, saveError, lastSavedAt);
  }, [saveStatus, saveError, lastSavedAt, onSaveStatusChange]);

  // Audit A6: blokker window-close mens autosave pågår.
  React.useEffect(() => {
    if (saveStatus !== 'saving' && saveStatus !== 'error') return;
    const handler = (e: BeforeUnloadEvent): string => {
      // saving = endringer i flyt, error = endringer ikke persistert.
      e.preventDefault();
      // Eldre browsers krever returnValue + returnert string.
      e.returnValue = 'Endringer holder på å lagres. Vent et øyeblikk før du forlater siden.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveStatus]);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstChangeRef = React.useRef(true);
  // G_1: imperativ ref til FormationView for ID-reconcile post-save.
  const viewRef = React.useRef<FormationViewHandle | null>(null);
  // G_1: ikke kjør ny save mens en er in-flight — queue pending state i stedet.
  const inFlightRef = React.useRef(false);
  const pendingNextRef = React.useRef<Formation[] | null>(null);
  // G_1: hopp neste handleFormationsChange ETTER vi har applyIdMapping —
  // reconcile er identisk med backend, ingen ny save trengs.
  const skipNextChangeRef = React.useRef(false);

  // Load profiles + formations + timeline-items i parallel.
  const refresh = React.useCallback(async (): Promise<void> => {
    setLoad({ phase: 'loading' });
    try {
      const [profiles, records, items] = await Promise.all([
        listDancerProfiles(projectId ?? undefined),
        listFormations(projectId ?? undefined),
        listTimelineItems({ projectId: projectId ?? undefined }).catch(() => [] as TimelineItemRecord[]),
      ]);
      setDancers(profilesToDancers(profiles));
      const sorted = [...records].sort((a, b) => a.displayOrder - b.displayOrder);
      setInitialFormations(
        sorted.length > 0
          ? sorted.map(recordToFormation)
          : [emptyStarterFormation()],
      );
      setTimelineItems(items);
      setLoad({ phase: 'ready' });
    } catch (err) {
      setLoad({
        phase: 'error',
        message: err instanceof Error ? err.message : 'Kunne ikke laste formasjoner',
      });
    }
  }, [projectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // G_1: utfør én save-runde. Track temp-IDs som ble sendt, og etter respons
  // applyIdMapping på FormationView slik at fremtidige saves bare UPDATE'er
  // (i stedet for å lage duplikate INSERTs med samme positions).
  const performSave = React.useCallback(async (next: Formation[]): Promise<void> => {
    if (inFlightRef.current) {
      // En save er allerede underveis — buffer denne for å kjøres etterpå.
      pendingNextRef.current = next;
      return;
    }
    inFlightRef.current = true;
    setSaveStatus('saving');
    setSaveError(null);
    // Snapshot av IDs vi sender — brukes til reconciliation etter response.
    const sentInputs = next.map((f, i) => ({
      clientId: f.id,
      payload: {
        id: f.id.startsWith('f-tmp-') ? undefined : f.id,
        label: f.name,
        notes: f.notes ?? null,
        positions: f.positions.map((p) => ({ ...p })),
        displayOrder: i,
        startSec: f.startSec ?? null,
        endSec: f.endSec ?? null,
        transitionNote: f.transitionNote ?? null,
        tags: f.tags ?? [],
        transitionPaths: f.transitionPaths ?? [],
        // Migrasjon 214 (G14)
        locked: f.locked === true,
        // Migrasjon 215 (A2): send forventet version slik at backend kan
        // oppdage konkurrerende edits (returnerer 409). Bare når vi har en
        // server-tildelt version (ikke for nye f-tmp-* som backend genererer).
        expectedVersion: !f.id.startsWith('f-tmp-') && typeof f.version === 'number'
          ? f.version
          : undefined,
      },
    }));
    try {
      const written = await replaceFormations({
        projectId: projectId ?? null,
        formations: sentInputs.map((s) => s.payload),
      });
      if (written.length > 0) {
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
        setTimeout(() => setSaveStatus('idle'), 1800);
        // G_1: bygg mapping client-temp-id → server-assigned-id og bruk
        // applyIdMapping så vi ikke sender de samme f-tmp-* på neste tur.
        // A2: bumpede versions må også reflekteres lokalt — bygg version-map.
        const idMapping = new Map<string, string>();
        const versionMapping = new Map<string, number>();
        sentInputs.forEach((s, i) => {
          const serverRecord = written[i];
          if (!serverRecord) return;
          if (s.clientId.startsWith('f-tmp-') && serverRecord.id !== s.clientId) {
            idMapping.set(s.clientId, serverRecord.id);
          }
          // For ALLE records (både nye og eksisterende): oppdater version
          versionMapping.set(serverRecord.id, serverRecord.version);
        });
        if (idMapping.size > 0 || versionMapping.size > 0) {
          // Flagger at neste handleFormationsChange er ID-reconcile-only,
          // ikke en brukerendring som krever ny save.
          skipNextChangeRef.current = true;
          viewRef.current?.applyIdMapping(idMapping);
          viewRef.current?.applyVersionMapping(versionMapping);
        }
      }
    } catch (err) {
      // A2: version-konflikt → spesiell håndtering. Refresh state fra
      // backend så brukeren ser siste versjon. Vi varsler først, brukeren
      // klikker for å reload (forhindrer å overskrive bevisst lokal-state).
      if (err instanceof FormationVersionConflictError) {
        setSaveStatus('error');
        setSaveError(
          'Konflikt: En annen fane eller bruker har endret denne formasjonen. Last på nytt for å se siste versjon.',
        );
        // Dispatch toast som DanceWorkspace lytter på
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dance:toast', {
            detail: {
              message: 'Konflikt — endring fra en annen fane. Last på nytt for å fortsette.',
              kind: 'error',
            },
          }));
        }
      } else {
        setSaveStatus('error');
        setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre');
      }
    } finally {
      inFlightRef.current = false;
      // Hvis brukeren rakk å gjøre flere endringer mens vi var in-flight,
      // kjør én ekstra save-runde med siste state.
      const pending = pendingNextRef.current;
      if (pending) {
        pendingNextRef.current = null;
        void performSave(pending);
      }
    }
  }, [projectId]);

  const handleFormationsChange = React.useCallback(
    (next: Formation[]) => {
      // FormationView fires this on every state change including initial mount.
      // Skip the very first call to avoid a redundant save when nothing
      // changed yet.
      if (isFirstChangeRef.current) {
        isFirstChangeRef.current = false;
        return;
      }
      // G_1: ID-reconcile-only-endring → ikke trigge ny save (state er
      // identisk med backend).
      if (skipNextChangeRef.current) {
        skipNextChangeRef.current = false;
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void performSave(next);
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [performSave],
  );

  React.useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // G18: åpne modal når FormationTimeline right-click dispatcher
  // 'dance:open-timeline-item' { mode, startSec, item }.
  React.useEffect(() => {
    const onOpen = (e: Event): void => {
      const detail = (e as CustomEvent<{
        mode?: 'create' | 'edit';
        startSec?: number;
        item?: TimelineItemRecord;
      }>).detail;
      if (!detail) return;
      if (detail.mode === 'edit' && detail.item) {
        setModalEditing(detail.item);
        setModalDefaultStart(detail.item.startSec);
        setModalOpen(true);
      } else if (detail.mode === 'create') {
        setModalEditing(null);
        setModalDefaultStart(typeof detail.startSec === 'number' ? detail.startSec : 0);
        setModalOpen(true);
      }
    };
    window.addEventListener('dance:open-timeline-item', onOpen as EventListener);
    return () => window.removeEventListener('dance:open-timeline-item', onOpen as EventListener);
  }, []);

  // G18: CRUD handlers
  const handleCreateItem = React.useCallback(async (input: {
    kind: 'note' | 'movement';
    label: string;
    startSec: number;
    endSec: number;
    projectId: string | null;
  }): Promise<void> => {
    const created = await createTimelineItem(input);
    setTimelineItems((prev) => [...prev, created].sort((a, b) => a.startSec - b.startSec));
  }, []);

  const handleUpdateItem = React.useCallback(async (id: string, patch: {
    kind?: 'note' | 'movement';
    label?: string;
    startSec?: number;
    endSec?: number;
  }): Promise<void> => {
    const updated = await patchTimelineItem(id, patch);
    setTimelineItems((prev) => prev.map((it) => (it.id === id ? updated : it)).sort((a, b) => a.startSec - b.startSec));
  }, []);

  const handleDeleteItem = React.useCallback(async (id: string): Promise<void> => {
    await deleteTimelineItem(id);
    setTimelineItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  if (load.phase === 'loading') {
    return (
      <Stack
        alignItems="center"
        justifyContent="center"
        spacing={2}
        sx={{ minHeight: 320, color: '#a78bfa' }}
      >
        <CircularProgress size={28} sx={{ color: PURPLE }} />
        <Typography variant="body2" sx={{ color: 'rgba(229,231,235,0.7)' }}>
          Laster formasjoner…
        </Typography>
      </Stack>
    );
  }

  if (load.phase === 'error') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{load.message}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {!hideSavePill ? (
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
              sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: '#a78bfa', fontWeight: 600 }}
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
              sx={{ bgcolor: 'rgba(239,68,68,0.18)', color: '#ef4444', fontWeight: 600 }}
            />
          ) : null}
        </Stack>
      ) : null}
      {dancers.length === 0 ? (
        <Alert severity="info" sx={{ m: 2 }}>
          Ingen danserprofiler i prosjektet ennå. Legg til dansere under "Studenter"-fanen
          så kan du plassere dem på scenen her.
        </Alert>
      ) : null}
      <FormationView
        ref={viewRef}
        dancers={dancers}
        initialFormations={initialFormations ?? []}
        onFormationsChange={handleFormationsChange}
        onDancerClick={onDancerClick}
        videoPanelSlot={videoPanelSlot}
        timelineNotes={React.useMemo(
          () => timelineItems.filter((it) => it.kind === 'note').map((it) => ({
            id: it.id, text: it.label, startSec: it.startSec, endSec: it.endSec,
          })),
          [timelineItems],
        )}
        timelineMovements={React.useMemo(
          () => timelineItems.filter((it) => it.kind === 'movement').map((it) => ({
            id: it.id, label: it.label, startSec: it.startSec, endSec: it.endSec,
          })),
          [timelineItems],
        )}
      />
      {/* G18: modal for create/edit/delete av timeline-items */}
      <TimelineItemModal
        open={modalOpen}
        editing={modalEditing}
        defaultStartSec={modalDefaultStart}
        projectId={projectId}
        onClose={() => { setModalOpen(false); setModalEditing(null); }}
        onCreate={handleCreateItem}
        onUpdate={handleUpdateItem}
        onDelete={handleDeleteItem}
      />
    </Box>
  );
}

export default FormationViewConnected;
