import React, { useState, useCallback, useRef, useEffect } from "react";
import { Box, Grid, Typography, CircularProgress, Alert, Skeleton } from "@mui/material";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ShotListCard } from "./ShotListCard";
import type { ShotListSummary } from "../../models/derivedState";
import type { Person } from "../../models/casting";
import type { ViewMode } from "./shotListFilters";

// ─── Sortable wrapper ─────────────────────────────────────────────────────────

function SortableShotListCard({
  summary,
  selected,
  selectionActive,
  onOpen,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onOpenStoryboard,
}: {
  summary: ShotListSummary;
  selected: boolean;
  selectionActive: boolean;
  onOpen: (id: string) => void;
  onSelect: (id: string, val: boolean) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onOpenStoryboard?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: summary.shotListId });

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <ShotListCard
        summary={summary}
        selected={selected}
        selectionActive={selectionActive}
        onOpen={onOpen}
        onSelect={onSelect}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onExport={onExport}
        onOpenStoryboard={onOpenStoryboard}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </Box>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function ShotListCardSkeleton() {
  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Skeleton variant="rectangular" width={32} height={18} sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Skeleton variant="rectangular" width={40} height={18} sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.06)' }} />
        </Box>
        <Skeleton variant="text" width="70%" sx={{ bgcolor: 'rgba(255,255,255,0.06)', mb: 0.5 }} />
        <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.04)', mb: 1.5 }} />
        <Skeleton variant="rectangular" height={3} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.06)', mb: 1.5 }} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Skeleton variant="text" width={30} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Skeleton variant="circular" width={22} height={22} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Skeleton variant="circular" width={22} height={22} sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
        </Box>
      </Box>
    </Box>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ShotListGridProps {
  summaries: ShotListSummary[];
  loading: boolean;
  error: string | null;
  viewMode: ViewMode;
  selectedIds: Set<string>;
  onOpen: (id: string) => void;
  onSelectionChange: (ids: Set<string>) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onOpenStoryboard?: (id: string) => void;
  /** Called when a Person node is dropped onto a ShotList card */
  onPersonDropped?: (personId: string, shotListId: string) => void;
  /** Called when cards are reordered (returns new ordered IDs) */
  onReorder?: (orderedIds: string[]) => void;
  /** Person lookup map for DragOverlay ghost while dragging a person node onto a card */
  people?: Map<string, Person>;
}

// ─── ShotListGrid ─────────────────────────────────────────────────────────────

export function ShotListGrid({
  summaries,
  loading,
  error,
  viewMode,
  selectedIds,
  onOpen,
  onSelectionChange,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onOpenStoryboard,
  onPersonDropped,
  onReorder,
  people,
}: ShotListGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingPersonId, setDraggingPersonId] = useState<string | null>(null);
  const lastSelectedRef = useRef<string | null>(null);

  // ── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Select handler (with Shift-range) ────────────────────────────────────
  const handleSelect = useCallback(
    (id: string, value: boolean, shiftKey?: boolean) => {
      const next = new Set(selectedIds);

      if (shiftKey && lastSelectedRef.current && value) {
        // Shift-select: select range between last selected and this
        const ids = summaries.map((s) => s.shotListId);
        const a = ids.indexOf(lastSelectedRef.current);
        const b = ids.indexOf(id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        ids.slice(lo, hi + 1).forEach((rid) => next.add(rid));
      } else {
        if (value) { next.add(id); } else { next.delete(id); }
      }

      lastSelectedRef.current = value ? id : null;
      onSelectionChange(next);
    },
    [selectedIds, summaries, onSelectionChange],
  );

  // ── Keyboard multi-select (Escape to clear) ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        onSelectionChange(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds.size, onSelectionChange]);

  // ── DnD handlers ─────────────────────────────────────────────────────────
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    const data = active.data.current as Record<string, unknown> | undefined;
    if (data?.type === 'person') {
      setDraggingPersonId(String(data.personId ?? active.id));
    } else {
      setDraggingId(String(active.id));
    }
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      setDraggingId(null);
      setDraggingPersonId(null);
      if (!over || active.id === over.id) return;

      const activeData = active.data.current as Record<string, unknown> | undefined;
      const overData   = over.data.current as Record<string, unknown> | undefined;

      // Person dropped onto a ShotList card
      if (activeData?.type === 'person' && overData?.type === 'shotList') {
        onPersonDropped?.(String(activeData.personId), String(overData.shotListId));
        return;
      }

      // Card reorder
      const ids = summaries.map((s) => s.shotListId);
      const oldIdx = ids.indexOf(String(active.id));
      const newIdx = ids.indexOf(String(over.id));
      if (oldIdx !== -1 && newIdx !== -1) {
        const reordered = [...ids];
        reordered.splice(oldIdx, 1);
        reordered.splice(newIdx, 0, String(active.id));
        onReorder?.(reordered);
      }
    },
    [summaries, onPersonDropped, onReorder],
  );

  // ── Loading skeletons ─────────────────────────────────────────────────────
  if (loading && summaries.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} xl={3} key={i}>
              <ShotListCardSkeleton />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" variant="outlined">{error}</Alert>
      </Box>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && summaries.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 10,
          gap: 2,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        <Typography variant="h4" sx={{ opacity: 0.2 }}>🎬</Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          No shot lists found
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          Create your first shot list or adjust filters
        </Typography>
      </Box>
    );
  }

  // ── Grid / List ───────────────────────────────────────────────────────────
  const selectionActive = selectedIds.size > 0;
  const ids = summaries.map((s) => s.shotListId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ids}
        strategy={viewMode === 'list' ? verticalListSortingStrategy : rectSortingStrategy}
      >
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Refresh indicator — shown when reloading stale data */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <CircularProgress size={20} sx={{ color: 'rgba(233,30,99,0.6)' }} />
            </Box>
          )}
          {viewMode === 'grid' ? (
            <Grid container spacing={2}>
              {summaries.map((summary) => (
                <Grid item xs={12} sm={6} md={4} xl={3} key={summary.shotListId}>
                  <SortableShotListCard
                    summary={summary}
                    selected={selectedIds.has(summary.shotListId)}
                    selectionActive={selectionActive}
                    onOpen={onOpen}
                    onSelect={(id, val) => handleSelect(id, val)}
                    onEdit={onEdit}
                    onDuplicate={onDuplicate}
                    onDelete={onDelete}
                    onExport={onExport}
                    onOpenStoryboard={onOpenStoryboard}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {summaries.map((summary) => (
                <SortableShotListCard
                  key={summary.shotListId}
                  summary={summary}
                  selected={selectedIds.has(summary.shotListId)}
                  selectionActive={selectionActive}
                  onOpen={onOpen}
                  onSelect={(id, val) => handleSelect(id, val)}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  onExport={onExport}
                  onOpenStoryboard={onOpenStoryboard}
                />
              ))}
            </Box>
          )}
        </Box>
      </SortableContext>

      {/* DragOverlay: mini ghost card while dragging */}
      <DragOverlay>
        {/* Person ghost — shown when a person node is being dragged onto a card */}
        {draggingPersonId && (() => {
          const person = people?.get(draggingPersonId);
          return (
            <Box
              sx={{
                bgcolor: '#1e1e2e',
                border: '2px solid #3b82f6',
                borderRadius: 2,
                p: 1.5,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                opacity: 0.9,
                minWidth: 160,
              }}
            >
              <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 700, display: 'block' }}>
                {person?.name ?? draggingPersonId}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                Drop to assign
              </Typography>
            </Box>
          );
        })()}
        {draggingId && (() => {
          const s = summaries.find((x) => x.shotListId === draggingId);
          if (!s) return null;
          return (
            <Box
              sx={{
                bgcolor: '#1e1e2e',
                border: '2px solid #e91e63',
                borderRadius: 2,
                p: 1.5,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                opacity: 0.9,
                minWidth: 200,
              }}
            >
              <Typography variant="caption" sx={{ color: '#e91e63', fontWeight: 700 }}>
                {s.sceneName ?? s.sceneId}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                {s.totalShots} shots
              </Typography>
            </Box>
          );
        })()}
      </DragOverlay>
    </DndContext>
  );
}
