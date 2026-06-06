/**
 * CurveOverlay — DanceFlow-paritet F5-13B: faktisk bezier-tegne-infrastruktur.
 *
 * Når curve-mode er aktiv legges denne SVG-en på toppen av 2D-stage og
 * brukeren kan dra to kontrollpunkter for å reshape den interpolerte
 * banen for en danser mellom denne formasjonen og neste. Hvis ingen
 * bane finnes ennå genereres en default fra start/end + en S-kurve.
 *
 * Output: oppdaterer `formation.transitionPaths` via onChange.
 *
 * Koordinat-modell: alt normalisert (0..1) som elsewhere. SVG-en bruker
 * viewBox="0 0 100 100" + preserveAspectRatio="none" så den følger
 * canvas-bredden eksakt.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import { Box, Tooltip } from '@mui/material';
import type { Dancer, DancerTransitionPath, Formation } from './formationTypes';

const HANDLE_RADIUS = 6;

export interface CurveOverlayProps {
  /** Formasjonen vi er "fra". */
  formation: Formation;
  /** Neste formasjon i sekvensen (eller null hvis siste). */
  nextFormation: Formation | null;
  dancers: readonly Dancer[];
  /** Når true: handles er dragbar + ny-curve-affordance vises. */
  enabled: boolean;
  /** Endre transitionPaths på formation. */
  onChange: (paths: DancerTransitionPath[]) => void;
}

type DragState =
  | { kind: 'handle'; dancerId: string; handleIdx: 0 | 1 }
  | null;

function defaultControls(
  start: { x: number; y: number },
  end: { x: number; y: number },
): Array<{ x: number; y: number }> {
  // Default S-kurve: 1/3 og 2/3 punkter med liten offset.
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // Perpendikulær offset til midt-linjen for naturlig curve.
  const normalLen = Math.hypot(dx, dy) || 1;
  const nx = -dy / normalLen;
  const ny = dx / normalLen;
  const off = 0.08;
  return [
    { x: clamp01(start.x + dx / 3 + nx * off),  y: clamp01(start.y + dy / 3 + ny * off) },
    { x: clamp01(start.x + (dx * 2) / 3 - nx * off), y: clamp01(start.y + (dy * 2) / 3 - ny * off) },
  ];
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

export function CurveOverlay({
  formation,
  nextFormation,
  dancers,
  enabled,
  onChange,
}: CurveOverlayProps): React.ReactElement | null {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = React.useState<DragState>(null);

  // Local working state under drag (avoids re-running parent useEffects per frame).
  const [localPaths, setLocalPaths] = React.useState<DancerTransitionPath[] | null>(null);
  const effectivePaths = localPaths ?? formation.transitionPaths ?? [];

  const dancersById = React.useMemo(
    () => new Map(dancers.map((d) => [d.id, d])),
    [dancers],
  );

  // For hver danser som finnes i BÅDE formation og nextFormation, finn
  // (start, end) — den danseren har en mulig curve.
  const pairs = React.useMemo(() => {
    if (!nextFormation) return [];
    return formation.positions
      .map((p) => {
        const next = nextFormation.positions.find((q) => q.dancerId === p.dancerId);
        if (!next) return null;
        return { dancerId: p.dancerId, start: p, end: next };
      })
      .filter((v): v is { dancerId: string; start: { x: number; y: number; dancerId: string }; end: { x: number; y: number; dancerId: string } } => v !== null);
  }, [formation, nextFormation]);

  // Helper: for et dancer-id, finn (eller generer) controlPoints.
  const getControlsFor = React.useCallback((dancerId: string): Array<{ x: number; y: number }> => {
    const existing = effectivePaths.find((p) => p.dancerId === dancerId);
    if (existing && existing.controlPoints.length >= 2) {
      return existing.controlPoints.slice(0, 2);
    }
    const pair = pairs.find((p) => p.dancerId === dancerId);
    if (!pair) return [];
    return defaultControls(pair.start, pair.end);
  }, [effectivePaths, pairs]);

  // Pointer-handlers — ferdig delegert til document slik at vi ikke mister
  // dragging når pointer forlater SVG-en.
  React.useEffect(() => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const onMove = (e: PointerEvent): void => {
      const rect = svg.getBoundingClientRect();
      const x = clamp01((e.clientX - rect.left) / rect.width);
      const y = clamp01((e.clientY - rect.top) / rect.height);
      setLocalPaths((prev) => {
        const base = prev ?? formation.transitionPaths ?? [];
        const next = base.filter((p) => p.dancerId !== drag.dancerId);
        const existing = base.find((p) => p.dancerId === drag.dancerId);
        const cps = existing && existing.controlPoints.length >= 2
          ? existing.controlPoints.slice(0, 2).map((c) => ({ ...c }))
          : getControlsFor(drag.dancerId);
        cps[drag.handleIdx] = { x, y };
        next.push({ dancerId: drag.dancerId, controlPoints: cps });
        return next;
      });
    };
    const onUp = (): void => {
      // Push localPaths to parent via onChange, clear local state.
      setLocalPaths((prev) => {
        if (prev) onChange(prev);
        return null;
      });
      setDrag(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [drag, formation.transitionPaths, getControlsFor, onChange]);

  if (!nextFormation || pairs.length === 0) return null;

  return (
    <Box
      data-testid="formation-curve-overlay"
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: enabled ? 'auto' : 'none',
      }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {pairs.map(({ dancerId, start, end }) => {
          const cps = getControlsFor(dancerId);
          if (cps.length < 2) return null;
          const dancer = dancersById.get(dancerId);
          const color = dancer?.color ?? danceFlowColors.lavender;
          // M start C cp0 cp1 end
          const path = `M ${start.x * 100} ${start.y * 100} C ${cps[0].x * 100} ${cps[0].y * 100}, ${cps[1].x * 100} ${cps[1].y * 100}, ${end.x * 100} ${end.y * 100}`;
          return (
            <g key={dancerId} data-testid={`formation-curve-${dancerId}`}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={1.8}
                strokeLinecap="round"
                opacity={0.85}
                vectorEffect="non-scaling-stroke"
              />
              {/* Guide-linjer fra anker til kontroll */}
              <line
                x1={start.x * 100} y1={start.y * 100}
                x2={cps[0].x * 100} y2={cps[0].y * 100}
                stroke={color} strokeWidth={0.6} opacity={0.4} strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              <line
                x1={end.x * 100} y1={end.y * 100}
                x2={cps[1].x * 100} y2={cps[1].y * 100}
                stroke={color} strokeWidth={0.6} opacity={0.4} strokeDasharray="2 2"
                vectorEffect="non-scaling-stroke"
              />
              {/* Handles — kun synlige+dragbar når curve-mode er på */}
              {enabled ? (
                <>
                  <Tooltip title={`Drag for å reshape (${dancer?.name ?? dancerId})`}>
                    <circle
                      data-testid={`formation-curve-handle-${dancerId}-0`}
                      cx={cps[0].x * 100}
                      cy={cps[0].y * 100}
                      r={1.4}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={0.4}
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDrag({ kind: 'handle', dancerId, handleIdx: 0 });
                      }}
                      vectorEffect="non-scaling-stroke"
                    />
                  </Tooltip>
                  <Tooltip title={`Drag for å reshape (${dancer?.name ?? dancerId})`}>
                    <circle
                      data-testid={`formation-curve-handle-${dancerId}-1`}
                      cx={cps[1].x * 100}
                      cy={cps[1].y * 100}
                      r={1.4}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={0.4}
                      style={{ cursor: 'grab' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDrag({ kind: 'handle', dancerId, handleIdx: 1 });
                      }}
                      vectorEffect="non-scaling-stroke"
                    />
                  </Tooltip>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </Box>
  );
}

export default CurveOverlay;
