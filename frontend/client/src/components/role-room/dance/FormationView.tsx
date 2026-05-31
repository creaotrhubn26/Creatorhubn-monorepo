/**
 * FormationView — top-down stage diagram med Fabric.js.
 *
 * Brukeren plasserer dansere på en virtuell scene ved drag-and-drop.
 * Hver puck er en sirkel med initialer (eller foto-bakgrunn) + navn-label.
 * Formasjoner kan lagres som navngitte snapshots og animeres mellom (A → B
 * over N sekunder).
 *
 * Layout:
 *   ┌──────────┬─────────────────────────────────┬──────────────┐
 *   │  Roster  │       Stage canvas (Fabric)     │  Formations  │
 *   │  (drag   │                                 │  (lagrede    │
 *   │   til    │       [Mirror — back wall]      │   snapshots, │
 *   │   scene) │                                 │   anim A→B)  │
 *   │          │       [Audience — front]        │              │
 *   └──────────┴─────────────────────────────────┴──────────────┘
 *
 * Designvalg: bruker Fabric.js (allerede installert) for:
 *   - Innebygd drag av enkelt-objekter
 *   - Smooth tween-animasjon via fabric.util.animate
 *   - Layer/z-index-håndtering (stage-bunn / dansere / overlay-piler)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  TextField,
  Avatar,
  Chip,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  PhotoCamera as CameraIcon,
  Star as StarIcon,
  GridOn as GridIcon,
  GridOff as GridOffIcon,
  Sync as SymmetryIcon,
  ViewColumn as DistributeXIcon,
  ViewStream as DistributeYIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
} from '@mui/icons-material';
import { ToggleButton, ToggleButtonGroup, MenuItem } from '@mui/material';
import { Canvas, Circle, Rect, Textbox, Line, Group, FabricImage } from 'fabric';
import {
  DEMO_DANCERS,
  DEMO_FORMATIONS,
  type Dancer,
  type DancerPosition,
  type Formation,
} from './formationTypes';
import { FormationTimeline } from './FormationTimeline';
import { DancerPathsView } from './DancerPathsView';
import { formatTimecode, parseTimecode } from './timecode';
import { DancerPathPreview } from './DancerPathPreview';
import { StageMap3D } from './StageMap3D';
import { CurveOverlay } from './CurveOverlay';

// ─── Stage-dimensjoner (interne canvas-piksler — uavhengig av render-størrelse) ─

export type StageType = 'proscenium' | 'black_box' | 'runway' | 'in_the_round';

interface StagePresetMeta {
  type: StageType;
  label: string;
  description: string;
}

const STAGE_PRESETS: readonly StagePresetMeta[] = [
  { type: 'proscenium',   label: 'Proscenium',  description: '12×8m — speil bak, publikum foran' },
  { type: 'black_box',    label: 'Black box',   description: '10×10m — kvadratisk, ingen fast publikumsvegg' },
  { type: 'runway',       label: 'Runway',      description: '6×14m — smal og dyp, lange linjer' },
  { type: 'in_the_round', label: 'In the round', description: 'Sirkulær — publikum hele veien rundt' },
] as const;

const SNAP_OFF = 0;
const SNAP_COARSE = 1 / 8;     // ~1.5m cells på 12m proscenium
const SNAP_FINE = 1 / 16;      // ~75cm cells

const STAGE_WIDTH = 720;
const STAGE_HEIGHT = 480;
const STAGE_PADDING = 28;
const PUCK_RADIUS = 26;

// ─── Props ───────────────────────────────────────────────────────────────

export interface FormationViewProps {
  dancers?: readonly Dancer[];
  initialFormations?: readonly Formation[];
  /** Kalles når en formasjon lagres/oppdateres. */
  onFormationsChange?: (formations: Formation[]) => void;
  /**
   * Kalles når brukeren dobbeltklikker på en dancer-puck. Brukes f.eks.
   * for å åpne danser-profilen. Default `undefined` → ingen visuell eller
   * funksjonell endring (eksisterende drag/click-flyt urørt).
   */
  onDancerClick?: (dancerId: string) => void;
  /**
   * Phase 4: valgfri video-panel-slot. Når satt, splittes stage-kolonnen i
   * to ([video | stage]) under lg. Når undefined: ingen visuell endring fra
   * pre-Phase-4-layout.
   */
  videoPanelSlot?: React.ReactNode;
}

// ─── Komponent ────────────────────────────────────────────────────────────

export const FormationView: React.FC<FormationViewProps> = ({
  dancers = DEMO_DANCERS,
  initialFormations = DEMO_FORMATIONS,
  onFormationsChange,
  onDancerClick,
  videoPanelSlot,
}) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

  const [formations, _setFormations] = useState<Formation[]>(() => [...initialFormations]);
  const [activeFormationId, setActiveFormationId] = useState<string | null>(
    () => initialFormations[0]?.id ?? null,
  );

  // F5-14: Undo/Redo-stacks. Vi snapshotter formations-state ved hver
  // mutasjon. setFormations wrappes slik at history-stack vedlikeholdes.
  const undoStackRef = useRef<Formation[][]>([]);
  const redoStackRef = useRef<Formation[][]>([]);
  const skipHistoryRef = useRef(false);
  const setFormations = useCallback((
    next: Formation[] | ((prev: Formation[]) => Formation[]),
  ): void => {
    _setFormations((prev) => {
      const computed = typeof next === 'function' ? (next as (p: Formation[]) => Formation[])(prev) : next;
      if (!skipHistoryRef.current) {
        undoStackRef.current.push(prev);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
      }
      return computed;
    });
  }, []);
  const undo = useCallback((): void => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    skipHistoryRef.current = true;
    _setFormations((cur) => {
      redoStackRef.current.push(cur);
      return prev;
    });
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
  }, []);
  const redo = useCallback((): void => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    skipHistoryRef.current = true;
    _setFormations((cur) => {
      undoStackRef.current.push(cur);
      return next;
    });
    setTimeout(() => { skipHistoryRef.current = false; }, 0);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // F5-15: Video + stage-map sync. Hør på 'dance:video-time'-CustomEvent
  // som video-spilleren dispatcher når playheaden flytter seg. Velg
  // formasjonen hvis tidsrom inneholder gjeldende currentTime.
  useEffect(() => {
    const onVideoTime = (e: Event): void => {
      const detail = (e as CustomEvent<{ currentTime?: number }>).detail;
      if (!detail || typeof detail.currentTime !== 'number') return;
      const t = detail.currentTime;
      const match = formations.find((f) => {
        if (f.startSec == null || f.endSec == null) return false;
        return t >= f.startSec && t <= f.endSec;
      });
      if (match && match.id !== activeFormationId) {
        setActiveFormationId(match.id);
      }
    };
    window.addEventListener('dance:video-time', onVideoTime as EventListener);
    return () => window.removeEventListener('dance:video-time', onVideoTime as EventListener);
  }, [formations, activeFormationId]);

  // Workflow-audit G11: dobbeltklikk på timeline-bakgrunn fra FormationTimeline
  // → opprett ny formasjon ved klikket tid. Kopierer posisjoner fra aktiv
  // formasjon (eller starter tomt), setter startSec/endSec og auto-selecter.
  useEffect(() => {
    const onCreateAt = (e: Event): void => {
      const detail = (e as CustomEvent<{ timeSec?: number }>).detail;
      if (!detail || typeof detail.timeSec !== 'number') return;
      const timeSec = Math.max(0, detail.timeSec);
      const seed = formations.find((f) => f.id === activeFormationId) ?? formations[0] ?? null;
      const snapshot: Formation = {
        id: `f-tmp-${Date.now()}`,
        name: `Formasjon ${formations.length + 1}`,
        positions: seed ? seed.positions.map((p) => ({ ...p })) : [],
        notes: '',
        startSec: timeSec,
        endSec: timeSec + 4,
        createdAt: new Date().toISOString(),
        tags: [],
      };
      setFormations((prev) => [...prev, snapshot]);
      setActiveFormationId(snapshot.id);
    };
    window.addEventListener('dance:create-formation-at', onCreateAt as EventListener);
    return () => window.removeEventListener('dance:create-formation-at', onCreateAt as EventListener);
  }, [formations, activeFormationId, setFormations]);

  // Phase 5: lytt på `dance:select-clip` fra ClipsSidebar slik at MUSIC-track
  // i FormationTimeline kan rendre waveform fra valgt clip's signedUrl.
  // Holdes lokalt så vi ikke trenger å bobble selection-state opp.
  const [selectedClipUrl, setSelectedClipUrl] = useState<string | null>(null);
  useEffect(() => {
    const onSelectClip = (e: Event): void => {
      const detail = (e as CustomEvent<{ signedUrl?: string | null }>).detail;
      if (!detail) return;
      setSelectedClipUrl(typeof detail.signedUrl === 'string' ? detail.signedUrl : null);
    };
    window.addEventListener('dance:select-clip', onSelectClip as EventListener);
    return () => window.removeEventListener('dance:select-clip', onSelectClip as EventListener);
  }, []);

  // Phase 2: lytt på `dance:export-formation` fra FormationHeaderBar.
  // PNG = fabric.toDataURL snapshot. JSON = serialisert formations-array.
  // PDF er stubbed (knapp disabled i headeren — Phase 6 lager renderer).
  useEffect(() => {
    const onExport = (e: Event): void => {
      const detail = (e as CustomEvent<{ format?: 'png' | 'json' | 'pdf'; filename?: string }>).detail;
      if (!detail) return;
      void import('./formationExport').then((mod) => {
        const filename = detail.filename ?? mod.defaultExportFilename(detail.format ?? 'png', formations);
        if (detail.format === 'png') {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
          mod.downloadDataUrl(dataUrl, filename);
        } else if (detail.format === 'json') {
          const payload = mod.buildFormationExportPayload(formations);
          mod.downloadJson(payload, filename);
        }
      });
    };
    window.addEventListener('dance:export-formation', onExport as EventListener);
    return () => window.removeEventListener('dance:export-formation', onExport as EventListener);
  }, [formations]);

  const [newFormationName, setNewFormationName] = useState('');
  const [animationProgress, setAnimationProgress] = useState<{ from: string; to: string } | null>(null);

  // Stage + manipulasjons-verktøy (Slice 6)
  const [stageType, setStageType] = useState<StageType>('proscenium');
  const [snapStep, setSnapStep] = useState<number>(SNAP_OFF);
  const [symmetry, setSymmetry] = useState<boolean>(false);

  // DanceFlow-paritet (F5)
  const [hiddenDancerIds, setHiddenDancerIds] = useState<Set<string>>(() => new Set());
  const [showPaths, setShowPaths] = useState<boolean>(false);
  const [showIds, setShowIds] = useState<boolean>(false);
  const [stageOpacity, setStageOpacity] = useState<number>(1);
  const [stageMode, setStageMode] = useState<'2d' | '3d'>('2d');
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [curveMode, setCurveMode] = useState<boolean>(false);

  const dancersById = useMemo(
    () => new Map(dancers.map((d) => [d.id, d])),
    [dancers],
  );
  const activeFormation = formations.find((f) => f.id === activeFormationId) ?? null;

  // ─── Fabric init ───────────────────────────────────

  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new Canvas(canvasElRef.current, {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundColor: '#0d1218',
      selection: false,
      preserveObjectStacking: true,
    });
    fabricRef.current = canvas;

    return () => {
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // Phase 6c: ResizeObserver gjør Fabric-canvas responsive til container-
  // bredden. Internal coordinate system holdes på STAGE_WIDTH × STAGE_HEIGHT
  // (pucks/drag-logikk er uendret) — vi skalerer DOM-size + setZoom slik at
  // alt rendres pro-rata. Clamp [0.5, 2.0] så pucks ikke blir ubrukelig små
  // på mobil eller ubrukelig store på 4K-skjermer. Throttlet via requestAnimationFrame.
  useEffect(() => {
    const canvasEl = canvasElRef.current;
    const canvas = fabricRef.current;
    if (!canvasEl || !canvas) return;
    const wrapper = canvasEl.parentElement;
    if (!wrapper) return;

    let rafId: number | null = null;
    const recompute = (): void => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const containerWidth = wrapper.clientWidth || STAGE_WIDTH;
        const targetRatio = Math.max(0.5, Math.min(2, containerWidth / STAGE_WIDTH));
        const targetWidth = STAGE_WIDTH * targetRatio;
        const targetHeight = STAGE_HEIGHT * targetRatio;
        const current = fabricRef.current;
        if (!current) return;
        // setDimensions skriver canvas.width/height (DOM) + interne props;
        // setZoom skalerer rendering-konteksten så objekter holder
        // relative posisjoner.
        current.setDimensions({ width: targetWidth, height: targetHeight });
        current.setZoom(targetRatio);
        current.requestRenderAll();
      });
    };

    recompute(); // initial sync (parent kan endre seg under første render)

    const observer = new ResizeObserver(recompute);
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Re-tegn stage-bakgrunn når preset eller snap-grid endres.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    // Fjern eksisterende stage-bakgrunn (alt som ikke har dancerId).
    const stageObjects = canvas.getObjects().filter((o) => !(o as { dancerId?: string }).dancerId);
    stageObjects.forEach((o) => canvas.remove(o));
    drawStageBackground(canvas, stageType, snapStep);
    // Sørg for at dancers ligger over stage-bakgrunnen.
    canvas.requestRenderAll();
  }, [stageType, snapStep]);

  // ─── Hjelpefunksjoner ──────────────────────────────
  // Definert før useEffect som bruker den, slik at TS-strict ikke
  // klager på "used before declaration".

  // ARIA live-region: kunngjør drag-flytt for skjermlesere siden Fabric.js-
  // canvas ikke er screen-reader-tilgjengelig.
  const [ariaAnnounce, setAriaAnnounce] = useState<string>('');

  const updateDancerPosition = useCallback((dancerId: string, x: number, y: number) => {
    setFormations((prev) =>
      prev.map((f) => {
        if (f.id !== activeFormationId) return f;
        return {
          ...f,
          positions: f.positions.map((p) =>
            p.dancerId === dancerId ? { ...p, x, y } : p,
          ),
        };
      }),
    );
    const dancer = dancersById.get(dancerId);
    const name = dancer?.name ?? dancerId;
    setAriaAnnounce(
      `${name} flyttet til posisjon ${(x * 100).toFixed(0)}% horisontalt, ${(y * 100).toFixed(0)}% vertikalt`,
    );
  }, [activeFormationId, dancersById]);

  // ─── Tegn aktiv formasjon når den endres ──────────
  // onDancerClick lagres i en ref slik at vi ikke trenger å re-tegne
  // formasjonen når kun callbacken endres.
  const onDancerClickRef = useRef<typeof onDancerClick>(onDancerClick);
  useEffect(() => {
    onDancerClickRef.current = onDancerClick;
  }, [onDancerClick]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activeFormation) return;
    const idx = formations.findIndex((f) => f.id === activeFormation.id);
    const prev = idx > 0 ? formations[idx - 1] : null;
    const next = idx >= 0 && idx < formations.length - 1 ? formations[idx + 1] : null;
    drawFormation(
      canvas,
      activeFormation,
      dancersById,
      (dancerId, x, y) => {
        updateDancerPosition(dancerId, x, y);
      },
      (dancerId) => {
        onDancerClickRef.current?.(dancerId);
      },
      {
        snapStep, symmetry,
        hiddenDancerIds, showPaths, showIds,
        prevFormation: prev, nextFormation: next,
      },
    );
  }, [activeFormation, formations, dancersById, updateDancerPosition, snapStep, symmetry, hiddenDancerIds, showPaths, showIds]);

  // Persister via callback når formations endres
  useEffect(() => {
    onFormationsChange?.(formations);
  }, [formations, onFormationsChange]);

  // ─── Add/remove dancer fra aktiv formasjon ─────────

  const isDancerInFormation = useCallback((dancerId: string): boolean => {
    return !!activeFormation?.positions.find((p) => p.dancerId === dancerId);
  }, [activeFormation]);

  const addDancerToFormation = useCallback((dancerId: string) => {
    if (!activeFormationId) return;
    if (isDancerInFormation(dancerId)) return;
    setFormations((prev) =>
      prev.map((f) =>
        f.id === activeFormationId
          ? {
              ...f,
              positions: [...f.positions, { dancerId, x: 0.5, y: 0.5, facing: 0 }],
            }
          : f,
      ),
    );
  }, [activeFormationId, isDancerInFormation]);

  const removeDancerFromFormation = useCallback((dancerId: string) => {
    if (!activeFormationId) return;
    setFormations((prev) =>
      prev.map((f) =>
        f.id === activeFormationId
          ? { ...f, positions: f.positions.filter((p) => p.dancerId !== dancerId) }
          : f,
      ),
    );
  }, [activeFormationId]);

  // ─── Lagre ny formasjon — snapshot av nåværende ────

  const saveNewFormation = useCallback(() => {
    if (!newFormationName.trim() || !activeFormation) return;
    const snapshot: Formation = {
      id: `f-${Date.now()}`,
      name: newFormationName.trim(),
      positions: activeFormation.positions.map((p) => ({ ...p })),
      createdAt: new Date().toISOString(),
      tags: [],
    };
    setFormations((prev) => [...prev, snapshot]);
    setActiveFormationId(snapshot.id);
    setNewFormationName('');
  }, [activeFormation, newFormationName]);

  const updateActiveFormation = useCallback(
    (patch: Partial<Formation>): void => {
      if (!activeFormationId) return;
      setFormations((prev) =>
        prev.map((f) => (f.id === activeFormationId ? { ...f, ...patch } : f)),
      );
    },
    [activeFormationId],
  );

  const deleteFormation = useCallback((id: string) => {
    setFormations((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0 || activeFormationId === id) {
        setActiveFormationId(next[0]?.id ?? null);
      }
      return next;
    });
  }, [activeFormationId]);

  // ─── Animer overgang fra aktiv formasjon til en annen ───

  const animateToFormation = useCallback((targetId: string) => {
    const canvas = fabricRef.current;
    if (!canvas || !activeFormation) return;
    const target = formations.find((f) => f.id === targetId);
    if (!target) return;

    setAnimationProgress({ from: activeFormation.id, to: targetId });
    animateFormationTransition(canvas, activeFormation, target, dancersById, () => {
      setAnimationProgress(null);
      setActiveFormationId(targetId);
    });
  }, [activeFormation, formations, dancersById]);

  // ─── Distribuer dansere jevnt på horisontal/vertikal linje ─────
  const distributeEvenly = useCallback(
    (axis: 'x' | 'y') => {
      if (!activeFormationId) return;
      setFormations((prev) =>
        prev.map((f) => {
          if (f.id !== activeFormationId) return f;
          const sorted = [...f.positions].sort((a, b) => a[axis] - b[axis]);
          const n = sorted.length;
          if (n === 0) return f;
          // Snap step honoreres slik at distribuerte posisjoner havner på grid.
          const margin = 0.1;
          const span = 1 - 2 * margin;
          const positions = sorted.map((p, i) => {
            let value = n === 1 ? 0.5 : margin + (i / (n - 1)) * span;
            if (snapStep > 0) value = Math.round(value / snapStep) * snapStep;
            return axis === 'x' ? { ...p, x: value } : { ...p, y: value };
          });
          // Returnér i original-rekkefølge så formation.positions ikke
          // re-sorteres uventet for resten av appen.
          const byId = new Map(positions.map((p) => [p.dancerId, p]));
          return {
            ...f,
            positions: f.positions.map((p) => byId.get(p.dancerId) ?? p),
          };
        }),
      );
    },
    [activeFormationId, snapStep],
  );

  // ─── Render ────────────────────────────────────────

  return (
    <Box
      data-testid="formation-view-wrapper"
      sx={{ bgcolor: '#0a0a0a', color: '#e5e7eb', display: 'flex', flexDirection: 'column' }}
    >
    <Box
      data-testid="formation-view"
      sx={{
        bgcolor: '#0a0a0a',
        color: '#e5e7eb',
        flex: 1,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '200px 1fr 260px' },
        gap: 0,
      }}
    >
      {/* ARIA live-region — usynlig, men kunngjort av skjermlesere ved
          drag-flytt og andre formation-endringer. */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
        data-testid="formation-aria-live"
      >
        {ariaAnnounce}
      </Box>
      {/* ─── Roster (venstre) ───────────────────────── */}
      <Box
        data-testid="formation-roster"
        sx={{
          borderRight: { lg: '1px solid #1e2536' },
          bgcolor: '#0a0a0a',
          p: 1.5,
          overflowY: 'auto',
        }}
      >
        <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#6b7280', fontWeight: 700, mb: 1 }}>
          DANSE-ROSTER ({dancers.length})
        </Typography>
        {/* Workflow-audit G3: hvis ingen ekte dansere er lagt til (kun
            DEMO_DANCERS via default prop med d- prefiks), vis tydelig CTA
            som leder til Dancers-fanen. */}
        {dancers.length === 0 || dancers.every((d) => d.id.startsWith('d-')) ? (
          <Box
            data-testid="formation-roster-empty"
            sx={{
              p: 1.25,
              mb: 1,
              borderRadius: 1,
              border: '1px dashed #2a3142',
              bgcolor: 'rgba(167,139,250,0.04)',
            }}
          >
            <Typography sx={{ fontSize: 10, color: '#e5e7eb', fontWeight: 600, mb: 0.5 }}>
              Demo-dansere vises
            </Typography>
            <Typography sx={{ fontSize: 9, color: '#9ca3af', mb: 1, lineHeight: 1.4 }}>
              Legg til dine egne dansere i Dancers-fanen for å bruke ekte navn.
            </Typography>
            <Box
              component="button"
              type="button"
              data-testid="formation-roster-empty-cta"
              onClick={() => {
                if (typeof window === 'undefined') return;
                window.dispatchEvent(
                  new CustomEvent('dance:set-tab', { detail: { tabId: 'students' } }),
                );
              }}
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: '#a78bfa',
                bgcolor: 'transparent',
                border: '1px solid #a78bfa',
                borderRadius: 0.5,
                px: 1,
                py: 0.4,
                cursor: 'pointer',
                font: 'inherit',
                '&:hover': { bgcolor: 'rgba(167,139,250,0.12)' },
              }}
            >
              Gå til Dancers →
            </Box>
          </Box>
        ) : null}
        <Stack spacing={0.5}>
          {dancers.map((d) => {
            const inFormation = isDancerInFormation(d.id);
            return (
              <Box
                key={d.id}
                data-testid={`roster-item-${d.id}`}
                onClick={() => (inFormation ? removeDancerFromFormation(d.id) : addDancerToFormation(d.id))}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 0.75,
                  borderRadius: 1,
                  cursor: 'pointer',
                  border: `1px solid ${inFormation ? d.color ?? '#8b5cf6' : '#1e2536'}`,
                  bgcolor: inFormation ? `${d.color ?? '#8b5cf6'}15` : 'transparent',
                  transition: 'all 0.12s',
                  '&:hover': { bgcolor: inFormation ? `${d.color ?? '#8b5cf6'}22` : '#0f1318' },
                }}
              >
                <Avatar
                  src={d.photoUrl}
                  sx={{
                    width: 28, height: 28, fontSize: 10,
                    bgcolor: d.color ?? '#3b82f6',
                    border: inFormation ? `2px solid ${d.color ?? '#8b5cf6'}` : 'none',
                  }}
                >
                  {d.initials}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 11, fontWeight: 600, color: inFormation ? '#fff' : '#cbd5e1' }}>
                    {d.name}
                  </Typography>
                  {d.role && (
                    <Typography noWrap sx={{ fontSize: 9, color: '#6b7280' }}>
                      {d.role}
                    </Typography>
                  )}
                </Box>
                {inFormation && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: d.color ?? '#8b5cf6' }} />
                )}
              </Box>
            );
          })}
        </Stack>
        <Typography sx={{ fontSize: 9, color: '#6b7280', mt: 1.5, fontStyle: 'italic' }}>
          Klikk for å legge til/fjerne fra aktiv formasjon. Drag på scenen for plassering.
        </Typography>
      </Box>

      {/* ─── Stage canvas (sentralt) ───────────────── */}
      {/* Phase 4: når videoPanelSlot er satt, splittes senter-kolonnen i
          [video | stage]. Når undefined faller layouten tilbake til
          pre-Phase-4-stagen (flat column-stack). */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: videoPanelSlot
            ? { xs: '1fr', lg: 'minmax(280px, 1fr) auto' }
            : '1fr',
          gap: videoPanelSlot ? 1 : 0,
          bgcolor: '#0a0a0a',
        }}
        data-testid="formation-stage-center-grid"
      >
        {videoPanelSlot ? (
          <Box
            sx={{ p: 2, display: 'flex', alignItems: 'stretch', minWidth: 0 }}
            data-testid="formation-video-slot"
          >
            {videoPanelSlot}
          </Box>
        ) : null}
      <Box
        data-testid="formation-stage-wrapper"
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          bgcolor: '#0a0a0a',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>
            {activeFormation?.name ?? 'Ingen formasjon valgt'}
          </Typography>
          {activeFormation?.notes && (
            <Chip
              size="small"
              label={activeFormation.notes}
              sx={{ height: 20, fontSize: 10, bgcolor: '#1e2536', color: '#9ca3af', maxWidth: 360 }}
            />
          )}
          {animationProgress && (
            <Chip size="small" label="Animerer…" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(251,191,36,0.18)', color: '#fbbf24' }} />
          )}
        </Stack>

        {/* ─── Stage-verktøylinje (Slice 6) ──────────────── */}
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ width: '100%' }}
          data-testid="formation-toolbar"
        >
          <TextField
            select
            size="small"
            value={stageType}
            onChange={(e) => setStageType(e.target.value as StageType)}
            sx={{
              minWidth: 160,
              '& .MuiInputBase-root': {
                bgcolor: '#0d1218',
                color: '#e5e7eb',
                fontSize: 12,
              },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: '#2a3142' },
            }}
            data-testid="formation-stage-type"
          >
            {STAGE_PRESETS.map((p) => (
              <MenuItem key={p.type} value={p.type}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <ToggleButtonGroup
            size="small"
            value={snapStep}
            exclusive
            onChange={(_, v: number | null) => v !== null && setSnapStep(v)}
            sx={{
              '& .MuiToggleButton-root': {
                color: '#9ca3af',
                borderColor: '#2a3142',
                fontSize: 11,
                px: 1,
                '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(167,139,250,0.18)' },
              },
            }}
          >
            <ToggleButton value={SNAP_OFF} aria-label="Snap av" data-testid="formation-snap-off">
              <GridOffIcon sx={{ fontSize: 14, mr: 0.5 }} /> Av
            </ToggleButton>
            <ToggleButton value={SNAP_COARSE} aria-label="Grovt grid (1/8)" data-testid="formation-snap-coarse">
              <GridIcon sx={{ fontSize: 14, mr: 0.5 }} /> 1/8
            </ToggleButton>
            <ToggleButton value={SNAP_FINE} aria-label="Fint grid (1/16)" data-testid="formation-snap-fine">
              <GridIcon sx={{ fontSize: 14, mr: 0.5 }} /> 1/16
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Symmetri — speile partner-danser over senter-aksen">
            <ToggleButton
              size="small"
              value="symmetry"
              selected={symmetry}
              onChange={() => setSymmetry((v) => !v)}
              sx={{
                color: symmetry ? '#fff' : '#9ca3af',
                borderColor: '#2a3142',
                bgcolor: symmetry ? 'rgba(167,139,250,0.18)' : 'transparent',
                fontSize: 11,
                px: 1,
              }}
              data-testid="formation-symmetry-toggle"
            >
              <SymmetryIcon sx={{ fontSize: 14, mr: 0.5 }} /> Symmetri
            </ToggleButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Fordel jevnt horisontalt">
            <span>
              <IconButton
                size="small"
                onClick={() => distributeEvenly('x')}
                disabled={!activeFormation || activeFormation.positions.length < 2}
                sx={{ color: '#a78bfa' }}
                data-testid="formation-distribute-x"
              >
                <DistributeXIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Fordel jevnt vertikalt">
            <span>
              <IconButton
                size="small"
                onClick={() => distributeEvenly('y')}
                disabled={!activeFormation || activeFormation.positions.length < 2}
                sx={{ color: '#a78bfa' }}
                data-testid="formation-distribute-y"
              >
                <DistributeYIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          {/* Workflow-audit G15: tydeliggjør curve-mode med rikere tooltip */}
          <Tooltip
            title={
              curveMode
                ? 'Slå av kurve-modus (klikk på en danser for å avbryte)'
                : 'Buet bevegelses-sti — klikk to dansere for å koble dem med en kurve i stedet for rett linje'
            }
            placement="bottom"
          >
            <ToggleButton
              size="small"
              value="curve"
              selected={curveMode}
              onChange={() => setCurveMode((v) => !v)}
              data-testid="formation-curve-tool"
              sx={{
                color: curveMode ? '#fff' : '#9ca3af',
                borderColor: '#2a3142',
                bgcolor: curveMode ? 'rgba(96,165,250,0.18)' : 'transparent',
                fontSize: 11, px: 1,
              }}
            >
              ⌒
            </ToggleButton>
          </Tooltip>
          <Tooltip title="Angre (⌘Z)">
            <span>
              <IconButton
                size="small"
                onClick={undo}
                data-testid="formation-undo"
                sx={{ color: '#a78bfa' }}
              >
                <UndoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Gjør om (⌘⇧Z)">
            <span>
              <IconButton
                size="small"
                onClick={redo}
                data-testid="formation-redo"
                sx={{ color: '#a78bfa' }}
              >
                <RedoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #2a3142',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            opacity: stageOpacity,
            transition: 'opacity 0.2s',
            // Phase 6c: Box tilpasser seg canvas-størrelsen som
            // ResizeObserver bestemmer. minWidth = STAGE_WIDTH * 0.5 så
            // boksen ikke krymper under min-clamp i observer-throttlen.
            width: '100%',
            minWidth: STAGE_WIDTH * 0.5,
          }}
        >
          {/* 2D canvas — alltid mountert (Fabric.js krever det), men skjult
              i 3D-modus slik at vi ikke mister state ved bytte. */}
          <canvas
            ref={canvasElRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            data-testid="formation-canvas"
            style={{ display: stageMode === '2d' ? 'block' : 'none' }}
          />
          {/* 3D-stage (Three.js) — kun mountet i 3D-modus så vi unngår å
              betale GPU/ress på 2D-bruk. */}
          {stageMode === '3d' && activeFormation ? (
            <StageMap3D
              formation={activeFormation}
              dancers={dancers}
              hiddenDancerIds={hiddenDancerIds}
              showIds={showIds}
              onDancerSelect={(id) => onDancerClickRef.current?.(id)}
            />
          ) : null}
          {stageMode === '2d' ? (
            <>
              {/* Lag C-1: DanceFlow-konvensjons-labels (Upstage/Downstage/Left/Right)
                  matcher dans-mockup-spec. Beholder MIRROR·BACK WALL-undertekst som
                  brukerhint for produsenter som ikke kjenner teaterterminologien. */}
              <Typography
                data-testid="formation-stage-label-upstage"
                sx={{
                  position: 'absolute', top: 6, left: 0, right: 0, textAlign: 'center',
                  fontSize: 11, color: '#9ca3af', letterSpacing: 2, pointerEvents: 'none',
                  fontWeight: 700,
                }}
              >
                Upstage
                <Box component="span" sx={{ display: 'block', fontSize: 8, color: '#6b7280', mt: 0.25, letterSpacing: 1.5, fontWeight: 500 }}>
                  ↑ Mirror · Back Wall
                </Box>
              </Typography>
              <Typography
                data-testid="formation-stage-label-downstage"
                sx={{
                  position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
                  fontSize: 11, color: '#fbbf24', letterSpacing: 2, pointerEvents: 'none',
                  fontWeight: 700,
                }}
              >
                Downstage
                <Box component="span" sx={{ display: 'block', fontSize: 8, color: '#9ca3af', mt: 0.25, letterSpacing: 1.5, fontWeight: 500 }}>
                  ↓ Audience · Front
                </Box>
              </Typography>
              <Typography
                data-testid="formation-stage-label-left"
                sx={{
                  position: 'absolute', top: '50%', left: 4, transform: 'translateY(-50%) rotate(-90deg)',
                  transformOrigin: 'center', fontSize: 9, color: '#6b7280',
                  letterSpacing: 1.5, pointerEvents: 'none', fontWeight: 600,
                }}
              >
                Left
              </Typography>
              <Typography
                data-testid="formation-stage-label-right"
                sx={{
                  position: 'absolute', top: '50%', right: 4, transform: 'translateY(-50%) rotate(90deg)',
                  transformOrigin: 'center', fontSize: 9, color: '#6b7280',
                  letterSpacing: 1.5, pointerEvents: 'none', fontWeight: 600,
                }}
              >
                Right
              </Typography>
              {/* F5-13B: bezier-curve-overlay i 2D-modus. */}
              {activeFormation ? (() => {
                const idxAF = formations.findIndex((f) => f.id === activeFormation.id);
                const nextAF = idxAF >= 0 && idxAF < formations.length - 1 ? formations[idxAF + 1] : null;
                return (
                  <CurveOverlay
                    formation={activeFormation}
                    nextFormation={nextAF}
                    dancers={dancers}
                    enabled={curveMode}
                    onChange={(paths) => updateActiveFormation({ transitionPaths: paths })}
                  />
                );
              })() : null}
            </>
          ) : null}
        </Box>

        {/* Lag C-1: Stage Controls — Opacity + Show Paths + Show IDs UNDER
            stagen (matcher DanceFlow-mockup). Slider og toggles styrer SAMME
            state som FormationDetailsPanel-controlsene; begge UI'er er i sync. */}
        <Stack
          direction="row"
          spacing={1.5}
          alignItems="center"
          data-testid="formation-stage-controls"
          sx={{
            width: '100%',
            px: 1,
            py: 0.75,
            bgcolor: 'rgba(255,255,255,0.02)',
            borderRadius: 1,
            border: '1px solid #1e2536',
          }}
        >
          <Typography sx={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
            Opacity
          </Typography>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(stageOpacity * 100)}
            onChange={(e) => setStageOpacity(Number(e.target.value) / 100)}
            data-testid="formation-stage-opacity"
            aria-label="Stage opacity"
            style={{ flex: 1, maxWidth: 180, accentColor: '#a78bfa' }}
          />
          <Typography sx={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, minWidth: 32 }}>
            {Math.round(stageOpacity * 100)}%
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box
            component="label"
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11,
              color: '#e5e7eb', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showPaths}
              onChange={() => setShowPaths((v) => !v)}
              data-testid="formation-stage-show-paths"
              style={{ accentColor: '#a78bfa' }}
            />
            Show Paths
          </Box>
          <Box
            component="label"
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 11,
              color: '#e5e7eb', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={showIds}
              onChange={() => setShowIds((v) => !v)}
              data-testid="formation-stage-show-ids"
              style={{ accentColor: '#a78bfa' }}
            />
            Show IDs
          </Box>
        </Stack>

        <Typography sx={{ fontSize: 10, color: '#6b7280', textAlign: 'center', mt: -0.5 }}>
          Drag dansere på scenen for å plassere. Posisjonen lagres automatisk i aktiv formasjon.
        </Typography>
      </Box>
      </Box>

      {/* ─── Formations-liste (høyre) ──────────────── */}
      <Box
        data-testid="formation-list"
        sx={{
          borderLeft: { lg: '1px solid #1e2536' },
          bgcolor: '#0f1318',
          p: 1.5,
          overflowY: 'auto',
        }}
      >
        {activeFormation && formations.length >= 1 ? (
          <DancerPathPreview formations={formations} dancers={dancers} />
        ) : null}
        {activeFormation ? (
          <FormationDetailsPanel
            key={activeFormation.id}
            formation={activeFormation}
            formations={formations}
            dancers={dancers}
            hiddenDancerIds={hiddenDancerIds}
            onToggleHidden={(id) => setHiddenDancerIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            })}
            showPaths={showPaths}
            onToggleShowPaths={() => setShowPaths((v) => !v)}
            showIds={showIds}
            onToggleShowIds={() => setShowIds((v) => !v)}
            stageOpacity={stageOpacity}
            onStageOpacityChange={setStageOpacity}
            stageMode={stageMode}
            onStageModeChange={setStageMode}
            onChange={updateActiveFormation}
          />
        ) : null}
        <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#6b7280', fontWeight: 700, mb: 1, mt: activeFormation ? 1.5 : 0 }}>
          FORMASJONER ({formations.length})
        </Typography>

        {/* Workflow-audit G10: tom-state CTA. Når ingen formasjoner finnes,
            er det ikke åpenbart hvordan man kommer i gang. Vis tydelig hint
            om begge inngangs-mønstrene: dobbeltklikk timeline ELLER skriv
            navn under. */}
        {formations.length === 0 ? (
          <Box
            data-testid="formations-empty-state"
            sx={{
              p: 1.5,
              mb: 1,
              borderRadius: 1,
              border: '1px dashed #2a3142',
              bgcolor: 'rgba(167,139,250,0.04)',
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 11, color: '#e5e7eb', fontWeight: 600, mb: 0.5 }}>
              Ingen formasjoner ennå
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#9ca3af', lineHeight: 1.5 }}>
              <strong style={{ color: '#a78bfa' }}>Dobbeltklikk på tidslinjen</strong>{' '}
              under for å opprette en ved en spesifikk tid,
              <br />
              eller skriv et navn under og trykk «Lagre».
            </Typography>
          </Box>
        ) : null}

        <Stack spacing={0.5}>
          {formations.map((f) => {
            const isActive = f.id === activeFormationId;
            return (
              <Box
                key={f.id}
                data-testid={`formation-item-${f.id}`}
                sx={{
                  p: 0.75,
                  borderRadius: 1,
                  border: `1px solid ${isActive ? '#a78bfa' : '#1e2536'}`,
                  bgcolor: isActive ? 'rgba(167,139,250,0.1)' : 'transparent',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box
                    sx={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
                    onClick={() => setActiveFormationId(f.id)}
                  >
                    <Typography
                      noWrap
                      sx={{ fontSize: 11, fontWeight: 600, color: isActive ? '#c4b5fd' : '#e5e7eb' }}
                    >
                      {f.name}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: '#6b7280' }}>
                      {f.positions.length} dansere
                    </Typography>
                  </Box>
                  {!isActive && (
                    <Tooltip title="Animer overgang fra aktiv">
                      <IconButton
                        size="small"
                        data-testid={`formation-animate-${f.id}`}
                        onClick={() => animateToFormation(f.id)}
                        sx={{ color: '#a78bfa', p: 0.25 }}
                        disabled={!!animationProgress}
                      >
                        <PlayIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {formations.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={() => deleteFormation(f.id)}
                      sx={{ color: '#9ca3af', p: 0.25, '&:hover': { color: '#f87171' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Stack>

        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #1e2536' }}>
          <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5 }}>
            LAGRE NÅVÆRENDE SOM
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <TextField
              size="small"
              placeholder="Formation navn"
              value={newFormationName}
              onChange={(e) => setNewFormationName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveNewFormation(); }}
              sx={{
                flex: 1,
                '& .MuiInputBase-input': { fontSize: 11, color: '#e5e7eb' },
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#0a0a0a',
                  '& fieldset': { borderColor: '#1e2536' },
                },
              }}
            />
            <IconButton
              size="small"
              onClick={saveNewFormation}
              disabled={!newFormationName.trim()}
              sx={{ bgcolor: '#8b5cf6', color: '#fff', '&:hover': { bgcolor: '#7c3aed' }, '&.Mui-disabled': { bgcolor: '#1e2536', color: '#6b7280' } }}
            >
              <SaveIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Box>
      </Box>
    </Box>
    {/* DanceFlow-paritet: tids-akse for formasjons-rekkefølge.
        Phase 5: musicUrl wired fra valgt clip; DancerPathsView mountet INNI
        timeline-skallet via dancersTrackSlot. */}
    <Box sx={{ p: 1.5, borderTop: '1px solid #1e2536', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FormationTimeline
        formations={formations}
        activeFormationId={activeFormationId}
        onSelect={setActiveFormationId}
        musicUrl={selectedClipUrl}
        dancersTrackSlot={<DancerPathsView formations={formations} dancers={dancers} />}
      />
    </Box>
    </Box>
  );
};

// ═══════════════════════ FORMATION TEMPLATES (F5-6) ═══════════════════════

const FORMATION_TEMPLATES: ReadonlyArray<{
  id: string;
  label: string;
  /** Returnerer normaliserte (x,y)-posisjoner for `count` dansere. */
  generate: (count: number) => Array<{ x: number; y: number }>;
}> = [
  { id: 'horizontal_line', label: 'Horizontal Line', generate: (n) => Array.from({ length: n }, (_, i) => ({ x: n > 1 ? i / (n - 1) : 0.5, y: 0.5 })) },
  { id: 'v_shape',         label: 'V-Shape',         generate: (n) => Array.from({ length: n }, (_, i) => {
    const half = (n - 1) / 2;
    const offset = i - half;
    return { x: 0.5 + offset / Math.max(1, half) * 0.45, y: 0.3 + Math.abs(offset) / Math.max(1, half) * 0.5 };
  }) },
  { id: 'circle',          label: 'Circle',          generate: (n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: 0.5 + Math.cos(a) * 0.35, y: 0.5 + Math.sin(a) * 0.35 };
  }) },
  { id: 'diamond',         label: 'Diamond',         generate: (n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a));
    return { x: 0.5 + (Math.cos(a) / r) * 0.4, y: 0.5 + (Math.sin(a) / r) * 0.4 };
  }) },
  { id: 'split_groups',    label: 'Split Groups',    generate: (n) => Array.from({ length: n }, (_, i) => {
    const group = i < n / 2 ? 0 : 1;
    const idxInGroup = group === 0 ? i : i - Math.floor(n / 2);
    const groupSize = group === 0 ? Math.floor(n / 2) : Math.ceil(n / 2);
    return { x: group === 0 ? 0.25 : 0.75, y: groupSize > 1 ? idxInGroup / (groupSize - 1) * 0.6 + 0.2 : 0.5 };
  }) },
];

// ═══════════════════════ FORMATION DETAILS PANEL ═══════════════════════
// DanceFlow-paritet: per-formation editor med tags, notes, time-felt,
// dancers-list, transition-editor og stage-overlay-kontroller (F5).

interface FormationDetailsPanelProps {
  formation: Formation;
  formations: Formation[];
  dancers: readonly Dancer[];
  hiddenDancerIds: ReadonlySet<string>;
  onToggleHidden: (dancerId: string) => void;
  showPaths: boolean;
  onToggleShowPaths: () => void;
  showIds: boolean;
  onToggleShowIds: () => void;
  stageOpacity: number;
  onStageOpacityChange: (v: number) => void;
  stageMode: '2d' | '3d';
  onStageModeChange: (m: '2d' | '3d') => void;
  onChange: (patch: Partial<Formation>) => void;
}

/**
 * Lag D-1: TimecodeInput — kontrollert HH:MM:SS:FF input som committer
 * parsed sekunder til parent. Lokal draft-state mens brukeren skriver så
 * cursor ikke hopper. parseTimecode godtar både HH:MM:SS og HH:MM:SS:FF.
 */
const TimecodeInput: React.FC<{
  label: string;
  valueSec: number | null;
  onCommit: (sec: number | null) => void;
  testId: string;
}> = ({ label, valueSec, onCommit, testId }) => {
  const formatted = valueSec != null && Number.isFinite(valueSec)
    ? formatTimecode(valueSec)
    : '';
  const [draft, setDraft] = useState<string>(formatted);
  const [hasFocus, setHasFocus] = useState(false);

  // Sync når parent-verdien endres OG vi ikke holder fokus (unngå overwrite
  // mens brukeren skriver).
  React.useEffect(() => {
    if (!hasFocus) setDraft(formatted);
  }, [formatted, hasFocus]);

  const commit = (raw: string): void => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    const parsed = parseTimecode(trimmed);
    if (parsed != null) {
      onCommit(parsed);
    } else {
      // Ugyldig — tilbakestill til siste gyldig
      setDraft(formatted);
    }
  };

  return (
    <TextField
      size="small"
      label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setHasFocus(true)}
      onBlur={(e) => {
        setHasFocus(false);
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="00:00:00:00"
      inputProps={{ 'data-testid': testId, spellCheck: false }}
      sx={{
        flex: 1,
        '& .MuiInputBase-input': { fontSize: 11, fontVariantNumeric: 'tabular-nums' },
        '& .MuiInputLabel-root': { fontSize: 11 },
      }}
    />
  );
};

const FormationDetailsPanel: React.FC<FormationDetailsPanelProps> = ({
  formation, formations, dancers,
  hiddenDancerIds, onToggleHidden,
  showPaths, onToggleShowPaths,
  showIds, onToggleShowIds,
  stageOpacity, onStageOpacityChange,
  stageMode, onStageModeChange,
  onChange,
}) => {
  const [tagDraft, setTagDraft] = useState('');
  const tags = formation.tags ?? [];

  const addTag = (): void => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft('');
      return;
    }
    onChange({ tags: [...tags, t] });
    setTagDraft('');
  };
  const removeTag = (t: string): void => onChange({ tags: tags.filter((x) => x !== t) });

  // F5-6: anvend template på aktiv formasjon (overskriver posisjoner).
  const applyTemplate = (templateId: string): void => {
    const tpl = FORMATION_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const positions = formation.positions.map((p, i) => {
      const target = tpl.generate(formation.positions.length)[i];
      return { ...p, x: target.x, y: target.y };
    });
    onChange({ positions });
  };

  // F5-5: transition target er "neste formasjon i sekvensen"
  const idx = formations.findIndex((f) => f.id === formation.id);
  const transitionFromOptions = formations.filter((f) => f.id !== formation.id);
  const transitionToFormation = idx >= 0 && idx < formations.length - 1 ? formations[idx + 1] : null;

  // Dancers i denne formasjonen (mapper positions → Dancer-record).
  const dancersInFormation = formation.positions
    .map((p) => dancers.find((d) => d.id === p.dancerId))
    .filter((d): d is Dancer => !!d);

  return (
    <Box
      data-testid="formation-details-panel"
      sx={{ pb: 1.5, mb: 1.5, borderBottom: '1px solid #1e2536' }}
    >
      <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#a78bfa', fontWeight: 700, mb: 0.75 }}>
        AKTIV FORMASJON
      </Typography>

      {/* F5-12: 2D/3D stage-mode toggle */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} data-testid="formation-stage-mode-toggle">
        {(['2d', '3d'] as const).map((m) => (
          <Box
            key={m}
            role="tab"
            tabIndex={0}
            aria-selected={stageMode === m}
            onClick={() => onStageModeChange(m)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStageModeChange(m); } }}
            data-testid={`formation-stage-mode-${m}`}
            sx={{
              flex: 1, textAlign: 'center', cursor: 'pointer',
              py: 0.5, fontSize: 10, fontWeight: 700, letterSpacing: 1,
              color: stageMode === m ? '#fff' : 'rgba(229,231,235,0.45)',
              bgcolor: stageMode === m ? 'rgba(167,139,250,0.22)' : 'transparent',
              border: `1px solid ${stageMode === m ? '#a78bfa' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 0.5,
              textTransform: 'uppercase',
            }}
          >
            {m}
          </Box>
        ))}
      </Stack>

      {/* F5-6: Template-dropdown */}
      <TextField
        select
        size="small"
        fullWidth
        label="Template"
        value=""
        onChange={(e) => applyTemplate(e.target.value)}
        SelectProps={{ displayEmpty: true }}
        inputProps={{ 'data-testid': 'formation-template-select' }}
        sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 11 }, '& .MuiInputLabel-root': { fontSize: 11 } }}
      >
        <MenuItem value="" sx={{ fontSize: 11, color: '#6b7280' }}>— velg template —</MenuItem>
        {FORMATION_TEMPLATES.map((t) => (
          <MenuItem key={t.id} value={t.id} sx={{ fontSize: 11 }}>{t.label}</MenuItem>
        ))}
      </TextField>
      <TextField
        size="small"
        fullWidth
        value={formation.name}
        onChange={(e) => onChange({ name: e.target.value })}
        sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 12, color: '#fff', fontWeight: 600 } }}
        data-testid="formation-details-name"
      />
      {/* Lag D-1: HH:MM:SS:FF tids-inputs (DanceFlow-mockup-paritet).
          TimecodeInput holder lokal state mens brukeren skriver — committer
          parsed sekunder til onChange ved blur eller Enter. Ugyldig input
          tilbakestilles til siste gyldig verdi. */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
        <TimecodeInput
          label="Start Time"
          valueSec={formation.startSec ?? null}
          onCommit={(sec) => onChange({ startSec: sec })}
          testId="formation-details-start-sec"
        />
        <TimecodeInput
          label="End Time"
          valueSec={formation.endSec ?? null}
          onCommit={(sec) => onChange({ endSec: sec })}
          testId="formation-details-end-sec"
        />
      </Stack>
      {/* Phase 6: Duration-computed under start/end så koreografen ser
          intervallen uten å regne i hodet. Null hvis enten start eller end
          mangler, eller hvis end ≤ start. */}
      {(() => {
        const start = formation.startSec;
        const end = formation.endSec;
        if (typeof start !== 'number' || typeof end !== 'number' || end <= start) {
          return null;
        }
        const durationSec = end - start;
        return (
          <Typography
            data-testid="formation-details-duration"
            sx={{
              fontSize: 10,
              color: 'rgba(167,139,250,0.85)',
              mt: -0.5,
              mb: 1,
              ml: 0.5,
            }}
          >
            Varighet: {formatTimecode(durationSec)} ({durationSec.toFixed(1)}s)
          </Typography>
        );
      })()}
      <TextField
        size="small"
        fullWidth
        multiline
        minRows={2}
        maxRows={4}
        placeholder="Notater for denne formasjonen"
        value={formation.notes ?? ''}
        onChange={(e) => onChange({ notes: e.target.value || undefined })}
        sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 11, color: '#e5e7eb' } }}
        data-testid="formation-details-notes"
      />
      <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5 }}>
        TAGS
      </Typography>
      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }} data-testid="formation-details-tags">
        {tags.map((t) => (
          <Chip
            key={t}
            size="small"
            label={t}
            onDelete={() => removeTag(t)}
            sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(167,139,250,0.18)', color: '#c4b5fd' }}
          />
        ))}
        {tags.length === 0 ? (
          <Typography sx={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
            Ingen tagger ennå
          </Typography>
        ) : null}
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Legg til tag…"
          value={tagDraft}
          onChange={(e) => setTagDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          inputProps={{ 'data-testid': 'formation-details-tag-input' }}
          sx={{ '& .MuiInputBase-input': { fontSize: 10.5, color: '#e5e7eb' } }}
        />
        <IconButton
          size="small"
          onClick={addTag}
          disabled={!tagDraft.trim()}
          sx={{ color: '#a78bfa' }}
          data-testid="formation-details-tag-add"
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* F5-1: Dancers-liste med visibility-toggles */}
      {dancersInFormation.length > 0 ? (
        <>
          <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5 }}>
            DANCERS ({dancersInFormation.length})
          </Typography>
          <Stack spacing={0.25} sx={{ mb: 1 }} data-testid="formation-dancers-list">
            {dancersInFormation.map((d) => {
              const hidden = hiddenDancerIds.has(d.id);
              return (
                <Stack
                  key={d.id}
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{ opacity: hidden ? 0.45 : 1 }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color ?? '#a78bfa', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: 10.5, color: '#e5e7eb', flex: 1, fontWeight: 600 }}>
                    {d.initials || d.id.slice(0, 2).toUpperCase()}{' · '}{d.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => onToggleHidden(d.id)}
                    data-testid={`formation-dancer-toggle-${d.id}`}
                    aria-pressed={!hidden}
                    aria-label={hidden ? `Vis ${d.name}` : `Skjul ${d.name}`}
                    sx={{ p: 0.25, color: hidden ? 'rgba(229,231,235,0.4)' : '#a78bfa' }}
                  >
                    {hidden ? <VisibilityOffIcon sx={{ fontSize: 14 }} /> : <VisibilityIcon sx={{ fontSize: 14 }} />}
                  </IconButton>
                </Stack>
              );
            })}
          </Stack>
        </>
      ) : null}

      {/* F5-2 + F5-4: Stage-overlay controls */}
      <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5, mt: 1 }}>
        STAGE
      </Typography>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }}>
        <Box
          component="label"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 10.5, color: '#e5e7eb', cursor: 'pointer' }}
        >
          <Checkbox
            size="small"
            checked={showPaths}
            onChange={onToggleShowPaths}
            inputProps={{ 'data-testid': 'formation-show-paths' } as React.InputHTMLAttributes<HTMLInputElement>}
            sx={{ p: 0.25, color: '#a78bfa', '&.Mui-checked': { color: '#a78bfa' } }}
          />
          Show Paths
        </Box>
        <Box
          component="label"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 10.5, color: '#e5e7eb', cursor: 'pointer' }}
        >
          <Checkbox
            size="small"
            checked={showIds}
            onChange={onToggleShowIds}
            inputProps={{ 'data-testid': 'formation-show-ids' } as React.InputHTMLAttributes<HTMLInputElement>}
            sx={{ p: 0.25, color: '#a78bfa', '&.Mui-checked': { color: '#a78bfa' } }}
          />
          Show IDs
        </Box>
      </Stack>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.55)', minWidth: 48 }}>Opacity</Typography>
        <input
          type="range"
          min={20}
          max={100}
          value={Math.round(stageOpacity * 100)}
          onChange={(e) => onStageOpacityChange(Number(e.target.value) / 100)}
          data-testid="formation-stage-opacity"
          style={{ flex: 1 }}
        />
        <Typography sx={{ fontSize: 10, color: '#a78bfa', minWidth: 32, textAlign: 'right' }}>
          {Math.round(stageOpacity * 100)}%
        </Typography>
      </Stack>

      {/* F5-5: TRANSITION editor */}
      <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: '#6b7280', fontWeight: 700, mb: 0.5 }}>
        TRANSITION
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ mb: 0.75 }}>
        <TextField
          select
          size="small"
          label="From"
          value={formation.transitionFromId ?? ''}
          onChange={(e) => onChange({ transitionFromId: e.target.value || null })}
          SelectProps={{ displayEmpty: true }}
          inputProps={{ 'data-testid': 'formation-transition-from' }}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 10.5 }, '& .MuiInputLabel-root': { fontSize: 11 } }}
        >
          <MenuItem value="" sx={{ fontSize: 11 }}>— start —</MenuItem>
          {transitionFromOptions.map((f) => (
            <MenuItem key={f.id} value={f.id} sx={{ fontSize: 11 }}>{f.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          label="To"
          value={transitionToFormation?.name ?? '—'}
          disabled
          inputProps={{ 'data-testid': 'formation-transition-to' }}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 10.5 }, '& .MuiInputLabel-root': { fontSize: 11 } }}
        />
      </Stack>
      <TextField
        size="small"
        fullWidth
        placeholder="Transition note (f.eks. 'D2 og D4 krysser')"
        value={formation.transitionNote ?? ''}
        onChange={(e) => onChange({ transitionNote: e.target.value || null })}
        inputProps={{ 'data-testid': 'formation-transition-note' }}
        sx={{ mb: 0.5, '& .MuiInputBase-input': { fontSize: 10.5, color: '#e5e7eb' } }}
      />
    </Box>
  );
};

// ═══════════════════════ FABRIC HELPERS ═══════════════════════

function drawStageBackground(
  canvas: Canvas,
  stageType: StageType = 'proscenium',
  snapStep: number = 0,
): void {
  const innerLeft = STAGE_PADDING;
  const innerTop = STAGE_PADDING;
  const innerWidth = STAGE_WIDTH - 2 * STAGE_PADDING;
  const innerHeight = STAGE_HEIGHT - 2 * STAGE_PADDING;

  if (stageType === 'in_the_round') {
    // Sirkulær scene — diameter = mindre av bredde/høyde.
    const radius = Math.min(innerWidth, innerHeight) / 2 - 4;
    const cx = STAGE_WIDTH / 2;
    const cy = STAGE_HEIGHT / 2;
    const stage = new Circle({
      left: cx - radius,
      top: cy - radius,
      radius,
      fill: '#11151c',
      stroke: '#2a3142',
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
    });
    canvas.add(stage);
    // Publikums-ring (gul)
    const audience = new Circle({
      left: cx - radius - 6,
      top: cy - radius - 6,
      radius: radius + 6,
      fill: 'transparent',
      stroke: '#fbbf24',
      strokeWidth: 2,
      strokeDashArray: [6, 6],
      selectable: false,
      evented: false,
    });
    canvas.add(audience);
  } else {
    // Rektangulær variant — proscenium / black_box / runway varierer i
    // proporsjoner, men deler grunnform.
    let stageW = innerWidth;
    let stageH = innerHeight;
    if (stageType === 'runway') {
      stageW = innerWidth * 0.5;
      stageH = innerHeight;
    } else if (stageType === 'black_box') {
      const side = Math.min(innerWidth, innerHeight);
      stageW = side;
      stageH = side;
    }
    const left = STAGE_WIDTH / 2 - stageW / 2;
    const top = STAGE_HEIGHT / 2 - stageH / 2;

    const stage = new Rect({
      left,
      top,
      width: stageW,
      height: stageH,
      fill: '#11151c',
      stroke: '#2a3142',
      strokeWidth: 1.5,
      rx: 6,
      ry: 6,
      selectable: false,
      evented: false,
    });
    canvas.add(stage);

    if (stageType === 'proscenium' || stageType === 'runway') {
      // Mirror line (back wall) — lilla, dash
      const mirror = new Line([left, top, left + stageW, top], {
        stroke: '#a78bfa',
        strokeWidth: 2,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
      });
      canvas.add(mirror);
      // Publikum (gul, foran)
      const audience = new Line(
        [left, top + stageH, left + stageW, top + stageH],
        {
          stroke: '#fbbf24',
          strokeWidth: 3,
          selectable: false,
          evented: false,
        },
      );
      canvas.add(audience);
    } else if (stageType === 'black_box') {
      // Black box — ingen klar foran/bak; tynne grønne markeringer på alle 4 sider.
      [
        [left, top, left + stageW, top],
        [left + stageW, top, left + stageW, top + stageH],
        [left + stageW, top + stageH, left, top + stageH],
        [left, top + stageH, left, top],
      ].forEach((coords) => {
        canvas.add(new Line(coords as [number, number, number, number], {
          stroke: 'rgba(52,211,153,0.55)',
          strokeWidth: 1.5,
          strokeDashArray: [4, 4],
          selectable: false,
          evented: false,
        }));
      });
    }

    // Senterlinje vertikalt
    const centerLine = new Line(
      [STAGE_WIDTH / 2, top, STAGE_WIDTH / 2, top + stageH],
      {
        stroke: 'rgba(255,255,255,0.06)',
        strokeWidth: 1,
        strokeDashArray: [3, 6],
        selectable: false,
        evented: false,
      },
    );
    canvas.add(centerLine);
  }

  // Snap-grid — tegnes oppå scenen som svake gule linjer hvis snap er aktiv.
  if (snapStep > 0) {
    const gridX = Math.round(1 / snapStep);
    const gridY = Math.round(1 / snapStep);
    for (let i = 1; i < gridX; i += 1) {
      const xx = innerLeft + (i / gridX) * innerWidth;
      canvas.add(new Line([xx, innerTop, xx, innerTop + innerHeight], {
        stroke: 'rgba(167,139,250,0.10)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      }));
    }
    for (let i = 1; i < gridY; i += 1) {
      const yy = innerTop + (i / gridY) * innerHeight;
      canvas.add(new Line([innerLeft, yy, innerLeft + innerWidth, yy], {
        stroke: 'rgba(167,139,250,0.10)',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      }));
    }
  }

  canvas.requestRenderAll();
}

interface DrawFormationOptions {
  /** Round x/y to nearest snapStep on drag end. 0 = no snap. */
  snapStep?: number;
  /** When true, dragging a dancer also mirrors the closest opposite dancer. */
  symmetry?: boolean;
  /** F5-1: dancer-ids that should NOT render on stage. */
  hiddenDancerIds?: ReadonlySet<string>;
  /** F5-2: render dancer-id label på hver puck. */
  showIds?: boolean;
  /** F5-2: render historiske paths som dashed-linje for hver dancer. */
  showPaths?: boolean;
  /** Forrige + neste formasjon brukes til path-rendering. */
  prevFormation?: Formation | null;
  nextFormation?: Formation | null;
}

function drawFormation(
  canvas: Canvas,
  formation: Formation,
  dancersById: Map<string, Dancer>,
  onPositionChange: (dancerId: string, x: number, y: number) => void,
  onDancerDoubleClick?: (dancerId: string) => void,
  options: DrawFormationOptions = {},
): void {
  // Fjern alle eksisterende dancer-pucker (men behold stage-bakgrunnen)
  const objectsToRemove = canvas.getObjects().filter((o) => (o as { dancerId?: string }).dancerId);
  objectsToRemove.forEach((o) => canvas.remove(o));

  const innerWidth = STAGE_WIDTH - 2 * STAGE_PADDING;
  const innerHeight = STAGE_HEIGHT - 2 * STAGE_PADDING;
  const hidden = options.hiddenDancerIds ?? new Set<string>();

  // F5-2: tegn path-linjer FØRST slik at pucker rendres oppå
  if (options.showPaths && (options.prevFormation || options.nextFormation)) {
    const drawPath = (from: Formation | null | undefined, to: Formation, color: (id: string) => string): void => {
      if (!from) return;
      for (const pTo of to.positions) {
        if (hidden.has(pTo.dancerId)) continue;
        const pFrom = from.positions.find((p) => p.dancerId === pTo.dancerId);
        if (!pFrom) continue;
        const x1 = STAGE_PADDING + pFrom.x * innerWidth;
        const y1 = STAGE_PADDING + pFrom.y * innerHeight;
        const x2 = STAGE_PADDING + pTo.x * innerWidth;
        const y2 = STAGE_PADDING + pTo.y * innerHeight;
        const line = new Line([x1, y1, x2, y2], {
          stroke: color(pTo.dancerId),
          strokeWidth: 1.2,
          strokeDashArray: [4, 4],
          selectable: false,
          evented: false,
          opacity: 0.55,
        });
        (line as unknown as { dancerId?: string }).dancerId = `__path__${pTo.dancerId}`;
        canvas.add(line);
      }
    };
    const colorFor = (id: string): string => dancersById.get(id)?.color ?? '#a78bfa';
    drawPath(options.prevFormation, formation, colorFor);
    drawPath(formation, options.nextFormation as Formation | null | undefined ?? null!, colorFor);
  }

  formation.positions.forEach((pos, idx) => {
    if (hidden.has(pos.dancerId)) return;
    const dancer = dancersById.get(pos.dancerId);
    if (!dancer) return;

    const cx = STAGE_PADDING + pos.x * innerWidth;
    const cy = STAGE_PADDING + pos.y * innerHeight;
    const color = dancer.color ?? '#3b82f6';

    // Sirkel for danser-puck
    const circle = new Circle({
      radius: PUCK_RADIUS,
      fill: color,
      stroke: pos.isLead ? '#fbbf24' : 'rgba(255,255,255,0.4)',
      strokeWidth: pos.isLead ? 3 : 1.5,
      originX: 'center',
      originY: 'center',
    });

    // Initialer
    const initials = new Textbox(dancer.initials, {
      fontSize: 14,
      fontWeight: 'bold',
      fontFamily: '-apple-system, sans-serif',
      fill: '#fff',
      width: PUCK_RADIUS * 2,
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      top: -7,
      selectable: false,
      evented: false,
    });

    // Navn-label under puck
    const nameLabel = new Textbox(dancer.name, {
      fontSize: 10,
      fontWeight: 'bold',
      fontFamily: '-apple-system, sans-serif',
      fill: '#e5e7eb',
      width: 100,
      textAlign: 'center',
      originX: 'center',
      originY: 'center',
      top: PUCK_RADIUS + 8,
      selectable: false,
      evented: false,
    });

    // Lead-stjerne
    const leadStar = pos.isLead
      ? new Textbox('★', {
          fontSize: 14,
          fill: '#fbbf24',
          width: 20,
          textAlign: 'center',
          originX: 'center',
          originY: 'center',
          top: -PUCK_RADIUS - 6,
          selectable: false,
          evented: false,
        })
      : null;

    // Retningspil
    const facing = pos.facing ?? 0;
    const arrowLen = PUCK_RADIUS + 12;
    const rad = (facing - 90) * (Math.PI / 180);
    const arrow = new Line(
      [0, 0, Math.cos(rad) * arrowLen, Math.sin(rad) * arrowLen],
      {
        stroke: 'rgba(255,255,255,0.6)',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
      },
    );

    const groupChildren = [arrow, circle, initials, nameLabel];
    if (leadStar) groupChildren.push(leadStar);
    if (options.showIds) {
      // Phase 6: ordinal D1/D2/D3... — leselig vs full UUID. Idx er stabil
      // innen samme formasjon siden positions-arrayen vedlikeholdes av
      // brukeren.
      const idLabel = new Textbox(`D${idx + 1}`, {
        fontSize: 11,
        fontFamily: '-apple-system, sans-serif',
        fill: 'rgba(255,255,255,0.75)',
        fontWeight: '700',
        width: 40,
        textAlign: 'center',
        originX: 'center',
        originY: 'center',
        top: PUCK_RADIUS + 22,
        selectable: false,
        evented: false,
      });
      groupChildren.push(idLabel);
    }

    const group = new Group(groupChildren, {
      left: cx,
      top: cy,
      originX: 'center',
      originY: 'center',
      hasControls: false,
      hasBorders: false,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    });
    // Tag gruppen for clean removal + identifisering
    (group as { dancerId?: string }).dancerId = dancer.id;

    // Drag — lytt på modified-event for å persistere
    group.on('moving', () => {
      // Soft clamp til scene-areal
      const minX = STAGE_PADDING + PUCK_RADIUS;
      const maxX = STAGE_WIDTH - STAGE_PADDING - PUCK_RADIUS;
      const minY = STAGE_PADDING + PUCK_RADIUS;
      const maxY = STAGE_HEIGHT - STAGE_PADDING - PUCK_RADIUS;
      if (group.left! < minX) group.left = minX;
      if (group.left! > maxX) group.left = maxX;
      if (group.top! < minY) group.top = minY;
      if (group.top! > maxY) group.top = maxY;
    });

    group.on('modified', () => {
      let newX = ((group.left ?? cx) - STAGE_PADDING) / innerWidth;
      let newY = ((group.top ?? cy) - STAGE_PADDING) / innerHeight;
      newX = Math.max(0, Math.min(1, newX));
      newY = Math.max(0, Math.min(1, newY));
      const snap = options.snapStep ?? 0;
      if (snap > 0) {
        newX = Math.round(newX / snap) * snap;
        newY = Math.round(newY / snap) * snap;
      }
      onPositionChange(dancer.id, newX, newY);

      // Symmetry: speil partner-danseren over senter-aksen (x = 0.5).
      // Partner = den andre danseren med original-x nærmest (1 - pos.x).
      if (options.symmetry) {
        const targetMirrorX = 1 - pos.x;
        let nearestId: string | null = null;
        let nearestDist = Infinity;
        for (const p of formation.positions) {
          if (p.dancerId === dancer.id) continue;
          // Manhattan-avstand mellom partner-kandidatens nåværende pos og
          // den dragsubjektets speilbilde.
          const d = Math.abs(p.x - targetMirrorX) + Math.abs(p.y - pos.y);
          if (d < nearestDist) {
            nearestDist = d;
            nearestId = p.dancerId;
          }
        }
        // Krev en rimelig nær partner (innenfor 40% Manhattan-avstand) så
        // vi ikke griper tilfeldige dansere når ingen god match finnes.
        if (nearestId && nearestDist < 0.4) {
          let mirrorX = 1 - newX;
          let mirrorY = newY;
          if (snap > 0) {
            mirrorX = Math.round(mirrorX / snap) * snap;
            mirrorY = Math.round(mirrorY / snap) * snap;
          }
          onPositionChange(nearestId, mirrorX, mirrorY);
        }
      }
    });

    // Dobbeltklikk = åpne profil. Vi bruker mousedblclick som er trygg
    // mot pågående drag (drag bruker mousedown/move/up).
    if (onDancerDoubleClick) {
      group.on('mousedblclick', () => {
        onDancerDoubleClick(dancer.id);
      });
    }

    // Hvis dancer.photoUrl finnes, last bildet og bytt ut sirkel-fillet med en pattern
    if (dancer.photoUrl) {
      void FabricImage.fromURL(dancer.photoUrl, { crossOrigin: 'anonymous' }).then((img) => {
        const scale = (PUCK_RADIUS * 2) / Math.max(img.width!, img.height!);
        img.scale(scale);
        img.set({
          originX: 'center',
          originY: 'center',
          clipPath: new Circle({ radius: PUCK_RADIUS, originX: 'center', originY: 'center' }),
          selectable: false,
          evented: false,
        });
        // Erstatte initialene med bildet
        group.remove(initials);
        group.add(img);
        canvas.requestRenderAll();
      }).catch(() => {
        /* fallback til initialer ved feil */
      });
    }

    canvas.add(group);
  });

  canvas.requestRenderAll();
}

/**
 * Animer alle dansere fra deres posisjoner i `from`-formation til `to`-formation.
 * Bruker Fabric sin innebygde tween-animasjon.
 */
function animateFormationTransition(
  canvas: Canvas,
  from: Formation,
  to: Formation,
  dancersById: Map<string, Dancer>,
  onComplete: () => void,
): void {
  const innerWidth = STAGE_WIDTH - 2 * STAGE_PADDING;
  const innerHeight = STAGE_HEIGHT - 2 * STAGE_PADDING;
  const duration = 1500; // ms
  const groups = canvas.getObjects().filter((o) => (o as { dancerId?: string }).dancerId) as (Group & { dancerId: string })[];

  let animationsRemaining = 0;
  let completedCount = 0;

  groups.forEach((group) => {
    const targetPos = to.positions.find((p) => p.dancerId === group.dancerId);
    if (!targetPos) return;
    animationsRemaining++;
    const targetX = STAGE_PADDING + targetPos.x * innerWidth;
    const targetY = STAGE_PADDING + targetPos.y * innerHeight;

    group.animate({ left: targetX, top: targetY }, {
      duration,
      easing: (t: number, b: number, c: number, d: number) => {
        // easeInOutCubic
        t /= d / 2;
        if (t < 1) return (c / 2) * t * t * t + b;
        t -= 2;
        return (c / 2) * (t * t * t + 2) + b;
      },
      onChange: () => canvas.requestRenderAll(),
      onComplete: () => {
        completedCount++;
        if (completedCount >= animationsRemaining) onComplete();
      },
    });
  });

  if (animationsRemaining === 0) onComplete();
}

export default FormationView;
