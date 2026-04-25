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
} from '@mui/icons-material';
import { Canvas, Circle, Rect, Textbox, Line, Group, FabricImage } from 'fabric';
import {
  DEMO_DANCERS,
  DEMO_FORMATIONS,
  type Dancer,
  type DancerPosition,
  type Formation,
} from './formationTypes';

// ─── Stage-dimensjoner (interne canvas-piksler — uavhengig av render-størrelse) ─

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
}

// ─── Komponent ────────────────────────────────────────────────────────────

export const FormationView: React.FC<FormationViewProps> = ({
  dancers = DEMO_DANCERS,
  initialFormations = DEMO_FORMATIONS,
  onFormationsChange,
}) => {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<Canvas | null>(null);

  const [formations, setFormations] = useState<Formation[]>(() => [...initialFormations]);
  const [activeFormationId, setActiveFormationId] = useState<string | null>(
    () => initialFormations[0]?.id ?? null,
  );
  const [newFormationName, setNewFormationName] = useState('');
  const [animationProgress, setAnimationProgress] = useState<{ from: string; to: string } | null>(null);

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

    drawStageBackground(canvas);

    return () => {
      void canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // ─── Tegn aktiv formasjon når den endres ──────────

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !activeFormation) return;
    drawFormation(canvas, activeFormation, dancersById, (dancerId, x, y) => {
      // Persistert posisjons-endring fra drag — oppdater state
      updateDancerPosition(dancerId, x, y);
    });
  }, [activeFormation, dancersById]);

  // ─── Hjelpefunksjoner ──────────────────────────────

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
  }, [activeFormationId]);

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
    };
    setFormations((prev) => [...prev, snapshot]);
    setActiveFormationId(snapshot.id);
    setNewFormationName('');
  }, [activeFormation, newFormationName]);

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

  // ─── Render ────────────────────────────────────────

  return (
    <Box
      data-testid="formation-view"
      sx={{
        bgcolor: '#0a0a0a',
        color: '#e5e7eb',
        minHeight: '100%',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '200px 1fr 260px' },
        gap: 0,
      }}
    >
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
        <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: '#6b7280', fontWeight: 700, mb: 1 }}>
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
  );
};

// ═══════════════════════ FABRIC HELPERS ═══════════════════════

function drawStageBackground(canvas: Canvas): void {
  // Stage rectangle
  const stage = new Rect({
    left: STAGE_PADDING,
    top: STAGE_PADDING,
    width: STAGE_WIDTH - 2 * STAGE_PADDING,
    height: STAGE_HEIGHT - 2 * STAGE_PADDING,
    fill: '#11151c',
    stroke: '#2a3142',
    strokeWidth: 1.5,
    rx: 6,
    ry: 6,
    selectable: false,
    evented: false,
  });
  canvas.add(stage);

  // Mirror line (back wall)
  const mirror = new Line(
    [STAGE_PADDING, STAGE_PADDING, STAGE_WIDTH - STAGE_PADDING, STAGE_PADDING],
    {
      stroke: '#a78bfa',
      strokeWidth: 2,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    },
  );
  canvas.add(mirror);

  // Audience marker (front edge)
  const audience = new Line(
    [STAGE_PADDING, STAGE_HEIGHT - STAGE_PADDING, STAGE_WIDTH - STAGE_PADDING, STAGE_HEIGHT - STAGE_PADDING],
    {
      stroke: '#fbbf24',
      strokeWidth: 3,
      selectable: false,
      evented: false,
    },
  );
  canvas.add(audience);

  // Center line (vertical, dashed)
  const centerLine = new Line(
    [STAGE_WIDTH / 2, STAGE_PADDING, STAGE_WIDTH / 2, STAGE_HEIGHT - STAGE_PADDING],
    {
      stroke: 'rgba(255,255,255,0.06)',
      strokeWidth: 1,
      strokeDashArray: [3, 6],
      selectable: false,
      evented: false,
    },
  );
  canvas.add(centerLine);

  canvas.requestRenderAll();
}

function drawFormation(
  canvas: Canvas,
  formation: Formation,
  dancersById: Map<string, Dancer>,
  onPositionChange: (dancerId: string, x: number, y: number) => void,
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
      const newX = ((group.left ?? cx) - STAGE_PADDING) / innerWidth;
      const newY = ((group.top ?? cy) - STAGE_PADDING) / innerHeight;
      onPositionChange(dancer.id, Math.max(0, Math.min(1, newX)), Math.max(0, Math.min(1, newY)));
    });

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
