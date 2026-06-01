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
import AnnotationExportOverlay from './AnnotationExportOverlay';
import { useDanceAnnotationCatalog } from './useDanceAnnotationCatalog';
import {
  listAnnotations,
  createAnnotation,
  patchAnnotation,
  deleteAnnotation,
  type VideoAnnotation,
} from './danceVideoService';
// categoryByShortcut fra danceMovementCategories er erstattet av dynamisk
// shortcut-lookup mot catalog (1-9 brukerdefinerte snarveier).
import { danceFlowColors } from './danceFlowTheme';

export type AnnotateSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DanceAnnotateViewProps {
  /** Valgt clip-ID. Null = empty-state vises (be om å velge clip i ClipsSidebar). */
  clipId: string | null;
  /** Tittel på valgt clip — vises som tittel-bar over video. */
  clipTitle?: string;
  /** Total varighet av clip (sek) — krever for timeline-skalering. */
  durationSec: number;
  /** Prosjekt-scope for categories/labels-catalog. */
  projectId: string | null;
  dancerOptions: Array<{ id: string; label: string }>;
  /** Read-only-modus skipper alle mutations. */
  readOnly?: boolean;
  /**
   * Bobler save-status + sist-lagret-timestamp opp til parent (typisk
   * DanceAnnotateLayout som rendrer Save-knappen).
   */
  onSaveStatusChange?: (status: AnnotateSaveStatus, lastSavedAt: number | null, error: string | null) => void;
}

type AnnotateRightTab = 'annotate' | 'review';

const PURPLE = '#a78bfa';

export default function DanceAnnotateView({
  clipId,
  clipTitle,
  durationSec,
  projectId,
  dancerOptions,
  readOnly = false,
  onSaveStatusChange,
}: DanceAnnotateViewProps): React.ReactElement {
  // Catalog: categories + labels (auto-seedet defaults + brukerens egne).
  const catalog = useDanceAnnotationCatalog({ projectId });

  const [annotations, setAnnotations] = React.useState<VideoAnnotation[]>([]);
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(null);
  const [activeLabel, setActiveLabel] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [playheadSec, setPlayheadSec] = React.useState<number>(0);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [rightTab, setRightTab] = React.useState<AnnotateRightTab>('annotate');
  const [exportOpen, setExportOpen] = React.useState<boolean>(false);
  // Save-status tracking — bobles til parent (DanceAnnotateLayout's Save-knapp).
  const [saveStatus, setSaveStatus] = React.useState<AnnotateSaveStatus>('idle');
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = React.useState<number | null>(null);
  const inFlightCountRef = React.useRef<number>(0);

  React.useEffect(() => {
    onSaveStatusChange?.(saveStatus, lastSavedAt, saveError);
  }, [saveStatus, lastSavedAt, saveError, onSaveStatusChange]);

  /** Wrap mutations m/ in-flight-counter så saveStatus reflekterer aktivitet. */
  const trackMutation = React.useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    inFlightCountRef.current += 1;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const result = await fn();
      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
      if (inFlightCountRef.current === 0) {
        setSaveStatus('saved');
        setLastSavedAt(Date.now());
      }
      return result;
    } catch (err) {
      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Kunne ikke lagre');
      throw err;
    }
  }, []);

  // Lytt på 'dance:export-annotation' fra DanceAnnotateLayout Export-knapp.
  React.useEffect(() => {
    const onExport = (): void => setExportOpen(true);
    window.addEventListener('dance:export-annotation', onExport as EventListener);
    return () => window.removeEventListener('dance:export-annotation', onExport as EventListener);
  }, []);

  // Lytt på 'dance:select-annotation' fra DanceAnnotationsListView → auto-velg
  // den valgte raden (etter clip-bytte fra Annotations-list).
  React.useEffect(() => {
    const onSelect = (e: Event): void => {
      const detail = (e as CustomEvent<{ annotationId?: string }>).detail;
      if (detail && typeof detail.annotationId === 'string') {
        setSelectedId(detail.annotationId);
      }
    };
    window.addEventListener('dance:select-annotation', onSelect as EventListener);
    return () => window.removeEventListener('dance:select-annotation', onSelect as EventListener);
  }, []);

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
      const created = await trackMutation(() => createAnnotation(clipId, {
        body: label,
        timestampSec: start,
        endSec: end,
        category: cat,
      }));
      setAnnotations((prev) => [...prev, created]);
      setSelectedId(created.id);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke opprette annotation');
    }
  }, [readOnly, clipId, activeLabel, activeCategoryId, playheadSec, durationSec, trackMutation]);

  // ─── Patch / delete handlers ──────────────────────────────────────
  const handlePatch = React.useCallback(async (
    id: string,
    patch: Parameters<typeof patchAnnotation>[1],
  ): Promise<void> => {
    if (readOnly) return;
    try {
      const updated = await trackMutation(() => patchAnnotation(id, patch));
      setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke oppdatere annotation');
    }
  }, [readOnly, trackMutation]);

  const handleDelete = React.useCallback(async (id: string): Promise<void> => {
    if (readOnly) return;
    try {
      await trackMutation(() => deleteAnnotation(id));
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke slette annotation');
    }
  }, [readOnly, selectedId, trackMutation]);

  // ─── Keyboard: A=Add, D=Delete, S=Split, 1-5=Category, Space=Play/Pause ─
  React.useEffect(() => {
    if (readOnly || !clipId) return;
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
      // Number-keys 1-9 → set category (dynamisk via catalog.categories)
      const matchedCat = catalog.categories.find((c) => c.shortcut === e.key);
      if (matchedCat) {
        e.preventDefault();
        setActiveCategoryId((cur) => (cur === matchedCat.id ? null : matchedCat.id));
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
  }, [readOnly, clipId, selectedId, selected, playheadSec, handleAddAnnotation, handleDelete, handlePatch, catalog.categories]);

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
        {/* Video tittel-bar — matcher mockup: 'Routine_01.mp4' øverst */}
        {clipTitle ? (
          <Box
            data-testid="dance-annotate-clip-title"
            sx={{
              fontSize: 13, fontWeight: 700,
              color: danceFlowColors.textPrimary,
              px: 0.5, py: 0.25,
            }}
          >
            {clipTitle}
          </Box>
        ) : null}

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
            selectedAnnotationId={selectedId}
            onSeek={(sec) => {
              // Dispatch dance:video-seek så FormationVideoPanel setter currentTime
              window.dispatchEvent(new CustomEvent('dance:video-seek', { detail: { timeSec: sec } }));
            }}
            onSelectAnnotation={(ann) => setSelectedId(ann.id)}
            onResize={readOnly ? undefined : (ann, newStart, newEnd) => {
              void handlePatch(ann.id, { timestampSec: newStart, endSec: newEnd });
            }}
            onAddTrack={readOnly ? undefined : () => {
              // Stub: dispatch event slik at en fremtidig kategori-modal
              // kan lyttes på fra parent. For nå er knappen synlig som
              // pixel-perfect-match, men full UI (modal) kommer i egen
              // commit når kategori-migrasjon legges til.
              window.dispatchEvent(new CustomEvent('dance:add-track'));
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

      {/* ── Høyre kolonne: Annotate/Review-tabs + paneler ── */}
      <Stack
        spacing={1.5}
        sx={{
          minWidth: 0,
          // Skjul på mobile
          display: { xs: 'none', md: 'flex' },
        }}
      >
        {/* Annotate / Review tabs — mockup viser dem øverst i høyre kolonne. */}
        <Box
          data-testid="dance-annotate-right-tabs"
          sx={{
            display: 'flex', gap: 0.5,
            borderBottom: `1px solid ${danceFlowColors.borderStrong}`,
            pb: 0.5,
          }}
        >
          {(['annotate', 'review'] as const).map((id) => {
            const isActive = rightTab === id;
            return (
              <Box
                key={id}
                component="button"
                type="button"
                onClick={() => setRightTab(id)}
                data-testid={`dance-annotate-right-tab-${id}`}
                aria-pressed={isActive}
                sx={{
                  flex: 1, textAlign: 'center', cursor: 'pointer',
                  py: 0.75, fontSize: 12, fontWeight: 700,
                  textTransform: 'capitalize',
                  bgcolor: 'transparent', border: 'none',
                  color: isActive ? danceFlowColors.lavender : danceFlowColors.textMuted,
                  borderBottom: isActive
                    ? `2px solid ${danceFlowColors.lavender}`
                    : '2px solid transparent',
                  marginBottom: '-1px',
                  fontFamily: 'inherit',
                  '&:hover': { color: danceFlowColors.lavender },
                }}
              >
                {id}
              </Box>
            );
          })}
        </Box>

        {rightTab === 'annotate' ? (
          <>
            <Box sx={{
              p: 1.5,
              bgcolor: danceFlowColors.bgPanel,
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
            }}>
              <AnnotateCategoryToolsPanel
                categories={catalog.categories}
                activeCategoryId={activeCategoryId}
                onSelectCategory={setActiveCategoryId}
                onCreate={async (input) => { await catalog.createCategory(input); }}
                onPatch={async (id, patch) => { await catalog.patchCategory(id, patch); }}
                onDelete={(id) => catalog.deleteCategory(id)}
                readOnly={readOnly}
              />
            </Box>

            <Box sx={{
              p: 1.5,
              bgcolor: danceFlowColors.bgPanel,
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
            }}>
              <AnnotateCommonLabelsPanel
                categories={catalog.categories}
                labels={catalog.labels}
                activeCategoryId={activeCategoryId}
                activeLabel={activeLabel}
                onSelectLabel={setActiveLabel}
                onCreate={async (input) => { await catalog.createLabel(input); }}
                onPatch={async (id, patch) => { await catalog.patchLabel(id, patch); }}
                onDelete={(id) => catalog.deleteLabel(id)}
                readOnly={readOnly}
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
          </>
        ) : null}

        {/* AnnotationExportOverlay — viss via dance:export-annotation event */}
        <AnnotationExportOverlay
          open={exportOpen}
          annotations={annotations}
          clipTitle={clipTitle}
          dancerOptions={dancerOptions}
          onClose={() => setExportOpen(false)}
        />

        {rightTab === 'review' ? (
          // Review-tab: read-only sammendrag per kategori + total-tall.
          <Box
            data-testid="dance-annotate-review-summary"
            sx={{
              p: 1.5,
              bgcolor: danceFlowColors.bgPanel,
              border: `1px solid ${danceFlowColors.borderStrong}`,
              borderRadius: 1,
            }}
          >
            <Typography
              variant="overline"
              sx={{
                display: 'block', mb: 1,
                color: danceFlowColors.textMuted,
                fontWeight: 700, letterSpacing: 1.2, fontSize: 11,
              }}
            >
              Review Summary
            </Typography>
            <Stack spacing={0.5}>
              {(['steps', 'arms', 'body', 'jumps', 'turns'] as const).map((cid) => {
                const cnt = annotations.filter((a) => a.category === cid).length;
                const cat = ['#a78bfa', '#34d399', '#fbbf24', '#60a5fa', '#f472b6'][
                  ['steps', 'arms', 'body', 'jumps', 'turns'].indexOf(cid)
                ];
                return (
                  <Stack key={cid} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: cat, flexShrink: 0 }} />
                    <Typography sx={{ flex: 1, fontSize: 12, color: danceFlowColors.textSecondary, textTransform: 'capitalize' }}>
                      {cid}
                    </Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: danceFlowColors.textPrimary }}>
                      {cnt}
                    </Typography>
                  </Stack>
                );
              })}
              <Box sx={{ borderTop: `1px solid ${danceFlowColors.borderStrong}`, mt: 0.5, pt: 0.5 }}>
                <Stack direction="row">
                  <Typography sx={{ flex: 1, fontSize: 11, color: danceFlowColors.textMuted, fontWeight: 600 }}>
                    TOTAL
                  </Typography>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: danceFlowColors.lavender }}>
                    {annotations.length}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
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
