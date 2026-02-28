/**
 * ShotListPanel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Main orchestrator for the Shot List UI.  Wires together:
 *
 *   A) ShotListTopBar      — breadcrumb + batch actions + "New Shot List"
 *   B) ShotListFilterBar   — filter / sort / search / view toggle
 *   C) ShotListGrid        — cards with DnD + multi-select
 *   D) ShotListSidebar     — cast & crew (draggable to assign)
 *   E) ShotListDialogs     — create / edit / export / delete / batch-assign
 *
 * Data layer:
 *   useShotListData        — three-tier caching (summaries / detail / crew)
 *   derivedState.ts        — all displayed numbers are computed, never stored
 *   shotListFilters.ts     — pure filter + sort
 *
 * Realtime:
 *   useShotListRealTime    — broadcasts ShotAssigned, ShotStatusChanged, etc.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useMemo, useCallback, useReducer, useEffect } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';

// ── Modules ──────────────────────────────────────────────────────────────────
import { ShotListTopBar }    from './ShotListTopBar';
import { ShotListFilterBar } from './ShotListFilterBar';
import { ShotListGrid }      from './ShotListGrid';
import { ShotListSidebar }   from './ShotListSidebar';
import { ShotListGuide }     from './ShotListGuide';
import {
  CreateEditShotListDialog,
  ExportDialog,
  DeleteConfirmDialog,
  BatchAssignDialog,
} from './ShotListDialogs';

// ── Data layer ────────────────────────────────────────────────────────────────
import { useShotListData }   from './useShotListData';
import {
  applyFilters,
  getSceneOptions,
  DEFAULT_FILTERS,
  type ShotListFilters,
} from './shotListFilters';
import { computeProjectStats } from '../../models/derivedState';
import { inheritAssignmentsFromShotList } from '../../models/casting';

// ── Services ──────────────────────────────────────────────────────────────────
import { castingService }    from '../../services/castingService';
import { useShotListRealTime } from '../../hooks/useShotListRealTime';
import { useAuth }           from '@/hooks/useAuth';

import type { ShotList, CastingShot } from '../../models/casting';

// ─── Dialog state (reducer to avoid prop-drilling many booleans) ──────────────

type DialogState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; shotListId: string }
  | { kind: 'export'; shotListId: string | null }
  | { kind: 'delete'; shotListIds: string[] }
  | { kind: 'batchAssign' };

function dialogReducer(_: DialogState, action: DialogState): DialogState {
  return action;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShotListPanelProps {
  projectId: string;
  projectName?: string;
  onUpdate?: () => void;
}

// ─── ShotListPanel ────────────────────────────────────────────────────────────

export function ShotListPanel({ projectId, projectName, onUpdate }: ShotListPanelProps) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('lg'));
  const { user } = useAuth();

  // ── Data ─────────────────────────────────────────────────────────────────
  const {
    summaries,
    summariesLoading,
    summariesError,
    openShotList,
    crew,
    crewLoading,
    peopleMap,
    openShotListById,
    updateShot,
    refresh,
  } = useShotListData(projectId);

  // ── Realtime ──────────────────────────────────────────────────────────────
  const rt = useShotListRealTime({
    projectId,
    userId:   user?.id ?? 'anonymous',
    userName: (user as any)?.displayName ?? user?.email?.split('@')[0] ?? 'Unknown',
  });
  const { connectionStatus } = rt;

  // ── Apply remote shot updates to the open shot list ──────────────────────
  useEffect(() => {
    const unsubAssigned = rt.subscribeToEvent(
      'ShotAssigned',
      ({ payload }) => {
        if (!openShotList || openShotList.id !== payload.shotListId) return;
        const shot = openShotList.shots.find((s) => s.id === payload.shotId);
        if (!shot) return;
        const patched: CastingShot = {
          ...shot,
          assigneeId:   payload.assigneeId   ?? undefined,
          assigneeName: payload.assigneeName ?? undefined,
          updatedAt:    new Date().toISOString(),
        };
        updateShot(patched);
      },
    );

    const unsubStatus = rt.subscribeToEvent(
      'ShotStatusChanged',
      ({ payload }) => {
        if (!openShotList || openShotList.id !== payload.shotListId) return;
        const shot = openShotList.shots.find((s) => s.id === payload.shotId);
        if (!shot) return;
        const patched: CastingShot = {
          ...shot,
          status:    payload.newStatus as CastingShot['status'],
          updatedAt: new Date().toISOString(),
        };
        updateShot(patched);
      },
    );

    return () => {
      unsubAssigned();
      unsubStatus();
    };
  }, [rt, openShotList, updateShot]);

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<ShotListFilters>(DEFAULT_FILTERS);
  const patchFilters = useCallback((patch: Partial<ShotListFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  // ── Multi-select state ────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialog, dispatchDialog] = useReducer(dialogReducer, { kind: 'none' });
  const [dialogLoading, setDialogLoading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // ── Derived filter results ────────────────────────────────────────────────
  const filteredSummaries = useMemo(
    () => applyFilters(summaries, filters, user?.id),
    [summaries, filters, user?.id],
  );

  const sceneOptions = useMemo(() => getSceneOptions(summaries), [summaries]);

  // Top assignees across all lists (for sidebar shot counts)
  const projectStats = useMemo(() => computeProjectStats(summaries), [summaries]);

  // ── Handlers: CRUD ────────────────────────────────────────────────────────

  const handleCreate = useCallback(async (data: Partial<ShotList>) => {
    setDialogLoading(true);
    try {
      const newList: ShotList = {
        id: `sl-${Date.now()}`,
        projectId,
        sceneId: data.sceneId ?? `scene-${Date.now()}`,
        sceneName: data.sceneName,
        shots: [],
        equipment: [],
        notes: data.notes,
        productionContext: data.productionContext ?? 'custom',
        deadline: data.deadline,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await castingService.addShotList(projectId, newList);
      refresh();
      onUpdate?.();
      dispatchDialog({ kind: 'none' });
    } catch (err) {
      console.error('Failed to create shot list:', err);
    } finally {
      setDialogLoading(false);
    }
  }, [projectId, refresh, onUpdate]);

  const handleEdit = useCallback(async (data: Partial<ShotList>) => {
    if (dialog.kind !== 'edit') return;
    setDialogLoading(true);
    try {
      await castingService.updateShotList(projectId, dialog.shotListId, data);
      refresh();
      onUpdate?.();
      dispatchDialog({ kind: 'none' });
    } catch (err) {
      console.error('Failed to update shot list:', err);
    } finally {
      setDialogLoading(false);
    }
  }, [dialog, projectId, refresh, onUpdate]);

  const handleDelete = useCallback(async () => {
    if (dialog.kind !== 'delete') return;
    setDialogLoading(true);
    try {
      for (const id of dialog.shotListIds) {
        await castingService.deleteShotList(projectId, id);
      }
      setSelectedIds(new Set());
      refresh();
      onUpdate?.();
      dispatchDialog({ kind: 'none' });
    } catch (err) {
      console.error('Failed to delete shot list(s):', err);
    } finally {
      setDialogLoading(false);
    }
  }, [dialog, projectId, refresh, onUpdate]);

  const handleDuplicate = useCallback(async (id: string) => {
    const original = summaries.find((s) => s.shotListId === id);
    if (!original) return;
    await handleCreate({
      sceneId: `${original.sceneId}-copy`,
      sceneName: original.sceneName ? `${original.sceneName} (copy)` : undefined,
    });
  }, [summaries, handleCreate]);

  // ── Handler: Person drop → assign to shot list ────────────────────────────

  const handlePersonDropped = useCallback(
    async (personId: string, shotListId: string) => {
      const person = peopleMap.get(personId);
      if (!person) return;

      // Assign person as default assignee on the shot list
      const patch: Partial<ShotList> = {
        defaultAssignees: [{ personId, roleId: undefined, roleName: person.crewRole }],
      };
      try {
        await castingService.updateShotList(projectId, shotListId, patch);
        refresh();
        onUpdate?.();
      } catch (err) {
        console.error('Failed to assign person to shot list:', err);
      }
    },
    [peopleMap, projectId, refresh, onUpdate],
  );

  // ── Handler: Reorder ──────────────────────────────────────────────────────

  const handleReorder = useCallback(
    async (orderedIds: string[]) => {
      // Persist order — service must support orderIndex or similar
      try {
        await castingService.reorderShotLists?.(projectId, orderedIds);
        refresh();
      } catch {
        // Non-fatal
      }
    },
    [projectId, refresh],
  );

  // ── Handler: Export ───────────────────────────────────────────────────────

  const handleExportCSV = useCallback((id: string | null) => {
    // Build CSV rows from summaries (or selected)
    const targets = id
      ? summaries.filter((s) => s.shotListId === id)
      : selectedIds.size > 0
      ? summaries.filter((s) => selectedIds.has(s.shotListId))
      : summaries;

    const rows = [
      'Scene,Total Shots,Completed,Unassigned,Duration (min),Last Updated',
      ...targets.map((s) =>
        [
          s.sceneName ?? s.sceneId,
          s.totalShots,
          s.completedShots,
          s.unassignedShots,
          s.estimatedMinutes,
          s.lastUpdated,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shot-lists-${projectId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [summaries, selectedIds, projectId]);

  const handleExportPDF = useCallback((_id: string | null) => {
    // TODO: wire to jsPDF when available
    console.info('PDF export coming soon');
  }, []);

  // ── Handler: Batch assign ─────────────────────────────────────────────────

  const handleBatchAssign = useCallback(
    async (personId: string, inheritToShots: boolean) => {
      const ids = Array.from(selectedIds);
      setDialogLoading(true);
      try {
        await Promise.all(
          ids.map((id) =>
            castingService.updateShotList(projectId, id, {
              defaultAssignees: [{ personId, roleId: undefined }],
            }),
          ),
        );
        if (inheritToShots) {
          // Pull each list and propagate defaultAssignees onto its shots
          const lists = await Promise.all(
            ids.map((id) => castingService.updateShotList(projectId, id, {})
              .then(() => castingService.getShotLists(projectId))
              .then((all) => all.find((l) => l.id === id)),
            ),
          );
          await Promise.all(
            lists
              .filter((l): l is NonNullable<typeof l> => l != null)
              .map((list) => {
                const patchedShots = list.shots.map((shot) => ({
                  ...shot,
                  assignments: inheritAssignmentsFromShotList(list, shot),
                }));
                return castingService.updateShotList(projectId, list.id, { shots: patchedShots });
              }),
          );
        }
        setSelectedIds(new Set());
        refresh();
        onUpdate?.();
        dispatchDialog({ kind: 'none' });
      } catch (err) {
        console.error('Batch assign failed:', err);
      } finally {
        setDialogLoading(false);
      }
    },
    [selectedIds, projectId, refresh, onUpdate],
  );

  // ── Edit init data ────────────────────────────────────────────────────────
  const editInitial = useMemo(() => {
    if (dialog.kind !== 'edit') return undefined;
    const s = summaries.find((x) => x.shotListId === dialog.shotListId);
    if (!s) return undefined;
    return { sceneId: s.sceneId, sceneName: s.sceneName } as Partial<ShotList>;
  }, [dialog, summaries]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── A) Top App Bar ── */}
      <ShotListTopBar
        projectName={projectName}
        selectedCount={selectedIds.size}
        connectionStatus={connectionStatus}
        onNewShotList={() => dispatchDialog({ kind: 'create' })}
        onExportAll={() => dispatchDialog({ kind: 'export', shotListId: null })}
        onBatchDelete={() => dispatchDialog({ kind: 'delete', shotListIds: Array.from(selectedIds) })}
        onBatchAssign={() => dispatchDialog({ kind: 'batchAssign' })}
        onBatchExport={() => dispatchDialog({ kind: 'export', shotListId: null })}
        onBatchEdit={() => {
          const [id] = Array.from(selectedIds);
          if (id) dispatchDialog({ kind: 'edit', shotListId: id });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onGuide={() => setGuideOpen(true)}
      />

      {/* ── B) Filter Bar ── */}
      <ShotListFilterBar
        filters={filters}
        sceneOptions={sceneOptions}
        totalCount={summaries.length}
        filteredCount={filteredSummaries.length}
        onChange={patchFilters}
      />

      {/* ── C + D) Grid + Sidebar ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Grid */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <ShotListGrid
            summaries={filteredSummaries}
            loading={summariesLoading}
            error={summariesError}
            viewMode={filters.viewMode}
            selectedIds={selectedIds}
            onOpen={openShotListById}
            onSelectionChange={setSelectedIds}
            onEdit={(id) => dispatchDialog({ kind: 'edit', shotListId: id })}
            onDuplicate={handleDuplicate}
            onDelete={(id) => dispatchDialog({ kind: 'delete', shotListIds: [id] })}
            onExport={(id) => dispatchDialog({ kind: 'export', shotListId: id })}
            onPersonDropped={handlePersonDropped}
            onReorder={handleReorder}
            people={peopleMap}
          />
        </Box>

        {/* Sidebar (hidden on narrow screens) */}
        {!isNarrow && (
          <ShotListSidebar
            crew={crew}
            loading={crewLoading}
            topAssignees={projectStats.topAssignees}
          />
        )}
      </Box>

      {/* ── E) Dialogs ── */}

      {/* Create */}
      <CreateEditShotListDialog
        open={dialog.kind === 'create'}
        mode="create"
        loading={dialogLoading}
        onClose={() => dispatchDialog({ kind: 'none' })}
        onSubmit={handleCreate}
      />

      {/* Edit */}
      <CreateEditShotListDialog
        open={dialog.kind === 'edit'}
        mode="edit"
        initial={editInitial}
        loading={dialogLoading}
        onClose={() => dispatchDialog({ kind: 'none' })}
        onSubmit={handleEdit}
      />

      {/* Export */}
      <ExportDialog
        open={dialog.kind === 'export'}
        shotListId={dialog.kind === 'export' ? dialog.shotListId : null}
        selectedCount={selectedIds.size}
        onClose={() => dispatchDialog({ kind: 'none' })}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
      />

      {/* Delete */}
      <DeleteConfirmDialog
        open={dialog.kind === 'delete'}
        count={dialog.kind === 'delete' ? dialog.shotListIds.length : 0}
        loading={dialogLoading}
        onClose={() => dispatchDialog({ kind: 'none' })}
        onConfirm={handleDelete}
      />

      {/* Batch assign */}
      <BatchAssignDialog
        open={dialog.kind === 'batchAssign'}
        selectedCount={selectedIds.size}
        summaries={summaries.filter((s) => selectedIds.has(s.shotListId))}
        crew={crew}
        loading={dialogLoading}
        onClose={() => dispatchDialog({ kind: 'none' })}
        onConfirm={handleBatchAssign}
      />

      {/* ── Guide ── */}
      <ShotListGuide
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />
    </Box>
  );
}
