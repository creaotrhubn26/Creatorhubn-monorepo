/**
 * DanceAnnotateView — DanceAnnotate-mockup pixel-perfect-flate.
 *
 * Layout (md+):
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │ Project: <name>                          Annotate · Review tabs   │
 *   ├──────────────────────┬───────────────────────┬───────────────────┤
 *   │ Video player +       │ Category Tools (right) │
 *   │ tids-overlay         │                        │
 *   │                      ├───────────────────────┤
 *   │ AnnotationTimeline   │ Common Labels         │
 *   │ (5 fargede spor)     │                        │
 *   │                      ├───────────────────────┤
 *   ├──────────────────────┤ Selected Annotation   │
 *   │ Annotation Details + │                        │
 *   │ Shortcuts (bottom)   │                        │
 *   └──────────────────────┴───────────────────────┘
 *
 * Gjenbruker:
 *   - ClipsSidebar (wrappet av FormationsTabBody — vises i DanceFlowShell)
 *   - FormationVideoPanel (transport-bar + HLS + dance:video-time)
 *   - AnnotationTimeline (eksisterende 5-spor multi-track)
 *   - AnnotationDetailsPanel (eksisterende Selected Annotation)
 *
 * Nye:
 *   - AnnotateCategoryToolsPanel
 *   - AnnotateCommonLabelsPanel
 *   - AnnotateFormPanel
 *   - AnnotateShortcutsPanel
 */
import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import FormationVideoPanel from './FormationVideoPanel';
import AnnotationTimeline from './AnnotationTimeline';
import AnnotationDetailsPanel from './AnnotationDetailsPanel';
import AnnotateCategoryToolsPanel from './AnnotateCategoryToolsPanel';
import AnnotateCommonLabelsPanel from './AnnotateCommonLabelsPanel';
import AnnotateFormPanel from './AnnotateFormPanel';
import AnnotateShortcutsPanel from './AnnotateShortcutsPanel';
import {
  listAnnotations,
  createAnnotation,
  patchAnnotation,
  deleteAnnotation,
  type VideoAnnotation,
} from './danceVideoService';
import { categoryByShortcut } from './danceMovementCategories';
import { danceFlowColors } from './danceFlowTheme';

export interface DanceAnnotateViewProps {
  /** Valgt clip-ID. Null = empty-state vises (be om å velge clip i ClipsSidebar). */
  clipId: string | null;
  /** Total varighet av clip (sek) — krever for timeline-skalering. */
  durationSec: number;
  dancerOptions: Array<{ id: string; label: string }>;
  /** Read-only-modus skipper alle mutations. */
  readOnly?: boolean;
}

const PURPLE = '#a78bfa';

export default function DanceAnnotateView({
  clipId,
  durationSec,
  dancerOptions,
  readOnly = false,
}: DanceAnnotateViewProps): React.ReactElement {
  const [annotations, setAnnotations] = React.useState<VideoAnnotation[]>([]);
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = React.useState<number>(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const selected = React.useMemo(
    () => annotations.find((a) => a.id === selectedId) ?? null,
    [annotations, selectedId],
  );

  // ─── Last annotations når clip endrer seg ─────────────────────────
  React.useEffect(() => {
    if (!clipId) {
      setAnnotations([]);
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    void listAnnotations(clipId)
      .then((list) => {
        if (cancelled) return;
        setAnnotations(list);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Kunne ikke laste annotations');
      });
    return () => { cancelled = true; };
  }, [clipId]);

  // ─── Lytt på dance:video-time fra FormationVideoPanel ─────────────
  React.useEffect(() => {
    const onTime = (e: Event): void => {
      const detail = (e as CustomEvent<{ currentTime?: number }>).detail;
      if (detail && typeof detail.currentTime === 'number') {
        setPlayheadSec(detail.currentTime);
      }
    };
    window.addEventListener('dance:video-time', onTime as EventListener);
    return () => window.removeEventListener('dance:video-time', onTime as EventListener);
  }, []);

  // ─── Add Annotation ('A'-tast eller knapp) ────────────────────────
  const handleAddAnnotation = React.useCallback(async (): Promise<void> => {
    if (readOnly || !clipId) return;
    const label = activeLabel ?? 'Untitled';
    const cat = activeCategoryId ?? null;
    // Default: 2-sek-blokk fra current playhead
    const start = Math.max(0, playheadSec);
    const end = Math.min(durationSec, start + 2);
    try {
      const created = await createAnnotation(clipId, {
        body: label,
        timestampSec: start,
        endSec: end,
        category: cat,
      });
      setAnnotations((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke opprette annotation');
    }
  }, [readOnly, clipId, activeLabel, activeCategoryId, playheadSec, durationSec]);

  // ─── Patch / delete handlers ──────────────────────────────────────
  const handlePatch = React.useCallback(async (
    id: string,
    patch: Parameters<typeof patchAnnotation>[1],
  ): Promise<void> => {
    if (readOnly) return;
    try {
      const updated = await patchAnnotation(id, patch);
      setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke oppdatere annotation');
    }
  }, [readOnly]);

  const handleDelete = React.useCallback(async (id: string): Promise<void> => {
    if (readOnly) return;
    try {
      await deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke slette annotation');
    }
  }, [readOnly, selectedId]);

  // ─── Keyboard: A=Add, D=Delete, S=Split, 1-5=Category, Space=Play/Pause ─
  React.useEffect(() => {
    if (readOnly || !clipId) return;
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      // Number-keys 1-5 → set category
      const numCat = categoryByShortcut(e.key);
      if (numCat) {
        e.preventDefault();
        setActiveCategoryId((cur) => (cur === numCat.id ? null : numCat.id));
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'a':
          e.preventDefault();
          void handleAddAnnotation();
          break;
        case 'd':
          if (selectedId) {
            e.preventDefault();
            void handleDelete(selectedId);
          }
          break;
        case 's':
          // Split — del valgt annotation ved current playhead
          if (selected) {
            e.preventDefault();
            const splitAt = Math.max(selected.timestampSec, Math.min(playheadSec, selected.endSec ?? playheadSec));
            if (splitAt > selected.timestampSec && (selected.endSec == null || splitAt < selected.endSec)) {
              // Shrink existing til splitAt
              void handlePatch(selected.id, { endSec: splitAt });
              // Lag ny fra splitAt til original endSec
              void createAnnotation(clipId, {
                body: selected.body,
                timestampSec: splitAt,
                endSec: selected.endSec,
                category: selected.category,
                targetDancerIds: selected.targetDancerIds,
              }).then((newAnn) => {
                setAnnotations((prev) => [...prev, newAnn]);
              }).catch(() => {/* ignore */});
            }
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, clipId, selectedId, selected, playheadSec, handleAddAnnotation, handleDelete, handlePatch]);

  // ─── Render ───────────────────────────────────────────────────────
  if (!clipId) {
    return (
      <Box
        data-testid="dance-annotate-empty"
        sx={{
          height: '100%', minHeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
          color: danceFlowColors.textMuted,
          p: 3,
        }}
      >
        <Typography sx={{ fontSize: 14, mb: 1 }}>Velg et klipp i Clips-sidebar</Typography>
        <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled }}>
          DanceAnnotate viser annotations for ett klipp av gangen
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      data-testid="dance-annotate-view"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' },
        gap: 1,
        p: 1,
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textPrimary,
        minHeight: '100%',
      }}
    >
      {/* ── Senter: video + timeline + bottom-paneler ── */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        {/* Video player m/ transport-bar (FormationVideoPanel gjenbrukt) */}
        <Box sx={{ position: 'relative', flex: '0 0 auto' }}>
          <FormationVideoPanel data-testid="dance-annotate-video" />
          {/* Tids-overlay øverst-venstre — mockup viser '00:00:24:13' */}
          <Box
            data-testid="dance-annotate-video-time-overlay"
            sx={{
              position: 'absolute', top: 8, left: 8,
              bgcolor: 'rgba(167,139,250,0.18)',
              color: PURPLE, fontSize: 11, fontWeight: 700,
              fontFamily: 'ui-monospace, Menlo, monospace',
              px: 1, py: 0.25, borderRadius: 0.5,
              pointerEvents: 'none', zIndex: 5,
            }}
          >
            {formatVideoTime(playheadSec)}
          </Box>
        </Box>

        {/* AnnotationTimeline — 5 spor + uncat */}
        <Box sx={{
          bgcolor: danceFlowColors.bgPanel,
          border: `1px solid ${danceFlowColors.borderStrong}`,
          borderRadius: 1, p: 1,
        }}>
          <AnnotationTimeline
            annotations={annotations}
            durationSec={durationSec}
            playheadSec={playheadSec}
            onSeek={(sec) => {
              // Dispatch dance:video-seek så FormationVideoPanel setter currentTime
              window.dispatchEvent(new CustomEvent('dance:video-seek', { detail: { timeSec: sec } }));
            }}
            onSelectAnnotation={(ann) => setSelectedId(ann.id)}
            onResize={readOnly ? undefined : (ann, newStart, newEnd) => {
              void handlePatch(ann.id, { timestampSec: newStart, endSec: newEnd });
            }}
          />
        </Box>

        {/* Bottom: AnnotationDetails-form + Shortcuts side-by-side */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 200px' },
          gap: 1,
        }}>
          <AnnotateFormPanel
            annotation={selected}
            dancerOptions={dancerOptions}
            onPatch={(patch) => {
              if (selected) void handlePatch(selected.id, patch);
            }}
          />
          <Box sx={{
            p: 1.5,
            bgcolor: danceFlowColors.bgPanel,
            border: `1px solid ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
          }}>
            <AnnotateShortcutsPanel />
          </Box>
        </Box>

        {loadError ? (
          <Typography
            data-testid="dance-annotate-error"
            sx={{
              fontSize: 11, color: danceFlowColors.errorPrimary,
              bgcolor: 'rgba(248,113,113,0.08)',
              border: `1px solid rgba(248,113,113,0.2)`,
              borderRadius: 0.5, px: 1, py: 0.5,
            }}
          >
            {loadError}
          </Typography>
        ) : null}
      </Box>

      {/* ── Høyre kolonne: Category Tools + Common Labels + Selected Annotation ── */}
      <Stack
        spacing={1.5}
        sx={{
          minWidth: 0,
          // Skjul på mobile
          display: { xs: 'none', md: 'flex' },
        }}
      >
        <Box sx={{
          p: 1.5,
          bgcolor: danceFlowColors.bgPanel,
          border: `1px solid ${danceFlowColors.borderStrong}`,
          borderRadius: 1,
        }}>
          <AnnotateCategoryToolsPanel
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />
        </Box>

        <Box sx={{
          p: 1.5,
          bgcolor: danceFlowColors.bgPanel,
          border: `1px solid ${danceFlowColors.borderStrong}`,
          borderRadius: 1,
        }}>
          <AnnotateCommonLabelsPanel
            activeCategoryId={activeCategoryId}
            activeLabel={activeLabel}
            onSelectLabel={setActiveLabel}
          />
        </Box>

        {selected ? (
          <Box sx={{
            bgcolor: danceFlowColors.bgPanel,
            border: `1px solid ${danceFlowColors.borderStrong}`,
            borderRadius: 1,
          }}>
            <AnnotationDetailsPanel
              annotation={selected}
              dancerOptions={dancerOptions}
              onClose={() => setSelectedId(null)}
              onDelete={() => { void handleDelete(selected.id); }}
              onPatch={(patch) => { void handlePatch(selected.id, patch); }}
            />
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}

function formatVideoTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const ff = Math.floor((sec - total) * 30); // 30fps default
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}
