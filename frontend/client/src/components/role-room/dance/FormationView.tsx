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
}

// ─── Komponent ────────────────────────────────────────────────────────────

export const FormationView: React.FC<FormationViewProps> = ({
  dancers = DEMO_DANCERS,
  initialFormations = DEMO_FORMATIONS,
  onFormationsChange,
  onDancerClick,
}) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

  const [formations, setFormations] = useState<Formation[]>(() => [...initialFormations]);
  const [activeFormationId, setActiveFormationId] = useState<string | null>(
    () => initialFormations[0]?.id ?? null,
  );
  const [newFormationName, setNewFormationName] = useState('');
  const [animationProgress, setAnimationProgress] = useState<{ from: string; to: string } | null>(null);

  // Stage + manipulasjons-verktøy (Slice 6)
  const [stageType, setStageType] = useState<StageType>('proscenium');
  const [snapStep, setSnapStep] = useState<number>(SNAP_OFF);
  const [symmetry, setSymmetry] = useState<boolean>(false);

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
    drawFormation(
      canvas,
      activeFormation,
      dancersById,
      (dancerId, x, y) => {
        // Persistert posisjons-endring fra drag — oppdater state
        updateDancerPosition(dancerId, x, y);
      },
      (dancerId) => {
        // Dobbeltklikk på en puck — bruk ref slik at den alltid har
        // siste callback uten å trigge re-tegning.
        onDancerClickRef.current?.(dancerId);
      },
      { snapStep, symmetry },
    );
  }, [activeFormation, dancersById, updateDancerPosition, snapStep, symmetry]);

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
        </Stack>

        <Box
          sx={{
            position: 'relative',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #2a3142',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <canvas
            ref={canvasElRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            data-testid="formation-canvas"
            style={{ display: 'block' }}
          />
          {/* Overlay: scene-orientering */}
          <Typography
            sx={{
              position: 'absolute', top: 6, left: 0, right: 0, textAlign: 'center',
              fontSize: 9, color: '#6b7280', letterSpacing: 1.5, pointerEvents: 'none',
            }}
          >
            ↑ MIRROR · BACK WALL
          </Typography>
          <Typography
            sx={{
              position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
              fontSize: 9, color: '#fbbf24', letterSpacing: 1.5, pointerEvents: 'none',
              fontWeight: 700,
            }}
          >
            ↓ AUDIENCE · FRONT
          </Typography>
        </Box>

        <Typography sx={{ fontSize: 10, color: '#6b7280', textAlign: 'center', mt: -0.5 }}>
          Drag dansere på scenen for å plassere. Posisjonen lagres automatisk i aktiv formasjon.
        </Typography>
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
        {activeFormation ? (
          <FormationDetailsPanel
            key={activeFormation.id}
            formation={activeFormation}
            onChange={updateActiveFormation}
          />
        ) : null}
        <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#6b7280', fontWeight: 700, mb: 1, mt: activeFormation ? 1.5 : 0 }}>
          FORMASJONER ({formations.length})
        </Typography>

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
    {/* DanceFlow-paritet: tids-akse for formasjons-rekkefølge */}
    <Box sx={{ p: 1.5, borderTop: '1px solid #1e2536', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FormationTimeline
        formations={formations}
        activeFormationId={activeFormationId}
        onSelect={setActiveFormationId}
      />
      <DancerPathsView formations={formations} dancers={dancers} />
    </Box>
    </Box>
  );
};

// ═══════════════════════ FORMATION DETAILS PANEL ═══════════════════════
// DanceFlow-paritet: per-formation editor med tags, notes og time-felt.

interface FormationDetailsPanelProps {
  formation: Formation;
  onChange: (patch: Partial<Formation>) => void;
}

const FormationDetailsPanel: React.FC<FormationDetailsPanelProps> = ({ formation, onChange }) => {
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

  return (
    <Box
      data-testid="formation-details-panel"
      sx={{ pb: 1.5, mb: 1.5, borderBottom: '1px solid #1e2536' }}
    >
      <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#a78bfa', fontWeight: 700, mb: 0.75 }}>
        AKTIV FORMASJON
      </Typography>
      <TextField
        size="small"
        fullWidth
        value={formation.name}
        onChange={(e) => onChange({ name: e.target.value })}
        sx={{ mb: 1, '& .MuiInputBase-input': { fontSize: 12, color: '#fff', fontWeight: 600 } }}
        data-testid="formation-details-name"
      />
      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
        <TextField
          size="small"
          type="number"
          label="Start (s)"
          value={formation.startSec ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            onChange({ startSec: Number.isFinite(v as number) ? (v as number) : null });
          }}
          inputProps={{ min: 0, step: 0.5, 'data-testid': 'formation-details-start-sec' }}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 11 }, '& .MuiInputLabel-root': { fontSize: 11 } }}
        />
        <TextField
          size="small"
          type="number"
          label="Slutt (s)"
          value={formation.endSec ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Number(e.target.value);
            onChange({ endSec: Number.isFinite(v as number) ? (v as number) : null });
          }}
          inputProps={{ min: 0, step: 0.5, 'data-testid': 'formation-details-end-sec' }}
          sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 11 }, '& .MuiInputLabel-root': { fontSize: 11 } }}
        />
      </Stack>
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
      <Stack direction="row" spacing={0.5}>
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

  formation.positions.forEach((pos) => {
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
